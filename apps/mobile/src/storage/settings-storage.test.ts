import * as SecureStore from 'expo-secure-store';

import { resetLock } from '@/features/security/privacy-lock';
import { currentLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { savePreferences } from '@/storage/secure-preferences';
import { buildPreferences } from '@/domain/foundation';

import { createSettingsStorage } from './settings-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn()
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const setItemAsync = jest.mocked(SecureStore.setItemAsync);

describe('protected settings storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferenceStore.setState({
      locale: 'ar',
      direction: 'rtl',
      theme: 'system',
      hideBalances: true,
      baseCurrencyCode: 'SAR',
      timeZone: 'Asia/Riyadh',
      reducedMotion: false,
      hydrated: false
    });
  });

  it('provides profile timezone and currency plus application defaults', () => {
    const settings = createSettingsStorage();

    expect(settings.profile).toEqual({
      name: null,
      avatar: 'default',
      phone: null,
      googleAccount: null,
      email: null,
      country: 'SA',
      currency: 'SAR',
      timeZone: 'Asia/Riyadh',
      completion: [],
      version: 1
    });
    expect(settings.application).toEqual({
      locale: 'ar',
      theme: 'system',
      hideBalances: true,
      reducedMotion: false,
      baseCurrencyCode: 'SAR',
      timeZone: 'Asia/Riyadh',
      firstDayOfWeek: 'sunday',
      defaultAccountId: null,
      transactionDefaults: { type: 'expense' },
      dashboardSections: ['balance', 'transactions', 'budgets', 'goals', 'reports'],
      voiceEnabled: true
    });
  });

  it('keeps lock controls while hideBalances stays in the global preference store', () => {
    expect(resetLock(1)).toEqual({
      pinConfigured: true,
      biometricStatus: 'disabled',
      autoLockDuration: 'immediate',
      invalidAttempts: 0,
      lockedUntil: null,
      appLockStatus: 'locked'
    });

    usePreferenceStore.getState().toggleHideBalances();
    expect(usePreferenceStore.getState().hideBalances).toBe(false);
  });

  it('hydrates persisted preferences through the global store action', async () => {
    let persisted: string | null = null;
    setItemAsync.mockImplementation(async (_key, value) => {
      persisted = value;
    });
    getItemAsync.mockImplementation(async () => persisted);
    await savePreferences(buildPreferences({
      locale: 'en',
      direction: 'ltr',
      theme: 'dark',
      hideBalances: false,
      baseCurrencyCode: 'USD',
      timeZone: 'Europe/London',
      reducedMotion: true
    }));

    await createSettingsStorage().hydrate();

    expect(usePreferenceStore.getState()).toMatchObject({
      locale: 'en',
      direction: 'ltr',
      theme: 'dark',
      hideBalances: false,
      baseCurrencyCode: 'USD',
      timeZone: 'Europe/London',
      reducedMotion: true,
      hydrated: true
    });
    expect(currentLocale()).toBe('en');
  });
});
