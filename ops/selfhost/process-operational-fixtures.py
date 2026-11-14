"""Process only the named download/legacy-review fixtures using current target code.

Existing workers keep their source job/epoch scopes. Never start a broad poller.
"""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess as sp
import uuid
from urllib.parse import urlsplit

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
runtime=io.load('runtime-container')


def main():
    os.umask(0o077)
    state=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text());assert state['targetMayAcceptWrites'] and state['phase']=='operational-target-awaiting-final-acceptance'
    fixture=json.loads((ROOT/'functional-operational-fixtures.json').read_text());guard=io.load('verify-functional-runtime')
    workers=[]
    for row in state['newConsumers']:
        if row['kind']=='worker':workers.append((row,runtime.inspect(row['id'])))
    primary=runtime.inspect(runtime.SOURCE);analysis=dict(x.split('=',1) for x in primary['Config']['Env']).get('MASARIFI_VOICE_ANALYSIS_ONLY')=='true'
    report=next(c for row,c in workers if 'assistant-reports-worker' in row['name'])
    options=[]
    for row,c in workers:
        env=dict(x.split('=',1) for x in c['Config']['Env'])
        if env.get('MASARIFI_AI_PROVIDER_ENABLED')=='true' and env.get('MASARIFI_AI_ASSISTANT_ONLY')!='true' and (env.get('MASARIFI_VOICE_ANALYSIS_ONLY')=='true')==analysis:options.append((row,c))
    options.sort(key=lambda item:0 if ('voice-repair-worker' in item[0]['name'] or 'analysis-worker' in item[0]['name']) else 1)
    assert options,'MATCHING_OPERATIONAL_VOICE_ENGINE_MISSING'
    for phase,source in [('reports',report),('voice',options[0][1])]:
        env=dict(x.split('=',1) for x in source['Config']['Env'])
        assert source['State']['Running'] and source['Config']['Labels']['masarifi.scope']=='selfhost'
        assert env['MASARIFI_PROCESS_KIND']=='worker' and not any(key.startswith('SUPABASE_') for key in env)
        assert all(urlsplit(value).hostname=='masarifi-postgres17.internal' for key,value in env.items() if key.endswith('DATABASE_URL'))
        config=copy.deepcopy(source['Config']);config['Image']=source['Image'];host=copy.deepcopy(source['HostConfig'])
        host.update(NetworkMode='bridge',PortBindings={},PublishAllPorts=False,RestartPolicy={'Name':'no','MaximumRetryCount':0},AutoRemove=False)
        config['Entrypoint']=['/nodejs/bin/node'];config['Cmd']=['-e','setInterval(()=>{},60000)'];config['Labels']['masarifi.role']='operational-fixture-probe'
        body={**config,'HostConfig':host,'NetworkingConfig':{'EndpointsConfig':{'bridge':{},'masarifi-selfhost-data':{}}}}
        identifier=runtime.docker_request('POST','/containers/create?name=masarifi-selfhost-final-fixture-'+str(uuid.uuid4())[:8],body)['Id'];lock=None
        try:
            runtime.docker_request('POST','/containers/'+identifier+'/start')
            if phase=='voice':lock=guard.guard_rows(None,fixture)
            payload={'phase':phase,'features':fixture,'finance':None}
            code=(ROOT/'verify-functional-worker.cjs').read_text()
            wrapper="const source="+json.dumps(code)+";const data="+json.dumps(json.dumps(payload))+";const read=require('node:fs').readFileSync;require('node:fs').readFileSync=function(path,...args){return path===0?data:read(path,...args)};new Function('require',source)(require);"
            result=sp.run(['docker','exec','-i',identifier,'/nodejs/bin/node'],input=wrapper.encode(),capture_output=True,timeout=210)
            rows=[]
            for line in result.stdout.splitlines():
                try:value=json.loads(line)
                except ValueError:continue
                if value.get('probe')=='functional-worker':rows.append(value)
            assert rows,'FUNCTIONAL_WORKER_OUTPUT_MISSING:'+hashlib.sha256(result.stderr).hexdigest()
            receipt={**rows[-1],'operationalTarget':True,'fixtureOnly':True,'normalWorkerScopesUnchanged':True}
            io.atomic_json(ROOT/('functional-operational-'+phase+'.json'),receipt);print(json.dumps(receipt),flush=True)
            assert result.returncode==0 and receipt['state']=='passed'
        finally:
            if lock is not None:
                try:lock.stdin.write(b'rollback;\n');lock.stdin.close();lock.stdin=None;lock.communicate(timeout=15)
                finally:
                    if lock.poll() is None:lock.kill();lock.wait(timeout=10)
            actual=runtime.inspect(identifier);assert actual['Config']['Labels']['masarifi.role']=='operational-fixture-probe'
            runtime.docker_request('POST','/containers/'+identifier+'/stop?t=10');runtime.docker_request('DELETE','/containers/'+identifier)


if __name__=='__main__':main()
