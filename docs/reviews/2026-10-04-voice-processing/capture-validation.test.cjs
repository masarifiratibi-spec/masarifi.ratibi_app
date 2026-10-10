'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const helper=require('./capture-validation.cjs');
const now=Date.parse('2026-10-05T06:05:00Z');
const prepared={candidate:'1'.repeat(40),purpose:'accuracy',carrierApkSha256:'carrier',cashAccountId:'cash',cardAccountId:'card',categoryIds:{breakfast:['food'],taxi:'taxi',household:'house',salary:'salary'},deviceTimezone:'Asia/Riyadh',deviceTimezoneVerified:true,workerPausedVerified:true,windowOpenedAt:new Date(now-20*60000).toISOString()};
const capture={id:'22222222-2222-4222-8222-222222222222',capture_at:new Date(now-3*60000).toISOString(),expires_at:new Date(now+86400000).toISOString()};
const revalidated={...prepared,windowOpenedAt:new Date(now-1000).toISOString()};
const expectedHash=createHash('sha256').update(capture.id).digest('hex');
const invoke=(patch={})=>helper.validateConfirmedCapture({prepared,revalidated,capture,expectedHash,expectedCandidate:prepared.candidate,now,...patch});
test('exact fresh confirmed capture can be bound after references are revalidated without changing its original window',()=>{
 assert.equal(typeof helper.validateConfirmedCapture,'function');
 invoke();assert.equal(prepared.windowOpenedAt,new Date(now-20*60000).toISOString());
});
test('confirmed recovery rejects different capture identity and changed references',()=>{
 for(const patch of [{expectedHash:'b'.repeat(64)},{expectedHash:'bad'},{revalidated:{...revalidated,cardAccountId:'different'}},{revalidated:{...revalidated,categoryIds:{...revalidated.categoryIds,taxi:'different'}}},{revalidated:{...revalidated,candidate:'different'}}]) assert.throws(()=>invoke(patch));
});
test('confirmed recovery rejects stale or future reference checks and old capture preparation',()=>{
 for(const patch of [{revalidated:{...revalidated,windowOpenedAt:new Date(now-120001).toISOString()}},{revalidated:{...revalidated,windowOpenedAt:new Date(now+1).toISOString()}},{prepared:{...prepared,windowOpenedAt:new Date(now-3600001).toISOString()}}]) assert.throws(()=>invoke(patch));
});
test('confirmed recovery rejects capture before preparation, future capture and insufficient expiry',()=>{
 for(const patch of [{capture:{...capture,capture_at:new Date(now-21*60000).toISOString()}},{capture:{...capture,capture_at:new Date(now+1).toISOString()}},{capture:{...capture,expires_at:new Date(now+180000).toISOString()}},{capture:{...capture,capture_at:'invalid'}}]) assert.throws(()=>invoke(patch));
});
test('cancel-only captures cannot use confirmed accuracy admission',()=>{
 assert.throws(()=>invoke({prepared:{...prepared,purpose:'cancel-only'},revalidated:{...revalidated,purpose:'cancel-only'}}));
});
test('explicit ten-event phase keeps exact-hash fresh-reference recovery constraints',()=>{
 const phase={...prepared,purpose:'ten-events'},checked={...revalidated,purpose:'ten-events'};
 invoke({prepared:phase,revalidated:checked});
 assert.throws(()=>invoke({prepared:phase,revalidated:{...checked,windowOpenedAt:new Date(now-120001).toISOString()}}),/REFERENCE_REVALIDATION_REQUIRED/);
});

test('equal unverified flags cannot pass evidence consistency checks',()=>{
 for(const flag of ['deviceTimezoneVerified','workerPausedVerified'])
  assert.throws(()=>invoke({prepared:{...prepared,[flag]:false},revalidated:{...revalidated,[flag]:false}}));
});
