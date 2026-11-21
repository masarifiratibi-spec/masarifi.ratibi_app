"""Bounded coordinated cutover. After target activation every failure requires forward repair."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess as sp
import sys
import time
from urllib.error import HTTPError,URLError
import urllib.request
from urllib.parse import quote,urlsplit

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
STATE=Path('/etc/masarifi/selfhost/cutover-state.json')
GATE=Path('/run/masarifi-selfhost-maintenance')
SNIPPET=Path('/etc/nginx/masarifi-selfhost-storage.inc')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
runtime=io.load('runtime-container')


def event(name,**fields):print(json.dumps({'event':name,'time':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**fields}),flush=True)
def save(state):io.atomic_json(STATE,state)
def state():return json.loads(STATE.read_text())


def arm_deadline(deadline):
    os.environ['MASARIFI_CUTOVER_DEADLINE']=str(deadline)
    def expired(signum,frame):raise TimeoutError('CUTOVER_DEADLINE_EXCEEDED')
    signal.signal(signal.SIGALRM,expired)
    signal.setitimer(signal.ITIMER_REAL,max(0.001,deadline-time.time()))


def stop_requested(signum,frame):raise InterruptedError('CUTOVER_STOP_REQUESTED')


def cleanup_transfer_clients():
    filters=quote(json.dumps({'label':['masarifi.selfhost.transfer=20261113']}),safe='')
    for container in runtime.docker_request('GET','/containers/json?all=1&filters='+filters):
        assert container.get('Labels',{}).get('masarifi.selfhost.transfer')=='20261113'
        runtime.docker_request('DELETE','/containers/'+container['Id']+'?force=1')


def parallel(action,items):
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures=[pool.submit(action,item) for item in items]
        # Observe every result, including failures in later services.
        errors=[]
        for future in futures:
            try:future.result()
            except Exception as error:errors.append(error)
        if errors:raise errors[0]


def ready(container,timeout=90):
    if STATE.exists() and state().get('startedAt'):
        timeout=min(timeout,max(1,state()['startedAt']+1800-time.time()-30))
    env=dict(item.split('=',1) for item in container['Config']['Env'])
    port=runtime.environment_port(container['Config']['Env'])
    host=container['HostConfig']
    if host['NetworkMode']=='host':origin='http://127.0.0.1:'+str(port)
    else:
        networks=container['NetworkSettings']['Networks']
        address=networks['masarifi-selfhost-data']['IPAddress'];origin='http://'+address+':'+str(port)
    deadline=time.monotonic()+io.bounded(timeout)
    while time.monotonic()<deadline:
        try:
            with urllib.request.urlopen(urllib.request.Request(origin+'/health/ready',headers={'x-request-id':'selfhost-cutover-readiness'}),timeout=io.bounded(4)) as response:
                if response.status==200:return
        except (HTTPError,URLError,OSError):pass
        time.sleep(1)
    raise RuntimeError('TARGET_API_NOT_READY:'+container['Name'])


def preflight():
    if STATE.exists():
        previous=state()
        assert previous['phase']=='aborted-before-target-writes' and previous['targetMayAcceptWrites'] is False,'CUTOVER_STATE_EXISTS_REVIEW_BEFORE_RESUMING'
        assert not GATE.exists(),'ABORT_MAINTENANCE_MARKER_REMAINS'
        for row in previous['sourceConsumers']:
            source=runtime.inspect(row['id'])
            assert source['State']['Running']==row['running'] and source['HostConfig']['RestartPolicy']==row['restart'],'SOURCE_RECOVERY_INCOMPLETE'
        current_catalog=json.loads(io.source((ROOT/'catalog-summary.sql').read_text()))
        assert current_catalog['database']['acl']==previous['originalCatalog']['database']['acl'],'SOURCE_ACL_NOT_RESTORED'
        current_cron=json.loads(io.source("select coalesce(json_agg(json_build_object('id',jobid,'active',active) order by jobid),'[]'::json) from cron.job;"))
        assert current_cron==previous['originalCron'],'SOURCE_CRON_NOT_RESTORED'
        io.atomic_json(ROOT/('aborted-attempt-'+str(int(previous['startedAt']))+'.json'),previous)
        STATE.unlink()
    assert json.loads((ROOT/'file-route-ready.json').read_text())['state']=='https-private-storage-ready','HTTPS_FILE_ROUTE_NOT_QUALIFIED'
    for name in ('storage-runtime-verification.json','storage-static-address.json','clerk-auth-verification.json','finance-sync-verification.json','persistence-and-errors.json','functional-runtime-verification.json','final-tools-qualified.json','extension-data-qualified.json','api-startup-verification.json','review-qualified.json'):
        assert json.loads((ROOT/name).read_text())['state']=='passed','MISSING_GATE:'+name
    release=json.loads((ROOT/'permanent-release.json').read_text());assert release['state']=='frozen'
    audit=json.loads((ROOT/'host-audit.json').read_text())
    assert not audit['nativeDatabaseConsumers'] and not audit['nativeStorageConsumers']
    assert not [unit for unit in audit['projectUnits'] if unit['sub']=='running' and (unit.get('inlineSourceMention') or unit.get('inlineDatabaseMention'))]
    assert not [row for row in audit['unitScripts'] if row['sourceProviderMention'] or row['directDatabaseMention']],'NATIVE_SCRIPT_REQUIRES_REVIEW'
    assert not [row for row in audit['containerStorageConsumers'] if not row['databaseConsumer']]
    assert audit['journal']['persistentDirectory'] and audit['journal']['configured']['MaxRetentionSec']=='7day'
    assert audit['capacity']['diskFree']>5*1024**3
    assert io.target("select current_setting('cron.launch_active_jobs')")=='off'
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text());assert len(candidates)==28
    for candidate in candidates:
        source=runtime.inspect(candidate['id']);runtime.verify_effective(source);runtime.render(source,candidate)
    # A role/schema change after the qualified rehearsal requires a new rehearsal.
    original=json.loads(io.source((ROOT/'catalog-summary.sql').read_text()))
    expected=json.loads((ROOT/'catalog-comparison-qualified.json').read_text())['source']
    assert all(original[key]==expected[key] for key in original if key!='constraints'),'SOURCE_CATALOG_CHANGED'
    constraints=io.load('constraint-tree')
    target_constraints=json.loads(io.target((ROOT/'catalog-summary.sql').read_text()))['constraints']
    assert len(original['constraints'])==len(target_constraints)
    for left,right in zip(original['constraints'],target_constraints):
        assert {k:v for k,v in left.items() if k not in ('definition','expression_tree')}=={k:v for k,v in right.items() if k not in ('definition','expression_tree')}
        assert left['definition']==right['definition'] or (left['expression_tree'] is not None and constraints.canonical_tree(left['expression_tree'])==constraints.canonical_tree(right['expression_tree']))
    capabilities=json.loads(io.source("select json_build_object('owner',current_user='postgres','databaseOwner',(select pg_get_userbyid(datdba)=current_user from pg_database where datname=current_database()),'signal',pg_has_role(current_user,'pg_signal_backend','MEMBER'));"))
    assert all(capabilities.values()),'SOURCE_FENCE_CAPABILITY_MISSING'
    # Check every old source consumer, including stopped containers with restart policies.
    containers=json.loads(io.checked(['docker','inspect',*io.checked(['docker','ps','-aq']).decode().split()]))
    old=[]
    for container in containers:
        env=dict(value.split('=',1) for value in container['Config']['Env'] or [] if '=' in value)
        if any('supabase' in (urlsplit(value).hostname or '') for key,value in env.items() if key.endswith('DATABASE_URL')):
            old.append({'id':container['Id'],'name':container['Name'].lstrip('/'),'running':container['State']['Running'],'restart':container['HostConfig']['RestartPolicy']})
    assert {row['id'] for row in old if row['running']}=={row['id'] for row in candidates},'SOURCE_CONSUMER_SET_CHANGED'
    cron=json.loads(io.source("select coalesce(json_agg(json_build_object('id',jobid,'active',active) order by jobid),'[]'::json) from cron.job;"))
    assert len(cron)==1,'SOURCE_CRON_SET_CHANGED'
    # The hosted owner may execute cron.alter_job but cannot UPDATE cron.job.
    # Qualify the actual no-op management path in a rolled-back transaction.
    io.source('begin;'+''.join('select cron.alter_job('+str(int(row['id']))+',active=>'+('true' if row['active'] else 'false')+');' for row in cron)+'rollback;',write=True)
    snippet=SNIPPET.read_text();line='    if (-f '+str(GATE)+') { return 503; }\n'
    if line not in snippet:
        assert snippet.count('location ^~ /storage/v1/object/ {\n')==1
        updated=snippet.replace('location ^~ /storage/v1/object/ {\n','location ^~ /storage/v1/object/ {\n'+line)
        SNIPPET.write_text(updated)
        try:io.checked(['nginx','-t']);io.checked(['systemctl','reload','nginx'])
        except Exception:SNIPPET.write_text(snippet);raise
    prepared={'phase':'prepared','targetMayAcceptWrites':False,'originalCatalog':original,'originalCron':cron,'sourceConsumers':old,'newConsumers':[],'release':release['release']}
    save(prepared);event('cutover.prepared',consumers=len(candidates),inactiveSources=len(old)-len(candidates),maintenanceStarted=False)


def source_access_restore(current):
    # Only used before any operational target service can accept writes.
    assert current['targetMayAcceptWrites'] is False,'SOURCE_RETURN_FORBIDDEN_AFTER_TARGET_ACTIVATION'
    commands=['begin;','grant connect on database postgres to public;']
    if not any(row['grantee']=='pgbouncer' and row['privilege']=='CONNECT' for row in current['originalCatalog']['database']['acl']):commands.append('revoke connect on database postgres from pgbouncer;')
    commands.extend('select cron.alter_job('+str(int(row['id']))+',active=>'+('true' if row['active'] else 'false')+');' for row in current['originalCron'])
    commands.append('commit;');io.source('\n'.join(commands),write=True)


def abort():
    current=state();assert not current['targetMayAcceptWrites'],'FIX_FORWARD_REQUIRED_SOURCE_RETURN_FORBIDDEN'
    # Reserve the last five minutes of the authorized window for source recovery.
    signal.signal(signal.SIGTERM,signal.SIG_IGN)
    arm_deadline(current.get('startedAt',time.time())+1800)
    if current['phase'] not in ('prepared','aborted-before-target-writes'):
        target=runtime.inspect('masarifi-postgres17')
        assert target['Config']['Labels'].get('masarifi.scope')=='selfhost'
        if target['State']['Running']:runtime.docker_request('POST','/containers/'+target['Id']+'/stop?t=20')
    cleanup_transfer_clients()
    source_access_restore(current)
    for row in current['sourceConsumers']:
        runtime.docker_request('POST','/containers/'+row['id']+'/update',{'RestartPolicy':row['restart']})
    parallel(lambda row:runtime.docker_request('POST','/containers/'+row['id']+'/start'),[row for row in current['sourceConsumers'] if row['running'] and not runtime.inspect(row['id'])['State']['Running']])
    GATE.unlink(missing_ok=True)
    current['phase']='aborted-before-target-writes';current['endedAt']=time.time();save(current)
    event('cutover.aborted',targetAcceptedWrites=False,maintenanceSeconds=round(current['endedAt']-current.get('startedAt',current['endedAt']),3))


def freeze():
    current=state();assert current['phase']=='prepared' and not current['targetMayAcceptWrites']
    current['startedAt']=time.time();current['phase']='freezing-source';save(current)
    # All Docker, SQL and subprocess calls inherit the absolute work deadline.
    arm_deadline(current['startedAt']+1500)
    GATE.touch(mode=0o600,exist_ok=False)
    for row in current['sourceConsumers']:runtime.docker_request('POST','/containers/'+row['id']+'/update',{'RestartPolicy':{'Name':'no','MaximumRetryCount':0}})
    io.source('begin;'+''.join('select cron.alter_job('+str(int(row['id']))+',active=>false);' for row in current['originalCron'] if row['active'])+'commit;',write=True)
    parallel(lambda row:runtime.docker_request('POST','/containers/'+row['id']+'/stop?t=30'),[row for row in current['sourceConsumers'] if row['running']])
    shadow=runtime.inspect('masarifi-selfhost-shadow-core')
    assert shadow['Config']['Labels'].get('masarifi.role')=='shadow-api'
    if shadow['State']['Running']:runtime.docker_request('POST','/containers/'+shadow['Id']+'/stop?t=20')
    for _ in range(30):
        active=io.source("select count(*) from pg_stat_activity where pid<>pg_backend_pid() and application_name like 'pg_cron%' and backend_type<>'pg_cron launcher' and state='active';")
        if active=='0':break
        time.sleep(1)
    else:raise RuntimeError('SOURCE_CRON_STILL_RUNNING')
    current['phase']='writers-stopped';save(current)
    # Supabase Storage needs its DB connection while reading. Copy first, then
    # fence its backend and compare the frozen manifest before final DB transfer.
    sp.run(['python3','-I',str(ROOT/'copy-files-rehearsal.py'),'--final'],check=True,timeout=io.bounded(300))
    io.source("""begin;
