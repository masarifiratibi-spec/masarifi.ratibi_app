const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const {
  sha256,
  canonical,
  requireCondition: requireThat,
} = require("../t03-exact-sync/manifest.cjs");
const guard = require("../t03-exact-sync/runner.cjs");
const { CA_PATH, preparePrivateConfiguration } = require("./config.cjs");
const {
  runSession,
  runRestoredSuccessor,
  validateSession,
} = require("./session.cjs");
const { restoredSeed } = require("./successor.cjs");
const { createPrivateJournal } = require("./journal.cjs");
const { IMAGE } = require("./artifact.cjs");

async function readPrivateFrame(stream) {
  requireThat(!stream.isTTY, "QA_PRIVATE_PIPE_REQUIRED");
  const chunks = [];
  let size = 0;
  const timer = setTimeout(
    () => stream.destroy(new Error("QA_PRIVATE_PIPE_DEADLINE")),
    5000,
  );
  try {
    for await (const chunk of stream) {
      size += chunk.length;
      requireThat(size <= 262144, "QA_PRIVATE_FRAME_SIZE");
      chunks.push(chunk);
    }
    const frame = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
    requireThat(
      typeof frame.worker === "string" &&
        typeof frame.api === "string" &&
        typeof frame.bootstrap === "string" &&
        typeof frame.manifest === "string" &&
        frame.hostAttestation,
      "QA_PRIVATE_FRAME_INVALID",
    );
    return frame;
  } catch {
    throw new Error("QA_PRIVATE_FRAME_INVALID");
  } finally {
    clearTimeout(timer);
  }
}

function verifyHostAttestation(manifest, attestation, packagePin) {
  requireThat(
    manifest.scope === "staging" &&
      manifest.host?.image === IMAGE &&
      manifest.provenance.reviewedArtifactSha256 === packagePin,
    "QA_REVIEWED_ARTIFACT_MISMATCH",
  );
  requireThat(
    attestation &&
      attestation.packageSha256 === packagePin &&
      attestation.image === manifest.host.image &&
      attestation.imageId === `sha256:${manifest.provenance.imageSha256}` &&
      attestation.generalWorkerRunning === false &&
      attestation.network === "masarifi-staging_backend" &&
      attestation.configOverlaySha256 ===
        sha256(canonical(manifest.configuration.normal.overlay)),
    "QA_HOST_ATTESTATION_MISMATCH",
  );
  requireThat(
    process.platform === "linux" &&
      process.arch === "x64" &&
      process.version === "v24.20.0" &&
      process.getuid() === 65532,
    "QA_CONTAINER_RUNTIME_MISMATCH",
  );
  requireThat(
    manifest.target.project === "qcffvfbpzvpwcwxwjyro" &&
      manifest.target.database === "postgres" &&
      manifest.target.systemIdentifier === "7678071634733212629" &&
      manifest.target.workerSessionUser === "masarifi_worker_login" &&
      manifest.target.apiSessionUser === "masarifi_api_login" &&
      manifest.target.user === "postgres" &&
      manifest.target.sessionUser === "postgres",
    "QA_HOST_TARGET_MISMATCH",
  );
}

function operationManifest(session, binding) {
  return {
    workerId: session.workerId,
    leaseSeconds: session.leaseSeconds,
    target: session.target,
    provenance: session.provenance,
    binding: {
      row: binding.row,
      resourceSha256: sha256(canonical(binding.resource)),
      original: {
        ...session.binding.originalEffective,
        note: binding.resource.transaction.note,
      },
    },
  };
}

async function withReader(
  configuration,
  session,
  action,
  fullProvenance = true,
) {
  const client = configuration.createBootstrapClient();
  let began = false;
  try {
    await client.connect();
    await client.query("begin isolation level repeatable read read only");
    began = true;
    await client.query("set local statement_timeout='5000ms'");
    await client.query("set local lock_timeout='1000ms'");
    await client.query(
      "set local idle_in_transaction_session_timeout='10000ms'",
    );
    await guard.verifyIdentity(client, session);
    await guard.verifyVisibility(client);
    if (fullProvenance) await guard.verifyProvenance(client, session);
    return await action(client);
  } finally {
    try {
      if (began) await client.query("rollback");
    } finally {
      await client.end();
    }
  }
}

