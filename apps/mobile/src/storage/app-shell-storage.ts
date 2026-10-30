import { defaultKeywordRules } from '@/domain/default-tracking-keywords';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import {
  authSessionSchema,
  type AuthenticationSession,
  keywordRuleSchema,
  onboardingProgressSchema,
  privacyLockPreferenceSchema,
  trackingPreferenceSchema
} from '@/domain/app-shell';
import {
  appShellStorageCapability,
  type AppShellStorage
} from '@/services/contracts/app-shell-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';

const keys = {
  session: 'masarifi.appShell.session',
  previewSession: 'masarifi.appShell.preview.session',
  onboarding: 'masarifi.appShell.onboarding',
  keywords: 'masarifi.appShell.keywords',
  trackingPreference: 'masarifi.appShell.trackingPreference',
  pendingDestination: 'masarifi.appShell.pendingDestination',
  privacyLock: 'masarifi.appShell.privacyLock',
  nativePrivacyLock: 'masarifi.appShell.nativePrivacyLock.v1',
  previewPrivacyLock: 'masarifi.appShell.preview.privacyLock',
  pinCredential: 'masarifi.appShell.pinCredential',
  profilePromptDismissed: 'masarifi.appShell.profilePromptDismissed',
  trackingHomeCardDismissed: 'masarifi.appShell.trackingHomeCardDismissed'
};

const asyncUserDataKeys = [
  keys.onboarding,
  keys.keywords,
  keys.trackingPreference,
  keys.pendingDestination,
  keys.profilePromptDismissed,
  keys.trackingHomeCardDismissed
] as const;
const sensitiveUserDataKeys = [
  keys.session,
  keys.privacyLock,
  keys.nativePrivacyLock,
  keys.pinCredential
] as const;
let activeOwnerHash: string | null = null;
let ownerGeneration = 0;

const localOwnerKey = 'masarifi.appShell.localOwner.v1';
let localOwnerMutation: Promise<void> = Promise.resolve();
let logoutAdmissionRevision = 0;
const logoutDispositionSchema = z.object({
  id: z.string().uuid(), ownerId: z.string().min(1), sessionId: z.string().min(1).nullable(),
  scope: z.enum(['local', 'all']), phase: z.enum(['prepared', 'cleanup-ready'])
}).strict();
export type LogoutDisposition = z.infer<typeof logoutDispositionSchema>;
export const currentLogoutAdmissionRevision = () => logoutAdmissionRevision;
function serializeLocalOwner(change: () => Promise<void>): Promise<void> {
  const next = localOwnerMutation.then(change, change);
  localOwnerMutation = next.catch(() => undefined);
  return next;
}

async function logoutDispositionKey(ownerId: string): Promise<string> {
  const hash = bytesToHex(sha256(utf8ToBytes(ownerId)));
  return `masarifi.appShell.logoutDisposition.v1.${hash}`;
}

export async function loadLogoutDisposition(ownerId: string): Promise<LogoutDisposition | null> {
  const key = await logoutDispositionKey(ownerId);
  const raw = Platform.OS === 'web' ? await AsyncStorage.getItem(previewKey(key)) : await SecureStore.getItemAsync(key);
  if (raw === null) return null;
  const record = logoutDispositionSchema.parse(JSON.parse(raw));
  if (record.ownerId !== ownerId) throw new Error('LOGOUT_OWNER_MISMATCH');
  return record;
}

export async function isLogoutOwnerFenced(ownerId: string): Promise<boolean> {
  return Boolean(await loadLogoutDisposition(ownerId));
}

export async function loadCachedLogoutDisposition(): Promise<LogoutDisposition | null> {
  const cached = await readSensitive(localOwnerKey, authSessionSchema);
  return cached?.userId ? loadLogoutDisposition(cached.userId) : null;
}

export async function prepareLogoutDisposition(input: Pick<LogoutDisposition, 'ownerId' | 'sessionId' | 'scope'>): Promise<LogoutDisposition> {
  logoutAdmissionRevision++;
  let prepared!: LogoutDisposition;
  await serializeLocalOwner(async () => {
    const existing = await loadLogoutDisposition(input.ownerId);
    if (existing) { prepared = existing; return; }
    prepared = logoutDispositionSchema.parse({ ...input, id: Crypto.randomUUID(), phase: 'prepared' });
    await writeSensitive(await logoutDispositionKey(input.ownerId), prepared);
    if ((await loadLogoutDisposition(input.ownerId))?.id !== prepared.id) throw new Error('LOGOUT_PERSISTENCE_UNCONFIRMED');
  });
  return prepared;
}

