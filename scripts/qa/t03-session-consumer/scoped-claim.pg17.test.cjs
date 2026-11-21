const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const { Client } = createRequire(path.join(root, 'apps/api/package.json'))('pg');
const { splitStatements } = require(path.join(root, 'scripts/qa/t03-session-consumer/product-schema.cjs'));
const fixture = path.join(root, '.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17');
const receiptPath = process.env.T03_FIXTURE_RECEIPT_PATH;
assert.ok(receiptPath && path.resolve(receiptPath).startsWith(fixture + path.sep));
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
assert.equal(receipt.port, 55473);
assert.equal(receipt.listen, '127.0.0.1');
assert.equal(receipt.status, 'verified');
const migrationPath = path.join(root, 'supabase/migrations/20261023200000_scoped_operations_claims.sql');

test('scoped ordinary claims isolate new/retry/stale work, preserve default semantics and enforce ACLs', async () => {
  const db = new Client({ host: '127.0.0.1', port: 55473, user: 't03_owner', database: 't03_synthetic', connectionTimeoutMillis: 2000, statement_timeout: 5000, lock_timeout: 1000 });
  await db.connect();
  try {
    const identity = (await db.query("select current_setting('data_directory') data,(pg_control_system()).system_identifier::text system, current_setting('server_version_num')::int version")).rows[0];
    assert.equal(path.resolve(identity.data), path.resolve(receipt.dataDirectory));
    assert.equal(identity.system, receipt.systemIdentifier);
    assert.ok(identity.version >= 170000 && identity.version < 180000);
    await db.query('BEGIN');
    assert.equal((await db.query("select to_regclass('private.scheduled_jobs') present")).rows[0].present, null, 'never replace an existing fixture catalog');
    const foundation = splitStatements(fs.readFileSync(path.join(root, 'supabase/migrations/20260827000200_outbox_queue_functions.sql'), 'utf8'));
    if (!(await db.query("select to_regprocedure('private.set_updated_at_and_version()') present")).rows[0].present)
      for (const sql of foundation.filter(sql => /^(create function|alter function|revoke all on function) private\.set_updated_at_and_version/m.test(sql.trim()))) await db.query(sql);
    const original = splitStatements(fs.readFileSync(path.join(root, 'supabase/migrations/20260906130000_phase13_operations.sql'), 'utf8'));
    const selected = original.filter(sql => {
      const head = sql.trim();
      return /^(create function|alter function) private\.(jsonb_object_key_count|valid_safe_summary|guard_job_attempt_update|claim_due_jobs)\b/.test(head)
        || /^create table private\.(scheduled_jobs|job_runs|job_attempts)\b/.test(head)
        || /^alter table private\.(scheduled_jobs|job_runs|job_attempts) owner/.test(head)
        || /^create (unique )?index (scheduled_jobs|job_runs|job_attempts)_/.test(head)
        || /^create trigger (scheduled_jobs_version|job_runs_version|job_attempts_append_only)\b/.test(head);
    });
    for (const sql of selected) await db.query(sql);
    await db.query('REVOKE ALL ON FUNCTION private.claim_due_jobs(text,integer,timestamptz) FROM PUBLIC; GRANT EXECUTE ON FUNCTION private.claim_due_jobs(text,integer,timestamptz) TO masarifi_worker;');
    const before = (await db.query("select pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p where p.oid='private.claim_due_jobs(text,integer,timestamptz)'::regprocedure")).rows[0];
    await db.query('GRANT masarifi_migration TO current_user WITH SET TRUE, INHERIT FALSE');
    const memberships = async () => (await db.query("SELECT to_jsonb(m) membership FROM pg_auth_members m WHERE roleid='masarifi_migration'::regrole ORDER BY member,grantor")).rows;
    const membershipBefore = await memberships();
    if (fs.existsSync(migrationPath)) await db.query(fs.readFileSync(migrationPath, 'utf8'));
    assert.deepEqual(await memberships(), membershipBefore, 'preserve pre-existing membership grants and their options');
    const after = (await db.query("select pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p where p.oid='private.claim_due_jobs(text,integer,timestamptz)'::regprocedure")).rows[0];
    assert.deepEqual(after, before, 'original overload is byte/ACL compatible');
    const now = new Date('2026-10-26T17:00:00.000Z');
    for (const scenario of ['new', 'retry', 'stale', 'default']) {
      await db.query('SAVEPOINT scenario');
      const jobs = (await db.query(`INSERT INTO private.scheduled_jobs(job_key,owner_spec,job_type,schedule,enabled,timeout_seconds,max_attempts,configuration,retry_safe,cancel_safe,next_run_at)
        SELECT key,6,'inert.fixture','{"kind":"interval","timezone":"UTC","everySeconds":60}',true,60,3,'{}',true,true,$1::timestamptz-interval '1 hour'
        FROM unnest(ARRAY['sync-mutations.retry','clerk.webhook.process']) key RETURNING id,job_key`, [now])).rows;
      if (scenario === 'retry' || scenario === 'stale') {
        for (const job of jobs) {
          const run = (await db.query(`INSERT INTO private.job_runs(scheduled_job_id,job_key,job_type,owner_spec,status,queued_at,started_at,correlation_id)
            VALUES($1,$2,'inert.fixture',6,$3,$4::timestamptz-interval '2 hours',$4::timestamptz-interval '1 hour','inert') RETURNING id`, [job.id, job.job_key, scenario === 'retry' ? 'retrying' : 'running', now])).rows[0];
          await db.query(`INSERT INTO private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at,completed_at,next_attempt_at)
            VALUES($1,1,'inert-old',$2,$3::timestamptz-interval '1 hour',$3::timestamptz-interval '1 hour',
              CASE WHEN $2='failed' THEN $3::timestamptz-interval '59 minutes' END,CASE WHEN $2='failed' THEN $3::timestamptz-interval '1 minute' END)`, [run.id, scenario === 'retry' ? 'failed' : 'running', now]);
        }
      }
      const unrelated = async () => (await db.query(`select jsonb_build_object('job',to_jsonb(j),'runs',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from private.job_runs r where r.scheduled_job_id=j.id),
        'attempts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from private.job_attempts a join private.job_runs r on r.id=a.run_id where r.scheduled_job_id=j.id)) snapshot from private.scheduled_jobs j where job_key='clerk.webhook.process'`)).rows[0].snapshot;
      const untouched = await unrelated();
      const claimed = await db.query(scenario === 'default'
        ? 'select * from private.claim_due_jobs($1,2,$2)'
        : 'select * from private.claim_due_jobs($1,2,$2,$3::text[])', scenario === 'default' ? ['inert-worker', now] : ['inert-worker', now, ['sync-mutations.retry']]);
      const keys = claimed.rows.map(row => row.claim_due_jobs.jobKey);
      if (scenario === 'default') assert.deepEqual(keys.sort(), ['clerk.webhook.process', 'sync-mutations.retry']);
      else {
        assert.deepEqual(await unrelated(), untouched, scenario + ' unrelated rows remain byte-identical');
        assert.deepEqual(keys, scenario === 'stale' ? [] : ['sync-mutations.retry']);
        if (scenario === 'stale') {
          const retried = await db.query('select * from private.claim_due_jobs($1,2,$2,$3::text[])', ['inert-worker', new Date(now.getTime() + 10000), ['sync-mutations.retry']]);
          assert.deepEqual(retried.rows.map(row => row.claim_due_jobs.jobKey), ['sync-mutations.retry']);
          assert.deepEqual(await unrelated(), untouched);
        }
      }
      await db.query('ROLLBACK TO SAVEPOINT scenario');
    }
    await db.query(`INSERT INTO private.scheduled_jobs(job_key,owner_spec,job_type,schedule,enabled,timeout_seconds,max_attempts,configuration,retry_safe,cancel_safe,next_run_at)
      VALUES('sync-mutations.retry',6,'inert.fixture',NULL,false,60,3,'{}',true,true,NULL)`);
    for (const invalid of [null, [], ['sync-mutations.retry','sync-mutations.retry'], ['unknown.job'], [null]]) {
      await db.query('SAVEPOINT invalid_scope');
      await assert.rejects(db.query('select * from private.claim_due_jobs($1,1,$2,$3::text[])', ['inert-worker', now, invalid]), /OPERATIONS_JOB_SCOPE_INVALID/);
      await db.query('ROLLBACK TO SAVEPOINT invalid_scope');
    }
    await db.query('SAVEPOINT invalid_limit');
    await assert.rejects(db.query('select * from private.claim_due_jobs($1,NULL,$2,$3::text[])', ['inert-worker', now, ['sync-mutations.retry']]), /OPERATIONS_CLAIM_INPUT_INVALID/);
    await db.query('ROLLBACK TO SAVEPOINT invalid_limit');
    const policy = (await db.query(`SELECT p.prosecdef,p.proconfig,r.rolname owner,
      has_function_privilege('masarifi_worker',p.oid,'EXECUTE') worker,
      has_function_privilege('masarifi_api',p.oid,'EXECUTE') api,
      has_function_privilege('anon',p.oid,'EXECUTE') anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,
      has_function_privilege('service_role',p.oid,'EXECUTE') service
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='private.claim_due_jobs(text,integer,timestamptz,text[])'::regprocedure`)).rows[0];
    assert.deepEqual(policy, { prosecdef: true, proconfig: ['search_path=""'], owner: 'masarifi_migration', worker: true, api: false, anon: false, authenticated: false, service: false });
  } finally { await db.query('ROLLBACK'); await db.end(); }
});
