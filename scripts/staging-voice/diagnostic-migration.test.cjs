'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { applyDiagnostic, checkAuthority, checkBefore, settledSnapshot } = require('./diagnostic-migration.cjs');
const before = { protected: { accounts: 'unchanged', voice: 'unchanged' }, posting: false,
  activeEpochs: 0, analysisJobs: 0, assistantJobs: 0, migrationSelfGrant: false,
  migrations: ['old'], acceptance: { bodyHash: 'old-body', owner: 'migration', definer: true,
    config: ['empty'], acl: ['retained'] }, helper: null };
const packet = { expected: before, version: '20261013053237', name: 'voice_scope_rejection_diagnostics',
  sql: 'fixture-only', sqlHash: require('node:crypto').createHash('sha256').update('fixture-only').digest('hex'),
  acceptanceBodyHash: 'new-body' };
test('rejects every posting/queue/schema/data/permission drift before migration work', () => {
  for (const patch of [{ posting: true }, { activeEpochs: 1 }, { analysisJobs: 1 }, { assistantJobs: 1 },
    { migrationSelfGrant: true }, { migrations: ['old', packet.version] }, { helper: {} },
    { protected: { voice: 'changed' } }, { acceptance: { ...before.acceptance, bodyHash: 'foreign' } }]) {
    assert.throws(() => checkBefore({ ...before, ...patch }, packet));
  }
  checkBefore(before, packet);
});
test('wrong SQL bytes reject before any query or advisory lock', async () => {
  const calls = [];
  await assert.rejects(applyDiagnostic({ query: (...args) => { calls.push(args); } },
    { ...packet, sql: 'unreviewed' }), /EXACT_DIAGNOSTIC_MIGRATION_REQUIRED/);
  assert.deepEqual(calls, []);
});
test('an unavailable platform migration lock prevents DDL', async () => {
  const calls = [];
  await assert.rejects(applyDiagnostic({ query: async (sql) => {
    calls.push(sql); return { rows: [{ locked: false }] };
  } }, packet), /MIGRATION_LOCK_UNAVAILABLE/);
  assert.equal(calls.length, 1);
});
test('missing expired future or out-of-scope deployment authority rejects', () => {
  const now=1791874800;
  for (const authority of [null,{}, {receivedAt:now+1,expiresAt:now+60},
    {receivedAt:now-3601,expiresAt:now+60},{receivedAt:now,expiresAt:now},
    {receivedAt:now,expiresAt:1791882001}]) assert.throws(()=>checkAuthority(authority,now));
  checkAuthority({receivedAt:now-10,expiresAt:now+60},now);
});
test('held installer lock cannot be misclassified as unchanged pre-commit state', async () => {
  const queries=[];
  await assert.rejects(settledSnapshot({query:async(sql)=>{queries.push(sql);return {rows:[{locked:false}]};}}),
    /INSTALLER_STILL_IN_FLIGHT/);
  assert.equal(queries.length,1);
});
