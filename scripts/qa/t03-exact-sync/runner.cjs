const { readFileSync } = require("node:fs");
const { resolve, relative, isAbsolute } = require("node:path");
const {
  canonical,
  sha256,
  requireCondition,
  validateManifest,
} = require("./manifest.cjs");

const catalogSql = readFileSync(resolve(__dirname, "catalog.sql"), "utf8");
const requiredSources = [
  "scripts/qa/t03-exact-sync/runner.cjs",
  "scripts/qa/t03-exact-sync/manifest.cjs",
  "scripts/qa/t03-exact-sync/catalog.sql",
  "apps/api/src/sync/claimed-mutation.executor.ts",
  "apps/api/src/sync/claimed-mutation.runtime.ts",
  "apps/api/src/sync/sync.repository.ts",
  "apps/api/src/sync/sync.handlers.ts",
];

function verifySources(manifest, sourceRoot) {
  requireCondition(
    requiredSources.every((path) =>
      Object.hasOwn(manifest.provenance.sources, path),
    ),
    "SOURCE_PINS_INCOMPLETE",
  );
  for (const [path, hash] of Object.entries(manifest.provenance.sources)) {
    const full = resolve(sourceRoot, path);
    const local = relative(resolve(sourceRoot), full);
    requireCondition(
      !local.startsWith("..") && !isAbsolute(local),
      "SOURCE_PATH",
    );
    requireCondition(sha256(readFileSync(full)) === hash, "SOURCE_MISMATCH");
  }
}

async function verifyIdentity(client, manifest) {
  const identity = (
    await client.query(`select current_database() database,current_user "user",session_user "sessionUser",
    host(inet_server_addr()) address,inet_server_port() port,
    (pg_control_system()).system_identifier::text "systemIdentifier",
    current_setting('server_version_num')::int version,
    current_setting('transaction_isolation') isolation,
    current_setting('transaction_read_only') "readOnly",pg_backend_pid() pid`)
  ).rows[0];
  for (const key of [
    "database",
    "user",
    "sessionUser",
    "address",
    "port",
    "systemIdentifier",
  ]) {
    requireCondition(
      identity[key] === manifest.target[key],
      "DATABASE_TARGET_MISMATCH",
    );
  }
  requireCondition(
    identity.version >= 170000 &&
      identity.version < 180000 &&
      identity.isolation === "repeatable read" &&
      identity.readOnly === "on",
    "DATABASE_VERSION_OR_ISOLATION",
  );
  return identity;
}

async function verifyVisibility(client) {
  const visibility = (
    await client.query(`select has_table_privilege(current_user,'public.client_mutations','SELECT') allowed,
    row_security_active('public.client_mutations'::regclass) filtered`)
  ).rows[0];
  requireCondition(
    visibility.allowed && !visibility.filtered,
    "GLOBAL_VISIBILITY_UNVERIFIED",
  );
}

async function verifyProvenance(client, manifest) {
  const catalog = (await client.query(catalogSql)).rows[0].catalog;
  requireCondition(
    sha256(canonical(catalog)) === manifest.provenance.catalogSha256,
    "CATALOG_PROVENANCE_MISMATCH",
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
  ].entries()) {
    const definition = (
      await client.query(
        "select pg_get_functiondef($1::regprocedure) definition",
        [signatures[index]],
      )
    ).rows[0].definition;
    requireCondition(
      sha256(definition) === manifest.provenance[key],
      "FUNCTION_PROVENANCE_MISMATCH",
    );
  }
}

