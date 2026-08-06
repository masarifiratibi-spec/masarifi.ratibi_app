/**
 * Context-aware sensitive-value masking.
 *
 * Financial values are visible only in an authenticated app session and when
 * the global hide-balances preference is off. Lock-screen notifications and
 * app-switcher previews are ALWAYS masked, regardless of session or preference.
 * Analytics events must never contain the unmasked value. UI Contract §5,
 * Constitution Principle I.
 */

import { formatAmount } from './format-financial-value';

export type SensitiveSurface = 'app' | 'lockscreen' | 'appSwitcher';

export interface MaskingContext {
  surface: SensitiveSurface;
  authenticated: boolean;
  hideBalances: boolean;
}

const MASK = '•••••';

export function maskFinancialValue(
  amount: number,
  currencyCode: string,
  context: MaskingContext
): string {
  if (shouldMask(context)) {
    return MASK;
  }
  return formatAmount(amount, currencyCode, 'en');
}

export function shouldMask(context: MaskingContext): boolean {
  if (context.surface === 'lockscreen' || context.surface === 'appSwitcher') {
    return true;
  }
  if (context.hideBalances) {
    return true;
  }
  return !context.authenticated;
}
