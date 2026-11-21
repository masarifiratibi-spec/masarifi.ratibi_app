'use strict';
// A synthetic API-only login in the disposable GitHub database. Never a service login.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { appendFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve, relative, isAbsolute } = require('node:path');

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME, 'postgres');
const connection = new URL(process.env.DATABASE_URL || '');
assert.ok(['127.0.0.1', 'localhost'].includes(connection.hostname));
assert.equal(connection.port, '54322');
assert.equal(connection.pathname, '/postgres');
assert.equal(connection.username, 'postgres');
assert.ok(process.env.RUNNER_TEMP && process.env.GITHUB_ENV);
const environmentFile = resolve(process.env.GITHUB_ENV);
const location = relative(resolve(process.env.RUNNER_TEMP), environmentFile);
assert.ok(location && !location.startsWith('..') && !isAbsolute(location));

const { Client } = createRequire(resolve(__dirname, '../../apps/api/package.json'))('pg');
// Keep disposable logins outside the migration-owned masarifi_* namespace.
const role = `ci_api_${randomBytes(6).toString('hex')}`;
const password = randomBytes(32).toString('hex');
// Identifier and password contain only generated safe ASCII, never operator input.
assert.match(role, /^ci_api_[a-f0-9]{12}$/);
assert.match(password, /^[a-f0-9]{64}$/);
const restricted = new URL(connection);
restricted.username = role;
restricted.password = password;
console.info(`::add-mask::${password}`);
console.info(`::add-mask::${restricted.toString()}`);

async function prepare() {
  const client = new Client({ connectionString: connection.toString() });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`create role ${role} login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${password}'`);
    await client.query(`grant masarifi_api to ${role} with set true, inherit false`);
    await client.query('commit');
    appendFileSync(environmentFile, `TEST_AI_ROLE_DATABASE_URL=${restricted.toString()}\n`);
    console.info('Prepared disposable API-only connection for all four restricted-role integration tests.');
  } finally {
    await client.end();
  }
}
prepare().catch(error => { console.error(error.code || 'RESTRICTED_API_ROLE_SETUP_FAILED'); process.exitCode = 1; });
