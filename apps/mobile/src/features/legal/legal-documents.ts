import { Platform } from 'react-native';
import termsAr from './terms.ar.json';
import termsEn from './terms.en.json';
import applePrivacy from './apple-privacy.json';
import processingPrivacy from './ios-processing-privacy.json';
import shortcutsPrivacy from './ios-shortcuts-privacy.json';
import privacyAr from './privacy.ar.json';
import privacyEn from './privacy.en.json';

export type LegalDocumentKind = 'terms' | 'privacy';
const documents = {
  ar: { terms: termsAr, privacy: privacyAr },
  en: { terms: termsEn, privacy: privacyEn }
};

export function getLegalDocument(locale: 'ar' | 'en', kind: LegalDocumentKind) {
  const document = documents[locale][kind];
  if (Platform.OS !== 'ios') return document;
  if (kind === 'terms')
    return {
      ...document,
      sections: document.sections.map((section) => ({
        ...section,
        paragraphs: section.paragraphs.map((paragraph) =>
          paragraph.replaceAll(
            'Google',
            locale === 'ar' ? 'Google أو Apple' : 'Google or Apple'
          )
        )
      }))
    };
  const appleIdentity = applePrivacy[locale];
  return {
    ...document,
    sections: document.sections.flatMap((section) => {
      if (section.id === 'identity') return [section, appleIdentity];
      if (section.id === 'tracking') return [section, shortcutsPrivacy[locale]];
      if (section.id === 'ai') return [section, processingPrivacy[locale].ai];
      if (section.id === 'storage') return [section, processingPrivacy[locale].storage];
      return [section];
    })
  };
}

export const legalCopy = {
  ar: {
    back: 'رجوع'
  },
  en: {
    back: 'Back'
  }
};
