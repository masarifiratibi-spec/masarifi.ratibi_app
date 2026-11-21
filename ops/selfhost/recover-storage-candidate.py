"""Recover only our missing rehearsal store using its qualified served code and existing key/data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp
import time
import urllib.request

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
NAME='masarifi-private-storage'
TAG='masarifi-private-storage:20261113'


def run(args):
    result=sp.run(args,capture_output=True,timeout=60)
    assert result.returncode==0,'STORAGE_RECOVERY_COMMAND_FAILED:'+args[0]+':'+hashlib.sha256(result.stderr).hexdigest()
    return result.stdout


def main():
    os.umask(0o077)
    assert sp.run(['docker','inspect',NAME],capture_output=True).returncode!=0,'STORE_EXISTS_REVIEW_INSTEAD'
    ready=json.loads((ROOT/'storage-prepared.json').read_text())
    assert ready['data']=='/srv/masarifi/files' and ready['listen']=='http://172.16.3.3:8080'
    image=json.loads(run(['docker','image','inspect',TAG]))[0]['Id']
    probe="const fs=require('fs'),c=require('crypto');process.stdout.write(JSON.stringify({code:c.createHash('sha256').update(fs.readFileSync('/app/selfhost/storage.mjs')).digest('hex'),node:c.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex')}))"
    actual=json.loads(run(['docker','run','--rm','--log-driver=none','--network=none','--read-only','--entrypoint=/nodejs/bin/node',image,'-e',probe]))
    assert actual['code']==ready['codeSha256'],'STORAGE_SERVED_CODE_CHANGED'
    node_probe="process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.execPath)).digest('hex'))"
    assert actual['node']==run(['docker','exec','masarifi-production-core-api-20261105-97e66588','/nodejs/bin/node','-e',node_probe]).decode(),'STORAGE_NODE_CHANGED'
    consumers=json.loads((ROOT/'runtime-candidates.json').read_text())
    origins=set()
    for candidate in consumers:
        container=json.loads(run(['docker','inspect',candidate['id']]))[0]
        for entry in container['Config']['Env']:
            if entry.startswith('MASARIFI_CORS_ORIGINS='):
                origins.update(value.strip() for value in entry.split('=',1)[1].split(',') if value.strip().startswith('https://'))
    assert Path('/srv/masarifi/files').is_dir() and Path('/etc/masarifi/selfhost/storage.key').is_file()
    run(['docker','run','--detach','--name',NAME,'--network','masarifi-selfhost-data','--ip','172.16.3.3','--user=65532:65532','--init','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--pids-limit=64','--memory=192m','--cpus=0.5','--mount','type=bind,src=/srv/masarifi/files,dst=/data','--mount','type=bind,src=/etc/masarifi/selfhost/storage.key,dst=/run/secrets/storage-key,readonly','--restart=unless-stopped','--log-driver=journald','--log-opt','tag=masarifi.storage','--label','masarifi.scope=selfhost','--env','MASARIFI_STORAGE_ROOT=/data','--env','MASARIFI_STORAGE_URL=https://api.masarifiratibi.com','--env','MASARIFI_RELEASE_VERSION=selfhost-20261113','--env','MASARIFI_CORS_ORIGINS='+','.join(sorted(origins)),image])
    for _ in range(30):
        try:
            with urllib.request.urlopen(ready['listen']+'/health/ready',timeout=2) as response:
                if response.status==200:break
        except OSError:pass
        time.sleep(1)
    else:raise RuntimeError('RECOVERED_STORE_NOT_READY')
    ready['recoveredImage']=image;ready['servedCodeAndNodePreserved']=True
    (ROOT/'storage-recovered.json').write_text(json.dumps({'state':'passed','image':image,'codeSha256':actual['code'],'staticAddress':True,'existingDataAndKeyPreserved':True},indent=2))
    print(json.dumps({'state':'passed','staticAddress':True,'servedCodeAndNodePreserved':True,'existingDataAndKeyPreserved':True}),flush=True)


if __name__=='__main__':main()
