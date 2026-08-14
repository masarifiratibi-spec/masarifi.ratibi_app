import type { ApplicationPreferences, UserProfile } from '@/domain/settings';
import { usePreferenceStore } from '@/state/preferences';

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
    async hydrate(): Promise<void> {
      await usePreferenceStore.getState().hydrate();
    }
  };
}
