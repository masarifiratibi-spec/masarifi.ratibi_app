"use strict";
// Disposable loopback DB only. VM substitutes only pg transport; production guards/SQL unchanged.
const assert=require('node:assert/strict'), fs=require('node:fs');
const {EventEmitter}=require('node:events');const {createHash,randomUUID}=require('node:crypto');
const {Client}=require('../../../apps/api/node_modules/pg');
const local=process.env.DATABASE_URL;const u=new URL(local);
assert(['127.0.0.1','localhost'].includes(u.hostname)&&u.port==='54322');
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'masarifiratibi-spec/masarifi.ratibi_app');
const code=fs.readFileSync(__dirname+'/canary-db.cjs','utf8');
const db=new Client({connectionString:local});
const scope={project:'qcffvfbpzvpwcwxwjyro',ownerId:'user_3K2ItVcURds22ueEf31Py6e305q',accountId:'3161601e-1584-40b0-86ec-d170c018b551',categoryId:'04000000-0000-4000-8000-000000000006',clerkSessionHash:createHash('sha256').update('local-test-session').digest('hex')};
async function helper(action,state,patch={}){
 const stdin=new EventEmitter();let output='',error='',exitCode=0;
 return new Promise(resolve=>{
  class LocalClient extends Client{constructor(){super({connectionString:local});}async end(){await super.end();resolve({ok:!exitCode,result:output?JSON.parse(output):null,error});}}
  const proc={env:{SUPABASE_URL:'https://'+scope.project+'.supabase.co'},stdin,get exitCode(){return exitCode},set exitCode(x){exitCode=x}};
  Function('require','process','console',code)(x=>x==='pg'?{Client:LocalClient}:require(x),proc,{log:x=>output+=x,error:x=>error+=x});
  stdin.emit('data',JSON.stringify({action,state,scope:{...scope,...patch},scopeHash:'a'.repeat(64),url:'postgresql://postgres.'+scope.project+':INERT@inert.supabase.com/postgres'}));stdin.emit('end');
 });
}
async function success(action,state){const r=await helper(action,state);assert(r.ok,action+':'+r.error);return r.result;}
async function prepared(){
 scope.baseline=(await success('baseline')).financial;const now=Date.now()/1000;
 const state={startsAt:now,deadline:now+300,epochId:null,manifestHash:null,packet:{version:2,mode:'canary',sourceSha:'b'.repeat(40),imageDigest:'c'.repeat(64),apkHash:'d'.repeat(64),controlHash:'a'.repeat(64),ownerId:scope.ownerId,accountId:scope.accountId,categoryId:scope.categoryId,clerkSessionHash:scope.clerkSessionHash,maxTransactions:1,maxPostings:1,expenseMinor:1000,maxExpenseMinor:1000,currency:'SAR',locale:'ar',attemptId:randomUUID()}};
 const p=await success('prepare',state);Object.assign(state,{epochId:p.epochId,manifestHash:p.manifestHash});return state;
}
async function capture(state,recordedAt){
 await db.query('begin');try{
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'authenticated',sub:scope.ownerId,sid:'local-test-session'})]);
  await db.query('set local role masarifi_api');
  const r=await db.query('select private.create_voice_session_v3($1,$2::jsonb,$3::uuid,300,0,300,$4::jsonb) result',[scope.ownerId,JSON.stringify({locale:'ar',durationMs:3000,contentType:'audio/m4a',sizeBytes:100,contentHash:'f'.repeat(64),recordedAt,timezoneOffsetMinutes:-180}),randomUUID(),'{}']);
  await db.query('commit');return r.rows[0].result.id;
 }catch(e){await db.query('rollback');throw e;}
}
(async()=>{let count=0;await db.connect();try{
 await db.query('grant masarifi_migration,masarifi_api,masarifi_worker to current_user with set true, inherit false');
 await db.query('set role masarifi_migration');
 // The hosted migration login already has these read grants. Provision only the disposable login.
 await db.query('grant usage on schema public,private to postgres');
 await db.query('grant select on all tables in schema public,private to postgres');
 await db.query("insert into public.profiles(id,status) values($1,'active')",[scope.ownerId]);
 await db.query("insert into public.accounts(id,user_id,name,type,currency_code,is_default) values($1,$2,'Test','cash','SAR',true)",[scope.accountId,scope.ownerId]);
 // Zero-commit closure, lost-response lookup, exact manifest and drift refusal.
 let s=await prepared();count++;
 const reconciled=await success('reconcile',{...s,epochId:null,manifestHash:null});assert.equal(reconciled.epochId,s.epochId);count++;
 assert.equal((await success('status',s)).state,'prepared');count++;
 assert.equal((await helper('status',{...s,manifestHash:'0'.repeat(64)})).ok,false);count++;
 assert.equal((await helper('activate',s,{baseline:{...scope.baseline,confirmedMinor:123}})).ok,false);count++;
 await success('close',s);assert.equal((await success('verify',s)).committed,0);count++;
 assert.equal((await success('reconcile',{...s,packet:{...s.packet,attemptId:randomUUID()}})),null);count++;
 // Fresh one-capture actual ledger path; legacy timestamp must be rejected before admission.
 s=await prepared();await success('activate',s);assert.equal((await success('status',s)).posting,true);count++;
 await assert.rejects(capture(s,new Date((s.startsAt-1)*1000).toISOString()));count++;
 const session=await capture(s,new Date().toISOString());
 await db.query("update public.voice_sessions set status='uploaded',uploaded_at=clock_timestamp(),finalized_at=clock_timestamp() where id=$1",[session]);
 const work=(await db.query("select * from private.claim_staging_voice_work($1,'local-fixture',1,120)",[s.epochId])).rows[0];assert.equal(work.id,session);
 const command={kind:'expense',amountMinor:1000,currency:'SAR',accountId:scope.accountId,categoryId:scope.categoryId,title:'Shopping test',merchant:null,paymentMethod:null,note:null,occurredAt:new Date().toISOString(),source:'voice',externalRef:null};
 await db.query('select private.accept_voice_batch($1,$2,$3::jsonb,$4)',[session,work.claim_token,JSON.stringify([{status:'eligible',command}]),'automatic-or-skip-v3.1']);
 const claim=(await db.query('select * from private.claim_staging_voice_finalization($1,1)',[s.epochId])).rows[0];assert(claim);
 const event=(await db.query('select id from private.voice_events where batch_id=$1',[claim.batch_id])).rows[0];
 await db.query('select private.execute_voice_event($1,$2,$3)',[claim.batch_id,claim.token,event.id]);
 const status=await success('status',s);assert.equal(status.committed,1);assert.equal(status.posting,false);count++;
 await success('close',s);const verified=await success('verify',s);assert.equal(verified.committed,1);assert.equal(verified.confirmedMinor,scope.baseline.confirmedMinor-1000);count++;
 await db.query('select private.execute_voice_event($1,$2,$3)',[claim.batch_id,claim.token,event.id]);assert.deepEqual(await success('verify',s),verified);count++;
 await db.query('begin');try{await db.query('update public.account_balances set confirmed_minor=confirmed_minor-1 where account_id=$1',[scope.accountId]);
 // Mutation in this transaction is invisible to helper; commit then reverse within disposable database.
 await db.query('commit');assert.equal((await helper('verify',s)).ok,false);count++;
 }finally{await db.query('update public.account_balances set confirmed_minor=confirmed_minor+1 where account_id=$1',[scope.accountId]);}
 console.log(JSON.stringify({status:'PASS',behavioralCases:count,transport:'disposable loopback only',actualProductionHelperSQL:true,productionOrStagingAccess:false}));
 }finally{await db.end();}})().catch(e=>{console.error(e);process.exitCode=1});
