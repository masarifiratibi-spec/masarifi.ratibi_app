const { test, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  receipt,
  database,
  apiRequire,
  connect,
  initialize,
} = require("./product-fixture.cjs");
const { canonical, sha256 } = require("../t03-exact-sync/manifest.cjs");
const {
  claimTransaction,
  catalogSql,
  verifyNoSalaryLink,
} = require("../t03-exact-sync/runner.cjs");
const {
  runSession,
  runRestoredSuccessor,
  PHASES,
  financialFingerprint,
} = require("./session.cjs");
const { KIND } = require("./successor.cjs");
const {
  verifyApiCommandConnection,
  verifyWorkerOutcomeCapabilities,
  admitRestoredSuccessor,
} = require("./adapter.cjs");
const { LedgerService } = apiRequire("./src/ledger/ledger.service.ts");
const { SecurityRepository } = apiRequire(
  "./src/security/security.repository.ts",
);
const { prepareClaimedMutationRuntime } = apiRequire(
  "./src/sync/claimed-mutation.runtime.ts",
);
const { LedgerRepository } = apiRequire("./src/ledger/ledger.repository.ts");
const { SyncRepository } = apiRequire("./src/sync/sync.repository.ts");
const { normalizeMutationBatch } = apiRequire("./src/sync/sync.dto.ts");
const { hashSyncMutation } = apiRequire("./src/sync/sync.codec.ts");
const { hashNormalizedCommand } = apiRequire("./src/ledger/idempotency.ts");
let admin, runtime, fixture;
const workerId = "t03-product-fixture";

function config(kind, thresholds) {
  const values = {
    DATABASE_URL: `postgresql://${kind === "api" ? "t03_api_login" : "t03_normal"}@127.0.0.1:55473/${database}`,
    MASARIFI_PROCESS_KIND: kind,
    MASARIFI_DATABASE_POOL_MAX: 1,
    MASARIFI_SYNC_RETRY_BASE_SECONDS: 1,
    MASARIFI_SYNC_RETRY_MAX_SECONDS: 300,
    MASARIFI_SYNC_RETRY_JITTER_MS: 0,
    MASARIFI_SYNC_MAX_ATTEMPTS: 10,
    MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
    MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS: thresholds,
  };
  return {
    get: (key) => values[key],
    getRequired: (key) => {
      assert.notEqual(values[key], undefined);
      return values[key];
    },
  };
}
const workerConfig = config("worker");
const apiConfig = config("api");
before(async () => {
  admin = await initialize();
});
beforeEach(async () => {
  runtime = await prepareClaimedMutationRuntime(
    workerConfig,
    apiConfig,
    workerId,
    "f".repeat(64),
  );
  const userId = `synthetic-product-${randomUUID()}`,
    accountId = randomUUID(),
    deviceId = randomUUID();
  await admin.query("begin");
  try {
    await admin.query("set local role masarifi_migration");
    await admin.query(
      "insert into public.profiles(id,status) values($1,'active')",
      [userId],
    );
    await admin.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Synthetic cash','cash','SAR')",
      [accountId, userId],
    );
    await admin.query(
      "insert into public.user_devices(id,user_id,device_fingerprint,platform,app_version) values($1,$2,$3,'android','1.0.0')",
      [deviceId, userId, `h1:${sha256(userId)}`],
    );
    await admin.query("commit");
  } catch (error) {
    await admin.query("rollback");
    throw error;
  }
  const principal = {
    userId,
    sessionId: "synthetic-product-seed",
    factorAgeSeconds: 0,
  };
  const result = await new LedgerRepository(
    runtime.apiCommandPool,
    apiConfig,
  ).mutate({
    operation: "createTransaction",
    scope: "ledger.transaction.create",
    principal,
    idempotencyKey: randomUUID(),
    requestId: randomUUID(),
    status: 201,
    command: {
      kind: "expense",
      amountMinor: 2000,
      currency: "SAR",
      accountId,
      categoryId: null,
      title: "Synthetic product QA",
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: new Date(Date.now() - 1000).toISOString(),
      source: "manual",
      externalRef: null,
    },
  });
  fixture = {
    userId,
    accountId,
    deviceId,
    principal,
    resourceId: result.transaction.transaction.id,
  };
});
afterEach(async () => {
  if (runtime) {
    await runtime.close();
    runtime = undefined;
  }
});
after(async () => {
  if (admin) await admin.end();
});

