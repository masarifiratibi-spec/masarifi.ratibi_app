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
  it('uses Saudi conversational assistant copy while preserving financial labels', () => {
    expect(ar).toMatchObject({
      'assistant.suggestions.spending': 'كم صرفت هالشهر؟',
      'assistant.suggestions.restaurants': 'كم صرفت على المطاعم هالشهر؟',
      'assistant.suggestions.highest': 'وش أكثر شي صرفت عليه؟',
      'assistant.state.error': 'المساعد مو متاح الحين. جرّب مرّة ثانية.',
      'assistant.state.offline':
        'المساعد يحتاج اتصال بالإنترنت. تقدر ترجع لمحادثاتك المحفوظة.',
      'assistant.state.limit': 'وصلت لحد استخدام المساعد. جرّب لاحقًا.',
      'assistant.operation.state.unknown':
        'ما تأكدت نتيجة السؤال. تحقّق من حالته قبل ترسل سؤال ثاني.',
      'assistant.actionPreview.state.unknown':
        'ما تأكدت نتيجة الإجراء. تحقّق من حالته قبل تعيد المحاولة؛ المحاولة تستخدم نفس العملية الأصلية.',
      'assistant.actionPreview.field.amountMinor': 'المبلغ',
      'assistant.actionPreview.field.currency': 'العملة',
      'assistant.actionPreview.confirm.message':
        'ما راح يتغيّر شي إلا بعد تأكيدك.'
    });
    const assistantCopy = Object.entries(ar)
      .filter(([key]) => key.startsWith('assistant.'))
      .map(([, value]) => value)
      .join('\n');
    expect(assistantCopy).not.toMatch(/النهارده|أمبارح|مفيش|عايز|إزاي/u);
    expect(en['assistant.suggestions.spending']).toBe(
      'How much did I spend this month?'
    );
  });
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

  it('uses the approved Gulf-neutral Arabic account glossary', () => {
    expect(ar).toMatchObject({
      'coreFinance.accounts.setup.introTitle': 'تفاصيل الحساب',
      'coreFinance.accounts.setup.educationTitle':
        'لماذا نحتاج آخر أربعة أرقام؟',
      'coreFinance.accounts.typeSelect.bank': 'بطاقة خصم / حساب بنكي',
      'coreFinance.accounts.typeSelect.credit_card': 'بطاقة ائتمانية',
      'coreFinance.accounts.typeSelect.cash': 'حساب نقدي',
      'coreFinance.accounts.typeSelect.wallet': 'محفظة رقمية'
    });
  });

  it('keeps confirmed Egyptian account-flow phrases out of product copy', () => {
    const accountCopy = Object.entries(ar)
      .filter(([key]) => key.startsWith('coreFinance.accounts.'))
      .map(([, value]) => value)
      .join('\n');

    for (const phrase of [
      'بتضيف إيه',
      'ده بيحدد',
      'قربنا نخلص',
      'ليه بنحتاج',
      'بيبعت',
      'كريدت كارد',
      'كارت',
      'فلوس البيت',
      'حساب المرتب',
      'إنت اللي بتسجله',
      'فودافون كاش',
      'أورنج كاش'
    ]) {
      expect(accountCopy).not.toContain(phrase);
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
