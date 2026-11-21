const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { resolve, relative, isAbsolute } = require("node:path");
const { createRequire } = require("node:module");
const { runExactOperation, catalogSql } = require("./runner.cjs");
const { canonical, sha256 } = require("./manifest.cjs");
const { syntheticManifest, sourceRoot, id } = require("./test-manifest.cjs");

const fixtureRoot = resolve(
  sourceRoot,
  ".superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17",
);
const receiptPath = resolve(
  process.env.T03_FIXTURE_RECEIPT_PATH ??
    resolve(fixtureRoot, "owned-process.json"),
);
const relativeReceipt = relative(fixtureRoot, receiptPath);
assert.ok(
  relativeReceipt &&
    !relativeReceipt.startsWith("..") &&
    !isAbsolute(relativeReceipt),
  "explicit receipt must stay in the owned fixture root",
);
if (!existsSync(receiptPath))
  throw new Error(
    "PG17_NOT_RUN: no verified owned-process receipt; fixture start was blocked by policy",
  );
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
assert.equal(
  receipt.status,
  "verified",
  "provisional ownership cannot authorize database writes",
);
for (const path of [receipt.binary, receipt.dataDirectory]) {
  const local = relative(fixtureRoot, resolve(path));
  assert.ok(
    local && !local.startsWith("..") && !isAbsolute(local),
    "fixture path containment",
  );
}
assert.equal(receipt.port, 55473);
assert.equal(receipt.listen, "127.0.0.1");
assert.equal(
  readFileSync(resolve(receipt.dataDirectory, "PG_VERSION"), "utf8").trim(),
  "17",
);
const apiRequire = createRequire(resolve(sourceRoot, "apps/api/package.json"));
const { Client } = apiRequire("pg");
apiRequire("ts-node").register({
  project: resolve(sourceRoot, "apps/api/tsconfig.json"),
});
const { PoolService } = apiRequire("./src/platform/database/pool.service.ts");
const { SyncRepository, toClaimedMutation } = apiRequire(
  "./src/sync/sync.repository.ts",
);
const { ClaimedMutationExecutor } = apiRequire(
  "./src/sync/claimed-mutation.executor.ts",
);
const { HttpException } = apiRequire("@nestjs/common");
let admin;
let pendingRuntime;

// No application environment or DATABASE_URL is read, including for the ordinary worker pool.
async function connect(user, database = "t03_synthetic") {
  const client = new Client({
    host: "127.0.0.1",
    port: receipt.port,
    user,
    password: "",
    database,
    connectionTimeoutMillis: 1000,
    query_timeout: 6000,
    ssl: false,
  });
  await client.connect();
  return client;
}

