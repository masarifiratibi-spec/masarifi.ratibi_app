// Dedicated localhost PostgreSQL only. Run from apps/api with ts-node/register/transpile-only.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { setTimeout: sleep } = require("node:timers/promises");
const api = createRequire(require.resolve("../../../apps/api/package.json"));
const { Client } = api("pg");
const { PoolService } = api("./src/platform/database/pool.service");
const { OperationsRepository } = api("./src/operations/operations.repository");
function workerClass() {
  if (!process.argv.includes("--baseline"))
    return api("./src/operations/operations.worker").OperationsWorker;
  const ref = process.env.SCHED_TEST_BASELINE_REF;
  assert.match(ref || "", /^[0-9a-f]{8,40}$/);
  const { execFileSync } = require("node:child_process");
  const Module = require("node:module");
  const ts = api("typescript");
  const filename = api.resolve("./src/operations/operations.worker");
  const source = execFileSync(
    "git",
    ["show", ref + ":apps/api/src/operations/operations.worker.ts"],
    { encoding: "utf8" },
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
  });
  const old = new Module(filename, module);
  old.filename = filename;
  old.paths = Module._nodeModulePaths(require("node:path").dirname(filename));
  old._compile(compiled.outputText, filename);
  return old.exports.OperationsWorker;
}
const OperationsWorker = workerClass();
const database = process.env.PGDATABASE;
assert.match(database || "", /^sched_deadline_[a-z0-9_]+$/);
const host = "127.0.0.1";
const port = Number(process.env.PGPORT);
const login = process.env.SCHED_TEST_LOGIN;
assert.match(login || "", /^[a-z0-9_]+$/);
const url = `postgresql://${login}@${host}:${port}/${database}`;
const admin = new Client({
  host,
  port,
  database,
  user: process.env.PGUSER || "postgres",
});
const groups = [
  ["sync-mutations.retry"],
  ["import.parse"],
  ["privacy.financial-reset-cleanup", "privacy.account-delete"],
  ["operations.job-history-retain"],
  ["platform.outbox.dispatch"],
];
const sql = (s, v) => admin.query(s, v);
const workers = [],
  pools = [];
let commands = 0,
  polls = 0,
  listens = 0;
const original = Client.prototype.query;
Client.prototype.query = function (stmt, ...args) {
  if (this.user === login) {
    commands++;
    const text = typeof stmt === "string" ? stmt : stmt.text;
    if (
      /select private\.claim_(due_jobs|scoped_jobs_with_deadline)/i.test(text)
    )
      polls++;
    if (/^listen /i.test(text)) listens++;
  }
  return original.call(this, stmt, ...args);
};
async function worker(keys, handler, legacy, listenerUrl = url) {
  const settings = {
    get: (key) =>
      ({
        DATABASE_URL: url,
        MASARIFI_DATABASE_POOL_MAX: 2,
        MASARIFI_PROCESS_KIND: "worker",
        MASARIFI_OPERATIONS_JOB_KEYS: keys.join(","),
      })[key],
  };
  const pool = new PoolService(settings);
  pools.push(pool);
  await pool.query("select 1");
  const repo = new OperationsRepository(pool);
  const store = legacy
    ? {
        claim: repo.claim.bind(repo),
        complete: repo.complete.bind(repo),
        heartbeat: repo.heartbeat.bind(repo),
      }
    : repo;
  const w = new OperationsWorker(
    store,
    { run: handler },
    {
      get: (key) => (key === "DATABASE_URL" ? listenerUrl : settings.get(key)),
    },
  );
  workers.push(w);
  return w;
}

