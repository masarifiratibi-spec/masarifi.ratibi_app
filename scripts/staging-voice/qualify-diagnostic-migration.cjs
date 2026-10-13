'use strict';
// Disposable qualification only. No hosted URL, credentials or recordings are accepted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('../../apps/api/node_modules/pg');
const g = require('./diagnostic-migration.cjs');
let stage = 'entry';
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(process.env.GITHUB_ACTIONS === 'true' &&
    process.env.GITHUB_REPOSITORY === 'masarifiratibi-spec/masarifi.ratibi_app');
  assert(url.hostname === '127.0.0.1' && url.port === '54322' && url.pathname === '/postgres');
  const root = path.resolve(__dirname, '../..');
  const base = fs.readFileSync(path.join(root, 'supabase/migrations/20261010221534_staging_voice_single_expense_canary.sql'), 'utf8');
  const oldAcceptance = base.slice(base.indexOf('create or replace function private.accept_voice_batch'),
    base.indexOf('create or replace function private.execute_voice_event'));
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261013053237_voice_scope_rejection_diagnostics.sql'), 'utf8').replaceAll('\r\n','\n');
  const acceptance = sql.slice(sql.indexOf('create or replace function private.accept_voice_batch'));
  const body = acceptance.split('as $$')[1].split('end $$;')[0] + 'end ';
  const client = new Client({ connectionString: url.toString() });
  const second = new Client({ connectionString: url.toString() });
  await client.connect(); await second.connect();
  try {
    stage = 'restore-fixture-definition';
    // Only the named diagnostic DDL/history is undone on this disposable localhost fixture.
    // Financial/user/session rows are neither deleted nor reseeded here.
    await client.query('begin');
    await client.query(oldAcceptance);
    await client.query('drop function private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)');
    await client.query('delete from supabase_migrations.schema_migrations where version=$1', [g.VERSION]);
    await client.query('commit');
    const before = await g.snapshot(client);
    stage = 'rollback-qualification';
    const packet = { version: g.VERSION, name: g.NAME, sql, sqlHash:g.sha(sql),
      acceptanceBodyHash:g.sha(body), helperBodyHash:g.sha(sql.split('as $$')[1].split('end $$;')[0]+'end '), expected:before };
    // Force a post-DDL preservation failure and prove the entire migration rolls back.
    const contaminated = sql + '\nupdate private.voice_automatic_policy set enabled=true;';
    await assert.rejects(g.applyDiagnostic(client, { ...packet, sql:contaminated, sqlHash:g.sha(contaminated) }));
    assert.deepEqual(await g.snapshot(client), before);
    stage = 'concurrent-qualification';
    // The shared platform lock admits exactly one install, even under concurrency.
    const outcomes = await Promise.allSettled([g.applyDiagnostic(client, packet), g.applyDiagnostic(second, packet)]);
    for (const outcome of outcomes) if (outcome.status === 'rejected') {
      console.error(JSON.stringify({ stage, code:outcome.reason.code || null,
        assertion:outcome.reason.code === 'ERR_ASSERTION' ? outcome.reason.message.split('\n')[0] : null }));
    }
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length, 1);
    assert.equal(outcomes.filter(x=>x.status==='rejected').length, 1);
    const after = await g.snapshot(client);
    assert.deepEqual(after.protected, before.protected);
    assert.equal(after.migrations.filter(x=>x===g.VERSION).length, 1);
    assert.equal(after.posting, false);
    await assert.rejects(g.applyDiagnostic(client, packet));
    assert.deepEqual(await g.snapshot(client), after);
    console.log(JSON.stringify({ status:'PASS', fixtureOnly:true, stagingAccess:false,
      rollbackPreserved:true, concurrentInstallCount:1, repeatRejected:true,
      protectedTableCount:Object.keys(before.protected).length, financialActivation:false }));
  } finally { await client.end(); await second.end(); }
}
main().catch((error)=>{process.stderr.write(JSON.stringify({ event:'DISPOSABLE_DIAGNOSTIC_QUALIFICATION_FAILED',
  stage, code:error.code || null, assertion:error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : null })+'\n');process.exitCode=1;});