before(async () => {
  admin = await connect("t03_owner");
  const metadata = (
    await admin.query(`select current_setting('server_version_num')::int version,current_setting('data_directory') data,
    current_setting('listen_addresses') listen,inet_server_port() port,(pg_control_system()).system_identifier::text system`)
  ).rows[0];
  assert.ok(metadata.version >= 170000 && metadata.version < 180000);
  assert.equal(resolve(metadata.data), resolve(receipt.dataDirectory));
  assert.equal(metadata.listen, "127.0.0.1");
  assert.equal(metadata.port, receipt.port);
  assert.equal(metadata.system, receipt.systemIdentifier);
  assert.equal(
    (
      await admin.query("select pg_postmaster_start_time() start")
    ).rows[0].start.getTime() >=
      Date.parse(receipt.start) - 2000,
    true,
  );
  const initialized = (
    await admin.query(
      "select to_regclass('public.client_mutations') initialized",
    )
  ).rows[0].initialized;
  if (!initialized)
    await admin.query(
      readFileSync(resolve(__dirname, "fixture-schema.sql"), "utf8"),
    );
  // Existing fixture cluster is retained; narrow fixture-only ACLs now model actual
  // intentional separation: a non-super global reader cannot SET worker or claim.
  await admin.query(
    "revoke masarifi_worker from t03_bootstrap,t03_filtered,t03_no_select",
  );
  // This marker and its grant predate every baseline; rule creation/state is the only drift.
  await admin.query(
    "create table if not exists public.synthetic_rule_effects(mutation_id uuid not null)",
  );
  await admin.query(
    "grant insert on public.synthetic_rule_effects to masarifi_migration",
  );
  await admin.query(
    "create table if not exists public.salary_receipts(id uuid primary key,user_id text not null,transaction_id uuid,status text not null,automatically_detected boolean not null default false)",
  );
  await admin.query(
    "grant select on public.salary_receipts to t03_bootstrap,t03_filtered,t03_no_role",
  );
  const snapshots = JSON.parse(
    readFileSync(
      resolve(
        sourceRoot,
        ".superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/deployed-sync-functions.json",
      ),
      "utf8",
    ),
  );
  for (const fn of snapshots.functions) {
    assert.equal(sha256(fn.definition), fn.definition_sha256);
    await admin.query(fn.definition);
    const signatures = {
      claim_client_mutations: "text,integer,integer",
      complete_client_mutation: "uuid,uuid,text,jsonb,jsonb",
      retry_client_mutation: "uuid,uuid,timestamp with time zone,text",
    };
    await admin.query(
      `alter function private.${fn.function_name}(${signatures[fn.function_name]}) owner to masarifi_migration`,
    );
    await admin.query(
      `revoke all on function private.${fn.function_name}(${signatures[fn.function_name]}) from public`,
    );
    await admin.query(
      `grant execute on function private.${fn.function_name}(${signatures[fn.function_name]}) to masarifi_worker`,
    );
  }
});

beforeEach(async () => {
  await admin.query(
    "truncate public.client_mutations,public.transaction_postings,public.transactions,public.synthetic_external_effects,public.synthetic_rule_effects,public.salary_receipts",
  );
  const m = syntheticManifest();
  await insertMutation(m.binding.row);
  await admin.query(
    `insert into public.transactions(id,user_id,kind,status,amount_minor,currency_code,category_id,title,note,occurred_at,version)
    values($1,$2,'expense','confirmed',2000,'SAR',$3,'Synthetic QA',null,'2026-10-20T12:00:00Z',1)`,
    [id(3), "synthetic-owner", id(5)],
  );
  await admin.query(
    `insert into public.transaction_postings values($1,$2,$3,-2000,'confirmed','source','2026-10-20T12:00:00Z')`,
    [id(7), id(3), id(4)],
  );
});

after(async () => {
  try {
    if (pendingRuntime) await pendingRuntime.close();
  } finally {
    if (admin) await admin.end();
  }
});

async function insertMutation(row) {
  await admin.query(
    `insert into public.client_mutations(id,user_id,device_id,operation_id,domain,resource_type,schema_version,depends_on,resource_id,operation,base_version,payload_hash,payload,status,authenticated_at)
    values($1,$2,$3,$4,'transactions','transaction',1,$5,$6,'update',1,$7,$8::jsonb,'received',clock_timestamp()-interval '1 hour')`,
    [
      row.id,
      row.user_id,
      row.device_id,
      row.operation_id,
      row.depends_on,
      row.resource_id,
      `sha256:${sha256(canonical(row.payload))}`,
      JSON.stringify(row.payload),
    ],
  );
}

async function manifest(user = "t03_bootstrap") {
  const m = syntheticManifest();
  m.target = {
    ...m.target,
    user,
    sessionUser: user,
    systemIdentifier: receipt.systemIdentifier,
  };
  m.binding.row = (
    await admin.query(
      "select to_jsonb(m) row from public.client_mutations m where id=$1",
      [id(1)],
    )
  ).rows[0].row;
  const resource = (
    await admin.query(
      `select to_jsonb(t) transaction,(select jsonb_agg(to_jsonb(p) order by p.id) from public.transaction_postings p where p.transaction_id=t.id) postings from public.transactions t where id=$1`,
      [id(3)],
    )
  ).rows[0];
  m.binding.resourceSha256 = sha256(canonical(resource));
  m.provenance.catalogSha256 = sha256(
    canonical((await admin.query(catalogSql)).rows[0].catalog),
  );
  const signatures = [
    "private.claim_client_mutations(text,integer,integer)",
    "private.complete_client_mutation(uuid,uuid,text,jsonb,jsonb)",
    "private.retry_client_mutation(uuid,uuid,timestamp with time zone,text)",
  ];
  for (const [index, key] of [
    "claimSha256",
    "completeSha256",
    "retrySha256",
  ].entries())
    m.provenance[key] = sha256(
      (
        await admin.query(
          "select pg_get_functiondef($1::regprocedure) definition",
          [signatures[index]],
        )
      ).rows[0].definition,
    );
  return m;
}

