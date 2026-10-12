"""Behavioral guard tests; every host boundary is inert."""
import contextlib,copy,importlib.util,pathlib,unittest
p=pathlib.Path(__file__).with_name('canary-control.py')
s=importlib.util.spec_from_file_location('canary',p);g=importlib.util.module_from_spec(s);s.loader.exec_module(g)
NOW=1791832800

def fixture():
 scope={'host':g.HOST,'project':g.PROJECT,'source':g.SOURCE,'image':g.IMAGE,'apkHash':g.APK,'attempt':'11111111-1111-4111-8111-111111111111','expiresAt':NOW+3600,'ownerId':g.OWNER,'accountId':g.ACCOUNT,'categoryId':g.CATEGORY,'clerkSessionHash':'1'*64,'baseline':{'confirmedMinor':-31000,'pendingMinor':0,'ledgerVersion':4},'financialAPIID':'3'*64,'financialAPIConfigurationHash':'4'*64,'publicAPIID':'5'*64,'publicAPIConfigurationHash':'6'*64,'workerTemplateID':'7'*64,'workerTemplateConfigurationHash':'8'*64,'analysisID':'9'*64,'analysisConfigurationHash':'a'*64,'nginxBeforeHash':'b'*64,'nginxAfterHash':'c'*64,'files':{'canary-control.py':'d'*64,'canary-host.py':'e'*64,'canary-db.cjs':'f'*64},'backupHash':'0'*64,'backupRestoreHash':'1'*64,'offReadinessProofHash':'2'*64,'envHashes':{'worker.env':'3'*64,'migration.env':'4'*64},'caHash':'5'*64,'otherContainers':[]}
 approval={'kind':'direct-human-financial-canary-approval','scopeHash':g.digest(scope),'receivedAt':NOW,'messageReference':'test-only-human-turn','verbatim':'TEST ONLY approve bounded fresh 10 SAR scope'}
 return scope,approval

class Host:
 def closure_lock(self):return contextlib.nullcontext()
 def __init__(self):self.calls=[];self.state=None;self.fail=None;self.statuses=[{'scopeValid':True,'state':'closed','committed':1,'posting':False}]
 def now(self):return NOW
 def action(self,name):
  self.calls.append(name)
  if self.fail==name:raise RuntimeError('INERT_FAILURE')
 def preflight(self,scope):self.action('preflight')
 def claim(self,scope,approval):self.action('claim')
 def prepare(self,scope,approval):
  self.action('prepare');self.state={'epochId':'22222222-2222-4222-8222-222222222222','workerID':'a'*64,'startsAt':NOW,'deadline':NOW+300};return self.state
 def reconcile(self):self.action('reconcile');return self.state
 def arm(self,state):self.action('arm')
 def start_api(self,state):self.action('start_api')
 def start_worker_off(self,state):self.action('start_worker_off')
 def verify_worker_off(self,state):self.action('verify_worker_off')
 def stop_analysis(self,state):self.action('stop_analysis')
 def promote(self,state):self.action('promote')
 def activate(self,state):self.action('activate')
 def ready(self,state):self.action('ready')
 def save_ready(self,state):self.action('save_ready')
 def guard(self,state):self.action('guard')
 def close_epoch(self,state):self.action('close_epoch');return {'state':'closed','posting':False}
 def stop_worker(self,state):self.action('stop_worker')
 def restore_route(self,state):self.action('restore_route')
 def stop_api(self,state):self.action('stop_api')
 def restore_analysis(self,state):self.action('restore_analysis')
 def verify_restored(self,state):self.action('verify_restored')
 def snapshot(self,state):self.action('snapshot');return self.statuses.pop(0)
 def pause(self,seconds):pass

