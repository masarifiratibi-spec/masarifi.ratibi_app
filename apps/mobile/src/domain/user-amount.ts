import { getCurrencyMinorUnitScale } from './currencies';
import { normalizeLocalizedNumber } from './localized-number';

/** Interpret keyboard separators only at the user-entry boundary. */
export function parseUserAmountToMinor(
  text: string,
  currencyCode: string
): number | null {
  let value = normalizeLocalizedNumber(text);
  if (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?$/.test(value)) {
    value = value.replace(/,/g, '');
  } else if (/^\d+,\d+$/.test(value) && !text.includes('٬')) {
    value = value.replace(',', '.');
  }
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const scale = getCurrencyMinorUnitScale(currencyCode);
  if (fraction.length > scale) return null;
  const minor = Number(whole + fraction.padEnd(scale, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}
