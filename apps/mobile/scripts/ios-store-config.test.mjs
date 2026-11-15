import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import test from 'node:test';
import { validateClientBuildEnvironment } from './check-client-runtime.mjs';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const { isLiveProduction } = require('./production-entrypoints.cjs');
const app = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url))
).expo;
const builds = JSON.parse(
  readFileSync(new URL('../eas.json', import.meta.url))
).build;
const storeEnvironment = {
  ...builds.production.env,
  ...builds['ios-ad-hoc'].env,
  MASARIFI_IOS_AD_HOC: undefined,
  MASARIFI_IOS_APP_STORE: 'true',
  MASARIFI_RELEASE_VERSION_NAME: '1.0.0',
  EAS_BUILD_PROFILE: 'ios-app-store',
  EAS_BUILD_PLATFORM: 'ios'
};

function resolvedConfig(environment) {
  const previous = { ...process.env };
  try {
    for (const name of Object.keys(process.env))
      if (
        name.startsWith('MASARIFI_') ||
        name.startsWith('EXPO_PUBLIC_') ||
        ['NODE_ENV', 'EAS_BUILD_PROFILE', 'EAS_BUILD_PLATFORM'].includes(name)
      )
        delete process.env[name];
    for (const [name, value] of Object.entries(environment))
      if (value !== undefined) process.env[name] = value;
    return configure({ config: JSON.parse(JSON.stringify(app)) });
  } finally {
    for (const name of Object.keys(process.env))
      if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
}

test('App Store config resolves its release version and native Clerk binding before NODE_ENV exists', () => {
  const config = resolvedConfig(storeEnvironment);
  assert.equal(config.version, '1.0.0');
  assert.equal(config.ios.bundleIdentifier, 'com.masarifi.mobile');
  assert.equal(config.scheme, 'masarifi');
  assert.deepEqual(config.android, app.android);
  assert.ok(
    config.plugins.some(
      (plugin) => Array.isArray(plugin) && plugin[0] === '@clerk/expo'
    )
  );
  const {
    EAS_BUILD_PROFILE: _profile,
    EAS_BUILD_PLATFORM: _platform,
    ...localEnvironment
  } = storeEnvironment;
  assert.equal(resolvedConfig(localEnvironment).version, '1.0.0');
});

test('both physical iPhone profiles use matching production bindings and the SDK55 image', () => {
  const adhoc = builds['ios-ad-hoc'];
  const store = builds['ios-app-store'];
  assert.ok(store, 'a separate App Store profile is required');
  assert.equal(store.distribution, 'store');
  assert.equal(adhoc.distribution, 'internal');
  for (const profile of [adhoc, store]) {
    assert.equal(profile.extends, 'production');
    assert.equal(profile.developmentClient, false);
    assert.equal(profile.ios.simulator, false);
    assert.equal(profile.ios.image, 'macos-sequoia-15.6-xcode-26.2');
    assert.equal(profile.env.MASARIFI_RELEASE_VERSION_NAME, '1.0.0');
    const environment = {
      ...builds.production.env,
      ...profile.env,
      EAS_BUILD_PROFILE: profile === store ? 'ios-app-store' : 'ios-ad-hoc',
      EAS_BUILD_PLATFORM: 'ios'
    };
    assert.doesNotThrow(() => validateClientBuildEnvironment(environment));
    assert.equal(
      environment.EXPO_PUBLIC_API_URL,
      'https://api.masarifiratibi.com'
    );
    assert.equal(environment.EXPO_PUBLIC_APP_VARIANT, 'production');
  }
  const { MASARIFI_IOS_AD_HOC: _adhocMarker, ...adhocBindings } = adhoc.env;
  const { MASARIFI_IOS_APP_STORE: _storeMarker, ...storeBindings } = store.env;
  assert.deepEqual(storeBindings, adhocBindings);
});

test('App Store release always selects real production providers', () => {
  assert.equal(isLiveProduction(storeEnvironment), true);
  assert.equal(
    isLiveProduction({ ...storeEnvironment, EXPO_PUBLIC_CLIENT_MODE: 'demo' }),
    false
  );
});

for (const NODE_ENV of [undefined, 'development', 'production']) {
  test(`App Store runtime enforces production admission with NODE_ENV=${NODE_ENV}`, () => {
    assert.doesNotThrow(() =>
      validateClientBuildEnvironment({ ...storeEnvironment, NODE_ENV })
    );
    for (const patch of [
      { EAS_BUILD_PLATFORM: 'android' },
      { EAS_BUILD_PLATFORM: undefined },
      { EXPO_PUBLIC_APP_LOCK_ENABLED: 'false' },
      { EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' },
      { EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: 'true' },
      { MASARIFI_RELEASE_VERSION_NAME: undefined }
    ])
      assert.throws(() =>
        validateClientBuildEnvironment({
          ...storeEnvironment,
          NODE_ENV,
          ...patch
        })
      );
    assert.throws(() =>
      validateClientBuildEnvironment(
        { ...storeEnvironment, NODE_ENV },
        {
          ...app,
          ios: { ...app.ios, bundleIdentifier: 'com.masarifi.mobile.dev' }
        }
      )
    );
  });
}

test('App Store marker cannot enter Android, another profile or the Ad Hoc marker namespace', () => {
  for (const patch of [
    { EAS_BUILD_PLATFORM: 'android' },
    { EAS_BUILD_PROFILE: 'production' },
    { EAS_BUILD_PROFILE: 'ios-ad-hoc' },
    { MASARIFI_IOS_AD_HOC: 'true' }
  ])
    assert.throws(() => resolvedConfig({ ...storeEnvironment, ...patch }));
});
