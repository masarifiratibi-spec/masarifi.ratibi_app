const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runSession, normalizedMutationEnvelope } = require("./session.cjs");
const {
  sessionFixture,
  normalReceivedHash,
  apiRequire,
} = require("./session-fixture.cjs");
const { canonical, sha256 } = require("../t03-exact-sync/manifest.cjs");
const { normalizeMutationBatch } = apiRequire("./src/sync/sync.dto.ts");
const { hashSyncMutation } = apiRequire("./src/sync/sync.codec.ts");

test("normal API normalized mutation envelope hashes pass the finite consumer unchanged", async () => {
  const f = sessionFixture();
  const row = f.manifest.binding.initialRow;
  const normalized = normalizeMutationBatch({
    mutations: [
      {
        operationId: row.operation_id,
        domain: row.domain,
        resourceType: row.resource_type,
        schemaVersion: row.schema_version,
        dependsOn: row.depends_on,
        operation: row.operation,
        resourceId: row.resource_id,
        baseVersion: Number(row.base_version),
        payload: row.payload,
      },
    ],
  }).executionOrder[0];
  row.payload_hash = hashSyncMutation(normalized);
  assert.deepEqual(normalizedMutationEnvelope(row), normalized);
  const observe = f.dependencies.observe;
  f.dependencies.observe = async (state) => {
    const observation = await observe(state);
    if (state.phase === 0 && observation.pending.length)
      observation.pending[0].payload_hash = row.payload_hash;
    return observation;
  };
  const immutable = structuredClone(row);
  assert.equal(
    (await runSession(f.manifest, f.dependencies)).outcome,
    "completed",
  );
  assert.deepEqual(f.manifest.binding.initialRow, immutable);
});

test("payload-only and changed body or envelope hashes fail before binding or claim", async () => {
  for (const variant of [
    "payload-only",
    "body",
    "operationId",
    "baseVersion",
    "dependencies",
    "missing-normal-hasher",
  ]) {
    const f = sessionFixture();
    const row = f.manifest.binding.initialRow;
    const envelope = normalizedMutationEnvelope(row);
    const signed = structuredClone(envelope);
    if (variant === "body") signed.payload.reason = "Different signed body";
    if (variant === "operationId")
      signed.operationId = "00000000-0000-4000-8000-000000000099";
    if (variant === "baseVersion") signed.baseVersion = 2;
    if (variant === "dependencies")
      signed.dependsOn = ["00000000-0000-4000-8000-000000000098"];
    row.payload_hash =
      variant === "payload-only"
        ? `sha256:${sha256(canonical(row.payload))}`
        : hashSyncMutation(signed);
    if (variant === "missing-normal-hasher")
      delete f.dependencies.hashNormalizedCommand;
    const immutable = structuredClone(row);
    const observe = f.dependencies.observe;
    f.dependencies.observe = async (state) => {
      const observation = await observe(state);
      if (state.phase === 0 && observation.pending.length)
        observation.pending[0].payload_hash = row.payload_hash;
      return observation;
    };
    await assert.rejects(
      runSession(f.manifest, f.dependencies),
      /SESSION_PAYLOAD_HASH/,
      variant,
    );
    assert.equal(f.events.filter((event) => event.type === "claim").length, 0);
    assert.equal(f.events.at(-1).state.claims, 0);
    assert.equal(f.events.at(-1).state.inflight, null);
    assert.deepEqual(f.manifest.binding.initialRow, immutable);
  }
});