async function runtime(m, options = {}) {
  const values = {
    DATABASE_URL: `postgresql://t03_normal@127.0.0.1:${receipt.port}/${options.workerDatabase ?? "t03_synthetic"}`,
    MASARIFI_PROCESS_KIND: "worker",
    MASARIFI_DATABASE_POOL_MAX: 1,
    MASARIFI_SYNC_RETRY_BASE_SECONDS: 1,
    MASARIFI_SYNC_RETRY_MAX_SECONDS: 300,
    MASARIFI_SYNC_RETRY_JITTER_MS: 0,
    MASARIFI_SYNC_MAX_ATTEMPTS: 10,
  };
  const config = {
    get: (key) => values[key],
    getRequired: (key) => {
      assert.ok(Object.hasOwn(values, key));
      return values[key];
    },
  };
  const pool = new PoolService(config);
  const repositoryPool = options.authObservation
    ? {
        withClient: (action) =>
          pool.withClient((client) =>
            action(
              new Proxy(client, {
                get(target, key) {
                  if (key !== "query") return Reflect.get(target, key, target);
                  return (sql, values) => {
                    if (
                      sql ===
                      "select private.retry_client_mutation($1,$2,$3,$4)"
                    )
                      options.authObservation.retryCodes.push(values[3]);
                    return target.query(sql, values);
                  };
                },
              }),
            ),
          ),
      }
    : pool;
  const repository = new SyncRepository(repositoryPool);
  const executor = new ClaimedMutationExecutor(
    repository,
    {
      async dispatch(principal, mutation, operationId) {
        if (options.staleAuth) {
          options.authObservation.principal = { ...principal };
          options.authObservation.recentAuthRequired =
            principal.factorAgeSeconds !== null &&
            principal.factorAgeSeconds >= 3600;
          if (options.authObservation.recentAuthRequired)
            throw new HttpException({ code: "RECENT_AUTH_REQUIRED" }, 403);
        }
        assert.equal(operationId, id(2));
        assert.equal(mutation.operationId, id(2));
        assert.equal(principal.userId, "synthetic-owner");
        const committed = (
          await admin.query(
            "select status from public.client_mutations where id=$1",
            [id(1)],
          )
        ).rows[0];
        assert.equal(
          committed.status,
          "processing",
          "handler observes committed claim on independent connection",
        );
        await admin.query(
          `insert into public.synthetic_external_effects values($1,$2,$3,$4::jsonb) on conflict(operation_id) do nothing`,
          [
            operationId,
            id(1),
            mutation.payload.note,
            JSON.stringify(principal),
          ],
        );
        if (options.loseLease)
          await admin.query(
            "update public.client_mutations set lease_token=$1 where id=$2",
            [id(99), id(1)],
          );
        if (options.crashAfterEffect) throw new Error("DATABASE_UNAVAILABLE");
        return { accepted: true, resourceId: id(3) };
      },
    },
    config,
    m.workerId,
  );
  const guardedPool = {
    withClient: (action) =>
      pool.withClient(async (client) =>
        action({
          async query(sql, values) {
            if (sql.startsWith("set transaction snapshot")) {
              if (options.importFailureObservation)
                options.importFailureObservation.reachedImport = true;
              if (options.queryBeforeImport) await client.query("select 1");
              if (options.beforeImport) await options.beforeImport();
            }
            if (sql === "commit" && options.uncertainCommit) {
              await client.query(sql, values);
              throw new Error("SYNTHETIC_LOST_COMMIT_ACK");
            }
            const result = await client.query(sql, values);
            if (sql.startsWith("set transaction snapshot")) {
              if (options.workerObservation)
                options.workerObservation.imported = true;
              await options.afterImport?.();
            }
            if (
              sql.startsWith(
                "select current_database() database,current_user role",
              ) &&
              options.workerEndpointMismatch
            ) {
              options.workerObservation.reachedIdentity = true;
              options.workerObservation.actualAddress = result.rows[0].address;
              result.rows[0].address = "127.0.0.2";
            }
            if (
              sql.startsWith(
                "select to_jsonb(m) row from private.claim_client_mutations",
              )
            )
              await options.afterClaim?.(result);
            return result;
          },
        }),
      ),
  };
  const result = {
    normalPool: guardedPool,
    imageSha256: m.provenance.imageSha256,
    executeClaim: async (row) => executor.process(toClaimedMutation(row)),
    close: async () => {
      await pool.onModuleDestroy();
      if (pendingRuntime === result) pendingRuntime = undefined;
    },
  };
  pendingRuntime = result;
  return result;
}

