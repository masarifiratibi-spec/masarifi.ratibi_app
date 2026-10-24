'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const g = require('./canary-guards.cjs');
const root='/app/dist/src'; const load=createRequire(path.join(root,'ai/ai.worker.js'));
async function main() {
  g.environment(process.env,'worker');
  const bytes=fs.readFileSync(process.argv[3]); assert(bytes.length<=32768);
  assert.equal(process.env.VOICE_CANARY_CONTROL_HASH,g.hash(bytes),'CONTROL_FILE_NOT_PINNED');
  const manifest=JSON.parse(bytes); g.approval(manifest);
  const session=g.exactSession(manifest,process.argv[4]);
  const {ConfigService}=load('@nestjs/config');
  const {validateEnvironment}=load(path.join(root,'platform/config/environment.schema.js'));
  const {PlatformConfigService}=load(path.join(root,'platform/config/platform-config.service.js'));
  const {PoolService}=load(path.join(root,'platform/database/pool.service.js'));
  const {AiRepository}=load(path.join(root,'ai/ai.repository.js'));
  const {AiStorage}=load(path.join(root,'ai/ai.storage.js'));
  const {AiGateway}=load(path.join(root,'ai/ai.gateway.js'));
  const {AiWorker}=load(path.join(root,'ai/ai.worker.js'));
  const config=new PlatformConfigService(new ConfigService(validateEnvironment(process.env)));
  const pool=new PoolService(config); const repository=new AiRepository(pool);
  const storage=new AiStorage(config); const gateway=new AiGateway({apiKey:config.get('OPENROUTER_API_KEY')});
  const worker=new AiWorker(repository,storage,gateway,config);
  assert.equal(typeof worker.process,'function','COMPILED_PROCESS_CAPABILITY_MISSING');
  const controller=new AbortController(); worker.abortController=controller;
  const abort=()=>controller.abort(); process.once('SIGTERM',abort); process.once('SIGINT',abort);
  const timer=setTimeout(abort,Math.min(180000,Date.parse(manifest.deadline)-Date.now()));
  try {
    if(process.argv[2]==='process') {
      const claim=await pool.withClient(c=>g.claimExact(c,session));
      g.approval(manifest);
      // This invokes the unchanged compiled processing/error/renewal path once. No timer/start/runOnce.
      await worker.process(claim);
      controller.signal.throwIfAborted();
      console.log(JSON.stringify({stage:'processed-once',sessionId:session.id,financialFinalization:false,requireAcceptedBatchInspection:true}));
    } else if(process.argv[2]==='media-claimed') {
      const claimBytes=fs.readFileSync(process.argv[5]);assert(claimBytes.length<=4096);
      assert.equal(g.hash(claimBytes),process.env.VOICE_CANARY_MEDIA_CLAIM_HASH,'MEDIA_CLAIM_NOT_PINNED');
      const claim=JSON.parse(claimBytes);assert.equal(claim.id,session.id);
      assert.match(claim.storage_ref,new RegExp('^voice/'+session.id+'/[0-9a-f-]{36}$'));g.uuid(claim.purge_token);
      let deleted=false;
      try { g.approval(manifest); await storage.delete(claim.storage_ref); deleted=true; }
      finally { assert.equal(await repository.completePurge(claim.id,claim.purge_token,deleted),true,'MEDIA_COMPLETION_FENCE_REJECTED'); }
      console.log(JSON.stringify({stage:'media-delete-receipt',sessionId:session.id,deleted,tombstoneRetention:'normal-capability-lifecycle'}));
    } else throw new Error('UNKNOWN_CONTROL_MODE');
  } finally {clearTimeout(timer);process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort);await worker.stop();await pool.onModuleDestroy();}
}
main().catch(e=>{console.error(e.code || (e.name==='AssertionError'?'CANARY_GUARD_REJECTED':e.message));process.exitCode=1;});
