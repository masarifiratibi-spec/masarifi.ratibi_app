/**
 * Protected persistence for user preferences.
 *
 * Uses Expo SecureStore for small sensitive/protected values. The preference
 * store reads and writes through this module; nothing else touches SecureStore
 * directly. Research Decision 3 and Constitution Principle V.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { z } from 'zod';
import { recordPreferencesStorageOutcome } from '@/services/platform/benchmark-observability';

import {
  buildPreferences,
  type ThemePreference,
  type Locale,
  type UserPreferences
} from '@/domain/foundation';

const STORAGE_KEY = 'masarifi.preferences';

interface PersistedPreferences {
  locale: Locale;
  firstLaunchOnboardingCompleted: boolean;
  theme: ThemePreference;
  hideBalances: boolean;
  baseCurrencyCode: string;
  timeZone: string;
  reducedMotion: boolean;
  firstDayOfWeek: UserPreferences['firstDayOfWeek'];
  defaultAccountId: string | null;
  transactionDefaultType: UserPreferences['transactionDefaultType'];
  dashboardSections: UserPreferences['dashboardSections'];
  voiceEnabled: boolean;
  trackingPersonalization: boolean;
  assistantPersonalization: boolean;
  analyticsEnabled: boolean;
  monthStartDay: number;
  returnRemindersEnabled: boolean;
  returnRemindersOwnerId: string | null;
  returnReminderChoices: Record<string, boolean>;
}

const persistedPreferencesSchema = z.object({
  locale: z.enum(['ar', 'en']).optional(),
  firstLaunchOnboardingCompleted: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  hideBalances: z.boolean().optional(),
  baseCurrencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  timeZone: z.string().optional(),
  reducedMotion: z.boolean().optional(),
  firstDayOfWeek: z.enum(['sunday', 'monday', 'saturday']).optional(),
  defaultAccountId: z.string().nullable().optional(),
  transactionDefaultType: z.enum(['expense', 'income']).optional(),
  dashboardSections: z
    .array(z.enum(['balance', 'transactions', 'budgets', 'goals', 'reports']))
    .optional(),
  voiceEnabled: z.boolean().optional(),
  trackingPersonalization: z.boolean().optional(),
  assistantPersonalization: z.boolean().optional(),
  analyticsEnabled: z.boolean().optional(),
  monthStartDay: z.number().int().min(1).max(28).optional(),
  returnRemindersEnabled: z.boolean().optional(),
  returnRemindersOwnerId: z.string().nullable().optional(),
  returnReminderChoices: z.record(z.boolean()).optional()
});

export async function loadPreferences(): Promise<UserPreferences> {
  const raw = await readPersistedPreferences();
  if (!raw) {
    return buildPreferences({});
  }
  return deserialize(raw);
}

export async function savePreferences(
  preferences: UserPreferences
): Promise<void> {
  const persisted: PersistedPreferences = {
    locale: preferences.locale,
    firstLaunchOnboardingCompleted: preferences.firstLaunchOnboardingCompleted,
    theme: preferences.theme,
    hideBalances: preferences.hideBalances,
    baseCurrencyCode: preferences.baseCurrencyCode,
    timeZone: preferences.timeZone,
    reducedMotion: preferences.reducedMotion,
    firstDayOfWeek: preferences.firstDayOfWeek,
    defaultAccountId: preferences.defaultAccountId,
    transactionDefaultType: preferences.transactionDefaultType,
    dashboardSections: preferences.dashboardSections,
    voiceEnabled: preferences.voiceEnabled,
    trackingPersonalization: preferences.trackingPersonalization,
    assistantPersonalization: preferences.assistantPersonalization,
    analyticsEnabled: preferences.analyticsEnabled,
    monthStartDay: preferences.monthStartDay,
    returnRemindersEnabled: preferences.returnRemindersEnabled,
    returnRemindersOwnerId: preferences.returnRemindersOwnerId,
    returnReminderChoices: preferences.returnReminderChoices
  };
  const serialized = JSON.stringify(persisted);
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } else {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, serialized);
      recordPreferencesStorageOutcome('write', 'success');
    } catch (error) {
      recordPreferencesStorageOutcome('write', 'failure', error);
      throw error;
    }
  }
}

export function clearPersistedPreferences(): Promise<void> {
  return Platform.OS === 'web'
    ? AsyncStorage.removeItem(STORAGE_KEY)
    : SecureStore.deleteItemAsync(STORAGE_KEY);
}

async function readPersistedPreferences(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(STORAGE_KEY);
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    recordPreferencesStorageOutcome('read', 'success');
    return raw;
  } catch (error) {
    recordPreferencesStorageOutcome('read', 'failure', error);
    throw error;
  }
}

function deserialize(raw: string): UserPreferences {
  try {
    const parsed = persistedPreferencesSchema.parse(JSON.parse(raw));
    if (!parsed.returnReminderChoices && parsed.returnRemindersOwnerId && typeof parsed.returnRemindersEnabled === 'boolean') {
      parsed.returnReminderChoices = { [`account:${parsed.returnRemindersOwnerId}`]: parsed.returnRemindersEnabled };
    }
    return buildPreferences(parsed);
  } catch {
    // Corrupt store: fall back to defaults rather than crash. Direction is
    // re-derived from locale inside buildPreferences.
    return buildPreferences({});
  }
}
