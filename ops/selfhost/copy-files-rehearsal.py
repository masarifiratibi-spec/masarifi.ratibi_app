"""Stream existing private objects into the target store; receipts contain no file bodies or keys."""
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp
import time
import sys
import importlib.util
import shutil
from urllib.error import HTTPError
from urllib.parse import quote
import urllib.request

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
LIMITS={'tracking-imports':6291456,'voice-temp':12582912,'support-attachments':10485760,'report-exports':536870912}


def main():
    os.umask(0o077)
    assert sys.argv[1:] in ([],['--final'])
    final=sys.argv[1:]==['--final']
    ready=json.loads((ROOT/'storage-prepared.json').read_text())
    assert ready['state']=='private-ready' and ready['publicRouteChanged'] is False
    origin=ready['listen']
    secret=Path(ready['keyFile']).read_text().strip()
    api=json.loads(sp.check_output(['docker','inspect','masarifi-production-core-api-20261105-97e66588']))[0]
    environment=dict(v.split('=',1) for v in api['Config']['Env'])
    assert environment['SUPABASE_URL']=='https://qcffvfbpzvpwcwxwjyro.supabase.co'
    source_origin=environment['SUPABASE_URL'];source_secret=environment['SUPABASE_SERVICE_ROLE_KEY']
    query="select coalesce(json_agg(json_build_object('bucket',bucket_id,'key',name,'metadata',metadata) order by bucket_id,name),'[]'::json) from storage.objects;"
    if final:
        spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
        io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
        state=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text())
        assert state['phase']=='writers-stopped' and state['targetMayAcceptWrites'] is False
        objects=json.loads(io.source(query))
        original_manifest=json.loads((ROOT/'files-rehearsal-manifest.json').read_text())
        data=Path(ready['data']);assert data.resolve()==Path('/srv/masarifi/files') and not data.is_symlink()
        known={data/(row['bucket']+'-'+hashlib.sha256(row['key'].encode()).hexdigest()):row for row in original_manifest}
        assert set(data.iterdir()).issubset(set(known)),'UNEXPECTED_TARGET_FILE_REQUIRES_REVIEW'
        for directory,row in known.items():
            if not directory.exists():continue
            assert directory.parent==data and not directory.is_symlink()
            assert hashlib.sha256((directory/'body').read_bytes()).hexdigest()==row['sha256'],'REHEARSAL_FILE_CHANGED'
            shutil.rmtree(directory)
    else:
        p=sp.run(['docker','exec','masarifi-postgres17-rehearsal','psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtc',query],capture_output=True,timeout=15)
        assert p.returncode==0,'OBJECT_MANIFEST_READ_FAILED'
        objects=json.loads(p.stdout)
    manifest=[];started=time.monotonic()
    for item in objects:
        bucket=item['bucket'];key=item['key'];metadata=item['metadata']
        assert bucket in LIMITS and isinstance(key,str)
        size=int(metadata['size']);assert 0<size<=LIMITS[bucket]
        encoded=quote(bucket,safe='')+'/'+quote(key,safe='/')
        source_request=urllib.request.Request(source_origin+'/storage/v1/object/authenticated/'+encoded,headers={'Authorization':'Bearer '+source_secret,'apikey':source_secret})
        digest=hashlib.sha256();received=0
        with urllib.request.urlopen(source_request,timeout=30) as source:
            content_type=source.headers.get('Content-Type','').split(';')[0]
            assert content_type==metadata.get('mimetype'), 'SOURCE_CONTENT_TYPE_CHANGED'
            def chunks():
                nonlocal received
                while True:
                    chunk=source.read(65536)
                    if not chunk:break
                    received+=len(chunk)
                    if received>size:raise RuntimeError('SOURCE_SIZE_CHANGED')
                    digest.update(chunk);yield chunk
                assert received==size,'SOURCE_SIZE_CHANGED'
            headers={'Authorization':'Bearer '+secret,'apikey':secret,'Content-Type':content_type,'Content-Length':str(size),'x-request-id':'selfhost-copy-'+hashlib.sha256(key.encode()).hexdigest()[:16]}
            upload=urllib.request.Request(origin+'/storage/v1/object/'+encoded,data=chunks(),headers=headers,method='PUT')
            try:
                with urllib.request.urlopen(upload,timeout=60) as response:assert response.status==200
            except HTTPError as error:
                if error.code!=409:raise RuntimeError('TARGET_OBJECT_UPLOAD_FAILED') from None
        sha=digest.hexdigest()
        probe=urllib.request.Request(origin+'/storage/v1/object/authenticated/'+encoded,headers={'Authorization':'Bearer '+secret,'apikey':secret},method='HEAD')
        with urllib.request.urlopen(probe,timeout=10) as response:
            assert int(response.headers['Content-Length'])==size
            assert response.headers.get('ETag','').strip('"')==sha,'TARGET_CHECKSUM_MISMATCH'
            assert response.headers.get('Content-Type','').split(';')[0]==content_type
        manifest.append({'bucket':bucket,'key':key,'bytes':size,'sha256':sha,'contentType':content_type})
    encoded_manifest=json.dumps(manifest,sort_keys=True).encode()
    # This private index is migration bookkeeping, separate from diagnostics.
    if final:assert json.loads(io.source(query))==objects,'SOURCE_FILES_CHANGED_DURING_COPY'
    (ROOT/('files-final-manifest.json' if final else 'files-rehearsal-manifest.json')).write_bytes(encoded_manifest)
    receipt={'state':'passed','objects':len(manifest),'bytes':sum(x['bytes'] for x in manifest),
             'manifestSha256':hashlib.sha256(encoded_manifest).hexdigest(),'seconds':round(time.monotonic()-started,3),
             'data':ready['data'],'sourceChanged':False,'publicRouteChanged':False}
    if final:receipt['sourceMetadataDigest']=hashlib.sha256(json.dumps(objects,sort_keys=True).encode()).hexdigest()
    (ROOT/('files-final.json' if final else 'files-rehearsal.json')).write_text(json.dumps(receipt,indent=2))
    print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
