import { mapAppShellError } from './app-shell-errors';

describe('mapAppShellError', () => {
  it.each([
    ['offline', 'appShell.error.offline', 'retry'],
    ['cancelled', 'appShell.error.cancelled', 'change_method'],
    ['expired', 'appShell.error.expired', 'restart'],
    ['rate_limited', 'appShell.error.rateLimited', 'wait'],
    ['permission_denied', 'appShell.error.permissionDenied', 'manual_fallback'],
    ['biometric_locked', 'appShell.error.biometricLocked', 'use_pin'],
    ['persistence_failed', 'appShell.error.persistenceFailed', 'retry'],
    ['something_else', 'appShell.error.unknown', 'retry']
  ])('maps %s to a stable recovery contract', (input, code, recoveryAction) => {
    expect(mapAppShellError(new Error(input))).toEqual({
      code,
      recoveryAction
    });
  });

  it('does not return raw provider messages to UI callers', () => {
    const mapped = mapAppShellError(new Error('OTP 123456 failed for +201234'));

    expect(JSON.stringify(mapped)).not.toContain('123456');
    expect(JSON.stringify(mapped)).not.toContain('+201234');
  });
});
