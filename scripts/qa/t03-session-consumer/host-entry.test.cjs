const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateReviewedInspection,
  publicFailure,
  deriveInitialSession,
  verifyEndpointDigest,
  STAGING_ENDPOINT_SHA256,
  closeReadOnlyResources,
  deriveRestoredSession,
  restoredManifest,
} = require("./host-entry.cjs");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");
const { canonical } = require("../t03-exact-sync/manifest.cjs");
const { successorFixture } = require("./successor-fixture.cjs");
const { STAGING } = require("./successor.cjs");

test("restored manifest construction preserves parent binding and permits only clockless rehearsal or one bounded actual clock", () => {
  const f = successorFixture(),
    before = structuredClone(f.parent);
  const context = {
    packagePin: "a".repeat(64),
    packageManifest: {
      files: [
        {
          path: "source/scripts/qa/t03-session-consumer/successor.cjs",
          sha256: "b".repeat(64),
        },
      ],
    },
  };
  const disabled = restoredManifest(
    f.parent,
    f.evidence,
    "t03-new-fixed-successor",
    null,
    context,
    true,
  );
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.deadlineAt, null);
  assert.deepEqual(disabled.binding, before.binding);
  assert.deepEqual(disabled.restoredSuccessor.pins, STAGING);
  assert.equal(
    disabled.restoredSuccessor.parentEvidenceSha256,
    sha256(canonical(f.evidence)),
  );
  assert.equal(disabled.provenance.reviewedArtifactSha256, context.packagePin);
  assert.equal(
    disabled.provenance.sources[context.packageManifest.files[0].path.slice(7)],
    "b".repeat(64),
  );
  const deadline = new Date(Date.now() + 59000).toISOString();
  const actual = restoredManifest(
    f.parent,
    f.evidence,
    "t03-new-fixed-successor",
    deadline,
    context,
    false,
  );
  assert.equal(actual.deadlineAt, deadline);
  assert.equal(actual.enabled, true);
  assert.deepEqual(f.parent, before);
  assert.throws(
    () =>
      restoredManifest(
        f.parent,
        f.evidence,
        "t03-new-fixed-successor",
        deadline,
        context,
        true,
      ),
    /SUCCESSOR_REHEARSAL_MUST_BE_DISABLED/,
  );
  assert.throws(
    () =>
      restoredManifest(
        f.parent,
        f.evidence,
        "t03-new-fixed-successor",
        new Date(Date.now() + 3601000).toISOString(),
        context,
        false,
      ),
    /SUCCESSOR_WINDOW_LIMIT/,
  );
  assert.throws(
    () =>
      deriveRestoredSession(
        {
          restoredParent: f.evidence,
          sessionId: "t03-new-fixed-successor",
          deadlineAt: null,
        },
        context,
        true,
      ),
    /SUCCESSOR_PARENT_HASH_MISMATCH/,
  );
});

test("endpoint pins require all64 hex characters and compare the semantic address hash exactly", () => {
  assert.equal(
    STAGING_ENDPOINT_SHA256,
    "884b9f14d28b878ed519404f2286e54a23f4f32b568976a1d021ccb257ba3c06",
  );
  assert.match(STAGING_ENDPOINT_SHA256, /^[a-f0-9]{64}$/);
  verifyEndpointDigest("127.0.0.1", sha256("127.0.0.1"));
  assert.throws(
    () =>
      verifyEndpointDigest(
        "127.0.0.1",
        "884b9f14d28b878ed519404f2286e54f432b568976a1d021ccb257ba3c06",
      ),
    /QA_INSPECT_ENDPOINT_PIN_FORMAT/,
  );
  assert.throws(
    () => verifyEndpointDigest("127.0.0.2", sha256("127.0.0.1")),
    /QA_INSPECT_ENDPOINT_MISMATCH/,
  );
});

test("binding cannot adopt a newly observed catalog, function contract or search_path", () => {
  const observed = {
    catalogSqlJsonSha256: "a".repeat(64),
    searchPath: '"$user", public',
    timeZone: "UTC",
    contracts: [{ signature: "private.x()", sourceLfSha256: "b".repeat(64) }],
    indexes: [{ name: "public.synthetic_operation_identity" }],
    relations: [{ name: "public.synthetic_mutations", triggers: [] }],
  };
  assert.throws(
    () => validateReviewedInspection({ enabled: false }, observed),
    /QA_BIND_EXPECTATIONS_DISABLED/,
  );
  const approved = { enabled: true, ...observed };
  validateReviewedInspection(approved, observed);
  for (const key of [
    "catalogSqlJsonSha256",
    "searchPath",
    "timeZone",
    "contracts",
    "indexes",
    "relations",
  ]) {
    const bad = { ...observed, [key]: key === "contracts" ? [] : "changed" };
    assert.throws(
      () => validateReviewedInspection(approved, bad),
      /QA_BIND_REVIEWED_EXPECTATION_MISMATCH/,
    );
  }
});

