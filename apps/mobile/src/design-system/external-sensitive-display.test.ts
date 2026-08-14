import { safeExternalSensitiveValue } from './external-sensitive-display';

describe('external sensitive display', () => {
  it('never returns raw values for prohibited surfaces', () => {
    for (const surface of ['lock-screen', 'app-switcher', 'error', 'analytics', 'title'] as const) {
      expect(safeExternalSensitiveValue('4,200 EGP', surface)).toBe('****');
    }
  });
});
