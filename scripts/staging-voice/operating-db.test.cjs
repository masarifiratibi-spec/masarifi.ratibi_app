"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const sourcePath=path.join(__dirname,'operating-db.cjs');
const versions=fs.readdirSync(path.join(__dirname,'../../supabase/migrations')).filter(x=>/^\d{14}_.*\.sql$/.test(x)).map(x=>x.slice(0,14)).sort();
const epochId='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64);
const manifest={version:1,mode:'operating',newCapturesOnly:true,normalEligibility:true,retentionPolicy:'existing-operating',sourceSha:'b'.repeat(40),imageDigest:'c'.repeat(64),apkHash:'d'.repeat(64),controlHash:'e'.repeat(64)};
const acceptance={bodyHash:'683de0fd60086962c86b256983b5feadd00f4c300166a82bfc782250de29ebec',owner:'masarifi_migration',definer:true,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}'};
const diagnostic={bodyHash:'ce00e1b5da381a8baa4ac95f3e6882bb73dbccf107ff8007577e9c5410c1696b',owner:'masarifi_migration',definer:false,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration}'};
const closure={bodyHash:'2f95bb0c1bb3e809bc74e15b2216ae127a1933237885e0e033ed32b354b1392d',owner:'masarifi_migration',definer:true,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}'};
async function exercise(action='status',change={}) {
 const queries=[],output=[],errors=[];let now=1800000000000,failures=change.failures||0,attempts=0,poolCount=0;
 const baseline={posting:false,activeEpochs:0,analysisJobs:0,migrations:versions,fingerprints:Object.fromEntries(['accounts','transactions','postings','balances'].map(k=>[k,'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'])),historical:{voicePending:0,assistantPending:0,outboxUnpublished:8}};
 if(change.control?.requiredMigrations)baseline.migrations=change.control.requiredMigrations;
 const control={project:'qcffvfbpzvpwcwxwjyro',manifest,requiredMigrations:versions,baseline,epochId:action==='prepare'||action==='reconcile'?null:epochId,manifestHash:action==='prepare'||action==='reconcile'?null:hash,approvalReceivedAt:now/1000,activationExpiresAt:now/1000+100,startsAt:now/1000,...change.control};
 const epoch={id:epochId,manifest_hash:hash,state:'prepared',mode:'operating',matches:true,source:manifest.sourceSha,image:manifest.imageDigest,expiresAt:null,heartbeatAt:now/1000,...change.epoch};
 class Clock extends Date {static now(){return now;}}
 class Pool {
  constructor(){this.id=poolCount++;this.writes=false;}
  async connect(){return this;} release(){} async end(){}
  async query(sql,args=[]) {
   queries.push({sql,args,pool:this.id});
   if(change.backlogTimeout&&sql.includes('outboxUnpublished'))throw Object.assign(Error('SECRET'),{code:'57014'});
   if(sql==='begin isolation level serializable'){attempts++;this.writes=true;}
   if(sql==='rollback'&&change.rollbackUncertain)throw Object.assign(Error('SECRET'),{code:'ECONNRESET'});
   if(sql==='commit'&&this.writes&&change.commitFailure)throw Object.assign(Error('SECRET'),{code:change.commitFailure});
   if(change.expireCleanup&&sql.startsWith(change.expireCleanup))now+=101000;
   if(sql.includes('from private.staging_voice_epochs where id=')&&sql.endsWith('for update')&&failures-->0){now+=change.advanceFailure||0;throw Object.assign(Error('SECRET'),{code:change.failureCode||'40001'});}
   if(sql.includes('for update')&&change.expireLock&&sql.includes(change.expireLock))now+=101000;
   if(sql.includes('pg_auth_members'))return {rows:[{present:!!change.preexistingGrant}]};
   if(sql.includes('pg_proc'))return {rows:[{...(args[0].includes('close_staging')?closure:args[0].includes('accept_voice_batch')?acceptance:diagnostic),...(args[0].includes('close_staging')?change.closureMetadata:change.metadata||{})}]};
   if(sql.startsWith('select to_jsonb(t) row'))return {rows:this.id%2===1&&change.freshFinancialDrift?[{row:{changed:true}}]:[]};
   if(sql.includes('outboxUnpublished'))return {rows:[{posting:false,activeEpochs:0,analysisJobs:0,migrations:change.history||versions,historical:{voicePending:0,assistantPending:0,outboxUnpublished:8},...(change.snapshot||{})}]};
   if(sql.includes('jsonb_agg(version order by version)'))return {rows:[{posting:change.snapshot?.posting??false,migrations:change.history||versions}]};
   if(sql.startsWith('select id,manifest_hash,state from'))return {rows:change.reconciled===undefined?[]:change.reconciled};
   if(sql.includes('currentEpochMatches'))return {rows:[{epochId,state:'closed',posting:false,currentEpochMatches:true}]};
   if(sql.includes('from private.staging_voice_runtime_control'))return {rows:[{current_epoch:change.foreignCurrent?'22222222-2222-4222-8222-222222222222':action==='prepare'?null:epochId,enforced:change.enforced!==false}]};
   if(sql.includes('from private.staging_voice_epochs where id='))return {rows:[epoch]};
   if(sql.startsWith('select private.prepare_staging_voice_epoch'))return {rows:[{result:{epochId,manifestHash:hash,state:'prepared'}}]};
   if(sql.startsWith('select private.activate_staging_voice_epoch')) {
    const clockAllowed=now/1000>=control.approvalReceivedAt&&now/1000<=control.approvalReceivedAt+3600&&now/1000<control.activationExpiresAt&&now/1000<control.startsAt+90;
    return {rows:clockAllowed?[{result:{epochId,expiresAt:null}}]:[]};
   }
   if(sql.startsWith('select clock_timestamp()'))return {rows:[{allowed:change.databaseAuthority!==false}]};
   if(sql.includes('currentEpochMatches'))return {rows:[{epochId,state:'closed',posting:false,currentEpochMatches:true}]};
   if(sql.includes('"members"')){
    assert(sql.includes("v.status in ('skipped','cancelled')"),'observable rejection must use actual terminal schema statuses');
    assert(sql.includes("v.status='execution_failed'"),'critical execution failures require a distinct scoped count');
    return {rows:[{members:0,committed:0,rejected:0,executionFailed:0}]};
   }
   return {rows:[{singleton:true}]};
  }
 }
 const processStub={env:{MASARIFI_PROCESS_KIND:'migration',DATABASE_URL:'postgresql://reader.qcffvfbpzvpwcwxwjyro:SECRET@inert.supabase.com:5432/postgres',OPERATING_ACTION:action,OPERATING_CONTROL:JSON.stringify(control),...change.env}};
 const moduleStub={};
 const source=fs.existsSync(sourcePath)?fs.readFileSync(sourcePath,'utf8'):'';
 Function('require','process','console','Date','module',source)(name=>name==='node:module'?{createRequire:()=>()=>({Pool})}:require(name),processStub,{log:x=>output.push(JSON.parse(x)),error:x=>errors.push(JSON.parse(x))},Clock,moduleStub);
 await moduleStub.exports;
 return {queries,output,errors,exitCode:processStub.exitCode,attempts,baseline};
}
function success(r){assert.equal(r.exitCode,undefined);assert.equal(r.errors.length,0);assert.equal(r.output.length,1);return r.output[0];}
function refused(r){assert.equal(r.exitCode,1);assert.equal(r.output.length,0);assert.equal(r.errors.length,1);assert(!JSON.stringify(r.errors).includes('SECRET'));}
test('status returns the OFF fingerprint/count baseline using read-only SQL and no role mutations',async()=>{
 const r=await exercise();const status=success(r);for(const [key,value]of Object.entries(r.baseline))assert.deepEqual(status[key],value);
 assert.equal(status.currentEpoch,epochId);assert.equal(status.epoch.matches,true);assert.equal(status.epoch.expiresAt,null);assert.equal(typeof status.epoch.heartbeatAt,'number');
 assert.deepEqual([status.members,status.committed,status.rejected,status.executionFailed],[0,0,0,0]);
 assert(r.queries.some(q=>q.sql==='begin isolation level repeatable read read only'));assert(!r.queries.some(q=>/^(grant|revoke|set local role)/i.test(q.sql)));
});
test('recurring monitor does not read unrelated backlog or financial baseline tables',async()=>{
 const r=await exercise('monitor',{backlogTimeout:true,epoch:{state:'active'},snapshot:{posting:true}}),v=success(r);
 assert.equal(v.posting,true);assert.equal(v.enforced,true);assert.equal(v.currentEpoch,epochId);
 assert.equal(v.epoch.state,'active');assert.equal(v.epoch.matches,true);assert.equal(v.epoch.expiresAt,null);
 assert.deepEqual(v.migrations,versions);assert.deepEqual([v.members,v.committed,v.rejected,v.executionFailed],[0,0,0,0]);
 assert(!r.queries.some(q=>/outbox_events|assistant_messages|select to_jsonb\(t\) row/.test(q.sql)));
 assert(r.queries.some(q=>q.sql==='begin isolation level repeatable read read only'));
 assert(!r.queries.some(q=>/^(grant|revoke|set local role|lock table)/i.test(q.sql)));
 assert.equal(r.queries.filter(q=>q.sql.includes('pg_proc')).length,2);
 assert.equal(v.historical,undefined);assert.equal(v.fingerprints,undefined);
 // Admission still refuses an unavailable full baseline; monitoring alone omits it.
 refused(await exercise('status',{backlogTimeout:true}));
 refused(await exercise('activate',{backlogTimeout:true}));
});
test('recurring monitor preserves migration/provenance and enforcement checks',async()=>{
 for(const change of [{history:versions.slice(1)},{metadata:{bodyHash:'drift'}},{metadata:{owner:'drift'}},{metadata:{acl:'drift'}}])refused(await exercise('monitor',change));
 assert.equal(success(await exercise('monitor',{enforced:false})).enforced,false);
 assert.notEqual(success(await exercise('monitor',{foreignCurrent:true})).currentEpoch,epochId);
});
test('legacy monitoring remains valid and an unqualified extra schema is refused',async()=>{
 const legacy=versions.filter(version=>!['20261013235719','20261014135709'].includes(version));
 const old=await exercise('monitor',{control:{requiredMigrations:legacy},history:legacy});
 assert.deepEqual(success(old).migrations,legacy);
 for(const requiredMigrations of [[...legacy,'20261013235720'],[...versions,'20261013235720']]){
  const refusedScope=await exercise('monitor',{control:{requiredMigrations},history:requiredMigrations});
  refused(refusedScope);assert.equal(refusedScope.queries.length,0);
 }
});
test('content Tracking migration requires an explicit exact compatible monitor scope',async()=>{
 const current=versions,prior=versions.filter(version=>version!=='20261014135709');
 assert.deepEqual(success(await exercise('monitor',{control:{requiredMigrations:current},history:current})).migrations,current);
 refused(await exercise('monitor',{control:{requiredMigrations:prior},history:current}));
 refused(await exercise('monitor',{control:{requiredMigrations:[...current,'20261014135710']},history:[...current,'20261014135710']}));
});
test('reconcile reports a unique exact manifest without preparing or granting',async()=>{
 const r=await exercise('reconcile',{reconciled:[{id:epochId,manifest_hash:hash,state:'prepared'}]});assert.deepEqual(success(r),{epochId,manifestHash:hash,state:'prepared',matches:true});
 assert(!r.queries.some(q=>/^(grant|revoke|set local role)|prepare_staging_voice_epoch/.test(q.sql)));
 assert.equal(success(await exercise('reconcile',{reconciled:[]})),null);
 refused(await exercise('reconcile',{reconciled:[{id:epochId},{id:epochId}]}));
});
test('a manifest already prepared refuses a second prepare',async()=>{const r=await exercise('prepare',{reconciled:[{id:epochId,manifest_hash:hash,state:'prepared'}]});refused(r);assert(!r.queries.some(q=>q.sql.startsWith('select private.prepare_staging_voice_epoch')));});
test('prepare is serializable, exact baseline bound and never retried',async()=>{
 assert.deepEqual(success(await exercise('prepare')),{epochId,manifestHash:hash,state:'prepared'});
 const drift=await exercise('prepare',{snapshot:{historical:{voicePending:0,assistantPending:1,outboxUnpublished:8}}});refused(drift);
 const failed=await exercise('prepare',{commitFailure:'40001'});refused(failed);assert.equal(failed.attempts,1);
});
test('pre-existing self-grants survive refusal without any grant or revoke',async()=>{for(const action of ['prepare','activate','close']){const r=await exercise(action,{preexistingGrant:true});refused(r);assert(!r.queries.some(q=>/^(grant|revoke|set local role)/i.test(q.sql)));}});
test('missing, extra or reordered migration history refuses the controller',async()=>{for(const history of [versions.slice(1),[...versions,'20990101000000'],[...versions].reverse()])refused(await exercise('activate',{history}));});
test('each diagnostic body/owner/security/search-path/ACL drift refuses activation',async()=>{for(const metadata of [{bodyHash:'bad'},{owner:'bad'},{definer:false},{config:[]},{acl:'bad'}])refused(await exercise('activate',{metadata}));});
test('activation refuses authority expiring on each blocking row lock',async()=>{
 for(const expireLock of ['private.staging_voice_runtime_control','private.staging_voice_epochs','private.voice_automatic_policy']){
  const r=await exercise('activate',{expireLock});refused(r);
  const call=r.queries.find(q=>q.sql.startsWith('select private.activate_staging_voice_epoch'));if(call)assert(call.sql.includes('clock_timestamp()'));
 }
});
test('activation repeats all checks after acknowledged serialization rollback, at most three attempts',async()=>{
 const recovered=await exercise('activate',{failures:1});assert.equal(success(recovered).expiresAt,null);assert.equal(recovered.attempts,2);
 assert.equal(recovered.queries.filter(q=>q.sql.includes('outboxUnpublished')).length,3);
 const exhausted=await exercise('activate',{failures:3});refused(exhausted);assert.equal(exhausted.attempts,3);
});
test('activation never retries uncertain rollback, transport failure or unknown commit',async()=>{
 for(const change of [{failures:1,rollbackUncertain:true},{failures:1,failureCode:'ECONNRESET'},{commitFailure:'40001'},{commitFailure:'ECONNRESET'}]){const r=await exercise('activate',change);refused(r);assert.equal(r.attempts,1);}
});
test('activation retry budget and original authority remain bounded',async()=>{for(const change of [{failures:1,advanceFailure:10001},{failures:1,advanceFailure:91000}]){const r=await exercise('activate',change);refused(r);assert.equal(r.attempts,1);}const expired=await exercise('activate',{control:{approvalReceivedAt:1799996300}});refused(expired);assert.equal(expired.attempts,0);});
test('activation refuses mismatched hash, manifest, source, mode and foreign current epoch',async()=>{for(const change of [{epoch:{manifest_hash:'0'.repeat(64)}},{epoch:{matches:false}},{epoch:{source:'0'.repeat(40)}},{epoch:{mode:'canary'}},{foreignCurrent:true}])refused(await exercise('activate',change));});
test('close ignores expired activation authority but refuses foreign epoch ownership',async()=>{
 const r=await exercise('close',{control:{approvalReceivedAt:1,activationExpiresAt:2,startsAt:1}});assert.deepEqual(success(r),{epochId,state:'closed',posting:false,currentEpochMatches:true});
 const foreign=await exercise('close',{foreignCurrent:true});refused(foreign);assert(!foreign.queries.some(q=>q.sql.includes('close_staging_voice_epoch')));
 refused(await exercise('close',{epoch:{image:'0'.repeat(64)}}));
});
test('invalid controls fail before creating a database transport and errors expose no payload',async()=>{
 for(const change of [{env:{MASARIFI_PROCESS_KIND:'worker'}},{control:{project:'foreign'}},{control:{manifest:{...manifest,normalEligibility:false}}},{control:{requiredMigrations:versions.slice(1)}}]){
  const r=await exercise('prepare',change);refused(r);assert.equal(r.queries.length,0);
 }
});
test('owned closure stays available after readiness history or diagnostic drift without financial reads',async()=>{
 for(const change of [{history:versions.slice(1)},{metadata:{bodyHash:'drift'}},{snapshot:{posting:true,activeEpochs:1}}]){
  const r=await exercise('close',change);assert.equal(success(r).posting,false);
  assert(!r.queries.some(q=>q.sql.includes('supabase_migrations')||q.sql.startsWith('select to_jsonb(t) row')));
 }
});
test('owned closure refuses any closure capability provenance drift',async()=>{
 for(const closureMetadata of [{bodyHash:'drift'},{owner:'foreign'},{definer:false},{config:[]},{acl:'foreign'}]){
  const r=await exercise('close',{closureMetadata});refused(r);assert(!r.queries.some(q=>q.sql.startsWith('select private.close_staging_voice_epoch')));
 }
});
test('prepare and activate never commit after authority expires while resetting or revoking roles',async()=>{
 for(const action of ['prepare','activate'])for(const expireCleanup of ['reset role','revoke masarifi_migration']){
  const r=await exercise(action,{expireCleanup});refused(r);assert(!r.queries.some(q=>q.pool===0&&q.sql==='commit'));assert(r.queries.some(q=>q.pool===0&&q.sql==='rollback'));
 }
});
test('prepare and activate use a final database clock fence after all role cleanup',async()=>{
 for(const action of ['prepare','activate']){
  const r=await exercise(action,{databaseAuthority:false});refused(r);assert(!r.queries.some(q=>q.pool===0&&q.sql==='commit'));
  const roleCleanup=r.queries.findIndex(q=>q.sql.startsWith('revoke masarifi_migration'));
  const databaseFence=r.queries.findIndex(q=>q.sql.startsWith('select clock_timestamp()'));
  assert(roleCleanup>=0&&databaseFence>roleCleanup);
 }
});
test('prepare and activate freeze financial tables under their guarded role and read a fresh independent baseline',async()=>{
 for(const action of ['prepare','activate']){
  const r=await exercise(action);success(r);
  const locks=r.queries.findIndex(q=>q.sql==='lock table public.accounts,public.transactions,public.transaction_postings,public.account_balances in share mode');
  const grant=r.queries.findIndex(q=>q.sql.startsWith('grant'));
  const freshRead=r.queries.findIndex(q=>q.pool===1&&q.sql==='begin isolation level repeatable read read only');
  const capability=r.queries.findIndex(q=>q.sql.startsWith('select private.'+action+'_staging_voice_epoch'));
  assert(grant>=0&&grant<locks&&locks<freshRead&&freshRead<capability);
  assert(!r.queries.some(q=>q.pool===1&&/^(grant|revoke|set local role|lock table)/.test(q.sql)));
  assert(r.queries.slice(0,locks).some(q=>q.sql==="set local statement_timeout='10s'"));
  assert(r.queries.slice(0,locks).some(q=>q.sql==="set local lock_timeout='5s'"));
 }
 for(const action of ['status','reconcile','close'])assert(!(await exercise(action)).queries.some(q=>q.sql.startsWith('lock table')));
});
test('fresh financial drift while the serializable snapshot is stale refuses prepare or activation',async()=>{
 for(const action of ['prepare','activate']){
  const r=await exercise(action,{freshFinancialDrift:true});refused(r);
  assert(!r.queries.some(q=>q.sql.startsWith('select private.'+action+'_staging_voice_epoch')));
  assert(r.queries.some(q=>q.pool===0&&q.sql==='rollback'));
 }
});
test('prepare holds a manifest-scoped transaction lock through commit and reconcile waits before its read-only snapshot',async()=>{
 const prepared=await exercise('prepare');success(prepared);
 const prepareLock=prepared.queries.find(q=>q.sql.startsWith('select pg_advisory_xact_lock'));
 assert(prepareLock&&prepareLock.sql.includes("'masarifi.operating.prepare:'")&&prepareLock.sql.includes('($2::jsonb)::text'));
 assert.deepEqual(prepareLock.args,['qcffvfbpzvpwcwxwjyro',JSON.stringify(manifest)]);
 assert(prepared.queries.indexOf(prepareLock)<prepared.queries.findIndex(q=>q.sql.startsWith('grant')));
 const reconciled=await exercise('reconcile');assert.equal(success(reconciled),null);
 const lock=reconciled.queries.findIndex(q=>q.sql.startsWith('select pg_advisory_lock'));
 const begin=reconciled.queries.findIndex(q=>q.sql==='begin isolation level repeatable read read only');
 assert(lock>=0&&lock<begin);
 assert.deepEqual(reconciled.queries[lock].args,prepareLock.args);
 assert(reconciled.queries.slice(0,lock).some(q=>q.sql==="set statement_timeout='10s'"));
 assert(reconciled.queries.slice(0,lock).some(q=>q.sql==="set lock_timeout='5s'"));
 assert(!reconciled.queries.some(q=>/^(grant|revoke|set local role|insert|update|delete)/.test(q.sql)));
});
test('status exposes enforcement drift, activation refuses it and owned OFF remains available',async()=>{
 assert.equal(success(await exercise('status',{enforced:false})).enforced,false);
 refused(await exercise('activate',{enforced:false}));
 assert.equal(success(await exercise('close',{enforced:false})).posting,false);
 const foreign=await exercise('close',{enforced:false,foreignCurrent:true});refused(foreign);assert(!foreign.queries.some(q=>q.sql.startsWith('select private.close_staging_voice_epoch')));
});
test('disposable qualifier bounds every fixture connection and barrier and emits progress on stderr only',async()=>{
 const fixturePath=path.join(__dirname,'qualify-operating-db.cjs'),configs=[],receipts=[];
 class FakeClient{constructor(config){this.options=config;configs.push(config);}async end(){}}
 class FakePool extends FakeClient{}
 const stub="module.exports=(async()=>{const {Pool}=require('node:module').createRequire()('pg');const p=new Pool();await p.end();console.log('{}');})();";
 const fixture=fs.readFileSync(fixturePath,'utf8').split('const overallBudget=')[0];
 const loaded=Function('require','process','console','__dirname',fixture+';return {db,fixtureClient,helper,passed,boundedBarrier};')(
  name=>name==='../../apps/api/node_modules/pg'?{Client:FakeClient,Pool:FakePool}:name==='node:fs'?{...fs,readFileSync:()=>stub}:require(name),
  {env:{DATABASE_URL:'postgresql://postgres:INERT@localhost:54322/postgres',GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'masarifiratibi-spec/masarifi.ratibi_app',GITHUB_REF:'refs/heads/codex/voice-promoted-operating-2026-10-13'}},
  {error:line=>receipts.push(JSON.parse(line)),log:()=>assert.fail('fixture progress leaked to stdout')},__dirname);
 loaded.fixtureClient();await loaded.helper('status',{});loaded.passed('bounded fixture regression');
 assert.equal(configs.length,4);
 for(const config of configs){assert.equal(config.connectionTimeoutMillis,5000);assert.equal(config.query_timeout,10000);assert.equal(config.statement_timeout,10000);assert.equal(config.lock_timeout,5000);assert.equal(config.idle_in_transaction_session_timeout,15000);}
 assert.equal(receipts[0].status,'OPERATING_SQL_CASE_PASS');assert.equal(receipts[0].completedCases,1);
 await assert.rejects(loaded.boundedBarrier(new Promise(()=>{}),10),error=>error.code==='FIXTURE_BARRIER_TIMEOUT');
});