test("only allowlisted public error codes and pinned module paths leave the host entry", () => {
  assert.deepEqual(
    publicFailure(new Error("postgresql://private:secret@host")),
    { ok: false, phase: "configuration", code: "QA_HOST_STAGE_FAILED" },
  );
  assert.deepEqual(publicFailure(new Error("QA_UNTRUSTED_SECRET")), {
    ok: false,
    phase: "configuration",
    code: "QA_HOST_STAGE_FAILED",
  });
  const error = Object.assign(
    new Error("QA_IMAGE_DEPENDENCY_CONTENT_MISMATCH"),
    { publicPath: "node_modules/pg/lib/index.js" },
  );
  assert.deepEqual(publicFailure(error), {
    ok: false,
    phase: "configuration",
    code: error.message,
    publicPath: error.publicPath,
  });
  error.publicPath = "postgresql://private:secret@host";
  assert.deepEqual(publicFailure(error), {
    ok: false,
    phase: "configuration",
    code: error.message,
  });
});

test("read-only diagnostics expose only an approved phase, exact guard literal and SQLSTATE", () => {
  const error = Object.assign(
    new Error("secret password postgresql://private:secret@host"),
    {
      code: "42501",
      detail: "SECRET_ROW",
      query: "SECRET_SQL",
      stack: "SECRET_STACK",
    },
  );
  assert.deepEqual(publicFailure(error, "function-contract"), {
    ok: false,
    phase: "function-contract",
    code: "QA_HOST_STAGE_FAILED",
    sqlstate: "42501",
  });
  assert.deepEqual(
    publicFailure(new Error("QA_API_POLICY_MISMATCH"), "configuration"),
    { ok: false, phase: "configuration", code: "QA_API_POLICY_MISMATCH" },
  );
  assert.deepEqual(
    publicFailure(
      Object.assign(new Error("QA_API_POLICY_MISMATCH"), {
        publicPath: "node_modules/SECRET",
      }),
      "catalog",
    ),
    { ok: false, phase: "catalog", code: "QA_API_POLICY_MISMATCH" },
  );
  error.code = "SECRET";
  assert.deepEqual(publicFailure(error, "SECRET_PHASE"), {
    ok: false,
    phase: "configuration",
    code: "QA_HOST_STAGE_FAILED",
  });
  assert.deepEqual(publicFailure(null, "catalog"), {
    ok: false,
    phase: "catalog",
    code: "QA_HOST_STAGE_FAILED",
  });
  assert.deepEqual(publicFailure("SECRET", "connection"), {
    ok: false,
    phase: "connection",
    code: "QA_HOST_STAGE_FAILED",
  });
});

test("closing failure is attributed to connection cleanup after attempting every resource", async () => {
  let closed = 0;
  await assert.rejects(
    closeReadOnlyResources(
      {
        async end() {
          closed++;
          throw Error("PRIVATE_CLOSE_DETAILS");
        },
      },
      {
        async close() {
          closed++;
        },
      },
    ),
    (error) => {
      assert.deepEqual(publicFailure(error), {
        ok: false,
        phase: "connection",
        code: "QA_BIND_RESOURCE_CLOSE_FAILED",
      });
      return true;
    },
  );
  assert.equal(closed, 2);
});

test("private binding derives account from authoritative confirmed postings and preserves partial payload/authentication", () => {
  const row = {
    user_id: "synthetic-owner",
    device_id: "synthetic-device",
    resource_id: "synthetic-resource",
    base_version: 1,
    payload: { note: "QA-T03-WARM-20261025", reason: "Ordinary partial edit" },
    authenticated_at: "2026-01-01T00:00:00Z",
  };
  const resource = {
    transaction: {
      id: row.resource_id,
      user_id: row.user_id,
      version: 1,
      kind: "expense",
      amount_minor: 2000,
      currency_code: "SAR",
      note: null,
      occurred_at: "2026-01-01T00:00:00Z",
    },
    postings: [
      {
        account_id: "synthetic-account",
        amount_minor: -2000,
        clearing_state: "confirmed",
      },
    ],
  };
  const base = { target: {}, binding: {}, provenance: {}, configuration: {} };
  const session = deriveInitialSession(
    base,
    row,
    resource,
    "t03-synthetic",
    new Date("2026-01-01T01:00:00Z").toISOString(),
  );
  assert.deepEqual(session.binding.initialRow, row);
  assert.equal(
    session.binding.originalEffective.accountId,
    "synthetic-account",
  );
  assert.equal(
    session.binding.initialRow.authenticated_at,
    row.authenticated_at,
  );
  assert.equal(session.binding.originalEffective.note, null);
  assert.equal(Object.hasOwn(row.payload, "accountId"), false);
  for (const postings of [
    undefined,
    [],
    [{ account_id: null, amount_minor: -2000, clearing_state: "confirmed" }],
    [
      {
        account_id: "synthetic-account",
        amount_minor: 0,
        clearing_state: "confirmed",
      },
    ],
    [
      { account_id: "one", amount_minor: -2000, clearing_state: "confirmed" },
      { account_id: "two", amount_minor: 1, clearing_state: "confirmed" },
    ],
  ])
    assert.throws(
      () =>
        deriveInitialSession(
          base,
          row,
          { ...resource, postings },
          "t03-synthetic",
          session.deadlineAt,
        ),
      /RESOURCE_ACCOUNT_AMBIGUOUS/,
    );
  const reversed = {
    ...resource,
    postings: [
      ...resource.postings,
      { account_id: "reversed", amount_minor: 50, clearing_state: "confirmed" },
      {
        account_id: "reversed",
        amount_minor: -50,
        clearing_state: "confirmed",
      },
    ],
  };
  assert.equal(
    deriveInitialSession(
      base,
      row,
      reversed,
      "t03-synthetic",
      session.deadlineAt,
    ).binding.originalEffective.accountId,
    "synthetic-account",
  );
});
