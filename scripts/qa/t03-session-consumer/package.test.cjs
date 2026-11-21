const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPackage, verifyPackage } = require("./package.cjs");
const { resolve } = require("node:path");
const { readFileSync, writeFileSync } = require("node:fs");

test("package compiles actual runtime closure with pinned dependencies and detects a changed shipped file", async () => {
  const output = resolve(
    __dirname,
    "../../../.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/session-consumer-prep/packages",
    `package-${Date.now()}`,
  );
  const manifest = await buildPackage(output);
  assert.ok(
    manifest.files.some(
      (file) => file.path === "compiled/sync/claimed-mutation.runtime.js",
    ),
  );
  assert.ok(
    manifest.files.some(
      (file) => file.path === "compiled/platform/config/environment.schema.js",
    ),
  );
  assert.ok(
    manifest.dependencies.some(
      (p) => p.name === "pg" && p.version === "8.23.0",
    ),
  );
  assert.ok(
    !manifest.files.some((file) =>
      /compiled\/(main|worker|app\.module)\./.test(file.path),
    ),
  );
  const pin = require("../t03-exact-sync/manifest.cjs").sha256(
    readFileSync(resolve(output, "package-manifest.json")),
  );
  verifyPackage(output, pin);
  writeFileSync(
    resolve(output, "compiled/sync/claimed-mutation.runtime.js"),
    "\n// tampered",
    { flag: "a" },
  );
  assert.throws(() => verifyPackage(output, pin), /QA_PACKAGE_FILE_MISMATCH/);
});
