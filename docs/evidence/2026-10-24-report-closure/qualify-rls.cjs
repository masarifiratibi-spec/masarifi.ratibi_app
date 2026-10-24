const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const baseline = process.argv.includes('--baseline');
const candidates = fs.readdirSync('supabase/migrations').filter(name => name.includes('_report_closure_')).sort();
const prefix = (baseline ? [] : candidates).map(name => fs.readFileSync(path.join('supabase/migrations',name),'utf8') + '\nreset role;').join('\n');
const output = path.resolve('docs/evidence/2026-10-24-report-closure');
const scratch = path.resolve('.superpowers/sdd/2026-10-23-admin-dashboard-recovery/native-db/report-closure-rls.sql');
const psql = 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const inherited = new Set(); // Refreshed fixtures pass; every future failure blocks qualification.
for (const database of ['admin_recovery_rls_fresh','admin_recovery_rls_upgrade']) {
  const target = spawnSync(psql,['--no-password','-h','127.0.0.1','-p','55442','-U','postgres','-d',database,'-X','-At','-c',"select current_setting('data_directory'),count(*),max(version) from supabase_migrations.schema_migrations"],{encoding:'utf8'});
  if (target.status !== 0 || !target.stdout.replaceAll('\\','/').includes('/2026-10-23-admin-dashboard-recovery/native-db/data|165|20261023195606')) throw Error('UNVERIFIED_TEST_TARGET');
  const receipts = [];
  for (const file of fs.readdirSync('supabase/tests').filter(name=>name.endsWith('.sql') && (!baseline || !/^06[567]_/.test(name))).sort()) {
    const sql = fs.readFileSync(path.join('supabase/tests',file),'utf8').replace(/^\s*begin;\s*/i,'').replace(/rollback;\s*$/i,'');
    fs.writeFileSync(scratch, 'begin;\n' + prefix + '\nset local search_path=public,extensions;\ngrant usage on schema extensions to anon,authenticated,masarifi_api,masarifi_worker;\n' + sql + '\nreset role; rollback;\n');
    const result = spawnSync(psql,['--no-password','-h','127.0.0.1','-p','55442','-U','postgres','-d',database,'-X','-At','-v','ON_ERROR_STOP=1','-f',scratch],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    const failed = result.status !== 0 || /^not ok\b/m.test(result.stdout) || /Looks like you (?:failed|planned)/.test(result.stdout);
    const receipt = {file,status:failed?'FAILED':'passed',assertions:(result.stdout.match(/^ok\b/gm)||[]).length,inheritedFailure:failed&&inherited.has(file.slice(0,3))};
    receipts.push(receipt);
    if (failed) fs.writeFileSync(path.join(output,`${database}-${baseline ? 'baseline-' : ''}${file}.log`),result.stdout+'\n'+result.stderr);
    console.log(JSON.stringify({database,...receipt}));
  }
  const unexpected = receipts.filter(item=>item.status==='FAILED'&&!item.inheritedFailure);
  fs.writeFileSync(path.join(output,`${database}-${baseline ? 'baseline-' : ''}rls.json`),JSON.stringify({database,rolledBack:true,receipts,unexpectedFailures:unexpected},null,2)+'\n');
  if (unexpected.length) process.exitCode=1;
}
