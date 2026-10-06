'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const g=require('./canary-guards.cjs');
const directory='/opt/masarifi/voice-manual-canary-cb2';
const release='/opt/masarifi/releases/'+g.PIN.sha;
const image='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:'+g.PIN.digest;
const label='org.masarifi.scope=voice-manual-cb2';
const service='masarifi-voice-manual-deadline';
const envHashes={
  'api.env':'abdb3bec68ec0489a06e3f5eaac682bf76679f6c1730210a7c7b49cde7085bef',
  'worker.env':'968bd7f73bd3936cdd40aad8c099479df8bb40c668d27cc148d6f6bb244afb29',
  'migration.env':'75b5d7fe85405c7b0d1bc257f1c5cc3b884c6f3ec3a8f736223a24ac0669acf1',
  'compose.env':'73cf9a1abe1cc1e9f925cb43586f83c224f480c4bec1b7884f371ad7ced4040a',
  'admin.env':'44e47f9303c93240193e8d3cac6efb0229fa524313b9a93a5ffdff095f683234',
};
async function run(command,args,timeout=60000) {
  const r=await exec(command,args,{timeout,maxBuffer:2*1024*1024,env:{...process.env,MASARIFI_BACKEND_REPOSITORY:'ghcr.io/masarifiratibi-spec/masarifi-backend',MASARIFI_BACKEND_DIGEST:g.PIN.digest}});
  return r.stdout.trim();
}
function hostIdentityGuard() {
  assert.equal(process.platform,'linux','LINUX_STAGING_HOST_REQUIRED');
  assert.equal(process.getuid(),0,'ROOT_REQUIRED_FOR_INDEPENDENT_CLEANUP');
  assert.equal(fs.realpathSync(__dirname),directory,'PINNED_CONTROL_DIRECTORY_REQUIRED');
}
function hostGuard() {
  hostIdentityGuard();
  assert.equal(fs.realpathSync('/opt/masarifi/current'),release,'STAGING_RELEASE_MISMATCH');
  for(const [name,pin] of Object.entries(envHashes)) assert.equal(g.hash(fs.readFileSync('/etc/masarifi/'+name)),pin,'ENVIRONMENT_CHANGED');
}
const composeArgs=['compose','--env-file','/etc/masarifi/compose.env',...['compose.backend.yml','release-version.yml','voice-runtime.yml','voice-analysis.yml'].flatMap(n=>['-f',release+'/docker/staging/'+n])];
async function readContainer(name,execute=run) {const v=JSON.parse(await execute('docker',['inspect',name]));assert.equal(v.length,1);return v[0];}
async function inspect(name) {const v=await readContainer(name);assert.equal(v.Config.Image,image,'CONTAINER_IMAGE_MISMATCH');return v;}
function requireCleanupTarget(container,expectedService) {
  assert.equal(container.Config?.Labels?.['com.docker.compose.project'],'masarifi-staging','UNTRUSTED_CLEANUP_PROJECT');
  assert.equal(container.Config?.Labels?.['com.docker.compose.service'],expectedService,'UNTRUSTED_CLEANUP_SERVICE');
  assert.equal(container.HostConfig?.NetworkMode,'masarifi-staging_backend','UNTRUSTED_CLEANUP_NETWORK');
}
function readControl() {const bytes=fs.readFileSync(directory+'/approval-control.json');assert(bytes.length<=32768);const control=JSON.parse(bytes);g.approval(control);return {control,hash:g.hash(bytes)};}
async function db(mode,controlHash,id) {
  const args=['run','--rm','--network','masarifi-staging_backend','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','128','--memory','512m','--cpus','1','--stop-timeout','5',
    '--env-file','/etc/masarifi/migration.env','-e','MASARIFI_PROCESS_KIND=migration','-e','MASARIFI_RELEASE_VERSION='+g.PIN.sha,
    '-v','/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro','-v',directory+':/probe:ro'];
  if(mode==='finalize' || mode==='media-claim') {
    args.push('--label',label,'--label','org.masarifi.phase=financial');
    const worker=await inspect('masarifi-staging-worker-1');
    assert.equal(worker.State.Running,false);
    const database=worker.Config.Env.find(e=>e.startsWith('DATABASE_URL='));assert(database,'WORKER_CREDENTIAL_UNAVAILABLE');
    // In-memory handoff to the exact container; never write/print this credential in evidence.
    args.push('-e','VOICE_CANARY_WORKER_DATABASE_URL='+database.slice('DATABASE_URL='.length));
  }
  if(controlHash)args.push('-e','VOICE_CANARY_CONTROL_HASH='+controlHash);
  args.push(image,'/probe/canary-db.cjs',mode,'/probe/approval-control.json');if(id)args.push(id);
  return JSON.parse((await run('docker',args)).split('\n').at(-1));
}
async function scopedStop(execute=run) {
  const names=(await execute('docker',['ps','-q','--filter','label='+label,'--filter','label=org.masarifi.phase=financial'])).split('\n').filter(Boolean);
  const failures=[];
  for(const id of names) {
    try {
      const container=await readContainer(id,execute);
      assert.equal(container.Config?.Labels?.['org.masarifi.scope'],'voice-manual-cb2','UNTRUSTED_SCOPED_TARGET');
      assert.equal(container.Config?.Labels?.['org.masarifi.phase'],'financial','UNTRUSTED_SCOPED_PHASE');
      assert.equal(container.HostConfig?.NetworkMode,'masarifi-staging_backend','UNTRUSTED_SCOPED_NETWORK');
      await execute('docker',['stop','--time','5',id],20000);
    } catch(error) {failures.push(error);}
  }
  if(failures.length)throw new AggregateError(failures,'SCOPED_SHUTDOWN_FAILED');
}
async function active(mode) {
  const api=await inspect('masarifi-staging-api-1');
  const general=await inspect('masarifi-staging-worker-1');
  const analysis=await inspect('masarifi-staging-analysis-worker-1');
  assert.equal(general.State.Running,false,'GENERAL_WORKER_MUST_REMAIN_STOPPED');
  assert.equal(api.State.Running,true);assert.equal(api.State.Health.Status,'healthy');
  assert(api.Config.Env.includes('MASARIFI_VOICE_ANALYSIS_ONLY='+mode),'API_MODE_MISMATCH');
  assert.equal(analysis.State.Running,mode==='true','RESTRICTED_WORKER_STATE_MISMATCH');
  const health=JSON.parse(await run('curl',['--fail','--silent','--max-time','10','http://127.0.0.1:3000/health/live']));
  assert.equal(health.version,g.PIN.sha);
}
// Tests use the same sequence with an adapter, including database/network failures.
async function cleanup(adapter) {
  await adapter.target();
  const failures=[];
  // Failure of one closure step must not suppress the other closure attempts.
  for(const step of ['stopApi','stopScoped','stopGeneral','policyOff']) {
    try {await adapter[step]();}catch(error){failures.push(error);}
  }
  if(failures.length)throw new AggregateError(failures,'CANARY_CLOSURE_FAILED');
  // Mutable pins restrict restoration, never trusted shutdown. Retry stays OFF/stopped.
  await adapter.pin();
  await adapter.restoreAnalysisApi();
  await adapter.verify();
  return {posting:false,apiAnalysisOnly:true,generalWorker:false};
}
function createCleanupAdapter({
  execute=run,
  assertHost=hostIdentityGuard,
  closePolicy=async()=>{
    assert.equal(g.hash(fs.readFileSync('/etc/masarifi/migration.env')),envHashes['migration.env'],'CLOSURE_CREDENTIALS_CHANGED');
    assert.equal((await db('policy-off')).posting,false);
  },
}={}) {
  const stopTrustedService=async(name,service)=>{
    requireCleanupTarget(await readContainer(name,execute),service);
    await execute('docker',['stop','--time','5',name],20000);
  };
  return {
  target:assertHost,
  pin:async()=>{hostGuard();await inspect('masarifi-staging-api-1');await inspect('masarifi-staging-worker-1');},
  stopApi:()=>stopTrustedService('masarifi-staging-api-1','api'),
  stopScoped:()=>scopedStop(execute),
  stopGeneral:()=>stopTrustedService('masarifi-staging-worker-1','worker'),
  policyOff:closePolicy, // Never use drifted credentials to write to an unidentified database.
  restoreAnalysisApi:async()=>{await run('docker',[...composeArgs,'up','-d','--no-deps','api','analysis-worker']);},
  verify:async()=>{
    for(let n=0;n<30;n++) {const api=await inspect('masarifi-staging-api-1');if(api.State.Health?.Status==='healthy')break;await new Promise(r=>setTimeout(r,1000));}
    await active('true');
  },
};}
async function watchdog() {
  assert.equal(await run('systemctl',['is-active',service+'.timer']),'active','DEADLINE_TIMER_NOT_ACTIVE');
  const actual=await run('systemctl',['show',service+'.service','--property=ExecStart','--value']);
  assert(actual.includes(directory+'/canary-host.cjs cleanup'),'CLEANUP_EXECUTABLE_MISMATCH');
  assert.equal(await run('systemctl',['show',service+'.service','--property=Restart','--value']),'on-failure','CLEANUP_RETRY_MISSING');
}
async function arm(control) {
  const when=new Date(control.deadline).toISOString().replace('T',' ').slice(0,19)+' UTC';
  const unit=`[Unit]\nDescription=Bounded Staging Voice financial deadline cleanup\nAfter=docker.service network-online.target\n[Service]\nType=oneshot\nUser=root\nExecStart=/usr/bin/node ${directory}/canary-host.cjs cleanup\nRestart=on-failure\nRestartSec=5\nTimeoutStartSec=120\n`;
  const timer=`[Unit]\nDescription=Exact Staging financial window deadline\n[Timer]\nOnCalendar=${when}\nAccuracySec=1s\nPersistent=true\nUnit=${service}.service\n[Install]\nWantedBy=timers.target\n`;
  // Unique delivery unit: do not overwrite an earlier window or extend its deadline silently.
  fs.writeFileSync('/etc/systemd/system/'+service+'.service',unit,{flag:'wx',mode:0o600});
  fs.writeFileSync('/etc/systemd/system/'+service+'.timer',timer,{flag:'wx',mode:0o600});
  await run('systemd-analyze',['verify','/etc/systemd/system/'+service+'.service','/etc/systemd/system/'+service+'.timer']);
  await run('systemctl',['daemon-reload']);await run('systemctl',['enable','--now',service+'.timer']);await watchdog();
}
async function ensureClosedOnFailure(action) {
  try {return await action();}
  catch(e) {
    // Starting the persistent independent cleanup service survives this CLI/SSH process.
    await run('systemctl',['start','--no-block',service+'.service']).catch(()=>{});
    await cleanup(createCleanupAdapter()).catch(()=>{});
    throw e;
  }
}
async function main(mode=process.argv[2],cleanupAdapter=createCleanupAdapter()) {
  if(mode==='cleanup')return cleanup(cleanupAdapter); // No approval/window/mutable enablement guard required to close.
  hostGuard();
  if(mode==='check'){await active('true');return db('preflight');}
  const {control,hash}=readControl();
  if(mode==='arm'){await active('true');await db('preflight');await arm(control);return {deadlineArmed:control.deadline,scopeHash:g.scopeHash};}
  await watchdog();
  return ensureClosedOnFailure(async()=>{
    if(mode==='enable') {
      assert(Date.parse(control.deadline)-Date.now()>180000,'WINDOW_TOO_CLOSE_TO_DEADLINE');
      await active('true');await db('preflight');
      await run('docker',[...composeArgs,'stop','analysis-worker']);
      const overlay=directory+'/financial-api.yml';
      assert.equal(fs.readFileSync(overlay,'utf8').replace(/\r/g,''),'services:\n  api:\n    environment:\n      MASARIFI_VOICE_ANALYSIS_ONLY: "false"\n','FINANCIAL_OVERLAY_MISMATCH');
      await run('docker',[...composeArgs,'-f',overlay,'up','-d','--no-deps','api']);
      for(let n=0;n<30;n++){if((await inspect('masarifi-staging-api-1')).State.Health?.Status==='healthy')break;await new Promise(r=>setTimeout(r,1000));}
      await active('false');g.approval(control);await watchdog();return db('enable',hash);
    }
    await active('false');
    if(['finalize','inspect'].includes(mode)){if(process.argv[3])g.exactSession(control,process.argv[3]);return db(mode,hash,process.argv[3]);}
    if(['process','media'].includes(mode)) {
      g.exactSession(control,process.argv[3]);
      let mediaFile,mediaHash;
      if(mode==='media') {
        const claim=await db('media-claim',hash,process.argv[3]);
        const bytes=JSON.stringify(claim);mediaHash=g.hash(bytes);
        mediaFile='media-claim-'+process.argv[3]+'.json';
        fs.writeFileSync(directory+'/'+mediaFile,bytes,{flag:'wx',mode:0o444});
      }
      const args=['run','--rm','--network','masarifi-staging_backend','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','128','--memory','512m','--cpus','1','--stop-timeout','5',
        '--label',label,'--label','org.masarifi.phase=financial','--env-file','/etc/masarifi/worker.env',
        '-e','MASARIFI_PROCESS_KIND=worker','-e','MASARIFI_RELEASE_VERSION='+g.PIN.sha,'-e','MASARIFI_VOICE_ANALYSIS_ONLY=false',
        '-e','MASARIFI_AI_PROVIDER_ENABLED=true','-e','MASARIFI_CLAMAV_HOST=clamav','-e','MASARIFI_CLAMAV_PORT=3310',
        '-e','VOICE_CANARY_CONTROL_HASH='+hash,'-v','/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro','-v',directory+':/probe:ro',
        ...(mediaHash?['-e','VOICE_CANARY_MEDIA_CLAIM_HASH='+mediaHash]:[]),
        image,'/probe/canary-voice.cjs',mode==='media'?'media-claimed':mode,'/probe/approval-control.json',process.argv[3],...(mediaFile?['/probe/'+mediaFile]:[])];
      return JSON.parse((await run('docker',args,195000)).split('\n').at(-1));
    }
    throw new Error('UNKNOWN_HOST_MODE');
  });
}
module.exports={cleanup,main,requireCleanupTarget,createCleanupAdapter};
if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code || (e.name==='AssertionError'?'CANARY_HOST_GUARD_REJECTED':e.message));process.exitCode=1;});
