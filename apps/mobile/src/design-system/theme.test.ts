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

      expect(
        contrastRatio(colors.textPrimary, colors.background)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(colors.textSecondary, colors.surface)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(colors.primary, colors.background)
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the financial hero dark with readable content in both themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const { colors } = resolveTheme(mode, mode);

      expect(colors.surfaces.financialHero).toBeDefined();
      expect(colors.content.onFinancialHero).toBeDefined();
      expect(
        contrastRatio(
          colors.content.onFinancialHero,
          colors.surfaces.financialHero
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(colors.content.onFinancialHero, colors.horizon.heroStart)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(colors.content.onFinancialHero, colors.horizon.heroEnd)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps dark text, status and financial labels readable across cards, insets and dialogs', () => {
    const { colors } = resolveTheme('dark', 'dark');
    const foregrounds = [
      colors.content.primary,
      colors.content.secondary,
      colors.content.muted,
      colors.content.link,
      ...Object.values(colors.status),
      colors.financial.income,
      colors.financial.expense,
      colors.financial.transfer,
      colors.financial.refund,
      colors.financial.savings,
      colors.financial.debt
    ];
    for (const surface of [
      colors.background,
      colors.surface,
      colors.surfaceMuted,
      colors.surfaces.overlay
    ]) {
      for (const foreground of foregrounds) {
        expect(contrastRatio(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(
      contrastRatio(colors.financial.income, colors.financial.incomeSurface)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(colors.financial.expense, colors.financial.expenseSurface)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps dark button labels, focus borders and chart series distinguishable', () => {
    const { colors } = resolveTheme('dark', 'dark');
    for (const fill of [
      colors.primary,
      colors.primaryPressed,
      colors.accent,
      colors.status.danger
    ]) {
      expect(contrastRatio(colors.textInverse, fill)).toBeGreaterThanOrEqual(
        4.5
      );
    }
    for (const border of [
      colors.focus,
      colors.borders.strong,
      colors.borders.selected
    ]) {
      expect(contrastRatio(border, colors.surface)).toBeGreaterThanOrEqual(3);
    }
    for (const series of [...colors.chart.donut, ...colors.chart.line]) {
      expect(contrastRatio(series, colors.surface)).toBeGreaterThanOrEqual(3);
    }
    for (const badge of Object.values(colors.iconBadges).flat()) {
      expect(
        contrastRatio(badge.foreground, badge.background)
      ).toBeGreaterThanOrEqual(3);
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
