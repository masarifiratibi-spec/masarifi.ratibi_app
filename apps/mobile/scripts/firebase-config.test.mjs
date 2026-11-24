import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import configure from '../app.config.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the default Android client uses the isolated public staging Firebase config', () => {
  const app = JSON.parse(readFileSync(resolve(mobileRoot, 'app.json'), 'utf8'));
  assert.equal(app.expo.android.googleServicesFile, './google-services.json');

  const firebase = JSON.parse(
    readFileSync(resolve(mobileRoot, app.expo.android.googleServicesFile), 'utf8')
  );
  assert.equal(firebase.project_info.project_id, 'masarifi-staging');
  assert.equal(firebase.client.length, 1);
  assert.equal(firebase.client[0].client_info.android_client_info.package_name, 'com.masarifi.mobile');
  assert.equal(firebase.configuration_version, '1');

  const serialized = JSON.stringify(firebase);
  assert.doesNotMatch(serialized, /private_key|client_secret|service_account/i);
});

test('Play builds select the production Firebase sender during local and remote config resolution', () => {
  const app = JSON.parse(readFileSync(resolve(mobileRoot, 'app.json'), 'utf8')).expo;
  const { build } = JSON.parse(readFileSync(resolve(mobileRoot, 'eas.json'), 'utf8'));
  const before = process.env;
  try {
    process.env = { ...build.production.env, MASARIFI_RELEASE_VERSION_NAME: '1.0.1' };
    const local = configure({ config: app });
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EAS_BUILD_PLATFORM = 'android';
    const remote = configure({ config: app });
    assert.equal(local.android.googleServicesFile, remote.android.googleServicesFile);
    const raw = readFileSync(resolve(mobileRoot, remote.android.googleServicesFile), 'utf8');
    const client = JSON.parse(raw);
    assert.equal(client.project_info.project_id, 'masarifi-production');
    assert.equal(client.project_info.project_number, '94844783049');
    assert.equal(client.client[0].client_info.android_client_info.package_name, app.android.package);
    assert.doesNotMatch(raw, /private_key|client_secret|service_account/i);
    assert.deepEqual(remote.ios, app.ios);
    process.env = { ...build['staging-client'].env, EAS_BUILD_PROFILE: 'staging-client' };
    assert.equal(configure({ config: app }).android.googleServicesFile, './google-services.json');
  } finally {
    process.env = before;
  }
});
