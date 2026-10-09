import { getCurrencyMinorUnitScale } from '@/domain/currencies';

// Manual entry accepts localized digits, but never guesses decimal/grouping intent.
export function parseManualAmount(
  text: string,
  currencyCode: string
): number | null {
  const normalized = text
    .trim()
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/٫/gu, '.')
    .replace(/٬/gu, ',');
  if (
    !/^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/u.test(normalized)
  )
    return null;
  const [whole, fraction = ''] = normalized.replace(/,/gu, '').split('.');
  const scale = getCurrencyMinorUnitScale(currencyCode);
  if (fraction.length > scale) return null;
  const digits =
    `${whole}${fraction.padEnd(scale, '0')}`.replace(/^0+/u, '') || '0';
  if (digits.length > 16) return null;
  const minor = Number(digits);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

// eslint-disable-next-line no-control-regex -- reject controls and directional overrides in financial input
const forbiddenText = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
// eslint-disable-next-line no-control-regex -- LF is the sole permitted note control
const forbiddenNote =
  /[\u0000-\u0009\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;

export function manualTitle(
  description: string,
  fallback: string
): string | null {
  const title = description.trim() || fallback.trim();
  return title &&
    title.length <= 160 &&
    !forbiddenText.test(description) &&
    !forbiddenText.test(title)
    ? title
    : null;
}

export function normalizeManualNote(value: string): string | null | undefined {
  const normalized = value.replace(/\r\n?/gu, '\n');
  if (forbiddenNote.test(normalized) || normalized.trim().length > 500)
    return undefined;
  return normalized.trim() || null;
}

export function validManualDate(timestamp: number, now = Date.now()): boolean {
  return (
    Number.isSafeInteger(timestamp) &&
    timestamp >= Date.UTC(1900, 0, 1) &&
    timestamp <= now + 300000
  );
}