class Tests(unittest.TestCase):
 def test_direct_exact_approval_required_before_even_preflight(self):
  for change in [None,{'kind':'posting-off-approval'},{'scopeHash':'0'*64},{'receivedAt':NOW+1},{'receivedAt':NOW-3601}]:
   h=Host();scope,a=fixture();a=None if change is None else {**a,**change}
   with self.assertRaises(RuntimeError):g.begin(scope,a,h)
   self.assertEqual(h.calls,[])
 def test_wrong_scope_or_expired_scope_never_touches_host(self):
  for key,value in [('host','production'),('project','other'),('image','other'),('apkHash','0'*64),('ownerId','other'),('accountId','other'),('categoryId','other'),('expiresAt',NOW)]:
   h=Host();scope,a=fixture();scope[key]=value;a['scopeHash']=g.digest(scope)
   with self.assertRaises(RuntimeError):g.begin(scope,a,h)
   self.assertEqual(h.calls,[])
 def test_worker_off_and_supervisor_must_pass_before_financial_activation(self):
  h=Host();scope,a=fixture();result=g.begin(scope,a,h)
  self.assertEqual(h.calls,['preflight','claim','prepare','arm','start_api','start_worker_off','verify_worker_off','stop_analysis','promote','activate','ready','save_ready'])
  self.assertEqual(result['deadline']-result['startsAt'],300)
 def test_any_failure_attempts_closure_then_owned_stop_and_restoration(self):
  for failure in ['arm','start_api','start_worker_off','verify_worker_off','stop_analysis','promote','activate','ready','save_ready']:
   h=Host();h.fail=failure;scope,a=fixture()
   with self.assertRaises(RuntimeError):g.begin(scope,a,h)
   close=h.calls.index('close_epoch');stop=h.calls.index('stop_worker');restore=h.calls.index('restore_route')
   self.assertLess(close,stop);self.assertLess(stop,restore)
   if failure in ['arm','start_api','start_worker_off','verify_worker_off','stop_analysis','promote']:self.assertNotIn('activate',h.calls)
 def test_prepare_failure_without_confirmed_epoch_never_guesses_mutation(self):
  h=Host();h.fail='prepare';scope,a=fixture()
  with self.assertRaises(RuntimeError):g.begin(scope,a,h)
  self.assertEqual(h.calls,['preflight','claim','prepare','reconcile'])
 def test_unconfirmed_off_still_stops_writer_and_refuses_restoration(self):
  h=Host();h.close_epoch=lambda _: {'state':'active','posting':True}
  result=g.close({'deadline':NOW-1},h)
  self.assertFalse(result['postingOff']);self.assertIn('stop_worker',h.calls);self.assertNotIn('restore_analysis',h.calls);self.assertNotIn('restore_route',h.calls)
 def test_writer_stop_failure_prevents_restoration(self):
  h=Host();h.fail='stop_worker';result=g.close({'deadline':NOW-1},h)
  self.assertTrue(result['postingOff']);self.assertFalse(result['workerStopped']);self.assertNotIn('restore_route',h.calls)
 def test_expiry_does_not_revoke_closure(self):
  h=Host();result=g.close({'deadline':NOW-1},h)
  self.assertTrue(result['restored']);self.assertEqual(h.calls,['guard','close_epoch','stop_worker','restore_route','stop_api','restore_analysis','verify_restored'])
 def test_new_commit_closes_before_considering_shutdown_health(self):
  h=Host();state={'deadline':NOW+300,'startsAt':NOW};reason=g.monitor(state,h)
  self.assertEqual(reason,'completed');self.assertIn('close_epoch',h.calls)
 def test_foreign_or_duplicate_scope_fails_closed(self):
  for snapshot in [{'scopeValid':False},{'scopeValid':True,'state':'active','committed':2,'posting':True}]:
   h=Host();h.statuses=[snapshot];self.assertEqual(g.monitor({'deadline':NOW+300,'startsAt':NOW},h),'scope_failure')
 def test_prepared_off_worker_can_arm_only_within_fixed_grace(self):
  h=Host();h.now=lambda:NOW+91;h.statuses=[{'scopeValid':True,'state':'prepared','committed':0,'posting':False}]
  self.assertEqual(g.monitor({'deadline':NOW+300,'startsAt':NOW},h),'arming_timeout')
 def test_deadline_closes_without_another_database_probe(self):
  h=Host();self.assertEqual(g.monitor({'deadline':NOW,'startsAt':NOW-300},h),'deadline');self.assertNotIn('snapshot',h.calls)

if __name__=='__main__':unittest.main()
