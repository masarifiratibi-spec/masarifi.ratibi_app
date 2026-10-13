"""Inert deployment transport and disposable installer filesystem tests only."""
import base64,contextlib,copy,hashlib,importlib.util,json,os,pathlib,subprocess,tempfile,time,types,unittest
from unittest.mock import patch
P=pathlib.Path(__file__).with_name('promoted-operating-deploy.py')
def load(path,name):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load(P,'operating_deploy') if P.exists() else None
NOW=1791900000
GEN='10000000-0000-4000-8000-000000000001'
def enc(value):return json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def sha(value):return hashlib.sha256(value).hexdigest()

@unittest.skipIf(m is None,'deployment executor pending')
class DeployTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name)
  helper=load(P.with_name('promoted-operating.test.py'),'deploy_packet_fixture')
  self.packet,_,_=helper.fixture();remote='/opt/masarifi/customer-voice-operating-'+GEN
  self.files={name:(P.parent/('diagnostic-canary' if name.startswith('canary-') else '')/name).read_bytes() for name in m.host.CONTROLLER_FILES}
  self.packet['artifacts']={name:sha(data) for name,data in self.files.items()}
  for name,proof in self.packet['proofs'].items():
   filename='proof-'+name+'.json';data=enc({'inertFixture':name});self.files[filename]=data
   proof.update(path=remote+'/'+filename,sha256=sha(data))
  for name,nested in [('helperOff','approvedPacket'),('financialClosure','successPreservation'),
                      ('controllerCI','sourceArtifact'),('controllerCI','sqlQualification'),('apkRuntime','reusedNative')]:
   filename='proof-'+name+'-'+nested+'.json';data=enc({'inertFixture':nested});self.files[filename]=data
   self.packet['proofs'][name][nested]={'path':remote+'/'+filename,'sha256':sha(data)}
  self.files['packet.json']=enc(self.packet)
  (self.root/'packet.json').write_bytes(self.files['packet.json'])
  (self.root/'bundle.json').write_bytes(enc({name:base64.b64encode(data).decode() for name,data in self.files.items()}))
  (self.root/'review.txt').write_bytes(b'inert reviewed source evidence')
  self.known=self.root/'known_hosts';self.known.write_bytes(b'only an inert known-host fixture')
  self.scope={'kind':'promoted-operating-deployment','version':1,'project':self.packet['project'],'host':self.packet['host'],
   'generation':GEN,'packetHash':sha(enc(self.packet)),'remoteRoot':remote,
   'bootstrapUnit':m.host.scope_name(self.packet)+'-bootstrap.service',
   'bundleHashes':{name:sha(data) for name,data in self.files.items()},'executorHash':sha(P.read_bytes()),
   'packetFile':{'path':str(self.root/'packet.json'),'sha256':sha(self.files['packet.json'])},
   'bundleFile':{'path':str(self.root/'bundle.json'),'sha256':sha((self.root/'bundle.json').read_bytes())},
   'localEvidence':[{'path':str(self.root/'review.txt'),'sha256':sha(b'inert reviewed source evidence')}],
   'knownHostsHash':sha(self.known.read_bytes())}
  op={'kind':'direct-human-operating-approval','scopeHash':self.scope['packetHash'],'receivedAt':NOW-1,
      'activationExpiresAt':NOW+3590,'messageReference':'OFFLINE-TEST-ONLY-HUMAN-REFERENCE',
      'verbatimMessage':'Inert fixture; this is not a real operating approval.'}
  self.approval={'kind':'direct-human-operating-deployment-approval','scopeHash':m.scope_hash(self.scope),
   **{k:op[k] for k in ['receivedAt','activationExpiresAt','messageReference','verbatimMessage']},'operatingApproval':op}
  self.scope_path=self.root/'deployment-scope.json';self.approval_path=self.root/'approval.json'
  self.write();self.calls=[]
  self.patcher=patch.object(m,'KNOWN_HOSTS',self.known);self.patcher.start()
 def tearDown(self):self.patcher.stop();self.tmp.cleanup()
 def write(self):
  self.scope_path.write_bytes(enc(self.scope));self.approval_path.write_bytes(enc(self.approval))
 def transport(self,args,**kwargs):
  self.calls.append((args,kwargs))
  marker=self.root/('execution-'+GEN)/'consumed.json'
  self.assertTrue(marker.exists());self.assertEqual(json.loads(marker.read_bytes())['scopeHash'],m.scope_hash(self.scope))
  stdout=enc({'status':'AUTHORIZED_PERSISTENT_OPERATING_READY','scopeHash':m.scope_hash(self.scope),
    'packetHash':self.scope['packetHash'],'generation':GEN,'remoteRoot':self.scope['remoteRoot'],
    'bootstrapUnit':self.scope['bootstrapUnit'],'epochId':'20000000-0000-4000-8000-000000000001','workerID':'7'*64}).decode()
  return subprocess.CompletedProcess(args,0,stdout,'inert stderr')
 def execute(self):return m.execute(self.scope_path,self.approval_path,self.transport,now=lambda:NOW)
 def test_valid_scope_dispatches_once_only_after_durable_consumption(self):
  result=self.execute();self.assertEqual(result['outcome'],'ready');self.assertEqual(len(self.calls),1)
  self.assertEqual(result['exitCode'],0);self.assertEqual(result['stderrSha256'],sha(b'inert stderr'))
  argv=self.calls[0][0];self.assertIn('StrictHostKeyChecking=yes',argv);self.assertIn('BatchMode=yes',argv)
  self.assertEqual(argv[-2:],[m.SSH_TARGET,'sudo -n python3 -B -'])
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(len(self.calls),1)
 def test_missing_approval_refuses_before_ssh(self):
  self.approval_path.unlink()
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_expired_mismatched_or_foreign_approval_refuses_before_ssh(self):
  original=copy.deepcopy(self.approval)
  for change in [('scopeHash','0'*64),('activationExpiresAt',NOW),('kind','direct-human-canary-approval')]:
   self.approval=copy.deepcopy(original);self.approval[change[0]]=change[1];self.write()
   with self.subTest(change=change),self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_changed_artifact_evidence_bundle_or_known_hosts_refuses_before_ssh(self):
  for path in ['review.txt','bundle.json','packet.json','known_hosts']:
   target=self.root/path;old=target.read_bytes();target.write_bytes(old+b'changed')
   with self.subTest(path=path),self.assertRaises(RuntimeError):self.execute()
   target.write_bytes(old)
  self.assertEqual(self.calls,[])
 def test_consumed_marker_refuses_before_ssh(self):
  attempt=self.root/('execution-'+GEN);attempt.mkdir();(attempt/'consumed.json').write_bytes(b'{}')
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_copying_scope_does_not_allow_a_second_dispatch_reservation(self):
  self.execute();copyroot=self.root/'copied-scope';copyroot.mkdir()
  scope=copyroot/'deployment-scope.json';approval=copyroot/'approval.json'
  scope.write_bytes(self.scope_path.read_bytes());approval.write_bytes(self.approval_path.read_bytes())
  with self.assertRaises(RuntimeError):m.execute(scope,approval,self.transport,now=lambda:NOW)
  self.assertEqual(len(self.calls),1)
 def test_host_approval_metadata_must_match_outer_human_reply(self):
  self.approval['operatingApproval']['messageReference']='DIFFERENT-HUMAN-MESSAGE';self.write()
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_timeout_and_nonzero_transport_outcome_never_retries(self):
  def uncertain(args,**kwargs):self.calls.append(args);raise subprocess.TimeoutExpired(args,600,output='partial',stderr='secret-output')
  result=m.execute(self.scope_path,self.approval_path,uncertain,now=lambda:NOW)
  self.assertEqual(result['outcome'],'unknown');self.assertIsNone(result['exitCode']);self.assertTrue(result['neverRetry'])
  self.assertEqual(len(self.calls),1);self.assertNotIn('secret-output',json.dumps(result))
  with self.assertRaises(RuntimeError):m.execute(self.scope_path,self.approval_path,uncertain,now=lambda:NOW)
  self.assertEqual(len(self.calls),1)
 def test_changed_unsigned_packet_hash_or_executor_is_refused(self):
  self.scope['packetHash']='0'*64;self.approval['scopeHash']=m.scope_hash(self.scope);self.write()
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_changed_executor_hash_is_refused_before_import_or_ssh(self):
  self.scope['executorHash']='0'*64;self.approval['scopeHash']=m.scope_hash(self.scope);self.write()
  with patch.object(m,'load_host',side_effect=AssertionError('unpinned source imported')):
   with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_changed_local_source_is_rejected_before_controller_import(self):
  original=m.regular_bytes
  def changed(path,*args):
   value=original(path,*args)
   return value+b'changed' if pathlib.Path(path).name=='operating-ingress.py' else value
  with patch.object(m,'regular_bytes',side_effect=changed),patch.object(m,'load_host',side_effect=AssertionError('unpinned source imported')):
   with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_flat_proposal_controller_sources_are_verified_and_loaded_exactly(self):
  flat=self.root/'proposal';flat.mkdir()
  for name in m.host.CONTROLLER_FILES:(flat/name).write_bytes(self.files[name])
  with patch.object(m,'HERE',flat):
   payload=m.checked(self.scope,self.approval,NOW)
  self.assertEqual(payload['scope'],self.scope)
 def test_timeout_partial_output_is_hashed_and_durable_without_raw_output(self):
  def lost(args,**kwargs):
   self.calls.append(args);raise subprocess.TimeoutExpired(args,660,output=b'partial-secret',stderr=b'error-secret')
  result=m.execute(self.scope_path,self.approval_path,lost,now=lambda:NOW)
  self.assertEqual(result['stdoutSha256'],sha(b'partial-secret'));self.assertEqual(result['stderrSha256'],sha(b'error-secret'))
  receipt=self.root/('execution-'+GEN)/'result.json'
  self.assertEqual(json.loads(receipt.read_bytes()),result);self.assertNotIn('partial-secret',receipt.read_text())
 def test_nonzero_or_unbound_ready_response_is_unknown_and_never_retried(self):
  def nonzero(args,**kwargs):
   self.calls.append(args);return subprocess.CompletedProcess(args,1,'{}','inert failure')
  result=m.execute(self.scope_path,self.approval_path,nonzero,now=lambda:NOW)
  self.assertEqual(result['outcome'],'unknown');self.assertEqual(result['exitCode'],1)
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(len(self.calls),1)
 def test_durable_marker_write_failure_prevents_transport_and_consumes_reservation(self):
  original=m.exclusive_write
  def fail_marker(path,data):
   if pathlib.Path(path).name=='consumed.json':raise OSError('inert fsync failure')
   return original(path,data)
  with patch.object(m,'exclusive_write',side_effect=fail_marker):
   with self.assertRaises(OSError):self.execute()
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.calls,[])
 def test_remote_source_compiles_with_fixed_installer_and_no_canary_replay(self):
  payload=m.checked(self.scope,self.approval,NOW);source=m.remote_source(payload)
  compile(source,'inert-remote-install','exec')
  self.assertIsNotNone(source)
 def test_hydrated_remote_definitions_execute_disposable_installer_without_missing_dependencies(self):
  payload=m.checked(self.scope,self.approval,NOW);source=m.remote_source(payload)
  platform=FakePlatform(self.root/'hydrated-installer',self.scope)
  definitions,tail=source.split('\npayload=parse(',1);namespace={'platform':platform}
  with contextlib.redirect_stdout(__import__('io').StringIO()):
   exec(definitions+'\nRemotePlatform=lambda:platform\npayload=parse('+tail,namespace)
  result=namespace['result']
  self.assertEqual(result['status'],'AUTHORIZED_PERSISTENT_OPERATING_READY')
  self.assertEqual(platform.events.count('start'),1)
 def test_readonly_hydrated_source_has_no_mutation_or_helper_dispatch(self):
  namespace={};exec(m.readonly_source(self.scope).split('\nscope=parse(',1)[0],namespace)
  class ReadonlyPlatform:
   def target(self):pass
  namespace['RemotePlatform']=ReadonlyPlatform
  with patch.object(os.path,'lexists',return_value=False),patch.object(subprocess,'run',side_effect=AssertionError('unexpected dispatch')):
   result=namespace['OwnedReader'](pathlib.Path(self.scope['remoteRoot']),self.scope).snapshot()
  self.assertTrue(result['rootAbsent']);self.assertTrue(result['readOnly'])
  source=m.readonly_source(self.scope);definitions,tail=source.split('\nscope=parse(',1)
  calls=[]
  # The full emitted tail runs; only its selected reader is inertly substituted.
  result={'status':'OWNED_OPERATING_READ_ONLY','readOnly':True,'scopeHash':m.scope_hash(self.scope)}
  reader=types.SimpleNamespace(snapshot=lambda:result)
  namespace={'inert_reader':lambda root,scope:(calls.append((root,scope)) or reader)}
  with patch.object(subprocess,'run',side_effect=AssertionError('unexpected dispatch')),contextlib.redirect_stdout(__import__('io').StringIO()):
   exec(definitions+'\nOwnedReader=inert_reader\nscope=parse('+tail,namespace)
  self.assertEqual(namespace['result'],result);self.assertEqual(len(calls),1)
 def test_concrete_ready_reuses_health_and_monitor_fences_without_database_calls(self):
  payload=m.checked(self.scope,self.approval,NOW);platform=FakePlatform(self.root/'ready-fences',self.scope)
  state={'generation':GEN,'scope':self.packet,'scopeHash':self.scope['packetHash'],'phase':'active',
   'epochId':'20000000-0000-4000-8000-000000000001','workerID':'7'*64,'manifestHash':'8'*64}
  files={'runtime.json':state,'incident.json':{'immutable':{'scope':self.packet,'scopeHash':self.scope['packetHash'],'generation':GEN}},
         'close-request.json':None,'approval.json':self.approval['operatingApproval'],
         'ready-1.json':{'status':'AUTHORIZED_PERSISTENT_OPERATING_READY','expiresAt':None,
                         **{key:state[key] for key in ['generation','epochId','workerID','manifestHash']}}}
  platform.root.mkdir();(platform.root/'ready-1.json').write_bytes(b'inert placeholder')
  calls=[]
  class View:
   def __init__(self,*args):pass
   def validate(self,**kwargs):calls.append('validate')
   def qualified(self):calls.append('qualified')
   def guard(self,*args):calls.append('guard')
   def cohort(self,*args):calls.append('cohort')
   def public_ready(self,*args):calls.append('public_ready')
   def runtime(self,*args):calls.append('runtime');return {'enabled':True}
   def monitor_proof(self):calls.append('monitor_proof')
   def final_fence(self,*args,**kwargs):calls.append('final_fence')
   def database(self,*args):raise AssertionError('duplicate database helper')
   def preflight(self):raise AssertionError('duplicate database preflight')
  platform.frozen=types.SimpleNamespace(LocalHost=View);platform.ready_deadline=platform.tick+500
  with patch.object(m.OwnedReader,'read',side_effect=lambda name:files.get(name)):
   result=m.RemotePlatform.ready(platform,platform.root,self.packet,self.scope)
  self.assertEqual(result['workerID'],state['workerID'])
  self.assertEqual(calls,['validate','qualified','guard','cohort','public_ready','runtime','monitor_proof','final_fence'])
 def test_installer_freshness_modes_setup_budget_and_lock_release_before_start(self):
  payload=m.checked(self.scope,self.approval,NOW);platform=FakePlatform(self.root/'installer',self.scope)
  result=m.install_remote(payload,platform)
  self.assertEqual(result['status'],'AUTHORIZED_PERSISTENT_OPERATING_READY')
  self.assertLess(platform.events.index('unlock'),platform.events.index('start'))
  self.assertEqual(platform.events.count('start'),1);self.assertEqual(platform.setup_budget,120)
  self.assertEqual(platform.started,['systemctl','start','--no-block',self.scope['bootstrapUnit']])
  unit=(platform.root/self.scope['bootstrapUnit']).read_text()
  self.assertIn('Type=oneshot\nRemainAfterExit=yes\n',unit)
  self.assertIn('TimeoutStartSec=300\nTimeoutStopSec=180\n',unit)
  self.assertIn('ExecStopPost=/usr/bin/python3 -B ',unit)
  self.assertEqual((platform.root/'packet.json').read_bytes(),self.files['packet.json'])
  self.assertEqual(json.loads((platform.root/'approval.json').read_bytes()),self.approval['operatingApproval'])
  if os.name=='posix':
   self.assertEqual(platform.root.stat().st_mode&0o777,0o700)
   self.assertTrue(all(path.stat().st_mode&0o777==0o600 for path in platform.root.iterdir() if path.is_file()))
  with self.assertRaises(RuntimeError):m.install_remote(payload,platform)
  self.assertEqual(platform.events.count('start'),1)
 def test_installer_never_starts_on_precheck_or_expiration_failure(self):
  payload=m.checked(self.scope,self.approval,NOW);platform=FakePlatform(self.root/'installer',self.scope)
  platform.precheck=lambda *args:(_ for _ in ()).throw(RuntimeError('PIN_CHANGED'))
  with self.assertRaises(RuntimeError):m.install_remote(payload,platform)
  self.assertNotIn('start',platform.events)
 def test_installer_expiration_and_setup_timeout_never_start(self):
  payload=m.checked(self.scope,self.approval,NOW)
  for failure in ['expired','setup-timeout']:
   platform=FakePlatform(self.root/failure,self.scope)
   def fail(*args):
    if failure=='expired':platform.clock=NOW+3600
    else:platform.tick+=121
   platform.precheck=fail
   with self.subTest(failure=failure),self.assertRaises(RuntimeError):m.install_remote(payload,platform)
   self.assertNotIn('start',platform.events)
 def test_installer_ready_poll_is_bounded_without_second_start(self):
  payload=m.checked(self.scope,self.approval,NOW);platform=FakePlatform(self.root/'not-ready',self.scope)
  platform.ready=lambda *args:None;platform.unit_state=lambda *args:{'ActiveState':'activating','SubState':'start'}
  with self.assertRaises(RuntimeError):m.install_remote(payload,platform)
  self.assertEqual(platform.events.count('start'),1);self.assertEqual(platform.tick,600)
  with self.assertRaises(RuntimeError):m.install_remote(payload,platform)
  self.assertEqual(platform.events.count('start'),1)
 def test_bundle_traversal_extra_file_and_changed_nested_evidence_are_refused(self):
  payload=m.checked(self.scope,self.approval,NOW)
  for failure in ['extra','cross-root','nested-hash']:
   altered=copy.deepcopy(payload)
   if failure=='extra':
    altered['bundle']['extra.json']=base64.b64encode(b'{}').decode();altered['scope']['bundleHashes']['extra.json']=sha(b'{}')
   else:
    packet=copy.deepcopy(self.packet);proof=packet['proofs']['helperOff']['approvedPacket']
    if failure=='cross-root':proof['path']='/opt/foreign/'+pathlib.Path(proof['path']).name
    else:proof['sha256']='0'*64
    data=enc(packet);altered['bundle']['packet.json']=base64.b64encode(data).decode()
    altered['scope']['bundleHashes']['packet.json']=sha(data);altered['scope']['packetHash']=sha(data)
   with self.subTest(failure=failure),self.assertRaises(RuntimeError):m.decode_bundle(altered['scope'],altered['bundle'])
 def test_duplicate_or_nonfinite_json_is_refused(self):
  for raw in ['{"a":1,"a":2}','{"a":NaN}','{"a":Infinity}']:
   with self.subTest(raw=raw),self.assertRaises(RuntimeError):m.parse(raw)
 def test_unknown_cli_outcome_is_not_reported_as_success(self):
  with patch.object(m.sys,'argv',['executor','execute',str(self.scope_path),str(self.approval_path)]),\
       patch.object(m,'execute',return_value={'outcome':'unknown','neverRetry':True}),\
       contextlib.redirect_stdout(__import__('io').StringIO()):
   with self.assertRaises(SystemExit) as result:m.main()
  self.assertEqual(result.exception.code,2)
 def test_readonly_reconciliation_requires_consumed_attempt_and_is_one_shot(self):
  with self.assertRaises(RuntimeError):m.reconcile(self.scope_path,self.approval_path,self.transport,now=lambda:NOW)
  self.assertEqual(self.calls,[])
  self.execute()
  def read(args,**kwargs):
   self.calls.append(args);compile(kwargs['input'],'readonly-source','exec')
   return subprocess.CompletedProcess(args,0,json.dumps({'status':'OWNED_OPERATING_READ_ONLY','scopeHash':m.scope_hash(self.scope),'readOnly':True}), '')
  result=m.reconcile(self.scope_path,self.approval_path,read,now=lambda:NOW+3600)
  self.assertEqual(result['exitCode'],0);self.assertEqual(len(self.calls),2)
  with self.assertRaises(RuntimeError):m.reconcile(self.scope_path,self.approval_path,read,now=lambda:NOW+3600)
  self.assertEqual(len(self.calls),2)