async function verifyCandidate(client, manifest) {
  const rows = (
    await client.query(
      "select to_jsonb(m) row from public.client_mutations m where status in ('received','processing') order by id",
    )
  ).rows;
  requireCondition(
    rows.length === 1 &&
      canonical(rows[0].row) === canonical(manifest.binding.row),
    "GLOBAL_CANDIDATE_MISMATCH",
  );
  const due = (
    await client.query(
      "select next_attempt_at is null or next_attempt_at<=clock_timestamp() due from public.client_mutations where id=$1",
      [manifest.binding.row.id],
    )
  ).rows[0];
  requireCondition(due?.due === true, "CANDIDATE_NOT_DUE");
  const resource = (
    await client.query(
      `select to_jsonb(t) transaction,
    coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.transaction_postings p where p.transaction_id=t.id),'[]') postings
    from public.transactions t where t.id=$1 and t.user_id=$2`,
      [manifest.binding.row.resource_id, manifest.binding.row.user_id],
    )
  ).rows[0];
  requireCondition(
    resource && sha256(canonical(resource)) === manifest.binding.resourceSha256,
    "RESOURCE_MISMATCH",
  );
  verifyOriginal(resource, manifest);
  await verifyNoSalaryLink(client, manifest.binding.row.resource_id);
}

async function verifyNoSalaryLink(client, resourceId) {
  const visibility = (
    await client.query(
      "select has_table_privilege(current_user,'public.salary_receipts','SELECT') allowed,row_security_active('public.salary_receipts'::regclass) filtered",
    )
  ).rows[0];
  requireCondition(
    visibility.allowed && !visibility.filtered,
    "SALARY_VISIBILITY_UNVERIFIED",
  );
  const result = (
    await client.query(
      "select not exists(select 1 from public.salary_receipts where transaction_id=$1::uuid and automatically_detected and status in ('received','corrected')) clear",
      [resourceId],
    )
  ).rows[0];
  requireCondition(result.clear === true, "ACTIVE_AUTOMATIC_SALARY_LINK");
  return true;
}

function verifyOriginal(resource, manifest) {
  const t = resource.transaction;
  requireCondition(
    t.version === Number(manifest.binding.row.base_version) &&
      t.status === "confirmed" &&
      t.kind === "expense",
    "RESOURCE_VERSION_OR_KIND",
  );
  const original = projectOriginal(resource);
  requireCondition(
    canonical(original) === canonical(manifest.binding.original),
    "RESOURCE_EFFECTIVE_MISMATCH",
  );
}

function projectOriginal(resource) {
  requireCondition(
    resource?.transaction && Array.isArray(resource.postings),
    "RESOURCE_ACCOUNT_AMBIGUOUS",
  );
  const t = resource.transaction;
  const balances = new Map();
  for (const p of resource.postings.filter(
    (p) => p.clearing_state === "confirmed",
  ))
    balances.set(
      p.account_id,
      (balances.get(p.account_id) ?? 0n) + BigInt(p.amount_minor),
    );
  const accounts = [...balances].filter(([, balance]) => balance !== 0n);
  requireCondition(
    accounts.length === 1 &&
      typeof accounts[0][0] === "string" &&
      accounts[0][0].length > 0,
    "RESOURCE_ACCOUNT_AMBIGUOUS",
  );
  return {
    kind: t.kind,
    amountMinor: t.amount_minor,
    currencyCode: t.currency_code,
    accountId: accounts[0][0],
    categoryId: t.category_id,
    title: t.title,
    merchant: t.merchant,
    paymentMethod: t.payment_method,
    note: t.note,
    occurredAt: new Date(t.occurred_at).toISOString(),
  };
}

function verifyClaim(row, manifest) {
  requireCondition(
    row &&
      row.status === "processing" &&
      row.attempt_count === 1 &&
      row.locked_by === manifest.workerId &&
      /^[a-f0-9-]{36}$/.test(row.lease_token ?? "") &&
      row.next_attempt_at === null,
    "CLAIM_TRANSITION_MISMATCH",
  );
  const until = Date.parse(row.locked_until);
  requireCondition(
    until > Date.now() &&
      until <= Date.now() + manifest.leaseSeconds * 1000 + 2000,
    "CLAIM_LEASE_MISMATCH",
  );
  const changed = new Set([
    "status",
    "attempt_count",
    "locked_by",
    "locked_until",
    "lease_token",
    "next_attempt_at",
    "updated_at",
  ]);
  const unchanged = (value) =>
    Object.fromEntries(
      Object.entries(value).filter(([key]) => !changed.has(key)),
    );
  requireCondition(
    canonical(unchanged(row)) === canonical(unchanged(manifest.binding.row)),
    "CLAIM_BINDING_MISMATCH",
  );
}

