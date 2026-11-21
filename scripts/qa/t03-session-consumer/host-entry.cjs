const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const {
  sha256,
  canonical,
  requireCondition: requireThat,
  validateManifest,
} = require("../t03-exact-sync/manifest.cjs");
const guard = require("../t03-exact-sync/runner.cjs");
const adapter = require("./adapter.cjs");
const { verifyPackage } = require("./artifact.cjs");
const {
  parseEnvData,
  preparePrivateConfiguration,
  CA_PATH,
} = require("./config.cjs");
const { validateSession } = require("./session.cjs");
const {
  KIND: RESTORED_KIND,
  STAGING: RESTORED_PINS,
} = require("./successor.cjs");
const diagnosticCodes = require("./diagnostic-codes.json");
const diagnostic = { phase: "configuration" };
const STAGING_ENDPOINT_SHA256 =
  "884b9f14d28b878ed519404f2286e54a23f4f32b568976a1d021ccb257ba3c06";

function verifyEndpointDigest(address, expected = STAGING_ENDPOINT_SHA256) {
  requireThat(
    /^[a-f0-9]{64}$/.test(expected ?? ""),
    "QA_INSPECT_ENDPOINT_PIN_FORMAT",
  );
  requireThat(sha256(address) === expected, "QA_INSPECT_ENDPOINT_MISMATCH");
}

function publicFailure(error, phase = diagnostic.phase) {
  error = error && typeof error === "object" ? error : {};
  const code = diagnosticCodes.guards.includes(error.message)
    ? error.message
    : "QA_HOST_STAGE_FAILED";
  return {
    ok: false,
    phase: diagnosticCodes.phases.includes(phase) ? phase : "configuration",
    code,
    ...(diagnosticCodes.sqlstates.includes(error.code)
      ? { sqlstate: error.code }
      : {}),
    ...(diagnosticCodes.pathGuards.includes(code) &&
    typeof error.publicPath === "string" &&
    /^node_modules\/[A-Za-z0-9@._/-]{1,220}$/.test(error.publicPath)
      ? { publicPath: error.publicPath }
      : {}),
  };
}

async function closeReadOnlyResources(client, runtime) {
  const closed = await Promise.allSettled([
    Promise.resolve().then(() => client.end()),
    ...(runtime ? [Promise.resolve().then(() => runtime.close())] : []),
  ]);
  if (!closed.every((result) => result.status === "fulfilled")) {
    diagnostic.phase = "connection";
    throw new Error("QA_BIND_RESOURCE_CLOSE_FAILED");
  }
}

async function rollbackReadOnly(client) {
  try {
    await client.query("rollback");
  } catch (error) {
    diagnostic.phase = "connection";
    throw Object.assign(new Error("QA_HOST_ROLLBACK_FAILED"), {
      code: error?.code,
    });
  }
}

function validateReviewedInspection(expected, observed) {
  requireThat(expected?.enabled === true, "QA_BIND_EXPECTATIONS_DISABLED");
  requireThat(
    /^[a-f0-9]{64}$/.test(expected.catalogSqlJsonSha256 ?? "") &&
      typeof expected.searchPath === "string" &&
      typeof expected.timeZone === "string" &&
      Array.isArray(expected.contracts) &&
      expected.contracts.length > 0 &&
      Array.isArray(expected.indexes) &&
      expected.indexes.length > 0 &&
      Array.isArray(expected.relations) &&
      expected.relations.length > 0,
    "QA_BIND_REVIEWED_EXPECTATION_MISMATCH",
  );
  for (const key of [
    "catalogSqlJsonSha256",
    "searchPath",
    "timeZone",
    "contracts",
    "indexes",
    "relations",
  ])
    requireThat(
      canonical(expected[key]) === canonical(observed[key]),
      "QA_BIND_REVIEWED_EXPECTATION_MISMATCH",
    );
}

function deriveInitialSession(base, row, resource, sessionId, deadlineAt) {
  const original = guard.projectOriginal(resource);
  return {
    ...base,
    enabled: true,
    sessionId,
    workerId: sessionId,
    deadlineAt,
    binding: {
      userId: row.user_id,
      deviceId: row.device_id,
      resourceId: row.resource_id,
      initialVersion: Number(row.base_version),
      initialRow: row,
      resource,
      originalEffective: original,
    },
  };
}

