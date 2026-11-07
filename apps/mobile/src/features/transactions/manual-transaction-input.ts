import { parseUserAmountToMinor } from '@/domain/user-amount';

export function parseManualAmount(
  text: string,
  currencyCode: string
): number | null {
  const minor = parseUserAmountToMinor(text, currencyCode);
  return minor !== null && minor > 0 ? minor : null;
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
