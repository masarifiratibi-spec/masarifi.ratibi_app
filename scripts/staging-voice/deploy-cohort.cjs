'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const {assertDeploymentSafe,assertRuntimePreserved}=require('./deployment-guard.cjs');
const PROJECT='qcffvfbpzvpwcwxwjyro';
async function deployCohort(packet, boundaries) {
  assert.equal(packet.project,PROJECT,'STAGING_REQUIRED');
  let snapshot=await boundaries.snapshot();
  {
    assert.equal(typeof boundaries.compatibility,'function','CANDIDATE_COMPATIBILITY_PROBE_REQUIRED');
    packet={...packet,compatibility:await boundaries.compatibility(packet)};
    // Compatibility probes can take time; use fresh runtime state immediately
    // before replacement rather than trusting the earlier observation.
    snapshot=await boundaries.snapshot();
  }
  assertDeploymentSafe(snapshot,packet);
  await boundaries.apply(packet);
  await boundaries.verify(packet,snapshot);
}

async function waitApiReady(probe,delay,attempts=15) {
  for(let attempt=0;attempt<attempts;attempt+=1) {
    try {
      const state=await probe();
      if(state.ready?.status==='ready' && state.api?.running===true && state.api.health==='healthy') return;
    } catch {
      // Startup resets/refusals are transient; bounded retry never changes runtime.
    }
    if(attempt+1<attempts) await delay(1000);
  }
  const failure=new Error('API_READINESS_UNCONFIRMED');
  failure.code='API_READINESS_UNCONFIRMED';
  throw failure;
}

function command(name,args,options={}) {
  try {
    return execFileSync(name,args,{encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
      stdio:['pipe','pipe','pipe'],...options}).trim();
  } catch(error) {
    const safe=new Error('COHORT_COMMAND_FAILED');
    const dbCode=String(error.stderr??'').match(/READINESS_DATABASE_([A-Z0-9]{5})\b/)?.[1];
    safe.code=`COHORT_${name.toUpperCase()}_${args[0].toUpperCase()}_FAILED_${dbCode??error.status??'TIMEOUT'}`;
    throw safe;
  }
}
function container(name) {
  const item=JSON.parse(command('docker',['inspect',`masarifi-staging-${name}-1`]))[0];
  assert.equal(item.Config.Labels['com.docker.compose.project'],'masarifi-staging');
  assert.equal(item.Config.Labels['com.docker.compose.service'],name);
  assert.equal(item.HostConfig.NetworkMode,'masarifi-staging_backend');
  const env=Object.fromEntries(item.Config.Env.map(value=>{const i=value.indexOf('=');return [value.slice(0,i),value.slice(i+1)];}));
  assert.equal(env.SUPABASE_URL,`https://${PROJECT}.supabase.co`);
  return {id:item.Id,image:item.Config.Image,sourceSha:env.MASARIFI_RELEASE_VERSION,
    running:item.State.Running,health:item.State.Health?.Status,
    analysisOnly:env.MASARIFI_VOICE_ANALYSIS_ONLY==='true'};
}
function database(packet) {
  assert.match(packet.referenceConversationId,/^[a-f0-9-]{36}$/);
  const script=`const {Client}=require('pg');
  (async()=>{const url=new URL(process.env.DATABASE_URL);
  if(!url.hostname.endsWith('.supabase.com')||!decodeURIComponent(url.username).endsWith('.${PROJECT}'))throw Error('STAGING_REQUIRED');
  const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:10000});
  await db.connect();try{await db.query('begin read only');
  const row=(await db.query(\`select
    (select enabled from private.voice_automatic_policy) posting,
    (select count(*)::int from private.staging_voice_epochs where state='active') "activeEpochs",
    (select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from private.staging_voice_epochs where state='active') "activeEpochIds",
    (select enabled from private.voice_analysis_policy) "analysisEnabled",
    (select owner_id=(select user_id from public.assistant_conversations where id=$1) from private.voice_analysis_policy) "analysisOwnerMatches",
    (select count(*)::int from public.voice_sessions s join private.voice_batch_context c on c.session_id=s.id where c.analysis_only and s.status in ('uploaded','processing')) "analysisJobs",
    (select coalesce(jsonb_agg(jsonb_build_object('workload',workload,'version',version,'enabled',enabled,
      'modelId',primary_model_id,'deletedAt',deleted_at) order by workload),'[]'::jsonb) from private.ai_feature_routes) "aiRoutes"\`,[${JSON.stringify(packet.referenceConversationId)}])).rows[0];
  await db.query('commit');console.log(JSON.stringify(row));}finally{await db.end();}})()
  .catch(error=>{console.error('READINESS_DATABASE_'+(error.code??'UNAVAILABLE'));process.exitCode=1;});`;
  return JSON.parse(command('docker',['run','--rm','-i','--network','masarifi-staging_backend',
    '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','128','--memory','512m',
    '--env-file','/etc/masarifi/migration.env','-e','MASARIFI_PROCESS_KIND=migration',
    '-e',`MASARIFI_RELEASE_VERSION=${packet.sourceSha}`,
    '-v','/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro',packet.image,'-'],{input:script}));
}
function snapshot(packet) {
  const db=database(packet);
  // Execute the governed availability predicate with the API's own identity,
  // without granting a monitoring role additional function privileges.
  const voiceRouteAvailable=JSON.parse(command('docker',['run','--rm','-i','--network','masarifi-staging_backend',
    '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','128','--memory','512m',
    '--env-file','/etc/masarifi/api.env','-e','MASARIFI_PROCESS_KIND=api',
    '-e',`MASARIFI_RELEASE_VERSION=${packet.sourceSha}`,
    '-v','/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro',packet.image,'-'],
    {input:`const {Client}=require('pg');(async()=>{const url=new URL(process.env.DATABASE_URL);
    if(!url.hostname.endsWith('.supabase.com')||!decodeURIComponent(url.username).endsWith('.${PROJECT}'))throw Error('STAGING_REQUIRED');
    const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:10000});
    await c.connect();try{await c.query('set role masarifi_api');await c.query('begin read only');
    console.log(JSON.stringify((await c.query("select private.ai_workload_available('voice_transcription') available")).rows[0].available));
    await c.query('commit');}finally{await c.end();}})().catch(()=>process.exitCode=1);`}));
  const units=command('systemctl',['list-units','--all','--no-legend','--plain','masarifi-*-monitor.service']);
  assert(!units.includes('failed'),'MONITOR_STATE_UNCONFIRMED');
  const financialWorker=container('voice-epoch'),generalWorker=container('worker');
  return {project:PROJECT,observedAt:new Date().toISOString(),...db,voiceRouteAvailable,
    requiredApiContracts:packet.requiredApiContracts,
    monitorActive:/\sactive\s/.test(units),api:container('api'),analysisWorker:container('analysis-worker'),
    financialWorker,generalWorker,financialWorkerRunning:financialWorker.running,generalWorkerRunning:generalWorker.running};
}

