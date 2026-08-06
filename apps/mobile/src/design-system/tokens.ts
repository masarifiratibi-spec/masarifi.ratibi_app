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
    50: '#FFFDFC',
    100: '#FBF6EF',
    200: '#F7EFE4',
    300: '#F1E6D8',
    400: '#E4D8C8'
  },
  ink: {
    900: '#18312C',
    700: '#554F42',
    500: '#746D5D'
  },
  surface: {
    white: '#FFFFFF'
  },
  // Operational status colors are kept DISTINCT from financial semantic colors
  // per Constitution Product & Technical Constraints.
  status: {
    success: '#2F765D',
    warning: '#B06A12',
    danger: '#C04B45',
    info: '#367184'
  },
  // Financial semantic colors: positive/inflow vs negative/outflow.
  financial: {
    positive: '#2F765D',
    negative: '#C04B45'
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
}

export const lightThemeColors: ThemeColors = {
  primary: colorTokens.teal['800'],
  primaryPressed: colorTokens.teal['950'],
  accent: colorTokens.bronze['500'],
  background: colorTokens.sand['100'],
  surface: colorTokens.sand['50'],
  surfaceMuted: colorTokens.sand['200'],
  border: colorTokens.sand['400'],
  textPrimary: colorTokens.ink['900'],
  textSecondary: colorTokens.ink['500'],
  textInverse: colorTokens.surface.white,
  success: colorTokens.status.success,
  warning: colorTokens.status.warning,
  danger: colorTokens.status.danger,
  info: colorTokens.status.info,
  financialPositive: colorTokens.financial.positive,
  financialNegative: colorTokens.financial.negative
};

export const darkThemeColors: ThemeColors = {
  primary: '#79A99F',
  primaryPressed: '#A8CFC7',
  accent: '#D0AA7D',
  background: '#111816',
  surface: '#19231F',
  surfaceMuted: '#202B27',
  border: '#3B4A44',
  textPrimary: '#F8F0E5',
  textSecondary: '#D9CDBD',
  textInverse: '#0F211E',
  success: colorTokens.status.success,
  warning: colorTokens.status.warning,
  danger: colorTokens.status.danger,
  info: colorTokens.status.info,
  financialPositive: colorTokens.financial.positive,
  financialNegative: colorTokens.financial.negative
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
  md: 10,
  lg: 16,
  pill: 999
} as const;

// Minimum touch target per Constitution Principle III and UI Contract §8.
export const minTouchTarget = 44;

export const typography = {
  // Sizes use platform-independent scale; components apply font scaling.
  caption: 12,
  body: 15,
  subtitle: 17,
  title: 22,
  headline: 28,
  // Financial amounts get priority weight per Constitution FR-013.
  amount: 30
} as const;
