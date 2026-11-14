'use strict';
// Read-only probe: no claims, inference, API configuration, policy or financial writes.
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
const g=require('./canary-guards.cjs');
const root='/app/dist/src';const load=createRequire(path.join(root,'ai/ai.worker.js'));
async function main(){
  g.environment(process.env,'worker');
  const {ConfigService}=load('@nestjs/config');
  const {validateEnvironment}=load(path.join(root,'platform/config/environment.schema.js'));
  const {PlatformConfigService}=load(path.join(root,'platform/config/platform-config.service.js'));
  const {PoolService}=load(path.join(root,'platform/database/pool.service.js'));
  const {AiRepository}=load(path.join(root,'ai/ai.repository.js'));
  const {AiStorage}=load(path.join(root,'ai/ai.storage.js'));
  const {AiGateway}=load(path.join(root,'ai/ai.gateway.js'));
  const {AiWorker}=load(path.join(root,'ai/ai.worker.js'));
  const config=new PlatformConfigService(new ConfigService(validateEnvironment(process.env)));
  const pool=new PoolService(config);const repository=new AiRepository(pool);
  const worker=new AiWorker(repository,new AiStorage(config),new AiGateway({apiKey:config.get('OPENROUTER_API_KEY')}),config);
  try{
    assert.equal(typeof worker.process,'function');assert.equal(typeof worker.voice,'function');assert.equal(worker.timer,undefined);
    await pool.withClient(async c=>{
      await c.query('begin read only');const r=(await c.query('select current_role role')).rows[0];assert.equal(r.role,'masarifi_worker');
      const signatures=['private.claim_ai_work(text,text,integer,integer)','private.get_ai_work_input(text,uuid,uuid)','private.claim_voice_finalization(integer)',
        'private.list_voice_finalization_events(uuid,uuid)','private.execute_voice_event(uuid,uuid,uuid)',
        'private.claim_voice_media_purge(text,integer,integer)','private.complete_voice_media_purge(uuid,uuid,boolean,text)'];
      for(const signature of signatures)assert.equal((await c.query("select has_function_privilege(current_role,$1,'EXECUTE') allowed",[signature])).rows[0].allowed,true,'WORKER_CAPABILITY_UNAVAILABLE');
      await c.query('rollback');
    });
    console.log(JSON.stringify({compiledCandidate:g.PIN.sha,oneShotProcessAvailable:true,workerRoleVerified:true,workerTimerStarted:false,providerDispatches:0,financialWrites:0}));
  }finally{await worker.stop();await pool.onModuleDestroy();}
}
main().catch(e=>{console.error(e.code||(e.name==='AssertionError'?'READONLY_PREFLIGHT_REJECTED':e.message));process.exitCode=1;});
