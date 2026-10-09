'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runTrackingPass,assertTrackingRuntime,startTrackingHealth}=require('./tracking-runtime.cjs');

test('Staging tracking runtime runs only intake, corpus and scoped confirmation preparation',async()=>{
  const observed=[];
  const result=await runTrackingPass({runJob:async job=>{observed.push(job);return 1;}},
    {runJob:async job=>{observed.push(job);return 2;}});
  assert.deepEqual(observed,['import.parse','parser.corpus','tracking.confirmation.prepare']);
  assert.deepEqual(result,{imports:1,corpus:1,confirmations:2});
});
test('runtime rejects non-Staging environment or a non-worker identity',()=>{
  const env={SUPABASE_URL:'https://qcffvfbpzvpwcwxwjyro.supabase.co',MASARIFI_PROCESS_KIND:'worker',MASARIFI_RELEASE_VERSION:'a'.repeat(40)};
  assert.doesNotThrow(()=>assertTrackingRuntime(env));
  assert.throws(()=>assertTrackingRuntime({...env,SUPABASE_URL:'https://production.supabase.co'}));
  assert.throws(()=>assertTrackingRuntime({...env,MASARIFI_PROCESS_KIND:'api'}));
});

test('worker HTTP probe reports completed processing health, fails closed, and exposes no capture data',async()=>{
  let healthy=false;
  const server=await startTrackingHealth(()=>healthy,0);
  try {
    const address=server.address();
    assert.equal(address.address,'127.0.0.1');
    const url=`http://127.0.0.1:${address.port}`;
    const notStarted=await fetch(url+'/health/live');
    assert.equal(notStarted.status,503);
    assert.deepEqual(await notStarted.json(),{status:'unhealthy'});
    healthy=true;
    const completed=await fetch(url+'/health/live');
    assert.equal(completed.status,200);
    assert.deepEqual(await completed.json(),{status:'ok'});
    healthy=false;
    assert.equal((await fetch(url+'/health/live')).status,503);
    assert.equal((await fetch(url+'/captures')).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