class FakePlatform:
 def __init__(self,base,scope):
  self.base=base;self.base.mkdir();self.scope=scope;self.root=self.base/'owned';self.units=self.base/'units';self.units.mkdir()
  self.events=[];self.clock=NOW;self.tick=100;self.started=None;self.setup_budget=None
 def target(self):pass
 def now(self):return self.clock
 def monotonic(self):return self.tick
 def deadline(self,seconds):self.setup_budget=seconds;return self.tick+seconds
 def root_path(self,scope):return self.root
 def unit_path(self,name):return self.units/name
 def absent(self,path):m.RemotePlatform.absent(self,path)
 def fresh_units(self,names,deadline):
  for name in names:self.absent(self.unit_path(name))
 @contextlib.contextmanager
 def deployment_lock(self,deadline):
  self.events.append('lock')
  try:yield
  finally:self.events.append('unlock')
 def mkdir(self,path):m.RemotePlatform.mkdir(self,path)
 def write(self,path,data):m.RemotePlatform.write(self,path,data)
 def link(self,path,target):m.RemotePlatform.link(self,path,target)
 def precheck(self,*args):self.events.append('precheck')
 def run(self,args,deadline,timeout=15):
  m.remaining(self,deadline);self.events.append('start' if args[:2]==['systemctl','start'] else 'run')
  if args[:2]==['systemctl','start']:self.started=args
  return ''
 def ready(self,root,packet,scope):
  return {'status':'AUTHORIZED_PERSISTENT_OPERATING_READY','scopeHash':m.scope_hash(scope),'packetHash':scope['packetHash'],
          'generation':scope['generation'],'remoteRoot':scope['remoteRoot'],'bootstrapUnit':scope['bootstrapUnit'],
          'epochId':'20000000-0000-4000-8000-000000000001','workerID':'7'*64}
 def unit_state(self,name,deadline):return {'ActiveState':'active','SubState':'exited'}
 def pause(self,seconds):self.tick+=seconds

class AvailabilityTests(unittest.TestCase):
 def test_deployment_executor_exists(self):self.assertTrue(P.exists(),'one-time operating deployment executor missing')

if __name__=='__main__':unittest.main()
