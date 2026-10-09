'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const PROJECT = 'qcffvfbpzvpwcwxwjyro';
const REQUIRED_CASES = ['voiceSessionCreate','voiceAnalysis','voiceFinancialIntent','voiceWorker',
  'postingPreservation','assistantDirect','assistantProvider','manualAdd','idempotentRecovery'];

function assertCompatibility(snapshot,candidate,now) {
  const evidence=candidate.compatibility;
  assert(evidence?.schemaVersion===1,'CANDIDATE_COMPATIBILITY_REQUIRED');
  assert(evidence.image===candidate.image && evidence.sourceSha===candidate.sourceSha,
    'CANDIDATE_COMPATIBILITY_ARTIFACT_MISMATCH');
  const at=Date.parse(evidence.observedAt);
  assert(Number.isFinite(at) && now>=at && now-at<=300000,'CANDIDATE_COMPATIBILITY_STALE');
  assert(snapshot.requiredApiContracts && Object.keys(snapshot.requiredApiContracts).length>0,
    'RUNTIME_COMPATIBILITY_EXPECTATIONS_REQUIRED');
  for(const [name,version] of Object.entries(snapshot.requiredApiContracts))
    assert(Number.isInteger(version) && evidence.contracts?.[name]===version,
      'CANDIDATE_COMPATIBILITY_CONTRACT_MISMATCH');
  for(const name of REQUIRED_CASES)
    assert(evidence.cases?.[name]==='passed','CANDIDATE_COMPATIBILITY_BEHAVIOR_UNVERIFIED:'+name);
}

function assertDeploymentSafe(snapshot, candidate, now = Date.now()) {
  assert.equal(snapshot.project, PROJECT, 'STAGING_REQUIRED');
  const observed = Date.parse(snapshot.observedAt);
  assert(Number.isFinite(observed) && now >= observed && now-observed <= 60000,
    'FRESH_RUNTIME_SNAPSHOT_REQUIRED');
  assert.match(candidate.sourceSha, /^[a-f0-9]{40}$/);
  assert.match(candidate.image, /^ghcr\.io\/masarifiratibi-spec\/masarifi-backend@sha256:[a-f0-9]{64}$/);
  if(candidate.voiceMode==='preserve') {
    assert.deepEqual(candidate.services,['api'],'VOICE_PRESERVATION_SCOPE_INVALID');
    assertCompatibility(snapshot,candidate,now);
    assert.equal(snapshot.generalWorkerRunning,false,'GENERAL_WORKER_MUST_REMAIN_STOPPED');
    assert(snapshot.api?.running===true && typeof snapshot.api.analysisOnly==='boolean',
      'VOICE_ADMISSION_UNKNOWN');
    assert.equal(candidate.apiAnalysisOnly ?? snapshot.api.analysisOnly,snapshot.api.analysisOnly,
      'VOICE_ADMISSION_CHANGE_FORBIDDEN');
    assert(typeof snapshot.posting==='boolean' && Number.isInteger(snapshot.activeEpochs),
      'VOICE_RUNTIME_EXPECTATIONS_UNKNOWN');
    if(snapshot.activeEpochs>0) {
      assert(snapshot.activeEpochs===1 && snapshot.posting===true && snapshot.monitorActive===true &&
        snapshot.financialWorkerRunning===true,'VOICE_MONITORED_RUNTIME_REQUIRED');
    } else {
      assert(snapshot.posting===false && snapshot.financialWorkerRunning===false,
        'VOICE_FINANCIAL_RUNTIME_INCONSISTENT');
    }
    return;
  }
  assert(snapshot.activeEpochs === 0 && snapshot.posting === false &&
    snapshot.monitorActive === false && snapshot.financialWorkerRunning === false,
    'VOICE_FINANCIAL_RUNTIME_ACTIVE');
  assert.equal(snapshot.generalWorkerRunning, false, 'GENERAL_WORKER_MUST_REMAIN_STOPPED');
  assert.equal(snapshot.analysisJobs, 0, 'VOICE_ANALYSIS_JOBS_PENDING');
  assert(Array.isArray(candidate.services) && candidate.services.includes('api') &&
    new Set(candidate.services).size === candidate.services.length &&
    candidate.services.every(service => ['api','analysis-worker'].includes(service)),
    'DEPLOYMENT_SERVICE_SCOPE_INVALID');
  assert(['analysis','disabled'].includes(candidate.voiceMode), 'VOICE_SCOPE_REQUIRED');
  if (candidate.voiceMode === 'disabled') {
    assert.equal(snapshot.analysisEnabled, false, 'VOICE_ANALYSIS_STILL_ENABLED');
    assert.equal(snapshot.analysisWorker?.running, false, 'VOICE_ANALYSIS_WORKER_STILL_RUNNING');
    assertCompatibility(snapshot,candidate,now);
    return;
  }
  assert.equal(snapshot.analysisEnabled, true, 'VOICE_ANALYSIS_NOT_ENABLED');
  assert.equal(snapshot.analysisOwnerMatches, true, 'VOICE_ANALYSIS_OWNER_MISMATCH');
  assert.equal(snapshot.voiceRouteAvailable, true, 'VOICE_ROUTE_UNAVAILABLE');
  if (!candidate.services.includes('analysis-worker')) {
    assert.equal(snapshot.analysisWorker?.analysisOnly, true, 'WORKER_VOICE_MODE_MISMATCH');
    assert(snapshot.analysisWorker.running === true &&
      snapshot.analysisWorker.image === candidate.image &&
      snapshot.analysisWorker.sourceSha === candidate.sourceSha,
      'VOICE_ANALYSIS_COHORT_MISMATCH');
  }
  assertCompatibility(snapshot,candidate,now);
}

