import { Platform } from 'react-native';
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
  const document = documents[locale][kind];
  if (kind !== 'privacy' || Platform.OS !== 'ios') return document;
  const appleIdentity = {
    id: 'apple-identity',
    title: locale === 'ar' ? 'الدخول باستخدام Apple' : 'Sign in with Apple',
    paragraphs: locale === 'ar' ? [
      'إذا اخترت الدخول باستخدام Apple على iOS، تعالج Apple وClerk طلب الدخول ومعرّف حسابك لدى Apple، والاسم والبريد الإلكتروني اللذين تسمح بمشاركتهما. عند اختيار «إخفاء بريدي الإلكتروني»، يمكن استخدام عنوان ترحيل خاص بالتطبيق بدل بريدك الفعلي. يحتفظ التطبيق بمعرّفات Clerk وحالة الجلسة وطريقة الدخول اللازمة للوصول إلى حسابك.',
      'يمكنك إدارة أو إلغاء تفويض Apple من إعدادات حساب Apple. إلغاء التفويض وحده لا يحذف حسابك وبياناتك في مصاريفي وراتبي؛ استخدم طلب حذف الحساب داخل التطبيق لهذا الغرض.'
    ] : [
      'If you choose Sign in with Apple on iOS, Apple and Clerk process your authentication request, Apple account identifier, and the name and email address you authorize sharing. If you choose Hide My Email, an app-specific relay address can be used instead of your actual email. The app retains Clerk identifiers, session status and the sign-in method needed to access your account.',
      'You can manage or revoke Apple authorization in your Apple Account settings. Revoking that authorization alone does not delete your Masarifi account or data; use the in-app account-deletion request for that purpose.'
    ]
  };
  return {
    ...document,
    sections: document.sections.flatMap(section => section.id === 'identity'
      ? [section, appleIdentity] : [section])
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
