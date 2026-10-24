"""Read-only preparation by default; apply requires exact direct human evidence."""
import argparse,hashlib,importlib.util,json,pathlib,subprocess,sys,time
HERE=pathlib.Path(__file__).resolve().parent
def text(name):return (HERE/name).read_text(encoding='utf-8').replace('\r\n','\n')
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,HERE/file);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
g=module('diagnostic_control','diagnostic-control.py')
SSH=['C:/Windows/System32/OpenSSH/ssh.exe','-i','C:/Users/DELL/.ssh/masarifi_staging_ed25519','-o','ConnectTimeout=10','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile=C:/Users/DELL/.ssh/known_hosts_masarifi_staging','masarifi@187.77.81.97','sudo -n python3 -']
def remote(scope=None,approval=None):
 control=text('diagnostic-control.py');host=text('diagnostic-host.py');node=text('diagnostic-migration.cjs')
 # Modules execute in memory; preparation writes nothing to the host.
 code='import json,sys,types\ng=types.ModuleType("diagnostic_control");sys.modules[g.__name__]=g\n'
 code+='exec('+repr(control)+',g.__dict__)\nnamespace={}\nexec('+repr(host)+',namespace)\n'
 code+='host=namespace["Host"]('+repr(node)+')\n'
 if scope is None:code+='print(json.dumps(host.collect()))\n'
 else:
  for name,expected in scope['files'].items():
   g.require(hashlib.sha256((HERE/name).read_bytes()).hexdigest()==expected,'EXACT_CONTROL_BYTES_REQUIRED')
  g.validate(scope,approval,time.time())
  code+='scope=json.loads('+repr(json.dumps(scope))+');approval=json.loads('+repr(json.dumps(approval))+')\n'
  code+='try:\n print(json.dumps(g.execute(scope,approval,host)))\nexcept BaseException:\n sys.stderr.write("DIAGNOSTIC_SCOPE_FAILED_CHECK_PRIVATE_RECEIPT_NO_RETRY\\n");sys.exit(2)\n'
 return code
def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['read','apply']);parser.add_argument('--approval');args=parser.parse_args()
 if args.action=='apply':
  if not args.approval:raise RuntimeError('DIRECT_APPROVAL_REQUIRED')
  scope=json.loads((HERE/'scope.json').read_text());approval=json.loads(pathlib.Path(args.approval).read_text())
  payload=remote(scope,approval)
  attempt=HERE/('execution-'+scope['attempt']);attempt.mkdir()
  (attempt/'consumed.json').write_text(json.dumps({'scopeHash':g.digest(scope),'consumedAt':time.time(),'approvalReference':approval['messageReference'],'neverRetry':True}),encoding='utf-8')
 else:payload=remote()
 try:result=subprocess.run(SSH,input=payload,capture_output=True,text=True,timeout=390)
 except subprocess.TimeoutExpired:
  if args.action=='apply':(attempt/'transport-uncertain.json').write_text(json.dumps({'neverRetry':True,'readOnlyReconciliationRequired':True}))
  raise RuntimeError('TRANSPORT_UNCERTAIN_NO_RETRY') from None
 if args.action=='apply':
  (attempt/'transport.json').write_text(json.dumps({'returncode':result.returncode,'stderrHash':hashlib.sha256(result.stderr.encode()).hexdigest(),'neverRetry':True}))
  (attempt/'stdout.json').write_text(result.stdout,encoding='utf-8')
 if result.returncode:raise RuntimeError('STAGING_DIAGNOSTIC_READ_OR_APPROVED_ATTEMPT_FAILED_NO_RETRY')
 output=json.loads(result.stdout)
 name='fresh-baseline.json' if args.action=='read' else 'deployment-result.json'
 (HERE/name).write_text(json.dumps({'observedAt':time.time(),'result':output},indent=2),encoding='utf-8')
 print(json.dumps({'evidence':str(HERE/name),'posting':output.get('database',output).get('posting'),'migrationVerified':output.get('migrationVerified')}))
if __name__=='__main__':main()
