import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrivacyDevelopmentLaunch } from './staging-development-privacy.mjs';

const publishableKey = 'pk_test_bWFzYXJpZmkudGVzdCQ';

test('privacy launcher pins the isolated identity and API independently of inherited client settings', () => {
  const launch = createPrivacyDevelopmentLaunch('start', {
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
    EXPO_PUBLIC_API_URL: 'https://api.masarifiratibi.com',
    MASARIFI_APP_VARIANT: 'staging-development',
    EAS_BUILD_PROFILE: 'production'
  });
  assert.deepEqual(launch.args, ['start', '--dev-client', '--localhost', '--port', '8082', '--max-workers', '1']);
  assert.equal(launch.env.MASARIFI_APP_VARIANT, 'staging-development-privacy');
  assert.equal(launch.env.EXPO_PUBLIC_APP_VARIANT, 'staging-development-privacy');
  assert.equal(launch.env.EAS_BUILD_PROFILE, 'development-staging-privacy');
  assert.equal(launch.env.EXPO_PUBLIC_API_URL, 'https://api.staging.masarifiratibi.com/dev-privacy');
  assert.equal(launch.env.EXPO_PUBLIC_CLIENT_MODE, 'live');
  assert.equal(launch.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, publishableKey);
  assert.equal(launch.env.EXPO_NO_DOTENV, '1');
  assert.equal(launch.env.EXPO_PUBLIC_APP_LOCK_ENABLED, 'false');
  assert.equal(launch.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING, 'true');
});

test('privacy launcher supports config inspection and refuses native generation, builds or installation', () => {
  const environment = { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey };
  assert.deepEqual(createPrivacyDevelopmentLaunch('config', environment).args, ['config', '--type', 'public', '--json']);
  assert.throws(() => createPrivacyDevelopmentLaunch('prebuild', environment), /Unsupported privacy development command/);
  assert.throws(() => createPrivacyDevelopmentLaunch('run:android', environment), /Unsupported privacy development command/);
});

test('privacy launcher requires an explicitly supplied test publishable key and never reads a fallback file', () => {
  for (const key of [undefined, 'pk_live_bWFzYXJpZmkudGVzdCQ', 'sk_test_private', 'pk_test_short']) {
    assert.throws(() => createPrivacyDevelopmentLaunch('config', { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: key }), /test publishable key/);
  }
});
