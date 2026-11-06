import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const app = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url))
).expo;

test('iPhone profile selects live production providers even before NODE_ENV is set', () => {
  const { isLiveProduction } = require('./production-entrypoints.cjs');
  assert.equal(
    isLiveProduction({
      EAS_BUILD_PROFILE: 'ios-ad-hoc',
      EXPO_PUBLIC_CLIENT_MODE: 'live'
    }),
    true
  );
  assert.equal(
    isLiveProduction({
      EAS_BUILD_PROFILE: 'ios-ad-hoc',
      EXPO_PUBLIC_CLIENT_MODE: 'demo'
    }),
    false
  );
});

test('iPhone release uses the approved version and preserves the complete Android configuration', () => {
  const before = { ...process.env };
  try {
    delete process.env.MASARIFI_APP_VARIANT;
    process.env.EAS_BUILD_PROFILE = 'ios-ad-hoc';
    process.env.MASARIFI_RELEASE_VERSION_NAME = '1.2.3';
    const result = configure({ config: JSON.parse(JSON.stringify(app)) });
    assert.equal(result.version, '1.2.3');
    assert.deepEqual(result.android, app.android);
    assert.equal(result.ios.bundleIdentifier, 'com.masarifi.mobile');
    assert.equal(result.scheme, 'masarifi');
    delete process.env.MASARIFI_RELEASE_VERSION_NAME;
    assert.throws(
      () => configure({ config: JSON.parse(JSON.stringify(app)) }),
      /Approved release version/
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