function dependencies(m, options = {}) {
  return {
    async authorize(value) {
      assert.equal(value.scope, "synthetic-fixture");
    },
    prepare: () => runtime(m, options),
    async connectBootstrap() {
      const client = await connect(m.target.user);
      return {
        async query(sql, values) {
          const result = await client.query(sql, values);
          if (sql.startsWith("select pg_export_snapshot()")) {
            await options.afterGuard?.();
            if (options.badToken) result.rows[0].token = "invalid' snapshot";
            if (options.expiredExporter) await client.query("rollback");
          }
          return result;
        },
        end: () => client.end(),
      };
    },
  };
}

const run = (m, options) =>
  runExactOperation(
    { manifest: m, sourceRoot, mode: "execute" },
    dependencies(m, options),
  );
const state = async (rowId = id(1)) =>
  (
    await admin.query(
      "select status,attempt_count,locked_by,lease_token from public.client_mutations where id=$1",
      [rowId],
    )
  ).rows[0];
const effects = async () =>
  Number(
    (
      await admin.query(
        "select count(*) count from public.synthetic_external_effects",
      )
    ).rows[0].count,
  );

test("exact claim commits before one supplied handler execution; replay does not execute again", async () => {
  const m = await manifest();
  assert.deepEqual(await run(m), {
    outcome: "processed-once",
    claimed: 1,
    executed: 1,
  });
  assert.equal((await state()).status, "applied");
  assert.equal(await effects(), 1);
  await assert.rejects(run(m), /GLOBAL_CANDIDATE_MISMATCH/);
  assert.equal(await effects(), 1);
});

test("global reader is non-super and cannot SET worker or execute claim; worker cannot globally read", async () => {
  const reader = await connect("t03_bootstrap");
  const normal = await connect("t03_normal");
  try {
    assert.deepEqual(
      (
        await reader.query(
          `select rolsuper super,rolbypassrls bypass from pg_roles where rolname=current_user`,
        )
      ).rows[0],
      { super: false, bypass: true },
    );
    assert.equal(
      (
        await reader.query(
          "select has_function_privilege(current_user,'private.claim_client_mutations(text,integer,integer)','EXECUTE') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    await assert.rejects(reader.query("set role masarifi_worker"), {
      code: "42501",
    });
    await assert.rejects(
      reader.query(
        "select * from private.claim_client_mutations('forbidden',1,60)",
      ),
      { code: "42501" },
    );
    await normal.query("set role masarifi_worker");
    await assert.rejects(
      normal.query("select * from public.client_mutations"),
      { code: "42501" },
    );
  } finally {
    await reader.end();
    await normal.end();
  }
  assert.equal((await state()).attempt_count, 0);
});

for (const [variant, options, expectedCode] of [
  ["query before import", { queryBeforeImport: true }, "25001"],
  ["expired exporter", { expiredExporter: true }, "42704"],
  ["bad server token", { badToken: true }, "SNAPSHOT_EXPORT_INVALID"],
]) {
  test(`${variant} fails closed before claim and dispatch`, async () => {
    const importFailureObservation = {};
    let actualCode;
    await assert.rejects(
      run(await manifest(), { ...options, importFailureObservation }),
      (error) => {
        actualCode = error.code ?? error.message;
        return actualCode === expectedCode;
      },
    );
    assert.equal(
      actualCode,
      expectedCode,
      "assert intended PostgreSQL SQLSTATE without locale-dependent text",
    );
    assert.equal(
      importFailureObservation.reachedImport === true,
      variant !== "bad server token",
    );
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await effects(), 0);
  });
}