function verifyNormalRuntime(runtime, manifest) {
  requireCondition(
    runtime.imageSha256 === manifest.provenance.imageSha256 &&
      typeof runtime.executeClaim === "function" &&
      typeof runtime.normalPool?.withClient === "function",
    "EXECUTOR_PROVENANCE_UNVERIFIED",
  );
}

async function verifyImportedWorker(client, manifest, exported) {
  const normal = (
    await client.query(`select current_database() database,current_user role,
    session_user "sessionUser",pg_backend_pid() pid,pg_current_snapshot()::text snapshot,
    current_setting('transaction_isolation') isolation,current_setting('transaction_read_only') "readOnly",
    current_setting('server_version_num')::int version,
    host(inet_server_addr()) address,inet_server_port() port,
    (select rolsuper or rolbypassrls from pg_roles where rolname=current_user) elevated,
    has_table_privilege(current_user,'public.client_mutations','SELECT,UPDATE,DELETE,TRUNCATE') global_access,
    has_function_privilege(current_user,'private.claim_client_mutations(text,integer,integer)','EXECUTE') "canClaim"`)
  ).rows[0];
  requireCondition(
    normal.role === "masarifi_worker" &&
      !normal.elevated &&
      !normal.global_access &&
      normal.sessionUser === manifest.target.workerSessionUser &&
      normal.pid !== exported.pid &&
      normal.snapshot === exported.snapshot &&
      normal.isolation === "repeatable read" &&
      normal.readOnly === "off" &&
      normal.version >= 170000 &&
      normal.version < 180000 &&
      normal.canClaim === true &&
      ["database", "address", "port"].every(
        (key) => normal[key] === manifest.target[key],
      ),
    "NORMAL_WORKER_CONNECTION_MISMATCH",
  );
}

