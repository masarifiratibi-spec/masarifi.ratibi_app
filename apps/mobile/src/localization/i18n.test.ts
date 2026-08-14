import ar from './messages/ar';
import en from './messages/en';
import { directionForLocale, type Locale } from '@/domain/foundation';
import {
  translate,
  changeLocale,
  currentDirection,
  isSupportedLocale
} from './i18n';
import { requiredScenarioCoverage } from '@/test-utils/frontend-quality-scenarios';

describe('message catalog parity', () => {
  it('every English key exists in Arabic with a non-empty value', () => {
    const missingInArabic = Object.keys(en).filter(
      (key) => !(key in ar) || !ar[key as keyof typeof ar]
    );
    expect(missingInArabic).toEqual([]);
  });

  it('every Arabic key exists in English with a non-empty value', () => {
    const missingInEnglish = Object.keys(ar).filter(
      (key) => !(key in en) || !en[key as keyof typeof en]
    );
    expect(missingInEnglish).toEqual([]);
  });

  it('resolves the same key to different strings across locales', () => {
    expect(translate('app.title', 'en')).not.toBe(translate('app.title', 'ar'));
  });

  it('covers every SPEC-010 scenario name and description in both locales', () => {
    const enMessages = en as Record<string, string>;
    const arMessages = ar as Record<string, string>;

    for (const id of requiredScenarioCoverage) {
      for (const suffix of ['name', 'description']) {
        const key = `frontendQuality.scenarios.${id}.${suffix}`;
        expect(enMessages[key]).toEqual(expect.any(String));
        expect(arMessages[key]).toEqual(expect.any(String));
        expect(enMessages[key]).not.toHaveLength(0);
        expect(arMessages[key]).not.toHaveLength(0);
      }
    }
  });
});

describe('direction derivation', () => {
  it.each<[Locale, 'rtl' | 'ltr']>([
    ['ar', 'rtl'],
    ['en', 'ltr']
  ])('locale %s maps to direction %s', (locale, direction) => {
    expect(directionForLocale(locale)).toBe(direction);
  });

  it('isSupportedLocale accepts only ar and en', () => {
    expect(isSupportedLocale('ar')).toBe(true);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });

  it('currentDirection reflects the active locale', () => {
    changeLocale('ar');
    expect(currentDirection()).toBe('rtl');
    changeLocale('en');
    expect(currentDirection()).toBe('ltr');
  });
});