function candidateCompatibility(packet,root) {
  // The root-owned, hash-pinned receipt must come from cross-feature validation
  // of this exact release artifact; missing/skipped acceptance blocks replacement.
  const file=fs.realpathSync(packet.compatibilityFile);
  assert(file.startsWith(root+'/'),'COMPATIBILITY_RECEIPT_SCOPE_INVALID');
  assert.equal(packet.fileHashes[file],crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    'COMPATIBILITY_RECEIPT_PIN_CHANGED');
  const receipt=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(receipt.image,packet.image,'COMPATIBILITY_IMAGE_MISMATCH');
  assert.equal(receipt.sourceSha,packet.sourceSha,'COMPATIBILITY_SOURCE_MISMATCH');
  const revision=command('docker',['image','inspect',packet.image,'--format','{{index .Config.Labels "org.opencontainers.image.revision"}}']);
  assert.equal(revision,packet.sourceSha,'COMPATIBILITY_IMAGE_REVISION_MISMATCH');
  assert(receipt.validationLogs && Object.keys(receipt.validationLogs).length>0,'COMPATIBILITY_TEST_LOGS_REQUIRED');
  for(const [name,hash] of Object.entries(receipt.validationLogs)) {
    const log=fs.realpathSync(path.resolve(root,name));
    assert(log.startsWith(root+'/'),'COMPATIBILITY_LOG_SCOPE_INVALID');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(log)).digest('hex'),hash,'COMPATIBILITY_LOG_PIN_CHANGED');
  }
  // Inspect protocol declarations from the candidate image with no network,
  // host environment, credentials, database, worker or financial side effects.
  const declaration=JSON.parse(command('docker',['run','--rm','-i','--network','none','--read-only',
    '--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','128','--memory','256m',packet.image,'-'],
    {input:"const {HealthController}=require('./dist/src/platform/health/health.controller');process.stdout.write(JSON.stringify(new HealthController({}).compatibility()));"}));
  assert.equal(declaration.schemaVersion,1,'COMPATIBILITY_SCHEMA_UNSUPPORTED');
  assert.deepEqual(declaration.contracts,receipt.contracts,'COMPATIBILITY_DECLARATION_MISMATCH');
  return {...receipt,observedAt:new Date().toISOString()};
}
function compose(packet) {
  return ['compose','--env-file','/etc/masarifi/compose.env',
    ...packet.composeFiles.flatMap(file=>['-f',file])];
}
function validateFiles(packet,root) {
  assert.equal(packet.project,PROJECT);
  assert(Array.isArray(packet.composeFiles)&&packet.composeFiles.length>0);
  for(const [file,hash] of Object.entries(packet.fileHashes)) {
    const resolved=fs.realpathSync(file);
    assert(resolved.startsWith('/opt/masarifi/releases/')||resolved.startsWith(root+'/'),'FILE_SCOPE_INVALID');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex'),hash,'FILE_PIN_CHANGED');
  }
  for(const file of packet.composeFiles) assert(packet.fileHashes[file],'UNPINNED_COMPOSE_FILE');
  const config=JSON.parse(command('docker',[...compose(packet),'config','--format','json']));
  assert.equal(config.name,'masarifi-staging');
  for(const name of packet.services) {
    const service=config.services[name];
    assert.equal(service.image,packet.image,'COHORT_IMAGE_MISMATCH');
    assert.equal(service.environment.MASARIFI_RELEASE_VERSION,packet.sourceSha);
    assert.equal(String(service.environment.MASARIFI_VOICE_ANALYSIS_ONLY),
      packet.voiceMode==='preserve'?String(packet.apiAnalysisOnly):'true');
    assert.deepEqual(service.command,[name==='api'?'dist/src/main.js':'dist/src/worker.js']);
  }
}
async function main() {
  assert.equal(process.platform,'linux');assert.equal(process.getuid(),0);
  const packetPath=fs.realpathSync(process.argv[2]);const root=path.dirname(packetPath);
  assert(root.startsWith('/opt/masarifi/staging-cohort-'),'CONTROL_DIRECTORY_INVALID');
  // Serialize managed cohort deployments. Preservation requires compatibility
  // proof while monitors remain active; scope changes require explicit closure.
  if(process.argv[3]!=='--locked') {
    const result=spawnSync('flock',['--exclusive','--nonblock','/run/lock/masarifi-staging-deployment.lock',
      process.execPath,__filename,packetPath,'--locked'],{stdio:'inherit'});
    assert.equal(result.status,0,'DEPLOYMENT_LOCK_OR_CHILD_FAILED');return;
  }
  const packet=JSON.parse(fs.readFileSync(packetPath,'utf8'));
  assert.equal(packet.fileHashes[__filename],crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),'CONTROL_PIN_CHANGED');
  assert.match(packet.sourceSha,/^[a-f0-9]{40}$/);
  assert.match(packet.image,/^ghcr\.io\/masarifiratibi-spec\/masarifi-backend@sha256:[a-f0-9]{64}$/);
  process.env.MASARIFI_BACKEND_REPOSITORY='ghcr.io/masarifiratibi-spec/masarifi-backend';
  process.env.MASARIFI_BACKEND_DIGEST=packet.image.split('@sha256:')[1];
  process.env.MASARIFI_RELEASE_VERSION=packet.sourceSha;
  validateFiles(packet,root);
  await deployCohort(packet,{
    snapshot:async()=>snapshot(packet),
    compatibility:async()=>candidateCompatibility(packet,root),
    apply:async()=>{command('docker',[...compose(packet),'up','-d','--no-deps',...packet.services],{timeout:60000});},
    verify:async(candidate,before)=>{
      // Container readiness is asynchronous; bounded probing performs no restoration.
      await waitApiReady(async()=>({
        ready:JSON.parse(command('curl',['--fail','--silent','--max-time','2',
          'http://127.0.0.1:3000/health/ready'],{timeout:3000})),
        api:container('api')
      }),ms=>new Promise(resolve=>setTimeout(resolve,ms)));
      const after=snapshot(packet);
      if(candidate.voiceMode==='preserve') {
        assertDeploymentSafe(after,candidate);
      } else assertDeploymentSafe(after,{...candidate,services:['api']});
      assertRuntimePreserved(before,after,candidate);
      assert.equal(after.api.image,packet.image);assert.equal(after.api.sourceSha,packet.sourceSha);
      assert.equal(after.api.health,'healthy');
      const ready=JSON.parse(command('curl',['--fail','--silent','--max-time','10','http://127.0.0.1:3000/health/ready']));
      assert.equal(ready.status,'ready');
      console.log(JSON.stringify({event:'STAGING_COHORT_VERIFIED',...after}));
    }
  });
}
if(require.main===module) main().catch(error=>{
  // Never forward Docker/PG stderr containing environment or credential data.
  console.error(error instanceof assert.AssertionError?error.message:error.code??'COHORT_DEPLOYMENT_UNCONFIRMED');process.exitCode=1;
});
module.exports={deployCohort,waitApiReady};
