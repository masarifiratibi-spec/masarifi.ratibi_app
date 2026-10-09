'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const g=require('./canary-guards.cjs');
const {cleanup}=require('./canary-host.cjs');
const id='10000000-0000-4000-8000-000000000001';
const token='20000000-0000-4000-8000-000000000001';
const event='30000000-0000-4000-8000-000000000001';
function control(){const now=Date.now();return {stagingSha:g.PIN.sha,imageDigest:g.PIN.digest,project:g.PIN.project,
  startedAt:new Date(now-1000).toISOString(),deadline:new Date(now+599000).toISOString(),
  approval:{kind:'direct-human-financial-approval',scopeHash:g.scopeHash,messageReference:'offline-test-fixture',verbatimMessage:'Offline synthetic authorization fixture; never valid for hosted execution.',receivedAt:new Date(now-2000).toISOString()},
  sessions:[{id,case:'en',recordedAt:new Date(now-500).toISOString(),timezoneOffsetMinutes:-180,contentHash:'a'.repeat(64),humanSamsungCapture:true,deviceSerial:'RK8XB00N33K',captureEvidence:'offline-capture-fixture'}]};}
function input(s){return {contractVersion:3,recordedAt:s.recordedAt,timezoneOffsetMinutes:-180,contentHash:s.contentHash,locale:'en'};}
function claim(){return {kind:g.PIN.kind,id,user_id:g.PIN.owner,attempt_count:1,claim_token:token};}
function client(row,source){const calls=[];return {calls,async query(sql){calls.push(sql);if(sql.includes('claim_ai_work'))return {rows:row ? [row] : []};if(sql.includes('get_ai_work_input'))return {rows:[{result:source}]};return {rows:[]};}};}
test('financial execution has no default approval; closed/expanded windows and source changes reject',()=>{
  const c=control();g.approval(c);
  for(const mutate of [x=>delete x.approval,x=>x.approval.scopeHash='wrong',x=>x.stagingSha='64405e4',x=>x.project='production',x=>x.deadline=new Date(Date.now()-1).toISOString(),x=>x.deadline=new Date(Date.now()+601000).toISOString(),x=>x.sessions[0].humanSamsungCapture=false,x=>x.sessions[0].recordedAt=new Date(Date.parse(x.startedAt)-1).toISOString(),x=>x.sessions.push({...x.sessions[0]})]){
    const bad=structuredClone(c);mutate(bad);assert.throws(()=>g.approval(bad));
  }
  assert.throws(()=>g.exactSession(c,token));
});
test('an unrelated global claim is rolled back and never retained or processed',async()=>{
  const s=control().sessions[0];const row=claim();row.id=token;const db=client(row,input(s));
  await assert.rejects(g.claimExact(db,s));assert.equal(db.calls.at(-1),'rollback');assert(!db.calls.includes('commit'));
});
test('owner/kind/previous attempt or real input provenance mismatch rolls back',async()=>{
  const s=control().sessions[0];
  for(const mutate of [r=>r.user_id='other',r=>r.kind='assistant.respond',r=>r.attempt_count=2]){const r=claim();mutate(r);const db=client(r,input(s));await assert.rejects(g.claimExact(db,s));assert.equal(db.calls.at(-1),'rollback');}
  for(const mutate of [r=>r.contentHash='b'.repeat(64),r=>r.recordedAt=new Date(0).toISOString(),r=>r.contractVersion=2,r=>r.locale='ar']){const i=input(s);mutate(i);const db=client(claim(),i);await assert.rejects(g.claimExact(db,s));assert.equal(db.calls.at(-1),'rollback');}
});
test('empty claim and database failure roll back, exact provenance retains just one claim',async()=>{
  const s=control().sessions[0];const empty=client(null,input(s));await assert.rejects(g.claimExact(empty,s));assert.equal(empty.calls.at(-1),'rollback');
  const good=client(claim(),input(s));assert.deepEqual(await g.claimExact(good,s),claim());assert.equal(good.calls.at(-1),'commit');
  const calls=[];await assert.rejects(g.transaction({query:async sql=>{calls.push(sql);}},async()=>{throw new Error('connection lost during body');}));assert.equal(calls.at(-1),'rollback');
});
function accepted(c){const s=c.sessions[0];return {session:{id,user_id:g.PIN.owner,contract_version:3,content_hash:s.contentHash,capture_at:s.recordedAt,capture_timezone_offset:-180,locale:'en',deleted_at:null,cancelled_at:null},
  batch:{id:token,session_id:id,user_id:g.PIN.owner,policy_version:'automatic-or-skip-v3.1'},
  events:[{id:event,batch_id:token,user_id:g.PIN.owner,status:'eligible',transaction_id:null,command:{kind:'expense',source:'voice',amountMinor:2500,currency:'SAR',accountId:g.PIN.cash,categoryId:g.PIN.food,note:null,paymentMethod:null,title:'Food',merchant:null,externalRef:'voice-event:'+event,occurredAt:s.recordedAt}}]};}
