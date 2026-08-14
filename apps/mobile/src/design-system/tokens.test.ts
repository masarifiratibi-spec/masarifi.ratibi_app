import {
  colorTokens,
  spacing,
  radius,
  elevation,
  iconSize,
  controlHeight,
  borderWidth,
  viewport,
  typography,
  minTouchTarget
} from './tokens';

describe('SPEC-002 design tokens', () => {
  it('owns approved reference color families centrally', () => {
    expect(colorTokens.teal['800']).toBe(hex('1C3934'));
    expect(colorTokens.bronze['500']).toBe(hex('CFA47A'));
    expect(colorTokens.neutral.warmSurface).toBe(hex('F6F7F5'));
    expect(colorTokens.dark.surface).toBe(hex('19231F'));
    expect(colorTokens.border.light).toBe(hex('E7E9E6'));
  });

  it('keeps operational status and financial meaning distinct', () => {
    expect(colorTokens.status.success).not.toBe(colorTokens.financial.income);
    expect(colorTokens.status.danger).not.toBe(colorTokens.financial.expense);
    expect(colorTokens.financial.transfer).toBeDefined();
    expect(colorTokens.financial.savings).toBeDefined();
    expect(colorTokens.financial.debt).toBeDefined();
  });

  it('defines chart palettes with non-color cue names', () => {
    expect(colorTokens.chart.donut).toHaveLength(5);
    expect(colorTokens.chart.line).toHaveLength(4);
    expect(colorTokens.chart.patterns).toEqual([
      'solid',
      'dash',
      'dot',
      'dashDot'
    ]);
  });

  it('defines shared mobile metrics', () => {
    expect(spacing).toMatchObject({ xs: 4, sm: 8, md: 12, lg: 16 });
    expect(radius.card).toBeLessThanOrEqual(8);
    expect(borderWidth.default).toBe(1);
    expect(elevation.raised.shadowRadius).toBeGreaterThan(0);
    expect(iconSize.md).toBe(24);
    expect(controlHeight.md).toBeGreaterThanOrEqual(minTouchTarget);
    expect(viewport.minWidth).toBe(320);
    expect(viewport.minHeight).toBe(568);
    expect(typography.amount.fontVariant).toEqual(['tabular-nums']);
  });
});

function hex(value: string) {
  return `#${value}`;
}
