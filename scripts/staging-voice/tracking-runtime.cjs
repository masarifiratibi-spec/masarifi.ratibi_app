'use strict';
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const JOBS=['import.parse','parser.corpus','tracking.confirmation.prepare'];

async function startTrackingHealth(isHealthy,port) {
  const server=createServer((request,response)=>{
    if(request.method!=='GET'||request.url!=='/health/live') {
      response.writeHead(404);response.end();return;
    }
    const healthy=isHealthy();
    response.writeHead(healthy?200:503,{'Content-Type':'application/json'});
    response.end(JSON.stringify({status:healthy?'ok':'unhealthy'}));
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',resolve);
  });
  return server;
}

function assertTrackingRuntime(env) {
  assert.equal(env.SUPABASE_URL,'https://qcffvfbpzvpwcwxwjyro.supabase.co','STAGING_REQUIRED');
  assert.equal(env.MASARIFI_PROCESS_KIND,'worker','TRACKING_WORKER_IDENTITY_REQUIRED');
  assert.match(env.MASARIFI_RELEASE_VERSION,/^[a-f0-9]{40}$/,'TRACKING_RELEASE_REQUIRED');
}
async function runTrackingPass(tracking,engagement) {
  const imports=await tracking.runJob(JOBS[0]);
  const corpus=await tracking.runJob(JOBS[1]);
  const confirmations=await engagement.runJob(JOBS[2]);
  return {imports,corpus,confirmations};
}
async function main() {
  assertTrackingRuntime(process.env);
  require('reflect-metadata');
  const {Module}=require('@nestjs/common');
  const {NestFactory}=require('@nestjs/core');
  // This file is mounted at /app/tracking-acceptance.cjs in the candidate image.
  const {PlatformConfigModule}=require('./dist/src/platform/config/platform-config.module');
  const {TrackingWorkerModule}=require('./dist/src/tracking/tracking.module');
  const {TrackingWorker}=require('./dist/src/tracking/tracking.worker');
  const {EngagementWorkerModule}=require('./dist/src/engagement/engagement.module');
  const {EngagementWorker}=require('./dist/src/engagement/engagement.worker');
  class TrackingAcceptanceRuntime {}
  Module({imports:[PlatformConfigModule,TrackingWorkerModule,EngagementWorkerModule]})(TrackingAcceptanceRuntime);
  const app=await NestFactory.createApplicationContext(TrackingAcceptanceRuntime,{logger:false,abortOnError:false});
  const tracking=app.get(TrackingWorker),engagement=app.get(EngagementWorker);
  let stopping=false,passes=0,lastSuccessfulPass=0;
  for(const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>{stopping=true;});
  console.log(JSON.stringify({event:'TRACKING_ONLY_WORKER_READY',version:process.env.MASARIFI_RELEASE_VERSION,jobs:JOBS,aiFallback:false}));
  try {
    const health=await startTrackingHealth(
      ()=>!stopping&&lastSuccessfulPass>0&&Date.now()-lastSuccessfulPass<=60000,
      Number.parseInt(process.env.MASARIFI_HTTP_PORT??'3000',10));
    try {
    while(!stopping) {
      try {
        const result=await runTrackingPass(tracking,engagement);
        lastSuccessfulPass=Date.now();
        passes+=1;
        if(Object.values(result).some(Boolean)||passes===1||passes%60===0)
          console.log(JSON.stringify({event:'TRACKING_ONLY_PASS',...result,passes,at:new Date().toISOString()}));
      } catch {console.error('TRACKING_ONLY_PASS_FAILED');}
      if(!stopping) await new Promise(resolve=>setTimeout(resolve,1000));
    }
    } finally {await new Promise(resolve=>health.close(resolve));}
  } finally {await app.close();}
}
if(require.main===module) main().catch(()=>{console.error('TRACKING_ONLY_BOOTSTRAP_FAILED');process.exitCode=1;});
module.exports={runTrackingPass,assertTrackingRuntime,startTrackingHealth};
