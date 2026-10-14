"use strict";
// Real SQL qualification only in explicitly isolated loopback databases.
const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash,randomUUID}=require('node:crypto');
const local=process.env.DATABASE_URL,u=new URL(local);
assert(['127.0.0.1','localhost'].includes(u.hostname));
if(process.env.GITHUB_ACTIONS==='true'){
 assert(u.port==='54322'&&u.pathname==='/postgres');
 assert.equal(process.env.GITHUB_REPOSITORY,'masarifiratibi-spec/masarifi.ratibi_app');
 assert.equal(process.env.GITHUB_REF,'refs/heads/codex/voice-promoted-operating-2026-10-13');
}else{
 const fixtureName=process.env.VOICE_OPERATING_DISPOSABLE_DATABASE_NAME;
 assert.match(fixtureName??'',/^voice_operating_fixture_[a-z0-9_]+$/);
 assert.equal(u.pathname,'/'+fixtureName);
}
const {Client,Pool}=require('../../apps/api/node_modules/pg');
const fixtureOptions={connectionString:local,connectionTimeoutMillis:5000,query_timeout:10000,statement_timeout:10000,lock_timeout:5000,idle_in_transaction_session_timeout:15000};
const fixtureClients=new Set(),fixturePools=new Set(),barrierReleases=new Set();
function fixtureClient(){const client=new Client({...fixtureOptions}),end=client.end.bind(client);fixtureClients.add(client);client.end=async()=>{try{return await end();}finally{fixtureClients.delete(client);}};return client;}
const source=fs.readFileSync(__dirname+'/operating-db.cjs','utf8'),db=fixtureClient(),witness=fixtureClient();
const project='qcffvfbpzvpwcwxwjyro',ownerId='operating-local-'+randomUUID(),accountId=randomUUID(),categoryId='04000000-0000-4000-8000-000000000006';
const digest=value=>createHash('sha256').update(value).digest('hex');
const caseNames=[];
function passed(name){caseNames.push(name);console.error(JSON.stringify({status:'OPERATING_SQL_CASE_PASS',completedCases:caseNames.length,case:name}));}
async function boundedBarrier(barrier,timeout=5000){let timer;try{return await Promise.race([barrier,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('disposable fixture barrier deadline'),{code:'FIXTURE_BARRIER_TIMEOUT'})),timeout);})]);}finally{clearTimeout(timer);}}
function fixtureBarrier(){let resolve;const barrier=new Promise(done=>{resolve=done;});const release=()=>{barrierReleases.delete(release);resolve();};barrierReleases.add(release);return {barrier,release};}
async function closeFixtures(){for(const release of [...barrierReleases])release();await Promise.allSettled([...fixtureClients].map(client=>client.end()));await Promise.allSettled([...fixturePools].map(pool=>pool.end()));}
async function waitUntil(check,timeout=2000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('disposable contention barrier not reached');}
async function helper(action,c,observer={}) {
 const output=[],errors=[];const proc={env:{MASARIFI_PROCESS_KIND:'migration',DATABASE_URL:'postgresql://postgres.'+project+':INERT@inert.supabase.com/postgres',OPERATING_ACTION:action,OPERATING_CONTROL:JSON.stringify(c)}};
 class LocalPool extends Pool {
  constructor(){super({...fixtureOptions,max:1});fixturePools.add(this);}
  async end(){try{return await super.end();}finally{fixturePools.delete(this);}}
  async connect(){
   const conn=await super.connect(),query=conn.query.bind(conn);let writes=false;
   conn.query=async(sql,args)=>{
    if(sql==='begin isolation level serializable'){writes=true;observer.pid=conn.processID;observer.attempts=(observer.attempts||0)+1;}
    if(sql==='begin isolation level repeatable read read only')observer.readSnapshotStarted=true;
    if(sql.startsWith('select pg_advisory_lock'))observer.settlementPid=conn.processID;
    if(/^(grant|revoke|set local role)/.test(sql))observer.roleMutations=(observer.roleMutations||0)+1;
    if(writes&&sql.startsWith('select private.activate_staging_voice_epoch'))observer.activations=(observer.activations||0)+1;
    if(observer.race&&sql.includes('from private.staging_voice_epochs where id=')&&sql.endsWith('for update')&&(observer.races||0)<observer.race){
     observer.races=(observer.races||0)+1;
     const heartbeat=fixtureClient();await heartbeat.connect();
     try{await heartbeat.query('set role masarifi_worker');await heartbeat.query('select private.staging_voice_heartbeat($1,$2,$3)',[c.epochId,'local-qualification-heartbeat',c.manifest.sourceSha]);}finally{await heartbeat.end();}
    }
    try{
     if(writes&&sql==='commit'&&observer.commitBarrier){observer.commitReached=true;await boundedBarrier(observer.commitBarrier);}
     if(writes&&sql==='commit'&&observer.failBeforeCommit)throw Object.assign(Error('disposable precommit transport loss'),{code:'ECONNRESET'});
     if(writes&&sql==='rollback'&&observer.rollbackBarrier){observer.rollbackReached=true;await boundedBarrier(observer.rollbackBarrier);}
     const result=await query(sql,args);
     if(writes&&sql.startsWith('lock table '))observer.financialHeld=true;
     if(!writes&&observer.financialBarrier&&observer.financialHeld&&sql.startsWith('select to_jsonb(t) row from public.account_balances')){observer.financialReached=true;await boundedBarrier(observer.financialBarrier);}
     if(writes&&observer.cleanupBarrier&&sql.startsWith('revoke masarifi_migration')){observer.cleanupReached=true;await boundedBarrier(observer.cleanupBarrier);}
     // A transport response can be lost after PostgreSQL has acknowledged/committed.
     // SQL is always executed; these faults test only whether the controller replays it.
     if((writes&&sql==='rollback'&&observer.uncertainRollback)||(writes&&sql==='commit'&&observer.lostCommit))throw Object.assign(Error('disposable transport response lost'),{code:'ECONNRESET'});
     return result;
    }catch(error){(observer.databaseErrors||=[]).push(error.code);throw error;}
   };
   return conn;
  }
 }
 const moduleStub={};
 Function('require','process','console','module',source)(name=>name==='node:module'?{createRequire:()=>()=>({Pool:LocalPool})}:require(name),proc,{log:x=>output.push(JSON.parse(x)),error:x=>errors.push(JSON.parse(x))},moduleStub);
 await moduleStub.exports;
 return {ok:!proc.exitCode,result:output.length?output[0]:null,errors,observer};
}
async function success(action,c){const r=await helper(action,c);assert(r.ok,action+':'+JSON.stringify(r.errors));return r.result;}
async function freshControl(){
 const original=fixtureClient();await original.connect();let requiredMigrations;
 try{await original.query('begin isolation level repeatable read read only');requiredMigrations=(await original.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>r.version);await original.query('commit');}finally{await original.end();}
 assert((requiredMigrations.length===111&&requiredMigrations.at(-1)==='20261013235719')||(requiredMigrations.length===112&&requiredMigrations.at(-2)==='20261013235719'&&requiredMigrations.at(-1)==='20261014135709'));assert(requiredMigrations.includes('20261013053237'));
 const now=Date.now()/1000;
 const c={project,manifest:{version:1,mode:'operating',newCapturesOnly:true,normalEligibility:true,retentionPolicy:'existing-operating',sourceSha:'b'.repeat(40),imageDigest:'c'.repeat(64),apkHash:'d'.repeat(64),controlHash:digest(randomUUID()),scopeDigest:digest(randomUUID())},requiredMigrations,
  baseline:{posting:false,activeEpochs:0,analysisJobs:0,migrations:requiredMigrations,fingerprints:{accounts:'0'.repeat(64),transactions:'0'.repeat(64),postings:'0'.repeat(64),balances:'0'.repeat(64)},historical:{voicePending:0,assistantPending:0,outboxUnpublished:0}},epochId:null,manifestHash:null,approvalReceivedAt:now,activationExpiresAt:now+3600,startsAt:now};
 const current=await success('status',c);
 c.baseline=Object.fromEntries(['posting','activeEpochs','analysisJobs','migrations','fingerprints','historical'].map(k=>[k,current[k]]));return c;
}
async function prepared(){const c=await freshControl(),p=await success('prepare',c);return {...c,epochId:p.epochId,manifestHash:p.manifestHash};}
async function capture(c,recordedAt){
 await db.query('begin');try{
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'authenticated',sub:ownerId,sid:'local-operating-session'})]);await db.query('set local role masarifi_api');
  const result=(await db.query('select private.create_voice_session_v3($1,$2::jsonb,$3::uuid,300,0,300,$4::jsonb) result',[ownerId,JSON.stringify({locale:'ar',durationMs:3000,contentType:'audio/m4a',sizeBytes:100,contentHash:digest(randomUUID()),recordedAt,timezoneOffsetMinutes:-180}),randomUUID(),'{}'])).rows[0].result;
  await db.query('commit');return result.id;
 }catch(error){await db.query('rollback');throw error;}
}
async function accept(c,session,decisions){
 await db.query("update public.voice_sessions set status='uploaded',uploaded_at=clock_timestamp(),finalized_at=clock_timestamp() where id=$1",[session]);
 const work=(await db.query("select * from private.claim_staging_voice_work($1,'local-fixture',1,120)",[c.epochId])).rows[0];assert(work&&work.id===session);
 return (await db.query('select private.accept_voice_batch($1,$2,$3::jsonb,$4) result',[session,work.claim_token,JSON.stringify(decisions),'automatic-or-skip-v3.1'])).rows[0].result;
}
async function commitExpense(c,amountMinor,execute=true){
 const session=await capture(c,new Date().toISOString());
 const command={kind:'expense',amountMinor,currency:'SAR',accountId,categoryId,title:'Disposable operating expense',merchant:null,paymentMethod:null,note:null,occurredAt:new Date().toISOString(),source:'voice',externalRef:null};
 await accept(c,session,[{status:'eligible',command}]);
 const claim=(await db.query('select * from private.claim_staging_voice_finalization($1,1)',[c.epochId])).rows[0];assert(claim);
 const event=(await db.query('select id from private.voice_events where batch_id=$1',[claim.batch_id])).rows[0];assert(event);
 if(execute)await db.query('select private.execute_voice_event($1,$2,$3)',[claim.batch_id,claim.token,event.id]);
 return {claim,event};
}
async function financial(){
 return (await db.query(`select (select count(*)::int from public.transactions) transactions,
 (select count(*)::int from public.transaction_postings) postings,confirmed_minor,pending_minor,ledger_version
 from public.account_balances where account_id=$1`,[accountId])).rows[0];
}
async function manualWriter(){
 const writer=fixtureClient();await writer.connect();await writer.query('begin');
 await writer.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'authenticated',sub:ownerId,sid:'disposable-manual-session'})]);await writer.query('set local role masarifi_api');
 return writer;
}
async function manualExpense(writer,amountMinor=1){
 return (await writer.query('select private.post_transaction($1,$2::jsonb) result',[ownerId,JSON.stringify({kind:'expense',amountMinor,currency:'SAR',accountId,categoryId,title:'Disposable concurrent manual expense',merchant:null,paymentMethod:null,note:null,occurredAt:new Date().toISOString(),source:'manual',externalRef:randomUUID()})])).rows[0].result;
}
async function cleanupExpiry(action){
 const c=action==='activate'?await prepared():await freshControl();
 const {barrier,release}=fixtureBarrier(),observer={cleanupBarrier:barrier};
 const expired=Date.now()/1000+2,pending=helper(action,{...c,activationExpiresAt:expired},observer);
 try{
  await waitUntil(()=>observer.cleanupReached,1500);
  // The capability has executed inside the real transaction, but is not visible yet.
  assert.equal((await db.query('select enabled from private.voice_automatic_policy')).rows[0].enabled,false);
  while(Date.now()/1000<=expired+.1)await new Promise(resolve=>setTimeout(resolve,20));
 }catch(error){release();await pending;throw error;}finally{release();}
 assert.equal((await pending).ok,false);assert.equal(observer.attempts,1);
 if(action==='activate'){assert.equal((await success('status',c)).epoch.state,'prepared');await success('close',c);}
 else assert.equal(await success('reconcile',c),null);
 passed(action+' expires after actual role cleanup while COMMIT response transport is gated; capability rolls back');
}
async function financialRaces(){
 // A writer already holding RowExclusive commits while main waits for SHARE.
 // The fresh reader must see its intended effect even though main's snapshot is older.
 let c=await prepared(),before=await financial(),writer=await manualWriter(),observer={},pending,effect;
 try{
  // The existing API capability performs the real uncommitted INSERT and holds
  // RowExclusive itself; API has no raw LOCK TABLE privilege and needs none.
  effect=await manualExpense(writer);pending=helper('activate',c,observer);
  await waitUntil(async()=>observer.pid&&(await witness.query('select pg_blocking_pids($1) pids',[observer.pid])).rows[0].pids.includes(writer.processID));
  await writer.query('commit');
 }catch(error){await writer.query('rollback');if(pending)await pending;throw error;}finally{await writer.end();}
 assert.equal((await pending).ok,false);assert.equal(observer.activations||0,0);
 let status=await success('status',c);assert.equal(status.posting,false);assert.equal(status.epoch.state,'prepared');
 let after=await financial();assert.equal(BigInt(after.confirmed_minor),BigInt(before.confirmed_minor)-1n);assert.equal(after.transactions,before.transactions+1);assert.equal(after.postings,before.postings+1);
 assert.equal((await db.query('select count(*)::int n from public.transactions where id=$1',[effect.transactionId])).rows[0].n,1);
 const original=fixtureClient();await original.connect();try{assert.equal((await original.query("select exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='masarifi_migration' and m.member=(select oid from pg_roles where rolname=current_user) and m.grantor=m.member) present")).rows[0].present,false);}finally{await original.end();}
 await success('close',c);passed('preceding disjoint manual writer commits during SHARE wait; fresh reader refuses ON, preserves writer effect and rolls back own grant');
 // A subsequent disjoint writer is demonstrably blocked until controller commits.
 c=await prepared();before=await financial();const {barrier,release}=fixtureBarrier();
 observer={financialBarrier:barrier};const activating=helper('activate',c,observer);
 writer=await manualWriter();let writing;
 try{
  await waitUntil(()=>observer.financialReached);
  const locks=(await witness.query("select count(*)::int n from pg_locks where pid=$1 and mode='ShareLock' and granted and relation=any(array['public.accounts'::regclass,'public.transactions'::regclass,'public.transaction_postings'::regclass,'public.account_balances'::regclass])",[observer.pid])).rows[0].n;assert.equal(locks,4);
  writing=manualExpense(writer);
  await waitUntil(async()=>{const blockers=(await witness.query('select pg_blocking_pids($1) pids',[writer.processID])).rows[0].pids;return blockers.includes(observer.pid);});
  assert.deepEqual(await financial(),before);release();assert.equal((await activating).ok,true);
  await writing;await writer.query('commit');
 }catch(error){release();await writer.query('rollback');await activating;if(writing)await writing.catch(()=>{});throw error;}finally{await writer.end();}
 after=await financial();assert.equal(BigInt(after.confirmed_minor),BigInt(before.confirmed_minor)-1n);assert.equal(after.transactions,before.transactions+1);assert.equal(after.postings,before.postings+1);await success('close',c);
 passed('all four SHARE locks held through capability and COMMIT block a later disjoint manual ledger writer');
}
async function seedLegacy(){
 const operationId=randomUUID(),input={locale:'ar',durationMs:3000,contentType:'audio/m4a',sizeBytes:100,contentHash:digest(randomUUID()),recordedAt:new Date(Date.now()-600000).toISOString(),timezoneOffsetMinutes:-180};
 await db.query('begin');let session;
 try{
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'authenticated',sub:ownerId,sid:'disposable-retained-session'})]);await db.query('set local role masarifi_api');
  session=(await db.query('select private.create_voice_session_v2($1,$2::jsonb,$3::uuid,300) result',[ownerId,JSON.stringify(input),operationId])).rows[0].result.id;await db.query('commit');
 }catch(error){await db.query('rollback');throw error;}
 await db.query('insert into private.voice_batch_context(session_id,user_id,default_account_id,auth_expires_at,thresholds,analysis_only) values($1,$2,$3,clock_timestamp()+interval \'1 hour\',\'{}\'::jsonb,false)',[session,ownerId,accountId]);
 await db.query("update public.voice_sessions set contract_version=3,status='uploaded',uploaded_at=clock_timestamp(),finalized_at=clock_timestamp() where id=$1",[session]);
 return {session,operationId,input};
}
async function legacyHash(legacy){
 const row=(await db.query(`select jsonb_build_object('session',to_jsonb(s),'context',(select to_jsonb(c) from private.voice_batch_context c where c.session_id=s.id),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]'::jsonb) from private.voice_batches b where b.session_id=s.id),
  'events',(select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) from private.voice_events v join private.voice_batches b on b.id=v.batch_id where b.session_id=s.id),
  'members',(select count(*)::int from private.staging_voice_members where session_id=s.id)) snapshot from public.voice_sessions s where s.id=$1`,[legacy.session])).rows[0].snapshot;
 assert.equal(row.members,0);assert.equal(row.session.operation_id,legacy.operationId);assert.equal(row.session.status,'uploaded');assert.deepEqual(row.receipts,[]);assert.deepEqual(row.events,[]);return digest(JSON.stringify(row));
}
async function driftClosure(){
 let c=await prepared();await success('activate',c);
 const registry=fixtureClient();await registry.connect();
 try{
  const last=c.requiredMigrations.at(-1),saved=(await registry.query('select * from supabase_migrations.schema_migrations where version=$1',[last])).rows[0];
  await registry.query('delete from supabase_migrations.schema_migrations where version=$1',[last]);
  try{assert.equal((await success('close',c)).posting,false);}finally{await registry.query('insert into supabase_migrations.schema_migrations select * from jsonb_populate_record(null::supabase_migrations.schema_migrations,$1::jsonb)',[JSON.stringify(saved)]);}
 }finally{await registry.end();}
 passed('owned active epoch closes OFF despite actual migration registry drift');
 c=await prepared();await success('activate',c);
 await db.query('grant execute on function private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz) to masarifi_worker');
 try{assert.equal((await success('close',c)).posting,false);}finally{await db.query('revoke execute on function private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz) from masarifi_worker');}
 passed('owned active epoch closes OFF despite activation diagnostic readiness drift');
 c=await prepared();await success('activate',c);
 await db.query('alter function private.close_staging_voice_epoch(uuid,text) security invoker');
 try{assert.equal((await helper('close',c)).ok,false);assert.equal((await db.query('select enabled from private.voice_automatic_policy')).rows[0].enabled,true);}finally{await db.query('alter function private.close_staging_voice_epoch(uuid,text) security definer');}
 await success('close',c);passed('closure capability provenance drift refuses before executing altered capability; exact restored closure goes OFF');
}
async function settledPreparation(){
 for(const outcome of ['commit','rollback']){
  const c=await freshControl(),{barrier,release}=fixtureBarrier();
  const observer=outcome==='commit'?{commitBarrier:barrier,lostCommit:true}:{rollbackBarrier:barrier,failBeforeCommit:true};
  const pendingPrepare=helper('prepare',c,observer);let pendingReader,reader={};
  try{
   await waitUntil(()=>outcome==='commit'?observer.commitReached:observer.rollbackReached);
   // Reordered object keys are the same exact JSONB manifest and therefore the same lock.
   pendingReader=helper('reconcile',{...c,manifest:Object.fromEntries(Object.entries(c.manifest).reverse())},reader);
   let delivered=false;pendingReader.then(()=>{delivered=true;});
   await waitUntil(async()=>reader.settlementPid&&(await witness.query('select pg_blocking_pids($1) pids',[reader.settlementPid])).rows[0].pids.includes(observer.pid));
   assert.equal(delivered,false);assert.equal(reader.readSnapshotStarted,undefined);
   // Distinct manifests do not inherit this wait or access its uncommitted prepared row.
   assert.equal(await success('reconcile',{...c,manifest:{...c.manifest,controlHash:digest(randomUUID())}}),null);
  }catch(error){release();await Promise.allSettled([pendingPrepare,pendingReader].filter(Boolean));throw error;}finally{release();}
  const preparedResult=await pendingPrepare,readResult=await pendingReader;
  assert.equal(preparedResult.ok,false);assert.equal(observer.attempts,1);assert.equal(readResult.ok,true);assert.equal(reader.roleMutations||0,0);assert.equal(reader.readSnapshotStarted,true);
  assert.equal((await witness.query("select count(*)::int n from pg_locks where pid=$1 and locktype='advisory'",[reader.settlementPid])).rows[0].n,0);
  if(outcome==='commit'){
   assert(readResult.result&&readResult.result.matches&&readResult.result.state==='prepared');
   assert.equal((await db.query('select count(*)::int n from private.staging_voice_epochs where manifest=$1::jsonb',[JSON.stringify(c.manifest)])).rows[0].n,1);
   await success('close',{...c,epochId:readResult.result.epochId,manifestHash:readResult.result.manifestHash});
  }else{
   assert.equal(readResult.result,null);assert.equal((await db.query('select count(*)::int n from private.staging_voice_epochs where manifest=$1::jsonb',[JSON.stringify(c.manifest)])).rows[0].n,0);
  }
  passed('exact-key reconciliation waits for actual preparation '+outcome+' before its fresh read-only snapshot; no repeated prepare or retained session lock');
 }
}
async function enforcementDrift(){
 let c=await prepared();await db.query('update private.staging_voice_runtime_control set enforced=false where current_epoch=$1',[c.epochId]);
 assert.equal((await success('status',c)).enforced,false);assert.equal((await helper('activate',c)).ok,false);await success('close',c);
 passed('prepared enforcement drift is visible and refuses activation while owned OFF remains available');
 c=await prepared();await success('activate',c);await db.query('update private.staging_voice_runtime_control set enforced=false where current_epoch=$1',[c.epochId]);
 const status=await success('status',c);assert.equal(status.enforced,false);assert.equal(status.posting,true);assert.equal(status.epoch.state,'active');
 assert.equal((await success('close',c)).posting,false);assert.equal((await db.query('select enabled from private.voice_automatic_policy')).rows[0].enabled,false);
 passed('active enforcement drift remains observable and exact owned closure disables posting without requiring enforced=true');
}
async function lockExpiry(relation){
 const c=await prepared(),observer={};await db.query('begin');await db.query('select 1 from '+relation+' for update');
 const expires=Date.now()/1000+2,pending=helper('activate',{...c,activationExpiresAt:expires},observer);
 let blocked=false;
 try{
  while(Date.now()/1000<expires){
   if(observer.pid){blocked=(await witness.query('select pg_blocking_pids($1) pids',[observer.pid])).rows[0].pids.includes(db.processID);if(blocked)break;}
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert(blocked,'activation must actually block on '+relation);
  while(Date.now()/1000<=expires+.1)await new Promise(resolve=>setTimeout(resolve,20));await db.query('commit');
 }catch(error){await db.query('rollback');await pending;throw error;}
 assert.equal((await pending).ok,false);const status=await success('status',c);assert.equal(status.posting,false);assert.equal(status.epoch.state,'prepared');await success('close',c);
 passed('authority expires while '+relation+' lock is held');
}
async function main(){
 await witness.connect();await witness.query('set default_transaction_read_only=on');
 await db.connect();try{
  await db.query('grant masarifi_migration,masarifi_api,masarifi_worker to current_user with set true,inherit false');await db.query('set role masarifi_migration');
  // Hosted migration login already has read access. These grants are disposable fixture setup only.
  await db.query('grant usage on schema public,private to postgres');await db.query('grant select on all tables in schema public,private to postgres');
  await db.query("insert into public.profiles(id,status) values($1,'active')",[ownerId]);
  await db.query("insert into public.accounts(id,user_id,name,type,currency_code,is_default) values($1,$2,'Disposable','cash','SAR',true)",[accountId,ownerId]);await db.query('insert into public.account_balances(account_id) values($1)',[accountId]);
  const setup=fixtureClient();await setup.connect();try{await setup.query('revoke masarifi_migration from current_user granted by current_user');}finally{await setup.end();}
  const legacy=await seedLegacy(),legacyBefore=await legacyHash(legacy);
  let c=await freshControl();assert.deepEqual((await success('status',c)).migrations,c.requiredMigrations);passed('full actual '+c.requiredMigrations.length+'-version history and exact diagnostic metadata');
  // Lost prepare response is reconciled read-only. Another prepare must never create another epoch.
  const lost={lostCommit:true},lostResult=await helper('prepare',c,lost);assert.equal(lostResult.ok,false);assert.equal(lost.attempts,1);
  const reconciled=await success('reconcile',c);assert(reconciled&&reconciled.matches);c={...c,epochId:reconciled.epochId,manifestHash:reconciled.manifestHash};
  assert.equal((await helper('prepare',{...c,epochId:null,manifestHash:null})).ok,false);
  assert.equal((await db.query('select count(*)::int n from private.staging_voice_epochs where manifest=$1::jsonb',[JSON.stringify(c.manifest)])).rows[0].n,1);await success('close',c);passed('lost prepare response reconciles once without repeated prepare');
  assert.equal(await success('reconcile',{...c,manifest:{...c.manifest,scopeDigest:digest(randomUUID())},epochId:null,manifestHash:null}),null);passed('foreign exact manifest reconciliation returns null');
  c=await prepared();await db.query('insert into private.staging_voice_epochs(manifest,manifest_hash,mode) values($1::jsonb,$2,\'operating\')',[JSON.stringify(c.manifest),c.manifestHash]);
  assert.equal((await helper('reconcile',{...c,epochId:null,manifestHash:null})).ok,false);await success('close',c);passed('ambiguous duplicate manifest reconciliation refuses');
  c=await prepared();
  assert.equal((await helper('activate',{...c,baseline:{...c.baseline,fingerprints:{...c.baseline.fingerprints,balances:'0'.repeat(64)}}})).ok,false);await success('close',c);passed('exact financial baseline drift refuses activation');
  // Each metadata component and full history drift is checked by production SQL/controller.
  c=await prepared();const last=c.requiredMigrations.at(-1),registry=fixtureClient();await registry.connect();
  try{
   const saved=(await registry.query('select * from supabase_migrations.schema_migrations where version=$1',[last])).rows[0];
   await registry.query('delete from supabase_migrations.schema_migrations where version=$1',[last]);
   try{assert.equal((await helper('activate',c)).ok,false);}finally{await registry.query('insert into supabase_migrations.schema_migrations select * from jsonb_populate_record(null::supabase_migrations.schema_migrations,$1::jsonb)',[JSON.stringify(saved)]);}
  }finally{await registry.end();}
  passed('actual migration history deletion refuses');
  await db.query('grant execute on function private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz) to masarifi_worker');
  try{assert.equal((await helper('activate',c)).ok,false);}finally{await db.query('revoke execute on function private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz) from masarifi_worker');}
  passed('actual diagnostic ACL drift refuses');
  const original=(await db.query("select pg_get_functiondef('private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)'::regprocedure) body")).rows[0].body;
  await db.query("create or replace function private.voice_canary_scope_mismatch_reason(p_decisions jsonb,p_minor integer,p_manifest jsonb,p_capture timestamptz) returns text language sql set search_path='' as $$select 'inert_local_drift'::text$$");
  try{assert.equal((await helper('activate',c)).ok,false);}finally{await db.query(original);}await success('close',c);passed('actual diagnostic body drift refuses');
  c=await prepared();const grantClient=fixtureClient();await grantClient.connect();
  try{
   await grantClient.query('grant masarifi_migration to current_user with set true,inherit false');
   for(const action of ['prepare','activate','close'])assert.equal((await helper(action,action==='prepare'?{...c,epochId:null,manifestHash:null}:c)).ok,false);
   assert.equal((await grantClient.query("select count(*)::int n from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='masarifi_migration' and m.member=(select oid from pg_roles where rolname=current_user) and m.grantor=m.member")).rows[0].n,1);
  }finally{await grantClient.query('revoke masarifi_migration from current_user granted by current_user');await grantClient.end();}await success('close',c);passed('pre-existing self-grant remains present after all write refusals');
  await settledPreparation();await enforcementDrift();await driftClosure();await financialRaces();
  for(const relation of ['private.staging_voice_runtime_control','private.staging_voice_epochs','private.voice_automatic_policy'])await lockExpiry(relation);
  for(const action of ['prepare','activate'])await cleanupExpiry(action);
  c=await prepared();let observer={race:1};const recovered=await helper('activate',c,observer);assert(recovered.ok,JSON.stringify(recovered.errors));assert.equal(observer.attempts,2);assert.deepEqual(observer.databaseErrors,['40001']);await success('close',c);passed('one real heartbeat serialization race recovers with full transaction retry');
  c=await prepared();observer={race:3};assert.equal((await helper('activate',c,observer)).ok,false);assert.equal(observer.attempts,3);assert.deepEqual(observer.databaseErrors,['40001','40001','40001']);assert.equal((await success('status',c)).posting,false);await success('close',c);passed('persistent heartbeat serialization race stops after three attempts');
  c=await prepared();observer={race:1,uncertainRollback:true};assert.equal((await helper('activate',c,observer)).ok,false);assert.equal(observer.attempts,1);assert.equal((await success('status',c)).posting,false);await success('close',c);passed('uncertain rollback acknowledgement never retries activation');
  c=await prepared();observer={lostCommit:true};assert.equal((await helper('activate',c,observer)).ok,false);assert.equal(observer.attempts,1);assert.equal((await success('status',c)).posting,true);await success('close',c);passed('lost activation COMMIT response never replays');
  // Persistent operating mode admits fresh captures and survives multiple actual ledger commits.
  c=await prepared();const before=await financial();const activation=await success('activate',c);assert.equal(activation.expiresAt,null);
  assert.equal(await legacyHash(legacy),legacyBefore);
  await assert.rejects(capture(c,new Date(Date.parse(activation.startedAt)-1000).toISOString()));
  assert.equal((await success('status',c)).members,0);passed('stale legacy capture cannot join the fresh operating epoch');
  const first=await commitExpense(c,1000);let status=await success('status',c);assert.equal(status.committed,1);assert.equal(status.posting,true);assert.equal(status.epoch.state,'active');
  // Reproduce the failure boundary with real locks on the unrelated backlog and
  // activation baseline tables. Recurring checks must not touch those relations.
  // db already holds the fixture's migration role; witness is intentionally a
  // SELECT-only observer and must not be granted table-lock privileges.
  await db.query('begin read write');
  try{
   await db.query('lock table private.outbox_events,public.accounts,public.transactions,public.transaction_postings,public.account_balances in access exclusive mode');
   const observation={},result=await helper('monitor',c,observation);assert.equal(result.ok,true,JSON.stringify(result.errors));
   const monitored=result.result;
   assert.equal(monitored.posting,true);assert.equal(monitored.enforced,true);assert.equal(monitored.epoch.matches,true);
   assert.equal(monitored.epoch.epochId,c.epochId);assert.equal(monitored.epoch.state,'active');assert.equal(monitored.committed,1);
   assert.deepEqual(monitored.migrations,c.requiredMigrations);assert.equal(monitored.fingerprints,undefined);assert.equal(monitored.historical,undefined);
   assert.equal(observation.readSnapshotStarted,true);assert.equal(observation.roleMutations||0,0);
  }finally{await db.query('rollback');}
  passed('recurring monitor stays read-only and responsive while unrelated backlog and baseline tables are exclusively locked');
  const afterFirst=await financial();assert.equal(BigInt(afterFirst.confirmed_minor),BigInt(before.confirmed_minor)-1000n);assert.equal(afterFirst.pending_minor,before.pending_minor);assert.equal(afterFirst.transactions,before.transactions+1);assert.equal(afterFirst.postings,before.postings+1);
  await db.query('select private.execute_voice_event($1,$2,$3)',[first.claim.batch_id,first.claim.token,first.event.id]);assert.deepEqual(await financial(),afterFirst);passed('duplicate execute creates exactly one transaction/posting/balance effect');
  await commitExpense(c,2000);status=await success('status',c);assert.equal(status.committed,2);assert.equal(status.posting,true);assert.equal(status.epoch.state,'active');assert.equal(status.epoch.expiresAt,null);
  const afterSecond=await financial();assert.equal(BigInt(afterSecond.confirmed_minor),BigInt(before.confirmed_minor)-3000n);assert.equal(afterSecond.pending_minor,before.pending_minor);assert.equal(afterSecond.transactions,before.transactions+2);assert.equal(afterSecond.postings,before.postings+2);assert.equal(BigInt(afterSecond.ledger_version),BigInt(before.ledger_version)+2n);passed('persistent operating mode survives two commits with exact balance');
  assert.equal(await legacyHash(legacy),legacyBefore);passed('retained old uploaded Voice session/context/create-operation receipt remains byte-for-byte unchanged and never joins new membership or posts');
  const skippedBefore=await financial(),skipped=await capture(c,new Date().toISOString());await accept(c,skipped,[{status:'skipped',reason:'missing_amount'}]);
  status=await success('status',c);assert.equal(status.rejected,1);assert.equal(status.executionFailed,0);assert.equal(status.posting,true);assert.equal(status.epoch.state,'active');assert.deepEqual(await financial(),skippedBefore);passed('normal skipped input remains unposted with zero balance effect and healthy operating mode');
  const fault=await commitExpense(c,1000,false),faultBefore=await financial();
  await assert.rejects(db.query('select private.execute_voice_event($1,$2,$3)',[fault.claim.batch_id,randomUUID(),fault.event.id]));
  assert.deepEqual(await financial(),faultBefore);
  for(let attempt=0;attempt<5;attempt++)assert.equal((await db.query('select private.retry_voice_event($1,$2,$3) retried',[fault.claim.batch_id,fault.claim.token,fault.event.id])).rows[0].retried,true);
  status=await success('status',c);assert.equal(status.executionFailed,1);assert.equal(status.rejected,1);assert.deepEqual(await financial(),faultBefore);passed('actual execution guard fault stays unposted and retry exhaustion reports scoped executionFailed');
  await success('close',{...c,approvalReceivedAt:1,activationExpiresAt:2,startsAt:1});assert.equal((await success('status',c)).posting,false);passed('owned closure remains available after activation authority expires');
  assert.equal(await legacyHash(legacy),legacyBefore);passed('retained pending Voice rows and empty batch/event receipts remain unchanged through owned closure');
  const foreign=await prepared();await success('activate',foreign);assert.equal((await helper('close',c)).ok,false);status=await success('status',foreign);assert.equal(status.posting,true);assert.equal(status.executionFailed,0);assert.equal(status.rejected,0);await success('close',foreign);passed('foreign current epoch cannot be disabled and terminal failures remain scoped to their owning epoch');
  return {status:'PASS',behavioralCases:caseNames.length,cases:caseNames,transport:'disposable loopback54322 CI only',actualProductionHelperSQL:true,productionOrStagingAccess:false};
 }finally{await db.end();}
}
const overallBudget=setTimeout(()=>{for(const release of [...barrierReleases])release();console.error(JSON.stringify({status:'OPERATING_SQL_QUALIFICATION_FAILED',completedCases:caseNames.length,lastCompletedCase:caseNames.at(-1)||null,code:'FIXTURE_OVERALL_TIMEOUT'}));process.exit(1);},140000);
main().then(async result=>{await closeFixtures();console.log(JSON.stringify(result));}).catch(error=>{console.error(JSON.stringify({status:'OPERATING_SQL_QUALIFICATION_FAILED',completedCases:caseNames.length,lastCompletedCase:caseNames.at(-1)||null,code:/^[A-Z0-9]{5}$/.test(error.code||'')?error.code:['ERR_ASSERTION','FIXTURE_BARRIER_TIMEOUT'].includes(error.code)?error.code:'UNAVAILABLE'}));process.exitCode=1;}).finally(async()=>{try{await closeFixtures();}finally{clearTimeout(overallBudget);}});