test("uncertain commit acknowledgement never dispatches or retries even if claim committed", async () => {
  await assert.rejects(
    run(await manifest(), { uncertainCommit: true }),
    /CLAIM_COMMIT_UNCERTAIN/,
  );
  assert.equal((await state()).status, "processing");
  assert.equal((await state()).attempt_count, 1);
  assert.equal(await effects(), 0);
});

for (const timing of ["before-import", "after-import"]) {
  test(`unrelated blocked-dependency insert ${timing} is excluded by the exported snapshot`, async () => {
    const other = {
      ...syntheticManifest().binding.row,
      id: id(10),
      operation_id: id(11),
      depends_on: [id(13)],
    };
    await insertMutation({
      ...other,
      id: id(12),
      operation_id: id(13),
      depends_on: [],
    });
    await admin.query(
      "update public.client_mutations set status='rejected',processed_at=clock_timestamp(),error='{}' where id=$1",
      [id(12)],
    );
    await run(await manifest(), {
      [timing === "before-import" ? "beforeImport" : "afterImport"]: () =>
        insertMutation(other),
    });
    assert.equal((await state(id(10))).status, "received");
    assert.equal((await state(id(10))).attempt_count, 0);
    assert.equal(await effects(), 1);
  });
}

test("worker endpoint mismatch at actual imported connection boundary rejects before claim", async () => {
  const workerObservation = {};
  await assert.rejects(
    run(await manifest(), { workerEndpointMismatch: true, workerObservation }),
    /NORMAL_WORKER_CONNECTION_MISMATCH/,
  );
  assert.equal(
    workerObservation.imported,
    true,
    "actual PostgreSQL import must succeed before injected metadata mismatch",
  );
  assert.equal(workerObservation.reachedIdentity, true);
  assert.equal(workerObservation.actualAddress, "127.0.0.1");
  assert.equal((await state()).attempt_count, 0);
  assert.equal(await effects(), 0);
});

test("snapshot from another database cannot authorize a worker claim", async () => {
  const exists = (
    await admin.query(
      "select 1 from pg_database where datname='t03_snapshot_other'",
    )
  ).rowCount;
  if (!exists) await admin.query("create database t03_snapshot_other");
  await assert.rejects(
    run(await manifest(), { workerDatabase: "t03_snapshot_other" }),
    /cannot import a snapshot from a different database/,
  );
  assert.equal((await state()).attempt_count, 0);
  assert.equal(await effects(), 0);
});

test("denied snapshot export stops before opening a worker transaction", async () => {
  try {
    await admin.query(
      "revoke execute on function pg_export_snapshot() from public",
    );
    await assert.rejects(
      run(await manifest()),
      /permission denied for function pg_export_snapshot/,
    );
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await effects(), 0);
  } finally {
    await admin.query(
      "grant execute on function pg_export_snapshot() to public",
    );
  }
});

test("ordinary worker without claim EXECUTE fails before any transition", async () => {
  try {
    await admin.query(
      "revoke execute on function private.claim_client_mutations(text,integer,integer) from masarifi_worker",
    );
    await assert.rejects(
      run(await manifest()),
      /NORMAL_WORKER_CONNECTION_MISMATCH/,
    );
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await effects(), 0);
  } finally {
    await admin.query(
      "grant execute on function private.claim_client_mutations(text,integer,integer) to masarifi_worker",
    );
  }
});

test("independently committed unrelated insert after fixed guard snapshot is untouched", async () => {
  const other = {
    ...syntheticManifest().binding.row,
    id: id(10),
    operation_id: id(11),
  };
  await run(await manifest(), { afterGuard: () => insertMutation(other) });
  assert.equal((await state(id(10))).status, "received");
  assert.equal((await state(id(10))).attempt_count, 0);
  assert.equal(await effects(), 1);
});

