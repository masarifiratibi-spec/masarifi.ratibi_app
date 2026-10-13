'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const VERSION = '20261013053237';
const NAME = 'voice_scope_rejection_diagnostics';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const tables = [
  'public.accounts', 'public.transactions', 'public.transaction_postings', 'public.account_balances',
  'public.voice_sessions', 'private.voice_batch_context', 'private.voice_batches',
  'private.voice_events', 'private.voice_event_commands', 'private.voice_provider_attempts',
  'private.voice_media_tombstones', 'private.staging_voice_epochs', 'private.staging_voice_members',
  'private.staging_voice_runtime_control', 'private.voice_automatic_policy', 'private.idempotency_keys',
];
const acceptanceSignature = 'private.accept_voice_batch(uuid,uuid,jsonb,text)';
const helperSignature = 'private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)';
async function metadata(client, signature) {
  const result = await client.query(`select encode(extensions.digest(prosrc,'sha256'),'hex') "bodyHash",
    pg_get_userbyid(proowner) owner,prosecdef definer,proconfig config,proacl::text acl
    from pg_proc where oid=to_regprocedure($1)`, [signature]);
  return result.rows[0] || null;
}
async function snapshot(client) {
  const protectedRows = {};
  for (const table of tables) {
    // Identifiers are this fixed internal list, never user input. Export hashes only.
    protectedRows[table] = (await client.query(`select encode(extensions.digest(
      coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text,'sha256'),'hex') hash
      from ${table} x`)).rows[0].hash;
  }
  const flags = (await client.query(`select
    (select enabled from private.voice_automatic_policy) posting,
    (select count(*)::int from private.staging_voice_epochs where state='active') "activeEpochs",
    (select count(*)::int from public.voice_sessions s join private.voice_batch_context c on c.session_id=s.id
      where c.analysis_only and s.status in ('uploaded','processing')) "analysisJobs",
    (select count(*)::int from public.assistant_messages where work_status in ('queued','processing')) "assistantJobs",
    exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='masarifi_migration'
      and m.member=(select oid from pg_roles where rolname=current_user) and m.grantor=m.member) "migrationSelfGrant"`)).rows[0];
  return { ...flags, protected: protectedRows,
    historyHash: (await client.query("select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(x) order by version),'[]'::jsonb)::text,'sha256'),'hex') hash from supabase_migrations.schema_migrations x where version<>$1", [VERSION])).rows[0].hash,
    migrations: (await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map((x) => x.version),
    acceptance: await metadata(client, acceptanceSignature), helper: await metadata(client, helperSignature) };
}
function checkBefore(current, packet) {
  assert.equal(current.posting, false, 'POSTING_OFF_REQUIRED');
  for (const key of ['activeEpochs', 'analysisJobs', 'assistantJobs']) assert.equal(current[key], 0, 'IDLE_REQUIRED');
  assert.equal(current.migrationSelfGrant, false, 'MIGRATION_MEMBERSHIP_PRESERVED');
  assert.equal(current.helper, null, 'DIAGNOSTIC_ALREADY_PRESENT');
  assert(!current.migrations.includes(VERSION), 'DIAGNOSTIC_ALREADY_APPLIED');
  assert.deepEqual(current, packet.expected, 'EXACT_DATABASE_BASELINE_REQUIRED');
}
async function checkAfter(client, before, packet) {
  const after = await snapshot(client);
  assert.deepEqual(after.protected, before.protected, 'FINANCIAL_VOICE_AND_SESSION_DATA_PRESERVED');
  assert.deepEqual(after.migrations, [...before.migrations, VERSION], 'EXACT_ONE_MIGRATION_REQUIRED');
  assert.equal(after.historyHash, before.historyHash, 'EXISTING_MIGRATION_HISTORY_PRESERVED');
  assert.deepEqual((await client.query('select name,statements from supabase_migrations.schema_migrations where version=$1',
    [VERSION])).rows, [{ name:NAME, statements:[packet.sql] }], 'EXACT_NEW_MIGRATION_HISTORY_REQUIRED');
  assert.deepEqual(after.acceptance, { ...before.acceptance, bodyHash: packet.acceptanceBodyHash }, 'ACCEPTANCE_METADATA_PRESERVED');
  assert(after.helper && after.helper.owner === 'masarifi_migration' && !after.helper.definer,
    'PRIVATE_INVOKER_HELPER_REQUIRED');
  assert.deepEqual(after.helper.config, ['search_path=""']);
  assert.equal(after.helper.bodyHash, packet.helperBodyHash, 'EXACT_DIAGNOSTIC_HELPER_REQUIRED');
  assert.equal(after.helper.acl, '{masarifi_migration=X/masarifi_migration}', 'OWNER_ONLY_HELPER_REQUIRED');
  for (const role of ['anon', 'authenticated', 'service_role', 'masarifi_api', 'masarifi_worker']) {
    assert.equal((await client.query('select has_function_privilege($1,$2,\'execute\') allowed',
      [role, helperSignature])).rows[0].allowed, false, 'HELPER_EXECUTION_MUST_REMAIN_PRIVATE');
  }
  assert.equal(after.posting, false);
  assert.equal(after.activeEpochs, 0);
  assert.equal(after.migrationSelfGrant, false);
  return after;
}
async function applyDiagnostic(client, packet) {
  assert(packet.version === VERSION && packet.name === NAME && typeof packet.sql === 'string' &&
    sha(packet.sql) === packet.sqlHash, 'EXACT_DIAGNOSTIC_MIGRATION_REQUIRED');
  const lock = await client.query('select pg_try_advisory_lock($1::bigint) locked', ['5574319470126001']);
  assert.equal(lock.rows[0]?.locked, true, 'MIGRATION_LOCK_UNAVAILABLE');
  try {
    await client.query('begin isolation level serializable');
    try {
      await client.query("set local statement_timeout='10s'");
      await client.query("set local lock_timeout='3s'");
      await client.query("set local idle_in_transaction_session_timeout='15s'");
      // Hold the same runtime row used by activation until commit/rollback.
      await client.query('select singleton from private.staging_voice_runtime_control for update');
      const before = await snapshot(client);
      checkBefore(before, packet);
      await client.query(packet.sql);
      await client.query('insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)',
        [VERSION, [packet.sql], NAME]);
      await checkAfter(client, before, packet);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    // A fresh snapshot confirms committed state. Uncertainty is never retried.
    await client.query('begin isolation level repeatable read read only');
    try { return await checkAfter(client, packet.expected, packet); }
    finally { await client.query('rollback'); }
  } finally {
    await client.query('select pg_advisory_unlock($1::bigint)', ['5574319470126001']);
  }
}
module.exports = { snapshot, checkBefore, checkAfter, applyDiagnostic, metadata, sha, VERSION, NAME };
function runCLI() {
  let raw = '';
  process.stdin.on('data', (part) => { raw += part; if (raw.length > 1048576) process.exit(2); });
  process.stdin.on('end', async () => {
    let client;
    const deadline = setTimeout(() => process.exit(2), 45000);
    try {
      const input = JSON.parse(raw);
      assert(['read', 'verify', 'apply'].includes(input.action));
      assert.equal(process.env.SUPABASE_URL, 'https://qcffvfbpzvpwcwxwjyro.supabase.co');
      const url = new URL(input.url);
      assert(url.hostname.endsWith('.supabase.com') && decodeURIComponent(url.username).endsWith('.qcffvfbpzvpwcwxwjyro'));
      if (input.action === 'apply') {
        // Session advisory locks must never run through a transaction pooler.
        const endpoint = { hostname:url.hostname, port:url.port || '5432',
          usernameHash:sha(decodeURIComponent(url.username)), database:url.pathname };
        assert.equal(endpoint.port, '5432', 'SESSION_MIGRATION_ENDPOINT_REQUIRED');
        assert.deepEqual(endpoint, input.endpoint, 'EXACT_APPROVED_MIGRATION_ENDPOINT_REQUIRED');
      }
      const { Client } = require('pg');
      client = new Client({ connectionString: input.url, connectionTimeoutMillis:5000, query_timeout:15000 });
      await client.connect();
      let result;
      if (input.action === 'apply') result = await applyDiagnostic(client, input.packet);
      else {
        await client.query('begin isolation level repeatable read read only');
        try { result = input.action === 'verify' ? await checkAfter(client, input.packet.expected, input.packet) : await snapshot(client); }
        finally { await client.query('rollback'); }
      }
      console.log(JSON.stringify(result));
    } catch { process.stderr.write('DIAGNOSTIC_DATABASE_CHECK_FAILED\n'); process.exitCode=1; }
    finally { await client?.end(); clearTimeout(deadline); }
  });
}
if (require.main === module) runCLI();
