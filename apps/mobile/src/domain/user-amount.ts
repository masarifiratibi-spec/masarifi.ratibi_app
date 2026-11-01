import { parseAmountToMinor } from './core-finance';
import { normalizeLocalizedNumber } from './localized-number';

/** User entry boundary only. Server/wire validation continues to use the strict parser. */
export function parseUserAmountToMinor(
  text: string,
  currencyCode: string
): number | null {
  return parseAmountToMinor(normalizeLocalizedNumber(text), currencyCode);
}
