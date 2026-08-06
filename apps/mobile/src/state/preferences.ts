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

interface PreferenceState extends UserPreferences {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  toggleHideBalances: () => void;
  setBaseCurrencyCode: (code: string) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const usePreferenceStore = create<PreferenceState>((set, get) => ({
  ...buildPreferences({}),
  hydrated: false,

  hydrate: async () => {
    const loaded = await loadPreferences();
    set({ ...loaded, hydrated: true });
  },

  setLocale: (locale) => {
    const next = { ...get(), locale, direction: directionForLocale(locale) };
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

  setReducedMotion: (reducedMotion) => {
    const next = { ...get(), reducedMotion };
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
    reducedMotion: state.reducedMotion
  });
}
