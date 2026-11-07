"""One-shot approved Staging deployment/financial canary; never manufactures approval."""
import hashlib,importlib.util,inspect,json,pathlib,stat,subprocess,sys,time
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('control',HERE/'canary-control.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
SSH=['C:/Windows/System32/OpenSSH/ssh.exe','-i','C:/Users/DELL/.ssh/masarifi_staging_ed25519','-o','ConnectTimeout=10','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile=C:/Users/DELL/.ssh/known_hosts_masarifi_staging','masarifi@187.77.81.97','sudo -n python3 -']

def checked_packet(scope,approval):
 g.validate(scope,approval,time.time())
 g.require(scope['executorHash']==hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'EXECUTOR_CHANGED')
 for item in scope['localEvidence']:
  path=pathlib.Path(item['path'])
  g.require(path.is_absolute() and not path.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256'],'LOCAL_EVIDENCE_CHANGED')
 files={name:(HERE/name).read_bytes() for name in scope['files']}
 g.require(all(hashlib.sha256(value).hexdigest()==scope['files'][name] for name,value in files.items()),'CONTROL_SOURCE_CHANGED')
 return {'scope':scope,'approval':approval,'files':{name:value.hex() for name,value in files.items()}}

def cleanup_provenance(root,packet):
 scope=packet['scope'];approval=packet['approval']
 metadata=root.lstat()
 if root.is_symlink() or not stat.S_ISDIR(metadata.st_mode) or metadata.st_uid!=0 or stat.S_IMODE(metadata.st_mode)!=0o700:raise RuntimeError('OWNED_CLEANUP_ROOT_REQUIRED')
 for name in ['scope.json','approval.json','runtime.json',*scope['files']]:
  path=root/name;info=path.lstat()
  if path.is_symlink() or not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or stat.S_IMODE(info.st_mode)!=0o600:raise RuntimeError('OWNED_CLEANUP_FILE_REQUIRED')
 if json.loads((root/'scope.json').read_text())!=scope or json.loads((root/'approval.json').read_text())!=approval:raise RuntimeError('FOREIGN_CLEANUP_PRESERVED')
 for name,value in scope['files'].items():
  if hashlib.sha256((root/name).read_bytes()).hexdigest()!=value:raise RuntimeError('CLEANUP_SOURCE_CHANGED')

def recover_owned(root,packet,run):
 cleanup_provenance(root,packet)
 return run(['/usr/bin/python3',str(root/'canary-host.py'),'close'],capture_output=True,text=True,timeout=180)

def remote_source(packet):
 return '''import hashlib,json,os,pathlib,socket,stat,subprocess,time
FUNCTIONS
p=PACKET
if os.getuid()!=0 or socket.gethostname()!='srv2006836':raise RuntimeError('ROOT_STAGING_REQUIRED')
validator=bytes.fromhex(p['files']['canary-control.py'])
if hashlib.sha256(validator).hexdigest()!=p['scope']['files']['canary-control.py']:raise RuntimeError('CONTROL_VALIDATOR_CHANGED')
control={};exec(compile(validator,'approved-canary-control','exec'),control)
control['validate'](p['scope'],p['approval'],time.time())
scope=p['scope'];base=pathlib.Path('/opt/masarifi')
if base.is_symlink() or base.resolve()!=base:raise RuntimeError('PRIVATE_UPLOAD_PARENT_REQUIRED')
owned=base/('masarifi-canary-'+scope['attempt'])
if owned.exists() or owned.is_symlink():raise RuntimeError('PREEXISTING_ATTEMPT_PRESERVED')
root=base/('masarifi-canary-upload-'+scope['attempt']);root.mkdir(mode=0o700)
for name,value in p['files'].items():
 if name not in ['canary-control.py','canary-host.py','canary-db.cjs']:raise RuntimeError('CONTROL_FILE_REQUIRED')
 data=bytes.fromhex(value)
 if hashlib.sha256(data).hexdigest()!=scope['files'][name]:raise RuntimeError('CONTROL_HASH_CHANGED')
 with (root/name).open('xb') as f:f.write(data)
 (root/name).chmod(0o600)
for name,value in [('scope.json',scope),('approval.json',p['approval'])]:
 with (root/name).open('x') as f:json.dump(value,f,sort_keys=True)
 (root/name).chmod(0o600)
try:
 r=subprocess.run(['/usr/bin/python3',str(root/'canary-host.py'),'begin'],capture_output=True,text=True,timeout=330)
 if r.returncode:raise RuntimeError('BEGIN_FAILED')
 value=json.loads(r.stdout)
 if value.get('status')!='AUTHORIZED_SINGLE_FRESH_10_SAR_WINDOW_READY':raise RuntimeError('READY_RECEIPT_REQUIRED')
 print(json.dumps(value),flush=True)
except BaseException:
 if (owned/'runtime.json').exists():
  # Same approval includes bounded recovery of this exact owned attempt, never a new begin.
  try:
   cleanup=recover_owned(owned,p,subprocess.run)
   print(json.dumps({'status':'BEGIN_FAILED','cleanupExitCode':cleanup.returncode,'reviewRequired':True}),flush=True)
  except BaseException:print(json.dumps({'status':'BEGIN_FAILED_CLEANUP_UNCONFIRMED','reviewRequired':True}),flush=True)
 else:print(json.dumps({'status':'BEGIN_FAILED_NO_RUNTIME_RECEIPT','reviewRequired':True}),flush=True)
 raise
'''.replace('FUNCTIONS',inspect.getsource(cleanup_provenance)+'\n'+inspect.getsource(recover_owned)).replace('PACKET',repr(packet))

def main():
 g.require(len(sys.argv)==3,'EXACT_SCOPE_AND_DIRECT_APPROVAL_FILES_REQUIRED')
 scope=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
 approval=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
 packet=checked_packet(scope,approval)
 # Exclusive consumption occurs before the first remote mutation. Network uncertainty never permits a retry.
 attempt=HERE/('execution-'+scope['attempt']);attempt.mkdir()
 (attempt/'consumed.json').write_text(json.dumps({'scopeHash':g.digest(scope),'consumedAt':time.time(),'approvalReference':approval['messageReference']}),encoding='utf-8')
 try:
  result=subprocess.run(SSH,input=remote_source(packet),capture_output=True,text=True,encoding='utf-8',timeout=530)
  (attempt/'stdout.jsonl').write_text(result.stdout,encoding='utf-8')
  (attempt/'transport.json').write_text(json.dumps({'returncode':result.returncode,'stderrSha256':hashlib.sha256(result.stderr.encode()).hexdigest(),'neverRetry':True}),encoding='utf-8')
  if result.returncode:raise RuntimeError('APPROVED_ATTEMPT_REQUIRES_READ_ONLY_RECONCILIATION')
  receipt=json.loads(result.stdout);g.require(receipt.get('status')=='AUTHORIZED_SINGLE_FRESH_10_SAR_WINDOW_READY','LIVE_READY_NOT_CONFIRMED')
  print(json.dumps(receipt))
 except subprocess.TimeoutExpired:
  (attempt/'transport-uncertain.json').write_text(json.dumps({'neverRetry':True,'independentMonitorStatus':'unconfirmed','readOnlyReconciliationRequired':True}),encoding='utf-8')
  raise RuntimeError('TRANSPORT_UNCERTAIN_DO_NOT_RETRY') from None

if __name__=='__main__':main()