async function benchmark() {
  const legacy = process.argv.includes("--baseline");
  const handled = {};
  await sql("truncate public.import_sessions cascade");
  await sql("update private.scheduled_jobs set enabled=false");
  for (const group of groups) {
    await worker(
      group,
      async (key) => {
        handled[key] = (handled[key] || 0) + 1;
        return { processed: 0 };
      },
      legacy,
    );
  }
  const keys = groups.flat();
  const offsets = [4.229, 15.216, 5.224, 18.189, 211.697, 0.736];
  await sql(
    `update private.scheduled_jobs j set enabled=true,
    next_run_at=statement_timestamp()+make_interval(secs=>s.offset_s)
    from unnest($1::text[],$2::float8[]) s(key,offset_s) where j.job_key=s.key`,
    [keys, offsets],
  );
  commands = polls = listens = 0;
  const begin = performance.now();
  workers.forEach((w) => w.start());
  await sleep(75000);
  await Promise.all(workers.map((w) => w.stop()));
  const elapsedMs = Math.round(performance.now() - begin);
  assert.ok(
    polls >= (legacy ? 350 : 20) && polls < (legacy ? 390 : 65),
    "poll count " + polls,
  );
  assert.equal(listens, legacy ? 0 : 5);
  assert.ok(handled["platform.outbox.dispatch"] >= 7);
  console.log(
    JSON.stringify({ legacy, elapsedMs, polls, commands, listens, handled }),
  );
}

async function waitFor(check, timeout = 3500) {
  const until = performance.now() + timeout;
  do {
    const result = await check();
    if (result) return result;
    await sleep(10);
  } while (performance.now() < until);
  throw new Error("Timed out waiting for " + check.toString());
}

async function boundaries() {
  const key = "platform.outbox.dispatch";
  await sql("update private.scheduled_jobs set enabled=false");
  await sql(
    `update private.scheduled_jobs set enabled=true, next_run_at=now()+interval '4 minutes'
    where job_key=$1`,
    [key],
  );
  const events = [];
  const w = await worker(
    [key],
    async () => {
      events.push(performance.now());
      return { processed: 0 };
    },
    false,
  );
  w.start();
  await waitFor(() => listens === 1 && polls > 0);
  const idlePolls = polls;
  await sql(
    "select pg_notify('masarifi_operations_wakeup','sync-mutations.retry')",
  );
  await sleep(100);
  assert.equal(polls, idlePolls, "foreign scope woke the worker");
  await sql("begin");
  await sql(
    "update private.scheduled_jobs set next_run_at=now() where job_key=$1",
    [key],
  );
  await sleep(120);
  assert.equal(events.length, 0, "uncommitted work dispatched");
  await sql("rollback");
  await sleep(60);
  assert.equal(polls, idlePolls, "rolled-back wake dispatched");
  let start = performance.now();
  await sql(
    "update private.scheduled_jobs set next_run_at=clock_timestamp() where job_key=$1",
    [key],
  );
  await waitFor(() => events.length === 1);
  const earlierMs = Math.round(events[0] - start);
  // Leave a manual retry pending while notifications are temporarily unavailable.
  await waitFor(
    async () =>
      (
        await sql(
          "select count(*) n from private.job_runs where job_key=$1 and status='succeeded'",
          [key],
        )
      ).rows[0].n !== "0",
  );
  await sql(
    `update private.scheduled_jobs set next_run_at=now()+interval '4 minutes' where job_key=$1`,
    [key],
  );
  const { rows } =
    await sql(`select pid from pg_stat_activity where datname=current_database()
    and application_name='operations-scheduler-listener'`);
  assert.equal(rows.length, 1);
  await sql("select pg_terminate_backend($1)", [rows[0].pid]);
  start = performance.now();
  const inserted = await sql(
    `insert into private.job_runs(scheduled_job_id,job_key,job_type,owner_spec,
    status,queued_at,correlation_id,retry_of_run_id)
    select scheduled_job_id,job_key,job_type,owner_spec,'queued',clock_timestamp(),'scheduler-wake-fixture',id
    from private.job_runs where job_key=$1 and status='succeeded' order by queued_at desc limit 1 returning id`,
    [key],
  );
  await waitFor(() => events.length === 2);
  const reconnectMs = Math.round(events[1] - start);
  await waitFor(() => listens >= 2);
  assert.equal(
    (
      await sql(
        "select count(*)::int n from private.job_attempts where run_id=$1",
        [inserted.rows[0].id],
      )
    ).rows[0].n,
    1,
  );
  assert.ok(
    earlierMs < 1000 && reconnectMs < 1600,
    JSON.stringify({ earlierMs, reconnectMs }),
  );
  console.log(JSON.stringify({ earlierMs, reconnectMs, listens, attempts: 1 }));
}

