/**
 * Locale-aware financial value formatting.
 *
 * Constitution FR-023: financial numbers MUST use English numerals and
 * locale-aware formatting. Manual string assembly is prohibited (Product &
 * Technical Constraints). We force Latin numerals by using the `en-US` numbering
 * system for the number portion, then attaching the currency code as a plain
 * label so the value is unambiguous in both Arabic and English.
 */

import type { Locale } from '@/domain/foundation';

const LATIN_NUMERAL_LOCALES: Record<Locale, string> = {
  ar: 'ar-u-nu-latn',
  en: 'en-US-u-nu-latn'
};

export interface EstimatedAggregateLabel {
  amount: number;
  sourceCurrencyCode: string;
  reportingCurrencyCode: string;
  isEstimated: boolean;
}

export function formatAmount(
  value: number,
  currencyCode: string,
  locale: Locale
): string {
  const numberPart = new Intl.NumberFormat(LATIN_NUMERAL_LOCALES[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `${numberPart} ${currencyCode}`;
}

export function formatDate(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LATIN_NUMERAL_LOCALES[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LATIN_NUMERAL_LOCALES[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

export function formatEstimatedAggregateLabel(
  amount: number,
  sourceCurrencyCode: string,
  reportingCurrencyCode: string,
  isEstimated: boolean
): EstimatedAggregateLabel {
  return {
    amount,
    sourceCurrencyCode,
    reportingCurrencyCode,
    isEstimated
  };
}