async function observe(configuration, session, state) {
  return withReader(
    configuration,
    session,
    async (client) => {
      const pending = (
        await client.query(
          "select to_jsonb(m) row from public.client_mutations m where status in ('received','processing') order by id",
        )
      ).rows.map((entry) => entry.row);
      const resource = (
        await client.query(
          `select to_jsonb(t) transaction,coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.transaction_postings p where p.transaction_id=t.id),'[]'::jsonb) postings from public.transactions t where t.id::text=$1 and t.user_id=$2`,
          [session.binding.resourceId, session.binding.userId],
        )
      ).rows[0];
      requireThat(resource, "SESSION_RESOURCE_MISSING");
      if (
        pending.length > 0 ||
        state.inflight ||
        Number(resource.transaction.version) !== state.version ||
        resource.transaction.note !== state.note
      )
        await guard.verifyProvenance(client, session);
      let mutation;
      if (state.inflight)
        mutation = (
          await client.query(
            "select to_jsonb(m) row from public.client_mutations m where id=$1",
            [state.inflight.row.id],
          )
        ).rows[0]?.row;
      const direct =
        state.phase % 2 === 1
          ? (
              await client.query(
                `select to_jsonb(k) row from private.idempotency_keys k where actor_id=$1 and scope='ledger.transaction.revise' and resource_ref=$2 and state='completed' and created_at>=$3::timestamptz order by created_at,key_hash limit 3`,
                [
                  session.binding.userId,
                  session.binding.resourceId,
                  state.phaseStartedAt,
                ],
              )
            ).rows.map((entry) => entry.row)
          : [];
      const observedAt = (
        await client.query("select clock_timestamp() observed")
      ).rows[0].observed.toISOString();
      const noActiveAutomaticSalaryLinks = await guard.verifyNoSalaryLink(
        client,
        session.binding.resourceId,
        session.binding.userId,
      );
      return {
        pending,
        resource,
        mutation,
        direct,
        observedAt,
        noActiveAutomaticSalaryLinks,
      };
    },
    false,
  );
}

async function verifyInitialAnchors(configuration, session) {
  requireThat(
    session.initialAnchors.mutationSqlJsonSha256 ===
      "643b212d83f975429241e5453a55f39316db6ce6b0653009a6db0d9327d32a89" &&
      session.initialAnchors.resourceSqlJsonSha256 ===
        "c53473f4c8d7baa74686aaa9b15fa6feea88c03ac7da83a806427054ed14aa0e",
    "QA_INITIAL_ANCHORS_UNREVIEWED",
  );
  await withReader(configuration, session, async (client) => {
    const initial = (
      await client.query(
        "select to_jsonb(m)::text text from public.client_mutations m where operation_id=$1 and user_id=$2",
        ["10de16e6-a966-41b4-a583-1716314b285b", session.binding.userId],
      )
    ).rows;
    requireThat(
      initial.length === 1 &&
        sha256(initial[0].text) ===
          session.initialAnchors.mutationSqlJsonSha256 &&
        canonical(JSON.parse(initial[0].text)) ===
          canonical(session.binding.initialRow),
      "QA_INITIAL_MUTATION_ANCHOR_MISMATCH",
    );
    const resource = (
      await client.query(
        `select jsonb_build_object('transaction',to_jsonb(t),'postings',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.transaction_postings p where p.transaction_id=t.id),'[]'::jsonb))::text text from public.transactions t where t.id::text=$1 and t.user_id=$2`,
        [session.binding.resourceId, session.binding.userId],
      )
    ).rows;
    requireThat(
      resource.length === 1 &&
        sha256(resource[0].text) ===
          session.initialAnchors.resourceSqlJsonSha256 &&
        canonical(JSON.parse(resource[0].text)) ===
          canonical(session.binding.resource),
      "QA_INITIAL_RESOURCE_ANCHOR_MISMATCH",
    );
  });
}

