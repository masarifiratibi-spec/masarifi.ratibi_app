const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runExactOperation } = require('./runner.cjs');
const { syntheticManifest, sourceRoot } = require('./test-manifest.cjs');

test('entry orders read-only bootstrap BEGIN before worker checkout; export/import proof belongs to PG17 cases', async () => {
  const manifest = syntheticManifest();
  const commands = [];
  const bootstrap = { async query(sql) { commands.push(['bootstrap', sql]); throw new Error('STOP_AT_BOOTSTRAP_BEGIN'); }, async end() {} };
  const pool = { async query() { throw new Error('NO_PER_QUERY_CHECKOUT'); }, async withClient(action) { return action({ async query(sql) { commands.push(['worker', sql]); throw new Error('STOP_AT_WORKER_BEGIN'); } }); } };
  await assert.rejects(runExactOperation({ manifest, sourceRoot, mode: 'execute' }, {
    authorize: async () => {}, connectBootstrap: async () => bootstrap,
    prepare: async () => ({ normalPool: pool, imageSha256: manifest.provenance.imageSha256, executeClaim: async () => assert.fail('no claim'), close: async () => {} }),
  }), /STOP_AT_BOOTSTRAP_BEGIN/);
  assert.deepEqual(commands, [['bootstrap', 'begin isolation level repeatable read read only']]);
});
