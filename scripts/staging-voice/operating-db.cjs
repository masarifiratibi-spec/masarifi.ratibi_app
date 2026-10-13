"use strict";
// Fixed env-only helper for a separately authorized host adapter. No live authority is created here.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const actions=['status','prepare','reconcile','activate','close'];
const action=process.env.OPERATING_ACTION;
let stage='configuration';
const acceptance={bodyHash:'683de0fd60086962c86b256983b5feadd00f4c300166a82bfc782250de29ebec',owner:'masarifi_migration',definer:true,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}'};
const diagnostic={bodyHash:'ce00e1b5da381a8baa4ac95f3e6882bb73dbccf107ff8007577e9c5410c1696b',owner:'masarifi_migration',definer:false,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration}'};
const closure={bodyHash:'2f95bb0c1bb3e809bc74e15b2216ae127a1933237885e0e033ed32b354b1392d',owner:'masarifi_migration',definer:true,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}'};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function authority(c,enteredAt) {
 const now=Date.now()/1000;
 assert(now>=c.approvalReceivedAt&&now<=c.approvalReceivedAt+3600);
 assert(now<c.activationExpiresAt&&now>=c.startsAt&&now<c.startsAt+90);
 if(action==='activate')assert(Date.now()-enteredAt<10000);
}
function validate(c) {
 assert.equal(process.env.MASARIFI_PROCESS_KIND,'migration');assert(actions.includes(action));
 assert.equal(c.project,'qcffvfbpzvpwcwxwjyro');
 const url=new URL(process.env.DATABASE_URL);
 assert(url.hostname.endsWith('.supabase.com')&&decodeURIComponent(url.username).endsWith('.'+c.project));
 assert.equal(c.manifest.version,1);assert.equal(c.manifest.mode,'operating');
 assert.equal(c.manifest.newCapturesOnly,true);assert.equal(c.manifest.normalEligibility,true);
 assert.equal(c.manifest.retentionPolicy,'existing-operating');
 assert(/^[a-f0-9]{40}$/.test(c.manifest.sourceSha));
 for(const key of ['imageDigest','apkHash','controlHash'])assert(hash(c.manifest[key]));
 assert(Buffer.byteLength(JSON.stringify(c.manifest))<=8192);
 assert(Array.isArray(c.requiredMigrations)&&c.requiredMigrations.length===110);
 assert(c.requiredMigrations.every(v=>typeof v==='string'&&/^\d{14}$/.test(v)));
 assert.deepEqual(c.requiredMigrations,[...new Set(c.requiredMigrations)].sort());
 assert(c.requiredMigrations.includes('20261013053237'));
 const b=c.baseline;assert.deepEqual(Object.keys(b).sort(),['activeEpochs','analysisJobs','fingerprints','historical','migrations','posting']);
 assert.equal(b.posting,false);assert.equal(b.activeEpochs,0);assert.equal(b.analysisJobs,0);
 assert.deepEqual(b.migrations,c.requiredMigrations);
 assert.deepEqual(Object.keys(b.fingerprints).sort(),['accounts','balances','postings','transactions']);
 assert(Object.values(b.fingerprints).every(hash));
 assert.deepEqual(Object.keys(b.historical).sort(),['assistantPending','outboxUnpublished','voicePending']);
 assert(Object.values(b.historical).every(v=>Number.isInteger(v)&&v>=0&&v<=2147483647));
 assert(c.epochId===null||uuid(c.epochId));assert(c.manifestHash===null||hash(c.manifestHash));
 assert.equal(c.epochId===null,c.manifestHash===null);
 if(['activate','close'].includes(action))assert(uuid(c.epochId)&&hash(c.manifestHash));
 if(action==='prepare')assert.equal(c.epochId,null);
 for(const key of ['approvalReceivedAt','activationExpiresAt','startsAt'])assert(typeof c[key]==='number'&&Number.isFinite(c[key])&&c[key]>0);
}
async function snapshot(db) {
 const row=(await db.query(`select
 (select enabled from private.voice_automatic_policy) posting,
 (select count(*)::int from private.staging_voice_epochs where state='active') "activeEpochs",
 (select count(*)::int from public.voice_sessions s join private.voice_batch_context x on x.session_id=s.id
  where x.analysis_only and s.status in ('uploaded','processing')) "analysisJobs",
 (select coalesce(jsonb_agg(version order by version),'[]'::jsonb) from supabase_migrations.schema_migrations) migrations,
 jsonb_build_object('voicePending',(select count(*)::int from public.voice_sessions where status in ('uploaded','processing')),
 'assistantPending',(select count(*)::int from public.assistant_messages where work_status in ('queued','processing')),
 'outboxUnpublished',(select count(*)::int from private.outbox_events where published_at is null)) historical`)).rows[0];
 const fingerprints={};
 for(const [name,table,key]of [['accounts','public.accounts','id'],['transactions','public.transactions','id'],['postings','public.transaction_postings','id'],['balances','public.account_balances','account_id']]){
  const rows=(await db.query(`select to_jsonb(t) row from ${table} t order by ${key} limit 10001`)).rows;
  assert(rows.length<=10000);fingerprints[name]=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 }
 return {...row,fingerprints};
}
async function freshBaseline(Pool,c) {
 // Main owns SHARE locks. This original-login reader gets a new snapshot after
 // any financial writer that preceded those locks has committed; it never elevates.
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,query_timeout:10000});
 let db;
 try{
  db=await pool.connect();await db.query('begin isolation level repeatable read read only');
  await db.query("set local statement_timeout='10s'");await db.query("set local lock_timeout='5s'");
  const current=await snapshot(db);await schema(db,c,current);stage='admission';assert.deepEqual(current,c.baseline);
  await db.query('commit');
 }catch(error){if(db)await db.query('rollback').catch(()=>{});throw error;
 }finally{if(db)db.release();await pool.end();}
}
async function schema(db,c,s) {
 stage='schema';assert.deepEqual(s.migrations,c.requiredMigrations);
 for(const [signature,expected]of [['private.accept_voice_batch(uuid,uuid,jsonb,text)',acceptance],['private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)',diagnostic]]){
  await provenance(db,signature,expected);
 }
}
async function provenance(db,signature,expected) {
 const row=(await db.query(`select encode(extensions.digest(prosrc,'sha256'),'hex') "bodyHash",
   pg_get_userbyid(proowner) owner,prosecdef definer,proconfig config,proacl::text acl
   from pg_proc where oid=to_regprocedure($1)`,[signature])).rows[0];
 assert.deepEqual(row,expected);
}
async function finalAuthority(db,c,enteredAt) {
 stage='authority';authority(c,enteredAt);
 const row=(await db.query(`select clock_timestamp()>=to_timestamp($1)
  and clock_timestamp()<=to_timestamp($1)+interval '1 hour'
  and clock_timestamp()<to_timestamp($2) and clock_timestamp()>=to_timestamp($3)
  and clock_timestamp()<to_timestamp($3)+interval '90 seconds'
  and clock_timestamp()<to_timestamp($4) allowed`,[c.approvalReceivedAt,c.activationExpiresAt,c.startsAt,action==='activate'?enteredAt/1000+10:c.activationExpiresAt])).rows[0];
 assert.equal(row?.allowed,true);
 // The clock response itself may have been delayed. Recheck locally immediately before COMMIT.
 authority(c,enteredAt);
}
async function manifestRows(db,c) {
 return (await db.query('select id,manifest_hash,state from private.staging_voice_epochs where manifest=$1::jsonb',[JSON.stringify(c.manifest)])).rows;
}
async function epoch(db,c,lock=false) {
 return (await db.query(`select id,manifest_hash,state,mode,manifest=$2::jsonb matches,
  manifest->>'sourceSha' source,manifest->>'imageDigest' image,
  extract(epoch from expires_at)::double precision "expiresAt",extract(epoch from heartbeat_at)::double precision "heartbeatAt"
  from private.staging_voice_epochs where id=$1::uuid${lock?' for update':''}`,[c.epochId,JSON.stringify(c.manifest)])).rows[0];
}
function owned(e,c) {
 assert(e&&e.id===c.epochId&&e.manifest_hash===c.manifestHash&&e.matches===true);
 assert.equal(e.mode,'operating');assert.equal(e.source,c.manifest.sourceSha);assert.equal(e.image,c.manifest.imageDigest);
}
async function counts(db,id) {
 return (await db.query(`select
  (select count(*)::int from private.staging_voice_members where epoch_id=$1::uuid) "members",
  (select count(*)::int from private.voice_events v join private.voice_batches b on b.id=v.batch_id
   join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=$1::uuid and v.status='committed') committed,
  (select count(*)::int from private.voice_events v join private.voice_batches b on b.id=v.batch_id
   join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=$1::uuid and v.status in ('skipped','cancelled'))
   +(select count(*)::int from public.voice_sessions s join private.staging_voice_members m on m.session_id=s.id
     where m.epoch_id=$1::uuid and s.status='failed' and not exists(select 1 from private.voice_batches b
      join private.voice_events v on v.batch_id=b.id where b.session_id=s.id and v.status in ('skipped','cancelled','execution_failed'))) rejected,
  (select count(*)::int from private.voice_events v join private.voice_batches b on b.id=v.batch_id
   join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=$1::uuid and v.status='execution_failed') "executionFailed"`,[id])).rows[0];
}
async function run() {
 const c=JSON.parse(process.env.OPERATING_CONTROL);validate(c);
 const enteredAt=Date.now(),writes=['prepare','activate','close'].includes(action);
 const {Pool}=createRequire('/app/dist/src/ai/ai.worker.js')('pg');
 for(let attempt=1;attempt<=3;attempt++){
  let pool,db,commitDispatched=false;
  try{
   if(action==='prepare'||action==='activate')authority(c,enteredAt);
   stage='connection';pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,query_timeout:10000});db=await pool.connect();
   stage='transaction';await db.query(writes?'begin isolation level serializable':'begin isolation level repeatable read read only');
   await db.query("set local statement_timeout='10s'");
   await db.query("set local lock_timeout='5s'");
   if(writes){
    stage='ownership';
    const existing=(await db.query("select exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='masarifi_migration' and m.member=(select oid from pg_roles where rolname=current_user) and m.grantor=m.member) present")).rows[0];
    assert.equal(existing.present,false); // Refuse rather than overwrite/revoke a self-grant owned by someone else.
   }
   // Reads fix the serializable snapshot before row locks. A heartbeat change then raises 40001.
   let s;
   if(action!=='close'){stage='status';s=await snapshot(db);await schema(db,c,s);}
   let result;
   if(action==='reconcile'){
    stage='reconcile';const rows=await manifestRows(db,c);assert(rows.length<=1);
    if(rows.length){assert(uuid(rows[0].id)&&hash(rows[0].manifest_hash));if(c.epochId!==null){assert.equal(rows[0].id,c.epochId);assert.equal(rows[0].manifest_hash,c.manifestHash);}}
    result=rows.length?{epochId:rows[0].id,manifestHash:rows[0].manifest_hash,state:rows[0].state,matches:true}:null;
   }else if(action==='status'){
    stage='status';const current=(await db.query('select current_epoch,enforced from private.staging_voice_runtime_control')).rows[0];assert(current);
    const e=c.epochId===null?null:await epoch(db,c);
    result={...s,currentEpoch:current.current_epoch,epoch:e?{epochId:e.id,state:e.state,mode:e.mode,manifestHash:e.manifest_hash,matches:e.matches&&e.manifest_hash===c.manifestHash,expiresAt:e.expiresAt,heartbeatAt:e.heartbeatAt}:null,...await counts(db,c.epochId)};
   }else{
    stage='ownership';await db.query('grant masarifi_migration to current_user with set true,inherit false');await db.query('set local role masarifi_migration');
    if(action==='prepare'||action==='activate'){
     stage='admission';await db.query('lock table public.accounts,public.transactions,public.transaction_postings,public.account_balances in share mode');
    }
    const current=(await db.query('select current_epoch,enforced from private.staging_voice_runtime_control for update')).rows[0];assert(current);
    let e;
    if(action==='prepare'){
     if(current.current_epoch!==null){const prior=(await db.query('select state from private.staging_voice_epochs where id=$1::uuid for update',[current.current_epoch])).rows[0];assert(prior&&prior.state==='closed');}
    }else{
     assert.equal(current.current_epoch,c.epochId);assert.equal(current.enforced,true);
     e=await epoch(db,c,true);owned(e,c);
    }
    assert.equal((await db.query('select singleton from private.voice_automatic_policy for update')).rows.length,1);
    if(action==='prepare'||action==='activate'){
     stage='admission';assert.deepEqual(s,c.baseline);authority(c,enteredAt);
     await freshBaseline(Pool,c);stage='admission';authority(c,enteredAt);
     if(action==='prepare'){
      const rows=await manifestRows(db,c);assert.equal(rows.length,0);authority(c,enteredAt);
      stage='prepare';result=(await db.query('select private.prepare_staging_voice_epoch($1,$2::jsonb) result',[c.project,JSON.stringify(c.manifest)])).rows[0].result;
      assert(uuid(result.epochId)&&hash(result.manifestHash)&&result.state==='prepared');
     }else{
      assert.equal(e.state,'prepared');stage='activate';
      // All capability locks are already held. Clock predicates execute in this SELECT,
      // not before a blocking lock. NULL deadline deliberately preserves persistent operating mode.
      const activated=await db.query(`select private.activate_staging_voice_epoch($1::uuid,$2,null) result
       where clock_timestamp()>=to_timestamp($3) and clock_timestamp()<=to_timestamp($3)+interval '1 hour'
        and clock_timestamp()<to_timestamp($4) and clock_timestamp()>=to_timestamp($5)
        and clock_timestamp()<to_timestamp($5)+interval '90 seconds'
        and clock_timestamp()<to_timestamp($6)+interval '10 seconds'`,[c.epochId,c.manifestHash,c.approvalReceivedAt,c.activationExpiresAt,c.startsAt,enteredAt/1000]);
      assert.equal(activated.rows.length,1);result=activated.rows[0].result;assert.equal(result.epochId,c.epochId);assert.equal(result.expiresAt,null);
     }
    }else{
     // OFF uses only its owned current epoch and the exact closure capability.
     // Readiness drift must not strand this owned financial writer in ON mode.
     stage='closure';await provenance(db,'private.close_staging_voice_epoch(uuid,text)',closure);
     stage='close';await db.query("select private.close_staging_voice_epoch($1::uuid,'customer_operating_guard')",[c.epochId]);
     result=(await db.query(`select id "epochId",state,(select enabled from private.voice_automatic_policy) posting,
      exists(select 1 from private.staging_voice_runtime_control where current_epoch=$1::uuid) "currentEpochMatches"
      from private.staging_voice_epochs where id=$1::uuid`,[c.epochId])).rows[0];
     assert.deepEqual(result,{epochId:c.epochId,state:'closed',posting:false,currentEpochMatches:true});
    }
    stage='ownership';await db.query('reset role');await db.query('revoke masarifi_migration from current_user granted by current_user');
    if(action==='prepare'||action==='activate')await finalAuthority(db,c,enteredAt);
   }
   stage='commit';commitDispatched=true;await db.query('commit');console.log(JSON.stringify(result));return;
  }catch(error){
   const rolledBack=db?await db.query('rollback').then(()=>true,()=>false):false;
   // Only an acknowledged abort of the complete transaction permits repeating activation.
   // A dispatched COMMIT is never replayed, even if its response looks like 40001.
   if(action==='activate'&&!commitDispatched&&error.code==='40001'&&rolledBack&&attempt<3){
    try{authority(c,enteredAt);}catch{throw error;}
    continue;
   }
   throw error;
  }finally{
   if(db)db.release();if(pool)await pool.end();
  }
 }
}
module.exports=run().catch(error=>{
 const code=/^[A-Z0-9]{5}$/.test(error.code||'')?error.code:error.code==='ERR_ASSERTION'?'ERR_ASSERTION':'UNAVAILABLE';
 console.error(JSON.stringify({error:'OPERATING_DATABASE_FAILED',action:actions.includes(action)?action:'invalid',stage,code}));process.exitCode=1;
});
