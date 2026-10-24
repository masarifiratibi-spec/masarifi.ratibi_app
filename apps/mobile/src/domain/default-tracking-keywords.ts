import type { KeywordRule } from '@/domain/app-shell';

export const keywordGroups = [
  'expense',
  'income',
  'transfer',
  'withdrawal',
  'deposit',
  'refund',
  'subscription',
  'installment',
  'fee',
  'failed_transaction',
  'reversal'
] as const satisfies readonly KeywordRule['group'][];

const labels: Record<
  KeywordRule['group'],
  Record<KeywordRule['language'], readonly string[]>
> = {
  financial: { ar: [], en: [] },
  expense: {
    ar: ['مصروف', 'شراء', 'شراء إنترنت', 'دفع', 'سداد', 'خصم'],
    en: [
      'Grocery',
      'Used for',
      'Debit transaction',
      'Debited',
      'Purchase',
      'Payment',
      'Spent',
      'Charged'
    ]
  },
  income: {
    ar: ['راتب', 'إضافة', 'استلام', 'تحويل وارد'],
    en: [
      'Salary',
      'Credited',
      'Credit transaction',
      'Cr. transaction',
      'Received',
      'Incoming transfer'
    ]
  },
  transfer: {
    ar: ['تحويل', 'تحويل إلى', 'تم التحويل'],
    en: ['Transfer', 'Transferred to', 'Sent']
  },
  withdrawal: {
    ar: ['سحب', 'سحب نقدي'],
    en: ['Withdrawal', 'Withdrawn', 'Cash withdrawal', 'ATM']
  },
  deposit: { ar: ['إيداع'], en: ['Deposit'] },
  refund: { ar: ['استرداد', 'مسترد'], en: ['Refund', 'Refunded'] },
  subscription: { ar: ['اشتراك'], en: ['Subscription'] },
  installment: { ar: ['قسط'], en: ['Installment'] },
  fee: {
    ar: ['رسوم', 'عمولة'],
    en: ['Fee', 'Service fee', 'Foreign transaction fee', 'Commission']
  },
  failed_transaction: {
    ar: ['عملية فاشلة', 'فشل', 'مرفوضة', 'لم تتم', 'غير ناجحة', 'رصيد غير كاف'],
    en: [
      'Failed transaction',
      'Failed',
      'Declined',
      'Rejected',
      'Unsuccessful',
      'Insufficient funds',
      'Exceeded PIN attempts'
    ]
  },
  reversal: {
    ar: ['عكس قيد', 'ملغاة'],
    en: ['Reversal', 'Reversed', 'Cancelled']
  }
};

export const defaultKeywordRules: KeywordRule[] = keywordGroups.flatMap(
  (group) =>
    (['ar', 'en'] as const).flatMap((language) =>
      labels[group][language].map((value, index) => ({
        id: `${group}-${language}-default${index ? `-${String(index + 1)}` : ''}`,
        group,
        language,
        value,
        normalizedValue: value.normalize('NFKC').toLocaleLowerCase(language),
        origin: 'default' as const,
        enabled: true
      }))
    )
);
