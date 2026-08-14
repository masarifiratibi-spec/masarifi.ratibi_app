import { resolveTheme } from './theme';

describe('SPEC-002 theme mapping', () => {
  it('resolves light and dark semantic color groups', () => {
    for (const mode of ['light', 'dark'] as const) {
      const theme = resolveTheme(mode, mode);

      expect(theme.mode).toBe(mode);
      expect(theme.colors.status.success).toBeDefined();
      expect(theme.colors.status.warning).toBeDefined();
      expect(theme.colors.status.danger).toBeDefined();
      expect(theme.colors.financial.income).toBeDefined();
      expect(theme.colors.financial.expense).toBeDefined();
      expect(theme.colors.chart.donut).toHaveLength(5);
      expect(theme.colors.focus).toBeDefined();
    }
  });

  it('does not reuse status tokens as financial meaning tokens', () => {
    const theme = resolveTheme('light', 'light');

    expect(theme.colors.status.success).not.toBe(theme.colors.financial.income);
    expect(theme.colors.status.danger).not.toBe(theme.colors.financial.expense);
  });

  it('keeps core text pairs above normal contrast minimums', () => {
    for (const mode of ['light', 'dark'] as const) {
      const { colors } = resolveTheme(mode, mode);

      expect(contrastRatio(colors.textPrimary, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.textSecondary, colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.primary, colors.background)).toBeGreaterThanOrEqual(3);
    }
  });
});

function contrastRatio(foreground: string, background: string): number {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
