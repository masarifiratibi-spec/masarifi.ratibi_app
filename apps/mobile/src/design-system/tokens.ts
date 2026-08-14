import type { TextStyle } from 'react-native';

/**
 * Masarifi Gulf Premium design-system token adapter (mobile).
 *
 * This is the ONLY module in the mobile app that owns raw color values. Every
 * feature component consumes the semantic names exported here; raw hex values
 * may never appear outside this file. This satisfies Constitution Principle IV
 * (Semantic Design System Only) and the UI Contract §9.
 *
 * When packages/ui-tokens exports runtime tokens, this adapter will consume
 * them; until then it owns the single approved mapping.
 *
 * Authority: docs/design-system/masarifi-gulf-premium-design-system-v2.1.md
 *            specs/001-mobile-foundation/contracts/foundation-ui-contract.md §9
 */

// Teal is the primary interaction family. Bronze is a restrained premium accent,
// never a second primary.
export const colorTokens = {
  teal: {
    50: '#F3F7F6',
    100: '#E3ECE9',
    500: '#46756C',
    600: '#315C55',
    700: '#244541',
    800: '#1C3934',
    900: '#16332F',
    950: '#102723'
  },
  bronze: {
    300: '#E2CEB7',
    500: '#CFA47A',
    700: '#93663D'
  },
  sand: {
    50: '#FFFFFF',
    100: '#F6F7F5',
    200: '#FAFBFA',
    300: '#F1F3F1',
    400: '#E7E9E6'
  },
  ink: {
    900: '#202824',
    700: '#4B534E',
    500: '#707870'
  },
  surface: {
    white: '#FFFFFF'
  },
  neutral: {
    warmSurface: '#F6F7F5',
    warmMuted: '#FAFBFA',
    warmBorder: '#E7E9E6',
    warmText: '#202824'
  },
  dark: {
    background: '#111816',
    surface: '#19231F',
    surfaceMuted: '#202B27',
    border: '#2C3934',
    text: '#F8F0E5',
    textMuted: '#D9CDBD',
    inverse: '#0F211E'
  },
  border: {
    light: '#E7E9E6',
    dark: '#3B4A44',
    focus: '#2E756B'
  },
  // Operational status colors are kept DISTINCT from financial semantic colors
  // per Constitution Product & Technical Constraints.
  status: {
    success: '#2F765D',
    warning: '#93663D',
    danger: '#C04B45',
    info: '#367184',
    neutral: '#746D5D',
    pending: '#6B7280',
    offline: '#7C5F42',
    sync: '#2E7087'
  },
  // Financial semantic colors: positive/inflow vs negative/outflow.
  financial: {
    income: '#1F7A5A',
    expense: '#B4473F',
    transfer: '#376E86',
    refund: '#6D6A2E',
    savings: '#5E7464',
    debt: '#8B5A44',
    positive: '#1F7A5A',
    negative: '#B4473F'
  },
  chart: {
    donut: ['#1C3934', '#93663D', '#46756C', '#6D6A2E', '#8B5A44'],
    line: ['#1C3934', '#93663D', '#46756C', '#B4473F'],
    patterns: ['solid', 'dash', 'dot', 'dashDot']
  }
} as const;

export type SemanticColorToken =
  | 'primary'
  | 'primaryPressed'
  | 'accent'
  | 'background'
  | 'surface'
  | 'surfaceMuted'
  | 'border'
  | 'textPrimary'
  | 'textSecondary'
  | 'textInverse'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'financialPositive'
  | 'financialNegative';

export interface ThemeColors {
  primary: string;
  primaryPressed: string;
  accent: string;
  focus: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  financialPositive: string;
  financialNegative: string;
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
    neutral: string;
    pending: string;
    offline: string;
    sync: string;
  };
  financial: {
    income: string;
    expense: string;
    transfer: string;
    refund: string;
    savings: string;
    debt: string;
  };
  chart: typeof colorTokens.chart;
}

export const lightThemeColors: ThemeColors = {
  primary: colorTokens.teal['800'],
  primaryPressed: colorTokens.teal['950'],
  accent: colorTokens.bronze['700'],
  focus: colorTokens.border.focus,
  background: colorTokens.sand['100'],
  surface: colorTokens.sand['50'],
  surfaceMuted: colorTokens.sand['200'],
  border: colorTokens.sand['400'],
  textPrimary: colorTokens.ink['900'],
  textSecondary: colorTokens.ink['700'],
  textInverse: colorTokens.surface.white,
  success: colorTokens.status.success,
  warning: colorTokens.status.warning,
  danger: colorTokens.status.danger,
  info: colorTokens.status.info,
  financialPositive: colorTokens.financial.positive,
  financialNegative: colorTokens.financial.negative,
  status: colorTokens.status,
  financial: {
    income: colorTokens.financial.income,
    expense: colorTokens.financial.expense,
    transfer: colorTokens.financial.transfer,
    refund: colorTokens.financial.refund,
    savings: colorTokens.financial.savings,
    debt: colorTokens.financial.debt
  },
  chart: colorTokens.chart
};

export const darkThemeColors: ThemeColors = {
  primary: colorTokens.teal['100'],
  primaryPressed: colorTokens.teal['50'],
  accent: colorTokens.bronze['300'],
  focus: colorTokens.teal['500'],
  background: colorTokens.dark.background,
  surface: colorTokens.dark.surface,
  surfaceMuted: colorTokens.dark.surfaceMuted,
  border: colorTokens.dark.border,
  textPrimary: colorTokens.dark.text,
  textSecondary: colorTokens.dark.textMuted,
  textInverse: colorTokens.dark.inverse,
  success: colorTokens.status.success,
  warning: colorTokens.status.warning,
  danger: colorTokens.status.danger,
  info: colorTokens.status.info,
  financialPositive: colorTokens.financial.positive,
  financialNegative: colorTokens.financial.negative,
  status: colorTokens.status,
  financial: {
    income: colorTokens.financial.income,
    expense: colorTokens.financial.expense,
    transfer: colorTokens.financial.transfer,
    refund: colorTokens.financial.refund,
    savings: colorTokens.financial.savings,
    debt: colorTokens.financial.debt
  },
  chart: colorTokens.chart
};

// ─── Spacing / radii / typography ────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  card: 8,
  pill: 999
} as const;

export const borderWidth = {
  hairline: 0.5,
  default: 1,
  focus: 2
} as const;

export const elevation = {
  none: {
    shadowOpacity: 0,
    elevation: 0
  },
  raised: {
    shadowColor: '#102723',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3
  }
} as const;

export const iconSize = {
  sm: 18,
  md: 24,
  lg: 28
} as const;

export const controlHeight = {
  sm: 44,
  md: 48,
  lg: 56
} as const;

export const viewport = {
  minWidth: 320,
  minHeight: 568
} as const;

// Minimum touch target per Constitution Principle III and UI Contract §8.
export const minTouchTarget = 44;

export const typography = {
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  headline: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  amount: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as NonNullable<TextStyle['fontVariant']>
  }
} as const;
