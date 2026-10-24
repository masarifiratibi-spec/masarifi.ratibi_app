import { parseAmountToMinor } from './core-finance';
import { parseUserAmountToMinor } from './user-amount';

describe('localized user amounts', () => {
  it.each([
    ['١٬٢٣٤٫٥٦', 'SAR', 123456],
    ['۱۲٫۳۴۵', 'KWD', 12345],
    ['١٢٣', 'JPY', 123],
    ['٠', 'SAR', 0],
    ['١٫٢', 'JPY', null],
    ['١٫٢٣٤', 'SAR', null],
    ['-١', 'SAR', null],
    ['٩٠٠٧١٩٩٢٥٤٧٤٠٩٫٩٢', 'SAR', null],
    ['١..٢', 'SAR', null]
  ])('%s in %s', (text, currency, expected) => {
    expect(parseUserAmountToMinor(String(text), String(currency))).toBe(
      expected
    );
  });
  it('keeps wire parsing strict', () => {
    expect(parseAmountToMinor('١٢٫٣٤', 'SAR')).toBeNull();
  });
});
