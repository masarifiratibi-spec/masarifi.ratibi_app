import importlib.util
import pathlib
import unittest
import stat
import sys
import json
from contextlib import ExitStack
from unittest.mock import patch, Mock
from types import SimpleNamespace
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('broker', pathlib.Path(__file__).with_name('host_broker.py'))
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)


class BrokerContract(unittest.TestCase):
    def test_restored_parent_transport_uses_real_owned_stop_and_committed_chain_not_caller_booleans(self):
        for failure in (None, 'running', 'replacement', 'exit', 'failure', 'partial', 'consumed', 'worker', 'journal'):
            with self.subTest(failure=failure), ExitStack() as stack:
                parent={'sessionId':'t03-qa-fb5466b129d985fa','maxClaims':6,'binding':{'initialVersion':1,'initialRow':{'operation_id':'synthetic-op','id':'synthetic-mutation'}}}
                raw=broker.encode(parent)
                state={'sessionId':parent['sessionId'],'phase':1,'claims':1,'status':'stopped','version':2,'note':broker.PHASES[0],'failure':'SESSION_EXECUTION_FAILED','inflight':None,'operations':['synthetic-op'],'mutations':['synthetic-mutation'],'directReceipts':[]}
                journal=broker.encode({'sequence':0,'previous':None,'state':state})
                parent_pin=broker.digest(raw); journal_pin=broker.digest(journal)
                stack.enter_context(patch.object(broker,'PARENT_MANIFEST_PIN',parent_pin))
                stack.enter_context(patch.object(broker,'PARENT_JOURNAL_PIN',journal_pin))
                record={'id':broker.PARENT_CONTAINER,'runId':broker.PARENT_RUN,'mode':'session','manifestPin':parent_pin,'packagePin':broker.PARENT_PACKAGE,'archivePin':broker.PARENT_ARCHIVE,'packageRoot':'/opt/masarifi/qa-t03/packages/'+broker.PARENT_ARCHIVE}
                value=broker.expected_identity(record); value['Labels'][broker.OCI_LABEL]='synthetic-revision';value['Running']=failure=='running';value['PortBindings']=None
                if failure=='replacement': value['Id']='0'*64
                root=broker.CONTROL+'/journal/'+parent['sessionId']
                files={broker.CONTROL+'/private/session.json':raw,broker.CONTROL+'/control/'+broker.PARENT_RUN+'/identity.json':broker.encode(record),broker.CONTROL+'/control/'+broker.PARENT_RUN+'/failure.json':broker.encode({'ok':False,'phase':'candidate','code':'QA_HOST_STAGE_FAILED'}),root+'/00000.json':journal,root+'/00000.committed':broker.digest(journal).encode()}
                if failure=='failure': files[broker.CONTROL+'/control/'+broker.PARENT_RUN+'/failure.json']=b'{}'
                if failure=='journal': files[root+'/00000.json']=b'{}'
                names=['00000.json','00000.committed']+(['00001.json'] if failure=='partial' else [])
                stack.enter_context(patch.object(broker,'read_checked',side_effect=lambda name,*args:files[name]))
                stack.enter_context(patch.object(broker,'inspect',side_effect=lambda identity:value if identity==broker.PARENT_CONTAINER else {'Id':broker.GENERAL,'Running':failure=='worker'}))
                stack.enter_context(patch.object(broker,'command',return_value=broker.encode({'exitCode':0 if failure=='exit' else 1,'oomKilled':False})))
                stack.enter_context(patch.object(broker,'open_directory',return_value=9))
                stack.enter_context(patch.object(broker.os,'close'))
                stack.enter_context(patch.object(broker.os,'fstat',return_value=SimpleNamespace(st_uid=65532,st_mode=0o700)))
                stack.enter_context(patch.object(broker.os,'listdir',return_value=names))
                stack.enter_context(patch.object(broker.os.path,'lexists',return_value=failure=='consumed'))
                writes=stack.enter_context(patch.object(broker,'exclusive_private'))
                if failure:
                    with self.assertRaisesRegex(ValueError,'QA_HOST_'): broker.collect_restored_parent()
                else:
                    result=broker.collect_restored_parent()
                    self.assertEqual(result['parentManifestRaw'],raw.decode())
                    self.assertEqual(result['parentJournalRaw'],journal.decode())
                    self.assertEqual(result['ownedStop'],{'containerId':broker.PARENT_CONTAINER,'contractMatch':True,'running':False,'portsEmpty':True,'exitCode':1,'oomKilled':False})
                    self.assertTrue(result['journalChainValidated'])
                writes.assert_not_called()

    def test_restored_frames_keep_rehearsal_clockless_and_bound_session_on_separate_protected_files(self):
        evidence={'parentManifestRaw':'SYNTHETIC_PRIVATE_PARENT','parentJournalRaw':'SYNTHETIC_PRIVATE_JOURNAL'}
        manifest={'restoredSuccessor':{'kind':broker.RESTORED_KIND,'parentEvidenceSha256':broker.canonical_sha(evidence)}}
        raw=broker.encode(manifest); actual_digest=broker.digest
        env={filename:('SYNTHETIC_'+key).encode() for key,filename,_ in broker.ENV_FILES}
        pins={env[filename]:pin for _,filename,pin in broker.ENV_FILES}
        files={**env,broker.RESTORED_SESSION:raw,broker.RESTORED_EVIDENCE:broker.encode(evidence)}
        def hash_bytes(data): return pins[data] if data in pins else actual_digest(data)
        with patch.object(broker,'read_checked',side_effect=lambda name,*args:files[name]) as reads,patch.object(broker,'digest',side_effect=hash_bytes),patch.object(broker,'verify_host',return_value={}),patch.object(broker,'collect_restored_parent',return_value=evidence),patch.object(broker,'exclusive_private') as writes:
            with patch.object(broker.time,'time',side_effect=AssertionError('NO_NEW_CLOCK')):
                rehearsal=json.loads(broker.private_frame('preflight','/public/package','a'*64,None,None,'t03-fixed-next',3600,True,True))
            self.assertIsNone(rehearsal['deadlineAt']);self.assertEqual(rehearsal['restoredBindingRequest'],'rehearsal')
            frame=json.loads(broker.private_frame('session','/public/package','a'*64,None,actual_digest(raw),None,3600,True,False))
            self.assertEqual(frame['manifest'],raw.decode())
            self.assertEqual(frame['restoredParent'],evidence)
            self.assertNotIn(broker.CONTROL+'/private/session.json',[call.args[0] for call in reads.call_args_list])
            files[broker.RESTORED_EVIDENCE]=b'{}'
            with self.assertRaisesRegex(ValueError,'QA_HOST_RESTORED_EVIDENCE_CHANGED'):
                broker.private_frame('session','/public/package','a'*64,None,actual_digest(raw),None,3600,True,False)
            writes.assert_not_called()

    def test_restored_binding_writes_only_new_fixed_paths_and_partial_write_never_overwrites_or_retries(self):
        evidence={'parentManifestRaw':'SYNTHETIC_PRIVATE_PARENT','parentJournalRaw':'SYNTHETIC_PRIVATE_JOURNAL'}
        manifest={'restoredSuccessor':{'kind':broker.RESTORED_KIND,'parentEvidenceSha256':broker.canonical_sha(evidence)}}
        with patch.object(broker,'collect_restored_parent',return_value=evidence),patch.object(broker,'exclusive_private') as write:
            broker.write_binding(manifest,True)
            self.assertEqual([call.args[0] for call in write.call_args_list],[broker.RESTORED_EVIDENCE,broker.RESTORED_SESSION])
        files={}
        def partial(name,data):
            if name in files: raise ValueError('SYNTHETIC_ALREADY_EXISTS')
            if name==broker.RESTORED_SESSION: raise ValueError('SYNTHETIC_PARTIAL')
            files[name]=data
        with patch.object(broker,'collect_restored_parent',return_value=evidence),patch.object(broker,'exclusive_private',side_effect=partial):
            with self.assertRaisesRegex(ValueError,'SYNTHETIC_PARTIAL'): broker.write_binding(manifest,True)
            with self.assertRaisesRegex(ValueError,'SYNTHETIC_ALREADY_EXISTS'): broker.write_binding(manifest,True)
            self.assertEqual(set(files),{broker.RESTORED_EVIDENCE})

    def test_restored_parent_public_hash_pins_agree_across_node_and_python_transport(self):
        result=broker.subprocess.run(['node','-e','process.stdout.write(JSON.stringify(require("./scripts/qa/t03-session-consumer/successor.cjs").STAGING))'],capture_output=True,timeout=10,check=True)
        pins=json.loads(result.stdout)
        self.assertEqual((pins['parentManifestSha256'],pins['parentJournalSha256'],pins['containerId']),(broker.PARENT_MANIFEST_PIN,broker.PARENT_JOURNAL_PIN,broker.PARENT_CONTAINER))

    def test_restored_mode_mixes_reject_before_any_host_or_private_io(self):
        for args in (['inspect','--restored-successor'],['preflight','--restored-rehearsal'],['session','--restored-successor','--restored-rehearsal'],['preflight','--restored-successor','--restored-rehearsal','--manifest-sha256','a'*64]):
            with self.subTest(args=args),patch.object(sys,'argv',['host_broker.py']+args),patch.object(broker,'verify_public_tree') as tree,patch.object(broker,'read_checked') as read:
                with self.assertRaisesRegex(ValueError,'QA_HOST_RESTORED_'): broker.main()
                tree.assert_not_called();read.assert_not_called()

    def test_private_api_channel_uses_only_pinned_isolated_configuration(self):
        import json
        expected = [
            ('worker', '/etc/masarifi/worker.env', '968bd7f73bd3936cdd40aad8c099479df8bb40c668d27cc148d6f6bb244afb29'),
            ('api', '/etc/masarifi/qa-t03-api.env', '06506707b7a28c3817fb6afb577a1c9ab84ba11e39962755bd9d612e1984a077'),
            ('bootstrap', '/etc/masarifi/migration.env', '75b5d7fe85405c7b0d1bc257f1c5cc3b884c6f3ec3a8f736223a24ac0669acf1'),
        ]
        self.assertEqual(broker.ENV_FILES, expected)
        template = json.loads(pathlib.Path(__file__).with_name('session.template.json').read_text())
        self.assertFalse(template['enabled'])
        self.assertIsNone(template['binding']['userId'])
        self.assertEqual(template['configuration']['api']['sourcePath'], expected[1][1])
        self.assertEqual(template['configuration']['api']['envSha256'], expected[1][2])
        self.assertEqual(template['configuration']['api']['sourceProvenance'], {'kind':'unused-isolated-qa-api-configuration-created','originalPath':'/etc/masarifi/api.env','originalSha256':'abdb3bec68ec0489a06e3f5eaac682bf76679f6c1730210a7c7b49cde7085bef','binding':'isolated-qa-only'})
        self.assertEqual(template['configuration']['api']['normalizedPolicySha256'], '7db9f7b77be52ce6265d835b52d655ddee6e6aff3bee7026c1f7a3b5d821ca44')
        secret = {filename: ('SYNTHETIC_'+key).encode() for key,filename,_ in expected}
        pins = {secret[filename]: pin for _,filename,pin in expected}
        def read(filename,*args):
            if filename.endswith('/inspection-scope.json'): return b'{"relations":[],"functions":[]}'
            return secret[filename]
        with patch.object(broker,'read_checked',side_effect=read) as reads, patch.object(broker,'digest',side_effect=lambda data:pins[data]), patch.object(broker,'verify_host',return_value={}):
            frame=json.loads(broker.private_frame('inspect','/public/package','a'*64,None,None,'t03-synthetic',3600))
            self.assertEqual(frame['api'], 'SYNTHETIC_api')
            self.assertNotIn('/etc/masarifi/api.env',[call.args[0] for call in reads.call_args_list])
        with patch.object(broker,'read_checked',side_effect=read), patch.object(broker,'digest',side_effect=lambda data:'0'*64 if data==b'SYNTHETIC_api' else pins[data]), patch.object(broker,'verify_host') as host:
            with self.assertRaisesRegex(ValueError,'QA_HOST_CONFIG_PIN'): broker.private_frame('inspect','/public/package','a'*64,None,None,'t03-synthetic',3600)
            host.assert_not_called()

    def test_both_sanitizers_preserve_the_same_reviewed_tuple_and_reject_secret_extras(self):
        value={'ok':False,'phase':'function-contract','code':'QA_HOST_STAGE_FAILED','sqlstate':'42501'}
        self.assertEqual(broker.sanitize_child_failure({**value,'stderr':'SECRET','query':'postgresql://private:secret@host','rows':['PRIVATE']}),value)
        self.assertEqual(broker.sanitize_child_failure({'ok':False,'phase':'SECRET','code':'QA_PASSWORD_SECRET','sqlstate':'TOKEN'}),{'ok':False,'phase':'configuration','code':'QA_HOST_STAGE_FAILED'})
        self.assertEqual(broker.sanitize_child_failure({'ok':False,'phase':'catalog','code':'QA_API_POLICY_MISMATCH','publicPath':'node_modules/SECRET','rows':['PRIVATE']}),{'ok':False,'phase':'catalog','code':'QA_API_POLICY_MISMATCH'})
        code='const {publicFailure}=require("./scripts/qa/t03-session-consumer/host-entry.cjs");process.stdout.write(JSON.stringify(publicFailure(Object.assign(new Error("SECRET"),{code:"42501"}),"function-contract")));'
        result=broker.subprocess.run(['node','-e',code],capture_output=True,timeout=10,check=True)
        self.assertEqual(broker.sanitize_child_failure(__import__('json').loads(result.stdout)),value)

    def test_package_qualification_is_immutable_and_bound_to_the_full_package_pin(self):
        first=broker.package_qualification_path('a'*64)
        second=broker.package_qualification_path('a'*63+'b')
        self.assertNotEqual(first,second)
        self.assertTrue(first.endswith('package-qualified-'+'a'*64+'.json'))
        self.assertNotEqual(first,broker.CONTROL+'/private/package-qualified.json')
        with self.assertRaises(ValueError): broker.package_qualification_path('../escape')

    def test_qualification_write_and_read_use_same_full_pin_and_never_legacy_or_other_package(self):
        files={broker.CONTROL+'/private/package-qualified.json':b'PRESERVED_V2'}
        def write(path,payload):
            if path in files: raise FileExistsError(path)
            files[path]=payload
        with patch.object(broker,'exclusive_private',side_effect=write), patch.object(broker,'read_checked',side_effect=lambda path,*args:files[path]):
            broker.write_package_qualification('a'*64,'b'*64,'t03-first')
            broker.read_package_qualification('a'*64,'b'*64)
            with self.assertRaises(KeyError): broker.read_package_qualification('c'*64,'d'*64)
            broker.write_package_qualification('c'*64,'d'*64,'t03-second')
            broker.read_package_qualification('c'*64,'d'*64)
            with self.assertRaises(FileExistsError): broker.write_package_qualification('c'*64,'d'*64,'t03-second')
        self.assertEqual(files[broker.CONTROL+'/private/package-qualified.json'],b'PRESERVED_V2')

    def test_failure_receipt_contains_only_sanitized_fields_in_an_exclusive_owned_path(self):
        value={'ok':False,'phase':'catalog','code':'QA_HOST_STAGE_FAILED','sqlstate':'42501','stderr':'SECRET'}
        with patch.object(broker,'exclusive_private') as write:
            safe=broker.record_child_failure({'runId':'t03-inspect-synthetic'},value)
            self.assertEqual(safe,{'ok':False,'phase':'catalog','code':'QA_HOST_STAGE_FAILED','sqlstate':'42501'})
            self.assertEqual(write.call_args.args[0],broker.CONTROL+'/control/t03-inspect-synthetic/failure.json')
            self.assertNotIn(b'SECRET',write.call_args.args[1])

    def test_hardened_commands_keep_credentials_out_and_isolate_package_stage(self):
        command = broker.container_command('package-only', 'a'*64, 'b'*64, 't03-test', '/public/package')
        self.assertIn('none', command)
        self.assertEqual(command[command.index('--network')+1], 'none')
        self.assertEqual(command[command.index('--log-driver')+1], 'none')
        self.assertNotIn('-i', command)
        self.assertEqual(command[command.index('--entrypoint')+1],'/nodejs/bin/node')
        self.assertIn('--no-healthcheck',command)
        self.assertFalse(any('worker.env' in value or 'migration.env' in value or 'api.env' in value for value in command))
        session = broker.container_command('session', 'a'*64, 'b'*64, 't03-test', '/public/package')
        self.assertIn('-i', session)
        self.assertEqual(session[session.index('--network')+1], broker.NETWORK)
        self.assertEqual(session[session.index('--restart')+1], 'no')
        self.assertEqual(session[session.index('--log-driver')+1], 'none')
        self.assertIn('--read-only', session)

    def test_owned_identity_rejects_replacement_and_changed_hardening_before_stop(self):
        record = {'id':'a'*64, 'mode':'package-only', 'packagePin':'b'*64, 'archivePin':'c'*64, 'runId':'t03-test', 'packageRoot':'/public/package'}
        value = broker.expected_identity(record)
        value['Labels'][broker.OCI_LABEL]='synthetic-image-revision'
        broker.validate_owned(record, value)
        for key in ['Id','Image','User','LogDriver','ReadonlyRootfs','Labels','Mounts','Command','Network','Entrypoint','Healthcheck']:
            changed = dict(value)
            changed[key] = None
            with self.assertRaises(ValueError):
                broker.validate_owned(record, changed)
        informational=dict(value);informational['Labels']=dict(value['Labels']);informational['Labels'][broker.OCI_LABEL]='different-informational-value'
        broker.validate_owned(record,informational)
        for label in ('masarifi.t03.scope','masarifi.t03.package','masarifi.t03.archive','masarifi.t03.run'):
            changed=dict(value);changed['Labels']=dict(value['Labels']);changed['Labels'][label]='replacement'
            with self.assertRaises(ValueError): broker.validate_owned(record,changed)
        changed=dict(value);changed['Labels']={**value['Labels'],'unexpected':'extra'}
        with self.assertRaises(ValueError): broker.validate_owned(record,changed)

    def test_public_status_uses_only_verified_durable_phase_and_budget(self):
        manifest = {'sessionId':'t03-test','binding':{'initialVersion':1},'phases':broker.PHASES,'maxClaims':6}
        state = {'sessionId':'t03-test','phase':2,'claims':2,'version':3,'note':None,'status':'running'}
        self.assertEqual(broker.sanitized_status(manifest,state,True), {'phase':2,'claims':2,'status':'running','expectedNote':None,'version':3})
        for key,value in [('sessionId','replacement'),('claims',7),('version',8),('note','private account text')]:
            bad=dict(state);bad[key]=value
            with self.assertRaises(ValueError):
                broker.sanitized_status(manifest,bad,True)

    def test_partial_or_absent_commit_marker_never_yields_a_verified_phase(self):
        manifest = {'sessionId':'t03-test','binding':{'initialVersion':1},'phases':broker.PHASES,'maxClaims':6}
        raw=broker.encode({'sequence':0,'previous':None,'state':{'sessionId':'t03-test','phase':0,'claims':0,'version':1,'note':None,'status':'running'}})
        with patch.object(broker,'open_directory',return_value=9), patch.object(broker.os,'close'), patch.object(broker.os,'fstat',return_value=SimpleNamespace(st_uid=65532,st_mode=0o700)):
            with patch.object(broker.os,'listdir',return_value=['00000.json']):
                with self.assertRaisesRegex(ValueError,'QA_HOST_JOURNAL_NOT_READY'):
                    broker.journal_status(manifest,True)
            with patch.object(broker.os,'listdir',return_value=['00000.committed']), patch.object(broker,'read_checked',side_effect=[raw,b'partial']):
                with self.assertRaisesRegex(ValueError,'QA_HOST_JOURNAL_COMMIT'):
                    broker.journal_status(manifest,True)

    def test_private_output_binds_owner_mode_and_fsyncs_file_before_parent(self):
        events=[]
        identity=SimpleNamespace(st_mode=stat.S_IFREG|0o600,st_nlink=1,st_uid=1000,st_gid=1000)
        with patch.object(broker,'open_directory',return_value=99), patch.object(broker.os,'open',return_value=17) as opened, patch.object(broker.os,'close'), patch.object(broker.os,'O_NOFOLLOW',0x20000,create=True), patch.object(broker.os,'O_CLOEXEC',0x80000,create=True), patch.object(broker.os,'fstat',return_value=identity), patch.object(broker.os,'fchown',side_effect=lambda *a:events.append(('owner',a)),create=True), patch.object(broker.os,'fchmod',side_effect=lambda *a:events.append(('mode',a)),create=True), patch.object(broker.os,'write',side_effect=lambda fd,data:(events.append(('write',fd)) or len(data))), patch.object(broker.os,'fsync',side_effect=lambda fd:events.append(('sync',fd))):
            broker.exclusive_private('/run/masarifi-t03/private/session.json',b'SYNTHETIC_PRIVATE')
            self.assertTrue(opened.call_args.args[1]&broker.os.O_EXCL)
            self.assertTrue(opened.call_args.args[1]&broker.os.O_NOFOLLOW)
        self.assertEqual([item[0] for item in events],['owner','mode','write','sync','sync'])
        self.assertEqual(events[-2:],[('sync',17),('sync',99)])

    def test_stop_does_not_call_docker_for_a_replacement_identity(self):
        record={'id':'a'*64,'packagePin':'b'*64,'archivePin':'c'*64,'mode':'package-only','runId':'t03-test','packageRoot':'/public/package'}
        changed=broker.expected_identity(record);changed['Id']='d'*64
        with patch.object(broker,'inspect',return_value=changed), patch.object(broker,'command') as command:
            with self.assertRaisesRegex(ValueError,'QA_HOST_OWNED_IDENTITY_MISMATCH'):
                broker.stop_owned(record)
            command.assert_not_called()

    def test_private_attach_deadline_closes_pipes_and_stops_only_the_persisted_identity(self):
        class Stream:
            def __init__(self, number): self.number=number; self.closed=False
            def fileno(self): return self.number
            def close(self): self.closed=True
        child=SimpleNamespace(stdin=Stream(10),stdout=Stream(11),stderr=Stream(12),wait=Mock(return_value=0))
        selector=SimpleNamespace(register=Mock(),get_map=lambda:{1:1},close=Mock())
        record={'id':'a'*64,'mode':'session'}
        with patch.object(broker.subprocess,'Popen',return_value=child) as launched, patch.object(broker.selectors,'DefaultSelector',return_value=selector), patch.object(broker.os,'set_blocking',create=True), patch.object(broker,'stop_owned') as stop:
            with self.assertRaisesRegex(ValueError,'QA_HOST_STAGE_DEADLINE'):
                broker.bounded_attach(record,b'SYNTHETIC_SECRET_IN_PIPE_ONLY',0)
            stop.assert_called_once_with(record)
            self.assertNotIn('SYNTHETIC_SECRET',repr(launched.call_args))
            self.assertTrue(all(stream.closed for stream in (child.stdin,child.stdout,child.stderr)))

    def test_canonical_bridge_matches_js_utf16_keys_unicode_and_array_scalar_types(self):
        value={'\ue000':'BMP','\U00010000':'astral','nested':{'z':None,'a':[True,False,3,{'نص':'العربية 😀é'}]}}
        code='const fs=require("node:fs");const {canonical}=require("./scripts/qa/t03-exact-sync/manifest.cjs");const value=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(canonical(value));'
        result=broker.subprocess.run(['node','-e',code],input=broker.encode(value),capture_output=True,timeout=10,check=True)
        self.assertEqual(broker.canonical_json(value).encode('utf-8'),result.stdout)
        self.assertLess(broker.canonical_json(value).index('astral'),broker.canonical_json(value).index('BMP'))
        changed={'\ue000':'BMP','\U00010000':'astral','nested':{'z':None,'a':[False,True,3,{'نص':'العربية 😀é'}]}}
        self.assertNotEqual(broker.canonical_sha(value),broker.canonical_sha(changed))

    def test_approve_inspection_requires_both_independently_reviewed_pins(self):
        value={'enabled':False,'scope':{'relations':['public.synthetic'],'functions':['private.synthetic()']},'searchPath':'"$user", public','timeZone':'UTC','catalogSqlJsonSha256':'a'*64,'apiContainerId':'b'*64,'generalWorkerContainerId':'c'*64,'contracts':[],'indexes':[],'relations':[]}
        raw=broker.encode(value)
        self.assertEqual(broker.verify_inspection_pins(raw,broker.digest(raw),broker.canonical_sha(value)),value)
        for raw_pin,canonical_pin in [('0'*64,broker.canonical_sha(value)),(broker.digest(raw),'0'*64)]:
            with self.assertRaisesRegex(ValueError,'QA_HOST_REVIEWED_INSPECTION_REQUIRED'):
                broker.verify_inspection_pins(raw,raw_pin,canonical_pin)
        value['enabled']=True;raw=broker.encode(value)
        with self.assertRaisesRegex(ValueError,'QA_HOST_INSPECTION_STATE'):
            broker.verify_inspection_pins(raw,broker.digest(raw),broker.canonical_sha(value))


if __name__ == '__main__':
    unittest.main()
