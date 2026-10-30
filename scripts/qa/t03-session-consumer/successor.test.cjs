const { test } = require("node:test");
const assert = require("node:assert/strict");
const { successorFixture } = require("./successor-fixture.cjs");
const { restoredSeed } = require("./successor.cjs");
const session = require("./session.cjs");
const { id } = require("../t03-exact-sync/test-manifest.cjs");
const { syntheticManifest } = require("../t03-exact-sync/test-manifest.cjs");
const { sha256, canonical } = require("../t03-exact-sync/manifest.cjs");
const { admitRestoredSuccessor } = require("./adapter.cjs");

test("fixed restored admission carries parent claim and restoration receipt into phase2", () => {
  const f = successorFixture();
  const seed = restoredSeed(f.manifest, f.evidence, f.observation);
  assert.equal(seed.phase, 2);
  assert.equal(seed.version, 3);
  assert.equal(seed.note, null);
  assert.equal(seed.claims, 1);
  assert.deepEqual(seed.operations, [f.parent.binding.initialRow.operation_id]);
  assert.deepEqual(seed.mutations, [f.parent.binding.initialRow.id]);
  assert.equal(seed.directReceipts.length, 1);
  assert.equal(seed.deadlineAt, f.manifest.deadlineAt);
  assert.equal(f.parent.deadlineAt < f.manifest.deadlineAt, true);
});

test("read-only admission rehearsal without an approved time window cannot start a controller", async () => {
  const f = successorFixture();
  f.manifest.enabled = false;
  f.manifest.deadlineAt = null;
  assert.equal(
    restoredSeed(f.manifest, f.evidence, f.observation).deadlineAt,
    null,
  );
  let admissions = 0;
  await assert.rejects(
    session.runRestoredSuccessor(f.manifest, {
      ...f.dependencies,
      admitRestoredSuccessor() {
        admissions += 1;
      },
    }),
    /SESSION_DISABLED_OR_SCOPE/,
  );
  assert.equal(admissions, 0);
});

test("the fixed requestId agreement remains required even with correctly re-pinned synthetic receipt bytes", () => {
  const f = successorFixture();
  const k = JSON.parse(f.observation.receipts[0].sqlText);
  k.response_body.transaction.requestId = "wrong-correlated-request";
  const r = {
    sqlText: JSON.stringify(k),
    bodySqlText: JSON.stringify(k.response_body),
  };
  f.observation.receipts = [r];
  f.manifest.restoredSuccessor.pins.receiptSqlSha256 = sha256(r.sqlText);
  f.manifest.restoredSuccessor.pins.receiptBodySqlSha256 = sha256(
    r.bodySqlText,
  );
  assert.throws(
    () => restoredSeed(f.manifest, f.evidence, f.observation),
    /SUCCESSOR_RESTORATION_CORRELATION_REQUIRED/,
  );
});

test("fixed successor controller starts phase2 and applies only the remaining four phases", async () => {
  const f = successorFixture();
  let phase = 2,
    claims = 0,
    row,
    applied;
  const resource = structuredClone(f.observation.resource);
  const save = (state) =>
    f.events.push({ type: "persist", state: structuredClone(state) });
  const result = await session.runRestoredSuccessor(f.manifest, {
    ...f.dependencies,
    admitRestoredSuccessor: async () => ({
      evidence: f.evidence,
      observation: f.observation,
    }),
    journal: {
      async beginRestoredSuccessor(state) {
        assert.equal(state.phase, 2);
        save(state);
      },
      save,
    },
    async observe(state) {
      if (state.phase !== phase) {
        phase = state.phase;
        row = undefined;
        applied = undefined;
      }
      if (!row && !state.inflight) {
        row = {
          ...structuredClone(f.parent.binding.initialRow),
          id: id(100 + phase),
          operation_id: id(200 + phase),
          base_version: state.version,
          created_at: new Date(f.dependencies.now()).toISOString(),
          payload: {
            note: f.manifest.phases[phase],
            reason: "Synthetic continuation",
          },
        };
        row.payload_hash = require("./session-fixture.cjs").normalReceivedHash(
          row,
        );
      }
      return {
        resource: structuredClone(resource),
        pending: applied ? [] : [row],
        mutation: applied,
        direct: [],
        observedAt: new Date(f.dependencies.now()).toISOString(),
        noActiveAutomaticSalaryLinks: true,
      };
    },
    async claimAndExecute(binding) {
      claims += 1;
      assert.notEqual(
        binding.row.operation_id,
        f.parent.binding.initialRow.operation_id,
      );
      resource.transaction.version += 1;
      resource.transaction.note = binding.row.payload.note;
      applied = {
        ...binding.row,
        status: "applied",
        attempt_count: 1,
        processed_at: new Date(f.dependencies.now()).toISOString(),
        result: {
          transaction: {
            transaction: {
              id: f.manifest.binding.resourceId,
              version: resource.transaction.version,
              note: resource.transaction.note,
            },
          },
        },
      };
      return { outcome: "processed-once", claimed: 1, executed: 1 };
    },
  });
  assert.deepEqual(result, { outcome: "completed", phases: 6, claims: 5 });
  assert.equal(claims, 4);
  assert.equal(resource.transaction.version, 7);
  assert.equal(resource.transaction.note, null);
});