// ONE protocol: the global reader never claims or transfers role. The already-role-bound
// ordinary worker imports that exact live snapshot before its first query.
async function claimTransaction(bootstrap, runtime, manifest) {
  let began = false;
  try {
    await bootstrap.query("begin isolation level repeatable read read only");
    began = true;
    await bootstrap.query("set local statement_timeout='5000ms'");
    await bootstrap.query("set local lock_timeout='1000ms'");
    await bootstrap.query(
      "set local idle_in_transaction_session_timeout='10000ms'",
    );
    const identity = await verifyIdentity(bootstrap, manifest);
    await verifyVisibility(bootstrap);
    await verifyProvenance(bootstrap, manifest);
    await verifyCandidate(bootstrap, manifest);
    const exported = (
      await bootstrap.query(
        "select pg_export_snapshot() token,pg_current_snapshot()::text snapshot,pg_backend_pid() pid",
      )
    ).rows[0];
    requireCondition(
      exported.pid === identity.pid &&
        /^[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*$/.test(exported.token ?? "") &&
        typeof exported.snapshot === "string",
      "SNAPSHOT_EXPORT_INVALID",
    );
    return await runtime.normalPool.withClient(async (worker) => {
      let workerBegan = false;
      let committing = false;
      try {
        await worker.query("begin isolation level repeatable read read write");
        workerBegan = true;
        // Utility syntax has no bind parameters: only this server-generated, validated token is interpolated.
        await worker.query(`set transaction snapshot '${exported.token}'`);
        await worker.query("set local statement_timeout='5000ms'");
        await worker.query("set local lock_timeout='1000ms'");
        await worker.query(
          "set local idle_in_transaction_session_timeout='10000ms'",
        );
        await verifyImportedWorker(worker, manifest, exported);
        const claims = (
          await worker.query(
            "select to_jsonb(m) row from private.claim_client_mutations($1,1,$2) m",
            [manifest.workerId, manifest.leaseSeconds],
          )
        ).rows;
        requireCondition(claims.length === 1, "CLAIM_COUNT_MISMATCH");
        verifyClaim(claims[0].row, manifest);
        // Recheck the exporter on its SAME held client. A dead/replaced exporter aborts precommit.
        const held = (
          await bootstrap.query(
            "select pg_backend_pid() pid,pg_current_snapshot()::text snapshot",
          )
        ).rows[0];
        requireCondition(
          held.pid === exported.pid && held.snapshot === exported.snapshot,
          "SNAPSHOT_EXPORTER_CHANGED",
        );
        committing = true;
        const committed = await worker.query("commit");
        requireCondition(
          committed.command === "COMMIT",
          "CLAIM_COMMIT_UNCERTAIN",
        );
        workerBegan = false;
        return claims[0].row;
      } catch (error) {
        if (workerBegan) {
          try {
            await worker.query("rollback");
          } catch {
            throw new Error(
              committing
                ? "CLAIM_COMMIT_UNCERTAIN"
                : "GUARD_ABORT_ROLLBACK_UNCERTAIN",
            );
          }
        }
        if (committing) throw new Error("CLAIM_COMMIT_UNCERTAIN");
        throw error;
      }
    });
  } finally {
    if (began) await bootstrap.query("rollback");
  }
}

/** No connection, environment lookup, job registration, or handler import at module initialization. */
async function runExactOperation(input, dependencies) {
  const manifest = validateManifest(input.manifest);
  verifySources(manifest, input.sourceRoot);
  if (input.mode !== "execute")
    return { outcome: "validated-only", claimed: 0, executed: 0 };
  requireCondition(
    dependencies?.authorize &&
      dependencies?.prepare &&
      dependencies?.connectBootstrap,
    "EXECUTION_ACCESS_UNVERIFIED",
  );
  // Approval is verified out of band by the supplied reviewed adapter, never by a manifest flag.
  await dependencies.authorize(manifest);
  const runtime = await dependencies.prepare(manifest);
  requireCondition(
    runtime && typeof runtime.close === "function",
    "EXECUTOR_RESOURCES_UNVERIFIED",
  );
  let client;
  try {
    verifyNormalRuntime(runtime, manifest);
    client = await dependencies.connectBootstrap(manifest);
    const claim = await claimTransaction(client, runtime, manifest);
    await client.end();
    client = undefined;
    await runtime.executeClaim(claim, manifest.workerId);
    return { outcome: "processed-once", claimed: 1, executed: 1 };
  } finally {
    try {
      if (client) await client.end();
    } finally {
      await runtime.close();
    }
  }
}
module.exports = {
  runExactOperation,
  catalogSql,
  requiredSources,
  claimTransaction,
  verifySources,
  verifyIdentity,
  verifyVisibility,
  verifyProvenance,
  verifyNoSalaryLink,
  verifyCandidate,
  projectOriginal,
};

if (require.main === module) {
  // CLI deliberately has no execution adapter or credential discovery path.
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) {
    process.stderr.write(
      "Usage: node runner.cjs <manifest.json> (validation only)\n",
    );
    process.exitCode = 2;
  } else {
    Promise.resolve()
      .then(() =>
        runExactOperation({
          manifest: JSON.parse(readFileSync(path, "utf8")),
          sourceRoot: resolve(__dirname, "../../.."),
        }),
      )
      .then(() =>
        process.stdout.write("Validated only; no connection or execution.\n"),
      )
      .catch(() => {
        process.stderr.write("Manifest validation failed; no execution.\n");
        process.exitCode = 1;
      });
  }
}
