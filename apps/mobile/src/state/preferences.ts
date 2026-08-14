/**
 * Preference store (Zustand).
 *
 * Owns session-shell preferences: locale, theme, privacy, currency, reduced
 * motion. Service-shaped data lives in TanStack Query; this store holds only
 * preferences and transient UI state, never duplicating query data
 * (research Decision 2). Direction is always derived from locale.
 */

import { create } from 'zustand';

import {
  buildPreferences,
  directionForLocale,
  type Locale,
  type ThemePreference,
  type UserPreferences
} from '@/domain/foundation';
import { loadPreferences, savePreferences } from '@/storage/secure-preferences';
import { changeLocale } from '@/localization/i18n';

interface PreferenceState extends UserPreferences {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  toggleHideBalances: () => void;
  setBaseCurrencyCode: (code: string) => void;
  setTimeZone: (timeZone: string) => void;
  setReducedMotion: (reduced: boolean) => void;
  updateApplicationPreferences: (patch: Partial<Pick<UserPreferences, 'firstDayOfWeek' | 'defaultAccountId' | 'transactionDefaultType' | 'dashboardSections' | 'voiceEnabled' | 'trackingPersonalization' | 'assistantPersonalization' | 'analyticsEnabled'>>) => void;
}

export const usePreferenceStore = create<PreferenceState>((set, get) => ({
  ...buildPreferences({}),
  hydrated: false,

  hydrate: async () => {
    const loaded = await loadPreferences();
    changeLocale(loaded.locale);
    set({ ...loaded, hydrated: true });
  },

  setLocale: (locale) => {
    const next = { ...get(), locale, direction: directionForLocale(locale) };
    changeLocale(locale);
    set(next);
    void persist(next);
  },

  setTheme: (theme) => {
    const next = { ...get(), theme };
    set(next);
    void persist(next);
  },

  toggleHideBalances: () => {
    const next = { ...get(), hideBalances: !get().hideBalances };
    set(next);
    void persist(next);
  },

  setBaseCurrencyCode: (baseCurrencyCode) => {
    const next = { ...get(), baseCurrencyCode };
    set(next);
    void persist(next);
  },

  setTimeZone: (timeZone) => {
    const next = { ...get(), timeZone };
    set(next);
    void persist(next);
  },

  setReducedMotion: (reducedMotion) => {
    const next = { ...get(), reducedMotion };
    set(next);
    void persist(next);
  },
  updateApplicationPreferences: (patch) => {
    const next = { ...get(), ...patch };
    set(next);
    void persist(next);
  }
}));

function persist(state: PreferenceState): Promise<void> {
  return savePreferences({
    locale: state.locale,
    direction: state.direction,
    theme: state.theme,
    hideBalances: state.hideBalances,
    baseCurrencyCode: state.baseCurrencyCode,
    timeZone: state.timeZone,
    reducedMotion: state.reducedMotion,
    firstDayOfWeek: state.firstDayOfWeek,
    defaultAccountId: state.defaultAccountId,
    transactionDefaultType: state.transactionDefaultType,
    dashboardSections: state.dashboardSections,
    voiceEnabled: state.voiceEnabled,
    trackingPersonalization: state.trackingPersonalization,
    assistantPersonalization: state.assistantPersonalization,
    analyticsEnabled: state.analyticsEnabled
  });
}