test("finite consumer automatically discovers all six ordered operations and durably binds each before claiming", async () => {
  const f = sessionFixture();
  assert.deepEqual(await runSession(f.manifest, f.dependencies), {
    outcome: "completed",
    phases: 6,
    claims: 6,
  });
  assert.equal(f.events.filter((e) => e.type === "claim").length, 6);
  for (const event of f.events.filter((e) => e.type === "claim")) {
    const before = f.events.slice(0, f.events.indexOf(event));
    assert.ok(
      before.some(
        (entry) =>
          entry.type === "persist" &&
          entry.state.inflight?.row.id === event.row.id,
      ),
    );
  }
  assert.equal(f.resource.transaction.note, null);
});
test("finite consumer recognizes immutable exact legacy input without adding a raw reason", async () => {
  const f = sessionFixture(),
    original = f.manifest.binding.originalEffective;
  const payload = {
    title: original.title,
    merchant: original.merchant,
    note: f.manifest.phases[0],
    occurredAt: original.occurredAt,
    amountMinor: original.amountMinor,
  };
  f.manifest.binding.initialRow.payload = payload;
  f.manifest.binding.initialRow.payload_hash = normalReceivedHash(
    f.manifest.binding.initialRow,
  );
  const observe = f.dependencies.observe;
  f.dependencies.observe = async (state) => {
    const value = await observe(state);
    if (state.phase === 0 && value.pending.length) {
      value.pending[0].payload = structuredClone(payload);
      value.pending[0].payload_hash =
        f.manifest.binding.initialRow.payload_hash;
    }
    return value;
  };
  assert.equal(
    (await runSession(f.manifest, f.dependencies)).outcome,
    "completed",
  );
  const raw = f.events.find((event) => event.type === "claim").row.payload;
  assert.deepEqual(raw, payload);
  assert.equal(Object.hasOwn(raw, "reason"), false);
});

for (const [variant, transform, expected] of [
  [
    "unrelated work",
    (o) => o.pending.push({ ...o.pending[0], id: "unrelated" }),
    /SESSION_UNRELATED_PENDING/,
  ],
  [
    "other owner",
    (o) => {
      o.pending[0].user_id = "other";
    },
    /SESSION_OPERATION_BINDING/,
  ],
  [
    "financial drift",
    (o) => {
      o.resource.transaction.amount_minor = 3000;
    },
    /SESSION_FINANCIAL_DRIFT/,
  ],
  [
    "out of order note",
    (o) => {
      o.pending[0].payload.note = "QA-T03-COLD-20261025";
    },
    /SESSION_INITIAL_ROW_CHANGED/,
  ],
  [
    "unknown payload field",
    (o) => {
      o.pending[0].payload.deletedAt = null;
    },
    /SESSION_INITIAL_ROW_CHANGED/,
  ],
  [
    "already attempted",
    (o) => {
      o.pending[0].attempt_count = 1;
    },
    /SESSION_OPERATION_STATE/,
  ],
]) {
  test(`${variant} stops with zero claims`, async () => {
    const f = sessionFixture();
    const observe = f.dependencies.observe;
    f.dependencies.observe = async (state) => {
      const o = await observe(state);
      transform(o);
      return o;
    };
    await assert.rejects(runSession(f.manifest, f.dependencies), expected);
    assert.equal(f.events.filter((e) => e.type === "claim").length, 0);
    assert.equal(f.events.at(-1).state.status, "stopped");
  });
}

test("later financial payload or replay cannot be rebound as another phase", async () => {
  for (const variant of ["financial", "replay", "old"]) {
    const f = sessionFixture();
    const observe = f.dependencies.observe;
    f.dependencies.observe = async (state) => {
      const o = await observe(state);
      if (state.phase === 1) {
        if (variant === "financial") o.pending[0].payload.amountMinor = 3000;
        if (variant === "replay")
          o.pending[0].operation_id = state.operations[0];
        if (variant === "old") o.pending[0].created_at = "2026-10-24T00:00:00Z";
        o.pending[0].payload_hash = normalReceivedHash(o.pending[0]);
      }
      return o;
    };
    await assert.rejects(
      runSession(f.manifest, f.dependencies),
      new RegExp(
        {
          financial: "SESSION_PAYLOAD_NOT_NOTE_ONLY",
          replay: "SESSION_OPERATION_REPLAY",
          old: "SESSION_OLD_OPERATION",
        }[variant],
      ),
    );
    assert.equal(f.events.filter((e) => e.type === "claim").length, 1);
  }
});

