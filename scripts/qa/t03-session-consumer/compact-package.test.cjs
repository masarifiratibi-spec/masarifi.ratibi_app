const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { buildPackage, verifyPackage } = require("./package.cjs");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");

test("compact build preserves every verified dependency content/resolution pin and imports real compiled modules without jobs or connections", async () => {
  const proofPath = process.env.T03_DEPENDENCY_PROOF;
  assert.ok(
    proofPath,
    "NOT RUN: supply the explicitly pinned completed full-build dependency proof",
  );
  const proofPin = process.env.T03_DEPENDENCY_PROOF_SHA256;
  const output = resolve(
    __dirname,
    "../../../.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/session-consumer-prep/packages",
    `compact-test-${Date.now()}`,
  );
  const manifest = await buildPackage(output, {
    path: proofPath,
    sha256: proofPin,
  });
  assert.equal(manifest.dependencies.length, 50);
  assert.ok(manifest.imageDependencies.files.length > 7000);
  assert.ok(manifest.imageDependencies.resolutions.length > 30);
  assert.ok(
    !manifest.files.some((file) => file.path.startsWith("node_modules/")),
  );
  const packagePin = sha256(
    fs.readFileSync(resolve(output, "package-manifest.json")),
  );
  if (process.platform !== "linux")
    assert.throws(
      () => verifyPackage(output, packagePin),
      /QA_IMAGE_DEPENDENCY_ROOT_UNVERIFIED/,
    );
  const probe = `const fail=()=>{throw Error('UNEXPECTED_BACKGROUND_OR_CONNECTION')};global.setInterval=fail;global.setTimeout=fail;require('node:net').Socket.prototype.connect=fail;require('node:tls').connect=fail;const runtime=require(${JSON.stringify(resolve(output, "compiled/sync/claimed-mutation.runtime.js"))});const config=require(${JSON.stringify(resolve(output, "compiled/platform/config/environment.schema.js"))});if(typeof runtime.prepareClaimedMutationRuntime!=='function'||typeof config.validateEnvironment!=='function')throw Error('REAL_COMPILED_EXPORT_MISSING');process.stdout.write('IMPORT_NO_BACKGROUND_PASS');`;
  const child = spawnSync(process.execPath, ["-e", probe], {
    env: {
      SystemRoot: process.env.SystemRoot,
      NODE_PATH: resolve(__dirname, "../../../apps/api/node_modules"),
    },
    timeout: 15000,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "IMPORT_NO_BACKGROUND_PASS");
  fs.writeFileSync(
    resolve(output, "local-test-result.json"),
    JSON.stringify({
      testOnly: true,
      packagePin,
      dependencyProofPin: proofPin,
      files: manifest.files.length,
      imageFiles: manifest.imageDependencies.files.length,
      bytes: manifest.files.reduce((n, f) => n + f.bytes, 0),
    }) + "\n",
    { flag: "wx" },
  );
});
