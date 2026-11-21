import copy,importlib.util,json,pathlib,unittest
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('g',HERE/'diagnostic-control.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
class Host:
 def __init__(self,fail=None,committed=False):self.calls=[];self.fail=fail;self.committed=committed
 def now(self):return 1791874800
 def step(self,name):
  self.calls.append(name)
  if self.fail==name:raise RuntimeError('fixture-failure')
 def preflight(self,s):self.step('preflight')
 def claim(self,s,a):self.step('claim')
 def pull(self,s):self.step('pull')
 def apply_once(self,s):self.step('apply')
 def verify(self,s):self.step('verify');return {'migrationVerified':True}
 def reconcile(self,s):self.step('read-only-reconcile');return {'migrationVerified':self.committed}
 def receipt(self,status,report):self.calls.append(status)
class Tests(unittest.TestCase):
 def setUp(self):
  if (HERE/'scope.json').exists():self.s=json.loads((HERE/'scope.json').read_text())
  else:
   root=next(p for p in HERE.parents if (p/'supabase/migrations/20261013053237_voice_scope_rejection_diagnostics.sql').exists())
   sql=(root/'supabase/migrations/20261013053237_voice_scope_rejection_diagnostics.sql').read_text().replace('\r\n','\n')
   db={'posting':False,'activeEpochs':0,'analysisJobs':0,'assistantJobs':0,'helper':None,'migrations':[]}
   self.s={'host':g.HOST,'project':g.PROJECT,'source':g.SOURCE,'image':g.IMAGE,'sqlHash':g.SQL,'version':g.VERSION,'budgetSeconds':300,'attempt':'11111111-1111-4111-8111-111111111111','expiresAt':1791882000,
    'files':{n:'0'*64 for n in ['diagnostic-control.py','diagnostic-host.py','diagnostic-migration.cjs','diagnostic-executor.py']},
    'endpoint':{'hostname':'aws-0-eu-central-1.pooler.supabase.com','port':'5432','usernameHash':'60c9bd607b7b11c44f91049ef22b5811b92ec8938ae8edcca2fc7002f54b4939','database':'/postgres'},
    'packet':{'version':g.VERSION,'name':'voice_scope_rejection_diagnostics','sql':sql,'sqlHash':g.SQL,'acceptanceBodyHash':'683de0fd60086962c86b256983b5feadd00f4c300166a82bfc782250de29ebec','helperBodyHash':'ce00e1b5da381a8baa4ac95f3e6882bb73dbccf107ff8007577e9c5410c1696b','expected':db},'baseline':{'database':db}}
  self.h=Host()
  self.a={'kind':'direct-human-staging-diagnostic-approval','scopeHash':g.digest(self.s),'receivedAt':self.h.now()-10,'messageReference':'disposable-test-only','verbatim':'Fixture approval only; not authority for any live operation'}
 def rejected(self,s=None,a=None):
  with self.assertRaises(RuntimeError):g.execute(s or self.s,self.a if a is None else a,self.h)
  self.assertEqual(self.h.calls,[])
 def test_no_authority_no_host_operations(self):self.rejected(a={})
 def test_expired_wrong_reference_future_and_wrong_hash_approvals(self):
  for change in [{'receivedAt':self.h.now()-3601},{'receivedAt':self.h.now()+1},{'scopeHash':'0'*64},{'kind':'deployment-preparation'},{'messageReference':''}]:
   a={**self.a,**change};self.rejected(a=a)
 def test_changed_sql_source_limits_endpoint_and_function_bodies_reject_before_host(self):
  for key,value in [('source','0'*40),('image','wrong'),('budgetSeconds',301),('expiresAt',self.h.now()-1)]:
   s={**self.s,key:value};a={**self.a,'scopeHash':g.digest(s)};self.rejected(s,a)
  for field,value in [('sql','unreviewed'),('helperBodyHash','0'*64),('acceptanceBodyHash','0'*64)]:
   s=copy.deepcopy(self.s);s['packet'][field]=value;self.rejected(s,{**self.a,'scopeHash':g.digest(s)})
  s=copy.deepcopy(self.s);s['endpoint']['port']='6543';self.rejected(s,{**self.a,'scopeHash':g.digest(s)})
 def test_on_or_active_jobs_reject_before_host(self):
  for key,value in [('posting',True),('activeEpochs',1),('analysisJobs',1),('assistantJobs',1)]:
   s=copy.deepcopy(self.s);s['baseline']['database'][key]=value;s['packet']['expected']=s['baseline']['database'];self.rejected(s,{**self.a,'scopeHash':g.digest(s)})
 def test_baseline_drift_stops_before_claim(self):
  h=Host('preflight')
  with self.assertRaises(RuntimeError):g.execute(self.s,self.a,h)
  self.assertEqual(h.calls,['preflight'])
 def test_failed_pull_never_executes_ddl(self):
  h=Host('pull')
  with self.assertRaises(RuntimeError):g.execute(self.s,self.a,h)
  self.assertNotIn('apply',h.calls);self.assertEqual(h.calls.count('read-only-reconcile'),1)
 def test_authority_expiring_during_claim_prevents_pull(self):
  h=Host();clock=[h.now()];h.now=lambda:clock[0]
  def claim(s,a):h.step('claim');clock[0]=s['expiresAt']
  h.claim=claim
  with self.assertRaisesRegex(RuntimeError,'APPROVAL_EXPIRED|SCOPE_EXPIRED'):g.execute(self.s,self.a,h)
  self.assertNotIn('pull',h.calls);self.assertNotIn('apply',h.calls)
 def test_authority_expiring_during_pull_or_second_preflight_prevents_ddl(self):
  h=Host();clock=[h.now()];h.now=lambda:clock[0]
  def pull(s):h.step('pull');clock[0]=s['expiresAt']
  h.pull=pull
  with self.assertRaisesRegex(RuntimeError,'APPROVAL_EXPIRED|SCOPE_EXPIRED'):g.execute(self.s,self.a,h)
  self.assertNotIn('apply',h.calls);self.assertEqual(h.calls.count('read-only-reconcile'),1)
 def test_uncertain_commit_never_replays_and_read_only_reconciles(self):
  for fail in ['apply','verify']:
   h=Host(fail,committed=True)
   with self.assertRaises(RuntimeError):g.execute(self.s,self.a,h)
   self.assertEqual(h.calls.count('apply'),1);self.assertEqual(h.calls.count('read-only-reconcile'),1)
   self.assertIn('COMMITTED_VERIFIED',h.calls)
 def test_uncertain_reconciliation_explicitly_unconfirmed_no_retry(self):
  h=Host('apply')
  def unknown(s):h.calls.append('read-only-reconcile');raise RuntimeError('unknown')
  h.reconcile=unknown
  with self.assertRaises(RuntimeError):g.execute(self.s,self.a,h)
  self.assertIn('INSTALLATION_UNCONFIRMED',h.calls);self.assertEqual(h.calls.count('apply'),1)
 def test_success_is_exactly_one_install_and_read_only_verification(self):
  self.assertEqual(g.execute(self.s,self.a,self.h),{'migrationVerified':True})
  self.assertEqual(self.h.calls,['preflight','claim','pull','apply','verify','VERIFIED'])
if __name__=='__main__':unittest.main()