async function admitRestoredSuccessor(configuration, session, evidence) {
  return withReader(configuration, session, async (client) => {
    const pending = (
      await client.query(
        "select to_jsonb(m) row from public.client_mutations m where status in ('received','processing') order by id",
      )
    ).rows.map((entry) => entry.row);
    const originalRows = (
      await client.query(
        "select to_jsonb(m) row from public.client_mutations m where operation_id=$1 and user_id=$2",
        [session.binding.initialRow.operation_id, session.binding.userId],
      )
    ).rows;
    requireThat(
      originalRows.length === 1,
      "SUCCESSOR_ORIGINAL_UNIQUE_REQUIRED",
    );
    const resource = (
      await client.query(
        `select to_jsonb(t) transaction,coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.transaction_postings p where p.transaction_id=t.id),'[]'::jsonb) postings from public.transactions t where t.id::text=$1 and t.user_id=$2`,
        [session.binding.resourceId, session.binding.userId],
      )
    ).rows[0];
    const receipts = (
      await client.query(
        `select to_jsonb(k)::text "sqlText",k.response_body::text "bodySqlText" from private.idempotency_keys k where actor_id=$1 and resource_ref=$2 and scope='ledger.transaction.revise' and state='completed' and response_status=200 and response_body #>> '{transaction,transaction,id}'=$2 and response_body #>> '{transaction,transaction,version}'='3' and response_body #> '{transaction,transaction,note}'='null'::jsonb order by created_at,key_hash limit 2`,
        [session.binding.userId, session.binding.resourceId],
      )
    ).rows;
    const revisions = (
      await client.query(
        'select to_jsonb(r)::text "sqlText" from audit.transaction_revisions r where transaction_id=$1::uuid order by revision_no limit 4',
        [session.binding.resourceId],
      )
    ).rows;
    const identity = (
      await client.query(
        "select p.status='active' owner_active,d.revoked_at is null device_active_same_owner from public.profiles p join public.user_devices d on d.user_id=p.id where p.id=$1 and d.id=$2::uuid",
        [session.binding.userId, session.binding.deviceId],
      )
    ).rows[0];
    const observation = {
      pending,
      original: originalRows[0].row,
      resource,
      receipts,
      revisions,
      ownerActive: identity?.owner_active === true,
      deviceActiveSameOwner: identity?.device_active_same_owner === true,
      noActiveAutomaticSalaryLinks: await guard.verifyNoSalaryLink(
        client,
        session.binding.resourceId,
      ),
      observedAt: (
        await client.query("select clock_timestamp() observed")
      ).rows[0].observed.toISOString(),
    };
    restoredSeed(session, evidence, observation);
    return { evidence, observation };
  });
}

