import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';

import {
  authSessionSchema,
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
import { defaultKeywordRules } from '@/services/mocks/default-keywords';

const keys = {
  session: 'masarifi.appShell.session',
  previewSession: 'masarifi.appShell.preview.session',
  onboarding: 'masarifi.appShell.onboarding',
  keywords: 'masarifi.appShell.keywords',
  trackingPreference: 'masarifi.appShell.trackingPreference',
  pendingDestination: 'masarifi.appShell.pendingDestination',
  privacyLock: 'masarifi.appShell.privacyLock',
  previewPrivacyLock: 'masarifi.appShell.preview.privacyLock',
  pinCredential: 'masarifi.appShell.pinCredential',
  profilePromptDismissed: 'masarifi.appShell.profilePromptDismissed'
};

const asyncUserDataKeys = [
  keys.onboarding,
  keys.keywords,
  keys.trackingPreference,
  keys.pendingDestination,
  keys.profilePromptDismissed
] as const;
const sensitiveUserDataKeys = [
  keys.session,
  keys.privacyLock,
  keys.pinCredential
] as const;

export async function clearAppShellUserData(): Promise<void> {
  await Promise.all([
    ...asyncUserDataKeys.map((key) => AsyncStorage.removeItem(key)),
    ...sensitiveUserDataKeys.map((key) => removeSensitive(key))
  ]);
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
    loadOnboarding: () => readJson(keys.onboarding, onboardingProgressSchema),
    saveOnboarding: (progress) => writeJson(keys.onboarding, progress),
    loadKeywords: async () =>
      (await readJson(keys.keywords, z.array(keywordRuleSchema))) ?? defaultKeywordRules,
    saveKeywords: (rules) => writeJson(keys.keywords, rules),
    loadTrackingPreference: () =>
      readJson(keys.trackingPreference, trackingPreferenceSchema),
    saveTrackingPreference: (preference) =>
      writeJson(keys.trackingPreference, preference),
    loadPendingDestination: () => AsyncStorage.getItem(keys.pendingDestination),
    savePendingDestination: (destination) =>
      destination
        ? AsyncStorage.setItem(keys.pendingDestination, destination)
        : AsyncStorage.removeItem(keys.pendingDestination),
    loadPrivacyLock: () =>
      readSensitive(keys.privacyLock, privacyLockPreferenceSchema),
    savePrivacyLock: (lock) => writeSensitive(keys.privacyLock, lock),
    clearPrivacyLock: () => removeSensitive(keys.privacyLock),
    loadPinCredential: () => readSensitive(keys.pinCredential, z.string().min(1)),
    savePinCredential: (hash) => writeSensitive(keys.pinCredential, hash),
    clearPinCredential: () => removeSensitive(keys.pinCredential),
    loadProfilePromptDismissed: async () =>
      (await readJson(keys.profilePromptDismissed, z.boolean())) ?? false,
    saveProfilePromptDismissed: (dismissed) =>
      writeJson(keys.profilePromptDismissed, dismissed)
  };
}

async function readSensitive<T>(
  nativeKey: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const raw =
    Platform.OS === 'web'
      ? await AsyncStorage.getItem(previewKey(nativeKey))
      : await SecureStore.getItemAsync(nativeKey);
  return parse(raw, schema);
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

function parse<T>(raw: string | null, schema: z.ZodType<T>): T | null {
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
