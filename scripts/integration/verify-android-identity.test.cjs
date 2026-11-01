const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateIdentity } = require("./verify-android-identity.cjs");
const { benchmarkProfile } = require('../../apps/mobile/scripts/benchmark-build-policy.cjs');
function fixture() {
  const baseline = {
    app: {
      expo: {
        name: "Approved name",
        slug: "approved",
        scheme: "approved",
        android: { package: "com.approved.app" },
        ios: { bundleIdentifier: "com.approved.app" },
        extra: { eas: { projectId: "approved-project" } },
      },
    },
    eas: {
      build: { development: { distribution: "internal" }, production: {} },
    },
    firebase: { project_info: { project_id: "approved" } },
    index: "registerRootComponent(App);",
  };
  const candidate = structuredClone(baseline);
  candidate.eas.build.development.node = "24.16.0";
  candidate.eas.build.production = {
    autoIncrement: true,
    environment: "production",
    node: "24.16.0",
    android: { buildType: "app-bundle" },
    env: {
      EXPO_PUBLIC_CLIENT_MODE: "live",
      EXPO_PUBLIC_APP_LOCK_ENABLED: "true",
      EXPO_PUBLIC_DEMO_MODE: "0",
      EXPO_PUBLIC_RELEASE_CHANNEL: "production",
      EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED: "false",
      EXPO_PUBLIC_VOICE_TIMING_ENABLED: "false",
      EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: "false",
      EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: "false",
    },
  };
  return { baseline, candidate };
}
test("allows release safety configuration while preserving registered identities", () => {
  const { baseline, candidate } = fixture();
  candidate.app.expo.android.blockedPermissions = [
    "android.permission.SYSTEM_ALERT_WINDOW",
  ];
  validateIdentity(candidate, baseline);
});
test('allows only the exact approved benchmark profile addition', () => {
  const { baseline, candidate } = fixture();
  candidate.eas.build.benchmark = structuredClone(benchmarkProfile);
  validateIdentity(candidate, baseline);
  candidate.eas.build.benchmark.env.EXPO_PUBLIC_BENCHMARK_READ_ONLY = 'false';
  assert.throws(() => validateIdentity(candidate, baseline));
});
test('rejects arbitrary extra profiles even with an approved benchmark present', () => {
  const { baseline, candidate } = fixture();
  candidate.eas.build.benchmark = structuredClone(benchmarkProfile);
  candidate.eas.build.unreviewed = {};
  assert.throws(() => validateIdentity(candidate, baseline));
});
for (const [name, change] of Object.entries({
  package: (x) => (x.app.expo.android.package = "com.other.app"),
  firebase: (x) => (x.firebase.project_info.project_id = "other"),
  profile: (x) => (x.eas.build.development.distribution = "store"),
  lock: (x) =>
    (x.eas.build.production.env.EXPO_PUBLIC_APP_LOCK_ENABLED = "false"),
  entrypoint: (x) => (x.index = "mockApp();"),
}))
  test(`rejects changed ${name}`, () => {
    const { baseline, candidate } = fixture();
    change(candidate);
    assert.throws(() => validateIdentity(candidate, baseline));
  });
