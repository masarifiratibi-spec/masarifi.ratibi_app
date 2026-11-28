const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
function config(profile, platform, marker) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(MASARIFI_|EXPO_PUBLIC_|EAS_BUILD_)/.test(key)) delete env[key];
  }
  Object.assign(env, { EAS_BUILD_PROFILE: profile, EAS_BUILD_PLATFORM: platform,
    MASARIFI_RELEASE_VERSION_NAME: '1.0.0', ...marker });
  const result = spawnSync(process.execPath, ['-e',
    'process.stdout.write(JSON.stringify(require("./app.config.js")({config: require("./app.json").expo})))'],
    { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
test('one source preserves Android production identity and Firebase sender without Apple plugins', () => {
  const app = config('production', 'android');
  assert.equal(app.android.package, 'com.masarifi.mobile');
  assert.equal(app.android.googleServicesFile, './google-services.production.json');
  assert.ok(!app.plugins.some(p => /apple-authentication|bank-sms-intent/.test(Array.isArray(p) ? p[0] : p)));
});
test('one source retains Apple Store identity, authentication and Shortcuts', () => {
  const app = config('ios-app-store', 'ios', { MASARIFI_IOS_APP_STORE: 'true' });
  assert.equal(app.ios.bundleIdentifier, 'com.masarifi.mobile');
  assert.equal(app.ios.usesAppleSignIn, true);
  assert.ok(app.plugins.includes('expo-apple-authentication'));
  assert.ok(app.plugins.includes('./plugins/with-bank-sms-intent.cjs'));
  const profiles = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  assert.equal(profiles.build['ios-app-store'].distribution, 'store');
});
test('consolidation preserves the Android validation major and does not add an OTA client', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.dependencies.zod, '^3.23.0');
  assert.match(lock.packages['node_modules/zod'].version, /^3\./);
  assert.equal(pkg.dependencies['expo-updates'], undefined);
});
