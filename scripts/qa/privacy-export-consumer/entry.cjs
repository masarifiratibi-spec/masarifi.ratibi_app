const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const OWNER =
  "cf8bf8b051f58c923f0b4634d504b47f1183ae86207fbe4d803b869ef6d77790";
const hash = (value) => createHash("sha256").update(value).digest("hex");
function requireCondition(value, code) {
  if (!value) throw Error(code);
}
function verifyPackage() {
  const bytes = fs.readFileSync(path.join(__dirname, "manifest.json"));
  requireCondition(
    hash(bytes) === process.env.MASARIFI_PRIVACY_QA_MANIFEST_SHA256,
    "EXPORT_QA_PACKAGE_PIN",
  );
  const manifest = JSON.parse(bytes);
  for (const [file, expected] of Object.entries(manifest.files)) {
    requireCondition(
      !file.startsWith("/") &&
        !file.includes("\\") &&
        !file.split("/").includes(".."),
      "EXPORT_QA_PACKAGE_PATH",
    );
    requireCondition(
      hash(fs.readFileSync(path.join(__dirname, file))) === expected,
      "EXPORT_QA_PACKAGE_BYTES",
    );
  }
  requireCondition(
    Object.keys(manifest.productFiles).sort().join(",") ===
      "dist/src/security/export-storage.js,dist/src/security/security.worker.js",
    "EXPORT_QA_PRODUCT_SCOPE",
  );
  for (const [file, expected] of Object.entries(manifest.productFiles))
    requireCondition(
      hash(fs.readFileSync("/app/" + file)) === expected,
      "EXPORT_QA_PRODUCT_BYTES",
    );
}
function policyBinding() {
  const bytes = process.env.MASARIFI_PRIVACY_QA_POLICY || "";
  requireCondition(
    hash(bytes) === process.env.MASARIFI_PRIVACY_QA_POLICY_SHA256 &&
      /^[a-f0-9]{64}$/.test(
        process.env.MASARIFI_PRIVACY_QA_APPROVAL_SHA256 || "",
      ),
    "EXPORT_QA_APPROVAL_BINDING_REQUIRED",
  );
  const policy = JSON.parse(bytes);
  requireCondition(
    Object.keys(policy).sort().join(",") ===
      "deadline,maximumJobs,notBefore,ownerSha256,requestId,sessionId",
    "EXPORT_QA_POLICY",
  );
  requireCondition(
    policy.ownerSha256 === OWNER &&
      policy.maximumJobs === 1 &&
      /^t03-private-export-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        policy.sessionId,
      ),
    "EXPORT_QA_POLICY",
  );
  const start = Date.parse(policy.notBefore),
    end = Date.parse(policy.deadline),
    now = Date.now();
  requireCondition(
    Number.isFinite(start) &&
      end - start === 600000 &&
      now >= start &&
      now - start <= 30000,
    "EXPORT_QA_START_WINDOW",
  );
  return { policy, policySha256: hash(bytes) };
}
function configuration(limits) {
  const url = new URL(process.env.DATABASE_URL);
  requireCondition(
    ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname === "aws-0-eu-central-1.pooler.supabase.com" &&
      url.port === "5432" &&
      decodeURIComponent(url.username).includes("qcffvfbpzvpwcwxwjyro") &&
      url.searchParams.get("sslmode") === "verify-full",
    "EXPORT_QA_DATABASE_TARGET",
  );
  requireCondition(
    process.env.NODE_EXTRA_CA_CERTS ===
      "/etc/ssl/certs/masarifi-database-ca.crt" &&
      hash(fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS)) ===
        "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7",
    "EXPORT_QA_CA_PIN",
  );
  requireCondition(
    process.env.SUPABASE_URL === "https://qcffvfbpzvpwcwxwjyro.supabase.co" &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    "EXPORT_QA_STORAGE_TARGET",
  );
  requireCondition(
    process.env.MASARIFI_PRIVACY_HANDLER_MANIFEST ===
      limits.MANIFEST.join(",") &&
      process.env.MASARIFI_EXPORT_RETENTION_HOURS ===
        String(limits.RETENTION_HOURS),
    "EXPORT_QA_CONFIGURATION_PIN",
  );
  const settings = {
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: "production",
    MASARIFI_PROCESS_KIND: "worker",
    MASARIFI_DATABASE_POOL_MAX: 1,
    MASARIFI_PRIVACY_HANDLER_MANIFEST: [...limits.MANIFEST],
    MASARIFI_EXPORT_MAX_BYTES: limits.MAX_BYTES,
    MASARIFI_EXPORT_MAX_ENTRIES: limits.MAX_ENTRIES,
    MASARIFI_EXPORT_RETENTION_HOURS: limits.RETENTION_HOURS,
  };
  return {
    get: (key) => settings[key],
    getRequired: (key) => {
      requireCondition(
        Object.hasOwn(settings, key) && settings[key] !== undefined,
        "EXPORT_QA_CONFIGURATION_REQUIRED",
      );
      return settings[key];
    },
  };
}
async function main() {
  verifyPackage();
  require("/app/node_modules/reflect-metadata");
  const {
    PoolService,
  } = require("/app/dist/src/platform/database/pool.service");
  const {
    SecurityRepository,
  } = require("/app/dist/src/security/security.repository");
  const {
    SecurityWorkerService,
  } = require("/app/dist/src/security/security.worker");
  const { ExportStorage } = require("/app/dist/src/security/export-storage");
  const {
    IdentityPrivacyHandler,
  } = require("/app/dist/src/identity/identity-privacy.handler");
  const {
    TrackingPrivacyHandler,
  } = require("/app/dist/src/tracking/tracking-privacy.handler");
  const { AiPrivacyHandler } = require("/app/dist/src/ai/ai-privacy.handler");
  const {
    EngagementPrivacyHandler,
  } = require("/app/dist/src/engagement/engagement-privacy.handler");
  const limits = require("./guarded-export.cjs");
  if (process.argv.slice(2).join(" ") === "--package-only") {
    console.log(
      JSON.stringify({
        packageOnly: true,
        existingWorkerAndFourHandlersImported: true,
        credentialsRead: false,
        workerStarted: false,
      }),
    );
    return;
  }
  requireCondition(
    process.argv.length === 2 &&
      process.platform === "linux" &&
      process.getuid() === 65532,
    "EXPORT_QA_RUNTIME_IDENTITY",
  );
  const binding = policyBinding();
  const config = configuration(limits);
  const {
    createPrivateJournal,
  } = require("./shared/t03-session-consumer/journal.cjs");
  const journal = createPrivateJournal("/run/masarifi-t03/journal");
  const state = {
    sessionId: binding.policy.sessionId,
    kind: "owner-private-export-only",
    requestId: binding.policy.requestId,
    policySha256: binding.policySha256,
    approvalSha256: process.env.MASARIFI_PRIVACY_QA_APPROVAL_SHA256,
    phase: "starting",
    consumed: 0,
    heartbeatAt: new Date().toISOString(),
  };
  journal.begin(state);
  const rawPool = new PoolService(config);
  const context = limits.createGuardedExportContext(binding.policy, () => {
    state.consumed = 1;
    state.phase = "claiming";
    state.heartbeatAt = new Date().toISOString();
    journal.save(state);
  });
  const pool = context.pool(rawPool);
  const unavailable = new Proxy(
    {},
    {
      get() {
        throw Error("EXPORT_QA_EXTERNAL_CAPABILITY_FORBIDDEN");
      },
    },
  );
  const cancellation = new AbortController();
  let stopped = false;
  const stop = () => {
    stopped = true;
    cancellation.abort();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  const fetcher = context.fetch((url, input) =>
    fetch(url, {
      ...input,
      signal: AbortSignal.any([input.signal, cancellation.signal]),
    }),
  );
  const worker = new SecurityWorkerService(
    new SecurityRepository(pool),
    new ExportStorage(config, fetcher),
    new IdentityPrivacyHandler(pool, unavailable),
    new TrackingPrivacyHandler(pool, unavailable),
    new AiPrivacyHandler(pool, unavailable),
    new EngagementPrivacyHandler(pool, unavailable),
    config,
    unavailable,
  );
  const hardStop = setTimeout(
    () => {
      process.stderr.write("EXPORT_QA_HARD_DEADLINE\n");
      process.exit(1);
    },
    Date.parse(binding.policy.deadline) + 120000 - Date.now(),
  );
  const heartbeat = setInterval(() => {
    try {
      state.progress = context.progress;
      state.heartbeatAt = new Date().toISOString();
      journal.save(state);
    } catch {
      process.stderr.write("EXPORT_QA_JOURNAL_FAILED\n");
      process.exit(1);
    }
  }, 10000);
  try {
    await rawPool.ping(2000);
    requireCondition(!stopped, "EXPORT_QA_STOPPED");
    state.phase = "processing";
    journal.save(state);
    // One explicit existing job only. Never start/runOnce, poll, retry or resume.
    await worker.runJob("privacy.export-generate");
    requireCondition(
      !stopped &&
        context.progress.status === "ready" &&
        context.progress.event &&
        context.progress.head,
      "EXPORT_QA_NOT_COMPLETED",
    );
    state.phase = "ready";
    state.progress = context.progress;
    state.heartbeatAt = new Date().toISOString();
    journal.save(state);
  } catch (error) {
    state.phase = stopped ? "stopped-uncertain" : "failed-uncertain";
    state.progress = context.progress;
    state.heartbeatAt = new Date().toISOString();
    journal.save(state);
    throw error;
  } finally {
    clearInterval(heartbeat);
    clearTimeout(hardStop);
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    await rawPool.onModuleDestroy();
  }
}
if (require.main === module)
  main().catch((error) => {
    const code =
      error instanceof Error && /^EXPORT_QA_[A-Z_]+$/.test(error.message)
        ? error.message
        : "EXPORT_QA_STOPPED";
    process.stderr.write(code + "\n");
    process.exitCode = 1;
  });
