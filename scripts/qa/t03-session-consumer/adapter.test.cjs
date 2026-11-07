const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { readPrivateFrame, runReviewedSession } = require("./adapter.cjs");
const { sessionFixture } = require("./session-fixture.cjs");
const {
  observe,
  verifyInitialAnchors,
  readOnlyRuntimePreflight,
} = require("./adapter.cjs");
const { syntheticManifest } = require("../t03-exact-sync/test-manifest.cjs");
const { sha256, canonical } = require("../t03-exact-sync/manifest.cjs");
const { runSession } = require("./session.cjs");

function observationDatabase({
  pending = [],
  inflight = null,
  change = {},
  catalogError,
  drift = false,
} = {}) {
  const f = sessionFixture();
  const base = syntheticManifest();
  const catalog = {};
  const definition = "synthetic pinned function";
  const session = {
    ...f.manifest,
    target: base.target,
    provenance: {
      catalogSha256: sha256(canonical(catalog)),
      claimSha256: sha256(definition),
      completeSha256: sha256(definition),
      retrySha256: sha256(definition),
    },
  };
  const resource = structuredClone(session.binding.resource);
  Object.assign(resource.transaction, change);
  const calls = [];
  const client = {
    async connect() {
      calls.push("connect");
    },
    async end() {
      calls.push("end");
    },
    async query(sql) {
      calls.push(sql);
      if (sql.includes("pg_control_system"))
        return {
          rows: [
            {
              ...session.target,
              version: 170006,
              isolation: "repeatable read",
              readOnly: "on",
              pid: 17,
            },
          ],
        };
      if (sql.includes("has_table_privilege"))
        return { rows: [{ allowed: true, filtered: false }] };
      if (sql.includes("'functions'")) {
        if (catalogError) throw catalogError;
        return { rows: [{ catalog: drift ? { changed: true } : catalog }] };
      }
      if (sql.includes("pg_get_functiondef")) return { rows: [{ definition }] };
      if (sql.includes("status in ('received','processing')"))
        return { rows: pending.map((row) => ({ row })) };
      if (sql.includes("transaction_postings")) return { rows: [resource] };
      if (sql.includes("client_mutations m where id="))
        return { rows: [{ row: inflight?.row }] };
      if (sql.includes("private.idempotency_keys")) return { rows: [] };
      if (sql.includes("clock_timestamp"))
        return { rows: [{ observed: new Date("2026-10-26T12:00:00Z") }] };
      if (sql.includes("select not exists")) return { rows: [{ clear: true }] };
      if (/^(begin |set local |rollback$)/.test(sql)) return { rows: [] };
      throw Error("UNEXPECTED_SYNTHETIC_QUERY");
    },
  };
  return {
    fixture: f,
    session,
    resource,
    calls,
    configuration: { createBootstrapClient: () => client },
    state: {
      phase: 0,
      version: 1,
      note: null,
      inflight,
      phaseStartedAt: "2026-10-26T11:00:00Z",
    },
    scans: () => calls.filter((sql) => sql.includes("'functions'")).length,
  };
}

test("unchanged idle observation retains RR target/global/resource/salary reads without repeating full provenance", async () => {
  const f = observationDatabase();
  const result = await observe(f.configuration, f.session, f.state);
  assert.equal(f.scans(), 0);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.resource, f.resource);
  assert.equal(result.noActiveAutomaticSalaryLinks, true);
  assert.ok(
    f.calls.includes("begin isolation level repeatable read read only"),
  );
  assert.ok(f.calls.includes("set local statement_timeout='5000ms'"));
  assert.ok(f.calls.some((sql) => sql.includes("pg_control_system")));
  assert.ok(
    f.calls.some((sql) => sql.includes("public.client_mutations','SELECT'")),
  );
  assert.ok(
    f.calls.some((sql) => sql.includes("public.salary_receipts','SELECT'")),
  );
  assert.deepEqual(f.calls.slice(-2), ["rollback", "end"]);
});

for (const [name, options] of [
  ["pending candidate", { pending: [{ id: "synthetic-mutation" }] }],
  ["inflight completion", { inflight: { row: { id: "synthetic-mutation" } } }],
  ["direct cleanup version", { change: { version: 2 } }],
  ["direct cleanup note", { change: { note: "synthetic-change" } }],
]) {
  test(`${name} observation verifies full provenance within its held RR reader`, async () => {
    const f = observationDatabase(options);
    await observe(f.configuration, f.session, f.state);
    assert.equal(f.scans(), 1);
    assert.equal(
      f.calls.filter((sql) => sql.startsWith("select pg_get_functiondef("))
        .length,
      3,
    );
    const start = f.calls.indexOf(
      "begin isolation level repeatable read read only",
    );
    const scan = f.calls.findIndex((sql) => sql.includes("'functions'"));
    const rollback = f.calls.indexOf("rollback");
    assert.ok(start < scan && scan < rollback);
    assert.deepEqual(f.calls.slice(-2), ["rollback", "end"]);
  });
}

