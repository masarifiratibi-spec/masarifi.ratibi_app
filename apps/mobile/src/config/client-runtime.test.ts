import {
  resolveClientRuntime,
  isAppLockEnabled,
  isDevPrivacyDeletionEnabled,
  devPrivacyDeletionApiUrl
} from './client-runtime';

const liveEnvironment = {
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.masarifi.test',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bWFzYXJpZmkudGVzdCQ'
};
const devAppLockRuntime = {
  development: true,
  nodeEnvironment: 'development',
  applicationId: 'com.masarifi.mobile.dev'
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
      }, { ...devAppLockRuntime, applicationId: 'com.masarifi.mobile.dev.privacy' })
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
        }, { ...devAppLockRuntime, applicationId: 'com.masarifi.mobile.dev.privacy' })
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
    ).toBe(true);
  });

  it('suppresses optional App Lock only in the actual identified DEV development runtime', () => {
    const environment = {
      ...liveEnvironment,
      EXPO_PUBLIC_APP_VARIANT: 'staging-development',
      EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com',
      EXPO_PUBLIC_APP_LOCK_ENABLED: 'false'
    };
    expect(isAppLockEnabled(environment, devAppLockRuntime)).toBe(false);
    for (const runtime of [
      { ...devAppLockRuntime, development: false },
      { ...devAppLockRuntime, nodeEnvironment: 'production' },
      { ...devAppLockRuntime, applicationId: 'com.masarifi.mobile' },
      { ...devAppLockRuntime, applicationId: null }
    ]) expect(isAppLockEnabled(environment, runtime)).toBe(true);
    for (const changes of [
      { EXPO_PUBLIC_APP_VARIANT: undefined },
      { EXPO_PUBLIC_CLIENT_MODE: 'demo' },
      { EXPO_PUBLIC_API_URL: environment.EXPO_PUBLIC_API_URL + '/' },
      { EXPO_PUBLIC_API_URL: environment.EXPO_PUBLIC_API_URL + '?test=1' },
      { EXPO_PUBLIC_API_URL: 'https://api.masarifiratibi.com' }
    ]) expect(isAppLockEnabled({ ...environment, ...changes }, devAppLockRuntime)).toBe(true);
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


describe('Staging account deletion completion admission', () => {
  const original = { ...process.env };
  afterEach(() => {
    for (const key of Object.keys(process.env))
      if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });
  it.each([
    ['staging-development', 'https://api.staging.masarifiratibi.com', true],
    ['staging-development-privacy', 'https://api.staging.masarifiratibi.com/dev-privacy', true],
    [undefined, 'https://api.staging.masarifiratibi.com', true],
    [undefined, 'https://api.masarifiratibi.com', false],
    ['production', 'https://api.staging.masarifiratibi.com', false],
    ['staging-development', 'https://api.masarifiratibi.com', false],
  ])('enables the completion flow for qualified Staging clients %s %s', (variant, url, expected) => {
    process.env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_bWFzYXJpZmkudGVzdCQ';
    if (variant) process.env.EXPO_PUBLIC_APP_VARIANT = variant;
    else delete process.env.EXPO_PUBLIC_APP_VARIANT;
    process.env.EXPO_PUBLIC_API_URL = url;
    expect(isDevPrivacyDeletionEnabled()).toBe(expected);
    if (expected && variant === undefined)
      expect(devPrivacyDeletionApiUrl()).toBe(url + '/account-deletion');
  });
});


describe('identified DEV native App Lock policy', () => {
  const devEnvironment = { EXPO_PUBLIC_CLIENT_MODE: 'live', EXPO_PUBLIC_APP_VARIANT: 'staging-development', EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' };
  it.each([undefined, 'true', 'false'])('suppresses optional DEV prompts without relying on public flag %s', (flag) => {
    expect(isAppLockEnabled({ ...devEnvironment, EXPO_PUBLIC_APP_LOCK_ENABLED: flag }, devAppLockRuntime)).toBe(false);
  });
  it.each([
    { ...devAppLockRuntime, development: false },
    { ...devAppLockRuntime, nodeEnvironment: 'production' },
    { ...devAppLockRuntime, applicationId: 'com.masarifi.mobile' },
    { ...devAppLockRuntime, applicationId: null }
  ])('retains the release gate when DEV identity is incomplete: %j', (runtime) => {
    expect(isAppLockEnabled({ ...devEnvironment, EXPO_PUBLIC_APP_LOCK_ENABLED: 'false' }, runtime)).toBe(true);
  });
});


it.each([
  ['com.masarifi.mobile.dev.privacy', 'staging-development-privacy', 'https://api.staging.masarifiratibi.com/dev-privacy', false],
  ['com.masarifi.mobile.dev', 'staging-development-privacy', 'https://api.staging.masarifiratibi.com/dev-privacy', true],
  ['com.masarifi.mobile.dev.privacy', 'staging-development', 'https://api.staging.masarifiratibi.com', true]
])('binds DEV prompt suppression to matching package and API (%s / %s)', (applicationId, variant, apiUrl, expected) => {
  expect(isAppLockEnabled({ EXPO_PUBLIC_CLIENT_MODE: 'live', EXPO_PUBLIC_APP_VARIANT: String(variant), EXPO_PUBLIC_API_URL: String(apiUrl) }, { development: true, nodeEnvironment: 'development', applicationId: String(applicationId) })).toBe(expected);
});
