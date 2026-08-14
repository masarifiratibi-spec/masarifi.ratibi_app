import { nextSensitiveState } from './privacy';

describe('privacy transitions', () => {
  it('allows in-app reveal and resets on background or lock', () => {
    expect(nextSensitiveState('masked', 'authorize', 'in-app')).toBe('revealed');
    expect(nextSensitiveState('revealed', 'background', 'in-app')).toBe('masked');
    expect(nextSensitiveState('revealed', 'app_lock', 'in-app')).toBe('masked');
  });

  it('never reveals prohibited external surfaces', () => {
    for (const surface of ['lock-screen', 'app-switcher', 'error', 'analytics'] as const) {
      expect(nextSensitiveState('masked', 'authorize', surface)).toBe('masked');
    }
  });
});
