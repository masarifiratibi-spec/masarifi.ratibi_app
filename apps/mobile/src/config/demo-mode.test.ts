import { isDemoModeEnabled } from './demo-mode';

describe('client demo mode', () => {
  it('is enabled only by the explicit public value', () => {
    expect(isDemoModeEnabled('1')).toBe(true);
    expect(isDemoModeEnabled('0')).toBe(false);
    expect(isDemoModeEnabled(undefined)).toBe(false);
  });
});
