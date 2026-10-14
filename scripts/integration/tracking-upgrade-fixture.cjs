'use strict';
// Isolated 110 -> 111 upgrade evidence; never run against a hosted database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const api = file => require(path.join(root, 'apps/api/dist/src', file));
require(path.join(root, 'apps/api/node_modules/reflect-metadata'));
const { PoolService } = api('platform/database/pool.service');
const { TrackingRepository } = api('tracking/tracking.repository');
const { normalizeNormalizedImport } = api('tracking/tracking.dto');
const { classifyFinancialMessage } = require(path.join(root, 'packages/transaction-parser'));
const databaseUrl = new URL(process.env.TRACKING_UPGRADE_DATABASE_URL || '');
assert.ok(['127.0.0.1', 'localhost'].includes(databaseUrl.hostname), 'DISPOSABLE_LOOPBACK_REQUIRED');
const namedFixture = /^\/tracking_upgrade_[a-z0-9_]+$/.test(databaseUrl.pathname);
const supabaseCiFixture = process.env.NODE_ENV === 'test' &&
  process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME === 'postgres' &&
  databaseUrl.pathname === '/postgres' && databaseUrl.port === '54322';
assert.ok(namedFixture || supabaseCiFixture, 'EXPLICIT_DISPOSABLE_DATABASE_REQUIRED');
const pool = new PoolService({ get: key => {
  if (key === 'DATABASE_URL') return databaseUrl.toString();
  if (key === 'MASARIFI_DATABASE_POOL_MAX') return 2;
  if (key === 'MASARIFI_PROCESS_KIND') return undefined;
  throw new Error('UNEXPECTED_FIXTURE_CONFIGURATION');
} });
const repository = new TrackingRepository(pool);
const hash = text => createHash('sha256').update(text).digest('hex');
const principal = owner => ({ userId: owner, sessionId: 'upgrade-fixture', factorAgeSeconds: 0 });
const evidenceFile = process.argv[3];
assert.ok(evidenceFile && ['seed', 'verify'].includes(process.argv[2]), 'FIXTURE_PHASE_REQUIRED');
async function capture(owner, command) {
  const response = await repository.createImport(principal(owner), command,
    { sourceName: 'Synthetic upgrade fixture', key: randomUUID(), requestId: randomUUID() });
  return String(response.resource.id);
}
async function seed() {
  const column = await pool.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_keyword_rules' and column_name='deleted_at') present");
  assert.equal(column.rows[0].present, false, 'PRE_NOMINAL_SCHEMA_REQUIRED');
  const owner = 'tracking_upgrade_' + randomUUID(), account = randomUUID();
  await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
  await pool.query("insert into public.accounts(id,user_id,name,type,currency_code,last_four,is_default,automatic_tracking_enabled) values($1,$2,'Synthetic legacy account','bank','SAR','4242',true,true)", [account, owner]);
  await repository.getPreferences(principal(owner));
  await pool.query('update public.tracking_preferences set enabled=true,review_required=false where user_id=$1', [owner]);
  await pool.query("insert into public.user_sender_rules(user_id,sender_pattern,display_label,trusted,enabled) values($1,'UPGRADEBANK','Synthetic source',true,true)", [owner]);
  const before = await repository.ruleSnapshot(principal(owner));
  const base = (await pool.query('select private.get_tracking_rule_snapshot_base($1) snapshot', [owner])).rows[0].snapshot;
  const command = label => {
    const text = 'Paid SAR50 using account4242', identity = hash(label), receivedAt = new Date().toISOString();
    const { providerReference, ...classification } = classifyFinancialMessage({ text, receivedAt: Date.parse(receivedAt) }, before.snapshot);
    void providerReference;
    assert.equal(classification.disposition, 'capture_candidate');
    return normalizeNormalizedImport({ schemaVersion: 2, sourceType: 'sms', sourceChannel: 'android_sms', events: [{
      sourceItemKey: identity, receivedAt, occurredAt: classification.occurredAt, sender: 'UPGRADEBANK',
      amountMinor: -classification.amountMinor, currency: classification.currency, kind: 'expense', accountId: account, classification,
      transport: { deviceId: 'upgrade-fixture-device', channel: 'android_sms', nativeIdDigest: identity, revisionDigest: hash(text) },
      providerReferenceDigest: identity, metadata: { referenceScheme: 'plain-v2', ruleConfigurationRevision: before.configurationRevision }
    }] });
  };
  const offline = command('offline_' + randomUUID());
  const queued = await capture(owner, command('queued_' + randomUUID()));
  const revision = (await pool.query('select private.tracking_configuration_revision($1) revision', [owner])).rows[0].revision;
  fs.writeFileSync(evidenceFile, JSON.stringify({ owner, account, base, before, revision, queued, offline }, null, 2) + '\n');
  console.log('Seeded pre-upgrade v2 queued and offline captures in named disposable database.');
}
async function verify() {
  const state = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  const base = (await pool.query('select private.get_tracking_rule_snapshot_base($1) snapshot', [state.owner])).rows[0].snapshot;
  assert.deepEqual(base, state.base, 'LEGACY_SNAPSHOT_CHANGED_DURING_UPGRADE');
  const after = await repository.ruleSnapshot(principal(state.owner));
  assert.equal(after.configurationRevision, state.revision, 'LEGACY_REVISION_CHANGED_DURING_UPGRADE');
  assert.deepEqual(after, { ...state.before, accountingPolicy: 'default_account_nominal_v1' });
  const offlineId = await capture(state.owner, state.offline);
  const claims = await repository.claimImports('upgrade-fixture');
  for (const id of [state.queued, offlineId]) {
    const claim = claims.find(item => item.id === id);
    assert.ok(claim, 'UPGRADE_CAPTURE_CLAIM_MISSING');
    await repository.prepareImport(id, claim.claim_token);
    const item = (await pool.query('select id,normalized_payload from public.import_items where session_id=$1', [id])).rows[0];
    assert.equal(item.normalized_payload.metadata.ruleConfigurationRevision, state.revision);
    assert.equal((await pool.query('select private.tracking_capture_exception($1) reason', [item.id])).rows[0].reason, null, 'LEGACY_CAPTURE_STRANDED');
  }
  await pool.query('update public.tracking_preferences set review_required=true where user_id=$1', [state.owner]);
  const changed = (await pool.query('select private.tracking_configuration_revision($1) revision', [state.owner])).rows[0].revision;
  assert.notEqual(changed, state.revision, 'REAL_PREFERENCE_CHANGE_MUST_CHANGE_REVISION');
  const item = (await pool.query('select id from public.import_items where session_id=$1', [state.queued])).rows[0];
  assert.equal((await pool.query('select private.tracking_capture_exception($1) reason', [item.id])).rows[0].reason, 'configuration_stale');
  console.log('PASS: legacy snapshot/revision and queued/offline v2 captures survive 110 -> 111; real preference changes remain fenced.');
}
(process.argv[2] === 'seed' ? seed() : verify()).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.onModuleDestroy());
