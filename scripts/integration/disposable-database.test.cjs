const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const script = path.join(__dirname, 'disposable-database.cjs');
const safe = { DATABASE_URL: 'postgresql://postgres@127.0.0.1:54322/postgres', MASARIFI_LIVE_DATABASE_TESTS: '1' };

for (const [name, environment, args, code] of [
  ['remote host', { DATABASE_URL: 'postgresql://postgres@production.invalid:54322/postgres' }, ['start'], 'DISPOSABLE_DATABASE_ONLY'],
  ['unapproved local port', { DATABASE_URL: 'postgresql://postgres@127.0.0.1:55442/postgres' }, ['reset'], 'DISPOSABLE_DATABASE_ONLY'],
  ['unapproved database', { DATABASE_URL: 'postgresql://postgres@127.0.0.1:54322/customer' }, ['migrate'], 'DISPOSABLE_DATABASE_ONLY'],
  ['missing explicit opt in', { MASARIFI_LIVE_DATABASE_TESTS: '0' }, ['start'], 'DISPOSABLE_DATABASE_ONLY'],
  ['unknown operation', {}, ['delete'], 'DISPOSABLE_DATABASE_ONLY'],
  ['version supplied to reset', {}, ['reset', '20261013235719'], 'INVALID_MIGRATION_TARGET'],
  ['malformed target', {}, ['migrate', 'latest'], 'INVALID_MIGRATION_TARGET'],
  ['unregistered target', {}, ['migrate', '20000101000000'], 'MIGRATION_TARGET_NOT_REGISTERED']
]) {
  test(`refuses ${name} before opening a database connection`, () => {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: root, env: { ...process.env, ...safe, ...environment }, encoding: 'utf8', timeout: 15000
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(code), result.stderr);
  });
}
