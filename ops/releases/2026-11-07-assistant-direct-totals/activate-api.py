import base64,datetime,hashlib,json,os,pathlib,subprocess,sys,time,urllib.request,urllib.error
os.umask(0o077)
package=pathlib.Path(sys.argv[1]).resolve()
approval=json.loads(pathlib.Path(sys.argv[2]).read_text())
files={name:base64.b64encode((package/name).read_bytes()).decode() for name in ['manifest.json','deployment-runbook.md','compose.api.yml','rollback-api.yml','Dockerfile','.gitattributes','activate-api.py']}
reviewed_sha=approval['reviewedManifestSha256']
raw=base64.b64decode(files['manifest.json'])
assert hashlib.sha256(raw).hexdigest()==reviewed_sha==approval['reviewedManifestSha256']
review=json.loads(raw);candidate=review['api'];runtime=candidate['servingApiRuntime']
assert approval['approved'] and approval['actualUserReply'].strip() and approval['reviewedApiImageId']==candidate['candidateImageId']
root=pathlib.Path(candidate['artifactRoot'])
baseline=json.loads((root.parent/'baseline-qualified.private.json').read_text())
assert review['android']['apkSha256']==approval['reviewedApkSha256']
assert review['candidateSourceCommit']==approval['reviewedSourceCommit']
dispatch=root/'task37-api-activation-dispatch.json'
assert not dispatch.exists(),'RECONCILE_EXISTING_API_ACTIVATION'
execution=root/'approved-execution'
assert not execution.exists(),'RECONCILE_EXISTING_APPROVED_STAGE'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def run(*args):return subprocess.check_output(list(args),timeout=30)
def containers():
    ids=run('docker','ps','-q').decode().split()
    return json.loads(run('docker','inspect',*ids))
def identity(c):return {'imageId':c['Image'],'startedAt':c['State']['StartedAt']}
def environment(c):return hashlib.sha256(json.dumps(sorted(c['Config']['Env']),separators=(',',':')).encode()).hexdigest()
before=containers();expected={c['id']:{'imageId':c['imageId'],'startedAt':c['startedAt']} for c in baseline['containers']}
assert {c['Id']:identity(c) for c in before}==expected,'SERVING_CONTAINER_DRIFT_RECONCILE_BEFORE_ACTIVATION'
owned=[c for c in before if c['Id']==candidate['expectedCurrentContainerId']]
assert len(owned)==1;old=owned[0]
assert old['Image']==candidate['baseImageId'] and old['State']['StartedAt']==candidate['expectedCurrentStartedAt']
assert environment(old)==runtime['environmentSha256']
assert json.loads(run('docker','image','inspect',candidate['candidateTag']))[0]['Id']==candidate['candidateImageId']
for pin in candidate['hostedInputFilePins']:
    assert hashlib.sha256(pathlib.Path(pin['path']).read_bytes()).hexdigest()==pin['sha256'],pin['path']
for pin in review['packageFiles']:
    assert hashlib.sha256(base64.b64decode(files[pin['path']])).hexdigest()==pin['sha256']
execution.mkdir(mode=0o700)
for name,encoded in files.items():
    assert '/' not in name and '\\' not in name and name in ['manifest.json','deployment-runbook.md','compose.api.yml','rollback-api.yml','Dockerfile','.gitattributes','activate-api.py']
    with (execution/name).open('xb') as target:target.write(base64.b64decode(encoded))
with (execution/'actual-approval.private.json').open('x',encoding='utf-8') as target:json.dump(approval,target)
compose=['docker','compose','--project-name',runtime['composeProject']]
for path in runtime['composeFiles'].split(','):compose.extend(['--file',path])
previous=json.loads(run(*compose,'config','--format','json'))
proposed=json.loads(run(*compose,'--file',str(execution/'compose.api.yml'),'config','--format','json'))
previous['services']['core-api']['image']=candidate['candidateTag']
assert previous==proposed,'EFFECTIVE_COMPOSE_DRIFT_IMAGE_ONLY_REQUIRED'
others={c['Id']:identity(c) for c in before if c['Id']!=old['Id']}
record={'atUtc':now(),'reviewedManifestSha256':reviewed_sha,'actualApproval':approval,'beforeApiId':old['Id'],'oldImageId':old['Image'],'candidateApiImageId':candidate['candidateImageId'],'otherContainersBefore':others,'onlyEffectiveImageChanged':True,'servingInputPinsChecked':True}
with dispatch.open('x',encoding='utf-8') as target:json.dump(record,target,indent=2)
command=compose+['--file',str(execution/'compose.api.yml'),'up','--detach','--no-deps','core-api']
with (root/'task37-api-activation.private.log').open('xb') as log:
    activated=subprocess.run(command,cwd=runtime['composeWorkingDirectory'],stdout=log,stderr=subprocess.STDOUT,timeout=90)