function configurationPolicy(template, frame) {
  const policy = structuredClone(template.configuration);
  for (const [key, channel] of [
    ["normal", "worker"],
    ["api", "api"],
    ["bootstrap", "bootstrap"],
  ]) {
    const bytes = Buffer.from(frame[channel]);
    requireThat(
      sha256(bytes) === policy[key].envSha256,
      "QA_CONFIG_FILE_PIN_MISMATCH",
    );
    // Host names are derived only from independently pinned original file bytes.
    policy[key].host = new URL(parseEnvData(bytes).DATABASE_URL).hostname;
  }
  return policy;
}

async function inspectAndBind(frame, context, bind) {
  diagnostic.phase = "configuration";
  const expectations = frame.expectations;
  const scope = JSON.parse(
    fs.readFileSync(
      path.join(
        context.packageRoot,
        "scripts/qa/t03-session-consumer/inspection-scope.json",
      ),
      "utf8",
    ),
  );
  requireThat(
    canonical(expectations?.scope) === canonical(scope),
    "QA_INSPECTION_SCOPE_REQUIRED",
  );
  requireThat(
    expectations?.scope?.functions?.length > 0 &&
      expectations.scope.functions.length <= 100 &&
      expectations.scope.relations?.length > 0 &&
      expectations.scope.relations.length <= 30,
    "QA_INSPECTION_SCOPE_REQUIRED",
  );
  if (bind)
    requireThat(expectations.enabled === true, "QA_BIND_EXPECTATIONS_DISABLED");
  const base = JSON.parse(
    fs.readFileSync(
      path.join(
        context.packageRoot,
        "scripts/qa/t03-session-consumer/session.template.json",
      ),
      "utf8",
    ),
  );
  base.configuration = configurationPolicy(base, frame);
  base.host.apiContainerId = expectations.apiContainerId;
  base.host.generalWorkerContainerId = expectations.generalWorkerContainerId;
  base.provenance.reviewedArtifactSha256 = context.packagePin;
  base.target.api = "https://api.staging.masarifiratibi.com";
  const r = createRequire(
    path.join(context.packageRoot, "compiled/sync/claimed-mutation.runtime.js"),
  );
  const { Client } = r("pg");
  const { validateEnvironment } = r("../platform/config/environment.schema.js");
  const configuration = preparePrivateConfiguration(
    {
      worker: Buffer.from(frame.worker),
      api: Buffer.from(frame.api),
      bootstrap: Buffer.from(frame.bootstrap),
    },
    base.configuration,
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
  let runtime;
  let began = false;
  const client = configuration.createBootstrapClient();
  try {
    diagnostic.phase = "connection";
    await client.connect();
    await client.query("begin isolation level repeatable read read only");
    began = true;
    await client.query("set local statement_timeout='5000ms'");
    await client.query("set local lock_timeout='1000ms'");
    await client.query(
      "set local idle_in_transaction_session_timeout='10000ms'",
    );
    diagnostic.phase = "identity";
    const identity = (
      await client.query(
        "select host(inet_server_addr()) address,current_setting('search_path') search_path,current_setting('TimeZone') as \"timeZone\"",
      )
    ).rows[0];
    verifyEndpointDigest(identity.address);
    base.target.address = identity.address;
    await guard.verifyIdentity(client, base);
    await guard.verifyVisibility(client);
    diagnostic.phase = "catalog";
    const catalog = (
      await client.query(
        `with actual as (${guard.catalogSql.trim().replace(/;$/, "")}) select catalog,catalog::text text from actual`,
      )
    ).rows[0];
    const contracts = [];
    diagnostic.phase = "function-contract";
    for (const signature of expectations.scope.functions) {
      requireThat(
        typeof signature === "string" && signature.length <= 300,
        "QA_INSPECTION_SIGNATURE",
      );
      const value = (
        await client.query(
          `select pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.proisstrict strict,p.provolatile volatility,p.proparallel parallel,p.proleakproof leakproof,l.lanname language,p.proconfig configuration,p.proacl::text acl,p.prosrc source,pg_get_functiondef(p.oid) definition from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=$1::regprocedure`,
          [signature],
        )
      ).rows[0];
      requireThat(value, "QA_INSPECTION_FUNCTION_MISSING");
      const { source, definition, ...contract } = value;
      contracts.push({
        signature,
        ...contract,
        sourceSha256: sha256(source),
        sourceLfSha256: sha256(source.replaceAll("\r\n", "\n")),
        definitionSha256: sha256(definition),
      });
    }
    const indexes = (
      await client.query(
        `select n.nspname||'.'||c.relname relation,ni.nspname||'.'||ci.relname name,pg_get_indexdef(i.indexrelid) definition,i.indisunique "unique",i.indisexclusion exclusion,i.indisvalid valid,i.indisready ready,i.indislive live from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class ci on ci.oid=i.indexrelid join pg_namespace ni on ni.oid=ci.relnamespace where i.indrelid=any($1::regclass[]) order by n.nspname,c.relname,ni.nspname,ci.relname`,
        [expectations.scope.relations],
      )
    ).rows;
    const relationNames = (
      await client.query(
        `select c.oid::regclass::text catalog_name,n.nspname||'.'||c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid=any($1::regclass[]) order by n.nspname,c.relname`,
        [expectations.scope.relations],
      )
    ).rows;
    requireThat(
      relationNames.length === expectations.scope.relations.length,
      "QA_INSPECTION_RELATION_MISSING",
    );
    const columns = (
      await client.query(
        `select n.nspname||'.'||c.relname relation,a.attname name,a.attacl::text acl from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where c.oid=any($1::regclass[]) and a.attnum>0 and not a.attisdropped order by n.nspname,c.relname,a.attnum`,
        [expectations.scope.relations],
      )
    ).rows;
    const relations = relationNames.map((name) => {
      const value = catalog.catalog.relations.find(
        (x) => x.name === name.catalog_name,
      );
      requireThat(value, "QA_INSPECTION_RELATION_MISSING");
      return {
        ...value,
        name: name.name,
        columnAcls: columns
          .filter((x) => x.relation === name.name)
          .map(({ name, acl }) => ({ name, acl })),
      };
    });
    const observation = {
      catalogSqlJsonSha256: sha256(catalog.text),
      searchPath: identity.search_path,
      timeZone: identity.timeZone,
      contracts,
      indexes,
      relations,
    };
    if (bind) validateReviewedInspection(expectations, observation);
    // Only after comparison to independent reviewed SQL-text expectations may BIND
    // derive the existing JS-canonical pin from that very same verified snapshot.
    base.provenance.catalogSha256 = sha256(canonical(catalog.catalog));
    base.provenance.sources = Object.fromEntries(
      context.packageManifest.files
        .filter((x) => x.path.startsWith("source/"))
        .map((x) => [x.path.slice(7), x.sha256]),
    );
    for (const [key, signature] of [
      ["claimSha256", "private.claim_client_mutations(text,integer,integer)"],
      [
        "completeSha256",
        "private.complete_client_mutation(uuid,uuid,text,jsonb,jsonb)",
      ],
      [
        "retrySha256",
        "private.retry_client_mutation(uuid,uuid,timestamp with time zone,text)",
      ],
    ])
      base.provenance[key] = sha256(
        (
          await client.query(
            "select pg_get_functiondef($1::regprocedure) definition",
            [signature],
          )
        ).rows[0].definition,
      );
    diagnostic.phase = "candidate";
    const rows = (
      await client.query(
        "select to_jsonb(m)::text text from public.client_mutations m where operation_id=$1",
        ["10de16e6-a966-41b4-a583-1716314b285b"],
      )
    ).rows;
    requireThat(
      rows.length === 1 &&
        sha256(rows[0].text) === base.initialAnchors.mutationSqlJsonSha256,
      "QA_BIND_INITIAL_MUTATION_MISMATCH",
    );
    const row = JSON.parse(rows[0].text);
    const resources = (
      await client.query(
        `select jsonb_build_object('transaction',to_jsonb(t),'postings',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.transaction_postings p where p.transaction_id=t.id),'[]'::jsonb))::text text from public.transactions t where t.id::text=$1 and t.user_id=$2`,
        [row.resource_id, row.user_id],
      )
    ).rows;
    requireThat(
      resources.length === 1 &&
        sha256(resources[0].text) === base.initialAnchors.resourceSqlJsonSha256,
      "QA_BIND_INITIAL_RESOURCE_MISMATCH",
    );
    const session = deriveInitialSession(
      base,
      row,
      JSON.parse(resources[0].text),
      frame.sessionId,
      frame.deadlineAt,
    );
    validateSession(session, Date.now());
    adapter.verifyHostAttestation(
      session,
      frame.hostAttestation,
      context.packagePin,
    );
    guard.verifySources(session, path.join(context.packageRoot, "source"));
    const manifest = {
      ...session,
      binding: {
        row,
        original: session.binding.originalEffective,
        effective: {
          ...session.binding.originalEffective,
          note: row.payload.note,
        },
        payloadSha256: sha256(canonical(row.payload)),
        resourceSha256: sha256(canonical(session.binding.resource)),
      },
    };
    validateManifest(manifest);
    await guard.verifyCandidate(client, manifest);
    await client.query("rollback");
    began = false;
    diagnostic.phase = "runtime-preflight";
    runtime = await r(
      "./claimed-mutation.runtime.js",
    ).prepareClaimedMutationRuntime(
      configuration.normalConfig,
      configuration.apiConfig,
      session.workerId,
      session.provenance.imageSha256,
    );
    await adapter.verifyInitialAnchors(configuration, session);
    await adapter.readOnlyRuntimePreflight(configuration, runtime, session);
    return bind
      ? { ok: true, kind: "private-binding", manifest: session }
      : {
          ok: true,
          kind: "inspect-only-unreviewed",
          ...observation,
          claims: 0,
          dataWrites: 0,
          initialPredicates: true,
          payloadKeys: Object.keys(row.payload).sort(),
        };
  } finally {
    try {
      if (began) {
        await rollbackReadOnly(client);
      }
    } finally {
      await closeReadOnlyResources(client, runtime);
    }
  }
}

function deriveRestoredSession(frame, context, rehearsal) {
  requireThat(
    frame.restoredParent &&
      sha256(frame.restoredParent.parentManifestRaw) ===
        RESTORED_PINS.parentManifestSha256 &&
      sha256(frame.restoredParent.parentJournalRaw) ===
        RESTORED_PINS.parentJournalSha256,
    "SUCCESSOR_PARENT_HASH_MISMATCH",
  );
  requireThat(
    /^t03-[a-z0-9-]{1,100}$/.test(frame.sessionId ?? ""),
    "QA_HOST_SESSION_ID",
  );
  const parent = JSON.parse(frame.restoredParent.parentManifestRaw);
  return restoredManifest(
    parent,
    frame.restoredParent,
    frame.sessionId,
    frame.deadlineAt,
    context,
    rehearsal,
  );
}

// Pure construction does not authorize execution; fixed hashes and fresh database
// admission are checked by the caller before any protected binding is written.
function restoredManifest(
  parent,
  evidence,
  sessionId,
  deadlineAt,
  context,
  rehearsal,
) {
  requireThat(
    /^t03-[a-z0-9-]{1,100}$/.test(sessionId ?? "") &&
      sessionId !== parent.sessionId,
    "SUCCESSOR_PARENT_BINDING_MISMATCH",
  );
  const manifest = {
    ...parent,
    enabled: !rehearsal,
    sessionId,
    workerId: sessionId,
    deadlineAt: rehearsal ? null : deadlineAt,
    provenance: {
      ...parent.provenance,
      reviewedArtifactSha256: context.packagePin,
      sources: Object.fromEntries(
        context.packageManifest.files
          .filter((x) => x.path.startsWith("source/"))
          .map((x) => [x.path.slice(7), x.sha256]),
      ),
    },
    restoredSuccessor: {
      kind: RESTORED_KIND,
      pins: RESTORED_PINS,
      parentEvidenceSha256: sha256(canonical(evidence)),
    },
  };
  if (rehearsal)
    requireThat(deadlineAt === null, "SUCCESSOR_REHEARSAL_MUST_BE_DISABLED");
  else {
    validateSession(manifest, Date.now());
    requireThat(
      Date.parse(manifest.deadlineAt) <= Date.now() + 3600000,
      "SUCCESSOR_WINDOW_LIMIT",
    );
  }
  return manifest;
}

async function main() {
  requireThat(
    process.argv.length === 4 &&
      [
        "--package-only",
        "--inspect",
        "--bind",
        "--preflight",
        "--session",
      ].includes(process.argv[2]),
    "QA_HOST_ARGUMENTS",
  );
  requireThat(
    process.platform === "linux" &&
      process.arch === "x64" &&
      process.version === "v24.20.0" &&
      process.getuid() === 65532,
    "QA_HOST_RUNTIME_IDENTITY",
  );
  const packageRoot = path.resolve(__dirname, "../../..");
  const packagePin = process.argv[3];
  const packageManifest = verifyPackage(packageRoot, packagePin);
  const mode = process.argv[2];
  if (mode === "--package-only")
    return {
      ok: true,
      kind: "package-only",
      files: packageManifest.files.length,
      dependencyFiles: packageManifest.imageDependencies.files.length,
    };
  const frame = await adapter.readPrivateFrame(process.stdin);
  const context = {
    packageRoot,
    packagePin,
    packageManifest,
    reportPhase(phase) {
      if (diagnosticCodes.phases.includes(phase)) diagnostic.phase = phase;
    },
  };
  if (mode !== "--session") {
    const timer = setTimeout(() => {
      process.stderr.write("QA_READ_ONLY_STAGE_DEADLINE\n");
      process.exit(1);
    }, 90000);
    try {
      if (frame.restoredBindingRequest) {
        const rehearsal = frame.restoredBindingRequest === "rehearsal";
        requireThat(
          (rehearsal && mode === "--preflight") ||
            (frame.restoredBindingRequest === "bind" && mode === "--bind"),
          "SUCCESSOR_SEPARATE_ADMISSION_REQUIRED",
        );
        const manifest = deriveRestoredSession(frame, context, rehearsal);
        const result = await adapter.runReviewedSession(
          { ...frame, manifest: JSON.stringify(manifest) },
          { ...context, mode: "preflight", rehearsal },
        );
        return rehearsal
          ? result
          : { ok: true, kind: "private-binding", manifest };
      }
      if (mode === "--inspect" || mode === "--bind")
        return await inspectAndBind(frame, context, mode === "--bind");
      return await adapter.runReviewedSession(frame, {
        ...context,
        mode: "preflight",
      });
    } finally {
      clearTimeout(timer);
    }
  }
  const deadline = Date.parse(JSON.parse(frame.manifest).deadlineAt);
  requireThat(
    Number.isFinite(deadline) &&
      deadline > Date.now() &&
      deadline <= Date.now() + 7200000,
    "QA_HOST_SESSION_DEADLINE",
  );
  // Independent in-container bound survives a broker/browser failure. An
  // unfinished durable binding remains uncertain and is never automatically retried.
  const watchdog = setTimeout(
    () => {
      process.stderr.write("QA_SESSION_WATCHDOG_DEADLINE\n");
      process.exit(1);
    },
    deadline - Date.now() + 120000,
  );
  try {
    return await adapter.runReviewedSession(frame, {
      ...context,
      mode: "session",
    });
  } finally {
    clearTimeout(watchdog);
  }
}

module.exports = {
  validateReviewedInspection,
  publicFailure,
  deriveInitialSession,
  inspectAndBind,
  verifyEndpointDigest,
  STAGING_ENDPOINT_SHA256,
  closeReadOnlyResources,
  deriveRestoredSession,
  restoredManifest,
};
if (require.main === module)
  main()
    .then((value) => process.stdout.write(JSON.stringify(value) + "\n"))
    .catch((error) => {
      process.stdout.write(JSON.stringify(publicFailure(error)) + "\n");
      process.exitCode = 1;
    });
