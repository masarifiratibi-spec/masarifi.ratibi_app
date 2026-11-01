import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { validateClientBuildEnvironment } from './check-client-runtime.mjs';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const app = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url))
).expo;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url)));
const environment = () => ({
  ...eas.build.benchmark?.env,
  NODE_ENV: 'production',
  EAS_BUILD_PROFILE: 'benchmark',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.staging.masarifiratibi.com$').toString('base64url')}`
});
function withEnvironment(values, operation) {
  const old = { ...process.env };
  try {
    Object.assign(process.env, values);
    return operation();
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in old)) delete process.env[key];
    Object.assign(process.env, old);
  }
}
test('benchmark is a standalone isolated Release with its registered Firebase client and one callback', () => {
  assert.ok(eas.build.benchmark, 'benchmark profile is required');
  const profile = eas.build.benchmark;
  assert.equal(profile.developmentClient, false);
  assert.equal(profile.distribution, 'internal');
  assert.equal(profile.environment, 'preview');
  assert.equal(profile.node, '24.16.0');
  assert.deepEqual(profile.android, { buildType: 'apk' });
  assert.equal(profile.autoIncrement, false);
  withEnvironment(environment(), () => {
    const config = configure({ config: structuredClone(app) });
    assert.equal(config.name, 'Masarifi Benchmark');
    assert.equal(config.android.package, 'com.masarifi.mobile.benchmark');
    assert.equal(config.ios.bundleIdentifier, 'com.masarifi.mobile.benchmark');
    assert.equal(config.scheme, 'masarifi-benchmark');
    assert.equal(
      config.android.googleServicesFile,
      './google-services.benchmark.json'
    );
    const firebase = JSON.parse(
      readFileSync(
        new URL('../google-services.benchmark.json', import.meta.url)
      )
    );
    assert.equal(firebase.project_info.project_id, 'masarifi-staging');
    assert.deepEqual(
      firebase.client.map(
        (x) => x.client_info.android_client_info.package_name
      ),
      ['com.masarifi.mobile.benchmark']
    );
    assert.deepEqual(
      config.plugins.filter(
        (x) => (Array.isArray(x) ? x[0] : x) === 'expo-dev-client'
      ),
      [['expo-dev-client', { addGeneratedScheme: false }]]
    );
    assert.equal(config.extra.eas.projectId, app.extra.eas.projectId);
  });
});
test('benchmark requires indivisible markers, exact API and Staging live Clerk instance even outside production', () => {
  const good = environment();
  assert.doesNotThrow(() => validateClientBuildEnvironment(good));
  for (const patch of [
    { MASARIFI_APP_VARIANT: undefined },
    { EXPO_PUBLIC_APP_VARIANT: undefined },
    { EAS_BUILD_PROFILE: 'preview' },
    { EXPO_PUBLIC_BENCHMARK_READ_ONLY: 'false' },
    { EXPO_PUBLIC_RELEASE_CHANNEL: 'production' },
    { EXPO_PUBLIC_CLIENT_MODE: 'demo' },
    { EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com/' },
    {
      EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com/dev-privacy'
    },
    { EXPO_PUBLIC_API_URL: 'https://api.example.com' },
    {
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from('clerk.other.example.com$').toString('base64url')}`
    },
    { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_validbutwrong' },
    { EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED: 'true' },
    { EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING: 'true' },
    { EXPO_PUBLIC_APP_LOCK_ENABLED: 'false' },
    { EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: 'true' },
    { EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: 'true' }
  ])
    for (const NODE_ENV of ['production', 'development']) {
      const invalid = { ...good, ...patch, NODE_ENV };
      assert.throws(
        () => validateClientBuildEnvironment(invalid),
        /benchmark/i
      );
      withEnvironment(
        Object.fromEntries(
          Object.entries(invalid).map(([k, v]) => [k, v ?? ''])
        ),
        () =>
          assert.throws(
            () => configure({ config: structuredClone(app) }),
            /benchmark/i
          )
      );
    }
});
