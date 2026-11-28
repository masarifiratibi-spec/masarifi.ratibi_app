import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
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

for (const profile of ['ios-ad-hoc', 'ios-app-store']) {
  test(`${profile} supplies Arabic purpose strings for the existing iPhone permissions`, () => {
    const config = resolvedConfig({ ...builds.production.env, ...builds[profile].env });
    const path = config.locales?.ar;
    assert.equal(typeof path, 'string');
    const { ios } = JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
    for (const key of ['NSMicrophoneUsageDescription', 'NSFaceIDUsageDescription']) {
      assert.match(ios[key], /\p{Script=Arabic}/u);
      assert.match(config.ios.infoPlist[key], /[a-z]/i);
    }
  });
  const early = { ...builds.production.env, ...builds[profile].env };
  test(`${profile} marker alone selects and validates production before EAS context exists`, () => {
    assert.equal(isLiveProduction(early), true);
    assert.doesNotThrow(() => validateClientBuildEnvironment(early));
    assert.throws(() =>
      validateClientBuildEnvironment({
        ...early,
        EXPO_PUBLIC_CLIENT_MODE: 'demo'
      })
    );
  });
  for (const [name, changes] of Object.entries({
    android: { EAS_BUILD_PLATFORM: 'android' },
    otherProfile: { EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'ios' },
    bothMarkers: {
      MASARIFI_IOS_AD_HOC: 'true',
      MASARIFI_IOS_APP_STORE: 'true'
    },
    otherVariant: { EXPO_PUBLIC_APP_VARIANT: 'preview' },
    internalVariant: { MASARIFI_APP_VARIANT: 'staging-development' }
  }))
    test(`${profile} early marker rejects ${name} across all resolvers`, () => {
      const environment = { ...early, ...changes };
      assert.throws(() => resolvedConfig(environment));
      assert.throws(() => validateClientBuildEnvironment(environment));
      assert.throws(() => isLiveProduction(environment));
    });
}

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

for (const profile of ['ios-ad-hoc', 'ios-app-store']) {
  test(`${profile} uses a bounded launch logo instead of the legacy full-screen image`, () => {
    const config = resolvedConfig({
      ...builds.production.env,
      ...builds[profile].env,
      EAS_BUILD_PROFILE: profile,
      EAS_BUILD_PLATFORM: 'ios'
    });
    const splash = config.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
    );
    assert.ok(splash, 'Expected the supported iOS splash configuration plugin');
    assert.equal(splash[1].ios.image, app.splash.image);
    assert.equal(splash[1].ios.imageWidth, 144);
    assert.equal(splash[1].ios.resizeMode, 'contain');
    assert.equal(splash[1].ios.enableFullScreenImage_legacy, false);
    assert.equal(splash[1].android, undefined);
    assert.equal(splash[1].imageWidth, undefined);
    assert.deepEqual(config.android, app.android);
  });
}

test('the Store iPhone icon has an English default and an Arabic localization', () => {
  const config = resolvedConfig(storeEnvironment);
  assert.equal(config.ios.infoPlist.CFBundleDisplayName ?? config.name, 'Masrifi Ratibi');
  const { ios } = JSON.parse(readFileSync(new URL(`../${config.locales.ar}`, import.meta.url)));
  assert.equal(ios.CFBundleDisplayName, 'مصاريفي وراتبي');
  const production = resolvedConfig({
    ...builds.production.env,
    MASARIFI_RELEASE_VERSION_NAME: '1.0.0',
    EAS_BUILD_PROFILE: 'production'
  });
  assert.equal(production.name, app.name);
  assert.deepEqual(production.android, { ...app.android, googleServicesFile: './google-services.production.json' });
});

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

for (const [profile, marker] of [
  ['ios-ad-hoc', 'MASARIFI_IOS_AD_HOC'],
  ['ios-app-store', 'MASARIFI_IOS_APP_STORE']
]) {
  test(`${profile} generates Apple sign-in entitlements and localized native button support`, async () => {
    const config = resolvedConfig({
      ...storeEnvironment,
      MASARIFI_IOS_APP_STORE: undefined,
      EAS_BUILD_PROFILE: profile,
      [marker]: 'true'
    });
    assert.ok(
      config.plugins.includes('expo-apple-authentication'),
      'native Apple authentication plugin is required'
    );
    const { withPlugins } = require('expo/config-plugins');
    const native = withPlugins(
      {
        ...config,
        _internal: {
          projectRoot: fileURLToPath(new URL('../', import.meta.url))
        }
      },
      config.plugins.filter((plugin) =>
        ['@clerk/expo', 'expo-apple-authentication'].includes(
          Array.isArray(plugin) ? plugin[0] : plugin
        )
      )
    );
    const entitlements = await native.mods.ios.entitlements({
      ...native,
      modResults: {},
      modRequest: {}
    });
    assert.deepEqual(
      entitlements.modResults['com.apple.developer.applesignin'],
      ['Default']
    );
    const info = await native.mods.ios.infoPlist({
      ...native,
      modResults: {},
      modRequest: {}
    });
    assert.equal(info.modResults.CFBundleAllowMixedLocalizations, true);
    assert.deepEqual(config.android, app.android);
  });
}

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