export async function markLogoutCleanupReady(record: LogoutDisposition): Promise<LogoutDisposition> {
  const ready = { ...record, phase: 'cleanup-ready' as const };
  await serializeLocalOwner(async () => {
    const current = await loadLogoutDisposition(record.ownerId);
    if (current?.id !== record.id) throw new Error('LOGOUT_DISPOSITION_CHANGED');
    await writeSensitive(await logoutDispositionKey(record.ownerId), ready);
    if ((await loadLogoutDisposition(record.ownerId))?.phase !== 'cleanup-ready') throw new Error('LOGOUT_PERSISTENCE_UNCONFIRMED');
  });
  return ready;
}

export async function completeLogoutDisposition(record: LogoutDisposition): Promise<void> {
  await serializeLocalOwner(async () => {
    const current = await loadLogoutDisposition(record.ownerId);
    if (current?.id !== record.id || current.phase !== 'cleanup-ready') throw new Error('LOGOUT_DISPOSITION_CHANGED');
    const cached = await readSensitive(localOwnerKey, authSessionSchema);
    if (cached?.userId === record.ownerId) await removeSensitive(localOwnerKey);
    await removeSensitive(await logoutDispositionKey(record.ownerId));
    if (await loadLogoutDisposition(record.ownerId)) throw new Error('LOGOUT_PERSISTENCE_UNCONFIRMED');
    logoutAdmissionRevision++;
  });
}

/** Save only after an authenticated server bootstrap confirms profile completion. */
export async function cacheLocalOwnerAccess(
  session: AuthenticationSession,
  isCurrent = () => true
): Promise<void> {
  if (
    session.status !== 'authenticated' ||
    !session.userId ||
    /^(?:mock|demo|fixture|test)(?:[-_]|$)/i.test(session.userId)
  )
    throw new Error('invalid cached owner');
  if (!isCurrent()) return;
  const generation = ownerGeneration;
  await serializeLocalOwner(async () => {
    if (!isCurrent() || generation !== ownerGeneration) return;
    if (await isLogoutOwnerFenced(session.userId!)) return;
    await writeSensitive(localOwnerKey, authSessionSchema.parse(session));
    if (!isCurrent() || generation !== ownerGeneration) {
      const stored = await readSensitive(localOwnerKey, authSessionSchema);
      if (stored?.userId === session.userId)
        await removeSensitive(localOwnerKey);
    }
  });
}

export const loadLocalOwnerAccess = async () => {
  const cached = await readSensitive(localOwnerKey, authSessionSchema);
  return cached?.userId && await isLogoutOwnerFenced(cached.userId) ? null : cached;
};
export const clearLocalOwnerAccess = () =>
  serializeLocalOwner(() => removeSensitive(localOwnerKey));

export async function configureAppShellStorageOwner(
  userId: string
): Promise<void> {
  const generation = ++ownerGeneration;
  const ownerHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId
  );
  if (generation !== ownerGeneration) return;
  activeOwnerHash = ownerHash;
}

export function clearAppShellStorageOwner(): void {
  ownerGeneration++;
  activeOwnerHash = null;
}

export async function clearAppShellUserData(): Promise<void> {
  await Promise.all([
    ...asyncUserDataKeys.map((key) => AsyncStorage.removeItem(ownerKey(key))),
    ...sensitiveUserDataKeys.map((key) => removeSensitive(ownerKey(key)))
  ]);
}

export async function purgeAppShellOwnerData(ownerId: string): Promise<void> {
  const ownerHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ownerId
  );
  const suffix = ownerHash.slice(0, 24);
  const asyncKeys = [
    ...asyncUserDataKeys.map((key) => `${key}.${suffix}`),
    `masarifi.export.${ownerId}`
  ];
  const secureKeys = sensitiveUserDataKeys.map((key) => `${key}.${suffix}`);
  await Promise.all([
    ...asyncKeys.map((key) => AsyncStorage.removeItem(key)),
    ...secureKeys.map((key) => removeSensitive(key))
  ]);
  const remaining = await Promise.all([
    ...asyncKeys.map((key) => AsyncStorage.getItem(key)),
    ...secureKeys.map((key) =>
      Platform.OS === 'web'
        ? AsyncStorage.getItem(previewKey(key))
        : SecureStore.getItemAsync(key)
    )
  ]);
  if (remaining.some((payload) => payload !== null))
    throw new Error('owner shell data remains');
}

