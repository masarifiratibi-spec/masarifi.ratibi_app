import { layoutPdfText } from '../../../src/reports/reports.pdf-text';

describe('PDF bidirectional text layout', () => {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const measure = (run: string) => Array.from(segmenter.segment(run)).length;
  it('keeps Arabic logical text in one shaped run and puts the Latin run on its visual left', () => {
    expect(layoutPdfText('الملخص المالي', 100, measure)).toEqual([['الملخص المالي']]);
    expect(layoutPdfText('قهوة Coffee', 100, measure)).toEqual([['Coffee', 'قهوة ']]);
    expect(layoutPdfText('-12.34 SAR', 100, measure)).toEqual([['-12.34 SAR']]);
    // The font shaper reverses this digit-only Arabic run; compensate for its
    // script inference so the rendered identifier remains ١٢٣, not ٣٢١.
    expect(layoutPdfText('مرجع ١٢٣', 100, measure)).toEqual([['٣٢١', 'مرجع ']]);
  });

  it('wraps logical lines before bidi ordering while preserving every word and number', () => {
    const lines = layoutPdfText('قهوة Coffee اليوم 12.34 SAR', 12, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.reduce((sum, run) => sum + measure(run), 0) <= 12)).toBe(
      true,
    );
    expect(lines.flat().join('')).toContain('Coffee');
    expect(lines.flat().join('')).toContain('12.34');
    expect(lines.flat().join('')).toContain('SAR');
    expect(lines.flat().join('')).toContain('اليوم');
  });
});
