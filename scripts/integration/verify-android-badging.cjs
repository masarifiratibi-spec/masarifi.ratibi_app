"use strict";
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { loadApprovedIdentity } = require("./verify-android-identity.cjs");

function verifyBadging(text, approved) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const packages = lines.filter((line) => line.startsWith("package:"));
  const labels = lines.filter((line) => line.startsWith("application-label:"));
  assert.equal(packages.length, 1, "One compiled package identity is required");
  assert.equal(
    labels.length,
    1,
    "One compiled default application label is required",
  );
  assert.equal(
    /^package: name='([^']+)'(?: |$)/.exec(packages[0])?.[1],
    approved.app.expo.android.package,
    "Compiled package must retain the registered identity",
  );
  assert.equal(
    /^application-label:'([^']*)'$/.exec(labels[0])?.[1],
    approved.app.expo.name,
    "Compiled label must match the exact reviewed display name",
  );
}

if (require.main === module) {
  assert.equal(
    process.argv.length,
    3,
    "A single aapt2 badging file is required",
  );
  const root = resolve(__dirname, "../..");
  const approved = loadApprovedIdentity(
    (revision, file) =>
      execFileSync("git", ["show", `${revision}:${file}`], {
        cwd: root,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
        encoding: "utf8",
      }),
    (revision) =>
      spawnSync("git", ["merge-base", "--is-ancestor", revision, "HEAD"], {
        cwd: root,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
        stdio: "ignore",
      }).status === 0,
  );
  verifyBadging(readFileSync(process.argv[2], "utf8"), approved);
  console.info("Compiled Android package and reviewed display name verified.");
}

module.exports = { verifyBadging };