export function createAppShellStorage(): CapabilityProviderHandle<AppShellStorage> {
  return {
    metadata: {
      id: 'protected-app-shell-storage',
      capability: appShellStorageCapability.capability,
      majorVersion: appShellStorageCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    loadSession: () => readSensitive(keys.session, authSessionSchema),
    saveSession: (session) => writeSensitive(keys.session, session),
    clearSession: () => removeSensitive(keys.session),
    loadOnboarding: () =>
      readJson(ownerKey(keys.onboarding), onboardingProgressSchema),
    saveOnboarding: (progress) =>
      writeJson(ownerKey(keys.onboarding), progress),
    loadKeywords: async () =>
      (await readJson(ownerKey(keys.keywords), z.array(keywordRuleSchema))) ??
      defaultKeywordRules,
    saveKeywords: (rules) => writeJson(ownerKey(keys.keywords), rules),
    loadTrackingPreference: () =>
      readJson(ownerKey(keys.trackingPreference), trackingPreferenceSchema),
    saveTrackingPreference: (preference) =>
      writeJson(ownerKey(keys.trackingPreference), preference),
    loadPendingDestination: () =>
      AsyncStorage.getItem(ownerKey(keys.pendingDestination)),
    savePendingDestination: (destination) =>
      destination
        ? AsyncStorage.setItem(ownerKey(keys.pendingDestination), destination)
        : AsyncStorage.removeItem(ownerKey(keys.pendingDestination)),
    loadPrivacyLock: loadNativePrivacyLock,
    savePrivacyLock: (lock) =>
      writeSensitive(ownerKey(keys.nativePrivacyLock), privacyLockPreferenceSchema.parse(lock)),
    loadProfilePromptDismissed: async () =>
      (await readJson(ownerKey(keys.profilePromptDismissed), z.boolean())) ??
      false,
    saveProfilePromptDismissed: (dismissed) =>
      writeJson(ownerKey(keys.profilePromptDismissed), dismissed),
    loadTrackingHomeCardDismissed: async () =>
      (await readJson(ownerKey(keys.trackingHomeCardDismissed), z.boolean())) ??
      false,
    saveTrackingHomeCardDismissed: (dismissed) =>
      writeJson(ownerKey(keys.trackingHomeCardDismissed), dismissed)
  };
}

async function readSensitive<S extends z.ZodTypeAny>(
  nativeKey: string,
  schema: S
): Promise<z.output<S> | null> {
  const raw =
    Platform.OS === 'web'
      ? await AsyncStorage.getItem(previewKey(nativeKey))
      : await SecureStore.getItemAsync(nativeKey);
  return parse(raw, schema);
}

async function loadNativePrivacyLock() {
  const readRaw = (key: string) => Platform.OS === 'web'
    ? AsyncStorage.getItem(previewKey(key))
    : SecureStore.getItemAsync(key);
  const nativeRaw = await readRaw(ownerKey(keys.nativePrivacyLock));
  if (nativeRaw !== null) {
    // Corrupt explicit native settings must fail closed, never revive a legacy opt-out.
    return privacyLockPreferenceSchema.parse(JSON.parse(nativeRaw));
  }
  const ownerLegacy = await readRaw(ownerKey(keys.privacyLock));
  const legacyRaw = ownerLegacy ?? (activeOwnerHash ? await readRaw(keys.privacyLock) : null);
  if (legacyRaw !== null) {
    const legacy = parse(legacyRaw, privacyLockPreferenceSchema);
    return legacy ?? { enabled: true, autoLockDuration: 'immediate' as const, appLockStatus: 'locked' as const };
  }
  // Presence supports old installations missing preference metadata. Never validate,
  // rewrite or delete the obsolete secret, even when its bytes are malformed.
  const ownerCredential = await readRaw(ownerKey(keys.pinCredential));
  const hasLegacyCredential = ownerCredential !== null || (activeOwnerHash && await readRaw(keys.pinCredential) !== null);
  return hasLegacyCredential
    ? { enabled: true, autoLockDuration: 'immediate' as const, appLockStatus: 'locked' as const }
    : null;
}

function writeSensitive<T>(nativeKey: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  return Platform.OS === 'web'
    ? AsyncStorage.setItem(previewKey(nativeKey), serialized)
    : SecureStore.setItemAsync(nativeKey, serialized);
}

function removeSensitive(nativeKey: string): Promise<void> {
  return Platform.OS === 'web'
    ? AsyncStorage.removeItem(previewKey(nativeKey))
    : SecureStore.deleteItemAsync(nativeKey);
}

async function readJson<T>(
  key: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  return parse(await AsyncStorage.getItem(key), schema);
}

function writeJson<T>(key: string, value: T): Promise<void> {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}

function parse<S extends z.ZodTypeAny>(raw: string | null, schema: S): z.output<S> | null {
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function previewKey(nativeKey: string): string {
  if (nativeKey === keys.session) return keys.previewSession;
  if (nativeKey === keys.privacyLock) return keys.previewPrivacyLock;
  return `masarifi.appShell.preview.${nativeKey}`;
}

function ownerKey(key: string): string {
  return activeOwnerHash ? `${key}.${activeOwnerHash.slice(0, 24)}` : key;
}
