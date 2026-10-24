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

test('Expo prebuild reinstalls the checked release policy in a clean generated project', async () => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const {
    installReleasePolicy,
    copyReleasePolicy
  } = require('../plugins/with-release-safety.cjs');
  const template =
    'android { buildTypes { release { signingConfig signingConfigs.debug } } }';
  const installed = installReleasePolicy(template);
  assert.equal(installReleasePolicy(installed), installed);
  assert.ok(installed.endsWith('apply from: "release-safety.gradle"\n'));
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'masarifi-release-policy-')
  );
  try {
    await fs.mkdir(path.join(directory, 'app'));
    await copyReleasePolicy(directory);
    for (const [source, target] of [
      ['release-safety.gradle', 'app/release-safety.gradle'],
      ['release-rules.pro', 'app/release-rules.pro'],
      ['release-AndroidManifest.xml', 'app/src/release/AndroidManifest.xml']
    ]) {
      assert.equal(
        await fs.readFile(path.join(directory, target), 'utf8'),
        await fs.readFile(path.join(root, 'plugins', source), 'utf8')
      );
    }
    await fs.writeFile(
      path.join(directory, 'app/release-safety.gradle'),
      'stale generated policy'
    );
    await copyReleasePolicy(directory);
    assert.equal(
      await fs.readFile(
        path.join(directory, 'app/release-safety.gradle'),
        'utf8'
      ),
      await fs.readFile(
        path.join(root, 'plugins/release-safety.gradle'),
        'utf8'
      )
    );
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