test("ordinary direct PATCH restorations advance only with new correlated API receipts and exact state", async () => {
  const f = sessionFixture();
  const observe = f.dependencies.observe;
  f.dependencies.observe = async (state) => {
    const o = await observe(state);
    if (state.phase % 2 === 1) {
      f.resource.transaction.note = null;
      f.resource.transaction.version = state.version + 1;
      o.resource = structuredClone(f.resource);
      o.pending = [];
      o.direct = [
        {
          actor_id: f.manifest.binding.userId,
          scope: "ledger.transaction.revise",
          resource_ref: f.manifest.binding.resourceId,
          state: "completed",
          response_status: 200,
          key_hash: `sha256:${String(state.phase).repeat(64)}`,
          created_at: state.phaseStartedAt,
          response_body: {
            requestId: `direct-${state.phase}`,
            transaction: {
              requestId: `direct-${state.phase}`,
              transaction: {
                id: f.manifest.binding.resourceId,
                version: state.version + 1,
                note: null,
              },
            },
          },
        },
      ];
    }
    return o;
  };
  assert.deepEqual(await runSession(f.manifest, f.dependencies), {
    outcome: "completed",
    phases: 6,
    claims: 3,
  });
  assert.equal(f.events.at(-1).state.directReceipts.length, 3);
});

test("direct state change without a correlated receipt stops without manufacturing cleanup", async () => {
  const f = sessionFixture();
  const observe = f.dependencies.observe;
  f.dependencies.observe = async (state) => {
    const o = await observe(state);
    if (state.phase === 1) {
      o.pending = [];
      o.resource.transaction.note = null;
      o.resource.transaction.version += 1;
    }
    return o;
  };
  await assert.rejects(
    runSession(f.manifest, f.dependencies),
    /SESSION_DIRECT_RECEIPT_AMBIGUOUS/,
  );
  assert.equal(f.events.filter((e) => e.type === "claim").length, 1);
});

test("an active automatic salary link stops the next observation before claim", async () => {
  const f = sessionFixture();
  const observe = f.dependencies.observe;
  f.dependencies.observe = async (state) => ({
    ...(await observe(state)),
    noActiveAutomaticSalaryLinks: false,
  });
  await assert.rejects(
    runSession(f.manifest, f.dependencies),
    /SESSION_ACTIVE_SALARY_LINK/,
  );
  assert.equal(f.events.filter((event) => event.type === "claim").length, 0);
});

test("processed once without applied receipt stops; no automatic attempt follows", async () => {
  const f = sessionFixture();
  const observe = f.dependencies.observe;
  f.dependencies.observe = async (state) => {
    const o = await observe(state);
    if (o.mutation) o.mutation.status = "received";
    return o;
  };
  await assert.rejects(
    runSession(f.manifest, f.dependencies),
    /SESSION_APPLIED_RECEIPT_REQUIRED/,
  );
  assert.equal(f.events.filter((e) => e.type === "claim").length, 1);
  assert.equal(f.events.at(-1).state.claims, 1);
  assert.ok(f.events.at(-1).state.inflight);
});

test("uncertain execution retains exact durable inflight binding and consumed budget", async () => {
  const f = sessionFixture();
  f.onClaim = async () => {
    throw new Error("CLAIM_COMMIT_UNCERTAIN");
  };
  await assert.rejects(
    runSession(f.manifest, f.dependencies),
    /CLAIM_COMMIT_UNCERTAIN/,
  );
  const stopped = f.events.at(-1).state;
  assert.equal(stopped.claims, 1);
  assert.equal(stopped.phase, 0);
  assert.equal(stopped.inflight.row.id, f.manifest.binding.initialRow.id);
  assert.equal(f.events.filter((e) => e.type === "claim").length, 1);
});

test("shutdown and finite deadline stop before another claim; cap cannot be increased by manifest", async () => {
  for (const variant of ["shutdown", "deadline", "budget"]) {
    const f = sessionFixture();
    if (variant === "shutdown") f.dependencies.stopping = () => true;
    if (variant === "deadline") {
      const observe = f.dependencies.observe;
      f.dependencies.observe = async (state) => {
        const o = await observe(state);
        f.dependencies.now = () => Date.parse(f.manifest.deadlineAt);
        return o;
      };
    }
    if (variant === "budget") f.manifest.maxClaims = 7;
    await assert.rejects(
      runSession(f.manifest, f.dependencies),
      /SESSION_SHUTDOWN|SESSION_LIMIT_OR_PHASES/,
    );
    assert.equal(f.events.filter((e) => e.type === "claim").length, 0);
  }
});
