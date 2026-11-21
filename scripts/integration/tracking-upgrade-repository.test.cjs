'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadNominalTrackingRepository } = require('./tracking-upgrade-repository.cjs');

test('nominal captures reserve quota under owner idempotency and claims use the historical worker RPC', async () => {
  const statements = [];
  const sessionId = '4bf15f78-a795-4ffa-8206-4d4519541878';
  const claimToken = '096b6998-b244-4f2e-85c6-c365a2ebceca';
  const rows = {
    'claim_sync_idempotency_key': [{ outcome: 'new', lease_token: claimToken }],
    'reserve_user_job_quota': [{ result: { accepted: true } }],
    'create_import_session': [{ result: { id: sessionId } }],
    'complete_sync_idempotency_key': [],
    'claim_import_session': [{ id: sessionId, claim_token: claimToken }],
  };
  const client = { query: async (sql, values) => {
    statements.push({ sql, values });
    const rpc = sql.match(/private\.(\w+)\(/)?.[1];
    if (rpc) assert.ok(Object.hasOwn(rows, rpc), `RPC outside the historical capture/claim contract: ${rpc}`);
    return { rows: rpc ? rows[rpc] : [] };
  } };
  const Repository = loadNominalTrackingRepository();
  const repository = new Repository({ withClient: callback => callback(client) });
  const owner = 'tracking_upgrade_test';
  const command = { schemaVersion: 2, sourceType: 'sms', sourceChannel: 'android_sms', events: [{
    receivedAt: '2026-10-14T12:00:00Z', metadata: { ruleConfigurationRevision: 'legacy' },
  }] };
  const receipt = await repository.createImport({ userId: owner, sessionId: 'test' }, command,
    { sourceName: 'Synthetic upgrade fixture', key: 'unique-fixture-key', requestId: 'capture-test' });
  assert.equal(receipt.resource.id, sessionId);
  assert.deepEqual(await repository.claimImports('upgrade-fixture'), rows.claim_import_session);
  assert.deepEqual(statements.flatMap(({ sql }) => sql.match(/private\.(\w+)\(/)?.[1] ?? []),
    ['claim_sync_idempotency_key', 'reserve_user_job_quota', 'create_import_session',
      'complete_sync_idempotency_key', 'claim_import_session']);
  assert.deepEqual(statements.filter(({ sql }) => sql.startsWith('set local role')).map(s => s.sql),
    ['set local role masarifi_api', 'set local role masarifi_worker']);
  const captured = statements.find(({ sql }) => sql.includes('private.create_import_session('));
  assert.equal(captured.values[0], owner);
  assert.equal(captured.values[1], 'sms');
  assert.deepEqual(JSON.parse(captured.values[4]), command.events);
  assert.equal(captured.values[5], 2);
});
