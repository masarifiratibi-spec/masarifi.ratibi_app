"""Rehearsal-only persistence and correlated database-outage checks."""
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp
import time
import uuid
from urllib.error import HTTPError,URLError
import urllib.request

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')


def run(args):
    result=sp.run(args,capture_output=True,timeout=45)
    assert result.returncode==0,'REHEARSAL_COMMAND_FAILED: '+args[0]
    return result.stdout


def get(url,request_id):
    request=urllib.request.Request(url,headers={'x-request-id':request_id})
    try:
        with urllib.request.urlopen(request,timeout=8) as response:return response.status,json.load(response)
    except HTTPError as error:return error.code,json.load(error)


def records(container,request_id):
    result=run(['journalctl','CONTAINER_NAME='+container,'--since','10 minutes ago','--no-pager','-o','cat','--grep',request_id])
    return [json.loads(line) for line in result.splitlines() if line.startswith(b'{')]


def verify_files():
    store=json.loads((ROOT/'storage-prepared.json').read_text());data=Path(store['data'])
    assert data.resolve()==Path('/srv/masarifi/files') and not data.is_symlink()
    manifest=json.loads((ROOT/'files-rehearsal-manifest.json').read_text())
    for item in manifest:
        directory=data/(item['bucket']+'-'+hashlib.sha256(item['key'].encode()).hexdigest())
        body=(directory/'body').read_bytes();metadata=json.loads((directory/'meta.json').read_text())
        assert len(body)==item['bytes'] and hashlib.sha256(body).hexdigest()==item['sha256']
        assert metadata['sha256']==item['sha256'] and metadata['size']==item['bytes']
    return {'objects':len(manifest),'bytes':sum(item['bytes'] for item in manifest)}


def main():
    os.umask(0o077)
    assert json.loads((ROOT/'storage-runtime-verification.json').read_text())['state']=='passed'
    assert json.loads((ROOT/'clerk-auth-verification.json').read_text())['state']=='passed'
    consumers=json.loads((ROOT/'runtime-candidates.json').read_text())
    before={item['id']:json.loads(run(['docker','inspect',item['id']]))[0]['State']['StartedAt'] for item in consumers}
    files_before=verify_files()
    marker='selfhost-log-persistence-'+str(uuid.uuid4())
    path='/storage/v1/object/authenticated/voice-temp/voice/99000000-0000-4000-8000-000000000001/99000000-0000-4000-8000-000000000002'
    assert get('https://api.masarifiratibi.com'+path,marker)[0]==401
    assert records('masarifi-private-storage',marker),'PERSISTENCE_MARKER_NOT_RECORDED'
    run(['docker','restart','--time','10','masarifi-private-storage'])
    assert verify_files()==files_before
    retained=records('masarifi-private-storage',marker)
    assert retained and retained[-1]['requestId']==marker,'JOURNAL_LOST_ON_RESTART'
    shadow=json.loads((ROOT/'shadow-created.json').read_text())
    origin='http://'+shadow['addresses']['masarifi-selfhost-data']+':'+str(shadow['port'])
    assert get(origin+'/health/ready','selfhost-before-db-test')[0]==200
    failure_request='selfhost-db-outage-'+str(uuid.uuid4())
    failed=None
    run(['docker','pause','masarifi-postgres17'])
    try:
        for _ in range(6):
            status,body=get(origin+'/health/ready',failure_request)
            if status==503:
                failed={'status':status,'checks':body.get('checks')};break
            time.sleep(1)
        assert failed and failed['checks']['database']=='down','DATABASE_FAILURE_NOT_DETECTED'
    finally:
        run(['docker','unpause','masarifi-postgres17'])
    for _ in range(10):
        try:
            if get(origin+'/health/ready','selfhost-after-db-test')[0]==200:break
        except (URLError,OSError):pass
        time.sleep(1)
    else:raise AssertionError('DATABASE_READINESS_DID_NOT_RECOVER')
    correlated=records('masarifi-selfhost-shadow-core',failure_request)
    assert any(row.get('message')=='database.failed' for row in correlated),'DATABASE_CAUSE_NOT_CORRELATED'
    assert any(row.get('httpStatus')==503 for row in correlated),'HTTP_FAILURE_NOT_CORRELATED'
    assert all(not any(key in row for key in ('sql','parameters','payload','body','amount','balance')) for row in correlated)
    after={item['id']:json.loads(run(['docker','inspect',item['id']]))[0]['State']['StartedAt'] for item in consumers}
    assert before==after,'Original serving consumer changed'
    receipt={'state':'passed','filesSurvivedRestart':files_before,'journalMarkerSurvivedRestart':marker,'failureRequestId':failure_request,'failure':failed,'correlatedFailureRecords':len(correlated),'databaseRecovered':True,'originalConsumersPreserved':len(before),'sourceDatabaseChanged':False}
    (ROOT/'persistence-and-errors.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
