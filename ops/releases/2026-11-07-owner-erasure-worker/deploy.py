"""Run as the existing host operator. No secret values are written to the receipt."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp
import sys
import time
import urllib.request

os.umask(0o077)
root = Path('/var/tmp/masarifi-owner-erasure-756c3df6-r1')
tag = 'masarifi-owner-erasure:756c3df6-r1'
worker = 'account-delete-worker'
name = 'masarifi-production-account-delete-worker-756c3df6'
key = 'privacy.account-delete'
CANONICAL_LF_SHA = 'c9f3646aebdce1c3184f79d4f38c51709027b29fb9d8f7474a1552825aaeaa62'
module = '/app/dist/src/security/owner-data-erasure.service.js'
def run(*args):
    p = sp.run(args, stdout=sp.PIPE, stderr=sp.PIPE, timeout=120)
    if p.returncode:
        raise RuntimeError(f'{args[:3]} exited with {p.returncode}: '+p.stderr.decode()[-500:] if args[:2]!=('docker','compose') else 'Compose failed: '+p.stderr.decode()[-450:])
    return p.stdout
def js(*args): return json.loads(run(*args))
def check(ok, why):
    if not ok: raise RuntimeError(why)
def sha(data): return hashlib.sha256(data).hexdigest()
def dump(path, data):
    with path.open('x') as f: json.dump(data, f, indent=2)
def fleet():
    ids = run('docker','ps','-q').decode().split()
    return js('docker','inspect',*ids)
def ident(c): return (c['Id'],c['Image'],c['State']['StartedAt'])
def env(c): return dict(e.split('=',1) for e in c['Config']['Env'])
def service(cs,s): return next(c for c in cs if c['Config']['Labels'].get('com.docker.compose.service')==s and c['Name'].startswith('/masarifi-production-'))
def live(): return json.load(urllib.request.urlopen('http://127.0.0.1:3080/health/ready',timeout=3))['status']=='ready'
def compose(api):
    l = api['Config']['Labels']
    files = l['com.docker.compose.project.config_files'].split(',')
    cmd=['docker','compose','-p',l['com.docker.compose.project']]
    for f in files: cmd+=['-f',f]
    return cmd
def image(tag): return js('docker','image','inspect',tag)[0]
def configure(cmd): return js(*cmd,'config','--format','json')
def others(cs, api): return {c['Name']:ident(c) for c in cs if c['Id']!=api['Id'] and c['Name']!='/'+name}
def prepare():
    cs=fleet(); api=service(cs,'core-api'); imp=service(cs,'import-worker')
    check(live(),'API not ready')
    check(not any(key in env(c).get('MASARIFI_OPERATIONS_JOB_KEYS','').split(',') for c in cs),'existing consumer: inspect before applying')
    check(env(imp).get('MASARIFI_OPERATIONS_JOB_KEYS')=='import.parse','unexpected importer scope')
    check(env(imp).get('SUPABASE_URL')==env(api).get('SUPABASE_URL')=='https://qcffvfbpzvpwcwxwjyro.supabase.co','unexpected provider project')
    curr=run('docker','exec',api['Id'],'/nodejs/bin/node','-e',"process.stdout.write(require('fs').readFileSync(process.argv[1]))",module)
    old="const result = await client.query('select private.erase_account_owner_payload($1::uuid,$2) result', [evidence.requestId, evidence.userId]);"
    check(curr.count(old.encode())==1,'served erasure module differs; reconcile (do not overwrite)')
    fresh=curr.replace(old.encode(),b"""await client.query("set local lock_timeout = '2s'");
            await client.query("set local statement_timeout = '60s'");
            const eraseQuery = {
                text: 'select private.erase_account_owner_payload($1::uuid,$2) result',
                values: [evidence.requestId, evidence.userId],
                query_timeout: 65_000,
            };
            const result = await client.query(eraseQuery);""")
    check(sha(fresh.replace(b'\r\n',b'\n'))==CANONICAL_LF_SHA, 'artifact differs from compiled, reviewed application')
    root.mkdir(mode=0o700)
    context=root/'image';context.mkdir()
    (context/'owner-data-erasure.service.js').write_bytes(fresh)
    base='masarifi-owner-erasure-base:'+api['Image'][7:19]
    run('docker','tag',api['Image'],base)
    (context/'Dockerfile').write_text(f'FROM {base}\nCOPY --chown=65532:65532 owner-data-erasure.service.js {module}\n')
    run('docker','build','--network=none','--pull=false','-t',tag,str(context))
    candidate=image(tag)
    check(candidate['RootFS']['Layers'][:-1]==image(base)['RootFS']['Layers'], 'base layers changed')
    check(candidate['Config']==image(base)['Config'],'unexpected runtime config drift')
    run('docker','run','--rm','--network=none','--entrypoint=/nodejs/bin/node',tag,'--check',module)
    # Validate that the active API image has the allowlisted poller before reusing it.
    run('docker','run','--rm','--network=none','--entrypoint=/nodejs/bin/node',tag,'-e',"""const fs=require('fs');if(!fs.readFileSync('dist/src/operations/operations.worker.js','utf8').includes('MASARIFI_OPERATIONS_JOB_KEYS')||!fs.readFileSync('dist/src/operations/job-registry.js','utf8').includes('privacy.account-delete'))process.exit(1)""")
    cmd=compose(api); before=configure(cmd)
    # Extend the live import service by reference: no new credential copies on disk.
    overrides={'MASARIFI_OPERATIONS_JOB_KEYS':key,'MASARIFI_AI_ASSISTANT_ONLY':'false','MASARIFI_VOICE_ANALYSIS_ONLY':'false','MASARIFI_PROCESS_KIND':'worker'}
    (root/'compose.json').write_text(json.dumps({'services':{'core-api':{'image':tag},worker:{'extends':{'service':'import-worker'},'container_name':name,'image':tag,'environment':overrides}}}))
    new=configure(cmd+['-f',str(root/'compose.json')])
    expected=copy.deepcopy(before)
    expected['services']['core-api']['image']=tag
    spec=copy.deepcopy(before['services']['import-worker'])
    spec.update(container_name=name,image=tag);spec['environment'].update(overrides)
    expected['services'][worker]=spec
    check(expected==new,'effective compose changed beyond reviewed services')
    check(spec['command']==['dist/src/worker.js'] and not spec.get('ports'),'worker exposure')
    (root/'rollback-api.json').write_text(json.dumps({'services':{'core-api':{'image':base}}}))
    receipt={'api':ident(api),'importer':ident(imp),'newImage':candidate['Id'],'moduleBefore':sha(curr),'moduleAfter':sha(fresh),'compose':cmd,'rollbackImage':base,'otherCount':len(others(cs,api)),'composeSha':sha(json.dumps(new,sort_keys=True).encode()),'workerScope':key}
    dump(root/'prepared.json',receipt);print(json.dumps(receipt))
def state():
    r=json.loads((root/'prepared.json').read_text())
    cmd=r['compose']+['-f',str(root/'compose.json')]
    check(image(tag)['Id']==r['newImage'] and sha(json.dumps(configure(cmd),sort_keys=True).encode())==r['composeSha'],'reviewed image or compose drift')
    return r,cmd
def deploy_api():
    r,cmd=state();cs=fleet();old=service(cs,'core-api')
    check(list(ident(old))==r['api'] and list(ident(service(cs,'import-worker')))==r['importer'],'baseline drift')
    dump(root/'api-start.json',{'baseline':r['api']})
    try:
        run(*cmd,'up','--detach','--no-deps','core-api')
        for i in range(70):
            try:
                if live(): break
            except Exception: pass
            time.sleep(.5)
        after=fleet();new=service(after,'core-api')
        check(live() and new['Image']==r['newImage'] and env(new)==env(old) and others(after,new)==others(cs,old),'API activation verification failed')
        check(json.load(urllib.request.urlopen('https://api.masarifiratibi.com/health/live',timeout=6))['status']=='ok','public health failed')
    except Exception:
        run(*r['compose'],'-f',str(root/'rollback-api.json'),'up','--detach','--no-deps','core-api')
        raise
    result={'api':ident(new),'otherContainersIntact':len(others(cs,old)),'publicLive':True,'ready':True}
    dump(root/'api-live.json',result);print(json.dumps(result))
def start_worker():
    r,cmd=state();cs=fleet();api=service(cs,'core-api')
    check(list(ident(api))==json.loads((root/'api-live.json').read_text())['api'] and live(),'API drift')
    check(not any(c['Name']=='/'+name or key in env(c).get('MASARIFI_OPERATIONS_JOB_KEYS','').split(',') for c in cs),'consumer already active')
    dump(root/'worker-start.json',{'key':key})
    run(*cmd,'up','--detach','--no-deps',worker)
    time.sleep(4)
    c=js('docker','inspect',name)[0]
    check(c['Image']==r['newImage'] and c['State']['Running'] and c['RestartCount']==0 and env(c)['MASARIFI_OPERATIONS_JOB_KEYS']==key,'worker failed to start')
    after=fleet()
    check(others(cs,api)==others(after,service(after,'core-api')) and ident(service(after,'core-api'))==ident(api),'other container drift')
    result={'worker':ident(c),'scope':key,'running':True,'restartCount':c['RestartCount']}
    dump(root/'worker-live.json',result);print(json.dumps(result))
if __name__=='__main__':
    {'prepare':prepare,'api':deploy_api,'worker':start_worker}[sys.argv[1]]()

