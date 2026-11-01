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
  assistantDrafts: 'masarifi.appShell.assistantDrafts.v1',
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
  keys.assistantDrafts,
  keys.pinCredential
] as const;
let activeOwnerHash: string | null = null;
let ownerGeneration = 0;

const localOwnerKey = 'masarifi.appShell.localOwner.v1';
const logoutRecoveryKey = 'masarifi.appShell.logoutRecovery.v1';
const logoutRecoverySchema = z.object({ownerId:z.string().min(1),id:z.string().uuid()}).strict();
let localOwnerMutation: Promise<void> = Promise.resolve();
let logoutAdmissionRevision = 0;
const logoutDispositionSchema = z.object({
  id: z.string().uuid(), ownerId: z.string().min(1), sessionId: z.string().min(1).nullable(),
  scope: z.enum(['local', 'all']), phase: z.enum(['prepared', 'cleanup-ready']),
  dataDisposition: z.enum(['preserve', 'remove']).default('preserve')
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
  if (cached?.userId) return loadLogoutDisposition(cached.userId);
  const recovery = await readSensitive(logoutRecoveryKey, logoutRecoverySchema);
  if (recovery) {
    const record = await loadLogoutDisposition(recovery.ownerId);
    if (record) return record;
  }
  return null;
}

export async function prepareLogoutDisposition(input: Pick<LogoutDisposition, 'ownerId' | 'sessionId' | 'scope'> & Partial<Pick<LogoutDisposition, 'dataDisposition'>>): Promise<LogoutDisposition> {
  logoutAdmissionRevision++;
  let prepared!: LogoutDisposition;
  await serializeLocalOwner(async () => {
    const existing = await loadLogoutDisposition(input.ownerId);
    prepared = existing ?? logoutDispositionSchema.parse({ ...input, id: Crypto.randomUUID(), phase: 'prepared' });
    await writeSensitive(logoutRecoveryKey,{ownerId:prepared.ownerId,id:prepared.id});
    if (existing) return;
    await writeSensitive(await logoutDispositionKey(input.ownerId), prepared);
    if ((await loadLogoutDisposition(input.ownerId))?.id !== prepared.id) throw new Error('LOGOUT_PERSISTENCE_UNCONFIRMED');
  });
  return prepared;
}

export async function markLogoutCleanupReady(record: LogoutDisposition): Promise<LogoutDisposition> {
  const ready = { ...record, phase: 'cleanup-ready' as const };
  await serializeLocalOwner(async () => {
    const current = await loadLogoutDisposition(record.ownerId);
    if (current?.id !== record.id || current.dataDisposition !== record.dataDisposition) throw new Error('LOGOUT_DISPOSITION_CHANGED');
    await writeSensitive(await logoutDispositionKey(record.ownerId), ready);
    if ((await loadLogoutDisposition(record.ownerId))?.phase !== 'cleanup-ready') throw new Error('LOGOUT_PERSISTENCE_UNCONFIRMED');
  });
  return ready;
}

export async function completeLogoutDisposition(record: LogoutDisposition): Promise<void> {
  await serializeLocalOwner(async () => {
    const current = await loadLogoutDisposition(record.ownerId);
    if (current?.id !== record.id || current.phase !== 'cleanup-ready' || current.dataDisposition !== record.dataDisposition) throw new Error('LOGOUT_DISPOSITION_CHANGED');
    // This anchor discovers recovery but can never admit a signed-out owner.
    await writeSensitive(logoutRecoveryKey,{ownerId:record.ownerId,id:record.id});
    const recovery = await readSensitive(logoutRecoveryKey,logoutRecoverySchema);
    if (recovery?.ownerId !== record.ownerId || recovery.id !== record.id) throw new Error('LOGOUT_PERSISTENCE_UNCONFIRMED');
    const cached = await readSensitive(localOwnerKey, authSessionSchema);
    if (cached?.userId === record.ownerId) await removeSensitive(localOwnerKey);
    await removeSensitive(await logoutDispositionKey(record.ownerId));
    if (await loadLogoutDisposition(record.ownerId)) throw new Error('LOGOUT_PERSISTENCE_UNCONFIRMED');
    await removeSensitive(logoutRecoveryKey).catch(() => undefined);
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

const assistantDraftSchema = z.object({
  text: z.string().max(1000),
  revision: z.string().min(1).max(128)
}).strict();
const assistantDraftScopeSchema = z.string().regex(
  /^(landing|conversation:[A-Za-z0-9_-]{1,128}|report:[a-f0-9]{64})$/
);
const assistantDraftsSchema = z.record(assistantDraftScopeSchema, assistantDraftSchema);
export type AssistantDraft = z.infer<typeof assistantDraftSchema>;

function assistantDraftOwner(ownerId: string) {
  const hash = bytesToHex(sha256(utf8ToBytes(ownerId)));
  const generation = ownerGeneration;
  const assertCurrent = () => {
    if (activeOwnerHash !== hash || ownerGeneration !== generation)
      throw new Error('ASSISTANT_DRAFT_OWNER_CHANGED');
  };
  assertCurrent();
  return { key: `${keys.assistantDrafts}.${hash.slice(0, 24)}`, assertCurrent };
}

async function readAssistantDrafts(key: string) {
  const raw = Platform.OS === 'web'
    ? await AsyncStorage.getItem(previewKey(key))
    : await SecureStore.getItemAsync(key);
  // A failed restore must not silently replace a protected draft with empty text.
  return raw === null ? {} : assistantDraftsSchema.parse(JSON.parse(raw));
}

export async function loadAssistantDraft(ownerId: string, scope: string): Promise<AssistantDraft | null> {
  assistantDraftScopeSchema.parse(scope);
  const owner = assistantDraftOwner(ownerId);
  let value: AssistantDraft | null = null;
  await serializeLocalOwner(async () => {
    owner.assertCurrent();
    if (await isLogoutOwnerFenced(ownerId)) throw new Error('LOGOUT_PENDING');
    const drafts = await readAssistantDrafts(owner.key);
    owner.assertCurrent();
    value = drafts[scope] ?? null;
  });
  return value;
}

export async function saveAssistantDraft(ownerId: string, scope: string, input: AssistantDraft): Promise<void> {
  assistantDraftScopeSchema.parse(scope);
  const value = assistantDraftSchema.parse(input);
  const owner = assistantDraftOwner(ownerId);
  await serializeLocalOwner(async () => {
    owner.assertCurrent();
    if (await isLogoutOwnerFenced(ownerId)) throw new Error('LOGOUT_PENDING');
    const drafts = await readAssistantDrafts(owner.key);
    owner.assertCurrent();
    if (value.text) drafts[scope] = value;
    else delete drafts[scope];
    if (Object.keys(drafts).length) await writeSensitive(owner.key, drafts);
    else await removeSensitive(owner.key);
    owner.assertCurrent();
  });
}

export async function discardAssistantDraft(ownerId: string, scope: string, expectedRevision?: string): Promise<void> {
  assistantDraftScopeSchema.parse(scope);
  const owner = assistantDraftOwner(ownerId);
  await serializeLocalOwner(async () => {
    owner.assertCurrent();
    if (await isLogoutOwnerFenced(ownerId)) throw new Error('LOGOUT_PENDING');
    const drafts = await readAssistantDrafts(owner.key);
    owner.assertCurrent();
    if (expectedRevision !== undefined && drafts[scope]?.revision !== expectedRevision) return;
    delete drafts[scope];
    if (Object.keys(drafts).length) await writeSensitive(owner.key, drafts);
    else await removeSensitive(owner.key);
    owner.assertCurrent();
  });
}

export async function clearAppShellUserData(): Promise<void> {
  const asyncKeys = asyncUserDataKeys.map(ownerKey);
  const secureKeys = sensitiveUserDataKeys.map(ownerKey);
  await serializeLocalOwner(async () => {
    await Promise.all([
      ...asyncKeys.map(key => AsyncStorage.removeItem(key)),
      ...secureKeys.map(key => removeSensitive(key))
    ]);
  });
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
  await serializeLocalOwner(async () => {
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
  });
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
