"""Match target connection capacity to the 28 preserved pools, preserving durable data."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess as sp
import time

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('runtime',ROOT/'runtime-container.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
NAME='masarifi-postgres17'


def sql(query):
    p=sp.run(['docker','exec',NAME,'psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtq','-v','ON_ERROR_STOP=1','-c',query],capture_output=True,timeout=30)
    assert p.returncode==0,'TARGET_CAPACITY_PROBE_FAILED'
    return p.stdout.decode().strip()


def main():
    os.umask(0o077)
    assert not (ROOT/'database-capacity-ready.json').exists(),'Capacity already prepared'
    tls=json.loads((ROOT/'database-tls-ready.json').read_text());assert tls['state']=='private-tls-ready'
    source=runtime.inspect(NAME)
    assert source['HostConfig']['PidsLimit']==128
    assert source['HostConfig']['Memory']==768*1024*1024
    assert not source['HostConfig'].get('PortBindings')
    assert sql("select current_setting('cron.launch_active_jobs')")=='off'
    evidence="select json_build_object('tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','audit') and c.relkind in('r','p')),'migrations',(select count(*) from supabase_migrations.schema_migrations),'history',(select md5(string_agg(to_jsonb(m)::text,'|' order by version)) from supabase_migrations.schema_migrations m))"
    expected=sql(evidence)
    consumers=json.loads((ROOT/'runtime-candidates.json').read_text())
    before={c['id']:runtime.inspect(c['id'])['State']['StartedAt'] for c in consumers}
    config=copy.deepcopy(source['Config']);config['Image']=source['Image']
    config['Cmd']=[*config['Cmd'],'-c','max_connections=280']
    host=copy.deepcopy(source['HostConfig']);host.update(Memory=1536*1024*1024,MemorySwap=1536*1024*1024,PidsLimit=384)
    config['HostConfig']=host
    config['NetworkingConfig']={'EndpointsConfig':{'masarifi-selfhost-data':{'IPAMConfig':{'IPv4Address':tls['privateAddress']}}}}
    runtime.docker_request('POST','/containers/'+source['Id']+'/stop?t=30')
    runtime.docker_request('DELETE','/containers/'+source['Id'])
    created=runtime.docker_request('POST','/containers/create?name='+NAME,config)
    runtime.docker_request('POST','/containers/'+created['Id']+'/start')
    for _ in range(30):
        ready=sp.run(['docker','exec',NAME,'pg_isready','-h','/tmp','-U','supabase_admin'],capture_output=True)
        if ready.returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('TARGET_RESTART_NOT_READY')
    assert sql(evidence)==expected,'DURABLE_CATALOG_CHANGED_ON_RECREATE'
    assert sql("select current_setting('ssl')||':'||current_setting('max_connections')||':'||current_setting('cron.launch_active_jobs')")=='on:280:off'
    updated=runtime.inspect(NAME)
    assert updated['NetworkSettings']['Networks']['masarifi-selfhost-data']['IPAddress']==tls['privateAddress']
    assert before=={c['id']:runtime.inspect(c['id'])['State']['StartedAt'] for c in consumers}
    receipt={'state':'passed','container':NAME,'maxConnections':280,'memoryMiB':1536,'pidsLimit':384,'durableCatalogPreserved':json.loads(expected),'privateAddressPreserved':True,'tlsEnabled':True,'cronActiveJobs':False,'sourceServicesPreserved':len(before),'sourceChanged':False}
    (ROOT/'database-capacity-ready.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
