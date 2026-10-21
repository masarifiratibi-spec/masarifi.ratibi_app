import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';
import {
  createDevelopmentLaunch,
  assertDevelopmentPortAvailable
} from './staging-development.mjs';

test('DEV launch rejects port overrides instead of pointing the native client at a different Metro', () => {
  for (const args of [
    ['--port', '8082'],
    ['--port=8082'],
    ['-p', '8082'],
    ['-p8082'],
    ['--port'],
    ['--no-dev']
  ]) {
    assert.throws(
      () => createDevelopmentLaunch('start', args, environment),
      /8081|DEV/
    );
  }
});

const environment = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_bWFzYXJpZmkudGVzdCQ',
  RCT_METRO_PORT: '8082'
};

test('DEV launch emits one native-compatible port while retaining workers, cache and Voice posting', () => {
  for (const portArgs of [
    [],
    ['--port', '8081'],
    ['--port=8081'],
    ['-p', '8081'],
    ['-p8081']
  ]) {
    const launch = createDevelopmentLaunch(
      'start',
      [...portArgs, '--max-workers', '4', '--minify'],
      environment
    );
    assert.deepEqual(launch.args, [
      'start',
      '--dev-client',
      '--localhost',
      '--port',
      '8081',
      '--max-workers',
      '4',
      '--minify'
    ]);
    assert.equal(launch.env.RCT_METRO_PORT, '8081');
    assert.equal(launch.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING, 'true');
    assert.equal(launch.env.EXPO_PUBLIC_CLIENT_MODE, 'live');
    assert.equal(launch.env.EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED, 'true');
    assert.equal(
      launch.env.EXPO_PUBLIC_API_URL,
      'https://api.staging.masarifiratibi.com'
    );
    assert.equal(launch.env.CI, undefined);
  }
});

for (const host of ['127.0.0.1', '::1'])
  test(`a listener on ${host}:8081 stops the launcher without taking over the port`, async () => {
    const listener = createServer();
    await new Promise((resolve, reject) =>
      listener.once('error', reject).listen(8081, host, resolve)
    );
    try {
      await assert.rejects(assertDevelopmentPortAvailable(), /8081.*in use/);
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./staging-development.mjs', import.meta.url)),
          'start'
        ],
        {
          env: { ...process.env, ...environment },
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true
        }
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /8081.*in use/);
      assert.equal(listener.listening, true);
    } finally {
      await new Promise((resolve, reject) =>
        listener.close((error) => (error ? reject(error) : resolve()))
      );
    }
    await assertDevelopmentPortAvailable();
  });