async function fallback() {
  const key = "platform.outbox.dispatch";
  await sql("update private.scheduled_jobs set enabled=false");
  await sql(
    "update private.scheduled_jobs set enabled=true, next_run_at=now()+interval '4 minutes' where job_key=$1",
    [key],
  );
  const events = [];
  const unavailable = new URL(url);
  unavailable.port = "1";
  const w = await worker(
    [key],
    async () => {
      events.push(performance.now());
      return { processed: 0 };
    },
    false,
    unavailable.toString(),
  );
  w.start();
  await waitFor(() => polls >= 1);
  const start = performance.now();
  await sql(
    "update private.scheduled_jobs set next_run_at=clock_timestamp() where job_key=$1",
    [key],
  );
  await waitFor(() => events.length === 1);
  const delayMs = Math.round(events[0] - start);
  assert.equal(listens, 0);
  assert.ok(delayMs < 1400);
  console.log(JSON.stringify({ fallbackPolls: polls, delayMs }));
}

async function lease() {
  const key = "platform.outbox.dispatch";
  await sql("update private.scheduled_jobs set enabled=false");
  await sql(
    `update private.scheduled_jobs set enabled=true, timeout_seconds=10, retry_safe=true, max_attempts=2,
    next_run_at=now()-interval '30 seconds' where job_key=$1`,
    [key],
  );
  const {
    rows: [initial],
  } = await sql(
    `select c->>'runId' rid from private.claim_due_jobs(
    'abandoned',1,clock_timestamp()-interval '9 seconds',array[$1::text]) c`,
    [key],
  );
  await sql(
    "update private.scheduled_jobs set enabled=false where job_key=$1",
    [key],
  );
  const {
    rows: [hint],
  } = await sql(
    `select private.claim_scoped_jobs_with_deadline('probe',1,array[$1::text]) value`,
    [key],
  );
  assert.equal(hint.value.claims.length, 0);
  assert.ok(hint.value.delayMs > 0 && hint.value.delayMs <= 1000);
  let dispatches = 0;
  const w = await worker(
    [key],
    async () => {
      dispatches++;
      return { processed: 0 };
    },
    false,
  );
  w.start();
  await waitFor(() => dispatches === 1, 8500);
  await w.stop();
  const {
    rows: [timing],
  } = await sql(
    `select a.safe_error_code, count(*) over()::int as pairs,
    extract(epoch from a.completed_at-(a.heartbeat_at+interval '10s'))*1000 as lease_ms,
    extract(epoch from b.started_at-a.next_attempt_at)*1000 as retry_ms
    from private.job_attempts a join private.job_attempts b on b.run_id=a.run_id and b.attempt_no=2
    where a.run_id=$1 and a.attempt_no=1`,
    [initial.rid],
  );
  assert.equal(timing.safe_error_code, "WORKER_LEASE_EXPIRED");
  assert.equal(timing.pairs, 1);
  assert.ok(
    +timing.lease_ms >= 0 &&
      +timing.lease_ms < 1000 &&
      +timing.retry_ms >= 0 &&
      +timing.retry_ms < 1000,
    JSON.stringify(timing),
  );
  console.log(JSON.stringify(timing));
}

(async () => {
  try {
    await admin.connect();
    if (process.argv.includes("--fallback")) await fallback();
    else if (process.argv.includes("--lease")) await lease();
    else if (process.argv.includes("--boundaries")) await boundaries();
    else await benchmark();
  } finally {
    await Promise.all(workers.map((w) => w.stop()));
    await Promise.all(pools.map((pool) => pool.onModuleDestroy()));
    await admin.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