record.update(commandExitCode=activated.returncode,commandFinishedAtUtc=now())
with (root/'task37-api-activation-command-result.json').open('x',encoding='utf-8') as target:json.dump(record,target,indent=2)
assert activated.returncode==0,'ACTIVATION_COMMAND_FAILED_RECONCILE_STATE_NO_RETRY'
deadline=time.monotonic()+45
live=ready=None
while time.monotonic()<deadline:
    try:
        with urllib.request.urlopen('http://127.0.0.1:3080/health/live',timeout=3) as response:live=json.load(response)
        with urllib.request.urlopen('http://127.0.0.1:3080/health/ready',timeout=3) as response:ready=json.load(response)
        if live.get('status')=='ok' and ready.get('status')=='ready':break
    except (urllib.error.URLError,TimeoutError,ConnectionError,json.JSONDecodeError):pass
    time.sleep(.5)
assert live and live.get('status')=='ok' and ready and ready.get('status')=='ready','READINESS_FAILED_RECONCILE_AND_USE_REVIEWED_ROLLBACK_IF_REQUIRED'
after=containers();new=[c for c in after if c['Name']==old['Name']]
assert len(new)==1;new=new[0]
assert new['Image']==candidate['candidateImageId'] and new['Id']!=old['Id']
assert {c['Id']:identity(c) for c in after if c['Id']!=new['Id']}==others
assert environment(new)==environment(old)==runtime['environmentSha256']
assert all(new['Config'].get(k)==old['Config'].get(k) for k in ['User','WorkingDir','Entrypoint','Cmd','Healthcheck'])
assert all(new['HostConfig'].get(k)==old['HostConfig'].get(k) for k in ['ReadonlyRootfs','PortBindings','Memory','NanoCpus','CapDrop','SecurityOpt','PidsLimit','RestartPolicy','Tmpfs','Binds'])
assert sorted(new['NetworkSettings']['Networks'])==sorted(old['NetworkSettings']['Networks'])
for pin in candidate['hostedInputFilePins']:assert hashlib.sha256(pathlib.Path(pin['path']).read_bytes()).hexdigest()==pin['sha256']
with urllib.request.urlopen('https://api.masarifiratibi.com/health/live',timeout=6) as response:public_live=json.load(response)
assert public_live['status']=='ok'
try:
    urllib.request.urlopen('https://api.masarifiratibi.com/api/v1/assistant/availability',timeout=6)
    raise AssertionError('UNAUTHENTICATED_READ_MUST_NOT_SUCCEED')
except urllib.error.HTTPError as error:assert error.code==401
result={'atUtc':now(),'reviewedManifestSha256':reviewed_sha,'candidateApiImageId':new['Image'],'oldApiId':old['Id'],'newApiId':new['Id'],'newStartedAt':new['State']['StartedAt'],'allOtherContainersUnchanged':True,'otherContainerCount':len(others),'environmentAndRuntimePreserved':True,'hostedInputFilesPreserved':True,'loopbackLive':live['status'],'loopbackReady':ready['status'],'publicTlsLiveness':public_live['status'],'unauthenticatedAssistantReadStatus':401,'noSchemaModelWorkerEnvironmentDnsTlsChange':True,'actualPhoneAssistantReadAcceptancePending':True,'rollbackExecuted':False,'productionReady':False}
try:
    request=urllib.request.Request('https://api.masarifiratibi.com/api/v1/assistant/conversations/99000000-0000-4000-8000-000000000001/messages',data=json.dumps({'content':'How much have I spent?','responseMode':'async'}).encode(),headers={'Content-Type':'application/json'},method='POST')
    urllib.request.urlopen(request,timeout=6)
    raise AssertionError('UNAUTHENTICATED_ASSISTANT_POST_MUST_NOT_SUCCEED')
except urllib.error.HTTPError as error:assert error.code==401
result['unauthenticatedAssistantPostStatus']=401
result['noModelProviderWorkerEnvironmentSchemaChange']=True
with (root/'task37-api-activation-qualified.json').open('x',encoding='utf-8') as target:json.dump(result,target,indent=2)
print(json.dumps(result))