async function readOnlyRuntimePreflight(configuration, runtime, session) {
  await withReader(configuration, session, async (reader) => {
    const exported = (
      await reader.query(
        "select pg_export_snapshot() token,pg_current_snapshot()::text snapshot,pg_backend_pid() pid",
      )
    ).rows[0];
    requireThat(
      /^[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*$/.test(exported.token ?? ""),
      "SNAPSHOT_EXPORT_INVALID",
    );
    await runtime.normalPool.withClient(async (worker) => {
      try {
        await worker.query("begin isolation level repeatable read read only");
        await worker.query(`set transaction snapshot '${exported.token}'`);
        await worker.query("set local statement_timeout='5000ms'");
        const identity = (
          await worker.query(
            `select current_user role,session_user login,current_database() database,host(inet_server_addr()) address,inet_server_port() port,pg_backend_pid() pid,pg_current_snapshot()::text snapshot,current_setting('transaction_read_only') readonly,(select rolsuper or rolbypassrls from pg_roles where rolname=current_user) elevated,has_table_privilege(current_user,'public.client_mutations','SELECT,UPDATE,DELETE,TRUNCATE') global_access,has_function_privilege(current_user,'private.claim_client_mutations(text,integer,integer)','EXECUTE') can_claim`,
          )
        ).rows[0];
        requireThat(
          identity.role === "masarifi_worker" &&
            identity.login === session.target.workerSessionUser &&
            !identity.elevated &&
            !identity.global_access &&
            identity.can_claim &&
            identity.readonly === "on" &&
            identity.pid !== exported.pid &&
            identity.snapshot === exported.snapshot &&
            ["database", "address", "port"].every(
              (key) => identity[key] === session.target[key],
            ),
          "QA_PREFLIGHT_WORKER_MISMATCH",
        );
        await verifyWorkerOutcomeCapabilities(worker);
        const held = (
          await reader.query(
            "select pg_backend_pid() pid,pg_current_snapshot()::text snapshot",
          )
        ).rows[0];
        requireThat(
          held.pid === exported.pid && held.snapshot === exported.snapshot,
          "QA_PREFLIGHT_EXPORTER_CHANGED",
        );
      } finally {
        await worker.query("rollback");
      }
    });
    await runtime.apiCommandPool.withClient(async (api) => {
      try {
        await api.query("begin isolation level repeatable read read only");
        await api.query(`set transaction snapshot '${exported.token}'`);
        await api.query("set local statement_timeout='5000ms'");
        await verifyApiCommandConnection(api, session.target);
        const imported = (
          await api.query(
            "select pg_backend_pid() pid,pg_current_snapshot()::text snapshot",
          )
        ).rows[0];
        requireThat(
          imported.pid !== exported.pid &&
            imported.snapshot === exported.snapshot,
          "QA_PREFLIGHT_API_SNAPSHOT_MISMATCH",
        );
      } finally {
        await api.query("rollback");
      }
    });
  });
}

async function verifyWorkerOutcomeCapabilities(client) {
  await verifySalaryWriteIsolation(client);
  for (const signature of [
    "private.claim_client_mutations(text,integer,integer)",
    "private.complete_client_mutation(uuid,uuid,text,jsonb,jsonb)",
    "private.retry_client_mutation(uuid,uuid,timestamp with time zone,text)",
    "private.create_transaction_conflict(text,uuid,uuid,bigint,bigint,text[],jsonb,jsonb)",
  ])
    requireThat(
      (
        await client.query(
          "select has_function_privilege(current_user,$1,'EXECUTE') allowed",
          [signature],
        )
      ).rows[0].allowed,
      "QA_WORKER_OUTCOME_CAPABILITY_MISSING",
    );
}

async function verifyApiCommandConnection(client, target) {
  await client.query("set local role masarifi_api");
  const identity = (
    await client.query(
      `select current_user role,session_user login,current_database() database,host(inet_server_addr()) address,inet_server_port() port,current_setting('server_version_num')::int version,current_setting('transaction_isolation') isolation,current_setting('transaction_read_only') readonly,(select rolsuper or rolbypassrls from pg_roles where rolname=current_user) elevated,row_security_active('public.transactions'::regclass) filtered`,
    )
  ).rows[0];
  requireThat(
    identity.role === "masarifi_api" &&
      identity.login === target.apiSessionUser &&
      !identity.elevated &&
      identity.filtered &&
      identity.readonly === "on" &&
      identity.isolation === "repeatable read" &&
      identity.version >= 170000 &&
      identity.version < 180000 &&
      ["database", "address", "port"].every(
        (key) => identity[key] === target[key],
      ),
    "QA_API_COMMAND_CONNECTION_MISMATCH",
  );
  await verifySalaryWriteIsolation(client);
  for (const schema of ["public", "private", "audit"])
    requireThat(
      (
        await client.query(
          "select has_schema_privilege(current_user,$1,'USAGE') allowed",
          [schema],
        )
      ).rows[0].allowed,
      "QA_API_SCHEMA_CAPABILITY_MISSING",
    );
  for (const signature of [
    "private.assert_active_profile(text)",
    "public.current_clerk_user_id()",
    "private.admin_has_permission(text,text,timestamp with time zone)",
    "private.ledger_actor_is_admin(text)",
    "private.lookup_idempotency_key(text,text,text,text)",
    "private.claim_idempotency_key(text,text,text,text,interval)",
    "private.complete_idempotency_key(text,text,text,text,integer,jsonb,text)",
    "private.revise_transaction(text,uuid,bigint,jsonb,text)",
    "private.ledger_account_ids(uuid)",
    "private.enqueue_outbox_event(text,text,uuid,jsonb)",
    "audit.append_event(text,text,text,text,text,text,text,text,text,jsonb)",
  ])
    requireThat(
      (
        await client.query(
          "select has_function_privilege(current_user,$1,'EXECUTE') allowed",
          [signature],
        )
      ).rows[0].allowed,
      "QA_API_FUNCTION_CAPABILITY_MISSING",
    );
  for (const table of [
    "public.profiles",
    "public.transactions",
    "public.transaction_postings",
    "public.accounts",
    "public.account_balances",
    "public.security_events",
  ])
    requireThat(
      (
        await client.query(
          "select has_table_privilege(current_user,$1,'SELECT') allowed",
          [table],
        )
      ).rows[0].allowed,
      "QA_API_READ_CAPABILITY_MISSING",
    );
  requireThat(
    (
      await client.query(
        "select has_table_privilege(current_user,'public.security_events','INSERT') allowed",
      )
    ).rows[0].allowed,
    "QA_API_RATE_CAPABILITY_MISSING",
  );
  for (const column of [
    "transaction_id",
    "revision_no",
    "reason",
    "created_at",
  ])
    requireThat(
      (
        await client.query(
          "select has_column_privilege(current_user,'audit.transaction_revisions',$1,'SELECT') allowed",
          [column],
        )
      ).rows[0].allowed,
      "QA_API_AUDIT_COLUMN_CAPABILITY_MISSING",
    );
  requireThat(
    !(
      await client.query(
        "select has_table_privilege(current_user,'audit.transaction_revisions','SELECT') full_access,has_column_privilege(current_user,'audit.transaction_revisions','before_snapshot','SELECT') before_access,has_column_privilege(current_user,'audit.transaction_revisions','after_snapshot','SELECT') after_access",
      )
    ).rows.some(
      (row) => row.full_access || row.before_access || row.after_access,
    ),
    "QA_API_AUDIT_ACCESS_BROADENED",
  );
}

async function verifySalaryWriteIsolation(client) {
  const access = (
    await client.query(`select
    has_table_privilege(current_user,'public.salary_receipts','INSERT,UPDATE') table_write,
    exists(select 1 from pg_attribute where attrelid='public.salary_receipts'::regclass and attnum>0 and not attisdropped and has_column_privilege(current_user,attrelid,attnum,'INSERT,UPDATE')) column_write`)
  ).rows[0];
  requireThat(
    !access.table_write && !access.column_write,
    "QA_SALARY_WRITE_ACCESS_BROADENED",
  );
}

async function closeWithPhase(runtime, context) {
  try {
    await runtime.close();
  } catch (error) {
    context.reportPhase?.("connection");
    throw error;
  }
}

async function runReviewedSession(frame, context) {
  context.reportPhase?.("configuration");
  const session = JSON.parse(frame.manifest);
  if (context.rehearsal === true)
    requireThat(
      context.mode === "preflight" &&
        session.enabled === false &&
        session.deadlineAt === null &&
        session.restoredSuccessor?.kind === "t03-phase2-restored-once",
      "SUCCESSOR_REHEARSAL_MUST_BE_DISABLED",
    );
  else validateSession(session, Date.now());
  verifyHostAttestation(session, frame.hostAttestation, context.packagePin);
  requireThat(
    [
      "claimTransaction",
      "verifySources",
      "verifyIdentity",
      "verifyVisibility",
      "verifyProvenance",
      "verifyNoSalaryLink",
    ].every((key) => typeof guard[key] === "function"),
    "QA_REVIEWED_GUARD_UNAVAILABLE",
  );
  guard.verifySources(session, path.join(context.packageRoot, "source"));
  const packageRequire = createRequire(
    path.join(context.packageRoot, "compiled/sync/claimed-mutation.runtime.js"),
  );
  const { Client } = packageRequire("pg");
  const { validateEnvironment } = packageRequire(
    "../platform/config/environment.schema.js",
  );
  const { prepareClaimedMutationRuntime } = packageRequire(
    "./claimed-mutation.runtime.js",
  );
  const { hashNormalizedCommand } = packageRequire("../ledger/idempotency.js");
  const configuration = preparePrivateConfiguration(
    {
      worker: Buffer.from(frame.worker),
      api: Buffer.from(frame.api),
      bootstrap: Buffer.from(frame.bootstrap),
    },
    session.configuration,
    {
      Client,
      validateEnvironment,
      trust: {
        extraCaCertsPath: process.env.NODE_EXTRA_CA_CERTS,
        caBytes: fs.readFileSync(CA_PATH),
        nodeTlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
      },
    },
  );
  const runtime = await prepareClaimedMutationRuntime(
    configuration.normalConfig,
    configuration.apiConfig,
    session.workerId,
    session.provenance.imageSha256,
  );
  let stopping = false;
  const shutdown = () => {
    stopping = true;
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  try {
    context.reportPhase?.("runtime-preflight");
    if (session.restoredSuccessor)
      await admitRestoredSuccessor(
        configuration,
        session,
        frame.restoredParent,
      );
    else await verifyInitialAnchors(configuration, session);
    await readOnlyRuntimePreflight(configuration, runtime, session);
    if (context.mode === "preflight")
      return { outcome: "read-only-preflight-passed", claimed: 0, executed: 0 };
    context.reportPhase?.("candidate");
    const run = session.restoredSuccessor ? runRestoredSuccessor : runSession;
    return await run(session, {
      hashNormalizedCommand,
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      stopping: () => stopping,
      journal: createPrivateJournal("/run/masarifi-t03/journal"),
      admitRestoredSuccessor: () =>
        admitRestoredSuccessor(configuration, session, frame.restoredParent),
      observe: (state) => observe(configuration, session, state),
      async claimAndExecute(binding) {
        await runtime.normalPool.withClient(async (worker) => {
          try {
            await worker.query("begin read only");
            await worker.query("set local statement_timeout='5000ms'");
            await verifyWorkerOutcomeCapabilities(worker);
          } finally {
            await worker.query("rollback");
          }
        });
        await runtime.apiCommandPool.withClient(async (api) => {
          try {
            await api.query("begin isolation level repeatable read read only");
            await api.query("set local statement_timeout='5000ms'");
            await verifyApiCommandConnection(api, session.target);
          } finally {
            await api.query("rollback");
          }
        });
        const manifest = operationManifest(session, binding);
        const bootstrap = configuration.createBootstrapClient();
        let claim;
        try {
          await bootstrap.connect();
          claim = await guard.claimTransaction(bootstrap, runtime, manifest);
        } finally {
          await bootstrap.end();
        }
        await runtime.executeClaim(claim);
        return { outcome: "processed-once", claimed: 1, executed: 1 };
      },
    });
  } finally {
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
    await closeWithPhase(runtime, context);
  }
}

module.exports = {
  admitRestoredSuccessor,
  observe,
  readPrivateFrame,
  operationManifest,
  runReviewedSession,
  verifyApiCommandConnection,
  verifyWorkerOutcomeCapabilities,
  readOnlyRuntimePreflight,
  verifyInitialAnchors,
  verifyHostAttestation,
};

if (require.main === module) {
  process.stderr.write("QA_USE_REVIEWED_HOST_ENTRY\n");
  process.exitCode = 2;
}
