'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cleanup,main,requireCleanupTarget,createCleanupAdapter}=require('./canary-host.cjs');
function fixture(failures=[]) {
  const calls=[];
  const adapter=Object.fromEntries(['target','pin','stopApi','stopScoped','stopGeneral','policyOff','restoreAnalysisApi','verify'].map(name=>[name,async()=>{
    calls.push(name);
    if(failures.includes(name))throw new Error(name+'_FAILED');
  }]));
  return {adapter,calls};
}
test('mutable pin drift closes trusted ingress/effects/policy and prevents restoration',async()=>{
  const {adapter,calls}=fixture(['pin']);
  await assert.rejects(cleanup(adapter),/pin_FAILED/);
  assert.deepEqual(calls,['target','stopApi','stopScoped','stopGeneral','policyOff','pin']);
});
test('stop failure still attempts every shutdown and policy closure without restoring',async()=>{
  for(const failed of ['stopApi','stopScoped','stopGeneral','policyOff']){
    const {adapter,calls}=fixture([failed]);
    await assert.rejects(cleanup(adapter));
    assert.deepEqual(calls,['target','stopApi','stopScoped','stopGeneral','policyOff']);
  }
});
test('an untrusted target cannot trigger shutdown or policy changes',async()=>{
  const {adapter,calls}=fixture(['target']);
  await assert.rejects(cleanup(adapter),/target_FAILED/);
  assert.deepEqual(calls,['target']);
});
test('the independent deadline cleanup entry reaches closure before enablement guards',async()=>{
  assert.equal(typeof main,'function');
  const {adapter,calls}=fixture(['pin']);
  await assert.rejects(main('cleanup',adapter),/pin_FAILED/);
  assert.deepEqual(calls,['target','stopApi','stopScoped','stopGeneral','policyOff','pin']);
});
test('cleanup target identity accepts image drift but rejects foreign project/service/network',()=>{
  assert.equal(typeof requireCleanupTarget,'function');
  const target={Config:{Image:'changed-image',Labels:{
    'com.docker.compose.project':'masarifi-staging','com.docker.compose.service':'api'
  }},HostConfig:{NetworkMode:'masarifi-staging_backend'}};
  requireCleanupTarget(target,'api');
  for(const mutate of [
    x=>x.Config.Labels['com.docker.compose.project']='production',
    x=>x.Config.Labels['com.docker.compose.service']='worker',
    x=>x.HostConfig.NetworkMode='production_backend'
  ]){
    const foreign=structuredClone(target);mutate(foreign);
    assert.throws(()=>requireCleanupTarget(foreign,'api'));
  }
});
test('real cleanup adapter closes independently trusted targets despite a missing or foreign container',async()=>{
  assert.equal(typeof createCleanupAdapter,'function');
  for(const fault of ['missing-worker','missing-api','foreign-worker']) {
    const effects=[];
    const execute=async(command,args)=>{
      assert.equal(command,'docker');
      if(args[0]==='inspect') {
        const name=args[1], service=name==='masarifi-staging-api-1'?'api':'worker';
        if((fault==='missing-worker'&&service==='worker')||(fault==='missing-api'&&service==='api'))
          throw new Error('Error: No such object: '+name);
        return JSON.stringify([{Config:{Image:'changed-image',Labels:{
          'com.docker.compose.project':fault==='foreign-worker'&&service==='worker'?'production':'masarifi-staging',
          'com.docker.compose.service':service
        }},HostConfig:{NetworkMode:'masarifi-staging_backend'}}]);
      }
      if(args[0]==='ps') {effects.push('scoped-lookup');return '';}
      if(args[0]==='stop') {effects.push(args.at(-1));return '';}
      throw new Error('Unexpected command; restoration must not run');
    };
    const adapter=createCleanupAdapter({
      execute,assertHost:()=>{},closePolicy:async()=>effects.push('policy-off')
    });
    await assert.rejects(cleanup(adapter));
    assert.deepEqual(effects,fault==='missing-api'
      ? ['scoped-lookup','masarifi-staging-worker-1','policy-off']
      : ['masarifi-staging-api-1','scoped-lookup','policy-off']);
  }
});
