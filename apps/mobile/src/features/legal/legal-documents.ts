import termsAr from './terms.ar.json';
import termsEn from './terms.en.json';
import privacyAr from './privacy.ar.json';
import privacyEn from './privacy.en.json';

export type LegalDocumentKind = 'terms' | 'privacy';
const documents = {
  ar: { terms: termsAr, privacy: privacyAr },
  en: { terms: termsEn, privacy: privacyEn }
};

export function getLegalDocument(locale: 'ar' | 'en', kind: LegalDocumentKind) {
  return documents[locale][kind];
}

export const legalCopy = {
  ar: {
    back: 'رجوع'
  },
  en: {
    back: 'Back'
  }
};
