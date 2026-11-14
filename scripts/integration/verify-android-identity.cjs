"use strict";
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const {
  benchmarkProfile,
} = require("../../apps/mobile/scripts/benchmark-build-policy.cjs");
const root = resolve(__dirname, "../..");
// C0 remains the registered identity baseline. The reviewed branding commit
// changes only its expected display name; no other identity is inherited.
const baseline = "7e3bbef0cdccc2ee5509dd332f4e32236af01b90";
const displayNameBaseline = "0b7c4d3ccecac8ffb6406626cdf84995cb5d035d";
const iosProfileBaseline = "0389dff3936211b968c1128471cc313af3b2aef2";
const iosRuntimeProfileBaseline = "5482885f8cc4fb629b95bb2d7734981eb02985d3";
const normalize = (bytes) => bytes.toString("utf8").replace(/\r\n/g, "\n");
function validateIdentity(actual, expected) {
  for (const key of ["name", "slug", "scheme"])
    assert.deepEqual(
      actual.app.expo[key],
      expected.app.expo[key],
      `Expo ${key} must retain the approved identity`,
    );
  assert.equal(
    actual.app.expo.android.package,
    expected.app.expo.android.package,
    "Android package identity",
  );
  assert.equal(
    actual.app.expo.ios.bundleIdentifier,
    expected.app.expo.ios.bundleIdentifier,
    "iOS identity",
  );
  assert.equal(
    actual.app.expo.extra.eas.projectId,
    expected.app.expo.extra.eas.projectId,
    "EAS project identity",
  );
  assert.deepEqual(
    actual.firebase,
    expected.firebase,
    "Registered Firebase application identity",
  );
  assert.equal(
    normalize(actual.index),
    normalize(expected.index),
    "Native application entrypoint",
  );
  for (const [name, profile] of Object.entries(expected.eas.build)) {
    if (name !== "production")
      assert.deepEqual(
        actual.eas.build[name],
        name === "development" ? { ...profile, node: "24.16.0" } : profile,
        `${name} profile must be preserved`,
      );
  }
  assert.deepEqual(
    Object.keys(actual.eas.build).sort(),
    [
      ...Object.keys(expected.eas.build),
      ...(actual.eas.build.benchmark ? ["benchmark"] : []),
    ].sort(),
    "No unreviewed build profiles",
  );
  if (actual.eas.build.benchmark)
    assert.deepEqual(
      actual.eas.build.benchmark,
      benchmarkProfile,
      "Only the approved read-only benchmark profile is allowed",
    );
  const production = actual.eas.build.production;
  assert.equal(production.environment, "production");
  assert.equal(production.node, "24.16.0");
  assert.equal(production.autoIncrement, true);
  assert.equal(production.android.buildType, "app-bundle");
  for (const [name, value] of Object.entries({
    EXPO_PUBLIC_CLIENT_MODE: "live",
    EXPO_PUBLIC_APP_LOCK_ENABLED: "true",
    EXPO_PUBLIC_DEMO_MODE: "0",
    EXPO_PUBLIC_RELEASE_CHANNEL: "production",
    EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED: "false",
    EXPO_PUBLIC_VOICE_TIMING_ENABLED: "false",
    EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: "false",
    EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: "false",
  }))
    assert.equal(production.env[name], value, `Production ${name}`);
}
function load(read) {
  return {
    app: JSON.parse(read("apps/mobile/app.json")),
    eas: JSON.parse(read("apps/mobile/eas.json")),
    firebase: JSON.parse(read("apps/mobile/google-services.json")),
    index: read("apps/mobile/index.js"),
  };
}
function loadApprovedIdentity(readRevision, isAncestor) {
  for (const revision of [displayNameBaseline, iosProfileBaseline])
    assert.equal(
      isAncestor(revision),
      true,
      "Reviewed identity source must be an ancestor of HEAD",
    );
  const expected = load((file) => readRevision(baseline, file));
  expected.app.expo.name = JSON.parse(
    readRevision(displayNameBaseline, "apps/mobile/app.json"),
  ).expo.name;
  // The production marker is approved only on its published iOS lineage.
  // Android keeps the earlier profile until that reviewed commit is inherited.
  const approvedIosProfile = isAncestor(iosRuntimeProfileBaseline)
    ? iosRuntimeProfileBaseline
    : iosProfileBaseline;
  // Production and all registered package/project identities retain C0 checks.
  expected.eas.build["ios-ad-hoc"] = JSON.parse(
    readRevision(approvedIosProfile, "apps/mobile/eas.json"),
  ).build["ios-ad-hoc"];
  return expected;
}
if (require.main === module) {
  const readRevision = (revision, file) =>
    execFileSync("git", ["show", `${revision}:${file}`], {
      cwd: root,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).toString("utf8");
  const expected = loadApprovedIdentity(
    readRevision,
    (revision) =>
      spawnSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"], {
        cwd: root,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
        stdio: "ignore",
      }).status === 0,
  );
  const actual = load((file) => readFileSync(resolve(root, file), "utf8"));
  validateIdentity(actual, expected);
  console.info(
    "Approved package, display name, slug, EAS and Firebase identities preserved; production policy configured.",
  );
}
module.exports = { validateIdentity, loadApprovedIdentity };
