export function normalizeLocalizedNumber(text: string): string {
  return text
    .trim()
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/٫/gu, '.')
    .replace(/٬/gu, ',');
}