async function resource() {
  return (
    await admin.query(
      `select to_jsonb(t) transaction,coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.transaction_postings p where p.transaction_id=t.id),'[]'::jsonb) postings from public.transactions t where t.id::text=$1`,
      [fixture.resourceId],
    )
  ).rows[0];
}
async function mutation(
  note,
  baseVersion = 1,
  ageSeconds = 0,
  actor = fixture,
  payloadOverride = undefined,
) {
  const id = randomUUID(),
    operationId = randomUUID(),
    payload = payloadOverride ?? {
      note,
      reason: "Synthetic product note revision",
    };
  const normalized = normalizeMutationBatch({
    mutations: [
      {
        operationId,
        domain: "transactions",
        resourceType: "transaction",
        schemaVersion: 1,
        dependsOn: [],
        resourceId: fixture.resourceId,
        operation: "update",
        baseVersion,
        payload,
      },
    ],
  }).executionOrder[0];
  await admin.query(
    `insert into public.client_mutations(id,user_id,device_id,operation_id,domain,resource_type,schema_version,depends_on,resource_id,operation,base_version,payload_hash,payload,status,authenticated_at) values($1,$2,$3,$4,'transactions','transaction',1,'{}',$5,'update',$6,$7,$8,'received',clock_timestamp()-make_interval(secs=>$9))`,
    [
      id,
      actor.userId,
      actor.deviceId,
      operationId,
      fixture.resourceId,
      baseVersion,
      hashSyncMutation(normalized),
      payload,
      ageSeconds,
    ],
  );
  return (
    await admin.query(
      "select to_jsonb(m) row from public.client_mutations m where id=$1",
      [id],
    )
  ).rows[0].row;
}
async function state(row) {
  return (
    await admin.query(
      "select to_jsonb(m) row from public.client_mutations m where id=$1",
      [row.id],
    )
  ).rows[0].row;
}
function legacyPayload(note, r) {
  return {
    title: r.transaction.title,
    merchant: r.transaction.merchant,
    note,
    occurredAt: new Date(r.transaction.occurred_at).toISOString(),
    amountMinor: r.transaction.amount_minor,
  };
}
function immutableMutation(row) {
  return Object.fromEntries(
    [
      "payload",
      "payload_hash",
      "operation_id",
      "user_id",
      "device_id",
      "resource_id",
      "base_version",
      "authenticated_at",
      "factor_age_seconds",
      "created_at",
    ].map((key) => [key, row[key]]),
  );
}
function effective(r) {
  const t = r.transaction;
  return {
    kind: t.kind,
    amountMinor: t.amount_minor,
    currencyCode: t.currency_code,
    accountId: fixture.accountId,
    categoryId: t.category_id,
    title: t.title,
    merchant: t.merchant,
    paymentMethod: t.payment_method,
    note: t.note,
    occurredAt: new Date(t.occurred_at).toISOString(),
  };
}
async function guardedClaim(row, r = undefined) {
  await runtime.normalPool.withClient(async (client) => {
    try {
      await client.query("begin read only");
      await verifyWorkerOutcomeCapabilities(client);
    } finally {
      await client.query("rollback");
    }
  });
  await runtime.apiCommandPool.withClient(async (client) => {
    try {
      await client.query("begin isolation level repeatable read read only");
      await verifyApiCommandConnection(client, {
        database,
        apiSessionUser: "t03_api_login",
        address: "127.0.0.1",
        port: 55473,
      });
    } finally {
      await client.query("rollback");
    }
  });
  r ??= await resource();
  const provenance = {
    catalogSha256: sha256(
      canonical((await admin.query(catalogSql)).rows[0].catalog),
    ),
  };
  for (const [name, signature] of [
    ["claim", "private.claim_client_mutations(text,integer,integer)"],
    [
      "complete",
      "private.complete_client_mutation(uuid,uuid,text,jsonb,jsonb)",
    ],
    [
      "retry",
      "private.retry_client_mutation(uuid,uuid,timestamp with time zone,text)",
    ],
  ])
    provenance[`${name}Sha256`] = sha256(
      (
        await admin.query(
          "select pg_get_functiondef($1::regprocedure) definition",
          [signature],
        )
      ).rows[0].definition,
    );
  const manifest = {
    workerId,
    leaseSeconds: 60,
    target: {
      database,
      user: "t03_bootstrap",
      sessionUser: "t03_bootstrap",
      workerSessionUser: "t03_normal",
      address: "127.0.0.1",
      port: 55473,
      systemIdentifier: receipt.systemIdentifier,
    },
    provenance,
    binding: {
      row,
      resourceSha256: sha256(canonical(r)),
      original: effective(r),
    },
  };
  const reader = await connect("t03_bootstrap");
  try {
    return await claimTransaction(reader, runtime, manifest);
  } finally {
    await reader.end();
  }
}
async function ledgerEvidence(row) {
  return (
    await admin.query(
      `select (select count(*)::int from audit.transaction_revisions where transaction_id=$1) revisions,(select count(*)::int from audit.audit_events where resource_id=$1::text and action='transaction.revised') audit,(select count(*)::int from private.outbox_events where aggregate_id=$1 and event_type='transaction.revised') outbox,(select count(*)::int from private.outbox_events where aggregate_id=$1 and published_at is not null) published,(select count(*)::int from private.idempotency_keys where actor_id=$2 and scope='ledger.transaction.revise' and key_hash=$3 and state='completed' and response_status=200) completed`,
      [
        fixture.resourceId,
        fixture.userId,
        `sha256:${sha256(row.operation_id)}`,
      ],
    )
  ).rows[0];
}

