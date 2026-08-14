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

const labels: Record<KeywordRule['group'], Record<KeywordRule['language'], string>> = {
  expense: { ar: 'مصروف', en: 'Grocery' },
  income: { ar: 'راتب', en: 'Salary' },
  transfer: { ar: 'تحويل', en: 'Transfer' },
  withdrawal: { ar: 'سحب', en: 'Withdrawal' },
  deposit: { ar: 'إيداع', en: 'Deposit' },
  refund: { ar: 'استرداد', en: 'Refund' },
  subscription: { ar: 'اشتراك', en: 'Subscription' },
  installment: { ar: 'قسط', en: 'Installment' },
  fee: { ar: 'رسوم', en: 'Fee' },
  failed_transaction: { ar: 'عملية فاشلة', en: 'Failed transaction' },
  reversal: { ar: 'عكس قيد', en: 'Reversal' }
};

export const defaultKeywordRules: KeywordRule[] = keywordGroups.flatMap((group) =>
  (['ar', 'en'] as const).map((language) => {
    const value = labels[group][language];
    return {
      id: `${group}-${language}-default`,
      group,
      language,
      value,
      normalizedValue: value.toLocaleLowerCase(language),
      origin: 'default',
      enabled: true
    };
  })
);