for (const variant of ["received", "processing", "blocked-dependency"]) {
  test(`preexisting unrelated ${variant} row aborts before generic claim preamble`, async () => {
    const other = {
      ...syntheticManifest().binding.row,
      id: id(10),
      operation_id: id(11),
    };
    if (variant === "blocked-dependency") {
      await insertMutation({ ...other, id: id(12), operation_id: id(13) });
      await admin.query(
        "update public.client_mutations set status='rejected',processed_at=clock_timestamp(),error='{}' where id=$1",
        [id(12)],
      );
      other.depends_on = [id(13)];
    }
    await insertMutation(other);
    if (variant === "processing")
      await admin.query(
        "update public.client_mutations set status='processing',locked_by='other',lease_token=$1,locked_until=clock_timestamp()-interval '1 second' where id=$2",
        [id(20), id(10)],
      );
    await assert.rejects(run(await manifest()), /GLOBAL_CANDIDATE_MISMATCH/);
    assert.equal((await state()).attempt_count, 0);
    assert.equal(
      (await state(id(10))).status,
      variant === "processing" ? "processing" : "received",
    );
    assert.equal(await effects(), 0);
  });
}

for (const variant of ["modify", "claim"]) {
  test(`concurrent target ${variant} after guard aborts without handler or automatic retry`, async () => {
    const m = await manifest();
    let concurrentChangeCommitted = false;
    await assert.rejects(
      run(m, {
        afterGuard: async () => {
          if (variant === "modify")
            await admin.query(
              "update public.client_mutations set authenticated_at=clock_timestamp() where id=$1",
              [id(1)],
            );
          else
            await admin.query(
              "select * from private.claim_client_mutations('other-fixture-worker',1,60)",
            );
          concurrentChangeCommitted = true;
        },
      }),
      (error) =>
        error.code === "40001" || error.message === "CLAIM_COUNT_MISMATCH",
    );
    assert.equal(
      concurrentChangeCommitted,
      true,
      "must reach the concurrent guard boundary",
    );
    assert.equal(await effects(), 0);
    assert.equal((await state()).attempt_count, variant === "claim" ? 1 : 0);
  });
}

for (const [user, message] of [
  ["t03_no_select", /GLOBAL_VISIBILITY_UNVERIFIED/],
  ["t03_filtered", /GLOBAL_VISIBILITY_UNVERIFIED/],
]) {
  test(`${user} fails closed with no mutation execution`, async () => {
    await assert.rejects(run(await manifest(user)), message);
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await effects(), 0);
  });
}

for (const key of [
  "claimSha256",
  "catalogSha256",
  "imageSha256",
  "target",
  "payload",
  "resource",
]) {
  test(`${key} mismatch cannot commit a claim`, async () => {
    const m = await manifest();
    const deps = dependencies(m);
    if (key === "target") m.target.systemIdentifier = "different";
    else if (key === "payload") m.binding.row.payload.note = "different";
    else if (key === "resource") m.binding.resourceSha256 = "0".repeat(64);
    else if (key === "imageSha256")
      deps.prepare = async () => ({
        ...(await runtime(m)),
        imageSha256: "0".repeat(64),
      });
    else m.provenance[key] = "0".repeat(64);
    await assert.rejects(
      runExactOperation({ manifest: m, sourceRoot, mode: "execute" }, deps),
      {
        message: {
          claimSha256: "FUNCTION_PROVENANCE_MISMATCH",
          catalogSha256: "CATALOG_PROVENANCE_MISMATCH",
          imageSha256: "EXECUTOR_PROVENANCE_UNVERIFIED",
          target: "DATABASE_TARGET_MISMATCH",
          payload: "MANIFEST_PAYLOAD",
          resource: "RESOURCE_MISMATCH",
        }[key],
      },
    );
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await effects(), 0);
  });
}

test("incorrect returned claim rolls back the actual PostgreSQL transition", async () => {
  await assert.rejects(
    run(await manifest(), {
      afterClaim: (result) => {
        result.rows[0].row.operation_id = id(99);
      },
    }),
    /CLAIM_BINDING_MISMATCH/,
  );
  assert.equal((await state()).attempt_count, 0);
  assert.equal(await effects(), 0);
});

