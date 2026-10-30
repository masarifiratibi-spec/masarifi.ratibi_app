const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const OWNER = 'cf8bf8b051f58c923f0b4634d504b47f1183ae86207fbe4d803b869ef6d77790';
function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}
function verifyPackage() {
  const bytes = fs.readFileSync(path.join(__dirname, 'manifest.json'));
  requireCondition(
    hash(bytes) === process.env.MASARIFI_REPORT_QA_MANIFEST_SHA256,
    'REPORT_QA_PACKAGE_PIN',
  );
  const manifest = JSON.parse(bytes);
  for (const [relative, expected] of Object.entries(manifest.files)) {
    requireCondition(
      !relative.startsWith('/') && !relative.split('/').includes('..'),
      'REPORT_QA_PACKAGE_PATH',
    );
    requireCondition(
      hash(fs.readFileSync(path.join(__dirname, relative))) === expected,
      'REPORT_QA_PACKAGE_BYTES',
    );
  }
}
function policyBinding() {
  const bytes = process.env.MASARIFI_REPORT_QA_POLICY || '';
  requireCondition(
    hash(bytes) === process.env.MASARIFI_REPORT_QA_POLICY_SHA256 &&
      /^[a-f0-9]{64}$/.test(process.env.MASARIFI_REPORT_QA_APPROVAL_SHA256 || ''),
    'REPORT_QA_APPROVAL_BINDING_REQUIRED',
  );
  const policy = JSON.parse(bytes);
  requireCondition(
    Object.keys(policy).sort().join(',') === 'deadline,maximumJobs,notBefore,ownerSha256,sessionId',
    'REPORT_QA_POLICY_INVALID',
  );
  requireCondition(
    policy.ownerSha256 === OWNER &&
      policy.maximumJobs === 6 &&
      /^t03-report-pdf-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        policy.sessionId,
      ),
    'REPORT_QA_SCOPE_INVALID',
  );
  const start = Date.parse(policy.notBefore),
    end = Date.parse(policy.deadline),
    now = Date.now();
  requireCondition(
    Number.isFinite(start) && end - start === 600000 && now >= start && now - start <= 30000,
    'REPORT_QA_START_WINDOW',
  );
  return { policy, policySha256: hash(bytes) };
}
function configuration() {
  const database = new URL(process.env.DATABASE_URL);
  requireCondition(
    database.hostname === 'aws-0-eu-central-1.pooler.supabase.com' &&
      database.port === '5432' &&
      database.username.includes('qcffvfbpzvpwcwxwjyro') &&
      database.searchParams.get('sslmode') === 'verify-full',
    'REPORT_QA_DATABASE_TARGET',
  );
  requireCondition(
    process.env.SUPABASE_URL === 'https://qcffvfbpzvpwcwxwjyro.supabase.co' &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
      process.env.NODE_EXTRA_CA_CERTS === '/etc/ssl/certs/masarifi-database-ca.crt',
    'REPORT_QA_STORAGE_OR_CA_TARGET',
  );
  const settings = {
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: 'production',
    MASARIFI_PROCESS_KIND: 'worker',
    MASARIFI_DATABASE_POOL_MAX: 1,
    MASARIFI_REPORT_BATCH_SIZE: 1,
    MASARIFI_REPORT_MAX_ATTEMPTS: 2,
    MASARIFI_REPORT_MAX_BYTES: 2000000,
  };
  return {
    get: (key) => settings[key],
    getRequired: (key) => {
      requireCondition(
        Object.hasOwn(settings, key) && settings[key] !== undefined,
        'REPORT_QA_CONFIG_REQUIRED',
      );
      return settings[key];
    },
  };
}
async function main() {
  verifyPackage();
  require('/app/node_modules/reflect-metadata');
  const { PoolService } = require('/app/dist/src/platform/database/pool.service');
  const { ReportsRepository } = require('/app/dist/src/reports/reports.repository');
  const { ReportsStorage } = require('/app/dist/src/reports/reports.storage');
  const { ReportsWorker } = require('/app/dist/src/reports/reports.worker');
  const { createGuardedReportPool } = require('./guarded-pool.cjs');
  if (process.argv.slice(2).join(' ') === '--package-only') {
    console.log(
      JSON.stringify({
        packageOnly: true,
        moduleClosureVerified: true,
        workerStarted: false,
        credentialsRead: false,
      }),
    );
    return;
  }
  requireCondition(
    process.argv.length === 2 && process.platform === 'linux' && process.getuid() === 65532,
    'REPORT_QA_RUNTIME_IDENTITY',
  );
  const binding = policyBinding();
  const config = configuration();
  const { createPrivateJournal } = require('./shared/t03-session-consumer/journal.cjs');
  // Reuse only the unchanged journal utility, with this container's separate empty host mount.
  const journal = createPrivateJournal('/run/masarifi-t03/journal');
  const state = {
    sessionId: binding.policy.sessionId,
    kind: 'owner-pdf-download-only',
    policySha256: binding.policySha256,
    approvalSha256: process.env.MASARIFI_REPORT_QA_APPROVAL_SHA256,
    phase: 'starting',
    consumed: 0,
    inflight: null,
    completed: 0,
    heartbeatAt: new Date().toISOString(),
  };
  journal.begin(state);
  const pool = new PoolService(config);
  const guardedPool = createGuardedReportPool(pool, binding.policy, (id) => {
    state.consumed++;
    state.inflight = id;
    state.phase = 'processing';
    state.heartbeatAt = new Date().toISOString();
    journal.save(state);
  });
  const worker = new ReportsWorker(
    new ReportsRepository(guardedPool),
    new ReportsStorage(config),
    config,
  );
  let stopped = false,
    lastHeartbeat = 0;
  process.once('SIGTERM', () => {
    stopped = true;
  });
  process.once('SIGINT', () => {
    stopped = true;
  });
  const hardStop = setTimeout(
    () => {
      process.stderr.write('REPORT_QA_HARD_DEADLINE\n');
      process.exit(1);
    },
    Date.parse(binding.policy.deadline) + 120000 - Date.now(),
  );
  hardStop.unref();
  try {
    await pool.ping(2000);
    while (
      !stopped &&
      Date.now() < Date.parse(binding.policy.deadline) &&
      state.consumed < binding.policy.maximumJobs
    ) {
      const before = state.consumed;
      const found = await worker.runJob('report.generate');
      if (found) {
        requireCondition(state.consumed === before + 1, 'REPORT_QA_SCOPE_RACE');
        requireCondition(
          guardedPool.progress.lastStatus === 'ready',
          'REPORT_QA_GENERATION_FAILED',
        );
        state.completed++;
        state.inflight = null;
        state.phase = 'waiting';
      }
      if (found || Date.now() - lastHeartbeat >= 10000) {
        state.heartbeatAt = new Date().toISOString();
        journal.save(state);
        lastHeartbeat = Date.now();
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    state.phase = stopped ? 'stopped' : 'window-ended';
    state.heartbeatAt = new Date().toISOString();
    journal.save(state);
  } finally {
    await pool.onModuleDestroy();
    clearTimeout(hardStop);
  }
}
if (require.main === module)
  main().catch((error) => {
    const code =
      error instanceof Error && /^REPORT_QA_[A-Z_]+$/.test(error.message)
        ? error.message
        : 'REPORT_QA_STOPPED';
    process.stderr.write(code + '\n');
    process.exitCode = 1;
  });