test('actual accepted commands must match account/category/amount and bounded event scope',()=>{
  const c=control();g.batch(accepted(c),c.sessions[0]);
  for(const mutate of [x=>x.events[0].command.amountMinor=5000,x=>x.events[0].command.accountId=g.PIN.card,x=>x.events[0].command.categoryId=g.PIN.income,x=>x.events.push({...x.events[0],id}),x=>x.session.contract_version=2,x=>x.events[0].command.occurredAt=new Date(0).toISOString(),x=>x.events[0].status='committed']){const s=accepted(c);mutate(s);assert.throws(()=>g.batch(s,c.sessions[0]));}
  const mixed=control();mixed.sessions[0].case='en-safe-incomplete';const s=accepted(mixed);s.events.push({id,batch_id:token,user_id:g.PIN.owner,status:'skipped',reason_code:'missing_amount',transaction_id:null,command:null});assert.equal(g.batch(s,mixed.sessions[0]).id,event);
  s.events[1].command=s.events[0].command;assert.throws(()=>g.batch(s,mixed.sessions[0]));
});
function financial(c){const t={id:token,user_id:g.PIN.owner,status:'confirmed',kind:'expense',source:'voice',currency_code:'SAR',amount_minor:'2500',fee_minor:'0',category_id:g.PIN.food,note:null,external_ref:'voice-event:'+event,deleted_at:null,reverses_transaction_id:null,created_at:new Date().toISOString(),voice_session_id:id};
  const p={id:event,transaction_id:token,account_id:g.PIN.cash,amount_minor:'-2500',posting_role:'source',clearing_state:'confirmed'};return {rows:[t],postings:[p]};}
