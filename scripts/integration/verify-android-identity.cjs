"use strict";
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const root = resolve(__dirname, "../..");
// C0 is the user-verified closure baseline, including the accepted display name.
const baseline = "7e3bbef0cdccc2ee5509dd332f4e32236af01b90";
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
    Object.keys(expected.eas.build).sort(),
    "No unreviewed build profiles",
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
if (require.main === module) {
  const expected = load((file) =>
    execFileSync("git", ["show", `${baseline}:${file}`], {
      cwd: root,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).toString("utf8"),
  );
  const actual = load((file) => readFileSync(resolve(root, file), "utf8"));
  validateIdentity(actual, expected);
  console.info(
    "Approved package, display name, slug, EAS and Firebase identities preserved; production policy configured.",
  );
}
module.exports = { validateIdentity };
