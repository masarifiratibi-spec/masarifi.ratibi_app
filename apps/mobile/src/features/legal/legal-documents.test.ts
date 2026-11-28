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

it.each(['ar', 'en'] as const)('explains the iPhone Shortcuts queue and how to turn recording off in %s', locale => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  const section = getLegalDocument(locale, 'privacy').sections.find(row => row.id === 'iphone-shortcuts');
  expect(section?.paragraphs.join(' ')).toContain(locale === 'ar' ? 'الاختصارات' : 'Shortcuts');
  expect(section?.paragraphs.join(' ')).toContain(locale === 'ar' ? 'دون اتصال' : 'offline');
  expect(section?.paragraphs.join(' ')).toContain(locale === 'ar' ? 'إيقاف' : 'turn off');
});

it.each(['ar', 'en'] as const)('names the enabled AI routes and explains support access logs in %s', locale => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  const { sections } = getLegalDocument(locale, 'privacy');
  const routes = sections.find(section => section.id === 'iphone-ai-providers')?.paragraphs.join(' ');
  for (const provider of ['OpenRouter', 'OpenAI', 'Microsoft Azure', 'Google Vertex AI']) {
    expect(routes).toContain(provider);
  }
  const logs = sections.find(section => section.id === 'service-diagnostics')?.paragraphs.join(' ');
  expect(logs).toContain(locale === 'en' ? 'support search' : 'البحث في الدعم');
});
