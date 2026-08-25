import {
  userProfileSchema,
  type ApplicationPreferences,
  type UserProfile
} from '@/domain/settings';
import { usePreferenceStore } from '@/state/preferences';
import { openDatabase } from './database';

const profileDefaults: Omit<UserProfile, 'currency'> = {
  name: null,
  avatar: 'default',
  phone: null,
  googleAccount: null,
  email: null,
  country: 'SA',
  timeZone: 'Asia/Riyadh',
  completion: [],
  version: 1
};

export function createSettingsStorage() {
  return {
    get profile(): UserProfile {
      const preferences = usePreferenceStore.getState();
      return {
        ...profileDefaults,
        completion: [],
        currency: preferences.baseCurrencyCode,
        timeZone: preferences.timeZone
      };
    },
    get application(): ApplicationPreferences {
      const preferences = usePreferenceStore.getState();
      return {
        locale: preferences.locale,
        theme: preferences.theme,
        hideBalances: preferences.hideBalances,
        reducedMotion: preferences.reducedMotion,
        baseCurrencyCode: preferences.baseCurrencyCode,
        timeZone: preferences.timeZone,
        firstDayOfWeek: preferences.firstDayOfWeek,
        defaultAccountId: preferences.defaultAccountId,
        transactionDefaults: { type: preferences.transactionDefaultType },
        dashboardSections: preferences.dashboardSections,
        voiceEnabled: preferences.voiceEnabled
      };
    },
    async loadProfile(): Promise<UserProfile | null> {
      const row = await (
        await openDatabase()
      ).getFirstAsync<{ payload: string }>(
        "SELECT payload FROM settings_profile WHERE id = 'singleton'"
      );
      return row ? userProfileSchema.parse(JSON.parse(row.payload)) : null;
    },
    async saveProfile(profile: UserProfile): Promise<void> {
      await (
        await openDatabase()
      ).runAsync(
        "INSERT INTO settings_profile (id, payload, updated_at) VALUES ('singleton', ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        JSON.stringify(userProfileSchema.parse(profile)),
        Date.now()
      );
    },
    async hydrate(): Promise<void> {
      await usePreferenceStore.getState().hydrate();
    }
  };
}