for (const [name, change] of [
  [
    "parent missing",
    (f) => {
      f.evidence.parentManifestRaw = "{}";
    },
  ],
  [
    "parent running",
    (f) => {
      f.evidence.ownedStop.running = true;
    },
  ],
  [
    "parent inflight",
    (f) => {
      const p = JSON.parse(f.evidence.parentJournalRaw);
      p.state.inflight = {};
      f.evidence.parentJournalRaw = JSON.stringify(p);
      f.manifest.restoredSuccessor.pins.parentJournalSha256 = sha256(
        f.evidence.parentJournalRaw,
      );
    },
  ],
  [
    "parent budget",
    (f) => {
      const p = JSON.parse(f.evidence.parentJournalRaw);
      p.state.claims = 0;
      f.evidence.parentJournalRaw = JSON.stringify(p);
      f.manifest.restoredSuccessor.pins.parentJournalSha256 = sha256(
        f.evidence.parentJournalRaw,
      );
    },
  ],
  [
    "restoration receipt missing",
    (f) => {
      f.observation.receipts = [];
    },
  ],
  [
    "wrong restoration hash",
    (f) => {
      f.observation.receipts[0].sqlText = "{}";
    },
  ],
  [
    "financial change",
    (f) => {
      f.observation.resource.transaction.amount_minor = 5;
    },
  ],
  [
    "wrong version",
    (f) => {
      f.observation.resource.transaction.version = 4;
    },
  ],
  [
    "inactive owner",
    (f) => {
      f.observation.ownerActive = false;
    },
  ],
  [
    "wrong device owner",
    (f) => {
      f.observation.deviceActiveSameOwner = false;
    },
  ],
  [
    "global pending",
    (f) => {
      f.observation.pending = [{}];
    },
  ],
  [
    "original auth changed",
    (f) => {
      f.observation.original.factor_age_seconds = 999;
    },
  ],
]) {
  test(`${name} rejects fixed admission before any journal or claim`, () => {
    const f = successorFixture();
    change(f);
    assert.throws(
      () => restoredSeed(f.manifest, f.evidence, f.observation),
      /SUCCESSOR_/,
    );
    assert.equal(f.events.length, 0);
  });
}

test("old operation identity cannot be rebound as a fresh remaining phase", async () => {
  const f = successorFixture();
  let claimCalls = 0;
  await assert.rejects(
    session.runRestoredSuccessor(f.manifest, {
      ...f.dependencies,
      admitRestoredSuccessor: async () => ({
        evidence: f.evidence,
        observation: f.observation,
      }),
      journal: { beginRestoredSuccessor() {}, save() {} },
      observe: async () => ({
        ...f.observation,
        resource: structuredClone(f.observation.resource),
        pending: [
          { ...structuredClone(f.parent.binding.initialRow), base_version: 3 },
        ],
      }),
      claimAndExecute() {
        claimCalls += 1;
      },
    }),
    /SESSION_OPERATION_REPLAY/,
  );
  assert.equal(claimCalls, 0);
});

test("deadline or shutdown during admission cannot reserve a successor", async () => {
  for (const failure of ["deadline", "shutdown", "reservation"]) {
    const f = successorFixture();
    let now = f.dependencies.now(),
      stopping = false,
      reserved = 0,
      claimCalls = 0;
    await assert.rejects(
      session.runRestoredSuccessor(f.manifest, {
        ...f.dependencies,
        now: () => now,
        stopping: () => stopping,
        admitRestoredSuccessor: async () => {
          if (failure === "deadline") now = Date.parse(f.manifest.deadlineAt);
          if (failure === "shutdown") stopping = true;
          return { evidence: f.evidence, observation: f.observation };
        },
        journal: {
          beginRestoredSuccessor() {
            reserved += 1;
            throw Error("SYNTHETIC_ADMISSION_INTERRUPTED");
          },
        },
        claimAndExecute() {
          claimCalls += 1;
        },
      }),
      failure === "reservation"
        ? /SYNTHETIC_ADMISSION_INTERRUPTED/
        : /SESSION_SHUTDOWN_OR_DEADLINE/,
    );
    assert.equal(reserved, failure === "reservation" ? 1 : 0);
    assert.equal(claimCalls, 0);
  }
});

