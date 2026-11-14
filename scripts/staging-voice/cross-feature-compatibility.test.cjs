'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deployCohort}=require('./deploy-cohort.cjs');
const {assertDeploymentSafe,assertRuntimePreserved}=require('./deployment-guard.cjs');
const now=Date.now();
const oldImage='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:'+'a'.repeat(64);
const image='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:'+'c'.repeat(64);
const sourceSha='d'.repeat(40);
const contracts={voiceSession:2,voiceBatch:3,voiceExtraction:3,voiceWorker:1,
  voiceConfirmation:2,assistantDirect:2,assistantProvider:1,manualReceipt:1};
const cases=['voiceSessionCreate','voiceAnalysis','voiceFinancialIntent','voiceWorker',
  'postingPreservation','assistantDirect','assistantProvider','manualAdd','idempotentRecovery'];
function snapshot(){return {project:'qcffvfbpzvpwcwxwjyro',observedAt:new Date(now).toISOString(),
  activeEpochs:1,posting:true,monitorActive:true,financialWorkerRunning:true,
  generalWorkerRunning:false,analysisJobs:0,analysisEnabled:false,
  api:{image:oldImage,analysisOnly:false,running:true},analysisWorker:{running:false},
  requiredApiContracts:contracts};}
function packet(){return {project:'qcffvfbpzvpwcwxwjyro',image,sourceSha,services:['api'],voiceMode:'preserve'};}
function compatibility(){return {schemaVersion:1,image,sourceSha,observedAt:new Date(now).toISOString(),
  contracts,cases:Object.fromEntries(cases.map(name=>[name,'passed']))};}

test('compatible API replacement preserves an active monitored Voice runtime',()=>{
  assert.doesNotThrow(()=>assertDeploymentSafe(snapshot(),{...packet(),compatibility:compatibility()},now));
});
test('incompatible candidate is rejected before shared API replacement',async()=>{
  const applied=[];
  await assert.rejects(deployCohort(packet(),{snapshot:async()=>snapshot(),
    compatibility:async()=>({...compatibility(),contracts:{...contracts,voiceSession:0}}),
    apply:async()=>applied.push('apply'),verify:async()=>{}}),/COMPATIBILITY/);
  assert.deepEqual(applied,[]);
});
test('preservation cannot replace workers or change financial API admission mode',()=>{
  assert.throws(()=>assertDeploymentSafe(snapshot(),{...packet(),services:['api','analysis-worker'],
    compatibility:compatibility()},now),/PRESERVATION_SCOPE/);
  assert.throws(()=>assertDeploymentSafe(snapshot(),{...packet(),apiAnalysisOnly:true,
    compatibility:compatibility()},now),/ADMISSION/);
});
test('missing, stale, foreign-image or incomplete behavioral evidence blocks preservation',()=>{
  for(const changed of [undefined,{...compatibility(),image:oldImage},
    {...compatibility(),observedAt:new Date(now-300001).toISOString()},
    {...compatibility(),cases:{...compatibility().cases,manualAdd:'failed'}},
    {...compatibility(),cases:{...compatibility().cases,assistantProvider:'skipped'}}]) {
    assert.throws(()=>assertDeploymentSafe(snapshot(),{...packet(),compatibility:changed},now),/COMPATIBILITY/);
  }
});

test('verification rejects any Posting, epoch, monitor or worker identity change',()=>{
  const before={...snapshot(),activeEpochIds:['epoch'],aiRoutes:[{workload:'financial_assistant',enabled:false,version:3}],analysisWorker:{id:'analysis',image:oldImage,running:false,analysisOnly:true},
    financialWorker:{id:'voice',image:oldImage,running:true},generalWorker:{id:'general',image:oldImage,running:false}};
  const after={...before,api:{...before.api,image,sourceSha}};
  assert.doesNotThrow(()=>assertRuntimePreserved(before,after));
  for(const patch of [{posting:false},{activeEpochIds:['replacement']},{monitorActive:false},
    {analysisWorker:{...before.analysisWorker,id:'replacement'}},
    {financialWorker:{...before.financialWorker,running:false}},
    {generalWorker:{...before.generalWorker,running:true}},
    {api:{...after.api,analysisOnly:true}}])
    assert.throws(()=>assertRuntimePreserved(before,{...after,...patch}),/PRESERVATION/);
});

test('explicit analysis cohort replacement preserves unrelated financial state and provider routes',()=>{
  const before={...snapshot(),posting:false,activeEpochs:0,activeEpochIds:[],monitorActive:false,
    api:{analysisOnly:true},aiRoutes:[{workload:'financial_assistant',enabled:false,version:3}],
    analysisWorker:{id:'analysis',image:oldImage,running:true,analysisOnly:true},
    financialWorker:{id:'voice',image:oldImage,running:false},generalWorker:{id:'general',image:oldImage,running:false}};
  const after={...before,analysisWorker:{...before.analysisWorker,id:'new-analysis',image}};
  const scope={services:['api','analysis-worker'],voiceMode:'analysis'};
  assert.doesNotThrow(()=>assertRuntimePreserved(before,after,scope));
  assert.doesNotThrow(()=>assertRuntimePreserved({...before,
    api:{analysisOnly:false},analysisWorker:{...before.analysisWorker,running:false,analysisOnly:false}},
    after,scope));
  for(const patch of [{posting:true},
    {aiRoutes:[{workload:'financial_assistant',enabled:true,version:4}]},
    {financialWorker:{...before.financialWorker,id:'new-voice'}},
    {analysisWorker:{...after.analysisWorker,analysisOnly:false}},
    {generalWorker:{...before.generalWorker,running:true}}])
    assert.throws(()=>assertRuntimePreserved(before,{...after,...patch},scope),/PRESERVATION/);
});

test('closed financial admission still requires cross-feature candidate proof before a cohort deployment',()=>{
  const closed={...snapshot(),activeEpochs:0,posting:false,monitorActive:false,financialWorkerRunning:false,
    analysisEnabled:true,analysisOwnerMatches:true,voiceRouteAvailable:true};
  assert.throws(()=>assertDeploymentSafe(closed,{...packet(),voiceMode:'analysis',services:['api','analysis-worker']},now),/COMPATIBILITY/);
});
