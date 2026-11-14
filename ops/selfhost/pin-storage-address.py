"""Pin the already-qualified store address; retain the exact image, files and signing key."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError,URLError
import urllib.request

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)
runtime=io.load('runtime-container')


def main():
    os.umask(0o077)
    source=runtime.inspect('masarifi-private-storage')
    assert source['Config']['Labels'].get('masarifi.scope')=='selfhost'
    mounts={row['Destination']:row['Source'] for row in source['Mounts']}
    assert mounts['/data']=='/srv/masarifi/files' and mounts['/run/secrets/storage-key']=='/etc/masarifi/selfhost/storage.key'
    endpoint=source['NetworkSettings']['Networks']['masarifi-selfhost-data'];address=endpoint['IPAddress']
    ready=json.loads((ROOT/'storage-prepared.json').read_text());assert ready['listen']=='http://'+address+':8080'
    config=copy.deepcopy(source['Config']);config['Image']=source['Image'];host=copy.deepcopy(source['HostConfig'])
    runtime.docker_request('GET','/images/'+source['Image']+'/json')
    if endpoint.get('IPAMConfig',{}).get('IPv4Address')==address:
        created={'Id':source['Id']}
    else:
        body={**config,'HostConfig':host,'NetworkingConfig':{'EndpointsConfig':{'masarifi-selfhost-data':{'IPAMConfig':{'IPv4Address':address}}}}}
        io.atomic_json(ROOT/'storage-recreation-config.json',body)
        runtime.docker_request('POST','/containers/'+source['Id']+'/stop?t=20')
        runtime.docker_request('POST','/containers/'+source['Id']+'/rename?name=masarifi-private-storage-pre-static')
        created=runtime.docker_request('POST','/containers/create?name=masarifi-private-storage',body)
        runtime.docker_request('POST','/containers/'+created['Id']+'/start')
    for _ in range(30):
        try:
            with urllib.request.urlopen(ready['listen']+'/health/ready',timeout=3) as response:
                if response.status==200:break
        except (HTTPError,URLError,OSError):pass
        time.sleep(1)
    else:raise RuntimeError('PINNED_STORAGE_NOT_READY')
    current=runtime.inspect(created['Id']);assert current['NetworkSettings']['Networks']['masarifi-selfhost-data']['IPAMConfig']['IPv4Address']==address
    assert current['Image']==source['Image']
    if created['Id']!=source['Id']:runtime.docker_request('DELETE','/containers/'+source['Id'])
    # Real adapters exercise the public HTTPS route, all buckets and retained data.
    io.checked(['python3','-I',str(ROOT/'verify-storage-runtime.py')],timeout=90)
    persistence=io.load('verify-persistence-and-errors');files=persistence.verify_files()
    receipt={'state':'passed','address':address,'staticAddress':True,'imagePreserved':True,'existingFiles':files,'httpsAdaptersReverified':True}
    io.atomic_json(ROOT/'storage-static-address.json',receipt);print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