test("real legacy five-field separated command applies note with ordinary reason, immutable raw input and exactly one effect", async () => {
  const before = await resource();
  const row = await mutation(
    "Real product note",
    1,
    0,
    fixture,
    legacyPayload("Real product note", before),
  );
  const raw = immutableMutation(row);
  const claimed = await guardedClaim(row);
  await runtime.executeClaim(claimed);
  const after = await resource();
  assert.equal(after.transaction.note, "Real product note");
  assert.equal(after.transaction.version, 2);
  assert.equal(financialFingerprint(after), financialFingerprint(before));
  assert.equal((await state(row)).status, "applied");
  assert.deepEqual(immutableMutation(await state(row)), raw);
  assert.equal(Object.hasOwn(row.payload, "reason"), false);
  assert.equal(
    (
      await admin.query(
        "select reason from audit.transaction_revisions where transaction_id=$1 order by revision_no desc limit 1",
        [fixture.resourceId],
      )
    ).rows[0].reason,
    "Mobile edit",
  );
  assert.deepEqual(await ledgerEvidence(row), {
    revisions: 2,
    audit: 1,
    outbox: 1,
    published: 0,
    completed: 1,
  });
  await assert.rejects(
    runtime.executeClaim(claimed),
    /SYNC_MUTATION_LEASE_LOST/,
  );
  assert.deepEqual(await ledgerEvidence(row), {
    revisions: 2,
    audit: 1,
    outbox: 1,
    published: 0,
    completed: 1,
  });
  assert.equal((await resource()).transaction.version, 2);
});

test("real legacy present invalid reason or unknown shape rejects through ordinary validation with no ledger effect", async () => {
  const before = await resource();
  for (const extra of [
    { reason: null },
    { reason: "" },
    { reason: "  " },
    { unknown: "not-recognized" },
  ]) {
    const row = await mutation("Invalid must not apply", 1, 0, fixture, {
      ...legacyPayload("Invalid must not apply", before),
      ...extra,
    });
    const raw = immutableMutation(row);
    await runtime.executeClaim(await guardedClaim(row));
    const outcome = await state(row);
    assert.equal(outcome.status, "rejected");
    assert.equal(outcome.error.code, "VALIDATION_FAILED");
    assert.deepEqual(immutableMutation(outcome), raw);
    assert.equal(
      financialFingerprint(await resource()),
      financialFingerprint(before),
    );
    assert.equal((await resource()).transaction.note, null);
    assert.equal((await resource()).transaction.version, 1);
    assert.deepEqual(await ledgerEvidence(row), {
      revisions: 1,
      audit: 0,
      outbox: 0,
      published: 0,
      completed: 0,
    });
  }
});

test("legacy worker-only command pool cannot assume API role or mutate product ledger", async () => {
  const worker = await connect("t03_normal");
  try {
    await worker.query("begin read only");
    await assert.rejects(worker.query("set local role masarifi_api"), {
      code: "42501",
    });
  } finally {
    await worker.query("rollback");
    await worker.end();
  }
  const row = await mutation("Must not apply through worker-only handler");
  await assert.rejects(
    new LedgerRepository(runtime.normalPool, apiConfig).replayCompleted({
      operation: "reviseTransaction",
      scope: "ledger.transaction.revise",
      principal: fixture.principal,
      idempotencyKey: row.operation_id,
      requestId: row.operation_id,
      status: 200,
      command: {
        transactionId: fixture.resourceId,
        expectedVersion: 1,
        reason: row.payload.reason,
        patch: { note: row.payload.note },
      },
    }),
  );
  // No guarded claim happened; use ordinary fixture owner cancellation is forbidden.
  // Retain this pending row for the final explicit no-claim assertion and finish it normally.
  assert.equal((await state(row)).attempt_count, 0);
  assert.equal((await resource()).transaction.version, 1);
  await runtime.executeClaim(await guardedClaim(row));
  assert.equal((await state(row)).status, "applied");
});

