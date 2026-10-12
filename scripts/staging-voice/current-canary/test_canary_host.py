"""Adapter regressions. No subprocess, device or hosted network access."""
import contextlib,copy,importlib.util,json,pathlib,tempfile,unittest
from unittest.mock import patch
P=pathlib.Path(__file__).parent
sp=importlib.util.spec_from_file_location('host',P/'canary-host.py');h=importlib.util.module_from_spec(sp);sp.loader.exec_module(h)
from test_canary_control import fixture,NOW

class Inert(h.LocalHost):
 def __init__(self,root,scope=None):
  s,a=fixture();super().__init__(root,scope or s,a);self.commands=[];self.saved=None;self.container={'Id':'a'*64,'State':{'Running':True}}
 def guard(self,state):self.commands.append('provenance')
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

if __name__=='__main__':unittest.main()
