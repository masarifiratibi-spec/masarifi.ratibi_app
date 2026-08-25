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
import {
  getCurrencyMinorUnitScale,
  minorToMajorAmountText
} from '@/domain/currencies';

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

export type FinancialDisplayState =
  | 'confirmed'
  | 'estimated'
  | 'pending'
  | 'unknown'
  | 'absent'
  | 'hidden';

export type FinancialDisplaySign = 'positive' | 'negative' | 'none';

export interface FinancialDisplayValue {
  text: string;
  accessibilityLabel: string;
}

export function formatAmount(
  value: number,
  currencyCode: string,
  locale: Locale
): string {
  const numberPart = new Intl.NumberFormat(LATIN_NUMERAL_LOCALES[locale], {
    minimumFractionDigits: getCurrencyMinorUnitScale(currencyCode),
    maximumFractionDigits: getCurrencyMinorUnitScale(currencyCode)
  }).format(value);
  return `${numberPart}\u00a0${currencyCode}`;
}

export function formatMinorAmount(
  minorUnits: number,
  currencyCode: string,
  locale: Locale
): string {
  const exactAmount = minorToMajorAmountText(minorUnits, currencyCode);
  const negative = exactAmount.startsWith('-');
  const [whole, fraction] = (negative ? exactAmount.slice(1) : exactAmount).split(
    '.'
  );
  const formatter = new Intl.NumberFormat(LATIN_NUMERAL_LOCALES[locale]);
  const numberPart = formatter.format(Number(whole) * (negative ? -1 : 1));
  const displayFraction = (fraction ?? '').padEnd(
    getCurrencyMinorUnitScale(currencyCode),
    '0'
  );
  const decimal = displayFraction
    ? formatter.formatToParts(1.1).find((part) => part.type === 'decimal')
        ?.value ?? '.'
    : '';
  return `${numberPart}${decimal}${displayFraction}\u00a0${currencyCode}`;
}

export function formatFinancialDisplayValue({
  value,
  minorUnits,
  currencyCode,
  locale,
  sign,
  state
}: {
  value?: number;
  minorUnits?: number;
  currencyCode: string;
  locale: Locale;
  sign: FinancialDisplaySign;
  state: FinancialDisplayState;
}): FinancialDisplayValue {
  if (state === 'hidden') {
    return {
      text: `\u2066•••• ${currencyCode}\u2069`,
      accessibilityLabel: 'Value hidden'
    };
  }
  if (state === 'unknown') {
    const text = `\u2066— ${currencyCode}\u2069`;
    return { text, accessibilityLabel: text };
  }
  if (state === 'absent') {
    const text = '\u2066Not available\u2069';
    return { text, accessibilityLabel: text };
  }

  const amount =
    minorUnits === undefined
      ? formatAmount(Math.abs(value ?? 0), currencyCode, locale)
      : formatMinorAmount(Math.abs(minorUnits), currencyCode, locale);
  const prefix = sign === 'positive' ? '+' : sign === 'negative' ? '-' : '';
  const text = `\u2066${prefix}${amount}\u2069`;
  return { text, accessibilityLabel: text };
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
