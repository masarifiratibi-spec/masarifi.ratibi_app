'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runTrackingPass,assertTrackingRuntime}=require('./tracking-runtime.cjs');

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
