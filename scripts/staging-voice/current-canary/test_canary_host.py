"""Adapter regressions. No subprocess, device or hosted network access."""
import contextlib,copy,importlib.util,json,os,pathlib,tempfile,threading,time,types,unittest
from unittest.mock import patch
P=pathlib.Path(__file__).parent
sp=importlib.util.spec_from_file_location('host',P/'canary-host.py');h=importlib.util.module_from_spec(sp);sp.loader.exec_module(h)
from test_canary_control import fixture,NOW

class Inert(h.LocalHost):
 def __init__(self,root,scope=None):
  s,a=fixture();super().__init__(root,scope or s,a);self.commands=[];self.saved=None;self.container={'Id':'a'*64,'State':{'Running':True}}
 def guard(self,state):self.commands.append('provenance')
 def request_close(self,reason):self.commands.append('cancel')
 def save_closure(self,receipt):self.receipt=receipt
 def inspect(self,id):return self.container
 def worker(self,state):return self.container
 def run(self,args,**kw):
  self.commands.append(args)
  if args[0]=='docker' and args[1]=='stop':self.container['State']['Running']=False
  return ''
 def database(self,action,state=None):return self.reply
 def state(self):return copy.deepcopy(self.saved)
 def persist(self,state):self.saved=copy.deepcopy(state)
 def now(self):return NOW
 def cohort(self,*args):raise RuntimeError('PUBLIC_API_UNHEALTHY')
 def candidate(self):raise RuntimeError('API_UNHEALTHY')
 def route_guard(self):raise RuntimeError('UNRELATED_ROUTE_DRIFT')