test("missing API command capability and mismatched API target abort before mutable claim", async () => {
  const row = await mutation("Capability guarded note");
  try {
    await admin.query(
      "revoke execute on function private.complete_idempotency_key(text,text,text,text,integer,jsonb,text) from masarifi_api",
    );
    await assert.rejects(
      guardedClaim(row),
      /QA_API_FUNCTION_CAPABILITY_MISSING/,
    );
    assert.equal((await state(row)).attempt_count, 0);
    assert.equal((await resource()).transaction.version, 1);
  } finally {
    await admin.query(
      "grant execute on function private.complete_idempotency_key(text,text,text,text,integer,jsonb,text) to masarifi_api",
    );
  }
  try {
    await admin.query(
      "revoke select(reason) on audit.transaction_revisions from masarifi_api",
    );
    await assert.rejects(
      guardedClaim(row),
      /QA_API_AUDIT_COLUMN_CAPABILITY_MISSING/,
    );
    assert.equal((await state(row)).attempt_count, 0);
  } finally {
    await admin.query(
      "grant select(reason) on audit.transaction_revisions to masarifi_api",
    );
  }
  for (const role of ["masarifi_api", "masarifi_worker"]) {
    try {
      await admin.query(
        `grant insert(transaction_id) on public.salary_receipts to ${role}`,
      );
      await assert.rejects(
        guardedClaim(row),
        /QA_SALARY_WRITE_ACCESS_BROADENED/,
      );
      assert.equal((await state(row)).attempt_count, 0);
    } finally {
      await admin.query(
        `revoke insert(transaction_id) on public.salary_receipts from ${role}`,
      );
    }
  }
  await assert.rejects(
    runtime.apiCommandPool.withClient(async (client) => {
      try {
        await client.query("begin isolation level repeatable read read only");
        await verifyApiCommandConnection(client, {
          database,
          apiSessionUser: "t03_api_login",
          address: "127.0.0.2",
          port: 55473,
        });
      } finally {
        await client.query("rollback");
      }
    }),
    /QA_API_COMMAND_CONNECTION_MISMATCH/,
  );
  assert.equal((await state(row)).attempt_count, 0);
  await runtime.executeClaim(await guardedClaim(row));
  assert.equal((await state(row)).status, "applied");
});

test("version conflict reads target via API and records conflict through worker without overwriting correction", async () => {
  const row = await mutation("Queued note");
  const claimed = await guardedClaim(row);
  await new LedgerRepository(runtime.apiCommandPool, apiConfig).mutate({
    operation: "reviseTransaction",
    scope: "ledger.transaction.revise",
    principal: fixture.principal,
    idempotencyKey: randomUUID(),
    requestId: randomUUID(),
    status: 200,
    command: {
      transactionId: fixture.resourceId,
      expectedVersion: 1,
      reason: "Synthetic concurrent correction",
      patch: { note: "Concurrent correction" },
    },
  });
  await runtime.executeClaim(claimed);
  assert.equal((await state(row)).status, "conflict");
  const conflict = (
    await admin.query(
      "select server_snapshot from public.transaction_conflicts where client_mutation_id=$1",
      [row.id],
    )
  ).rows[0];
  assert.equal(conflict.server_snapshot.note, "Concurrent correction");
  assert.equal((await resource()).transaction.version, 2);
});

