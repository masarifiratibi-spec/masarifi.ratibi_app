'use strict';
const {createRequire}=require('node:module'),{createHash}=require('node:crypto');
const load=createRequire('/app/dist/src/main.js'),assert=require('node:assert/strict');
const input=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
load('reflect-metadata');
const environment=load('./platform/config/environment.schema.js').validateEnvironment({...process.env});
const config={get:key=>environment[key],getRequired:key=>{if(environment[key]===undefined)throw Error('FIXTURE_CONFIG_MISSING');return environment[key];}};
const pool=new (load('./platform/database/pool.service.js').PoolService)(config);
const {PlatformLogger}=load('./platform/observability/platform-logger.js');
let commands;
async function main(){
 if(input.phase==='sync'){
  const repository=new (load('./sync/sync.repository.js').SyncRepository)(pool);
  commands=new (load('./sync/sync-command.runtime.js').SyncCommandRuntime)(config);
  const original=repository.claimMutations.bind(repository);
  repository.claimMutations=async(...args)=>{const claims=await original(...args);assert.equal(claims.length,1);assert.equal(claims[0].mutation.operationId,input.finance.mutationOperationId);return claims;};
  const worker=new (load('./sync/sync.worker.js').SyncWorker)(repository,commands,config,commands);
  assert.equal(await worker.runJob('sync-mutations.retry'),1);
 }else if(input.phase==='reports'){
  const repository=new (load('./reports/reports.repository.js').ReportsRepository)(pool,config);
  const storage=new (load('./reports/reports.storage.js').ReportsStorage)(config);
  const worker=new (load('./reports/reports.worker.js').ReportsWorker)(repository,storage,config);
  assert.equal(await repository.withWorkLock('report.generate',input.features.reportId,claim=>worker.generate(claim)),true);
 }else if(input.phase==='assistant'){
  const jobs=new (load('./ai/assistant-agent.repository.js').AssistantAgentRepository)(pool);
  const routes=new (load('./ai/ai.repository.js').AiRepository)(pool);
  const data=new (load('./ai/assistant-agent-data.js').AssistantAgentData)(pool);
  let claimed=0;
  for(const name of ['claim','claimNext']){
   const original=jobs[name].bind(jobs);jobs[name]=async(...args)=>{const claim=await original(...args);assert.equal(claim?.id,input.features.assistantMessageId);claimed++;return claim;};
  }
  const worker=new (load('./ai/assistant-agent.worker.js').AssistantAgentWorker)(jobs,data,routes,config);
  worker.observeHealth(()=>{});await worker.runOnce();assert.equal(claimed,1);
 }else if(input.phase==='voice'){
  const repository=new (load('./ai/ai.repository.js').AiRepository)(pool);
  const storage=new (load('./ai/ai.storage.js').AiStorage)(config);
  const gateway=new (load('./ai/ai.gateway.js').AiGateway)({apiKey:config.get('OPENROUTER_API_KEY'),onAttempt:fields=>new PlatformLogger().info('AI_PROVIDER_ATTEMPT',{...fields,requestId:input.features.voiceSessionId,jobName:'voice.transcribe_extract'})});
  const worker=new (load('./ai/ai.worker.js').AiWorker)(repository,storage,gateway,config);worker.observeHealth(()=>{});
  const args=['selfhost-fixture-worker',1,config.getRequired('MASARIFI_AI_LEASE_SECONDS')];
  const claims=config.get('MASARIFI_VOICE_ANALYSIS_ONLY')?await repository.claimAnalysisWork(...args):await repository.claimWork('voice.transcribe_extract',...args);
  assert.equal(claims.length,1);assert.equal(claims[0].id,input.features.voiceSessionId);
  assert.equal(await worker.processVoiceClaim(claims[0]),true,'VOICE_FIXTURE_PROCESS_FAILED');
 }else throw Error('UNKNOWN_FIXTURE_PHASE');
 process.stdout.write(JSON.stringify({probe:'functional-worker',state:'passed',phase:input.phase,onlyFixtureClaimed:true})+'\n');
}
main().catch(error=>{const message=String(error?.message??'unknown');process.stdout.write(JSON.stringify({probe:'functional-worker',state:'failed',phase:input.phase,...(/^[A-Z0-9_]{3,80}$/.test(message)?{code:message}:{}),errorHash:createHash('sha256').update(message).digest('hex')})+'\n');process.exitCode=1;}).finally(async()=>{await commands?.onModuleDestroy();await pool.onModuleDestroy();});
