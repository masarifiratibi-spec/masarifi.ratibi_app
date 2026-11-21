const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('./visibility-fixture.cjs');
const root = 'https://api.example.invalid/api/v1';
function make(assertOwner = () => {}, wait = async()=>{}) {
  const calls = [];
  const original = async (url, init) => { calls.push({url,init}); return new Response(JSON.stringify({items:[{id:'10000000-0000-4000-8000-000000000001',isDefault:true,status:'active',currency:'SAR'}]})); };
  return { fixture:createFixture(original,assertOwner,()=>{},wait), calls };
}
test('blocks every financial mutation and voice upload/process with no original dispatch',async()=>{
  const {fixture,calls}=make();
  for(const path of ['/transactions','/transfers','/accounts','/categories','/voice/sessions','/voice/sessions/x/audio','/voice/sessions/x/process','/sync/mutations','/conflicts/x','/planning/goals','/devices','/unknown-write-path'])
    for(const method of ['POST','PUT','PATCH','DELETE']) await assert.rejects(fixture.request(root+path,{method}),/WRITES_DISABLED/);
  assert.equal(calls.length,0);
  await assert.rejects(fixture.request(new Request(root+'/sync/mutations',{method:'POST',body:'{}'})),/WRITES_DISABLED/);
  assert.equal(calls.length,0);
});
test('rejects a different owner before any fixture or network response',async()=>{
  const {fixture,calls}=make(()=>{throw new Error('OWNER_MISMATCH');});
  await assert.rejects(fixture.request(root+'/transactions'),/OWNER_MISMATCH/); assert.equal(calls.length,0);
});
test('serves a virtual committed receipt plus labelled row without persistence or provider calls',async()=>{
  let release;
  const oldWait = new Promise(resolve=>{release=resolve;});
  const {fixture,calls}=make(()=>{},ms=>ms===2500?oldWait:Promise.resolve());
  await fixture.request(root+'/accounts');
  const oldRead=fixture.request(root+'/transactions?limit=100');
  let oldSettled=false; oldRead.then(()=>{oldSettled=true;});
  const receipt=await (await fixture.request(root+'/voice/batches/recovery')).json();
  assert.equal(oldSettled,false,'receipt must precede the old pre-commit read');
  const page=await(await fixture.request(root+'/transactions?limit=100')).json();
  release();
  assert.equal((await (await oldRead).json()).items.length,0);
  assert.equal(receipt.items[0].transactionIds[0],page.items[0].id);
  assert.equal(page.items[0].title,'DIAGNOSTIC - not saved');
  assert.equal(page.items[0].sourceAccountId,'10000000-0000-4000-8000-000000000001');
  assert.equal(calls.length,1); assert.equal(calls[0].url,root+'/accounts');
});

test('never forwards foreign-origin or unknown reads to the injected account reader',async()=>{
 const {fixture,calls}=make();
 await assert.rejects(fixture.request('https://foreign.example.invalid/api/v1/accounts'),/NETWORK_DISABLED/);
 await assert.rejects(fixture.request(root+'/unknown'),/UNKNOWN_READ/);
 assert.equal(calls.length,0);
});