test("ordinary API owner RLS rejects another owner even on a legitimately claimed mutation", async () => {
  const apiErrors = [],
    retryCodes = [];
  const apiWithClient = runtime.apiCommandPool.withClient.bind(
    runtime.apiCommandPool,
  );
  runtime.apiCommandPool.withClient = (action) =>
    apiWithClient(async (client) => {
      try {
        return await action(client);
      } catch (error) {
        const response = error.getResponse?.();
        if (response?.code) apiErrors.push(response.code);
        throw error;
      }
    });
  const workerWithClient = runtime.normalPool.withClient.bind(
    runtime.normalPool,
  );
  runtime.normalPool.withClient = (action) =>
    workerWithClient((client) =>
      action(
        new Proxy(client, {
          get(target, key) {
            if (key !== "query") return Reflect.get(target, key, target);
            return (sql, values) => {
              if (sql === "select private.retry_client_mutation($1,$2,$3,$4)")
                retryCodes.push(values[3]);
              return target.query(sql, values);
            };
          },
        }),
      ),
    );
  const other = {
    userId: `synthetic-other-${randomUUID()}`,
    deviceId: randomUUID(),
  };
  await admin.query(
    "insert into public.profiles(id,status) values($1,'active')",
    [other.userId],
  );
  await admin.query(
    "insert into public.user_devices(id,user_id,device_fingerprint,platform,app_version) values($1,$2,$3,'android','1.0.0')",
    [other.deviceId, other.userId, `h1:${sha256(other.userId)}`],
  );
  const row = await mutation("Foreign note forbidden", 1, 0, other);
  const claims = await new SyncRepository(runtime.normalPool).claimMutations(
    workerId,
    1,
    60,
  );
  assert.equal(claims.length, 1);
  await runtime.executeClaim(await state(row));
  assert.deepEqual(
    apiErrors,
    ["NOT_FOUND"],
    "actual normal API domain response is observed outside executor catch",
  );
  assert.deepEqual(
    retryCodes,
    [],
    "a genuine public404 is terminal, not another automatic attempt",
  );
  assert.equal((await state(row)).status, "rejected");
  assert.equal((await state(row)).error.code, "NOT_FOUND");
  assert.equal((await resource()).transaction.version, 1);
});

test("completion transport failure after real command commit retains idempotency through normal retry", async () => {
  const before = await resource();
  const row = await mutation(
    "Committed before completion failure",
    1,
    0,
    fixture,
    legacyPayload("Committed before completion failure", before),
  );
  const raw = immutableMutation(row);
  const claimed = await guardedClaim(row);
  const withClient = runtime.normalPool.withClient.bind(runtime.normalPool);
  let failedComplete = false;
  runtime.normalPool.withClient = (action) =>
    withClient((client) =>
      action(
        new Proxy(client, {
          get(target, key) {
            if (key !== "query") return Reflect.get(target, key, target);
            return (sql, values) => {
              if (
                !failedComplete &&
                sql.startsWith("select private.complete_client_mutation")
              ) {
                failedComplete = true;
                throw new Error("DATABASE_UNAVAILABLE");
              }
              return target.query(sql, values);
            };
          },
        }),
      ),
    );
  await runtime.executeClaim(claimed);
  runtime.normalPool.withClient = withClient;
  assert.equal(failedComplete, true);
  assert.equal((await state(row)).status, "received");
  assert.deepEqual(await ledgerEvidence(row), {
    revisions: 2,
    audit: 1,
    outbox: 1,
    published: 0,
    completed: 1,
  });
  const delay =
    Date.parse((await state(row)).next_attempt_at) - Date.now() + 100;
  assert.ok(delay > 0 && delay < 2000);
  await new Promise((resolve) => setTimeout(resolve, delay));
  const retried = await new SyncRepository(runtime.normalPool).claimMutations(
    workerId,
    1,
    60,
  );
  assert.equal(retried.length, 1);
  await runtime.executeClaim(await state(row));
  assert.equal((await state(row)).status, "applied");
  assert.equal((await state(row)).attempt_count, 2);
  assert.deepEqual(immutableMutation(await state(row)), raw);
  assert.equal(Object.hasOwn((await state(row)).payload, "reason"), false);
  assert.equal(
    financialFingerprint(await resource()),
    financialFingerprint(before),
  );
  assert.equal(
    (
      await admin.query(
        "select reason from audit.transaction_revisions where transaction_id=$1 order by revision_no desc limit 1",
        [fixture.resourceId],
      )
    ).rows[0].reason,
    "Mobile edit",
  );
  assert.deepEqual(await ledgerEvidence(row), {
    revisions: 2,
    audit: 1,
    outbox: 1,
    published: 0,
    completed: 1,
  });
});

