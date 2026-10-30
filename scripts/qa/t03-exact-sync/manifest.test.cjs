const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateManifest } = require("./manifest.cjs");
const { runExactOperation } = require("./runner.cjs");
const { syntheticManifest, sourceRoot } = require("./test-manifest.cjs");

test("disabled staging template cannot open a connection or authorize execution", () => {
  assert.throws(
    () => validateManifest({ enabled: false }),
    /MANIFEST_DISABLED/,
  );
});

test("default validation has no runtime dependency initialization or connection", async () => {
  const manifest = syntheticManifest();
  const unavailable = new Proxy(
    {},
    {
      get() {
        throw new Error("unexpected dependency access");
      },
    },
  );
  assert.deepEqual(
    await runExactOperation({ manifest, sourceRoot }, unavailable),
    { outcome: "validated-only", claimed: 0, executed: 0 },
  );
});

for (const [name, change, error] of [
  [
    "financial change",
    (m) => {
      m.binding.effective.amountMinor = 3000;
    },
    /MANIFEST_NOT_NOTE_ONLY/,
  ],
  [
    "unbound payload",
    (m) => {
      m.binding.row.payload.note = "other";
    },
    /MANIFEST_PAYLOAD/,
  ],
  [
    "unknown original field",
    (m) => {
      delete m.binding.original.accountId;
    },
    /MANIFEST_EFFECTIVE/,
  ],
  [
    "missing provenance",
    (m) => {
      m.provenance.imageSha256 = null;
    },
    /MANIFEST_PROVENANCE/,
  ],
  [
    "placeholder",
    (m) => {
      m.target.user = "REQUIRED";
    },
    /MANIFEST_PLACEHOLDER/,
  ],
  [
    "other staging operation",
    (m) => {
      m.scope = "staging";
      m.target.project = "qcffvfbpzvpwcwxwjyro";
      m.target.api = "https://api.staging.masarifiratibi.com";
    },
    /MANIFEST_OPERATION/,
  ],
]) {
  test(`${name} fails before any connection`, async () => {
    const manifest = syntheticManifest();
    change(manifest);
    await assert.rejects(
      runExactOperation({ manifest, sourceRoot, mode: "execute" }),
      error,
    );
  });
}

test("complete synthetic manifest still cannot execute without independently verified authorization and runtime", async () => {
  await assert.rejects(
    runExactOperation({
      manifest: syntheticManifest(),
      sourceRoot,
      mode: "execute",
    }),
    /EXECUTION_ACCESS_UNVERIFIED/,
  );
});

test("changed runner source pin aborts before authorization", async () => {
  const manifest = syntheticManifest();
  manifest.provenance.sources["scripts/qa/t03-exact-sync/runner.cjs"] =
    "0".repeat(64);
  await assert.rejects(
    runExactOperation({ manifest, sourceRoot, mode: "execute" }),
    /SOURCE_MISMATCH/,
  );
});

test("the approved operation alone cannot authorize different QA title, amount or note predicates", async () => {
  // All bindings remain synthetic test data, never a staging execution manifest.
  const manifest = syntheticManifest();
  manifest.scope = "staging";
  manifest.target.project = "qcffvfbpzvpwcwxwjyro";
  manifest.target.api = "https://api.staging.masarifiratibi.com";
  manifest.binding.row.operation_id = "10de16e6-a966-41b4-a583-1716314b285b";
  await assert.rejects(
    runExactOperation({ manifest, sourceRoot, mode: "execute" }),
    /MANIFEST_APPROVED_QA_PREDICATES/,
  );
});
