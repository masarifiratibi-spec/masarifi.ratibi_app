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

import {
  buildPreferences,
  type ThemePreference,
  type Locale,
  type UserPreferences
} from '@/domain/foundation';

const STORAGE_KEY = 'masarifi.preferences';

interface PersistedPreferences {
  locale: Locale;
  theme: ThemePreference;
  hideBalances: boolean;
  baseCurrencyCode: string;
  reducedMotion: boolean;
}

const persistedPreferencesSchema = z.object({
  locale: z.enum(['ar', 'en']),
  theme: z.enum(['light', 'dark', 'system']),
  hideBalances: z.boolean(),
  baseCurrencyCode: z.string().regex(/^[A-Z]{3}$/),
  reducedMotion: z.boolean()
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
    theme: preferences.theme,
    hideBalances: preferences.hideBalances,
    baseCurrencyCode: preferences.baseCurrencyCode,
    reducedMotion: preferences.reducedMotion
  };
  const serialized = JSON.stringify(persisted);
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } else {
    await SecureStore.setItemAsync(STORAGE_KEY, serialized);
  }
}

function readPersistedPreferences(): Promise<string | null> {
  return Platform.OS === 'web'
    ? AsyncStorage.getItem(STORAGE_KEY)
    : SecureStore.getItemAsync(STORAGE_KEY);
}

function deserialize(raw: string): UserPreferences {
  try {
    const parsed = persistedPreferencesSchema.parse(JSON.parse(raw));
    return buildPreferences(parsed);
  } catch {
    // Corrupt store: fall back to defaults rather than crash. Direction is
    // re-derived from locale inside buildPreferences.
    return buildPreferences({});
  }
}
