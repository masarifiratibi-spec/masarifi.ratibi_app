import { redirectSystemPath } from '@app/+native-intent';
test.each([true, false])(
  'native callbacks discard parameters on initial=%s',
  (initial) => {
    for (const scheme of ['masarifi', 'masarifi-dev', 'masarifi-benchmark'])
      for (const suffix of [
        '?code=private&state=nonce#token',
        '?error=access_denied&state=nonce',
        '?code=%C0',
        ''
      ])
        for (const route of [
          `${scheme}://sso-callback`,
          `${scheme}:///sso-callback`,
          `${scheme}://app/sso-callback`
        ])
          expect(redirectSystemPath({ path: route + suffix, initial })).toBe(
            '/'
          );
    expect(redirectSystemPath({ path: 'masarifi://reports', initial })).toBe(
      'masarifi://reports'
    );
  }
);
