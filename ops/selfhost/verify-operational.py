"""Read back the actual serving deployment and final public API acceptance."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess as sp
import time
from urllib.error import HTTPError
import urllib.request
import uuid
from urllib.parse import urlsplit

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)


def main():
    os.umask(0o077)
    state=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text())
    assert state['targetMayAcceptWrites'] and state['phase'] in ('operational-target-awaiting-final-acceptance','complete')
    assert not Path('/run/masarifi-selfhost-maintenance').exists()
    runtime=io.load('runtime-container');count=0
    for row in state['newConsumers']:
        container=runtime.inspect(row['id']);environment=dict(value.split('=',1) for value in container['Config']['Env'])
        assert container['State']['Running'] and not container['State']['Restarting'] and container['RestartCount']==0,'TARGET_NOT_STABLE'
        assert container['HostConfig']['LogConfig']['Type']=='journald'
        assert not any(key.startswith('SUPABASE_') for key in environment)
        assert all(urlsplit(value).hostname=='masarifi-postgres17.internal' for key,value in environment.items() if key.endswith('DATABASE_URL'))
        assert container['HostConfig']['RestartPolicy']==next(x['restart'] for x in state['sourceConsumers'] if x['id']==row['sourceId'])
        assert all('/var/tmp/masarifi-selfhost-' not in mount['Source'] for mount in container['Mounts'] if mount['Destination'].startswith(('/app/dist','/app/selfhost')))
        if 'tracking-maintenance' in row['name']:
            repair=json.loads((ROOT/'tracking-entrypoint-repaired.json').read_text())
            entry=next(m for m in container['Mounts'] if m['Destination']=='/app/tracking-acceptance.cjs')
            assert entry['Source']==repair['file'] and not entry['RW']
            assert hashlib.sha256(Path(entry['Source']).read_bytes()).hexdigest()==repair['sha256']
        count+=1
    assert count==28
    for row in state['sourceConsumers']:
        old=runtime.inspect(row['id']);assert not old['State']['Running'] and old['HostConfig']['RestartPolicy']['Name']=='no'
    assert io.source('select count(*) from cron.job where active;')=='0'
    assert io.source("select count(*) from pg_stat_activity where datname=current_database() and usename in ('masarifi_api_login','masarifi_worker_login','authenticator','supabase_storage_admin');")=='0'
    assert io.target("select current_setting('cron.launch_active_jobs')||':'||current_setting('cron.use_background_workers')")=='on:on'
    active=json.loads(io.target("select coalesce(json_agg(jobid order by jobid),'[]'::json) from cron.job where active;"))
    assert active==[row['id'] for row in state['originalCron'] if row['active']]
    assert io.target("select bool_and(not rolsuper and not rolbypassrls) from pg_roles where rolname in ('masarifi_api_login','masarifi_worker_login');")=='t'
    assert io.target("select count(*) from pg_stat_activity a left join pg_stat_ssl s using(pid) where a.usename in ('masarifi_api_login','masarifi_worker_login') and not coalesce(s.ssl,false);")=='0'
    data=json.loads((ROOT/'final-data-verification.json').read_text())
    assert data['state']=='passed' and data['tableCount']==199 and data['sequenceCount']==5
    files=json.loads((ROOT/'files-final-manifest.json').read_text())
    for row in files:
        directory=Path('/srv/masarifi/files')/(row['bucket']+'-'+hashlib.sha256(row['key'].encode()).hexdigest())
        body=(directory/'body').read_bytes();assert len(body)==row['bytes'] and hashlib.sha256(body).hexdigest()==row['sha256']
    gates={name:json.loads((ROOT/(name+'-operational-verification.json')).read_text()) for name in ('clerk-auth','finance-sync','functional-runtime')}
    assert all(value['state']=='passed' and value['operational'] and value['publicHttps'] for value in gates.values())
    request_id='selfhost-final-error-'+str(uuid.uuid4())
    request=urllib.request.Request('https://api.masarifiratibi.com/api/v1/me',headers={'x-request-id':request_id})
    try:
        with urllib.request.urlopen(request,timeout=15) as response:status=response.status
    except HTTPError as error:status=error.code
    assert status==401
    time.sleep(0.2)
    output=io.checked(['journalctl','CONTAINER_NAME='+runtime.SOURCE,'--since','5 minutes ago','--no-pager','-o','cat','--grep',request_id],timeout=30)
    records=[json.loads(line) for line in output.splitlines() if line.startswith(b'{')]
    assert any(row.get('requestId')==request_id and row.get('httpStatus')==401 for row in records),'FINAL_ERROR_NOT_CORRELATED'
    forbidden={'sql','parameters','payload','body','amount','balance','audio','sms','password','token'}
    assert all(not forbidden.intersection(row) for row in records)
    elapsed=round(state['maintenanceEndedAt']-state['startedAt'],3)
    assert elapsed<=1800
    receipt={'state':'passed','runningTargetConsumers':count,'fencedSourceConsumers':len(state['sourceConsumers']),'sourceCronActive':False,'targetCronActiveJobs':len(active),'privateTls':True,'applicationRolesLeastPrivilege':True,'permanentRuntimeCode':True,'originalRestartPolicies':True,'tablesVerifiedBeforeWrites':199,'sequencesVerifiedBeforeWrites':5,'originalFilesVerified':len(files),'maintenanceSeconds':elapsed,'publicHttpsApiAcceptance':list(gates),'correlatedErrorRequestId':request_id,'safeErrorRecords':len(records),'retainedDump':False}
    io.atomic_json(ROOT/'operational-server-acceptance.json',receipt);print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
