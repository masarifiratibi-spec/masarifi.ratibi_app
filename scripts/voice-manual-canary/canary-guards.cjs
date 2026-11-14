'use strict';
// Operational acceptance controls; this file is not part of the application image.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const PIN = Object.freeze({
  sha: 'cb2dd3724e498985e148b3b97af4bdc7c7260706',
  digest: 'b445235aeb60be01a3eace1ea3c94b39d64246cfbf302b19b1b9700281e1caea',
  project: 'qcffvfbpzvpwcwxwjyro',
  owner: 'user_3K8mSI8JwKzzOJ55tNuWrcx9lPy',
  cash: 'cf321db5-b5ff-4192-b94f-621505ac7801',
  card: 'f6f8b1c0-b6a8-4443-ace0-c63b7afbfc1f',
  food: '04000000-0000-4000-8000-000000000002',
  income: '04000000-0000-4000-8000-000000000017',
  kind: 'voice.transcribe_extract',
});
const hash = value => createHash('sha256').update(value).digest('hex');
const scope = Object.freeze({
  stagingSha: PIN.sha, imageDigest: PIN.digest, owner: PIN.owner,
  cashAccount: PIN.cash, cardAccount: PIN.card, foodCategory: PIN.food, incomeCategory: PIN.income,
  voice: ['en', 'ar', 'en-safe-incomplete'], voiceExpenseMinor: 2500, currency: 'SAR',
  manual: ['expense-5000-empty-fields', 'income-5000-two-line-note', 'transfer-1000-fee-zero'],
  maxTransactions: 6, maxPostings: 7, maxWindowSeconds: 600,
  preserveFixtures: true, globalWorker: false, production: false,
});
const scopeHash = hash(JSON.stringify(scope));
const uuid = value => assert.match(value, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
function approval(control, now = Date.now()) {
  assert.equal(control.stagingSha, PIN.sha, 'RELEASE_MISMATCH');
  assert.equal(control.imageDigest, PIN.digest, 'IMAGE_MISMATCH');
  assert.equal(control.project, PIN.project, 'PROJECT_MISMATCH');
  const a = control.approval;
  assert(a && a.kind === 'direct-human-financial-approval', 'DIRECT_HUMAN_APPROVAL_REQUIRED');
  assert.equal(a.scopeHash, scopeHash, 'APPROVED_SCOPE_MISMATCH');
  assert.equal(typeof a.messageReference, 'string');
  assert(a.messageReference.length >= 8 && a.messageReference.length <= 256, 'HUMAN_MESSAGE_REFERENCE_REQUIRED');
  assert.equal(typeof a.verbatimMessage, 'string');
  assert(a.verbatimMessage.length >= 8 && a.verbatimMessage.length <= 4096, 'HUMAN_MESSAGE_REQUIRED');
  const start = Date.parse(control.startedAt), end = Date.parse(control.deadline);
  assert(Number.isFinite(start) && Number.isFinite(end), 'WINDOW_REQUIRED');
  assert(start <= now && now < end && end - start <= 600000, 'WINDOW_CLOSED_OR_TOO_LONG');
  assert(Date.parse(a.receivedAt) <= start && Date.parse(a.receivedAt) > start - 86400000, 'APPROVAL_TIME_INVALID');
  assert(Array.isArray(control.sessions) && control.sessions.length <= 3, 'SESSION_BUDGET_EXCEEDED');
  assert.equal(new Set(control.sessions.map(s => s.id)).size, control.sessions.length, 'DUPLICATE_SESSION');
  assert.equal(new Set(control.sessions.map(s => s.case)).size, control.sessions.length, 'DUPLICATE_CASE');
  for (const s of control.sessions) {
    uuid(s.id);
    assert(scope.voice.includes(s.case), 'CASE_NOT_APPROVED');
    assert.equal(s.humanSamsungCapture, true, 'HUMAN_CAPTURE_REQUIRED');
    assert.equal(s.deviceSerial, 'RK8XB00N33K', 'DEVICE_MISMATCH');
    assert(typeof s.captureEvidence === 'string' && s.captureEvidence.length >= 8, 'CAPTURE_EVIDENCE_REQUIRED');
    assert(Date.parse(s.recordedAt) >= start && Date.parse(s.recordedAt) <= now, 'CAPTURE_OUTSIDE_WINDOW');
    assert.match(s.contentHash, /^[0-9a-f]{64}$/);
    assert.equal(s.timezoneOffsetMinutes, -180, 'TIMEZONE_MISMATCH');
  }
  return control;
}
function exactSession(control, id) {
  approval(control);
  uuid(id);
  const s = control.sessions.find(s => s.id === id);
  assert(s, 'SESSION_NOT_ALLOWLISTED');
  return s;
}
function environment(env, kind) {
  assert.equal(env.MASARIFI_PROCESS_KIND, kind, 'PROCESS_KIND_MISMATCH');
  assert.equal(env.MASARIFI_RELEASE_VERSION, PIN.sha, 'RUNTIME_RELEASE_MISMATCH');
  const db = new URL(env.DATABASE_URL);
  assert(db.hostname.endsWith('.supabase.com'), 'STAGING_DATABASE_REQUIRED');
  assert(decodeURIComponent(db.username).endsWith('.' + PIN.project), 'STAGING_DATABASE_REQUIRED');
  if (kind === 'worker') {
    assert.equal(new URL(env.SUPABASE_URL).origin, 'https://' + PIN.project + '.supabase.co');
    assert.equal(env.MASARIFI_VOICE_ANALYSIS_ONLY, 'false', 'FINANCIAL_WORKER_MODE_REQUIRED');
  }
}
async function transaction(client, body) {
  await client.query('begin');
  try {
    await client.query("set local statement_timeout='15s'");
    const result = await body(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}
async function claimExact(client, session) {
  return transaction(client, async c => {
    await c.query('set local role masarifi_worker');
    const rows = (await c.query('select * from private.claim_ai_work($1,$2,$3,$4)',
      [PIN.kind, 'manual-release-bounded', 1, 300])).rows;
    assert.equal(rows.length, 1, 'SINGLE_CLAIM_REQUIRED');
    const r = rows[0];
    assert.equal(r.kind, PIN.kind, 'CLAIM_KIND_MISMATCH');
    assert.equal(r.id, session.id, 'UNRELATED_CLAIM_ROLLED_BACK');
    assert.equal(r.user_id, PIN.owner, 'CLAIM_OWNER_MISMATCH');
    assert.equal(r.attempt_count, 1, 'PREVIOUSLY_CLAIMED');
    uuid(r.claim_token);
    // Verify provenance through the standard capability before retaining the claim.
    const input = (await c.query('select private.get_ai_work_input($1,$2::uuid,$3::uuid) result',
      [PIN.kind, r.id, r.claim_token])).rows[0].result;
    assert.equal(input.contractVersion, 3, 'CONTRACT_MISMATCH');
    assert.equal(input.contentHash, session.contentHash, 'MEDIA_HASH_MISMATCH');
    assert.equal(Date.parse(input.recordedAt), Date.parse(session.recordedAt), 'CAPTURE_TIME_MISMATCH');
    assert.equal(input.timezoneOffsetMinutes, -180, 'CAPTURE_TIMEZONE_MISMATCH');
    assert.equal(input.locale, session.case === 'ar' ? 'ar' : 'en', 'CAPTURE_LOCALE_MISMATCH');
    return r;
  });
}
async function policyWithTemporaryRole(client, enabled, validateApproval) {
  assert.equal(typeof enabled,'boolean');
  if(enabled)assert.equal(typeof validateApproval,'function','ENABLE_APPROVAL_VALIDATOR_REQUIRED');
  return transaction(client, async c => {
    const membership=()=>c.query("select pg_has_role(session_user,'masarifi_migration','SET') can_set");
    assert.equal((await membership()).rows[0].can_set,false,'UNEXPECTED_EXISTING_MIGRATION_MEMBERSHIP');
    // Exact grant/revoke pattern used by the immutable migrator and prior disable-only control.
    // No membership survives success, failure, cancellation or transaction rollback.
    await c.query('grant masarifi_migration to current_user with set true,inherit false');
    await c.query('set local role masarifi_migration');
    if(enabled)validateApproval();
    const r=await c.query('update private.voice_automatic_policy set enabled=$1 where singleton returning enabled',[enabled]);
    assert.equal(r.rowCount,1,'SINGLE_POLICY_ROW_REQUIRED');assert.equal(r.rows[0].enabled,enabled);
    await c.query('reset role');
    await c.query('revoke masarifi_migration from current_user granted by current_user');
    assert.equal((await membership()).rows[0].can_set,false,'TEMPORARY_MEMBERSHIP_NOT_RESTORED');
    if(enabled)validateApproval();
    return {posting:enabled,temporaryMembershipRestored:true};
  });
}
async function claimMediaExact(reader, worker, session, validateApproval) {
  // Legacy media must remain unchanged. Lock other candidates so the existing SKIP LOCKED
  // capability can select only this approved session, then still validate before Worker COMMIT.
  return transaction(reader, async r => {
    const membership=()=>r.query("select pg_has_role(session_user,'masarifi_migration','SET') can_set");
    assert.equal((await membership()).rows[0].can_set,false);
    await r.query('grant masarifi_migration to current_user with set true,inherit false');
    await r.query('set local role masarifi_migration');
    await r.query('select id from public.voice_sessions where storage_ref is not null and id<>$1::uuid order by id for update',[session.id]);
    await r.query('select id from private.voice_media_tombstones where id<>$1::uuid order by id for update',[session.id]);
    const s=(await r.query('select id,user_id,content_hash,storage_ref from public.voice_sessions where id=$1::uuid',[session.id])).rows[0];
    assert(s);assert.equal(s.user_id,PIN.owner);assert.equal(s.content_hash,session.contentHash);
    assert.match(s.storage_ref,new RegExp('^voice/'+session.id+'/[0-9a-f-]{36}$'));
    const claim=await transaction(worker,async w=>{
      await w.query('set local role masarifi_worker');
      const rows=(await w.query('select * from private.claim_voice_media_purge($1,$2,$3)',['manual-release-media',1,300])).rows;
      assert.equal(rows.length,1,'SINGLE_MEDIA_CLAIM_REQUIRED');
      assert.equal(rows[0].id,session.id,'UNRELATED_MEDIA_CLAIM_ROLLED_BACK');
      assert.equal(rows[0].storage_ref,s.storage_ref,'MEDIA_REFERENCE_CHANGED');uuid(rows[0].purge_token);
      validateApproval();return rows[0];
    });
    await r.query('reset role');await r.query('revoke masarifi_migration from current_user granted by current_user');
    assert.equal((await membership()).rows[0].can_set,false,'TEMPORARY_MEMBERSHIP_NOT_RESTORED');
    return claim;
  });
}
function command(c, eventId, session) {
  assert(c && typeof c === 'object', 'COMMAND_REQUIRED');
  assert.equal(c.kind, 'expense'); assert.equal(c.source, 'voice');
  assert.equal(c.amountMinor, 2500); assert.equal(c.currency, 'SAR');
  assert.equal(c.accountId, PIN.cash); assert.equal(c.categoryId, PIN.food);
  assert.equal(c.externalRef, 'voice-event:' + eventId);
  assert.equal(c.note, null); assert.equal(c.paymentMethod, null);
  assert(typeof c.title === 'string' && c.title.trim().length > 0 && c.title.length <= 40);
  assert(c.merchant === null || typeof c.merchant === 'string');
  const capturedDate = new Date(Date.parse(session.recordedAt) + 180 * 60000).toISOString().slice(0, 10);
  const eventDate = new Date(Date.parse(c.occurredAt) + 180 * 60000).toISOString().slice(0, 10);
  assert.equal(eventDate, capturedDate, 'OCCURRENCE_OUTSIDE_CAPTURE_DATE');
}
function batch(snapshot, session) {
  assert(snapshot.session, 'SESSION_MISSING');
  assert.equal(snapshot.session.id, session.id);
  assert.equal(snapshot.session.user_id, PIN.owner);
  assert.equal(snapshot.session.contract_version, 3);
  assert.equal(snapshot.session.content_hash, session.contentHash);
  assert.equal(Date.parse(snapshot.session.capture_at), Date.parse(session.recordedAt), 'SESSION_CAPTURE_TIME_MISMATCH');
  assert.equal(snapshot.session.capture_timezone_offset, -180);
  assert.equal(snapshot.session.locale, session.case === 'ar' ? 'ar' : 'en');
  assert.equal(snapshot.session.deleted_at, null);
  assert.equal(snapshot.session.cancelled_at, null);
  const b = snapshot.batch;
  assert(b, 'NO_ACCEPTED_BATCH');
  uuid(b.id); assert.equal(b.session_id, session.id); assert.equal(b.user_id, PIN.owner);
  assert.equal(b.policy_version, 'automatic-or-skip-v3.1');
  const events = snapshot.events;
  assert(Array.isArray(events) && events.length >= 1 && events.length <= (session.case === 'en-safe-incomplete' ? 2 : 1), 'EVENT_BUDGET_EXCEEDED');
  const eligible = events.filter(e => e.status === 'eligible');
  assert.equal(eligible.length, 1, 'EXACT_ONE_ELIGIBLE_EVENT_REQUIRED');
  for (const e of events) {
    uuid(e.id); assert.equal(e.batch_id, b.id); assert.equal(e.user_id, PIN.owner);
    assert.equal(e.transaction_id, null, 'ALREADY_COMMITTED');
    if (e.status === 'eligible') command(e.command, e.id, session);
    else {
      assert.equal(session.case, 'en-safe-incomplete', 'UNEXPECTED_SKIPPED_EVENT');
      assert.equal(e.status, 'skipped'); assert.equal(e.command, null);
      assert(['missing_amount', 'ambiguous_account', 'invalid_event', 'unsupported_event'].includes(e.reason_code), 'UNEXPECTED_SKIP_REASON');
    }
  }
  return eligible[0];
}
// Whole-ledger comparison is possible because this Staging baseline has zero financial records.
// Unknown owners, accounts, shapes, excess rows, or repeated cases abort acceptance.
function ledger(rows, postings, control) {
  approval(control);
  assert(rows.length <= 6 && postings.length <= 7, 'FINANCIAL_RECORD_BUDGET_EXCEEDED');
  const counts = { voice: 0, expense: 0, income: 0, transfer: 0 };
  const ids = new Set();
  const voiceSessions = new Set();
  for (const t of rows) {
    uuid(t.id); assert(!ids.has(t.id), 'DUPLICATE_TRANSACTION'); ids.add(t.id);
    assert.equal(t.user_id, PIN.owner); assert.equal(t.status, 'confirmed');
    assert.equal(t.currency_code.trim(), 'SAR'); assert.equal(Number(t.fee_minor), 0);
    assert.equal(t.deleted_at, null); assert.equal(t.reverses_transaction_id, null);
    assert(Date.parse(t.created_at) >= Date.parse(control.startedAt), 'PREEXISTING_FINANCIAL_RECORD');
    const ps = postings.filter(p => p.transaction_id === t.id);
    const expected = [];
    if (t.source === 'voice') {
      counts.voice++;
      assert(control.sessions.some(s => s.id === t.voice_session_id), 'UNRELATED_VOICE_TRANSACTION');
      assert(!voiceSessions.has(t.voice_session_id), 'DUPLICATE_VOICE_SESSION');
      voiceSessions.add(t.voice_session_id);
      assert.equal(t.kind, 'expense'); assert.equal(Number(t.amount_minor), 2500); assert.equal(t.category_id, PIN.food);
      assert.match(t.external_ref, /^voice-event:[0-9a-f-]{36}$/);
      assert.equal(t.note, null); expected.push([PIN.cash, -2500, 'source']);
    } else {
      assert.equal(t.source, 'manual'); counts[t.kind]++;
      assert(['expense', 'income', 'transfer'].includes(t.kind), 'UNAPPROVED_MANUAL_KIND');
      assert.equal(t.external_ref, null);
      if (t.kind === 'transfer') {
        assert.equal(Number(t.amount_minor), 1000); assert.equal(t.category_id, null);
        assert.equal(t.note, 'QA line1\nQA line2');
        expected.push([PIN.cash, -1000, 'source'], [PIN.card, 1000, 'destination']);
      } else {
        assert.equal(Number(t.amount_minor), 5000);
        assert.equal(t.category_id, t.kind === 'income' ? PIN.income : PIN.food);
        assert.equal(t.note, t.kind === 'income' ? 'QA line1\nQA line2' : null);
        expected.push([PIN.cash, t.kind === 'income' ? 5000 : -5000, t.kind === 'income' ? 'destination' : 'source']);
      }
    }
    assert.equal(ps.length, expected.length, 'POSTING_COUNT_MISMATCH');
    assert.deepEqual(ps.map(p => [p.account_id, Number(p.amount_minor), p.posting_role]).sort(), expected.sort(), 'POSTING_EFFECT_MISMATCH');
    for (const p of ps) assert.equal(p.clearing_state, 'confirmed');
  }
  assert.equal(postings.filter(p => ids.has(p.transaction_id)).length, postings.length, 'UNRELATED_POSTING');
  assert(counts.voice <= control.sessions.length && counts.voice <= 3, 'VOICE_BUDGET_EXCEEDED');
  assert(counts.expense <= 1 && counts.income <= 1 && counts.transfer <= 1, 'MANUAL_CASE_REPEATED');
  return counts;
}
module.exports = { PIN, scope, scopeHash, hash, approval, environment, exactSession, transaction, claimExact, claimMediaExact, policyWithTemporaryRole, batch, ledger, uuid };
