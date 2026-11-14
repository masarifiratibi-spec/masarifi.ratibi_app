"""Process only named disposable fixtures through actual worker code; no polling workers."""
import importlib.util
import json
import os
from pathlib import Path
import select
import subprocess as sp
import sys
import time
import uuid

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
runtime=io.load('runtime-container')


def guard_rows(finance,features):
    clauses=[]
    if finance:clauses.append('perform 1 from public.client_mutations where operation_id<>'+io.ql(finance['mutationOperationId'])+'::uuid for update;')
    if features:
        clauses.append('perform 1 from public.voice_sessions where id<>'+io.ql(features['voiceSessionId'])+'::uuid for update;')
        clauses.append('perform 1 from private.assistant_agent_jobs where id<>'+io.ql(features['assistantMessageId'])+'::uuid for update;')
    process=sp.Popen(['docker','exec','-i','masarifi-postgres17','psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtq','-v','ON_ERROR_STOP=1'],stdin=sp.PIPE,stdout=sp.PIPE,stderr=sp.PIPE)
    try:
        process.stdin.write(('begin;do $$begin '+''.join(clauses)+"end$$;select 'LOCKS_READY';\n").encode());process.stdin.flush()
        assert select.select([process.stdout],[],[],20)[0],'FIXTURE_LOCK_TIMEOUT'
        assert process.stdout.readline().strip()==b'LOCKS_READY','FIXTURE_LOCK_FAILED'
    except BaseException:
        process.kill();process.communicate(timeout=10);raise
    return process


def probe(candidate,phase,finance,features):
    source=runtime.inspect(candidate['id']);runtime.verify_effective(source)
    body,_=runtime.render(source,candidate,probe=True)
    assert dict(value.split('=',1) for value in body['Env'])['MASARIFI_PROCESS_KIND']=='worker'
    body['Entrypoint']=['/nodejs/bin/node'];body['Cmd']=['-e','setInterval(()=>{},60000)']
    body['Labels']['masarifi.role']='worker-probe'
    name='masarifi-selfhost-worker-probe-'+str(uuid.uuid4())[:8]
    identifier=runtime.docker_request('POST','/containers/create?name='+name,body)['Id']
    lock=None
    try:
        runtime.docker_request('POST','/containers/'+identifier+'/start')
        lock=guard_rows(finance if phase=='sync' else None,features if phase in ('voice','assistant') else None)
        payload={'phase':phase,'finance':finance,'features':features}
        code=(ROOT/'verify-functional-worker.cjs').read_text()
        wrapper="const source="+json.dumps(code)+";const data="+json.dumps(json.dumps(payload))+";const read=require('node:fs').readFileSync;require('node:fs').readFileSync=function(path,...args){return path===0?data:read(path,...args)};new Function('require',source)(require);"
        result=sp.run(['docker','exec','-i',identifier,'/nodejs/bin/node'],input=wrapper.encode(),capture_output=True,timeout=210)
        records=[];receipt=None
        for line in result.stdout.splitlines():
            try:row=json.loads(line)
            except ValueError:continue
            if row.get('probe')=='functional-worker':receipt=row
            elif row.get('timestamp') and row.get('requestId') and row.get('message'):records.append(row)
        assert receipt is not None,'FIXTURE_WORKER_INVALID_OUTPUT'
        (ROOT/('functional-'+phase+'-logs.json')).write_text(json.dumps(records,indent=2))
        (ROOT/('functional-'+phase+'.json')).write_text(json.dumps(receipt,indent=2))
        print(json.dumps(receipt),flush=True)
        assert result.returncode==0 and receipt['state']=='passed','FUNCTIONAL_PHASE_FAILED:'+phase
    finally:
        if lock is not None:
            try:lock.stdin.write(b'rollback;\n');lock.stdin.close();lock.stdin=None;lock.communicate(timeout=15)
            finally:
                if lock.poll() is None:lock.kill();lock.wait(timeout=10)
        current=runtime.inspect(identifier);assert current['Config']['Labels'].get('masarifi.role')=='worker-probe'
        runtime.docker_request('POST','/containers/'+identifier+'/stop?t=10');runtime.docker_request('DELETE','/containers/'+identifier)


def main():
    os.umask(0o077);assert sys.argv[1:] in (['sync'],['features'])
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text())
    finance=json.loads((ROOT/'finance-fixtures.json').read_text())
    if sys.argv[1]=='sync':
        candidate=next(row for row in candidates if row['name']=='/masarifi-staging-worker-1')
        probe(candidate,'sync',finance,None)
        sp.run(['python3','-I',str(ROOT/'verify-clerk-auth.py'),'finance-check'],check=True,timeout=240)
        return
    features=json.loads((ROOT/'functional-fixtures.json').read_text())
    candidate=next(row for row in candidates if row['name']=='/masarifi-assistant-reports-worker-20261023')
    probe(candidate,'reports',finance,features)
    probe(candidate,'assistant',finance,features)
    primary=runtime.inspect(runtime.SOURCE)
    analysis=dict(value.split('=',1) for value in primary['Config']['Env']).get('MASARIFI_VOICE_ANALYSIS_ONLY')=='true'
    options=[]
    for row in candidates:
        env=dict(value.split('=',1) for value in runtime.inspect(row['id'])['Config']['Env'])
        if env.get('MASARIFI_PROCESS_KIND')=='worker' and env.get('MASARIFI_AI_ASSISTANT_ONLY')!='true' and (env.get('MASARIFI_VOICE_ANALYSIS_ONLY')=='true')==analysis:options.append(row)
    options.sort(key=lambda row:0 if ('analysis-worker' in row['name'] or 'voice-repair-worker' in row['name']) else 1)
    assert options,'NO_MATCHING_VOICE_WORKER'
    probe(options[0],'voice',finance,features)
    print(json.dumps({'state':'worker-phases-passed','finalApiVerificationPending':True}),flush=True)


if __name__=='__main__':main()
