import { Platform } from 'react-native';
import { getLegalDocument } from './legal-documents';
import privacyAr from './privacy.ar.json';
import privacyEn from './privacy.en.json';
import termsAr from './terms.ar.json';
import termsEn from './terms.en.json';

const originalPlatform = Platform.OS;
afterEach(() =>
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform
  })
);

it.each(['ar', 'en'] as const)(
  'discloses Apple identity and Hide My Email in the iOS privacy document in %s',
  (locale) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const section = getLegalDocument(locale, 'privacy').sections.find(
      (value) => value.id === 'apple-identity'
    );
    expect(section?.paragraphs.join(' ')).toContain('Apple');
    expect(section?.paragraphs.join(' ')).toContain(
      locale === 'ar' ? 'إخفاء بريدي الإلكتروني' : 'Hide My Email'
    );
  }
);

it.each([
  ['ar', privacyAr],
  ['en', privacyEn]
] as const)(
  'preserves the Android privacy document in %s',
  (locale, original) => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android'
    });
    expect(getLegalDocument(locale, 'privacy')).toEqual(original);
  }
);

it.each(['ar', 'en'] as const)(
  'describes both login providers in the iOS terms in %s',
  (locale) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const terms = getLegalDocument(locale, 'terms');
    for (const section of ['eligibility', 'security', 'ending']) {
      const paragraphs = terms.sections
        .find((value) => value.id === section)!
        .paragraphs.join(' ');
      expect(paragraphs).toContain('Google');
      expect(paragraphs).toContain('Apple');
    }
  }
);

it.each([
  ['ar', termsAr],
  ['en', termsEn]
] as const)('preserves Android terms in %s', (locale, original) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android'
  });
  expect(getLegalDocument(locale, 'terms')).toEqual(original);
});
