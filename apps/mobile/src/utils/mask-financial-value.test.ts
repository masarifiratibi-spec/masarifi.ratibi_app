import {
  maskFinancialValue,
  type MaskingContext
} from './mask-financial-value';

describe('maskFinancialValue', () => {
  const cases: readonly [string, MaskingContext, string][] = [
    [
      'authenticated in-app session',
      { surface: 'app', authenticated: true, hideBalances: false },
      '1,234.50 SAR'
    ],
    [
      'hide-balances preference on',
      { surface: 'app', authenticated: true, hideBalances: true },
      '•••••'
    ],
    [
      'unauthenticated session',
      { surface: 'app', authenticated: false, hideBalances: false },
      '•••••'
    ]
  ];

  it.each(cases)('shows the amount only for %s', (_label, ctx, expected) => {
    const result = maskFinancialValue(1234.5, 'SAR', ctx);
    expect(result).toBe(expected);
  });

  it('always masks lock-screen notifications regardless of session or preference', () => {
    expect(
      maskFinancialValue(1234.5, 'SAR', {
        surface: 'lockscreen',
        authenticated: true,
        hideBalances: false
      })
    ).toBe('•••••');
  });

  it('always masks app-switcher previews regardless of session or preference', () => {
    expect(
      maskFinancialValue(1234.5, 'SAR', {
        surface: 'appSwitcher',
        authenticated: true,
        hideBalances: false
      })
    ).toBe('•••••');
  });
});
