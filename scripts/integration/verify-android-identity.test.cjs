const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateIdentity,
  loadApprovedIdentity,
} = require("./verify-android-identity.cjs");
const {
  benchmarkProfile,
} = require("../../apps/mobile/scripts/benchmark-build-policy.cjs");
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

function reviewedFixture({
  withRuntimeMarker = false,
  isAncestor = (revision) =>
    withRuntimeMarker ||
    revision !== "5482885f8cc4fb629b95bb2d7734981eb02985d3",
} = {}) {
  const { baseline, candidate } = fixture();
  const displayName = "مصاريفي وراتبي";
  const profile = {
    extends: "production",
    developmentClient: false,
    distribution: "internal",
    ios: { simulator: false },
    env: { MASARIFI_IOS_AD_HOC: "true" },
  };
  const branding = structuredClone(baseline.app);
  branding.expo.name = displayName;
  branding.expo.android.package = "com.unreviewed.branding";
  const laterEas = {
    build: { "ios-ad-hoc": profile, production: { unreviewed: true } },
  };
  const runtimeEas = {
    build: {
      "ios-ad-hoc": {
        ...profile,
        env: { ...profile.env, EXPO_PUBLIC_APP_VARIANT: "production" },
      },
      production: { unreviewedRuntime: true },
    },
  };
  const snapshots = {
    "apps/mobile/app.json": baseline.app,
    "apps/mobile/eas.json": baseline.eas,
    "apps/mobile/google-services.json": baseline.firebase,
    "apps/mobile/index.js": baseline.index,
  };
  const expected = loadApprovedIdentity((revision, file) => {
    let value;
    if (revision === "7e3bbef0cdccc2ee5509dd332f4e32236af01b90")
      value = snapshots[file];
    else if (
      revision === "0b7c4d3ccecac8ffb6406626cdf84995cb5d035d" &&
      file === "apps/mobile/app.json"
    )
      value = branding;
    else if (
      revision === "0389dff3936211b968c1128471cc313af3b2aef2" &&
      file === "apps/mobile/eas.json"
    )
      value = laterEas;
    else if (
      revision === "5482885f8cc4fb629b95bb2d7734981eb02985d3" &&
      file === "apps/mobile/eas.json"
    )
      value = runtimeEas;
    else assert.fail("Unreviewed identity source requested");
    return typeof value === "string" ? value : JSON.stringify(value);
  }, isAncestor);
  candidate.app.expo.name = displayName;
  candidate.eas.build["ios-ad-hoc"] = structuredClone(
    withRuntimeMarker ? runtimeEas.build["ios-ad-hoc"] : profile,
  );
  return { expected, candidate };
}

test("inherits only the reviewed name and exact iOS profile while retaining C0 identity bindings", () => {
  const { expected, candidate } = reviewedFixture();
  assert.deepEqual(expected.eas.build.production, {});
  validateIdentity(candidate, expected);
});

test("inherits the exact reviewed iOS production marker only on its approved lineage", () => {
  const { expected, candidate } = reviewedFixture({ withRuntimeMarker: true });
  assert.equal(
    expected.eas.build["ios-ad-hoc"].env.EXPO_PUBLIC_APP_VARIANT,
    "production",
  );
  assert.deepEqual(expected.eas.build.production, {});
  validateIdentity(candidate, expected);
});

test("rejects the iOS production marker when its reviewed commit is outside ancestry", () => {
  const { expected, candidate } = reviewedFixture({
    withRuntimeMarker: true,
    isAncestor: (revision) =>
      revision !== "5482885f8cc4fb629b95bb2d7734981eb02985d3",
  });
  assert.throws(() => validateIdentity(candidate, expected));
});

for (const [name, change] of Object.entries({
  changed: (x) => {
    x.eas.build["ios-ad-hoc"].env.EXPO_PUBLIC_APP_VARIANT = "preview";
  },
  removed: (x) => {
    delete x.eas.build["ios-ad-hoc"].env.EXPO_PUBLIC_APP_VARIANT;
  },
}))
  test(`rejects a ${name} marker after the reviewed iOS runtime commit`, () => {
    const { expected, candidate } = reviewedFixture({
      withRuntimeMarker: true,
    });
    change(candidate);
    assert.throws(() => validateIdentity(candidate, expected));
  });

for (const [name, reviewed] of [
  ["branding", "0b7c4d3ccecac8ffb6406626cdf84995cb5d035d"],
  ["paused iOS profile", "0389dff3936211b968c1128471cc313af3b2aef2"],
])
  test(`refuses ${name} outside the candidate ancestry`, () => {
    assert.throws(
      () =>
        reviewedFixture({ isAncestor: (revision) => revision !== reviewed }),
      /ancestor/,
    );
  });

for (const [name, change] of Object.entries({
  distribution: (x) => {
    x.eas.build["ios-ad-hoc"].distribution = "store";
  },
  environment: (x) => {
    x.eas.build["ios-ad-hoc"].env.MASARIFI_IOS_AD_HOC = "false";
  },
  extraProfile: (x) => {
    x.eas.build.unreviewed = {};
  },
}))
  test(`rejects changed ${name} with the reviewed iOS profile`, () => {
    const { expected, candidate } = reviewedFixture();
    change(candidate);
    assert.throws(() => validateIdentity(candidate, expected));
  });
test("allows only the exact approved benchmark profile addition", () => {
  const { baseline, candidate } = fixture();
  candidate.eas.build.benchmark = structuredClone(benchmarkProfile);
  validateIdentity(candidate, baseline);
  candidate.eas.build.benchmark.env.EXPO_PUBLIC_BENCHMARK_READ_ONLY = "false";
  assert.throws(() => validateIdentity(candidate, baseline));
});
test("rejects arbitrary extra profiles even with an approved benchmark present", () => {
  const { baseline, candidate } = fixture();
  candidate.eas.build.benchmark = structuredClone(benchmarkProfile);
  candidate.eas.build.unreviewed = {};
  assert.throws(() => validateIdentity(candidate, baseline));
});
for (const [name, change] of Object.entries({
  name: (x) => (x.app.expo.name = "Unreviewed name"),
  slug: (x) => (x.app.expo.slug = "unreviewed"),
  scheme: (x) => (x.app.expo.scheme = "unreviewed"),
  package: (x) => (x.app.expo.android.package = "com.other.app"),
  bundleIdentifier: (x) => (x.app.expo.ios.bundleIdentifier = "com.other.app"),
  easProject: (x) => (x.app.expo.extra.eas.projectId = "other-project"),
  firebase: (x) => (x.firebase.project_info.project_id = "other"),
  profile: (x) => (x.eas.build.development.distribution = "store"),
  lock: (x) =>
    (x.eas.build.production.env.EXPO_PUBLIC_APP_LOCK_ENABLED = "false"),
  entrypoint: (x) => (x.index = "mockApp();"),
}))
  test(`rejects changed ${name}`, () => {
    const { baseline, candidate } = fixture();
    baseline.app.expo.name = candidate.app.expo.name = "مصاريفي وراتبي";
    change(candidate);
    assert.throws(() => validateIdentity(candidate, baseline));
  });
