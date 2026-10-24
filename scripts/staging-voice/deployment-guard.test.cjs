'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertDeploymentSafe}=require('./deployment-guard.cjs');
const now=Date.now();
const image='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:'+'a'.repeat(64);
const sha='b'.repeat(40);
const contracts={voiceSession:2,voiceBatch:3,voiceExtraction:3,voiceWorker:1,voiceConfirmation:2,assistantDirect:2,assistantProvider:1,manualReceipt:1};
const cases=Object.fromEntries(['voiceSessionCreate','voiceAnalysis','voiceFinancialIntent','voiceWorker','postingPreservation','assistantDirect','assistantProvider','manualAdd','idempotentRecovery'].map(name=>[name,'passed']));
const snapshot=()=>({project:'qcffvfbpzvpwcwxwjyro',observedAt:new Date(now).toISOString(),
  requiredApiContracts:contracts,activeEpochs:0,posting:false,monitorActive:false,financialWorkerRunning:false,
  generalWorkerRunning:false,analysisJobs:0,analysisEnabled:true,analysisOwnerMatches:true,voiceRouteAvailable:true,
  api:{image,sourceSha:sha,analysisOnly:true,running:true},
  analysisWorker:{image,sourceSha:sha,analysisOnly:true,running:true}});
const candidate=()=>({image,sourceSha:sha,services:['api'],voiceMode:'analysis',compatibility:{schemaVersion:1,image,sourceSha:sha,observedAt:new Date(now).toISOString(),contracts,cases}});
test('rejects the API replacement that would trip the active financial Voice monitor',()=>{
  assert.throws(()=>assertDeploymentSafe({...snapshot(),activeEpochs:1,posting:true,
    monitorActive:true,financialWorkerRunning:true},candidate(),now),/VOICE_FINANCIAL_RUNTIME_ACTIVE/);
});
test('rejects the closed restoration with an unrelated analysis owner',()=>{
  assert.throws(()=>assertDeploymentSafe({...snapshot(),analysisOwnerMatches:false},candidate(),now),/VOICE_ANALYSIS_OWNER_MISMATCH/);
});

test('permits an explicit authenticated analysis audience without an owner allowlist',()=>{
  assert.doesNotThrow(()=>assertDeploymentSafe({...snapshot(),analysisOwnerMatches:false,
    analysisAudience:'authenticated'}, {...candidate(),analysisAudience:'authenticated'},now));
});

test('requires an exact audience pin and does not infer universal access from an owner mismatch',()=>{
  assert.throws(()=>assertDeploymentSafe({...snapshot(),analysisOwnerMatches:true,
    analysisAudience:'authenticated'}, {...candidate(),analysisAudience:'owner'},now),/VOICE_ANALYSIS_AUDIENCE_MISMATCH/);
  assert.throws(()=>assertDeploymentSafe({...snapshot(),analysisOwnerMatches:false,
    analysisAudience:'owner'}, {...candidate(),analysisAudience:'authenticated'},now),/VOICE_ANALYSIS_AUDIENCE_MISMATCH/);
});
test('rejects API-only image drift while permitting an explicit API and analysis cohort',()=>{
  const next={...candidate(),image:image.replace(/a{64}$/,'c'.repeat(64)),sourceSha:'d'.repeat(40)};
  next.compatibility={...next.compatibility,image:next.image,sourceSha:next.sourceSha};
  assert.throws(()=>assertDeploymentSafe(snapshot(),next,now),/VOICE_ANALYSIS_COHORT_MISMATCH/);
  assert.doesNotThrow(()=>assertDeploymentSafe(snapshot(),{...next,services:['api','analysis-worker']},now));
});
test('blocks unknown, stale, production and busy snapshots without changing runtime',()=>{
  for(const change of [{project:'production'},{observedAt:new Date(now-60001).toISOString()},
    {observedAt:new Date(now+1).toISOString()},{posting:undefined},{analysisJobs:1},
    {generalWorkerRunning:true},{voiceRouteAvailable:false}])
    assert.throws(()=>assertDeploymentSafe({...snapshot(),...change},candidate(),now));
  assert.throws(()=>assertDeploymentSafe(snapshot(),{...candidate(),services:['worker']},now));
  assert.throws(()=>assertDeploymentSafe(snapshot(),{...candidate(),image:'latest'},now));
});
test('allows the verified closed and ready cohort and explicit disabled Voice scope',()=>{
  assert.doesNotThrow(()=>assertDeploymentSafe(snapshot(),candidate(),now));
  assert.doesNotThrow(()=>assertDeploymentSafe({...snapshot(),analysisOwnerMatches:false,
    analysisEnabled:false,analysisWorker:{running:false}},
    {...candidate(),voiceMode:'disabled'},now));
});

test('permits explicit analysis restoration after verified financial closure and rejects retaining a financial-mode worker',()=>{
  const closed={...snapshot(),api:{...snapshot().api,running:false,analysisOnly:false},
    analysisWorker:{...snapshot().analysisWorker,running:false,analysisOnly:false}};
  assert.doesNotThrow(()=>assertDeploymentSafe(closed,
    {...candidate(),services:['api','analysis-worker']},now));
  assert.throws(()=>assertDeploymentSafe(closed,candidate(),now),/WORKER_VOICE_MODE_MISMATCH/);
});
