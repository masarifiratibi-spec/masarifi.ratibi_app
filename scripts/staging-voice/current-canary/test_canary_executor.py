"""One-shot local authorization boundary; transport is always inert."""
import hashlib,importlib.util,json,os,pathlib,socket,stat,tempfile,types,unittest
from unittest.mock import patch
from test_canary_control import fixture,NOW
sp=importlib.util.spec_from_file_location('executor',pathlib.Path(__file__).with_name('execute-approved-canary.py'))
e=importlib.util.module_from_spec(sp);sp.loader.exec_module(e)

class Tests(unittest.TestCase):
 def test_foreign_owned_runtime_never_dispatches_cleanup(self):
  s,a=fixture()
  with tempfile.TemporaryDirectory() as folder,patch.object(e.subprocess,'run') as transport:
   root=pathlib.Path(folder);(root/'runtime.json').write_text('{}')
   (root/'scope.json').write_text('{}');(root/'approval.json').write_text(json.dumps(a))
   for name in s['files']:(root/name).write_text('INERT')
   def metadata(path):return types.SimpleNamespace(st_uid=0,st_mode=(stat.S_IFDIR|0o700) if path==root else (stat.S_IFREG|0o600))
   with patch.object(pathlib.Path,'lstat',metadata),self.assertRaisesRegex(RuntimeError,'FOREIGN_CLEANUP_PRESERVED'):e.recover_owned(root,{'scope':s,'approval':a},transport)
   transport.assert_not_called()
 def test_same_owned_pinned_recovery_dispatches_close_once(self):
  s,a=fixture()
  with tempfile.TemporaryDirectory() as folder,patch.object(e.subprocess,'run') as transport:
   root=pathlib.Path(folder);(root/'runtime.json').write_text('{}')
   for name in s['files']:(root/name).write_text('INERT');s['files'][name]=hashlib.sha256(b'INERT').hexdigest()
   a['scopeHash']=e.g.digest(s)
   (root/'scope.json').write_text(json.dumps(s));(root/'approval.json').write_text(json.dumps(a))
   def metadata(path):return types.SimpleNamespace(st_uid=0,st_mode=(stat.S_IFDIR|0o700) if path==root else (stat.S_IFREG|0o600))
   with patch.object(pathlib.Path,'lstat',metadata):e.recover_owned(root,{'scope':s,'approval':a},transport)
   transport.assert_called_once();self.assertEqual(transport.call_args.args[0][-1],'close')
 def test_remote_expiry_recheck_precedes_any_directory_or_transport_mutation(self):
  s,a=fixture();s['expiresAt']=NOW-1;validator=e.HERE.joinpath('canary-control.py').read_bytes();s['files']['canary-control.py']=hashlib.sha256(validator).hexdigest();a['scopeHash']=e.g.digest(s)
  source=e.remote_source({'scope':s,'approval':a,'files':{'canary-control.py':validator.hex()}})
  with patch.object(os,'getuid',return_value=0,create=True),patch.object(socket,'gethostname',return_value=e.g.HOST),patch.object(e.subprocess,'run') as transport,patch.object(pathlib.Path,'mkdir') as mutation:
   with self.assertRaisesRegex(RuntimeError,'ACTIVATION_AUTHORITY_EXPIRED'):exec(compile(source,'INERT-executor','exec'),{})
   mutation.assert_not_called();transport.assert_not_called()
 def test_changed_local_evidence_refuses_before_transport(self):
  s,a=fixture();s['executorHash']=hashlib.sha256(pathlib.Path(e.__file__).read_bytes()).hexdigest()
  with tempfile.TemporaryDirectory() as folder:
   p=pathlib.Path(folder)/'proof';p.write_text('INERT');s['localEvidence']=[{'path':str(p),'sha256':'0'*64}];a['scopeHash']=e.g.digest(s)
   with patch.object(e.subprocess,'run') as transport,patch.object(e.time,'time',return_value=NOW):
    with self.assertRaisesRegex(RuntimeError,'LOCAL_EVIDENCE_CHANGED'):e.checked_packet(s,a)
    transport.assert_not_called()
 def test_missing_financial_approval_never_reads_evidence_or_uses_transport(self):
  s,_=fixture()
  with patch.object(e.subprocess,'run') as transport,patch.object(e.time,'time',return_value=NOW):
   with self.assertRaisesRegex(RuntimeError,'DIRECT_FINANCIAL_APPROVAL_REQUIRED'):e.checked_packet(s,None)
   transport.assert_not_called()
 def test_changed_executor_refuses_before_transport(self):
  s,a=fixture();s['executorHash']='0'*64;a['scopeHash']=e.g.digest(s)
  with patch.object(e.subprocess,'run') as transport,patch.object(e.time,'time',return_value=NOW):
   with self.assertRaisesRegex(RuntimeError,'EXECUTOR_CHANGED'):e.checked_packet(s,a)
   transport.assert_not_called()
 def test_consumed_attempt_cannot_run_again(self):
  s,a=fixture()
  with tempfile.TemporaryDirectory() as folder:
   root=pathlib.Path(folder);(root/'scope.json').write_text(json.dumps(s));(root/'approval.json').write_text(json.dumps(a))
   (root/('execution-'+s['attempt'])).mkdir()
   with patch.object(e,'HERE',root),patch.object(e,'checked_packet',return_value={}),patch.object(e.subprocess,'run') as transport,patch.object(e.sys,'argv',['executor',str(root/'scope.json'),str(root/'approval.json')]):
    with self.assertRaises(FileExistsError):e.main()
    transport.assert_not_called()
 def test_timeout_is_consumed_and_never_retried(self):
  s,a=fixture()
  with tempfile.TemporaryDirectory() as folder:
   root=pathlib.Path(folder);(root/'scope.json').write_text(json.dumps(s));(root/'approval.json').write_text(json.dumps(a))
   with patch.object(e,'HERE',root),patch.object(e,'checked_packet',return_value={'scope':s,'approval':a,'files':{}}),patch.object(e.subprocess,'run',side_effect=e.subprocess.TimeoutExpired('INERT',530)) as transport,patch.object(e.sys,'argv',['executor',str(root/'scope.json'),str(root/'approval.json')]):
    with self.assertRaisesRegex(RuntimeError,'TRANSPORT_UNCERTAIN_DO_NOT_RETRY'):e.main()
    transport.assert_called_once();evidence=root/('execution-'+s['attempt'])
    self.assertTrue((evidence/'consumed.json').exists());self.assertTrue(json.loads((evidence/'transport-uncertain.json').read_text())['neverRetry'])

if __name__=='__main__':unittest.main()
