'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {Client}=require('../../apps/api/node_modules/pg');
const root=path.resolve(__dirname,'../..');

const groups={
  contracts:{projects:['unit','contract'],paths:[
    'test/unit/ai','test/contract/ai','test/contract/health.contract-spec.ts'],
    cases:['voiceWorker','assistantProvider']},
  database:{projects:['integration'],paths:[
    'test/integration/ai/voice-explicit-review.spec.ts','test/integration/ai/voice-analysis-only.spec.ts',
    'test/integration/ai/voice-journey-master.spec.ts','test/integration/ai/staging-voice-epoch.spec.ts',
    'test/integration/ai/assistant-native-contract.spec.ts','test/integration/ledger/mobile-receipt-contract.spec.ts'],
    cases:['voiceSessionCreate','voiceAnalysis','voiceFinancialIntent','postingPreservation','assistantDirect','manualAdd','idempotentRecovery']},
};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceInputs=['apps/api','apps/mobile/src','apps/mobile/package.json','apps/mobile/package-lock.json','packages','supabase',
  'apps/mobile/assets/fonts/NotoSansArabicUI-Regular.ttf','scripts/staging-voice','docker','.dockerignore','package.json',
  'package-lock.json','pnpm-lock.yaml','yarn.lock','.github/workflows/backend-foundation.yml'];

function assertSourceMatches(sourceSha,directory=root) {
  const git=args=>spawnSync('git',args,{cwd:directory,encoding:'utf8',timeout:30000});
  const diff=git(['diff','--quiet',sourceSha,'--',...sourceInputs]);
  assert.equal(diff.status,0,'TESTED_SOURCE_MISMATCH');
  const extra=git(['ls-files','--others','--exclude-standard','--',...sourceInputs]);
  assert.equal(extra.status,0,'TESTED_SOURCE_INSPECTION_FAILED');
  assert.equal(extra.stdout.trim(),'','UNTRACKED_BUILD_INPUT');
}

async function assertDisposableDatabase() {
  assert.equal(process.env.MASARIFI_LIVE_DATABASE_TESTS,'1','LIVE_DISPOSABLE_TESTS_REQUIRED');
  const url=new URL(process.env.DATABASE_URL??'');
  assert(['127.0.0.1','localhost'].includes(url.hostname),'LOCAL_DISPOSABLE_DATABASE_REQUIRED');
  const expected=process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME??'voice_review_20261007';
  const db=new Client({connectionString:url.toString(),connectionTimeoutMillis:5000});
  await db.connect();
  try {assert.equal((await db.query('select current_database() name')).rows[0]?.name,expected,'DISPOSABLE_DATABASE_NAME_MISMATCH');}
  finally {await db.end();}
}

function runGroup(name,group,directory) {
  const output=path.join(directory,name+'.json');
  const execution=spawnSync(process.execPath,[path.join(root,'apps/api/node_modules/jest/bin/jest.js'),
    '--selectProjects',...group.projects,'--runInBand','--json','--outputFile',output,
    '--testPathPatterns',group.paths.join('|')],{
    cwd:path.join(root,'apps/api'),encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  fs.writeFileSync(path.join(directory,name+'.log'),(execution.stdout??'')+(execution.stderr??''));
  assert.equal(execution.status,0,'CROSS_FEATURE_TESTS_FAILED:'+name);
  const report=JSON.parse(fs.readFileSync(output,'utf8'));
  assert(report.success===true&&report.numFailedTests===0&&report.numFailedTestSuites===0&&
    report.numPendingTests===0&&report.numPendingTestSuites===0&&report.numPassedTests>0,
    'CROSS_FEATURE_TESTS_INCOMPLETE:'+name);
  return {[name+'.json']:digest(fs.readFileSync(output)),[name+'.log']:digest(fs.readFileSync(path.join(directory,name+'.log')))};
}

async function main() {
  const [sourceSha,image,directoryArg]=process.argv.slice(2);
  assert.match(sourceSha,/^[a-f0-9]{40}$/);
  assert.match(image,/^ghcr\.io\/masarifiratibi-spec\/masarifi-backend@sha256:[a-f0-9]{64}$/);
  const directory=path.resolve(directoryArg);
  assert(directory.startsWith(root+path.sep),'WORKSPACE_EVIDENCE_DIRECTORY_REQUIRED');
  assert(!fs.existsSync(directory),'FRESH_EVIDENCE_DIRECTORY_REQUIRED');
  assertSourceMatches(sourceSha);
  await assertDisposableDatabase();
  fs.mkdirSync(directory);
  const validationLogs={},cases={};
  for(const project of ['api','worker','migration']) {
    const build=spawnSync(process.execPath,[path.join(root,'apps/api/node_modules/@nestjs/cli/bin/nest.js'),'build',project],
      {cwd:path.join(root,'apps/api'),encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
    fs.appendFileSync(path.join(directory,'build.log'),(build.stdout??'')+(build.stderr??''));
    assert.equal(build.status,0,'CANDIDATE_BUILD_FAILED:'+project);
  }
  validationLogs['build.log']=digest(fs.readFileSync(path.join(directory,'build.log')));
  for(const [name,group] of Object.entries(groups)) {
    Object.assign(validationLogs,runGroup(name,group,directory));
    for(const scenario of group.cases) cases[scenario]='passed';
  }
  // This gate tests provider protocol/recovery with controlled provider responses.
  // Real provider readiness and Samsung speech acceptance remain separate gates.
  assertSourceMatches(sourceSha);
  const {HealthController}=require('../../apps/api/dist/src/platform/health/health.controller');
  const declaration=new HealthController({}).compatibility();
  fs.writeFileSync(path.join(directory,'compatibility.json'),JSON.stringify({schemaVersion:1,sourceSha,image,
    observedAt:new Date().toISOString(),contracts:declaration.contracts,cases,validationLogs,
    providerValidation:'controlled-provider-boundary; live provider acceptance required separately'},null,2)+'\n');
  console.log('CROSS_FEATURE_COMPATIBILITY_TESTS_PASSED');
}
if(require.main===module)main().catch(error=>{
  console.error(error instanceof assert.AssertionError?error.message:'COMPATIBILITY_COLLECTION_FAILED');process.exitCode=1;
});
module.exports={assertSourceMatches};
