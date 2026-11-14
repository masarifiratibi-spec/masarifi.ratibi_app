'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deployCohort,waitApiReady}=require('./deploy-cohort.cjs');
const image='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:'+'a'.repeat(64);
const packet={project:'qcffvfbpzvpwcwxwjyro',sourceSha:'b'.repeat(40),image,
  services:['api','analysis-worker'],voiceMode:'analysis'};
const contracts={voiceSession:2,voiceBatch:3,voiceExtraction:3,voiceWorker:1,voiceConfirmation:2,assistantDirect:2,assistantProvider:1,manualReceipt:1};
const compatibility=async()=>({schemaVersion:1,image,sourceSha:packet.sourceSha,observedAt:new Date().toISOString(),contracts,
  cases:Object.fromEntries(['voiceSessionCreate','voiceAnalysis','voiceFinancialIntent','voiceWorker','postingPreservation','assistantDirect','assistantProvider','manualAdd','idempotentRecovery'].map(name=>[name,'passed']))});
function ready(){return {project:packet.project,observedAt:new Date().toISOString(),
  requiredApiContracts:contracts,
  posting:false,activeEpochs:0,monitorActive:false,financialWorkerRunning:false,
  generalWorkerRunning:false,analysisJobs:0,analysisEnabled:true,analysisOwnerMatches:true,
  voiceRouteAvailable:true,api:{running:true,analysisOnly:true},analysisWorker:{running:true,analysisOnly:true}};}
test('fresh live preflight blocks a deployment while a financial epoch is active',async()=>{
  const calls=[];
  await assert.rejects(deployCohort(packet,{snapshot:async()=>({...ready(),activeEpochs:1}),
    compatibility,apply:async()=>calls.push('apply'),verify:async()=>calls.push('verify')}),/VOICE_FINANCIAL_RUNTIME_ACTIVE/);
  assert.deepEqual(calls,[]);
});
test('checks live state before application and verifies the explicit cohort afterwards',async()=>{
  const calls=[];
  await deployCohort(packet,{snapshot:async()=>{calls.push('snapshot');return ready();},
    compatibility,
    apply:async p=>{calls.push('apply');assert.deepEqual(p.services,['api','analysis-worker']);},
    verify:async p=>{calls.push('verify');assert.equal(p.image,image);}});
  assert.deepEqual(calls,['snapshot','snapshot','apply','verify']);
});
test('propagates a failed postdeployment readiness check instead of claiming success',async()=>{
  await assert.rejects(deployCohort(packet,{snapshot:async()=>ready(),compatibility,apply:async()=>{},
    verify:async()=>{throw Error('VOICE_ADMISSION_UNAVAILABLE');}}),/VOICE_ADMISSION_UNAVAILABLE/);
});
test('startup connection reset and ready HTTP with starting container do not prematurely finish deployment',async()=>{
  let probes=0;const waits=[];
  await waitApiReady(async()=>{
    probes+=1;
    if(probes===1)throw Error('CONNECTION_RESET');
    return {ready:{status:'ready'},api:{running:true,health:probes===2?'starting':'healthy'}};
  },async ms=>waits.push(ms),3);
  assert.equal(probes,3);assert.deepEqual(waits,[1000,1000]);
});
test('a persistently unhealthy container cannot pass even when the ready endpoint returns HTTP 200',async()=>{
  let probes=0;
  await assert.rejects(waitApiReady(async()=>{
    probes+=1;return {ready:{status:'ready'},api:{running:true,health:'unhealthy'}};
  },async()=>{},3),/API_READINESS_UNCONFIRMED/);
  assert.equal(probes,3);
});
