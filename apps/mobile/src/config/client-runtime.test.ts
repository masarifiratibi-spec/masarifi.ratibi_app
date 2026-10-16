import { resolveClientRuntime, isAppLockEnabled } from './client-runtime';

const liveEnvironment = {
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.masarifi.test',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bWFzYXJpZmkudGVzdCQ'
};

describe('Mobile client runtime policy', () => {
  const privacyEnvironment = {
    ...liveEnvironment,
    EXPO_PUBLIC_APP_VARIANT: 'staging-development-privacy',
    EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com/dev-privacy'
  };

  it('allows disabling App Lock only for the exact privacy API with its matching public variant', () => {
    expect(
      isAppLockEnabled({
        ...privacyEnvironment,
        EXPO_PUBLIC_APP_LOCK_ENABLED: 'false'
      })
    ).toBe(false);
    for (const changes of [
      { EXPO_PUBLIC_APP_VARIANT: undefined },
      { EXPO_PUBLIC_APP_VARIANT: 'staging-development' },
      { EXPO_PUBLIC_API_URL: 'https://api.masarifiratibi.com/dev-privacy' },
      { EXPO_PUBLIC_API_URL: privacyEnvironment.EXPO_PUBLIC_API_URL + '/' }
    ]) {
      expect(
        isAppLockEnabled({
          ...privacyEnvironment,
          ...changes,
          EXPO_PUBLIC_APP_LOCK_ENABLED: 'false'
        })
      ).toBe(true);
    }
    expect(isAppLockEnabled(privacyEnvironment)).toBe(true);
  });

  it.each([
    '/dev-privacy/',
    '/dev-privacy?probe=1',
    '/dev-privacy#fragment',
    '/dev-privacy/extra',
    '/%64ev-privacy',
    '/dev%2dprivacy',
    '//dev-privacy',
    '/outer%2f..%2fdev-privacy',
    '/dev-privacy%2fextra',
    '/%2564ev-privacy',
    '/dev-privacy%2f%25',
    '/dev-privacy/%ZZ',
    '/%25252564ev-privacy',
    '/outer%23segment%2f..%2fdev-privacy',
    '/outer%3fsegment%2f..%2fdev-privacy'
  ])(
    'rejects an unmarked development runtime targeting the normalized privacy namespace %s',
    (path) => {
      expect(() =>
        resolveClientRuntime(
          {
            ...liveEnvironment,
            EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' + path
          },
          'development'
        )
      ).toThrow('privacy development');
    }
  );

  it('reserves normalized privacy paths with the installed native URL implementation too', () => {
    const originalUrl = globalThis.URL;
    const nativeUrl = jest.requireActual<{ URL: typeof URL }>(
      'react-native/Libraries/Blob/URL'
    ).URL;
    globalThis.URL = nativeUrl;
    try {
      for (const path of [
        '/outer%2f..%2fdev-privacy',
        '//dev-privacy',
        '/%64ev-privacy',
        '/outer%23segment%2f..%2fdev-privacy'
      ]) {
        expect(() =>
          resolveClientRuntime(
            {
              ...liveEnvironment,
              EXPO_PUBLIC_API_URL:
                'https://api.staging.masarifiratibi.com' + path
            },
            'development'
          )
        ).toThrow('privacy development');
      }
      expect(
        resolveClientRuntime(privacyEnvironment, 'production').apiUrl
      ).toBe(privacyEnvironment.EXPO_PUBLIC_API_URL);
    } finally {
      globalThis.URL = originalUrl;
    }
  });

  it('permits a test key in an optimized bundle only for the explicit isolated privacy variant', () => {
    expect(
      resolveClientRuntime(privacyEnvironment, 'production')
    ).toMatchObject({
      apiUrl: privacyEnvironment.EXPO_PUBLIC_API_URL,
      clerkPublishableKey: liveEnvironment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      mode: 'live'
    });
  });

  it.each([
    { EXPO_PUBLIC_APP_VARIANT: undefined },
    { EXPO_PUBLIC_APP_VARIANT: 'staging-development' },
    { EXPO_PUBLIC_API_URL: 'https://api.masarifiratibi.com/dev-privacy' },
    { EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' },
    {
      EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com/dev-privacy/'
    },
    { EXPO_PUBLIC_CLIENT_MODE: 'demo' },
    { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_bWFzYXJpZmkudGVzdCQ' }
  ])('rejects an unsafe privacy runtime configuration %j', (changes) => {
    expect(() =>
      resolveClientRuntime({ ...privacyEnvironment, ...changes }, 'production')
    ).toThrow();
  });

  it('keeps App Lock enabled by default and refuses disabling it against Production', () => {
    expect(isAppLockEnabled({})).toBe(true);
    expect(
      isAppLockEnabled({
        EXPO_PUBLIC_APP_LOCK_ENABLED: 'false',
        EXPO_PUBLIC_API_URL: 'https://api.masarifiratibi.com'
      })
    ).toBe(true);
    expect(
      isAppLockEnabled({
        EXPO_PUBLIC_APP_LOCK_ENABLED: 'false',
        EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com'
      })
    ).toBe(false);
  });
  it('starts unconfigured development builds in demo mode', () => {
    expect(resolveClientRuntime({}, 'development').mode).toBe('demo');
  });

  it.each(['live', 'demo', 'test'] as const)(
    'accepts the explicit %s mode outside production',
    (mode) => {
      expect(
        resolveClientRuntime(
          mode === 'live' ? liveEnvironment : { EXPO_PUBLIC_CLIENT_MODE: mode },
          'development'
        ).mode
      ).toBe(mode);
    }
  );

  it.each(['demo', 'test'] as const)(
    'allows an explicit %s mode in a production-optimized development bundle',
    (mode) => {
      expect(
        resolveClientRuntime({ EXPO_PUBLIC_CLIENT_MODE: mode }, 'production')
          .mode
      ).toBe(mode);
    }
  );

  it('requires a valid HTTPS API URL in live mode', () => {
    expect(() =>
      resolveClientRuntime(
        { ...liveEnvironment, EXPO_PUBLIC_API_URL: undefined },
        'development'
      )
    ).toThrow('valid HTTPS API URL');
    expect(() =>
      resolveClientRuntime(
        { ...liveEnvironment, EXPO_PUBLIC_API_URL: 'http://api.masarifi.test' },
        'development'
      )
    ).toThrow('valid HTTPS API URL');
  });

  it('requires a valid Clerk publishable key in live mode', () => {
    expect(() =>
      resolveClientRuntime(
        { ...liveEnvironment, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined },
        'development'
      )
    ).toThrow('valid Clerk publishable key');
    expect(() =>
      resolveClientRuntime(
        {
          ...liveEnvironment,
          EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_live_secret'
        },
        'development'
      )
    ).toThrow('valid Clerk publishable key');
    expect(() => resolveClientRuntime(liveEnvironment, 'production')).toThrow(
      'production Clerk publishable key'
    );
  });

  it.each([
    'EXPO_PUBLIC_OPENROUTER_API_KEY',
    'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'EXPO_PUBLIC_CLERK_SECRET_KEY',
    'EXPO_PUBLIC_STRIPE_SECRET_KEY'
  ])('rejects forbidden public secret variable %s', (name) => {
    expect(() =>
      resolveClientRuntime(
        { ...liveEnvironment, [name]: 'exposed' },
        'development'
      )
    ).toThrow('forbidden public secret variable');
  });

  it('rejects invalid mode values and keeps billing unavailable', () => {
    expect(() =>
      resolveClientRuntime(
        { ...liveEnvironment, EXPO_PUBLIC_CLIENT_MODE: 'preview' },
        'development'
      )
    ).toThrow('invalid client mode');
    expect(
      resolveClientRuntime(liveEnvironment, 'development').billingAvailable
    ).toBe(false);
  });
});
