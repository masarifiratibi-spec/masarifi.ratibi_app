"""Add only the private store's HTTPS location; existing API routing stays intact."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess as sp
import time
from urllib.error import HTTPError
import urllib.request

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
SITE=Path('/etc/nginx/sites-enabled/masarifi-production-core-20261105.conf')
SNIPPET=Path('/etc/nginx/masarifi-selfhost-storage.inc')
ORIGIN='https://api.masarifiratibi.com'


def checked(args):
    result=sp.run(args,capture_output=True,timeout=30)
    if result.returncode:raise RuntimeError('FILE_ROUTE_COMMAND_FAILED: '+args[0]+' errorHash='+hashlib.sha256(result.stderr).hexdigest())
    return result.stdout


def main():
    os.umask(0o077)
    assert not (ROOT/'file-route-ready.json').exists(),'HTTPS file route already prepared'
    ready=json.loads((ROOT/'storage-prepared.json').read_text());assert ready['state']=='private-ready'
    store=json.loads(checked(['docker','inspect','masarifi-private-storage']))[0]
    address=store['NetworkSettings']['Networks']['masarifi-selfhost-data']['IPAddress']
    assert ready['listen']=='http://'+address+':8080'
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text())
    before={c['id']:json.loads(checked(['docker','inspect',c['id']]))[0]['State']['StartedAt'] for c in candidates}
    target=SITE.resolve();assert str(target).startswith('/etc/nginx/') and target.is_file()
    original=target.read_bytes();text=original.decode();stat=target.stat()
    assert '/storage/v1/object/' not in text,'Existing file route needs reconciliation'
    inclusion='\n    include '+str(SNIPPET)+';'
    resumed=str(SNIPPET) in text
    if resumed:
        assert text.count(inclusion)==1,'Unexpected existing snippet inclusion'
        original=text.replace(inclusion,'',1).encode();text=original.decode()
    matches=list(re.finditer(r'(?m)^[ \t]*server_name api\.masarifiratibi\.com;[ \t]*$',text))
    assert len(matches)==2,'PUBLIC_API_SERVER_SHAPE_CHANGED'
    tls=[m for m in matches if any('listen 443 ssl;' in line for line in text[:m.start()].splitlines()[-4:])]
    assert len(tls)==1,'HTTPS_SERVER_IDENTITY_UNQUALIFIED'
    offset=tls[0].end();updated=(text[:offset]+'\n    include '+str(SNIPPET)+';'+text[offset:]).encode()
    snippet='''# Private capabilities are validated by the storage service. Never log their URLs.
location ^~ /storage/v1/object/ {
    access_log off;
    error_log /dev/null crit;
    client_max_body_size 512m;
    proxy_http_version 1.1;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_read_timeout 65s;
    proxy_send_timeout 65s;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Request-Id $http_x_request_id;
    proxy_set_header Connection "";
    proxy_pass http://'''+address+''':8080;
}
'''
    if SNIPPET.exists():assert SNIPPET.read_text()==snippet,'Existing snippet content differs'
    else:SNIPPET.write_text(snippet);SNIPPET.chmod(0o644)
    def replace(data):
        temporary=target.with_name(target.name+'.selfhost-new');temporary.write_bytes(data);temporary.chmod(stat.st_mode & 0o777);os.chown(temporary,stat.st_uid,stat.st_gid);temporary.replace(target)
    try:
        if resumed:
            assert target.read_bytes()==updated,'Existing site differs from staged route'
            checked(['nginx','-t'])
        else:
            replace(updated);checked(['nginx','-t']);checked(['systemctl','reload','nginx'])
    except Exception:
        replace(original)
        # The previous configuration remains reviewable and the live master keeps
        # its validated workers if reload was rejected. No source API is restarted.
        checked(['nginx','-t'])
        raise
    request_id='selfhost-files-https-route-probe'
    url=ORIGIN+'/storage/v1/object/authenticated/voice-temp/voice/99000000-0000-4000-8000-000000000001/99000000-0000-4000-8000-000000000002'
    for attempt in range(5):
        try:
            urllib.request.urlopen(urllib.request.Request(url,headers={'x-request-id':request_id}),timeout=15)
            raise AssertionError('UNAUTHENTICATED_PUBLIC_FILE_READ_ALLOWED')
        except HTTPError as error:
            payload=json.load(error)
            if error.code==401 and payload.get('code')=='STORAGE_AUTH_REQUIRED' and payload.get('requestId')==request_id:break
            if attempt==4:raise AssertionError('PUBLIC_FILE_ROUTE_PROBE_FAILED') from None
            # reload returns before Nginx's replacement workers take traffic.
            time.sleep(0.5)
    after={c['id']:json.loads(checked(['docker','inspect',c['id']]))[0]['State']['StartedAt'] for c in candidates}
    assert before==after,'Serving API or worker changed'
    receipt={'state':'https-private-storage-ready','publicOrigin':ORIGIN,'site':str(target),'snippet':str(SNIPPET),'sourceSiteSha256':hashlib.sha256(original).hexdigest(),'siteSha256':hashlib.sha256(updated).hexdigest(),'snippetSha256':hashlib.sha256(snippet.encode()).hexdigest(),'privateAddress':address,'unauthenticatedRead':401,'probeRequestId':request_id,'capabilityUrlsLogged':False,'servingConsumersPreserved':len(before),'sourceDatabaseChanged':False}
    (ROOT/'file-route-ready.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