test("finite controller accepts production envelope hashes and applies six submissions through real ledger guarded claims", async () => {
  const initial = await mutation(PHASES[0]);
  const immutableInitial = immutableMutation(initial);
  assert.notEqual(
    initial.payload_hash,
    `sha256:${sha256(canonical(initial.payload))}`,
  );
  const baseline = await resource();
  const journal = path.join(receipt.runDirectory, "product-session-journal");
  fs.mkdirSync(journal);
  let sequence = 0,
    submittedPhase = 0;
  const manifest = {
    version: 1,
    enabled: true,
    scope: "synthetic-fixture",
    sessionId: "t03-real-product-session",
    workerId,
    leaseSeconds: 60,
    maxClaims: 6,
    pollMs: 250,
    deadlineAt: new Date(Date.now() + 60000).toISOString(),
    phases: PHASES,
    binding: {
      userId: fixture.userId,
      deviceId: fixture.deviceId,
      resourceId: fixture.resourceId,
      initialVersion: 1,
      originalEffective: effective(baseline),
      initialRow: initial,
      resource: baseline,
    },
  };
  const save = (state) => {
    const fd = fs.openSync(
      path.join(journal, `${sequence++}.json`),
      "wx",
      0o600,
    );
    try {
      fs.writeFileSync(fd, JSON.stringify(state));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  };
  const result = await runSession(manifest, {
    hashNormalizedCommand,
    now: Date.now,
    stopping: () => false,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    journal: { begin: save, save },
    async observe(session) {
      if (session.phase > submittedPhase && session.phase < PHASES.length) {
        await mutation(PHASES[session.phase], session.version);
        submittedPhase = session.phase;
      }
      const pending = (
        await admin.query(
          "select to_jsonb(m) row from public.client_mutations m where status in ('received','processing') order by id",
        )
      ).rows.map((r) => r.row);
      return {
        pending,
        resource: await resource(),
        direct: [],
        mutation: session.inflight
          ? await state(session.inflight.row)
          : undefined,
        noActiveAutomaticSalaryLinks: await verifyNoSalaryLink(
          admin,
          fixture.resourceId,
          fixture.userId,
        ),
        observedAt: (
          await admin.query("select clock_timestamp() time")
        ).rows[0].time.toISOString(),
      };
    },
    async claimAndExecute(binding) {
      assert.ok(fs.existsSync(path.join(journal, `${sequence - 1}.json`)));
      await runtime.executeClaim(
        await guardedClaim(binding.row, binding.resource),
      );
      return { outcome: "processed-once", claimed: 1, executed: 1 };
    },
  });
  assert.deepEqual(result, { outcome: "completed", phases: 6, claims: 6 });
  assert.deepEqual(immutableMutation(await state(initial)), immutableInitial);
  assert.equal((await state(initial)).attempt_count, 1);
  assert.deepEqual(await ledgerEvidence(initial), {
    revisions: 7,
    audit: 6,
    outbox: 6,
    published: 0,
    completed: 1,
  });
  assert.equal((await resource()).transaction.note, null);
  assert.equal((await resource()).transaction.version, 7);
  assert.equal(
    financialFingerprint(await resource()),
    financialFingerprint(baseline),
  );
  assert.equal(
    (
      await admin.query(
        "select count(*)::int count from private.outbox_events where aggregate_id=$1 and published_at is not null",
        [fixture.resourceId],
      )
    ).rows[0].count,
    0,
  );
});

async function realRestoredParent() {
  const initial = await mutation(PHASES[0]);
  const baseline = await resource();
  const parent = {
    version: 1,
    enabled: true,
    scope: "synthetic-fixture",
    sessionId: "t03-real-restored-parent",
    workerId,
    leaseSeconds: 60,
    maxClaims: 6,
    pollMs: 250,
    deadlineAt: new Date(Date.now() - 1000).toISOString(),
    phases: PHASES,
    binding: {
      userId: fixture.userId,
      deviceId: fixture.deviceId,
      resourceId: fixture.resourceId,
      initialVersion: 1,
      originalEffective: effective(baseline),
      initialRow: initial,
      resource: baseline,
    },
  };
  await runtime.executeClaim(await guardedClaim(initial));
  assert.equal((await state(initial)).attempt_count, 1);
  const requestId = randomUUID();
  const service = new LedgerService(
    new LedgerRepository(runtime.apiCommandPool, apiConfig),
    new SecurityRepository(runtime.apiCommandPool),
    apiConfig,
  );
  await service.reviseTransaction({
    principal: fixture.principal,
    transactionId: fixture.resourceId,
    idempotencyKey: randomUUID(),
    requestId,
    body: { expectedVersion: 2, note: null, reason: "Mobile edit" },
  });
  const receipts = (
    await admin.query(
      `select to_jsonb(k)::text "sqlText",response_body::text "bodySqlText" from private.idempotency_keys k where actor_id=$1 and resource_ref=$2 and scope='ledger.transaction.revise' and state='completed' and response_body->>'requestId'=$3`,
      [fixture.userId, fixture.resourceId, requestId],
    )
  ).rows;
  assert.equal(receipts.length, 1);
  const k = JSON.parse(receipts[0].sqlText);
  const revisions = (
    await admin.query(
      'select to_jsonb(r)::text "sqlText" from audit.transaction_revisions r where transaction_id=$1 order by revision_no',
      [fixture.resourceId],
    )
  ).rows;
  const parentState = {
    sessionId: parent.sessionId,
    manifestSha256: sha256(canonical(parent)),
    status: "stopped",
    failure: "SESSION_EXECUTION_FAILED",
    phase: 1,
    claims: 1,
    version: 2,
    note: PHASES[0],
    inflight: null,
    operations: [initial.operation_id],
    mutations: [initial.id],
    directReceipts: [],
    deadlineAt: parent.deadlineAt,
  };
  // The local fixture doubles ONLY the external Docker/parent-host attestation.
  // Database original application, ordinary restoration, receipts and admission are real PG17.
  const evidence = {
    parentManifestRaw: JSON.stringify(parent),
    parentJournalRaw: JSON.stringify({
      sequence: 3,
      previous: "a".repeat(64),
      state: parentState,
    }),
    ownedStop: {
      containerId: "b".repeat(64),
      contractMatch: true,
      running: false,
      portsEmpty: true,
      exitCode: 1,
      oomKilled: false,
    },
    journalChainValidated: true,
    generalWorkerRunning: false,
  };
  const pins = {
    parentManifestSha256: sha256(evidence.parentManifestRaw),
    parentJournalSha256: sha256(evidence.parentJournalRaw),
    containerId: evidence.ownedStop.containerId,
    receiptSqlSha256: sha256(receipts[0].sqlText),
    receiptKeySha256: sha256(k.key_hash),
    receiptBodySqlSha256: sha256(receipts[0].bodySqlText),
    requestIdSha256: sha256(requestId),
    revisionSqlSha256: sha256(revisions[2].sqlText),
    originalPayloadHashSha256: sha256(initial.payload_hash),
  };
  const provenance = {
    catalogSha256: sha256(
      canonical((await admin.query(catalogSql)).rows[0].catalog),
    ),
  };
  for (const [name, signature] of [
    ["claim", "private.claim_client_mutations(text,integer,integer)"],
    [
      "complete",
      "private.complete_client_mutation(uuid,uuid,text,jsonb,jsonb)",
    ],
    [
      "retry",
      "private.retry_client_mutation(uuid,uuid,timestamp with time zone,text)",
    ],
  ])
    provenance[`${name}Sha256`] = sha256(
      (
        await admin.query(
          "select pg_get_functiondef($1::regprocedure) definition",
          [signature],
        )
      ).rows[0].definition,
    );
  const manifest = {
    ...parent,
    sessionId: "t03-real-restored-successor",
    deadlineAt: new Date(Date.now() + 60000).toISOString(),
    restoredSuccessor: { kind: KIND, pins },
    provenance,
    target: {
      database,
      user: "t03_bootstrap",
      sessionUser: "t03_bootstrap",
      workerSessionUser: "t03_normal",
      address: "127.0.0.1",
      port: 55473,
      systemIdentifier: receipt.systemIdentifier,
    },
  };
  const configuration = {
    createBootstrapClient() {
      let client;
      return {
        async connect() {
          client = await connect("t03_bootstrap");
        },
        query: (...args) => client.query(...args),
        end: () => client.end(),
      };
    },
  };
  return { initial, baseline, manifest, evidence, configuration };
}

test("restored successor admits real original apply and ordinary NULL restore then applies only the four remaining phases", async () => {
  const f = await realRestoredParent();
  const rawOriginal = immutableMutation(f.initial);
  let submittedPhase = 1,
    sequence = 0,
    claimCount = 0;
  const directory = path.join(
    receipt.runDirectory,
    "restored-successor-journal",
  );
  fs.mkdirSync(directory);
  const save = (state) => {
    const fd = fs.openSync(
      path.join(directory, `${sequence++}.json`),
      "wx",
      0o600,
    );
    try {
      fs.writeFileSync(fd, JSON.stringify(state));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  };
  const result = await runRestoredSuccessor(f.manifest, {
    hashNormalizedCommand,
    now: Date.now,
    stopping: () => false,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    admitRestoredSuccessor: () =>
      admitRestoredSuccessor(f.configuration, f.manifest, f.evidence),
    journal: {
      beginRestoredSuccessor(seed) {
        const marker = fs.openSync(
          path.join(
            directory,
            `parent-${seed.restoredSuccessor.parentManifestSha256}.admission`,
          ),
          "wx",
          0o600,
        );
        try {
          fs.writeFileSync(marker, canonical(seed));
          fs.fsyncSync(marker);
        } finally {
          fs.closeSync(marker);
        }
        save(seed);
      },
      save,
    },
    async observe(s) {
      if (s.phase > submittedPhase && s.phase < PHASES.length) {
        await mutation(PHASES[s.phase], s.version);
        submittedPhase = s.phase;
      }
      return {
        pending: (
          await admin.query(
            "select to_jsonb(m) row from public.client_mutations m where status in ('received','processing') order by id",
          )
        ).rows.map((r) => r.row),
        resource: await resource(),
        direct: [],
        mutation: s.inflight ? await state(s.inflight.row) : undefined,
        noActiveAutomaticSalaryLinks: await verifyNoSalaryLink(
          admin,
          fixture.resourceId,
        ),
        observedAt: (
          await admin.query("select clock_timestamp() observed")
        ).rows[0].observed.toISOString(),
      };
    },
    async claimAndExecute(binding) {
      claimCount += 1;
      assert.notEqual(binding.row.operation_id, f.initial.operation_id);
      await runtime.executeClaim(
        await guardedClaim(binding.row, binding.resource),
      );
      return { outcome: "processed-once", claimed: 1, executed: 1 };
    },
  });
  assert.deepEqual(result, { outcome: "completed", phases: 6, claims: 5 });
  assert.equal(claimCount, 4);
  assert.deepEqual(immutableMutation(await state(f.initial)), rawOriginal);
  assert.equal((await state(f.initial)).attempt_count, 1);
  assert.equal((await resource()).transaction.version, 7);
  assert.equal((await resource()).transaction.note, null);
  assert.equal(
    financialFingerprint(await resource()),
    financialFingerprint(f.baseline),
  );
  assert.deepEqual(await ledgerEvidence(f.initial), {
    revisions: 7,
    audit: 6,
    outbox: 6,
    published: 0,
    completed: 1,
  });
});

test("restored successor fresh owner-device admission rejects a real revoked device before any new claim", async () => {
  const f = await realRestoredParent();
  await admin.query(
    "update public.user_devices set revoked_at=clock_timestamp() where id=$1",
    [fixture.deviceId],
  );
  let reserved = false,
    claims = 0;
  await assert.rejects(
    runRestoredSuccessor(f.manifest, {
      hashNormalizedCommand,
      now: Date.now,
      stopping: () => false,
      admitRestoredSuccessor: () =>
        admitRestoredSuccessor(f.configuration, f.manifest, f.evidence),
      journal: {
        beginRestoredSuccessor() {
          reserved = true;
        },
      },
      claimAndExecute() {
        claims += 1;
      },
    }),
    /SUCCESSOR_CURRENT_SAFETY_REQUIRED/,
  );
  assert.equal(reserved, false);
  assert.equal(claims, 0);
  assert.equal((await state(f.initial)).attempt_count, 1);
  assert.equal((await resource()).transaction.version, 3);
  assert.equal((await resource()).transaction.note, null);
  assert.equal(
    financialFingerprint(await resource()),
    financialFingerprint(f.baseline),
  );
});

test("API policy controls real stale-auth rejection without refreshing stored authentication; no delivery adapter exists", async () => {
  await runtime.close();
  runtime = await prepareClaimedMutationRuntime(
    workerConfig,
    config("api", { SAR: 2000 }),
    workerId,
    "f".repeat(64),
  );
  const retryCodes = [];
  const withClient = runtime.normalPool.withClient.bind(runtime.normalPool);
  runtime.normalPool.withClient = (action) =>
    withClient((client) =>
      action(
        new Proxy(client, {
          get(target, key) {
            if (key !== "query") return Reflect.get(target, key, target);
            return (sql, values) => {
              if (sql === "select private.retry_client_mutation($1,$2,$3,$4)")
                retryCodes.push(values[3]);
              return target.query(sql, values);
            };
          },
        }),
      ),
    );
  const row = await mutation(
    "Must require recent auth",
    1,
    3600,
    fixture,
    legacyPayload("Must require recent auth", await resource()),
  );
  await runtime.executeClaim(await guardedClaim(row));
  const outcome = await state(row);
  assert.equal(outcome.status, "received");
  assert.deepEqual(
    retryCodes,
    ["RECENT_AUTH_REQUIRED"],
    "observe real forwarded code outside executor catch; SQL does not persist p_error_code",
  );
  assert.equal(outcome.authenticated_at, row.authenticated_at);
  assert.deepEqual(immutableMutation(outcome), immutableMutation(row));
  assert.equal((await resource()).transaction.version, 1);
  assert.equal((await resource()).transaction.note, null);
  assert.deepEqual(await ledgerEvidence(row), {
    revisions: 1,
    audit: 0,
    outbox: 0,
    published: 0,
    completed: 0,
  });
  await assert.rejects(
    admin.query("select pgmq.send('platform-events','{}'::jsonb,0)"),
    { code: "3F000" },
  );
});
