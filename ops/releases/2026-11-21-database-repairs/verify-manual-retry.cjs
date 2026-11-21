// Run on a fresh disposable branch database, e.g. PGDATABASE=sched_retry_test node <this file>.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { Client } = createRequire(require.resolve('../../../apps/api/package.json'))('pg');

const database = process.env.PGDATABASE || '';
assert.match(database, /^sched_retry_[a-z0-9_]+$/, 'Use a disposable sched_retry_ database');
const options = { host: '127.0.0.1', database, statement_timeout: 5000 };
const [setup, admin, first, second] = Array.from({ length: 4 }, () => new Client(options));
const job = 'operations.manual-retry-test';
const actor = 'manual-retry-test-admin';
let sequence = 0;

async function claim(conn, worker, key = job) {
  const args = [worker];
  const scope = key === null ? '' : ', $2::text[]';
  if (key !== null) args.push([key]);
  const result = await conn.query(
    `select c from private.claim_due_jobs($1, 1, clock_timestamp()${scope}) c`, args);
  return result.rows.map(row => row.c);
}

async function state(id) {
  const { rows } = await setup.query(`select status, version, retry_of_run_id, correlation_id,
    (select count(*)::int from private.job_attempts a where a.run_id = r.id) attempts
    from private.job_runs r where id = $1`, [id]);
  return rows[0];
}

async function action(id, version, type) {
  const request = 'retry-test-' + ++sequence;
  const { rows } = await admin.query(`select private.request_job_action($1,$2,$3,$4,
    'Regression test of manual retry',$5,'sha256:' || lpad(to_hex($6::int),64,'0')) result`,
    [id, type, version, actor, request, sequence]);
  return { ...rows[0].result, request };
}

async function finish(attempt, worker, status) {
  await first.query(`select private.complete_job_attempt($1,$2,$3,$4,'{}',clock_timestamp())`,
    [attempt, worker, status, status === 'failed' ? 'JOB_FAILED' : null]);
}

async function enqueue() {
  await setup.query('update private.scheduled_jobs set next_run_at = clock_timestamp() where job_key = $1', [job]);
  const [parent] = await claim(first, 'first');
  assert.ok(parent);
  await finish(parent.attemptId, 'first', 'failed');
  const source = await state(parent.runId);
  assert.equal(source.status, 'dead_lettered');
  const retry = await action(parent.runId, source.version, 'retry');
  assert.equal(retry.status, 'queued');
  assert.equal(retry.retryOfRunId, parent.runId);
  return retry;
}

async function run() {
  await Promise.all([setup, admin, first, second].map(c => c.connect()));
  // The unscoped worker can claim any job. Isolate its schedule in this disposable database.
  await setup.query('update private.scheduled_jobs set enabled = false');
  await setup.query('insert into public.profiles(id,status) values ($1,\'active\')', [actor]);
  await setup.query('insert into public.admin_profiles(user_id,status) values ($1,\'active\')', [actor]);
  await setup.query(`insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
    select $1,id,$1,'Local retry test fixture' from public.roles where key='super-admin'`, [actor]);
  await admin.query('set role masarifi_api');
  await admin.query("select set_config('request.jwt.claims',$1,false)",
    [JSON.stringify({ sub: actor, role: 'authenticated', sid: 'fixture' })]);
  for (const c of [first, second]) await c.query('set role masarifi_worker');
  await assert.rejects(claim(admin, 'api'), { code: '42501' });
  await first.query(`select private.register_job($1,13::smallint,$1,
    '{"kind":"interval","everySeconds":60,"timezone":"UTC"}',true,60,1::smallint,'{}',true,true)`, [job]);

  for (let i = 0; i < 12; i++) {
    const retry = await enqueue();
    const scoped = i % 2 === 0;
    assert.deepEqual(await claim(second, 'wrong-scope', 'sync-mutations.retry'), []);
    await first.query('begin');
    const [winner] = await claim(first, 'first', scoped ? job : null);
    assert.equal(winner?.runId, retry.runId, 'First eligible poll must acquire the queued retry');
    assert.deepEqual(await claim(second, 'second', scoped ? null : job), []);
    if (i === 0) {
      await first.query('rollback');
      const [recovered] = await claim(second, 'second');
      assert.equal(recovered.runId, retry.runId);
      await finish(recovered.attemptId, 'second', 'succeeded');
    } else {
      await first.query('commit');
      assert.deepEqual(await claim(second, 'second'), []);
      await assert.rejects(action(retry.runId, retry.version, 'cancel'), { code: '40001' });
      const running = await state(retry.runId);
      await assert.rejects(action(retry.runId, running.version, 'cancel'), /OPERATIONS_CANCEL_UNSAFE/);
      await finish(winner.attemptId, 'first', 'succeeded');
    }
    const done = await state(retry.runId);
    assert.equal(done.status, 'succeeded');
    assert.equal(done.attempts, 1);
    assert.equal(done.retry_of_run_id, retry.retryOfRunId);
    assert.equal(done.correlation_id, retry.request);
  }

  const retry = await enqueue();
  await admin.query('begin');
  assert.equal((await action(retry.runId, retry.version, 'cancel')).status, 'canceled');
  assert.deepEqual(await claim(first, 'first'), []);
  await admin.query('commit');
  assert.deepEqual(await claim(second, 'second', null), []);
  assert.equal((await state(retry.runId)).attempts, 0);
  await setup.query('update private.scheduled_jobs set next_run_at = clock_timestamp() where job_key = $1', [job]);
  const [scheduled] = await claim(first, 'first');
  assert.ok(scheduled && scheduled.runId !== retry.runId);
  await finish(scheduled.attemptId, 'first', 'succeeded');
  const revoked = await enqueue();
  await first.query(`select private.register_job($1,13::smallint,$1,
    '{"kind":"interval","everySeconds":60,"timezone":"UTC"}',true,60,1::smallint,'{}',false,true)`, [job]);
  assert.deepEqual(await claim(first, 'first'), []);
  const rejected = await state(revoked.runId);
  assert.equal(rejected.status, 'dead_lettered');
  assert.equal(rejected.attempts, 0);
  const summary = await setup.query('select result_summary from private.job_runs where id=$1', [revoked.runId]);
  assert.equal(summary.rows[0].result_summary.errorCode, 'OPERATIONS_RETRY_UNSAFE');
  console.log('12 first-poll retries, 12 overlapping worker polls, 1 rollback recovery, 1 canceled before pickup, periodic schedule resumed, revoked safety blocked execution');
}

run().catch(e => { console.error(e.message); process.exitCode = 1; })
  .finally(() => Promise.allSettled([first, second, admin, setup].map(c => c.end())));
