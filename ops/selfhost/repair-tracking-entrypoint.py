"""Patch the baked tracking entrypoint's provider pin, retaining worker/release fences."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess as sp
import time
from urllib.parse import quote

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
runtime=io.load('runtime-container')
TEST=r"""
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=JSON.parse(fs.readFileSync(0,'utf8'));
new vm.Script(data.code);
const req=require('node:module').createRequire('/app/tracking-acceptance.cjs');
const mod={exports:{}};new Function('require','module','exports',data.code)(req,mod,mod.exports);
const env={MASARIFI_RUNTIME_SCOPE:'project-server',MASARIFI_STORAGE_PROVIDER:'filesystem',MASARIFI_STORAGE_URL:'https://api.masarifiratibi.com',MASARIFI_PROCESS_KIND:'worker',MASARIFI_RELEASE_VERSION:'a'.repeat(40)};
if(!data.green){try{mod.exports.assertTrackingRuntime(env);throw Error('ORIGINAL_UNEXPECTEDLY_PASSED')}catch(error){assert.equal(error.code,'ERR_ASSERTION');process.stdout.write(JSON.stringify({state:'blocked',code:error.code}));}}
else{mod.exports.assertTrackingRuntime(env);for(const change of [{MASARIFI_PROCESS_KIND:'api'},{MASARIFI_RELEASE_VERSION:'bad'},{MASARIFI_RUNTIME_SCOPE:'unknown'},{MASARIFI_STORAGE_URL:'http://unsafe.test'},{SUPABASE_URL:'https://stale.example.test'}])assert.throws(()=>mod.exports.assertTrackingRuntime({...env,...change}));process.stdout.write(JSON.stringify({state:'passed',fencesRejected:5}));}
"""


def probe(container,code,green):
    result=sp.run(['docker','run','--rm','--log-driver=none','-i','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--volumes-from',container['Id']+':ro','--entrypoint=/nodejs/bin/node',container['Image'],'-e',TEST],input=json.dumps({'code':code,'green':green}).encode(),capture_output=True,timeout=30)
    assert result.returncode==0,'ENTRYPOINT_TEST_FAILED:'+hashlib.sha256(result.stderr).hexdigest()
    receipt=json.loads(result.stdout);print(json.dumps({'test':'tracking-entrypoint','green':green,**receipt}),flush=True);return receipt


def main():
    os.umask(0o077);state_path=Path('/etc/masarifi/selfhost/cutover-state.json');state=json.loads(state_path.read_text())
    assert state['targetMayAcceptWrites'] and state['phase']=='operational-target-awaiting-final-acceptance'
    row=next(x for x in state['newConsumers'] if 'tracking-maintenance' in x['name']);current=runtime.inspect(row['id'])
    assert current['Config']['Labels']['masarifi.scope']=='selfhost' and not current['State']['Running']
    original=(ROOT/'tracking-acceptance-original.cjs').read_text()
    red=probe(current,original,False)
    needle="assert.equal(env.SUPABASE_URL,'https://qcffvfbpzvpwcwxwjyro.supabase.co','STAGING_REQUIRED');"
    assert original.count(needle)==1
    updated=original.replace(needle,"assert.equal(require('/app/selfhost/runtime-adapter.cjs').isProjectRuntimeEnvironment(env),true,'STAGING_REQUIRED');")
    bridge="function selfhostTrackingLog(value,failed=false){require('reflect-metadata');const {PlatformLogger}=require('./dist/src/platform/observability/platform-logger.js');const logger=new PlatformLogger();if(failed)logger.error(value);else logger.log(value);}\n"
    updated="'use strict';\n"+bridge+updated
    updated,count=re.subn(r'console\.log\(JSON\.stringify\((.*?)\)\);',r'selfhostTrackingLog(\1);',updated,flags=re.S)
    assert count>=1 and 'console.log(' not in updated
    updated=updated.replace("console.error('TRACKING_ONLY_BOOTSTRAP_FAILED')","selfhostTrackingLog('TRACKING_ONLY_BOOTSTRAP_FAILED',true)")
    updated=updated.replace("console.error('TRACKING_ONLY_PASS_FAILED')","selfhostTrackingLog('TRACKING_ONLY_PASS_FAILED',true)")
    assert 'SUPABASE_URL' not in updated and 'console.error(' not in updated
    green=probe(current,updated,True)
    release=Path('/opt/masarifi/selfhost/releases/2026-11-13/worker-entrypoints-r10');release.mkdir(mode=0o700,exist_ok=True)
    file=release/'tracking-acceptance.cjs'
    if file.exists():assert file.read_text()==updated,'FROZEN_ENTRYPOINT_CHANGED'
    else:file.write_text(updated);file.chmod(0o644)
    runtime.docker_request('GET','/images/'+current['Image']+'/json')
    config=copy.deepcopy(current['Config']);config['Image']=current['Image'];host=copy.deepcopy(current['HostConfig'])
    host['Binds']=[x for x in host.get('Binds') or [] if x.split(':')[1]!='/app/tracking-acceptance.cjs']
    host['Mounts']=[x for x in host.get('Mounts') or [] if x['Target']!='/app/tracking-acceptance.cjs']+[{'Type':'bind','Source':str(file),'Target':'/app/tracking-acceptance.cjs','ReadOnly':True}]
    networks={name:{'Aliases':endpoint.get('Aliases') or []} for name,endpoint in current['NetworkSettings']['Networks'].items()}
    assert all(not x.get('IPAMConfig') for x in current['NetworkSettings']['Networks'].values())
    body={**config,'HostConfig':host}
    if host['NetworkMode']!='host':body['NetworkingConfig']={'EndpointsConfig':networks}
    previous_name=row['name']+'-before-entrypoint-fix-r10'
    assert current['Name'].lstrip('/') in (row['name'],previous_name)
    if current['Name'].lstrip('/')==row['name']:runtime.docker_request('POST','/containers/'+current['Id']+'/rename?name='+quote(previous_name,safe=''))
    created=runtime.docker_request('POST','/containers/create?name='+quote(row['name'],safe=''),body)
    row['previousTargetId']=row['id'];row['id']=created['Id'];io.atomic_json(state_path,state)
    runtime.docker_request('POST','/containers/'+row['id']+'/start')
    time.sleep(3);actual=runtime.inspect(row['id']);assert actual['State']['Running'] and not actual['State']['Restarting'] and actual['RestartCount']==0
    receipt={'state':'passed','sourceSha256':hashlib.sha256(original.encode()).hexdigest(),'sha256':hashlib.sha256(updated.encode()).hexdigest(),'file':str(file),'red':red,'green':green,'workerAndReleaseFencesPreserved':True,'businessJobScopeChanged':False,'imagePreserved':actual['Image']==current['Image'],'newId':row['id'],'previousTargetId':current['Id']}
    io.atomic_json(release/'manifest.json',receipt);io.atomic_json(ROOT/'tracking-entrypoint-repaired.json',receipt);print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