function assertRuntimePreserved(before,after,scope={services:['api'],voiceMode:'preserve'}) {
  const {services,voiceMode}=scope;
  assert(Array.isArray(services) && services.includes('api') &&
    services.every(service=>['api','analysis-worker'].includes(service)),'RUNTIME_PRESERVATION_SERVICE_SCOPE');
  assert.equal(after.project,before.project,'RUNTIME_PRESERVATION_PROJECT');
  for(const field of ['posting','activeEpochs','monitorActive','analysisEnabled','analysisOwnerMatches','voiceRouteAvailable'])
    assert.deepEqual(after[field],before[field],'RUNTIME_PRESERVATION_'+field);
  assert(Array.isArray(before.activeEpochIds) && Array.isArray(after.activeEpochIds),'RUNTIME_PRESERVATION_EPOCH_EVIDENCE');
  assert.deepEqual([...after.activeEpochIds].sort(),[...before.activeEpochIds].sort(),'RUNTIME_PRESERVATION_EPOCH');
  assert(Array.isArray(before.aiRoutes) && Array.isArray(after.aiRoutes),'RUNTIME_PRESERVATION_ROUTE_EVIDENCE');
  assert.deepEqual(after.aiRoutes,before.aiRoutes,'RUNTIME_PRESERVATION_PROVIDER_ROUTES');
  for(const field of ['analysisWorker','financialWorker','generalWorker']) {
    const old=before[field],current=after[field];
    assert(old?.id && old.image && typeof old.running==='boolean' && current,
      'RUNTIME_PRESERVATION_WORKER_EVIDENCE');
    const replaced=field==='analysisWorker' && services.includes('analysis-worker');
    if(replaced && voiceMode==='analysis') {
      assert(current.running===true && current.analysisOnly===true,'RUNTIME_PRESERVATION_ANALYSIS_SCOPE');
    }
    const keys=replaced ? (voiceMode==='analysis'?[]:['running','analysisOnly'])
      : ['id','image','running','analysisOnly'];
    for(const key of keys)
      assert.deepEqual(current[key],old[key],'RUNTIME_PRESERVATION_'+field+'_'+key);
  }
  assert.equal(after.api?.analysisOnly,voiceMode==='analysis'?true:before.api?.analysisOnly,
    'RUNTIME_PRESERVATION_ADMISSION');
}

if (require.main === module) {
  try {
    const snapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const candidate = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    assertDeploymentSafe(snapshot,candidate);
    console.log('STAGING_DEPLOYMENT_PREFLIGHT_PASSED');
  } catch(error) {
    console.error(error instanceof assert.AssertionError ? error.message : 'PREFLIGHT_INPUT_INVALID');
    process.exitCode=1;
  }
}
module.exports={assertDeploymentSafe,assertRuntimePreserved};