grant connect on database postgres to pgbouncer;
revoke connect on database postgres from public;
do $$begin
 if exists(select 1 from pg_roles where rolname in ('masarifi_api_login','masarifi_worker_login','authenticator','anon','authenticated','service_role','supabase_storage_admin') and has_database_privilege(oid,current_database(),'CONNECT')) then
 raise exception 'SOURCE_CONNECT_FENCE_INCOMPLETE';end if;
end$$;
commit;""",write=True)
    io.source("select pg_terminate_backend(a.pid) from pg_stat_activity a join pg_roles r on r.rolname=a.usename where a.datname=current_database() and a.pid<>pg_backend_pid() and not r.rolsuper and a.usename not in ('postgres','pgbouncer');",write=True)
    objects=json.loads(io.source("select coalesce(json_agg(json_build_object('bucket',bucket_id,'key',name,'metadata',metadata) order by bucket_id,name),'[]'::json) from storage.objects;"))
    assert hashlib.sha256(json.dumps(objects,sort_keys=True).encode()).hexdigest()==json.loads((ROOT/'files-final.json').read_text())['sourceMetadataDigest'],'FILES_CHANGED_BEFORE_SOURCE_FENCE'
    current['phase']='source-fenced';save(current);event('source.fenced',consumersStopped=sum(row['running'] for row in current['sourceConsumers']),sourceCron=False)


def activate_apis():
    current=state();assert current['phase']=='data-verified' and not current['targetMayAcceptWrites']
    assert time.time()-current['startedAt']<900,'INSUFFICIENT_MAINTENANCE_BUDGET'
    assert json.loads((ROOT/'final-data-verification.json').read_text())['state']=='passed'
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text())
    bodies=[]
    for candidate in candidates:
        original=runtime.inspect(candidate['id']);assert not original['State']['Running']
        body,metadata=runtime.render(original,candidate)
        # Source policies are temporarily fenced to no; retain the captured policy.
        body['HostConfig']['RestartPolicy']=next(row['restart'] for row in current['sourceConsumers'] if row['id']==candidate['id'])
        bodies.append((candidate,body,metadata))
    enable_idle_target_scheduler()
    # Published and host-network APIs may receive writes as soon as started.
    # Persist the one-way boundary BEFORE creating or starting any new service.
    current['targetMayAcceptWrites']=True;current['phase']='activating-apis';save(current)
    for candidate,body,metadata in bodies:
        name=candidate['name'].lstrip('/')
        runtime.docker_request('POST','/containers/'+candidate['id']+'/rename?name='+quote(name+'-supabase-frozen-20261113',safe=''))
        created=runtime.docker_request('POST','/containers/create?name='+quote(name,safe=''),body)
        row={'id':created['Id'],'name':name,'sourceId':candidate['id'],'kind':dict(value.split('=',1) for value in body['Env'])['MASARIFI_PROCESS_KIND']}
        current['newConsumers'].append(row);save(current)
    def start_api(row):
        runtime.docker_request('POST','/containers/'+row['id']+'/start');ready(runtime.inspect(row['id']))
        event('target.api.ready',service=row['name'])
    parallel(start_api,[row for row in current['newConsumers'] if row['kind']=='api'])
    current['phase']='apis-active';save(current)


def enable_idle_target_scheduler():
    current=state();assert current['phase']=='data-verified' and not current['targetMayAcceptWrites']
    assert io.target('select count(*) from cron.job where active;')=='0'
    # Recreate only our private DB to remove the command-line cron-off override.
    original=runtime.inspect('masarifi-postgres17')
    runtime.docker_request('GET','/images/'+original['Image']+'/json')
    config=original['Config'].copy();host=original['HostConfig'].copy()
    command=list(config['Cmd']);assert command.count('cron.launch_active_jobs=off')==1
    command[command.index('cron.launch_active_jobs=off')]='cron.launch_active_jobs=on'
    command+=['-c','cron.use_background_workers=on','-c','cron.log_statement=off','-c','cron.log_run=off']
    config['Cmd']=command;config['Image']=original['Image']
    endpoints={name:{'IPAMConfig':{'IPv4Address':endpoint['IPAddress']}} for name,endpoint in original['NetworkSettings']['Networks'].items()}
    runtime.docker_request('POST','/containers/'+original['Id']+'/stop?t=20')
    runtime.docker_request('DELETE','/containers/'+original['Id'])
    created=runtime.docker_request('POST','/containers/create?name=masarifi-postgres17',{**config,'HostConfig':host,'NetworkingConfig':{'EndpointsConfig':endpoints}})
    runtime.docker_request('POST','/containers/'+created['Id']+'/start')
    for _ in range(30):
        try:
            if io.target("select current_setting('cron.launch_active_jobs')||':'||current_setting('cron.use_background_workers')")=='on:on':break
        except RuntimeError:pass
        time.sleep(1)
    else:raise RuntimeError('TARGET_CRON_RESTART_FAILED')
    event('target.scheduler.ready',activeJobs=False)


def activate_workers():
    current=state();assert current['phase']=='apis-active' and current['targetMayAcceptWrites']
    for row in current['newConsumers']:
        if row['kind']=='worker':runtime.docker_request('POST','/containers/'+row['id']+'/start')
    for row in current['originalCron']:io.target('update cron.job set active='+('true' if row['active'] else 'false')+' where jobid='+str(int(row['id']))+';')
    def verify_consumer(row):
        container=runtime.inspect(row['id']);assert container['State']['Running'],'TARGET_CONSUMER_EXITED:'+row['name']
        if row['kind']=='api':ready(container)
    parallel(verify_consumer,current['newConsumers'])
    current['phase']='all-active';save(current);event('target.workers-and-cron.active',sourceCron=False)


def release():
    current=state();assert current['phase']=='all-active' and current['targetMayAcceptWrites']
    assert io.source('select count(*) from cron.job where active;')=='0'
    assert io.source("select count(*) from pg_stat_activity where datname=current_database() and usename in ('masarifi_api_login','masarifi_worker_login','authenticator','supabase_storage_admin');")=='0'
    for row in current['newConsumers']:
        container=runtime.inspect(row['id']);env=dict(value.split('=',1) for value in container['Config']['Env'])
        assert container['State']['Running'] and container['HostConfig']['LogConfig']['Type']=='journald'
        assert container['HostConfig']['RestartPolicy']==next(source['restart'] for source in current['sourceConsumers'] if source['id']==row['sourceId']),'TARGET_RESTART_POLICY_DRIFT'
        assert not any(key.startswith('SUPABASE_') for key in env)
        assert all(urlsplit(value).hostname=='masarifi-postgres17.internal' for key,value in env.items() if key.endswith('DATABASE_URL'))
        assert all('/var/tmp/masarifi-selfhost-' not in mount['Source'] for mount in container['Mounts'] if mount['Destination'].startswith(('/app/dist','/app/selfhost'))),'TEMPORARY_RUNTIME_CODE_BIND'
    GATE.unlink()
    current['phase']='operational-target-awaiting-final-acceptance';current['maintenanceEndedAt']=time.time();save(current)
    elapsed=round(current['maintenanceEndedAt']-current['startedAt'],3)
    event('cutover.routing.released',maintenanceSeconds=elapsed,withinThirtyMinutes=elapsed<=1800,sourceWrites=False)
    assert elapsed<=1800,'MAINTENANCE_EXCEEDED_THIRTY_MINUTES'


def main():
    os.umask(0o077)
    assert len(sys.argv)==2 and sys.argv[1] in ('prepare','run','abort-before-writes','status')
    action=sys.argv[1]
    if action=='prepare':preflight();return
    if action=='status':
        current=state();event('cutover.status',phase=current['phase'],targetMayAcceptWrites=current['targetMayAcceptWrites']);return
    if action=='abort-before-writes':abort();return
    assert state()['phase']=='prepared'
    previous_stop=signal.signal(signal.SIGTERM,stop_requested)
    try:
        freeze()
        sp.run(['python3','-I',str(ROOT/'final-database.py')],check=True,timeout=io.bounded(900))
        activate_apis();activate_workers();release()
    except BaseException as error:
        current=state();event('cutover.failed',phase=current['phase'],errorHash=hashlib.sha256(str(error).encode()).hexdigest(),targetMayAcceptWrites=current['targetMayAcceptWrites'])
        if not current['targetMayAcceptWrites']:abort()
        else:event('cutover.fix-forward.required',sourceReturnForbidden=True)
        raise
    finally:
        if hasattr(signal,'setitimer'):signal.setitimer(signal.ITIMER_REAL,0)
        signal.signal(signal.SIGTERM,previous_stop)


if __name__=='__main__':main()
