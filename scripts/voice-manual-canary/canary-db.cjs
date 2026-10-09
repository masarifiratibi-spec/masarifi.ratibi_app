'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const g = require('./canary-guards.cjs');
const load = createRequire('/app/dist/src/ai/ai.worker.js');
const { Pool } = load('pg');
const mode = process.argv[2];
const controlPath = process.argv[3];
const sessionId = process.argv[4];
const pool = new Pool({connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, query_timeout: 15000});
function control() {
  const bytes = fs.readFileSync(controlPath);
  assert(bytes.length <= 32768, 'CONTROL_OVERSIZE');
  const c = JSON.parse(bytes);
  g.approval(c);
  assert.equal(process.env.VOICE_CANARY_CONTROL_HASH, g.hash(bytes), 'CONTROL_FILE_NOT_PINNED');
  return c;
}
async function financial(c) {
  const transactions = (await c.query(`select to_jsonb(t) || jsonb_build_object('voice_session_id',b.session_id) row
    from public.transactions t left join private.voice_events e on e.transaction_id=t.id
    left join private.voice_batches b on b.id=e.batch_id order by t.id`)).rows.map(r => r.row);
  const postings = (await c.query('select to_jsonb(p) row from public.transaction_postings p order by id')).rows.map(r => r.row);
  return { transactions, postings };
}
async function snapshot(c, id) {
  const session = (await c.query('select to_jsonb(s) row from public.voice_sessions s where id=$1', [id])).rows[0]?.row;
  const batch = (await c.query('select to_jsonb(b) row from private.voice_batches b where session_id=$1', [id])).rows[0]?.row;
  const events = batch ? (await c.query(`select to_jsonb(e) || jsonb_build_object('command',c.command) row
    from private.voice_events e left join private.voice_event_commands c on c.event_id=e.id
    where e.batch_id=$1 order by e.ordinal`, [batch.id])).rows.map(r => r.row) : [];
  return {session, batch, events};
}
async function preflight(c) {
  const r = (await c.query(`select (select enabled from private.voice_automatic_policy where singleton) posting,
    (select count(*)::int from public.transactions) transactions,
    (select count(*)::int from public.transaction_postings) postings,
    (select count(*)::int from private.voice_events) events,
    (select count(*)::int from private.voice_event_commands) commands,
    (select count(*)::int from public.voice_sessions s where s.status in ('uploaded','processing') and s.finalized_at is not null
      and s.expires_at>clock_timestamp() and s.deleted_at is null and s.cancelled_at is null) pending_voice_work,
    (select count(*)::int from public.voice_sessions where storage_ref is not null) retained_media_refs,
    (select count(*)::int from private.voice_media_tombstones) media_tombstones,
    (select count(*)::int from supabase_migrations.schema_migrations) migrations,
    has_table_privilege(current_user,'private.voice_automatic_policy','SELECT') can_read_policy,
    has_table_privilege(current_user,'private.voice_automatic_policy','UPDATE') can_update_policy`)).rows[0];
  assert.equal(r.posting, false); assert.equal(r.transactions, 0); assert.equal(r.postings, 0);
  assert.equal(r.events, 0); assert.equal(r.commands, 0); assert.equal(r.migrations, 84);
  assert.equal(r.pending_voice_work,0,'UNRELATED_VOICE_WORK_MUST_NOT_BE_DRAINED');
  // Existing media is preserved by exact claims and temporary locks, never drained.
  assert.equal(r.can_read_policy, true, 'POLICY_READ_CAPABILITY_UNAVAILABLE');
  assert.equal(r.can_update_policy, false, 'UNEXPECTED_PERMANENT_POLICY_WRITE_GRANT');
  const refs = (await c.query('select id,user_id,currency_code,status,is_default from public.accounts where id=any($1::uuid[])', [[g.PIN.cash,g.PIN.card]])).rows;
  assert.equal(refs.length, 2);
  for (const a of refs) { assert.equal(a.user_id, g.PIN.owner); assert.equal(a.currency_code.trim(), 'SAR'); assert.equal(a.status, 'active'); }
  const cats = (await c.query('select id,kind,active from public.categories where id=any($1::uuid[]) and deleted_at is null', [[g.PIN.food,g.PIN.income]])).rows;
  assert.equal(cats.length, 2);
  for (const cat of cats) { assert.equal(cat.active, true); assert.equal(cat.kind, cat.id === g.PIN.food ? 'expense' : 'income'); }
  const balances = (await c.query('select confirmed_minor,pending_minor from public.account_balances where account_id=any($1::uuid[])', [[g.PIN.cash,g.PIN.card]])).rows;
  assert.equal(balances.length, 2);
  for (const b of balances) { assert.equal(Number(b.confirmed_minor), 0); assert.equal(Number(b.pending_minor), 0); }
  return r;
}
async function finalize(c, reader, manifest, session) {
  // Locks match the existing command/cancel owner ordering. No other session is processed.
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [g.PIN.owner]);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [g.PIN.owner + ':ledger.write']);
  // Migration login has no Worker membership. Inspect using its own READ ONLY transaction;
  // execute using a separate existing Worker login. No role grants or privileged financial DML.
  await reader.query('begin read only');
  let before, snap;
  try {
    assert.equal((await reader.query('select enabled from private.voice_automatic_policy where singleton')).rows[0].enabled, true, 'POSTING_NOT_APPROVED_ACTIVE');
    before = await financial(reader);
    snap = await snapshot(reader, session.id);
  } finally { await reader.query('rollback'); }
  const counts = g.ledger(before.transactions, before.postings, manifest);
  assert(counts.voice < 3 && before.transactions.length < 6 && before.postings.length < 7, 'NO_REMAINING_BUDGET');
  const event = g.batch(snap, session);
  assert.equal(snap.batch.status, 'finalizing');
  await c.query('set local role masarifi_worker');
  const claims = (await c.query('select * from private.claim_voice_finalization($1)', [1])).rows;
  assert.equal(claims.length, 1, 'SINGLE_FINALIZATION_CLAIM_REQUIRED');
  assert.equal(claims[0].batch_id, snap.batch.id, 'UNRELATED_FINALIZATION_ROLLED_BACK');
  const claim = claims[0]; g.uuid(claim.token);
  const ids = (await c.query('select private.list_voice_finalization_events($1::uuid,$2::uuid) result', [claim.batch_id,claim.token])).rows[0].result;
  assert.deepEqual(ids, [{eventId:event.id}], 'EVENT_ALLOWLIST_CHANGED');
  g.approval(manifest); // Deadline checked again immediately before the financial command.
  const first = (await c.query('select private.execute_voice_event($1::uuid,$2::uuid,$3::uuid) result', [claim.batch_id,claim.token,event.id])).rows[0].result;
  assert.equal(first.status, 'committed', 'SAFE_EVENT_NOT_COMMITTED');
  const replay = (await c.query('select private.execute_voice_event($1::uuid,$2::uuid,$3::uuid) result', [claim.batch_id,claim.token,event.id])).rows[0].result;
  assert.equal(replay.status, 'committed'); g.uuid(replay.transactionId);
  g.approval(manifest);
  // The existing executor commits at most this one eligible event; replay returned the same ID.
  return {batchId:claim.batch_id,eventId:event.id,transactionId:replay.transactionId,replaySameId:true,before};
}
async function verifyFinalized(c, manifest, session, result) {
  await c.query('begin read only');
  try {
  const before=result.before;
  const after = await financial(c);
  g.ledger(after.transactions, after.postings, manifest);
  assert.equal(after.transactions.length, before.transactions.length + 1, 'DUPLICATE_OR_MISSING_TRANSACTION');
  assert.equal(after.postings.length, before.postings.length + 1, 'DUPLICATE_OR_MISSING_POSTING');
  const added = after.transactions.filter(t => !before.transactions.some(p => p.id === t.id));
  assert.equal(added.length, 1); assert.equal(added[0].id, result.transactionId);
  // Existing records and postings must not be edited by execution or replay.
  for (const old of before.transactions) assert.deepEqual(after.transactions.find(t => t.id === old.id), old);
  for (const old of before.postings) assert.deepEqual(after.postings.find(t => t.id === old.id), old);
  const ended = await snapshot(c, session.id);
  assert.equal(ended.batch.status, 'completed'); assert.equal(ended.session.status, 'confirmed');
  assert.equal(ended.events.filter(e => e.status === 'committed').length, 1);
  assert(ended.events.every(e => e.command === null), 'COMMAND_RETAINED');
  const {before:unused,...receipt}=result;
  return {...receipt,transactions:after.transactions.length,postings:after.postings.length};
  } finally {await c.query('rollback');}
}
async function main() {
  g.environment(process.env, 'migration');
  const c = await pool.connect();
  try {
    if (mode === 'preflight') {
      await c.query('begin read only');
      const r = await preflight(c); await c.query('rollback'); return {stage:'preflight',...r};
    }
    if (mode === 'legacy-lock-proof') {
      // Preparation probe: lock only old v1/v2 media, never a fresh Samsung v3 capture.
      // Roll back every database change, including the temporary membership.
      const fingerprint=async()=> (await c.query(`select count(*)::int count,
        encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,'' order by s.id),''),'UTF8')),'hex') hash
        from public.voice_sessions s where storage_ref is not null and contract_version<3`)).rows[0];
      const before=await fingerprint();
      await c.query('begin');
      try {
        assert.equal((await c.query("select pg_has_role(session_user,'masarifi_migration','SET') can_set")).rows[0].can_set,false);
        await c.query('grant masarifi_migration to current_user with set true,inherit false');
        await c.query('set local role masarifi_migration');
        await c.query("set local statement_timeout='5s'");
        assert.equal((await c.query('select enabled from private.voice_automatic_policy where singleton')).rows[0].enabled,false);
        const locked=await c.query('select id from public.voice_sessions where storage_ref is not null and contract_version<3 order by id for update nowait');
        assert.equal(locked.rowCount,before.count);
        await c.query('select id from private.voice_media_tombstones order by id for update nowait');
      } finally {await c.query('rollback');}
      const after=await fingerprint();assert.deepEqual(after,before);
      assert.equal((await c.query("select pg_has_role(session_user,'masarifi_migration','SET') can_set")).rows[0].can_set,false);
      return {protectedLegacyMedia:before.count,fingerprint:before.hash,unchanged:true,temporaryRoleRolledBack:true,claims:0,financialWrites:0};
    }
    if (mode === 'policy-off') {
      // Safe cleanup is deliberately independent of an approval file, lease or expired window.
      return g.policyWithTemporaryRole(c,false);
    }
    const manifest = control();
    if (mode === 'enable') {
      await c.query('begin read only');
      try {await preflight(c);} finally {await c.query('rollback');}
      g.approval(manifest);
      return g.policyWithTemporaryRole(c,true,()=>g.approval(manifest));
    }
    if (mode === 'finalize' || mode === 'media-claim') {
      const session = g.exactSession(manifest,sessionId);
      const workerUrl = process.env.VOICE_CANARY_WORKER_DATABASE_URL;
      const workerEnv={...process.env,DATABASE_URL:workerUrl,MASARIFI_PROCESS_KIND:'worker',MASARIFI_VOICE_ANALYSIS_ONLY:'false',SUPABASE_URL:'https://'+g.PIN.project+'.supabase.co'};
      g.environment(workerEnv,'worker');
      const workerPool = new Pool({connectionString:workerUrl,max:1,connectionTimeoutMillis:5000,query_timeout:15000});
      const w=await workerPool.connect();
      try {
        await w.query('set role masarifi_worker');
        if(mode==='media-claim')return await g.claimMediaExact(c,w,session,()=>g.approval(manifest));
        const result=await g.transaction(w, db => finalize(db,c,manifest,session));
        return await verifyFinalized(c,manifest,session,result);
      } finally {w.release();await workerPool.end();}
    }
    if (mode === 'inspect') {
      await c.query('begin read only');
      const f = await financial(c); const counts = g.ledger(f.transactions,f.postings,manifest);
      const s = sessionId ? await snapshot(c,g.exactSession(manifest,sessionId).id) : null;
      await c.query('rollback');
      // Do not print transcripts, storage credentials, raw commands or provider payloads.
      return {stage:'inspect',counts,transactions:f.transactions.length,postings:f.postings.length,
        session:s && {id:s.session.id,status:s.session.status,mediaPresent:s.session.storage_ref!==null,batchId:s.batch?.id,eventStatuses:s.events.map(e=>e.status)}};
    }
    throw new Error('UNKNOWN_CONTROL_MODE');
  } finally { c.release(); }
}
main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.name==='AssertionError' ? e.message : (e.code || 'CANARY_DATABASE_FAILED'));process.exitCode=1;}).finally(()=>pool.end());