test("active automatic salary link inside the guarded snapshot aborts before claim or effect", async () => {
  const m = await manifest();
  await admin.query(
    "insert into public.salary_receipts values($1,$2,$3,'received',true)",
    [id(100), m.binding.row.user_id, m.binding.row.resource_id],
  );
  await assert.rejects(run(m), /ACTIVE_AUTOMATIC_SALARY_LINK/);
  assert.equal((await state()).attempt_count, 0);
  assert.equal(await effects(), 0);
});

test("standalone unique index drift rejects before worker checkout, claim or executor", async () => {
  const m = await manifest();
  const before = (await admin.query(catalogSql)).rows[0].catalog;
  const observed = { workerCheckouts: 0, executions: 0 };
  const deps = dependencies(m);
  deps.prepare = async () => {
    const prepared = await runtime(m);
    return {
      ...prepared,
      normalPool: {
        withClient(action) {
          observed.workerCheckouts++;
          return prepared.normalPool.withClient(action);
        },
      },
      executeClaim(row) {
        observed.executions++;
        return prepared.executeClaim(row);
      },
    };
  };
  try {
    await admin.query(
      "create unique index synthetic_exact_operation_guard on public.client_mutations(user_id,operation_id)",
    );
    const after = (await admin.query(catalogSql)).rows[0].catalog;
    assert.notDeepEqual(after.indexes, before.indexes);
    const withoutIndexes = (catalog) => {
      const { indexes, ...rest } = catalog;
      assert.ok(indexes);
      return rest;
    };
    assert.deepEqual(
      withoutIndexes(after),
      withoutIndexes(before),
      "standalone index is the only catalog delta",
    );
    await assert.rejects(
      runExactOperation({ manifest: m, sourceRoot, mode: "execute" }, deps),
      /CATALOG_PROVENANCE_MISMATCH/,
    );
    assert.deepEqual(observed, { workerCheckouts: 0, executions: 0 });
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await effects(), 0);
  } finally {
    await admin.query(
      "drop index if exists public.synthetic_exact_operation_guard",
    );
  }
});

test("lease loss retains normal repository fencing", async () => {
  await assert.rejects(
    run(await manifest(), { loseLease: true }),
    /SYNC_MUTATION_LEASE_LOST/,
  );
  assert.equal((await state()).status, "processing");
  assert.equal((await state()).lease_token, id(99));
  assert.equal(await effects(), 1);
});

test("stored stale authentication retains normal recent-auth retry without refresh", async () => {
  const m = await manifest();
  const authObservation = { retryCodes: [] };
  await run(m, { staleAuth: true, authObservation });
  assert.equal(authObservation.principal.userId, m.binding.row.user_id);
  assert.ok(
    authObservation.principal.factorAgeSeconds >= 3600,
    "assert authentication age outside executor error handling",
  );
  assert.equal(
    authObservation.recentAuthRequired,
    true,
    "must reach the intended recent-auth branch",
  );
  assert.deepEqual(
    authObservation.retryCodes,
    ["RECENT_AUTH_REQUIRED"],
    "observe the exact code forwarded to actual PostgreSQL retry function",
  );
  assert.equal((await state()).status, "received");
  assert.equal(await effects(), 0);
});

test("external effect commit followed by failure retains operation identity on normal retry", async () => {
  const m = await manifest();
  await run(m, { crashAfterEffect: true });
  assert.equal((await state()).status, "received");
  assert.equal(await effects(), 1);
  await admin.query(
    "update public.client_mutations set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",
    [id(1)],
  );
  const ready = await runtime(m);
  try {
    const repo = new SyncRepository({
      withClient: ready.normalPool.withClient,
    });
    const claims = await repo.claimMutations(m.workerId, 1, 60);
    assert.equal(claims.length, 1);
    const row = (
      await admin.query(
        "select to_jsonb(m) row from public.client_mutations m where id=$1",
        [id(1)],
      )
    ).rows[0].row;
    await ready.executeClaim(row);
    assert.equal((await state()).status, "applied");
    assert.equal((await state()).attempt_count, 2);
    assert.equal(await effects(), 1);
  } finally {
    await ready.close();
  }
});

