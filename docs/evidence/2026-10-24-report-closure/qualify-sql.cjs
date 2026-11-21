// Reuses the two previously qualified disposable databases. Everything rolls back.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { Client } = createRequire(path.resolve('apps/api/package.json'))('pg');
const directory = path.resolve('docs/evidence/2026-10-24-report-closure');
const candidates = fs.readdirSync('supabase/migrations').filter(name => name.includes('_report_closure_')).sort();

(async () => {
  for (const database of ['admin_recovery_final_fresh', 'admin_recovery_final_upgrade']) {
    const db = new Client({ host: '127.0.0.1', port: 55442, user: 'postgres', database });
    await db.connect();
    const receipt = { database, host: '127.0.0.1', port: 55442, sourceFiles: [], assertions: 0, failures: [], rolledBack: false };
    try {
      const target = await db.query('show data_directory');
      if (!target.rows[0].data_directory.replaceAll('\\', '/').endsWith('/2026-10-23-admin-dashboard-recovery/native-db/data')) throw Error('WRONG_CLUSTER');
      const history = (await db.query('select count(*)::int count,max(version) latest from supabase_migrations.schema_migrations')).rows[0];
      if (history.count !== 165 || history.latest !== '20261023195606') throw Error('UNEXPECTED_BASELINE');
      await db.query('begin');
      for (const name of candidates) {
        const sql = fs.readFileSync(path.join('supabase/migrations', name), 'utf8').replaceAll('\r\n', '\n');
        receipt.sourceFiles.push({ name, sha256: crypto.createHash('sha256').update(sql).digest('hex') });
        await db.query(sql);
        await db.query('reset role');
      }
      await db.query('set local search_path=public,extensions');
      const results=[];
      for (const file of ['065_report_closure_sync_fee.test.sql','066_report_closure_upload_cleanup.test.sql','067_report_closure_tracking_worker_context.test.sql']) {
        const sql=fs.readFileSync('supabase/tests/'+file,'utf8').replace(/^\s*begin;\s*/i,'').replace(/rollback;\s*$/i,'');
        await db.query('savepoint closure_suite');
        const suite=await db.query(sql);
        results.push(...suite);
        await db.query('rollback to savepoint closure_suite');
      }
      const lines = results.flatMap(result => result.rows).flatMap(row => Object.values(row))
        .filter(value => typeof value === 'string' && /^(?:ok |not ok |#|\d+\.\.)/.test(value));
      receipt.assertions = lines.filter(line => /^ok /.test(line)).length;
      receipt.failures = lines.filter(line => /^(?:not ok |# Looks like)/.test(line));
      fs.writeFileSync(path.join(directory, `${database}-closure.tap`), lines.join('\n') + '\n');
      if (receipt.assertions < 50 || receipt.failures.length) throw Error('SQL_ASSERTIONS_FAILED');
    } catch (error) {
      receipt.error = { message: error.message, code: error.code };
      process.exitCode = 1;
    } finally {
      await db.query('rollback');
      receipt.rolledBack = true;
      await db.end();
      fs.writeFileSync(path.join(directory, `${database}-closure.json`), JSON.stringify(receipt, null, 2) + '\n');
      console.log(JSON.stringify(receipt));
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
