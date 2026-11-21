import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { validateClientBuildEnvironment } from './check-client-runtime.mjs';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const app = require('../app.json').expo;

function withEnvironment(environment, action) {
  const original = { ...process.env };
  try {
    for (const key of Object.keys(process.env))
      if (/^(?:EXPO_PUBLIC_|MASARIFI_|EAS_BUILD_PROFILE$|NODE_ENV$)/.test(key))
        delete process.env[key];
    Object.assign(process.env, environment);
    return action();
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
}

test('normal config and build validation reject private QA selection even before demo/development early returns', () => {
  const ordinary = {
    NODE_ENV: 'development',
    EAS_BUILD_PROFILE: 'development',
    EXPO_PUBLIC_CLIENT_MODE: 'demo'
  };
  assert.doesNotThrow(() => validateClientBuildEnvironment(ordinary));
  withEnvironment(ordinary, () => assert.deepEqual(configure({ config: app }), app));
  for (const marker of [
    { MASARIFI_APP_VARIANT: 'performance-qa' },
    { EXPO_PUBLIC_APP_VARIANT: 'performance-qa' },
    { EXPO_PUBLIC_RELEASE_CHANNEL: 'performance-qa' },
    { EAS_BUILD_PROFILE: 'performance-qa' },
    { MASARIFI_PERFORMANCE_QA_COMPOSITION: '1' },
    { MASARIFI_PERFORMANCE_QA_COMPOSITION: '' },
    { EXPO_PUBLIC_PERFORMANCE_QA_MANIFEST_SHA256: 'a'.repeat(64) },
    { EXPO_PUBLIC_PERFORMANCE_QA_MANIFEST_SHA256: '' },
    { EXPO_PUBLIC_PERFORMANCE_QA_MANIFEST_SHA256: 'false' }
  ]) {
    const selected = { ...ordinary, ...marker };
    assert.throws(() => validateClientBuildEnvironment(selected), /Performance QA requires private composition/);
    withEnvironment(selected, () =>
      assert.throws(() => configure({ config: app }), /Performance QA requires private composition/)
    );
  }
});

test('ordinary config rejects the native private identity without relying on environment markers', () => {
  for (const config of [
    { ...app, android: { ...app.android, package: 'com.masarifi.mobile.performance' } },
    { ...app, ios: { ...app.ios, bundleIdentifier: 'com.masarifi.mobile.performance' } }
  ])
    withEnvironment({}, () =>
      assert.throws(() => configure({ config }), /Performance QA requires private composition/)
    );
});
