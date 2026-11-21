"""Exercise the served adapters over HTTPS, and retain metadata-only evidence."""
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')


def main():
    os.umask(0o077)
    assert json.loads((ROOT/'file-route-ready.json').read_text())['state']=='https-private-storage-ready'
    shadow=json.loads((ROOT/'shadow-created.json').read_text())
    script=(ROOT/'verify-storage-runtime.cjs').read_bytes()
    result=sp.run(['docker','exec','-i',shadow['id'],'/nodejs/bin/node'],input=script,capture_output=True,timeout=180)
    try:receipt=json.loads(result.stdout)
    except ValueError:raise RuntimeError('STORAGE_RUNTIME_INVALID_OUTPUT: '+hashlib.sha256(result.stderr).hexdigest()) from None
    assert isinstance(receipt,dict) and receipt.get('state') in ('passed','failed')
    (ROOT/'storage-runtime-verification.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
    if result.returncode or receipt['state']!='passed':raise SystemExit(1)
    # The live store's logs must carry the same parent request ID and no URLs.
    logs=sp.run(['journalctl','CONTAINER_NAME=masarifi-private-storage','--since','5 minutes ago','--no-pager','-o','cat','--grep',receipt['requestId']],capture_output=True,check=True,timeout=30)
    records=[json.loads(line) for line in logs.stdout.splitlines() if line.startswith(b'{')]
    assert len(records)>=15 and all(record.get('requestId')==receipt['requestId'] for record in records),'STORAGE_CORRELATION_MISSING'
    assert all(set(record)<= {'timestamp','service','version','requestId','operation','outcome','durationMs','httpStatus','code'} for record in records),'STORAGE_LOG_FIELD_DRIFT'
    receipt['correlatedStorageRecords']=len(records)
    (ROOT/'storage-runtime-verification.json').write_text(json.dumps(receipt,indent=2));print(json.dumps({'correlatedStorageRecords':len(records),'requestId':receipt['requestId']}),flush=True)


if __name__=='__main__':main()
