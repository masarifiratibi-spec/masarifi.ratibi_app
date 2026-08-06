/**
 * Arabic message catalog.
 *
 * Must stay in 1:1 parity with en.ts. The typed MessageKey (re-exported from
 * en.ts) is shared, so a missing Arabic key fails to compile. Constitution
 * Principle III and UI Contract §7.
 */

import type { MessageCatalog } from './en';

const ar: MessageCatalog = {
  'app.title': 'مسارف',
  'app.foundationTitle': 'شاشة التحقق من الأساس',
  'app.foundationIntro':
    'شاشة تحقق مؤقتة. الشاشات الإنتاجية تُبنى في مواصفات لاحقة.',

  'nav.position': 'مركزك المالي',
  'nav.capture': 'الإدخال والبدائل',
  'nav.trust': 'الثقة المالية',
  'nav.accessibility': 'اللغة وإمكانية الوصول',

  'position.title': 'مركزك المالي',
  'position.balance': 'الرصيد الحالي',
  'position.spending': 'المصروفات الأخيرة',
  'position.nextObligation': 'الالتزام القادم',
  'position.reviewItems': 'بحاجة إلى انتباهك',
  'position.empty.title': 'مرحبًا بك في مسارف',
  'position.empty.action': 'أضف أول معاملة',
  'position.partial.title': 'بعض المعلومات غير مكتملة',
  'position.partial.action': 'راجع البيانات الناقصة',
  'position.nextAction': 'الإجراء التالي',
  'position.estimated': 'تقديري',

  'capture.title': 'خيارات الإدخال',
  'capture.sms.title': 'تتبع رسائل SMS (أندرويد)',
  'capture.sms.purpose': 'اكتشف المعاملات من رسائل البنك تلقائيًا',
  'capture.sms.dataUse': 'تُحلَّل الرسائل على جهازك لإضافة المعاملات',
  'capture.sms.continue': 'متابعة',
  'capture.sms.skip': 'تخطٍ للآن',
  'capture.manual': 'إضافة يدوية',
  'capture.voice': 'إضافة صوتية',
  'capture.permission.notRequested': 'الإذن غير مطلوب بعد',
  'capture.permission.granted': 'الإذن ممنوح',
  'capture.permission.denied': 'الإذن مرفوض — الإدخال اليدوي متاح',
  'capture.permission.permanentlyDenied':
    'الإذن مرفوض نهائيًا. فعّله من الإعدادات لاستخدام تتبع الرسائل.',
  'capture.permission.revoked': 'تم إلغاء الإذن',
  'capture.permission.unavailable': 'غير متاح على هذا الجهاز',
  'capture.permission.recover': 'فتح الإعدادات',
  'capture.permission.disable': 'إيقاف تتبع الرسائل',
  'capture.ios.noSms': 'تتبع الرسائل المباشر غير متاح على iOS.',
  'capture.ios.alternatives':
    'استخدم الإدخال اليدوي أو الصوتي أو البدائل المعتمدة.',
  'capture.offline.saved': 'حُفظ محليًا — بانتظار المزامنة',
  'capture.offline.edit': 'تعديل الإدخال',
  'capture.offline.delete': 'حذف الإدخال',
  'capture.offline.retry': 'إعادة المحاولة',
  'capture.offline.conflict': 'تعارض في المزامنة — راجع الإدخال',
  'capture.offline.failed': 'فشلت المزامنة — أعد المحاولة عندما تكون مستعدًا',
  'capture.offline.title': 'إدخال دون اتصال',
  'capture.offline.syncing': 'جارٍ المزامنة',
  'capture.offline.synced': 'تمت المزامنة',
  'capture.offline.startSync': 'بدء المزامنة',
  'capture.offline.confirmSync': 'تأكيد المزامنة',
  'capture.offline.failSync': 'محاكاة الفشل',
  'capture.offline.conflictSync': 'محاكاة التعارض',
  'capture.offline.actionFailed': 'تعذر تنفيذ الإجراء المحلي. حاول مرة أخرى.',
  'capture.offline.nativeBuildRequired':
    'يعمل التحقق من SQLite دون اتصال في إصدارات تطوير أندرويد وiOS.',
  'capture.action.selected': 'تم الاختيار',

  'trust.title': 'التغييرات المالية',
  'trust.source': 'المصدر',
  'trust.undo': 'تراجع',
  'trust.edit': 'تعديل',
  'trust.report': 'الإبلاغ عن مشكلة',
  'trust.review': 'بحاجة للمراجعة',
  'trust.confirm': 'تأكيد التغيير',
  'trust.preview': 'معاينة التغيير',
  'trust.applied': 'تم التطبيق',
  'trust.rejected': 'مرفوض',
  'trust.undone': 'تم التراجع',
  'trust.corrected': 'تم التصحيح',
  'trust.errorTitle': 'حدث خطأ ما',
  'trust.errorAction': 'حاول مرة أخرى',
  'trust.retrying': 'جارٍ إعادة المحاولة',
  'trust.reported': 'تم الإبلاغ عن المشكلة',
  'trust.source.automatic': 'تلقائي',
  'trust.source.voice': 'صوتي',
  'trust.source.manual': 'يدوي',
  'trust.source.assistant': 'المساعد',
  'trust.source.platformAssisted': 'بمساعدة النظام',

  'a11y.controls': 'التحكم',
  'a11y.locale': 'اللغة',
  'a11y.theme': 'السمة',
  'a11y.reducedMotion': 'تقليل الحركة',
  'a11y.hideBalances': 'إخفاء الأرصدة',
  'a11y.stateLoading': 'جارٍ التحميل',
  'a11y.stateSuccess': 'تم بنجاح',
  'a11y.stateEmpty': 'لا يوجد شيء بعد',
  'a11y.stateError': 'خطأ',
  'a11y.stateOffline': 'أنت غير متصل',
  'a11y.statePermission': 'الإذن مطلوب',
  'a11y.stateSync': 'جارٍ المزامنة',
  'a11y.actionRetry': 'إعادة المحاولة',
  'a11y.retryRequested': 'تم طلب إعادة المحاولة',

  'common.light': 'فاتح',
  'common.dark': 'داكن',
  'common.system': 'النظام',
  'common.arabic': 'العربية',
  'common.english': 'English',
  'common.android': 'أندرويد',
  'common.ios': 'iOS',
  'scenario.populated': 'مكتمل',
  'scenario.empty': 'فارغ',
  'scenario.partial': 'جزئي',
  'scenario.clear': 'واضح',
  'scenario.ambiguous': 'ملتبس',
  'scenario.duplicate': 'مكرر',
  'scenario.failed': 'فشل',
  'scenario.assistant': 'اقتراح المساعد'
};

export default ar;
