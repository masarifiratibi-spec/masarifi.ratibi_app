/* global __dirname */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  productionFile,
  developmentRoutes,
  isLiveProduction
} = require('./production-entrypoints.cjs');
const root = path.resolve(__dirname, '..');
test('live production resolves actual providers while keeping demo builds available', () => {
  assert.equal(
    isLiveProduction({
      NODE_ENV: 'production',
      EXPO_PUBLIC_CLIENT_MODE: 'live'
    }),
    true
  );
  assert.equal(
    isLiveProduction({
      NODE_ENV: 'production',
      EXPO_PUBLIC_CLIENT_MODE: 'demo'
    }),
    false
  );
  const resolved = productionFile(
    path.join(root, 'src/services/mocks/subscription-settings-service.ts')
  );
  assert.equal(
    resolved,
    path.join(root, 'src/services/production/subscription-settings-service.ts')
  );
  assert.equal(
    productionFile(path.join(root, 'src/domain/demo-session.ts')),
    path.join(root, 'src/services/production/demo-session.ts')
  );
  assert.equal(
    developmentRoutes.test(path.join(root, 'app/foundation/trust.tsx')),
    true
  );
  assert.equal(
    developmentRoutes.test(path.join(root, 'app/tracking/demo.tsx')),
    true
  );
  assert.equal(
    developmentRoutes.test(
      path.join(root, 'app/(onboarding)/tracking-demo.tsx')
    ),
    false
  );
  assert.equal(
    developmentRoutes.test(path.join(root, 'app/(tabs)/home.tsx')),
    false
  );
});

test('Expo prebuild reinstalls the checked release policy idempotently', () => {
  const fs = require('node:fs');
  const {
    installReleasePolicy
  } = require('../plugins/with-release-safety.cjs');
  const template =
    'android { buildTypes { release { signingConfig signingConfigs.debug } } }';
  const installed = installReleasePolicy(template);
  assert.equal(installReleasePolicy(installed), installed);
  assert.ok(installed.endsWith('apply from: "release-safety.gradle"\n'));
  assert.equal(
    fs.readFileSync(
      require.resolve('../plugins/release-safety.gradle'),
      'utf8'
    ),
    fs.readFileSync(
      require.resolve('../android/app/release-safety.gradle'),
      'utf8'
    )
  );
});
