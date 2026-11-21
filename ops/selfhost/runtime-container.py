"""Render exact effective runtime containers; creation initially limited to a private shadow API."""
import copy
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import re
import socket
import subprocess as sp
import sys
import time
from urllib.parse import parse_qsl,quote,unquote,urlsplit,urlunsplit,urlencode

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
SOURCE='masarifi-production-core-api-20261105-97e66588'
SHADOW='masarifi-selfhost-shadow-core'


class DockerHTTP(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        deadline=os.environ.get('MASARIFI_CUTOVER_DEADLINE')
        remaining=float(deadline)-time.time() if deadline else 60
        if remaining<=0:raise RuntimeError('CUTOVER_DEADLINE_EXCEEDED')
        self.sock.settimeout(min(60,remaining));self.sock.connect('/var/run/docker.sock')


def docker_request(method,path,body=None):
    connection=DockerHTTP('localhost',timeout=60)
    data=json.dumps(body).encode() if body is not None else None
    connection.request(method,path,body=data,headers={'Content-Type':'application/json'} if data is not None else {})
    response=connection.getresponse();payload=response.read();status=response.status;connection.close()
    if status>=400:raise RuntimeError('DOCKER_REQUEST_FAILED: '+str(status)+' errorHash='+hashlib.sha256(payload).hexdigest())
    return json.loads(payload) if payload else None


def inspect(identifier):return docker_request('GET','/containers/'+quote(identifier,safe='')+'/json')


def verify_effective(source):
    expected=next(item for item in json.loads((ROOT/'runtime-originals.json').read_text()) if item['id']==source['Id'])
    spec=importlib.util.spec_from_file_location('inspector',ROOT/'inspect-runtimes.py')
    inspector=importlib.util.module_from_spec(spec);spec.loader.exec_module(inspector)
    result=sp.run(['docker','exec',source['Id'],'/nodejs/bin/node','-e',inspector.NODE],capture_output=True,timeout=45)
    assert result.returncode==0,'EFFECTIVE_RUNTIME_RECHECK_FAILED'
    import base64
    actual=json.loads(result.stdout)
    assert actual['root']==expected['root'] and set(actual['files'])==set(expected['files']),'EFFECTIVE_MODULE_SET_CHANGED'
    assert all(hashlib.sha256(base64.b64decode(body)).hexdigest()==expected['files'][name]['sha256'] for name,body in actual['files'].items()),'EFFECTIVE_MOUNTED_CODE_CHANGED'


def support_files():
    directory=ROOT/'runtime-support';directory.mkdir(mode=0o755,exist_ok=True);directory.chmod(0o755)
    for source,name in [(ROOT/'runtime-adapter.cjs','runtime-adapter.cjs'),(ROOT/'runtime-job-logging.cjs','runtime-job-logging.cjs'),(ROOT/'compiled/platform/config/runtime-scope.js','runtime-scope.js'),(ROOT/'compiled/platform/observability/worker-error.js','worker-error.js')]:
        target=directory/name;target.write_bytes(source.read_bytes());target.chmod(0o644)
    return directory


def render(source,candidate,shadow=False,probe=False):
    assert source['Id']==candidate['id'] and source['Image']==candidate['image'] and source['State']['StartedAt']==candidate['startedAt'],'SOURCE_RUNTIME_CHANGED'
    assert candidate['qualification']['state']=='passed'
    tls=json.loads((ROOT/'database-tls-ready.json').read_text());assert tls['state']=='private-tls-ready'
    credentials=json.loads(Path(tls['credentialsFile']).read_text())
    secret=Path('/etc/masarifi/selfhost/storage.key').read_text().strip()
    config=copy.deepcopy(source['Config']);host=copy.deepcopy(source['HostConfig'])
    config['Image']=source['Image']
    environment=dict(item.split('=',1) for item in config['Env'])
    assert environment['MASARIFI_PROCESS_KIND'] in ('api','worker')
    database_keys=[]
    for key,value in list(environment.items()):
        if not key.endswith('DATABASE_URL'):continue
        parsed=urlsplit(value)
        assert parsed.hostname and ('supabase.com' in parsed.hostname or parsed.hostname.endswith('.supabase.co')),'UNRECOGNIZED_SOURCE_DATABASE_HOST'
        role=unquote(parsed.username).removesuffix('.qcffvfbpzvpwcwxwjyro')
        assert role in credentials,'UNRECOGNIZED_RUNTIME_DATABASE_ROLE'
        parameters=dict(parse_qsl(parsed.query,keep_blank_values=True))
        for obsolete in ('sslmode','sslrootcert','sslcert','sslkey','ssl','uselibpqcompat'):parameters.pop(obsolete,None)
        parameters.update(sslmode='verify-full',sslrootcert='/run/secrets/masarifi-database-ca.crt',application_name=source['Name'].lstrip('/'))
        environment[key]=urlunsplit(('postgresql',quote(role,safe='')+':'+quote(credentials[role],safe='')+'@'+tls['host']+':5432',parsed.path,urlencode(parameters),''))
        database_keys.append(key)
    assert 'DATABASE_URL' in database_keys
    environment.pop('SUPABASE_URL',None);environment.pop('SUPABASE_SERVICE_ROLE_KEY',None)
    environment.update(MASARIFI_RUNTIME_SCOPE='project-server',MASARIFI_STORAGE_PROVIDER='filesystem',MASARIFI_STORAGE_URL='https://api.masarifiratibi.com',MASARIFI_STORAGE_SERVICE_KEY=secret,MASARIFI_LOG_SERVICE=SHADOW if shadow else source['Name'].lstrip('/'),NODE_EXTRA_CA_CERTS='/run/secrets/masarifi-database-ca.crt')
    assert environment.get('NODE_TLS_REJECT_UNAUTHORIZED','1')!='0','UNSAFE_EXISTING_TLS_SETTING'
    config['Env']=[key+'='+value for key,value in environment.items()]
    labels=config.setdefault('Labels',{}) or {};config['Labels']=labels
    labels.update({'masarifi.scope':'selfhost','masarifi.selfhost.patch':'2026-11-13','masarifi.selfhost.original-container':source['Id']})
    mounts=host.get('Mounts') or [];binds=host.get('Binds') or []
    frozen=None
    if not shadow and not probe and (ROOT/'permanent-release.json').exists():
        release=json.loads((ROOT/'permanent-release.json').read_text())
        assert release['state']=='frozen'
        frozen=next(row for row in release['consumers'] if row['id']==source['Id'])
        for mount in mounts:
            if mount['Target'] in frozen['originalMounts']:mount['Source']=frozen['originalMounts'][mount['Target']]['source']
        binds=[(frozen['originalMounts'][b.split(':')[1]]['source']+':'+':'.join(b.split(':')[1:])) if b.split(':')[1] in frozen['originalMounts'] else b for b in binds]
    def mount_file(src,dst):
        nonlocal mounts,binds
        mounts=[m for m in mounts if m['Target']!=dst]
        binds=[b for b in binds if b.split(':')[1]!=dst]
        mounts.append({'Type':'bind','Source':str(src),'Target':dst,'ReadOnly':True,'BindOptions':{'Propagation':'rprivate'}})
    for name,metadata in candidate['files'].items():
        file=(Path(frozen['modules']) if frozen else ROOT/'runtime-candidates'/source['Id'][:12])/name
        assert hashlib.sha256(file.read_bytes()).hexdigest()==metadata['sha256']
        file.chmod(0o644)
        mount_file(file,candidate['root']+'/'+name)
    mount_file(Path(release['support']) if frozen else support_files(),'/app/selfhost')
    mount_file(Path(tls['ca']),'/run/secrets/masarifi-database-ca.crt')
    mount_file(Path(tls['ca']),'/etc/ssl/certs/masarifi-database-ca.crt')
    host['Mounts']=mounts;host['Binds']=binds
    extra=host.get('ExtraHosts') or []
    extra=[entry for entry in extra if not entry.startswith(tls['host']+':')]
    host['ExtraHosts']=[*extra,tls['host']+':'+tls['privateAddress']]
    host['LogConfig']={'Type':'journald','Config':{'tag':'masarifi.'+(SHADOW if shadow else source['Name'].lstrip('/'))}}
    host['AutoRemove']=False
    networks={}
    if shadow or probe:
        if shadow:assert environment['MASARIFI_PROCESS_KIND']=='api'
        host.update(NetworkMode='bridge',PortBindings={},PublishAllPorts=False,RestartPolicy={'Name':'no','MaximumRetryCount':0})
        config['Labels']={key:value for key,value in labels.items() if not key.startswith('com.docker.compose.')}
        config['Labels']['masarifi.role']='worker-probe' if probe else 'shadow-api'
        networks={'bridge':{},'masarifi-selfhost-data':{}}
    elif host['NetworkMode']!='host':
        for name,endpoint in source['NetworkSettings']['Networks'].items():
            assert not endpoint.get('IPAMConfig'),'STATIC_NETWORK_REQUIRES_EXPLICIT_HANDLING'
            networks[name]={'Aliases':endpoint.get('Aliases') or []}
        networks['masarifi-selfhost-data']={}
    body={**config,'HostConfig':host}
    if networks:body['NetworkingConfig']={'EndpointsConfig':networks}
    return body,{'source':source['Name'],'sourceId':source['Id'],'image':source['Image'],'databaseKeys':database_keys,'patchedModules':len(candidate['files']),'shadow':shadow,'networkMode':host['NetworkMode'],'publishedPorts':host.get('PortBindings') or {}}


def main():
    os.umask(0o077)
    assert sys.argv[1:] in (['preflight'],['create-shadow']),'Unknown runtime action'
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text())
    report=[]
    for candidate in candidates:
        source=inspect(candidate['id'])
        verify_effective(source)
        # Pin existing images; never fetch or publish a previous checkout.
        docker_request('GET','/images/'+quote(source['Image'],safe='')+'/json')
        _,metadata=render(source,candidate)
        report.append(metadata)
    (ROOT/'runtime-render-preflight.json').write_text(json.dumps({'state':'passed','consumers':report,'sourceChanged':False},indent=2))
    if sys.argv[1]=='preflight':
        print(json.dumps({'state':'passed','consumers':len(report),'sourceChanged':False}),flush=True);return
    assert sp.run(['docker','inspect',SHADOW],capture_output=True).returncode!=0,'Shadow already exists'
    candidate=next(c for c in candidates if c['name']=='/'+SOURCE)
    source=inspect(candidate['id']);body,metadata=render(source,candidate,shadow=True)
    before={c['id']:inspect(c['id'])['State']['StartedAt'] for c in candidates}
    created=docker_request('POST','/containers/create?name='+SHADOW,body)
    identifier=created['Id'];docker_request('POST','/containers/'+identifier+'/start')
    shadow=inspect(identifier)
    assert not shadow['HostConfig'].get('PortBindings') and shadow['HostConfig']['NetworkMode']=='bridge'
    assert before=={c['id']:inspect(c['id'])['State']['StartedAt'] for c in candidates}
    receipt={'state':'created-private-shadow','container':SHADOW,'id':identifier,'addresses':{name:value['IPAddress'] for name,value in shadow['NetworkSettings']['Networks'].items()},'port':environment_port(body['Env']),'sourceChanged':False,'metadata':metadata}
    (ROOT/'shadow-created.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)


def environment_port(entries):return int(dict(item.split('=',1) for item in entries).get('MASARIFI_HTTP_PORT','3000'))


if __name__=='__main__':main()