const markerRule = "t03_claim_marker";
const createMarkerRule = `create rule ${markerRule} as on update to public.client_mutations
  do also insert into public.synthetic_rule_effects(mutation_id) values(new.id)`;
const legacyCatalogSql = readFileSync(
  resolve(
    fixtureRoot,
    "../core-review-round-1/catalog-without-rewrite-rules.sql",
  ),
  "utf8",
);
assert.equal(
  sha256(legacyCatalogSql),
  "a2063ee28ad9c258ae8f454939d3b0b6c47992f109fecdbe9b9ab8f115b3f0e8",
  "historical SQL must retain its pre-repair bytes",
);
const fingerprint = async (sql) =>
  sha256(canonical((await admin.query(sql)).rows[0].catalog));
const markerCount = async () =>
  Number(
    (
      await admin.query(
        "select count(*) count from public.synthetic_rule_effects",
      )
    ).rows[0].count,
  );

test("rewrite rule alone evades the historical fingerprint but secure guard rejects before claim/effect", async () => {
  const m = await manifest();
  const legacyBefore = await fingerprint(legacyCatalogSql);
  try {
    await admin.query(createMarkerRule);
    assert.equal(
      await fingerprint(legacyCatalogSql),
      legacyBefore,
      "historical catalog omitted the only schema delta: this rule",
    );
    assert.notEqual(await fingerprint(catalogSql), m.provenance.catalogSha256);
    await assert.rejects(run(m), /CATALOG_PROVENANCE_MISMATCH/);
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await markerCount(), 0);
    assert.equal(await effects(), 0);
    // PostgreSQL rules restrict WITH queries; demonstrate the omitted rewrite effect on plain synthetic UPDATE.
    await admin.query("begin isolation level repeatable read");
    try {
      await admin.query(
        "update public.client_mutations set updated_at=updated_at where id=$1",
        [id(1)],
      );
      assert.equal(await markerCount(), 1);
    } finally {
      await admin.query("rollback");
    }
    assert.equal((await state()).attempt_count, 0);
    assert.equal(await markerCount(), 0);
  } finally {
    await admin.query(
      `drop rule if exists ${markerRule} on public.client_mutations`,
    );
  }
});

for (const transition of ["disabled-to-enabled", "enabled-to-always"]) {
  test(`rewrite rule ${transition} state alone aborts before claim/effect`, async () => {
    try {
      await admin.query(createMarkerRule);
      if (transition === "disabled-to-enabled")
        await admin.query(
          `alter table public.client_mutations disable rule ${markerRule}`,
        );
      const m = await manifest();
      const legacyBefore = await fingerprint(legacyCatalogSql);
      const definitionBefore = (
        await admin.query(
          "select pg_get_ruledef(oid,true) definition from pg_rewrite where ev_class='public.client_mutations'::regclass and rulename=$1",
          [markerRule],
        )
      ).rows[0].definition;
      await admin.query(
        `alter table public.client_mutations ${transition === "disabled-to-enabled" ? "enable" : "enable always"} rule ${markerRule}`,
      );
      const definitionAfter = (
        await admin.query(
          "select pg_get_ruledef(oid,true) definition from pg_rewrite where ev_class='public.client_mutations'::regclass and rulename=$1",
          [markerRule],
        )
      ).rows[0].definition;
      assert.equal(
        definitionAfter,
        definitionBefore,
        "only enabled state changed",
      );
      assert.equal(await fingerprint(legacyCatalogSql), legacyBefore);
      assert.notEqual(
        await fingerprint(catalogSql),
        m.provenance.catalogSha256,
      );
      await assert.rejects(run(m), /CATALOG_PROVENANCE_MISMATCH/);
      assert.equal((await state()).attempt_count, 0);
      assert.equal(await markerCount(), 0);
      assert.equal(await effects(), 0);
    } finally {
      await admin.query(
        `drop rule if exists ${markerRule} on public.client_mutations`,
      );
    }
  });
}
