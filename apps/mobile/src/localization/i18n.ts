/**
 * i18n resolver for the Masarifi mobile app.
 *
 * Wraps i18next with the typed Arabic/English catalogs. Direction is derived
 * from the active locale so the pair can never drift. Constitution Principle
 * III and UI Contract §7.
 */

import i18next from 'i18next';

import en, { type MessageCatalog, type MessageKey } from './messages/en';
import ar from './messages/ar';
import {
  directionForLocale,
  type LayoutDirection,
  type Locale
} from '@/domain/foundation';

const CATALOGS: Record<Locale, MessageCatalog> = { en, ar };

export const SUPPORTED_LOCALES: readonly Locale[] = ['ar', 'en'];
export const DEFAULT_LOCALE: Locale = 'ar';

let initialized = false;

export function initI18n(initialLocale: Locale = DEFAULT_LOCALE): void {
  if (initialized) {
    return;
  }
  i18next.init({
    resources: {
      ar: { translation: CATALOGS.ar },
      en: { translation: CATALOGS.en }
    },
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
    returnNull: false
  });
  initialized = true;
}

export function changeLocale(locale: Locale): void {
  ensureInitialized();
  i18next.changeLanguage(locale);
}

export function translate(key: MessageKey, locale?: Locale): string {
  ensureInitialized();
  if (locale) {
    const catalog = CATALOGS[locale];
    return catalog[key] ?? key;
  }
  return i18next.t(key) ?? key;
}

export function currentLocale(): Locale {
  ensureInitialized();
  const lng = i18next.language as Locale | undefined;
  return lng && isSupportedLocale(lng) ? lng : DEFAULT_LOCALE;
}

export function currentDirection(): LayoutDirection {
  return directionForLocale(currentLocale());
}

export function isSupportedLocale(value: unknown): value is Locale {
  return value === 'ar' || value === 'en';
}

function ensureInitialized(): void {
  if (!initialized) {
    initI18n();
  }
}
