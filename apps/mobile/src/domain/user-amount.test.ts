import { parseAmountToMinor } from './core-finance';
import { parseUserAmountToMinor } from './user-amount';

describe('localized user amounts', () => {
  it.each([
    ['١٬٢٣٤٫٥٦', 'SAR', 123456],
    ['۱۲٫۳۴۵', 'KWD', 12345],
    ['١٢٣', 'JPY', 123],
    ['٠', 'SAR', 0],
    ['150,30', 'AED', 15030],
    ['150,3', 'AED', 15030],
    ['١٥٠٬٣٠', 'AED', null],
    ['1,234.56', 'AED', 123456],
    ['1,234', 'AED', 123400],
    ['0,123', 'KWD', 123],
    ['1,2,3', 'AED', null],
    ['25,5000', 'AED', null],
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
