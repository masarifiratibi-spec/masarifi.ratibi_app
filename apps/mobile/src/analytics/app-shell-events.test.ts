import {
  appShellEventNames,
  createAppShellEvent,
  recordAppShellEvent
} from './app-shell-events';

describe('app-shell analytics boundary', () => {
  it('defines stable event names for shell journeys', () => {
    expect(appShellEventNames).toEqual([
      'app_shell.auth',
      'app_shell.onboarding',
      'app_shell.permission',
      'app_shell.navigation',
      'app_shell.security'
    ]);
  });

  it('records non-sensitive frontend events as a no-op success', () => {
    const event = createAppShellEvent('app_shell.permission', {
      status: 'denied',
      route: '/(onboarding)/android-sms-permission'
    });

    expect(recordAppShellEvent(event)).toBe(true);
  });

  it.each(['phone', 'otp', 'pin', 'message', 'accountId', 'identifier', 'amount'])(
    'rejects sensitive payload key %s',
    (key) => {
      expect(() =>
        createAppShellEvent('app_shell.auth', {
          [key]: 'sensitive'
        })
      ).toThrow('Sensitive analytics payload');
    }
  );
});