class Tests(unittest.TestCase):
 def test_cleanup_commands_share_one_aggregate_deadline(self):
  s,a=fixture();x=h.LocalHost(P,s,a)
  reply=types.SimpleNamespace(returncode=0,stdout='INERT')
  with patch.object(h.time,'monotonic',side_effect=[100,279,280]),patch.object(h.subprocess,'run',return_value=reply) as transport:
   with x.cleanup_budget():
    x.run(['INERT'],timeout=25)
    self.assertEqual(transport.call_args.kwargs['timeout'],1)
    with self.assertRaisesRegex(RuntimeError,'AGGREGATE_CLEANUP_BUDGET_EXHAUSTED'):x.run(['INERT'])
   transport.assert_called_once();self.assertIsNone(x.cleanup_deadline)
 def test_nested_cleanup_never_extends_outer_deadline(self):
  s,a=fixture();x=h.LocalHost(P,s,a)
  with patch.object(h.time,'monotonic',side_effect=[100,200]):
   with x.cleanup_budget():
    self.assertEqual(x.cleanup_deadline,280)
    with x.cleanup_budget():self.assertEqual(x.cleanup_deadline,280)
    self.assertEqual(x.cleanup_deadline,280)
   self.assertIsNone(x.cleanup_deadline)
 def test_worker_stop_independent_of_public_api_health_or_route_drift(self):
  x=Inert(P);x.stop_worker({'workerID':'a'*64});self.assertFalse(x.container['State']['Running'])
  self.assertEqual(x.commands,['provenance',['docker','stop','--time','5','a'*64]])
 def test_lost_prepare_reply_lookup_exact_epoch_without_reprepare(self):
  with tempfile.TemporaryDirectory() as t:
   (pathlib.Path(t)/'runtime.json').write_text('{}');x=Inert(t)
   x.saved={'epochId':None,'manifestHash':None,'workerID':None,'packet':{'attemptId':x.scope['attempt']}}
   x.reply={'epochId':'22222222-2222-4222-8222-222222222222','manifestHash':'b'*64,'state':'prepared'}
   out=x.reconcile();self.assertEqual(out['epochId'],x.reply['epochId']);self.assertIsNone(out['workerID'])
   self.assertFalse(any(isinstance(c,list) and c[:2]==['docker','start'] for c in x.commands))
 def test_no_prepared_epoch_does_not_create_or_guess(self):
  with tempfile.TemporaryDirectory() as t:
   (pathlib.Path(t)/'runtime.json').write_text('{}');x=Inert(t)
   x.saved={'epochId':None,'workerID':None};x.reply=None
   self.assertIsNone(x.reconcile());self.assertEqual(x.commands,[])
 def test_foreign_preparation_state_rejected(self):
  with tempfile.TemporaryDirectory() as t:
   (pathlib.Path(t)/'runtime.json').write_text('{}');x=Inert(t);x.saved={'epochId':None,'workerID':None}
   x.reply={'epochId':'22222222-2222-4222-8222-222222222222','manifestHash':'b'*64,'state':'active'}
   with self.assertRaisesRegex(RuntimeError,'RECONCILIATION'):x.reconcile()
 def test_closed_epoch_blocks_every_forward_host_mutation(self):
  x=Inert(P);x.reply={'currentEpochMatches':True,'state':'closed','posting':False,'members':0}
  state={'startsAt':NOW,'deadline':NOW+300}
  for action in [x.arm,x.start_api,x.start_worker_off,x.stop_analysis,x.promote,x.activate]:
   with self.assertRaisesRegex(RuntimeError,'FORWARD_FENCE'):action(state)
  self.assertTrue(all(c=='provenance' for c in x.commands))
 def test_expired_arming_prevents_any_forward_db_or_host_mutation(self):
  x=Inert(P)
  with self.assertRaisesRegex(RuntimeError,'ARMING'):x.advancing({'startsAt':NOW-90,'deadline':NOW+210})
  self.assertEqual(x.commands,['provenance'])
 def test_worker_payload_retains_hardening_and_explicit_scope(self):
  template=json.loads((P/'scrubbed-worker-template.json').read_text());template['Config']['Env']=['SUPABASE_URL=https://'+h.g.PROJECT+'.supabase.co']
  s,_=fixture();s['workerTemplateID']=template['Id'];s['workerTemplateConfigurationHash']=h.configuration(template)
  payload=h.worker_payload(template,s,'22222222-2222-4222-8222-222222222222',{'org.opencontainers.image.revision':h.g.SOURCE})
  self.assertEqual(payload['Hostname'],'');self.assertEqual(payload['HostConfig']['RestartPolicy']['Name'],'no')
  self.assertTrue(payload['HostConfig']['ReadonlyRootfs']);self.assertEqual(payload['Labels']['org.opencontainers.image.revision'],h.g.SOURCE)
  env=dict(x.split('=',1) for x in payload['Env']);self.assertEqual(env['MASARIFI_VOICE_ANALYSIS_ONLY'],'false');self.assertEqual(env['MASARIFI_STAGING_VOICE_EPOCH_ID'],'22222222-2222-4222-8222-222222222222')
 def test_worker_configuration_drift_prevents_stop(self):
  x=Inert(P);x.worker=lambda _: (_ for _ in ()).throw(RuntimeError('WRITER_CONFIGURATION_CHANGED'))
  with self.assertRaisesRegex(RuntimeError,'CONFIGURATION'):x.stop_worker({'workerID':'a'*64})
  self.assertEqual(x.commands,['provenance'])
 def test_current_runtime_reads_do_not_accept_epoch_or_manifest_drift(self):
  x=Inert(P);original={'epochId':'a','activationRequestedAt':NOW};x.saved={'epochId':'b','activationRequestedAt':NOW}
  with self.assertRaisesRegex(RuntimeError,'RUNTIME_CHANGED'):x.snapshot(original)
 def test_supervisor_file_content_must_match_before_systemctl(self):
  with tempfile.TemporaryDirectory() as t:
   x=Inert(t);p=pathlib.Path(t)/x.unit();p.write_text('foreign');p.chmod(0o600)
   with patch.object(h.os,'getuid',return_value=0,create=True),patch.object(h.stat,'S_ISREG',return_value=True):
    # On Windows st_uid=0; on CI temporary file belongs to runner, so mismatch also rejects.
    with self.assertRaisesRegex(RuntimeError,'MONITOR_SOURCE'):x.monitor_proof()
   self.assertEqual(x.commands,[])

 @unittest.skipIf(os.name=='nt','POSIX lifecycle locks qualified in Linux CI')
 def test_begin_lifecycle_lock_blocks_monitor_closure_until_forward_work_exits(self):
  import fcntl
  with tempfile.TemporaryDirectory() as t:
   x=Inert(t);y=Inert(t);lock=pathlib.Path(t)/'lifecycle.lock';lock.write_text('');lock.chmod(0o600)
   x.sequence_lock=lock.open('r');fcntl.flock(x.sequence_lock,fcntl.LOCK_EX)
   entered=threading.Event();finished=threading.Event();errors=[]
   def closure():
    try:
     with y.closure_lock():entered.set()
    except Exception as e:errors.append(e)
    finally:finished.set()
   original=pathlib.Path.lstat
   def private_stat(p):
    v=original(p);return types.SimpleNamespace(st_mode=h.stat.S_IFREG|0o600,st_uid=0)
   with patch.object(pathlib.Path,'lstat',private_stat):
    thread=threading.Thread(target=closure);thread.start();self.assertFalse(entered.wait(.1))
    x.release_sequence();self.assertTrue(finished.wait(2));thread.join(2)
   self.assertEqual(errors,[]);self.assertTrue(entered.is_set())
 def test_wrong_supervisor_invocation_rejected_even_when_active(self):
  with tempfile.TemporaryDirectory() as t:
   x=Inert(t);target=pathlib.Path(t)/x.unit();target.write_text(x.unit_content());target.chmod(0o600)
   (pathlib.Path(t)/'monitor-invocation.json').write_text(json.dumps({'invocation':'a'*32,'unitHash':h.sha(x.unit_content().encode())}))
   def run(args,**kw):
    if '--property=FragmentPath' in args:return str(target)
    if '--property=DropInPaths' in args:return ''
    if '--property=InvocationID' in args:return 'b'*32
    return 'active'
   x.run=run;original=pathlib.Path.lstat
   def private_stat(p):
    v=original(p);return types.SimpleNamespace(st_mode=h.stat.S_IFREG|0o600,st_uid=0)
   with patch.object(pathlib.Path,'lstat',private_stat),patch.object(pathlib.Path,'is_symlink',return_value=True),patch.object(pathlib.Path,'resolve',return_value=target):
    with self.assertRaisesRegex(RuntimeError,'INVOCATION_CHANGED'):x.monitor_proof()

 def test_activation_metadata_persistence_between_snapshot_and_guard_does_not_close_scope(self):
  x=Inert(P);state={'epochId':'a','startsAt':NOW,'deadline':NOW+300};x.saved=copy.deepcopy(state)
  x.reply={'state':'active','posting':True,'currentEpochMatches':True,'committed':0,'members':0,'deadline':None}
  def concurrent_guard(current):
   x.saved['activationRequestedAt']=NOW+1
   h.synchronize_runtime(current,x.state())
  x.guard=concurrent_guard
  observed=x.snapshot(state)
  self.assertTrue(observed['scopeValid']);self.assertEqual(state['activationRequestedAt'],NOW+1)
 def test_activation_metadata_never_relaxes_immutable_epoch_manifest_or_deadline(self):
  original={'epochId':'a','packet':{'controlHash':'x'},'startsAt':NOW,'deadline':NOW+300}
  for key,value in [('epochId','b'),('packet',{'controlHash':'y'}),('deadline',NOW+600),('activationRequestedAt',NOW+90)]:
   observed={**original,key:value}
   with self.assertRaises(RuntimeError):h.synchronize_runtime(copy.deepcopy(original),observed)

 def test_environment_or_ca_rotation_does_not_prevent_owned_worker_stop(self):
  x=Inert(P);x.qualified=lambda:(_ for _ in ()).throw(RuntimeError('PIN_CHANGED'))
  x.close_epoch=lambda _:(_ for _ in ()).throw(RuntimeError('PIN_CHANGED'))
  x.closure_lock=lambda:contextlib.nullcontext();x.saved={'workerID':'a'*64}
  receipt=h.g.close(x.saved,x)
  self.assertFalse(receipt['postingOff']);self.assertTrue(receipt['workerStopped'])
  self.assertIn(['docker','stop','--time','5','a'*64],x.commands)

 def test_closure_request_blocks_forward_actions_and_ready(self):
  with tempfile.TemporaryDirectory() as t:
   x=Inert(t);(pathlib.Path(t)/'close-request.json').write_text('{}')
   for action in [x.arm,x.start_api,x.start_worker_off,x.stop_analysis,x.promote,x.activate,x.ready,x.save_ready]:
    with self.assertRaisesRegex(RuntimeError,'CLOSURE_ALREADY_REQUESTED'):action({'startsAt':NOW,'deadline':NOW+300})
   self.assertTrue(all(c=='provenance' for c in x.commands))
 def test_authority_expiring_during_auth_prevents_activation_dispatch(self):
  x=Inert(P);x.advancing=lambda _:None;x.scope['expiresAt']=NOW+1
  x.approval['scopeHash']=h.g.digest(x.scope);x.auth=lambda:setattr(x,'now',lambda:NOW+2)
  x.cohort=lambda *a:None;x.public_ready=lambda _:None;x.monitor_proof=lambda:None
  x.reply={'state':'active'}
  with self.assertRaisesRegex(RuntimeError,'AUTHORITY_EXPIRED'):x.activate({'startsAt':NOW,'deadline':NOW+300})
  self.assertIsNone(x.saved)
 def test_monitor_close_decision_is_published_before_waiting_for_begin_lock(self):
  from test_canary_control import Host
  x=Host();events=[]
  x.request_close=lambda reason:events.append(('cancel',reason))
  @contextlib.contextmanager
  def wait_for_begin():
   self.assertEqual(events,[('cancel','scope_failure')]);events.append(('lock','acquired'));yield
  x.closure_lock=wait_for_begin;x.statuses=[{'scopeValid':False}]
  self.assertEqual(h.g.monitor({'startsAt':NOW,'deadline':NOW+300},x),'scope_failure')
  self.assertEqual(events[0],('cancel','scope_failure'))

 def test_cancellation_arriving_inside_readiness_probe_escapes_wait_immediately(self):
  with tempfile.TemporaryDirectory() as t:
   x=Inert(t)
   def probe():(pathlib.Path(t)/'close-request.json').write_text('{}');return True
   with self.assertRaisesRegex(RuntimeError,'CLOSURE_ALREADY_REQUESTED'):x.wait({'deadline':NOW+300},probe)

if __name__=='__main__':unittest.main()
