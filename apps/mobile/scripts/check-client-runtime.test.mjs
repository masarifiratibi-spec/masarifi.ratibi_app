import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';

import { validateClientBuildEnvironment } from './check-client-runtime.mjs';

const live = {
  NODE_ENV: 'production',
  EAS_BUILD_PROFILE: 'production',
  EXPO_PUBLIC_RELEASE_CHANNEL: 'production',
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.example.com',
  MASARIFI_PRODUCTION_API_ORIGIN: 'https://api.example.com',
  MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN: 'clerk.example.com',
  MASARIFI_RELEASE_VERSION_NAME: '1.2.3',
  EXPO_PUBLIC_APP_LOCK_ENABLED: 'true',
  EXPO_PUBLIC_DEMO_MODE: '0',
  EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED: 'false',
  EXPO_PUBLIC_VOICE_TIMING_ENABLED: 'false',
  EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: 'false',
  EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: 'false',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.example.com$').toString('base64url')}`
};

test('accepts the free-only production client environment', () => {
  assert.doesNotThrow(() => validateClientBuildEnvironment(live));
});

test('rejects demo mode and every secret-shaped public variable', () => {
  assert.throws(
    () =>
      validateClientBuildEnvironment({
        ...live,
        EXPO_PUBLIC_CLIENT_MODE: 'demo'
      }),
    /live client mode/
  );
  assert.throws(
    () =>
      validateClientBuildEnvironment({
        ...live,
        EXPO_PUBLIC_PROVIDER_SECRET: 'leak'
      }),
    /forbidden public secret/
  );
});

test('allows demo mode only for the development build profile', () => {
  assert.doesNotThrow(() =>
    validateClientBuildEnvironment({
      NODE_ENV: 'production',
      EAS_BUILD_PROFILE: 'development',
      EXPO_PUBLIC_CLIENT_MODE: 'demo'
    })
  );
  assert.throws(
    () =>
      validateClientBuildEnvironment({
        ...live,
        EXPO_PUBLIC_CLIENT_MODE: 'demo'
      }),
    /live client mode/
  );
});

const privacy = {
  ...live,
  EAS_BUILD_PROFILE: 'development-staging-privacy',
  MASARIFI_APP_VARIANT: 'staging-development-privacy',
  EXPO_PUBLIC_APP_VARIANT: 'staging-development-privacy',
  EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com/dev-privacy',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bWFzYXJpZmkudGVzdCQ'
};

test('allows an optimized isolated privacy development client with a Development key', () => {
  assert.doesNotThrow(() => validateClientBuildEnvironment(privacy));
});

test('rejects partially configured privacy clients even in non-production builds', () => {
  for (const NODE_ENV of ['development', 'production']) {
    for (const changes of [
      { EXPO_PUBLIC_API_URL: live.EXPO_PUBLIC_API_URL },
      { EXPO_PUBLIC_API_URL: privacy.EXPO_PUBLIC_API_URL + '/' },
      { EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' },
      { MASARIFI_APP_VARIANT: 'staging-development' },
      { EXPO_PUBLIC_APP_VARIANT: undefined },
      { EXPO_PUBLIC_CLIENT_MODE: 'demo' },
      { EAS_BUILD_PROFILE: 'production' },
      { EAS_BUILD_PROFILE: undefined },
      {
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
          live.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
      },
      { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined },
      { EXPO_PUBLIC_PROVIDER_SECRET: 'forbidden' }
    ]) {
      assert.throws(() =>
        validateClientBuildEnvironment({ ...privacy, NODE_ENV, ...changes })
      );
    }
  }
  assert.throws(
    () =>
      validateClientBuildEnvironment({
        ...live,
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
          privacy.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
      }),
    /live publishable key/
  );
});

test('unmarked development environments cannot bypass privacy isolation through URL normalization', () => {
  for (const path of [
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
  ]) {
    assert.throws(
      () =>
        validateClientBuildEnvironment({
          NODE_ENV: 'development',
          EXPO_PUBLIC_CLIENT_MODE: 'live',
          EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' + path,
          EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
            privacy.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
        }),
      /Privacy development/
    );
  }
});

test('rejects staging origin, disabled lock and enabled diagnostics in a production candidate', () => {
  for (const patch of [
    { EXPO_PUBLIC_API_URL: 'https://api.staging.example.com' },
    { EXPO_PUBLIC_APP_LOCK_ENABLED: 'false' },
    { EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED: 'true' },
    { EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: 'true' },
    { MASARIFI_RELEASE_VERSION_NAME: undefined }
  ])
    assert.throws(() => validateClientBuildEnvironment({ ...live, ...patch }));
});

test('an arbitrary profile cannot bypass production safeguards', () => {
  assert.throws(
    () =>
      validateClientBuildEnvironment({
        ...live,
        EAS_BUILD_PROFILE: 'anything',
        EXPO_PUBLIC_APP_LOCK_ENABLED: 'false'
      }),
    /unknown release build profile/
  );
});

test('binds the production Clerk key to its approved non-staging instance', () => {
  for (const patch of [
    { MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN: undefined },
    { MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN: 'clerk.other.example.com' },
    {
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.staging.example.com$').toString('base64url')}`,
      MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN: 'clerk.staging.example.com'
    },
    { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_not_a_frontend_identifier' }
  ])
    assert.throws(
      () => validateClientBuildEnvironment({ ...live, ...patch }),
      /approved production Clerk instance/
    );
});
