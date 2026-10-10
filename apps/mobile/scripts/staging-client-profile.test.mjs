import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('client acceptance is standalone, Staging-only and has no user/device cohort', () => {
  const eas = JSON.parse(
    readFileSync(new URL('../eas.json', import.meta.url), 'utf8')
  );
  const profile = eas.build['staging-client'];
  assert.ok(profile, 'A standalone client acceptance profile is required');
  assert.equal(profile.developmentClient, false);
  assert.equal(profile.distribution, 'internal');
  assert.equal(profile.android.buildType, 'apk');
  assert.equal(profile.env.EXPO_PUBLIC_CLIENT_MODE, 'live');
  assert.equal(
    profile.env.EXPO_PUBLIC_API_URL,
    'https://api.staging.masarifiratibi.com'
  );
  assert.equal(profile.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING, 'true');
  assert.equal(profile.env.MASARIFI_APP_VARIANT, undefined);
  assert.doesNotMatch(
    JSON.stringify(profile),
    /ownerId|userId|deviceId|serial|analysis_owner/i
  );
  assert.doesNotMatch(
    JSON.stringify(profile.env),
    /SMS.*AUTOMATIC|NOTIFICATION.*AUTOMATIC/i
  );
});