test('duplicates, unknown owners/sessions, unapproved effects and excess records fail the whole-ledger guard',()=>{
  const c=control();const f=financial(c);g.ledger(f.rows,f.postings,c);
  for(const mutate of [x=>x.rows.push({...x.rows[0]}),x=>x.rows[0].voice_session_id=event,x=>x.rows[0].user_id='other',x=>x.rows[0].fee_minor='1',x=>x.postings[0].amount_minor='-2600',x=>x.postings[0].account_id=g.PIN.card,x=>x.postings.push({...x.postings[0]}),x=>x.rows=Array(7).fill(x.rows[0])]){const bad=structuredClone(f);mutate(bad);assert.throws(()=>g.ledger(bad.rows,bad.postings,c));}
});
test('normal cleanup stops ingress and effects before disabling policy, then restores restricted mode',async()=>{
  const calls=[];const adapter=Object.fromEntries(['target','pin','stopApi','stopScoped','stopGeneral','policyOff','restoreAnalysisApi','verify'].map(n=>[n,async()=>calls.push(n)]));
  assert.deepEqual(await cleanup(adapter),{posting:false,apiAnalysisOnly:true,generalWorker:false});
  assert.deepEqual(calls,['target','stopApi','stopScoped','stopGeneral','policyOff','pin','restoreAnalysisApi','verify']);
});
test('database cleanup failure leaves API stopped; independent retry restores only after OFF succeeds',async()=>{
  const calls=[];let unavailable=true;const adapter=Object.fromEntries(['target','pin','stopApi','stopScoped','stopGeneral','policyOff','restoreAnalysisApi','verify'].map(n=>[n,async()=>{calls.push(n);if(n==='policyOff'&&unavailable)throw new Error('database unreachable');}]));
  await assert.rejects(cleanup(adapter));assert(!calls.includes('restoreAnalysisApi'));assert(!calls.includes('verify'));
  unavailable=false;await cleanup(adapter);assert.deepEqual(calls.slice(-4),['policyOff','pin','restoreAnalysisApi','verify']);
});
test('cleanup never starts services after closure or pin failures, and verifies restoration failures',async()=>{
  for(const failure of ['target','pin','stopApi','stopScoped','stopGeneral','restoreAnalysisApi','verify']){
    const calls=[];const adapter=Object.fromEntries(['target','pin','stopApi','stopScoped','stopGeneral','policyOff','restoreAnalysisApi','verify'].map(n=>[n,async()=>{calls.push(n);if(n===failure)throw new Error('failure');}]));
    await assert.rejects(cleanup(adapter));
    if(['stopApi','stopScoped','stopGeneral'].includes(failure)) {
      assert(calls.includes('policyOff'));assert(!calls.includes('restoreAnalysisApi'));
    } else assert.equal(calls.at(-1),failure);
  }
});
test('policy OFF uses ephemeral migration membership and restores it before commit',async()=>{
  const calls=[];const db={async query(sql,values){calls.push(sql);if(sql.includes('pg_has_role'))return {rows:[{can_set:false}]};if(sql.startsWith('update'))return {rowCount:1,rows:[{enabled:values[0]}]};return {rows:[]};}};
  assert.deepEqual(await g.policyWithTemporaryRole(db,false),{posting:false,temporaryMembershipRestored:true});
  assert(calls.indexOf('reset role')<calls.findIndex(s=>s.startsWith('revoke')));assert.equal(calls.at(-1),'commit');
});
test('enablement needs approval inside the transaction and rolls back on expiry or failed membership restoration',async()=>{
  await assert.rejects(g.policyWithTemporaryRole({query:async()=>{throw new Error('must not query');}},true),/ENABLE_APPROVAL_VALIDATOR_REQUIRED/);
  const calls=[];let validations=0;const db={async query(sql,values){calls.push(sql);if(sql.includes('pg_has_role'))return {rows:[{can_set:false}]};if(sql.startsWith('update'))return {rowCount:1,rows:[{enabled:values[0]}]};return {rows:[]};}};
  await assert.rejects(g.policyWithTemporaryRole(db,true,()=>{if(++validations===2)throw new Error('deadline expired');}));
  assert.equal(calls.at(-1),'rollback');assert(!calls.includes('commit'));assert.equal(validations,2);
  let checks=0;calls.length=0;db.query=async sql=>{calls.push(sql);if(sql.includes('pg_has_role'))return {rows:[{can_set:++checks>1}]};if(sql.startsWith('update'))return {rowCount:1,rows:[{enabled:false}]};return {rows:[]};};
  await assert.rejects(g.policyWithTemporaryRole(db,false));assert.equal(calls.at(-1),'rollback');assert(!calls.includes('commit'));
});
test('legacy media rows are only locked; exact standard media claim retains no unrelated work',async()=>{
  const s=control().sessions[0];const ref='voice/'+id+'/'+event;
  const readerCalls=[];const reader={async query(sql){readerCalls.push(sql);if(sql.includes('pg_has_role'))return {rows:[{can_set:false}]};if(sql.startsWith('select id,user_id'))return {rows:[{id,user_id:g.PIN.owner,content_hash:s.contentHash,storage_ref:ref}]};return {rows:[]};}};
  const calls=[];const worker={async query(sql){calls.push(sql);if(sql.includes('claim_voice_media_purge'))return {rows:[{id,storage_ref:ref,purge_token:token}]};return {rows:[]};}};
  assert.deepEqual(await g.claimMediaExact(reader,worker,s,()=>{}),{id,storage_ref:ref,purge_token:token});
  assert.equal(readerCalls.filter(x=>x.endsWith('for update')).length,2);
  assert(readerCalls.every(x=>!/^update|^delete|^insert/.test(x)));
  assert.equal(readerCalls.at(-1),'commit');assert.equal(calls.at(-1),'commit');
  assert.equal(calls.filter(x=>x.includes('claim_voice_media_purge')).length,1);
});
test('unexpected media ID or expired authorization rolls back the worker claim and releases protected legacy rows',async()=>{
  const s=control().sessions[0];const ref='voice/'+id+'/'+event;
  for(const fail of ['id','approval']) {
    const rc=[],wc=[];const reader={async query(sql){rc.push(sql);if(sql.includes('pg_has_role'))return {rows:[{can_set:false}]};if(sql.startsWith('select id,user_id'))return {rows:[{id,user_id:g.PIN.owner,content_hash:s.contentHash,storage_ref:ref}]};return {rows:[]};}};
    const worker={async query(sql){wc.push(sql);if(sql.includes('claim_voice_media_purge'))return {rows:[{id:fail==='id'?event:id,storage_ref:ref,purge_token:token}]};return {rows:[]};}};
    await assert.rejects(g.claimMediaExact(reader,worker,s,()=>{if(fail==='approval')throw new Error('expired');}));
    assert.equal(wc.at(-1),'rollback');assert(!wc.includes('commit'));assert.equal(rc.at(-1),'rollback');
  }
});
