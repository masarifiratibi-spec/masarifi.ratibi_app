import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
const configPath = new URL('../app.config.js', import.meta.url);
const configure = existsSync(configPath) ? require(fileURLToPath(configPath)) : ({ config }) => config;
const staging = {
  MASARIFI_APP_VARIANT: 'staging-development',
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com'
};

function withEnvironment(values, operation) {
  const keys = [...new Set([...Object.keys(staging), 'EAS_BUILD_PROFILE', 'EXPO_PUBLIC_APP_VARIANT', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'])];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    return operation();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('ordinary builds preserve their existing identity and Firebase configuration', () => {
  withEnvironment({}, () => assert.deepEqual(configure({ config: JSON.parse(JSON.stringify(app.expo)) }), app.expo));
});

test('Staging development installs beside the accepted app with independent links and storage', () => {
  withEnvironment(staging, () => {
    const config = configure({ config: JSON.parse(JSON.stringify(app.expo)) });
    assert.equal(config.android.package, 'com.masarifi.mobile.dev');
    assert.equal(config.ios.bundleIdentifier, 'com.masarifi.mobile.dev');
    assert.equal(config.name, 'Masarifi Ratibi Dev');
    assert.equal(config.scheme, 'masarifi-dev');
    assert.equal(config.android.googleServicesFile, './google-services.dev.json');
    const firebase = JSON.parse(readFileSync(new URL(`../${config.android.googleServicesFile}`, import.meta.url)));
    assert.deepEqual(firebase.client.map(client => client.client_info.android_client_info.package_name), [config.android.package]);
    assert.deepEqual(config.plugins.slice(0, app.expo.plugins.length), app.expo.plugins);
    assert.deepEqual(config.plugins.at(-1), ['expo-dev-client', { addGeneratedScheme: false }]);
    assert.deepEqual(config.android.permissions, app.expo.android.permissions);
    assert.equal(app.expo.android.package, 'com.masarifi.mobile');
  });
});

test('a development identity cannot be built against Production or fixture mode', () => {
  for (const changes of [
    { EXPO_PUBLIC_API_URL: 'https://api.masarifiratibi.com' },
    { EXPO_PUBLIC_CLIENT_MODE: 'demo' },
    { EAS_BUILD_PROFILE: 'production' },
    { EAS_BUILD_PROFILE: 'preview' }
  ]) {
    withEnvironment({ ...staging, ...changes }, () => {
      assert.throws(() => configure({ config: JSON.parse(JSON.stringify(app.expo)) }), /Staging development/);
    });
  }
});

test('an unknown variant cannot silently generate the ordinary package', () => {
  withEnvironment({ ...staging, MASARIFI_APP_VARIANT: 'typo' }, () => {
    assert.throws(() => configure({ config: JSON.parse(JSON.stringify(app.expo)) }), /Unknown app variant/);
  });
});

const privacy = {
  MASARIFI_APP_VARIANT: 'staging-development-privacy',
  EXPO_PUBLIC_APP_VARIANT: 'staging-development-privacy',
  EAS_BUILD_PROFILE: 'development-staging-privacy',
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com/dev-privacy',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bWFzYXJpZmkudGVzdCQ'
};

test('privacy development has an independent package, scheme and display name', () => {
  withEnvironment(privacy, () => {
    const config = configure({ config: JSON.parse(JSON.stringify(app.expo)) });
    assert.equal(config.android.package, 'com.masarifi.mobile.dev.privacy');
    assert.equal(config.ios.bundleIdentifier, 'com.masarifi.mobile.dev.privacy');
    assert.equal(config.scheme, 'masarifi-dev-privacy');
    assert.equal(config.name, 'Masarifi Ratibi Dev Privacy');
    assert.equal(config.android.googleServicesFile, undefined);
    assert.deepEqual(config.plugins.slice(0, app.expo.plugins.length), app.expo.plugins);
    assert.deepEqual(config.plugins.at(-1), ['expo-dev-client', { addGeneratedScheme: false }]);
    assert.equal(app.expo.android.package, 'com.masarifi.mobile');
  });
});

test('privacy package requires its exact Staging path, test key, variant markers and build profile', () => {
  for (const changes of [
    { EXPO_PUBLIC_API_URL: 'https://api.masarifiratibi.com/dev-privacy' },
    { EXPO_PUBLIC_API_URL: staging.EXPO_PUBLIC_API_URL },
    { EXPO_PUBLIC_API_URL: privacy.EXPO_PUBLIC_API_URL + '/extra' },
    { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_bWFzYXJpZmkudGVzdCQ' },
    { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined },
    { EXPO_PUBLIC_CLIENT_MODE: 'demo' },
    { MASARIFI_APP_VARIANT: undefined },
    { MASARIFI_APP_VARIANT: 'staging-development' },
    { EXPO_PUBLIC_APP_VARIANT: undefined },
    { EXPO_PUBLIC_APP_VARIANT: 'staging-development' },
    { EAS_BUILD_PROFILE: 'production' },
    { EAS_BUILD_PROFILE: 'development-staging' },
    { EAS_BUILD_PROFILE: undefined }
  ]) {
    withEnvironment({ ...privacy, ...changes }, () => {
      assert.throws(() => configure({ config: JSON.parse(JSON.stringify(app.expo)) }), /Privacy development/);
    });
  }
});

test('an unmarked ordinary package cannot use normalized spellings of the reserved privacy API namespace', () => {
  for (const path of ['/dev-privacy/', '/dev-privacy?probe=1', '/dev-privacy#fragment', '/dev-privacy/extra', '/%64ev-privacy', '/dev%2dprivacy', '//dev-privacy', '/outer%2f..%2fdev-privacy', '/dev-privacy%2fextra', '/%2564ev-privacy', '/dev-privacy%2f%25', '/dev-privacy/%ZZ', '/%25252564ev-privacy', '/outer%23segment%2f..%2fdev-privacy', '/outer%3fsegment%2f..%2fdev-privacy']) {
    withEnvironment({
      EXPO_PUBLIC_CLIENT_MODE: 'live',
      EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com' + path,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: privacy.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
    }, () => {
      assert.throws(() => configure({ config: JSON.parse(JSON.stringify(app.expo)) }), /Privacy development/);
    });
  }
});
