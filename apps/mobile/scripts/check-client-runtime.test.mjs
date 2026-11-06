import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { URL } from 'node:url';

import { validateClientBuildEnvironment } from './check-client-runtime.mjs';

const retainedClerkDomain = 'clerk.staging.masarifiratibi.com';
const live = {
  NODE_ENV: 'production',
  EAS_BUILD_PROFILE: 'production',
  EXPO_PUBLIC_RELEASE_CHANNEL: 'production',
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.example.com',
  MASARIFI_PRODUCTION_API_ORIGIN: 'https://api.example.com',
  MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN: retainedClerkDomain,
  MASARIFI_RELEASE_VERSION_NAME: '1.2.3',
  EXPO_PUBLIC_APP_LOCK_ENABLED: 'true',
  EXPO_PUBLIC_DEMO_MODE: '0',
  EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED: 'false',
  EXPO_PUBLIC_VOICE_TIMING_ENABLED: 'false',
  EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: 'false',
  EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: 'false',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from(`${retainedClerkDomain}$`).toString('base64url')}`
};

const iosAdHoc = {
  ...live,
  EAS_BUILD_PROFILE: 'ios-ad-hoc',
  EAS_BUILD_PLATFORM: 'ios'
};

test('the pre-install CLI enforces release checks from an absolute path containing URL-sensitive characters', () => {
  const scratchRoot = resolve(tmpdir());
  const fixture = mkdtempSync(join(scratchRoot, 'masarifi#ios-cli-'));
  const scripts = join(fixture, 'scripts');
  mkdirSync(scripts);
  try {
    for (const name of [
      'check-client-runtime.mjs',
      'benchmark-build-policy.cjs',
      'performance-qa-exclusion.cjs'
    ]) {
      copyFileSync(new URL(name, import.meta.url), join(scripts, name));
    }
    copyFileSync(
      new URL('../app.json', import.meta.url),
      join(fixture, 'app.json')
    );
    const run = (patch) =>
      spawnSync(process.execPath, [join(scripts, 'check-client-runtime.mjs')], {
        env: { ...process.env, ...iosAdHoc, ...patch },
        encoding: 'utf8'
      });
    assert.equal(run({}).status, 0);
    const rejected = run({ EAS_BUILD_PLATFORM: 'android' });
    assert.notEqual(
      rejected.status,
      0,
      'the actual CLI must run its validator'
    );
    assert.match(
      rejected.stderr,
      /iPhone Ad Hoc requires the ios build platform/
    );
  } finally {
    if (dirname(fixture) !== scratchRoot)
      throw new Error('Unexpected fixture directory');
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('accepts a standalone iPhone candidate with the retained production identity', () => {
  assert.doesNotThrow(() => validateClientBuildEnvironment(iosAdHoc));
});

test('iPhone profile cannot target Android or bypass production checks outside NODE_ENV=production', () => {
  for (const NODE_ENV of ['production', 'development', undefined]) {
    for (const patch of [
      { EAS_BUILD_PLATFORM: 'android' },
      { EAS_BUILD_PLATFORM: undefined },
      { EXPO_PUBLIC_APP_LOCK_ENABLED: 'false' },
      { EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: 'true' },
      { EXPO_PUBLIC_API_URL: 'https://api.staging.example.com' },
      { MASARIFI_RELEASE_VERSION_NAME: undefined }
    ]) {
      assert.throws(() =>
        validateClientBuildEnvironment({ ...iosAdHoc, NODE_ENV, ...patch })
      );
    }
  }
});

test('iPhone profile rejects a different bundle while retaining the Android and EAS identity checks', () => {
  const identity = {
    android: { package: 'com.masarifi.mobile' },
    ios: { bundleIdentifier: 'com.masarifi.mobile' },
    extra: { eas: { projectId: 'c8cc3dd3-a7e9-4737-ac4d-32f076107600' } }
  };
  assert.doesNotThrow(() => validateClientBuildEnvironment(iosAdHoc, identity));
  for (const patch of [
    { ios: { bundleIdentifier: 'com.masarifi.mobile.dev' } },
    { ios: undefined },
    { android: { package: 'com.masarifi.mobile.dev' } },
    { extra: { eas: { projectId: 'different' } } }
  ]) {
    assert.throws(() =>
      validateClientBuildEnvironment(iosAdHoc, { ...identity, ...patch })
    );
  }
});

test('accepts the free-only production client environment', () => {
  assert.doesNotThrow(() => validateClientBuildEnvironment(live));
});

test('accepts the retained production Clerk instance despite its legacy domain name', () => {
  const domain = 'clerk.staging.masarifiratibi.com';
  for (const EAS_BUILD_PROFILE of ['production', undefined])
    assert.doesNotThrow(() =>
      validateClientBuildEnvironment({
        ...live,
        EAS_BUILD_PROFILE,
        MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN: domain,
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from(`${domain}$`).toString('base64url')}`
      })
    );
});

test('production cannot silently switch to a different live Clerk instance', () => {
  const domain = 'clerk.other.example.com';
  assert.throws(
    () =>
      validateClientBuildEnvironment({
        ...live,
        MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN: domain,
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from(`${domain}$`).toString('base64url')}`
      }),
    /approved production Clerk instance/
  );
});

test('retained production identity requires the customer package and EAS project', () => {
  const identity = {
    android: { package: 'com.masarifi.mobile' },
    extra: { eas: { projectId: 'c8cc3dd3-a7e9-4737-ac4d-32f076107600' } }
  };
  assert.doesNotThrow(() => validateClientBuildEnvironment(live, identity));
  for (const other of [
    { ...identity, android: { package: 'com.masarifi.mobile.dev' } },
    { ...identity, android: { package: 'com.masarifi.mobile.benchmark' } },
    { ...identity, extra: { eas: { projectId: 'another-project' } } },
    { ...identity, extra: {} },
    {}
  ])
    assert.throws(
      () => validateClientBuildEnvironment(live, other),
      /approved production Clerk instance/
    );
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

test('binds the production Clerk key to its approved retained instance', () => {
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
