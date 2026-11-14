"""Remove only the known disposable feature files before the final fresh copy."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
import urllib.request

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)


def main():
    os.umask(0o077)
    state=Path('/etc/masarifi/selfhost/cutover-state.json')
    assert not state.exists() or json.loads(state.read_text())['targetMayAcceptWrites'] is False
    assert json.loads((ROOT/'functional-runtime-verification.json').read_text())['state']=='passed'
    fixture=json.loads((ROOT/'functional-fixtures.json').read_text())
    query="select json_build_object('voice',(select storage_ref from public.voice_sessions where id="+io.ql(fixture['voiceSessionId'])+"::uuid),'report',(select storage_ref from private.report_output_attempts where id="+io.ql(fixture['reportId'])+"::uuid));"
    refs=json.loads(io.target(query));ready=json.loads((ROOT/'storage-prepared.json').read_text())
    secret=Path(ready['keyFile']).read_text().strip();data=Path(ready['data'])
    assert data.resolve()==Path('/srv/masarifi/files') and not data.is_symlink()
    original=json.loads((ROOT/'files-rehearsal-manifest.json').read_text())
    preserved={data/(row['bucket']+'-'+hashlib.sha256(row['key'].encode()).hexdigest()) for row in original}
    owned=[]
    for kind,bucket in [('voice','voice-temp'),('report','report-exports')]:
        key=refs[kind]
        if key is None:continue
        assert isinstance(key,str) and key.startswith('voice/' if kind=='voice' else 'reports/')
        directory=data/(bucket+'-'+hashlib.sha256(key.encode()).hexdigest())
        assert directory not in preserved
        owned.append((bucket,key,directory))
    assert set(data.iterdir()).issubset(preserved|{row[2] for row in owned}),'UNKNOWN_TARGET_FILE_REQUIRES_REVIEW'
    removed=0
    for bucket,key,directory in owned:
        present=directory.exists()
        request=urllib.request.Request(ready['listen']+'/storage/v1/object/'+quote(bucket,safe='')+'/'+quote(key,safe='/'),method='DELETE',headers={'Authorization':'Bearer '+secret,'apikey':secret,'x-request-id':'selfhost-owned-fixture-cleanup'})
        try:
            with urllib.request.urlopen(request,timeout=10) as response:assert response.status in (200,204)
        except HTTPError as error:
            assert error.code==404,'FIXTURE_DELETE_FAILED'
        assert not directory.exists(),'FIXTURE_FILE_REMAINS'
        removed+=int(present)
    assert set(data.iterdir())==preserved,'ORIGINAL_FILES_CHANGED'
    files=io.load('verify-persistence-and-errors').verify_files()
    receipt={'state':'passed','fixtureFilesRemoved':removed,'preserved':files,'sourceChanged':False}
    io.atomic_json(ROOT/'functional-files-cleaned.json',receipt);print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