test("uncertain successor claim retains parent consumption and the one new exact inflight binding", async () => {
  const f = successorFixture();
  const row = {
    ...structuredClone(f.parent.binding.initialRow),
    id: id(99),
    operation_id: id(98),
    base_version: 3,
    created_at: new Date(f.dependencies.now()).toISOString(),
    payload: { note: f.manifest.phases[2], reason: "Synthetic successor" },
  };
  row.payload_hash = require("./session-fixture.cjs").normalReceivedHash(row);
  let stopped,
    claims = 0;
  await assert.rejects(
    session.runRestoredSuccessor(f.manifest, {
      ...f.dependencies,
      admitRestoredSuccessor: async () => ({
        evidence: f.evidence,
        observation: f.observation,
      }),
      journal: {
        beginRestoredSuccessor() {},
        save(state) {
          stopped = structuredClone(state);
        },
      },
      observe: async () => ({ ...f.observation, pending: [row] }),
      claimAndExecute() {
        claims += 1;
        throw Error("CLAIM_COMMIT_UNCERTAIN");
      },
    }),
    /CLAIM_COMMIT_UNCERTAIN/,
  );
  assert.equal(claims, 1);
  assert.equal(stopped.claims, 2);
  assert.equal(stopped.phase, 2);
  assert.equal(stopped.status, "stopped");
  assert.deepEqual(stopped.operations, [
    f.parent.binding.initialRow.operation_id,
    row.operation_id,
  ]);
  assert.deepEqual(stopped.inflight.row, row);
});

for (const drift of [false, true]) {
  test(`fresh full RR admission ${drift ? "rejects provenance drift before any reservation" : "validates all restoration data on the same held client"}`, async () => {
    const f = successorFixture(),
      calls = [];
    const definition = "synthetic admission function";
    f.manifest.target = syntheticManifest().target;
    f.manifest.provenance = {
      catalogSha256: sha256(canonical({})),
      claimSha256: sha256(definition),
      completeSha256: sha256(definition),
      retrySha256: sha256(definition),
    };
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
                ...f.manifest.target,
                version: 170006,
                isolation: "repeatable read",
                readOnly: "on",
              },
            ],
          };
        if (sql.includes("has_table_privilege"))
          return { rows: [{ allowed: true, filtered: false }] };
        if (sql.includes("'functions'"))
          return { rows: [{ catalog: drift ? { changed: true } : {} }] };
        if (sql.startsWith("select pg_get_functiondef"))
          return { rows: [{ definition }] };
        if (sql.includes("status in ('received','processing')"))
          return { rows: [] };
        if (sql.includes("operation_id=$1"))
          return { rows: [{ row: f.observation.original }] };
        if (sql.includes("transaction_postings"))
          return { rows: [f.observation.resource] };
        if (sql.includes("private.idempotency_keys"))
          return { rows: f.observation.receipts };
        if (sql.includes("audit.transaction_revisions"))
          return { rows: f.observation.revisions };
        if (sql.includes("owner_active"))
          return {
            rows: [{ owner_active: true, device_active_same_owner: true }],
          };
        if (sql.includes("select not exists"))
          return { rows: [{ clear: true }] };
        if (sql.includes("clock_timestamp"))
          return { rows: [{ observed: new Date(f.observation.observedAt) }] };
        if (/^(begin |set local |rollback$)/.test(sql)) return { rows: [] };
        throw Error("UNEXPECTED_SYNTHETIC_ADMISSION_QUERY");
      },
    };
    const read = admitRestoredSuccessor(
      { createBootstrapClient: () => client },
      f.manifest,
      f.evidence,
    );
    if (drift) await assert.rejects(read, /CATALOG_PROVENANCE_MISMATCH/);
    else {
      const result = await read;
      assert.equal(
        restoredSeed(f.manifest, result.evidence, result.observation).phase,
        2,
      );
      assert.ok(
        calls.findIndex((sql) => sql.includes("'functions'")) <
          calls.findIndex((sql) => sql.includes("operation_id=$1")),
      );
    }
    assert.equal(calls.filter((sql) => sql === "connect").length, 1);
    assert.equal(
      calls.filter(
        (sql) => sql === "begin isolation level repeatable read read only",
      ).length,
      1,
    );
    assert.deepEqual(calls.slice(-2), ["rollback", "end"]);
    assert.equal(
      calls.some((sql) => sql.includes("claim_client_mutations(")),
      false,
    );
  });
}
