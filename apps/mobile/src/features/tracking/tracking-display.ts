import { translate } from '@/localization/i18n';

export function trackingReasonSummary(reasonCodes: readonly string[]): string {
  return reasonCodes
    .map((code) => translate(`tracking.reason.${code}` as never))
    .join(' · ');
}

export function trackingFieldLabel(field: string): string {
  const keyByField: Record<string, string> = {
    amountMinor: 'coreFinance.form.amount',
    currencyCode: 'coreFinance.accounts.currency',
    merchant: 'voice.review.merchant',
    accountId: 'coreFinance.transaction.account',
    categoryId: 'coreFinance.transaction.category'
  };
  return translate(
    (keyByField[field] ?? 'tracking.review.unknownField') as never
  );
}