for (const [name, failure] of [
  ["catalog drift", { drift: true }],
  [
    "statement timeout",
    {
      catalogError: Object.assign(new Error("synthetic timeout"), {
        code: "57014",
      }),
    },
  ],
]) {
  test(`${name} on an event observation rejects before claim or phase completion`, async () => {
    const f = observationDatabase({
      pending: [{ id: "synthetic-mutation" }],
      ...failure,
    });
    f.fixture.dependencies.observe = (state) =>
      observe(f.configuration, f.session, state);
    await assert.rejects(
      runSession(f.session, f.fixture.dependencies),
      name === "catalog drift"
        ? /CATALOG_PROVENANCE_MISMATCH/
        : /SESSION_EXECUTION_FAILED/,
    );
    assert.equal(
      f.fixture.events.some((event) => event.type === "claim"),
      false,
    );
    const stopped = f.fixture.events.at(-1).state;
    assert.equal(stopped.status, "stopped");
    assert.equal(stopped.phase, 0);
    assert.equal(stopped.claims, 0);
    assert.equal(stopped.inflight, null);
    assert.equal(f.scans(), 1);
    assert.equal(
      f.calls.some((sql) => sql.includes("claim_client_mutations(")),
      false,
    );
    assert.deepEqual(f.calls.slice(-2), ["rollback", "end"]);
  });
}

test("unchanged version and note still reject financial drift in the controller without claim", async () => {
  const f = observationDatabase({ change: { amount_minor: 9000 } });
  f.fixture.dependencies.observe = (state) =>
    observe(f.configuration, f.session, state);
  await assert.rejects(
    runSession(f.session, f.fixture.dependencies),
    /SESSION_FINANCIAL_DRIFT/,
  );
  assert.equal(f.scans(), 0);
  assert.equal(
    f.fixture.events.some((event) => event.type === "claim"),
    false,
  );
  assert.equal(f.fixture.events.at(-1).state.phase, 0);
});

test("initial anchors and runtime preflight retain default full provenance before their actions", async () => {
  for (const mode of ["anchors", "preflight"]) {
    const f = observationDatabase({ drift: true });
    f.session.initialAnchors = {
      mutationSqlJsonSha256:
        "643b212d83f975429241e5453a55f39316db6ce6b0653009a6db0d9327d32a89",
      resourceSqlJsonSha256:
        "c53473f4c8d7baa74686aaa9b15fa6feea88c03ac7da83a806427054ed14aa0e",
    };
    let workerCheckout = 0;
    const runtime = {
      normalPool: {
        withClient() {
          workerCheckout += 1;
        },
      },
    };
    await assert.rejects(
      mode === "anchors"
        ? verifyInitialAnchors(f.configuration, f.session)
        : readOnlyRuntimePreflight(f.configuration, runtime, f.session),
      /CATALOG_PROVENANCE_MISMATCH/,
    );
    assert.equal(f.scans(), 1);
    assert.equal(workerCheckout, 0);
    assert.deepEqual(f.calls.slice(-2), ["rollback", "end"]);
  }
});

test("private input accepts a bounded pipe frame without emitting credential bytes", async () => {
  const frame = {
    worker: "DATABASE_URL=SYNTHETIC_WORKER_SECRET",
    api: "DATABASE_URL=SYNTHETIC_API_SECRET",
    bootstrap: "DATABASE_URL=SYNTHETIC_BOOTSTRAP_SECRET",
    manifest: "{}",
    hostAttestation: {},
  };
  assert.deepEqual(
    await readPrivateFrame(Readable.from([Buffer.from(JSON.stringify(frame))])),
    frame,
  );
});

for (const bytes of [
  Buffer.from("SYNTHETIC_SECRET malformed"),
  Buffer.alloc(262145, 65),
  Buffer.from([255]),
]) {
  test(`invalid private frame is sanitized (${bytes.length} bytes)`, async () => {
    await assert.rejects(
      readPrivateFrame(Readable.from([bytes])),
      (error) =>
        error.message === "QA_PRIVATE_FRAME_INVALID" &&
        !error.stack.includes("SYNTHETIC_SECRET"),
    );
  });
}

test("a manifest flag and fabricated host metadata cannot load runtime or open connections", async () => {
  const f = sessionFixture();
  f.manifest.deadlineAt = new Date(Date.now() + 60000).toISOString();
  await assert.rejects(
    runReviewedSession(
      { manifest: JSON.stringify(f.manifest), hostAttestation: {} },
      { packageRoot: "/nonexistent", packagePin: "a".repeat(64) },
    ),
    /QA_REVIEWED_ARTIFACT_MISMATCH/,
  );
});

test("restored rehearsal stays disabled and read-only and cannot select session execution", async () => {
  const f = sessionFixture();
  f.manifest.enabled = false;
  f.manifest.deadlineAt = null;
  f.manifest.restoredSuccessor = { kind: "t03-phase2-restored-once" };
  const frame = { manifest: JSON.stringify(f.manifest), hostAttestation: {} };
  await assert.rejects(
    runReviewedSession(frame, { mode: "session", rehearsal: true }),
    /SUCCESSOR_REHEARSAL_MUST_BE_DISABLED/,
  );
  await assert.rejects(
    runReviewedSession(frame, {
      mode: "preflight",
      rehearsal: true,
      packagePin: "a".repeat(64),
    }),
    /QA_REVIEWED_ARTIFACT_MISMATCH/,
  );
  await assert.rejects(
    runReviewedSession(frame, { mode: "preflight", rehearsal: false }),
    /SESSION_DISABLED_OR_SCOPE/,
  );
});
