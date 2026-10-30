import termsAr from './terms.ar.json';
import termsEn from './terms.en.json';
import privacyAr from './privacy.ar.json';
import privacyEn from './privacy.en.json';

export const legalDocumentVersion = '1.0-draft';
export const legalDraftPreparedDate = '2026-10-29';
// Activation needs approved wording and a separately reviewed versioned consent record.
// This review preview does not admit, block or record registration consent.
export const registrationLegalConsentEnforced = false;
export type LegalDocumentKind = 'terms' | 'privacy';
const documents = {
  ar: { terms: termsAr, privacy: privacyAr },
  en: { terms: termsEn, privacy: privacyEn }
};

export function getLegalDocument(locale: 'ar' | 'en', kind: LegalDocumentKind) {
  return documents[locale][kind];
}

export const legalReviewCopy = {
  ar: {
    checkbox:
      'أوافق على الشروط والأحكام وأقر بالاطلاع على سياسة الخصوصية — معاينة غير مفعلة',
    preview:
      'وثائق للمراجعة فقط. سيكون الاختيار إلزاميًا بعد الاعتماد؛ ولا يُسجّل الآن أي قبول ولا يُحظر التسجيل.',
    version: 'نسخة للمراجعة',
    back: 'رجوع'
  },
  en: {
    checkbox:
      'I agree to the Terms & Conditions and acknowledge the Privacy Policy — inactive preview',
    preview:
      'Review preview only. Consent will be mandatory after approval. No consent is recorded and registration is not blocked.',
    version: 'Review version',
    back: 'Back'
  }
};
