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
  const keys = [...new Set([...Object.keys(staging), 'EAS_BUILD_PROFILE'])];
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
    assert.equal(config.name, 'Masarifi Dev');
    assert.equal(config.scheme, 'masarifi-dev');
    assert.equal(config.android.googleServicesFile, undefined);
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
