"""Offline operating Host regressions. No Docker, DB, HTTP or financial traffic."""
import contextlib
import copy
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
import os
import threading
import time
import types
from unittest.mock import patch

PATH = pathlib.Path(__file__).with_name('promoted-operating.py')
def load():
    if not PATH.exists(): return None
    spec = importlib.util.spec_from_file_location('promoted_operating', PATH)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module
m = load()
NOW = 1791879000
GEN = '10000000-0000-4000-8000-000000000001'
EPOCH = '20000000-0000-4000-8000-000000000001'
SQL_MANIFEST_HASH = 'a1'*32
def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()

def api(identity, source, image, port, financial=False):
    return {'Id':identity, 'Name':'/masarifi-staging-api-'+str(port), 'Image':'sha256:'+image,
            'Config':{'Image':m.legacy.IMAGE_PREFIX+image,'Cmd':['dist/src/main.js'],
                      'Env':['SUPABASE_URL=https://qcffvfbpzvpwcwxwjyro.supabase.co',
                             'MASARIFI_RELEASE_VERSION='+source, 'MASARIFI_AI_PROVIDER_ENABLED=true',
                             'MASARIFI_VOICE_ANALYSIS_ONLY='+('false' if financial else 'true')]},
            'HostConfig':{'NetworkMode':'masarifi-staging_backend',
                          'PortBindings':{'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':str(port)}]}},
            'Mounts':[], 'State':{'Running':not financial, 'Health':{'Status':'healthy'}}}

def worker(identity, source, image, role, running=True):
    return {'Id':identity,'Name':'/masarifi-staging-'+role,'Image':'sha256:'+image,
            'Config':{'Image':m.legacy.IMAGE_PREFIX+image,'Cmd':['dist/src/staging-voice-worker.js'],
                      'Hostname':'', 'Labels':{},
                      'Env':['SUPABASE_URL=https://qcffvfbpzvpwcwxwjyro.supabase.co','MASARIFI_RELEASE_VERSION='+source]},
            'HostConfig':{'NetworkMode':'masarifi-staging_backend','ReadonlyRootfs':True,
                          'Privileged':False,'CapAdd':None,'CapDrop':['ALL'],'PortBindings':None,
                          'RestartPolicy':{'Name':'no','MaximumRetryCount':0}, 'OomKillDisable':None},
            'Mounts':[], 'State':{'Running':running,'Health':{'Status':'healthy'}}}

def fixture():
    containers={}
    apis={}
    for role, identity, source, image, port in [('originalAPI','1'*64,'a'*40,'a'*64,3000),
        ('publicAPI','2'*64,'b'*40,'b'*64,3001),('financialAPI','3'*64,'b'*40,'b'*64,3003)]:
        c=api(identity,source,image,port,role=='financialAPI');containers[identity]=c
        apis[role]={'id':identity,'name':c['Name'][1:],'sourceSha':source,'imageDigest':image,
                    'configurationHash':m.ingress.configuration_hash(c)}
    preserved={}
    for role,identity in [('analysis','4'*64),('assistant','5'*64)]:
        c=worker(identity,'a'*40,'a'*64,role);containers[identity]=c
        preserved[role]={'id':identity,'name':c['Name'][1:],'sourceSha':'a'*40,'imageDigest':'a'*64,
                         'configurationHash':m.ingress.configuration_hash(c)}
    template=worker('6'*64,'c'*40,'c'*64,'financial-template',False);containers[template['Id']]=template
    p={'kind':'promoted-staging-voice-operating','version':2,'mode':'operating','controlSourceSha':'d'*40,
       'project':'qcffvfbpzvpwcwxwjyro','host':'srv2006836','generation':GEN,
       'worker':{'templateID':'6'*64,'templateConfigurationHash':m.ingress.configuration_hash(template),
                 'sourceSha':'c'*40,'imageDigest':'c'*64},
       'apis':apis,'preservedWorkers':preserved,'otherContainers':[],
       'requiredMigrations':[str(20260000000000+x) for x in range(109)]+['20261013053237'],
       'apiContracts':copy.deepcopy(m.legacy.CONTRACTS),
       'baseline':{'posting':False,'activeEpochs':0,'analysisJobs':0,'migrations':[],
                   'fingerprints':{k:'7'*64 for k in ['accounts','transactions','postings','balances']},
                   'historical':{'voicePending':0,'assistantPending':0,'outboxUnpublished':0}},
       'artifacts':{name:'8'*64 for name in m.CONTROLLER_FILES},
       'proofs':{},'routes':{'beforeHash':hashlib.sha256(b'location /a {proxy_pass http://127.0.0.1:3001;}\nlocation /b {proxy_pass http://127.0.0.1:3001;}\nlocation /other {proxy_pass http://127.0.0.1:4000;}').hexdigest(),
                          'afterHash':'9'*64,'includes':[]},
       'database':{'migrationEnvHash':'d'*64,'databaseCAHash':'e'*64},
       'apk':{'sourceSha':'f'*40,'apkHash':'f'*64},
       'incident':{'restoreIngress':True,'stopOwnedHelpers':True},
       'recovery':{'automatic':False,'cooldownSeconds':60}}
    p['baseline']['migrations']=list(p['requiredMigrations'])
    p['proofs']={k:{'type':v,'path':'/proofs/'+k+'.json','sha256':'9'*64}
                 for k,v in m.PROOF_TYPES.items()}
    a={'kind':'direct-human-operating-approval','scopeHash':digest(p),'receivedAt':NOW-10,
       'activationExpiresAt':NOW+3500,'messageReference':'human-message-123',
       'verbatimMessage':'Approve this exact persistent operating scope and incident restoration.'}
    return p,a,containers

@unittest.skipIf(m is None,'implementation pending')
class HostTests(unittest.TestCase):
    def setUp(self):
        self.p,self.a,self.containers=fixture();self.tmp=tempfile.TemporaryDirectory()
        self.root=pathlib.Path(self.tmp.name)
        self.host=m.LocalHost(self.root,self.p,self.a)
        self.host.now=lambda:NOW
        self.host.target=lambda generation,incident=False:None
        self.host.inspect=lambda identity:copy.deepcopy(self.containers[identity])
        self.host.qualified=lambda:None
        self.host.route_guard=lambda:None
        self.host.check_proofs=lambda:None
        self.host.stop_helpers=lambda state:None
        self.calls=[];self.clock=NOW;self.epoch=None
        self.host.run=self.command
        self.host.now=lambda:self.clock
        self.host.database=self.database
        self.host._private=lambda path,directory=False:None
        self.host.save('packet.json',self.p);self.host.save('approval.json',self.a)
        self.host.claim()
    def tearDown(self):self.tmp.cleanup()
    def command(self,args,timeout=30,environment=None):
        self.calls.append(args)
        if args[:2]==['docker','start']:self.containers[args[2]]['State']['Running']=True
        if args[:2]==['docker','stop']:self.containers[args[-1]]['State']['Running']=False
        return ''
    def database(self,action,state=None):
        self.calls.append(action)
        if action=='prepare':
            self.epoch={'epochId':EPOCH,'manifestHash':SQL_MANIFEST_HASH,'state':'prepared','matches':True,
                        'mode':'operating','expiresAt':None,'heartbeatAt':self.clock}
            return {'epochId':EPOCH,'manifestHash':SQL_MANIFEST_HASH,'state':'prepared'}
        if action=='reconcile':return copy.deepcopy(self.epoch)
        if action=='activate':
            self.epoch['state']='active';return {'epochId':EPOCH,'startedAt':'2026-10-13T00:00:00Z','expiresAt':None}
        if action=='close':
            self.epoch['state']='closed';return {'state':'closed','posting':False,'currentEpochMatches':True}
        return {**copy.deepcopy(self.p['baseline']),'epoch':copy.deepcopy(self.epoch),
                'currentEpoch':self.epoch and self.epoch['epochId'],
                'posting':self.epoch is not None and self.epoch['state']=='active',
                'members':0,'committed':0,'rejected':0}
    def prepare(self):
        self.host.create_worker=lambda payload:'7'*64
        self.host.image_labels=lambda:{}
        state=self.host.prepare()
        payload=self.host.read_json('worker-payload.json')
        self.containers['7'*64]={'Id':'7'*64,'Name':'/'+m.worker_name(self.p),
            'Config':{k:copy.deepcopy(v) for k,v in payload.items() if k!='HostConfig'},
            'HostConfig':copy.deepcopy(payload['HostConfig']),'Image':'sha256:'+'c'*64,
            'Mounts':[], 'State':{'Running':False,'Health':{'Status':'healthy'}}}
        return state
    def test_mixed_release_approval_accepts_and_indefinite_manifest_is_operating(self):
        m.validate_packet(self.p,self.a,NOW)
        state=self.prepare()
        self.assertEqual(state['manifest']['version'],1)
        self.assertEqual(state['manifest']['mode'],'operating')
        self.assertTrue(state['manifest']['newCapturesOnly']);self.assertTrue(state['manifest']['normalEligibility'])
        self.assertNotIn('maxTransactions',state['manifest']);self.assertNotIn('deadline',state['manifest'])
    def test_wrong_api_port_fails_before_any_mutation(self):
        self.containers['2'*64]['HostConfig']['PortBindings']['3000/tcp'][0]['HostPort']='3000'
        with self.assertRaises(RuntimeError):self.host.preflight()
        self.assertFalse(any(isinstance(x,list) and x[:2] in [['docker','start'],['docker','stop']] for x in self.calls))
    def test_scope_expiry_and_foreign_approval_refused(self):
        for changed in [dict(self.a,scopeHash='1'*64),dict(self.a,activationExpiresAt=NOW),
                        dict(self.a,activationExpiresAt=NOW+3700),dict(self.a,receivedAt=NOW+1)]:
            with self.subTest(changed=changed),self.assertRaises(RuntimeError):m.validate_packet(self.p,changed,NOW)
    def test_prepare_intent_is_durable_before_database_call(self):
        original=self.database
        def db(action,state=None):
            if action=='prepare':
                disk=self.host.state();self.assertEqual(disk['manifest'],state['manifest'])
                self.assertEqual(disk['manifestIntentHash'],digest(state['manifest']))
                self.assertIsNone(disk['manifestHash']);self.assertIsNone(disk['epochId'])
            return original(action,state)
        self.host.database=db;self.prepare()
    def test_actual_sql_activation_receipt_without_state_requires_fresh_active_status(self):
        state=self.prepare();self.host.public_ready=lambda financial:None
        self.host.monitor_proof=lambda:None;self.host.cohort=lambda running=None:None
        self.host.activate(state)
        self.assertEqual(self.host.state()['phase'],'active')
        self.assertEqual(state['manifestHash'],SQL_MANIFEST_HASH)
    def test_activation_receipt_cannot_claim_active_without_current_owned_status(self):
        state=self.prepare();self.host.public_ready=lambda financial:None
        self.host.monitor_proof=lambda:None;self.host.cohort=lambda running=None:None
        original=self.database
        def db(action,state=None):
            if action=='activate':return {'epochId':EPOCH,'startedAt':'2026-10-13T00:00:00Z','expiresAt':None}
            return original(action,state)
        self.host.database=db
        with self.assertRaises(RuntimeError):self.host.activate(state)
        self.assertNotEqual(self.host.state()['phase'],'active')
    def test_lost_prepare_response_reconciles_zero_or_one_exact_epoch_without_repeat(self):
        for exists in [False,True]:
            with self.subTest(exists=exists):
                for name in ['runtime.json','incident.json','close-request.json','no-owned-epoch-reconcile.json']:
                    if (self.root/name).exists():(self.root/name).unlink()
                self.epoch=None;self.calls=[]
                original=self.database
                def db(action,state=None):
                    if action=='prepare':
                        if exists:original(action,state)
                        else:self.calls.append(action)
                        raise RuntimeError('LOST_RESPONSE')
                    return original(action,state)
                self.host.database=db
                with self.assertRaisesRegex(RuntimeError,'LOST_RESPONSE'):self.host.prepare()
                result=self.host.reconcile()
                self.assertEqual(self.calls.count('prepare'),1);self.assertEqual(self.calls.count('reconcile'),1)
                self.assertEqual(result is not None,exists)
                if exists:self.assertEqual(result['epochId'],EPOCH)
    def test_foreign_reconcile_epoch_is_not_adopted(self):
        state=self.prepare();state['epochId']=None
        # Reconciliation may fill a missing ID but must bind the exact stored manifest.
        self.host.database=lambda action,state=None:{'epochId':EPOCH,'manifestHash':'0'*64,'state':'prepared','matches':True}
        with self.assertRaises(RuntimeError):self.host.reconcile()
    def test_sql_blocking_past_approval_expiry_prevents_forward_mutation(self):
        state=self.prepare();original=self.database
        def db(action,state=None):
            result=original(action,state);self.clock=self.a['activationExpiresAt'];return result
        self.host.database=db
        with self.assertRaisesRegex(RuntimeError,'ACTIVATION_WINDOW_EXPIRED'):self.host.start_worker_off(state)
        self.assertFalse(self.containers['7'*64]['State']['Running'])
    def test_cancellation_during_blocking_pin_check_prevents_start(self):
        state=self.prepare()
        self.host.qualified=lambda:self.host.request_close('scope_failure')
        with self.assertRaisesRegex(RuntimeError,'CLOSURE_REQUESTED'):self.host.start_worker_off(state)
        self.assertFalse(self.containers['7'*64]['State']['Running'])
    def test_stale_state_cannot_overwrite_closed_or_new_identity(self):
        state=self.prepare();closed=copy.deepcopy(state);closed['phase']='closed';self.host.persist(closed)
        with self.assertRaises(RuntimeError):self.host.persist(state)
        changed=copy.deepcopy(closed);changed['epochId']='30000000-0000-4000-8000-000000000001'
        with self.assertRaises(RuntimeError):self.host.persist(changed)
        changed=copy.deepcopy(closed);changed['manifestHash']='0'*64
        with self.assertRaises(RuntimeError):self.host.persist(changed)
    def test_incident_writer_stop_ignores_health_packet_and_evidence_loss(self):
        state=self.prepare();self.containers['7'*64]['State']['Running']=True
        self.containers['7'*64]['State']['Health']['Status']='unhealthy'
        self.host.packet['worker']['imageDigest']='0'*64
        self.host.qualified=lambda:(_ for _ in ()).throw(RuntimeError('PIN_LOSS'))
        self.host.stop_worker(state)
        self.assertFalse(self.containers['7'*64]['State']['Running'])
    def test_recovery_refused_when_closed_cancelled_or_not_explicitly_allowed(self):
        state=self.prepare();self.epoch['state']='active';state['phase']='active';self.host.persist(state)
        with self.assertRaisesRegex(RuntimeError,'RECOVERY_NOT_AUTHORIZED'):self.host.recovery_fence(state)
        self.host.packet['recovery']['automatic']=True
        self.host.request_close('closure_requested')
        with self.assertRaises(RuntimeError):self.host.start_worker(state)
        self.assertFalse(self.containers['7'*64]['State']['Running'])
    def test_successful_recovery_persists_cooldown_against_immediate_repeat(self):
        self.host.packet['recovery']['automatic']=True
        with self.chain():
            state=m.lifecycle.begin(self.host);self.clock+=60
            self.containers['7'*64]['State']['Running']=False
            m.lifecycle.recover(state,self.host)
            recovered=self.host.state();self.assertEqual(recovered['lastRecoveryAt'],self.clock)
            self.containers['7'*64]['State']['Running']=False
            with self.assertRaisesRegex(RuntimeError,'RECOVERY_COOLDOWN_REQUIRED'):self.host.recovery_fence(recovered)
    def test_worker_payload_has_unique_env_and_normalizes_docker_null_false(self):
        state=self.prepare();payload=self.host.read_json('worker-payload.json')
        entries=payload['Env'];self.assertEqual(len(entries),len({x.split('=',1)[0] for x in entries}))
        self.assertIn('MASARIFI_RELEASE_VERSION='+'c'*40,entries)
        self.assertIn('MASARIFI_STAGING_VOICE_EPOCH_ID='+EPOCH,entries)
        self.assertEqual(payload['HostConfig']['RestartPolicy']['Name'],'no')
        self.containers['7'*64]['HostConfig']['OomKillDisable']=None
        self.host.worker(state)
        self.containers['7'*64]['Config']['Env'].append(entries[0])
        with self.assertRaises(RuntimeError):self.host.worker(state)
    def test_ambiguous_worker_create_reconciles_for_stop_only(self):
        self.host.image_labels=lambda:{}
        def ambiguous(payload):
            self.containers['7'*64]={'Id':'7'*64,'Name':'/'+m.worker_name(self.p),
                'Config':{k:copy.deepcopy(v) for k,v in payload.items() if k!='HostConfig'},
                'HostConfig':copy.deepcopy(payload['HostConfig']),'State':{'Running':False}}
            raise RuntimeError('LOST_CREATE_RESPONSE')
        self.host.create_worker=ambiguous
        with self.assertRaisesRegex(RuntimeError,'LOST_CREATE_RESPONSE'):self.host.prepare()
        self.host.lookup_worker=lambda:'7'*64
        state=self.host.reconcile();self.assertEqual(state['workerID'],'7'*64)
        with self.assertRaisesRegex(RuntimeError,'WRITER_CREATION_UNCERTAIN'):self.host.start_worker_off(state)
        self.host.stop_worker(state)
    def test_exact_two_route_diff_preserves_foreign_route(self):
        before=b'/a proxy_pass http://127.0.0.1:3001; /b proxy_pass http://127.0.0.1:3001; /x proxy_pass http://127.0.0.1:4000;'
        after=m.ingress.financial_route(before)
        self.assertEqual(after,b'/a proxy_pass http://127.0.0.1:3003; /b proxy_pass http://127.0.0.1:3003; /x proxy_pass http://127.0.0.1:4000;')
        self.assertEqual(m.ingress.restore_route(after),before)
    def test_helper_proof_cannot_be_relabelled_financial_closure(self):
        proof={'status':'PASS','postingOff':True,'helpersStopped':True,'runtimeClosed':True,
               'realFinancialTransactionCreated':False,'onlyNewContainers':['a'*64,'b'*64]}
        with self.assertRaises(RuntimeError):m.check_financial_proof(proof,{},self.p)
    def test_helper_raw_packet_binds_qualified_source_and_current_baseline(self):
        result={'evidenceHashes':{'approved-packet.json':'b1'*32}}
        approved={'kind':'posting-off-helper-rehearsal','project':self.p['project'],'host':self.p['host'],
            'sourceSha':'c'*40,'imageDigest':'c'*64,'financialEpochAuthority':None,
            'files':{'customer-operating-cohort.py':'8'*64},'baseline':copy.deepcopy(self.p['baseline']),
            'readOnlyIngress':copy.deepcopy(self.p['apis']['publicAPI']),
            'cohort':{'envHashes':{'migration.env':'d'*64},'databaseCAHash':'e'*64}}
        m.check_helper_packet(result,approved,'b1'*32,self.p)
        for changed in [dict(approved,imageDigest='0'*64),dict(approved,sourceSha='a'*40),
                        dict(approved,financialEpochAuthority='operating')]:
            with self.subTest(changed=changed),self.assertRaises(RuntimeError):m.check_helper_packet(result,changed,'b1'*32,self.p)
        with self.assertRaises(RuntimeError):m.check_helper_packet(result,approved,'e1'*32,self.p)
    def test_actual_apk_delivery_and_native_reuse_shapes_preserve_source_split(self):
        delivery={'sourceCommit':'f'*40,'apkSha256':'f'*64,'sourceInputsStillMatch':True,
                  'mobileFocusedTestsPassed':162,'mobileTypecheck':'PASS','mobileLintErrors':0,
                  'independentReview':'PASS_NO_BLOCKING_FINDINGS',
                  'physicalUIAcceptance':'PENDING_APPROVAL_AND_MANUAL_TESTING'}
        reuse={'status':'PASS_LOCAL_BUNDLE_WITH_QUALIFIED_NATIVE_REUSE','sha256':'f'*64,
               'certificateSha256':'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c',
               'nativeBaseSource':'e'*40,'nativeLibrariesUnchanged':92,'dexFilesUnchanged':6,
               'manifestAndResourcesUnchanged':True,'changedPackagedPayloads':['assets/index.android.bundle']}
        m.check_apk_proofs(delivery,reuse,self.p)
        self.assertNotEqual(delivery['sourceCommit'],self.p['worker']['sourceSha'])
        with self.assertRaises(RuntimeError):m.check_apk_proofs(dict(delivery,sourceCommit='c'*40),reuse,self.p)
        with self.assertRaises(RuntimeError):m.check_apk_proofs(delivery,dict(reuse,sha256='0'*64),self.p)
        with self.assertRaises(RuntimeError):m.check_apk_proofs(delivery,dict(reuse,dexFilesUnchanged=0),self.p)
    def test_controller_ci_binds_workflow_source_and_actual_sql_artifact(self):
        run={'id':1234,'name':'Promoted Voice Operating Qualification','status':'completed',
             'conclusion':'success','headSha':'d'*40}
        paths={'promoted-operating.py':'scripts/staging-voice/promoted-operating.py',
            'operating-ingress.py':'scripts/staging-voice/operating-ingress.py',
            'operating-lifecycle.py':'scripts/staging-voice/operating-lifecycle.py',
            'operating-db.cjs':'scripts/staging-voice/operating-db.cjs',
            'customer-operating-cohort.py':'scripts/staging-voice/customer-operating-cohort.py',
            'canary-host.py':'scripts/staging-voice/diagnostic-canary/canary-host.py',
            'canary-control.py':'scripts/staging-voice/diagnostic-canary/canary-control.py'}
        artifact={'sourceSha':'d'*40,'runId':1234,'workflowName':'Promoted Voice Operating Qualification',
                  'disposableOnly':True,'stagingDeployment':False,'physicalDeviceOperations':False,'missingFiles':[],
                  'files':{path:'8'*64 for path in paths.values()},
                  'evidenceFiles':{'promoted-operating-database.json':'b1'*32,'promoted-operating-python.log':'c1'*32}}
        sql={'status':'PASS','actualProductionHelperSQL':True,'productionOrStagingAccess':False,
             'behavioralCases':3,'cases':['stale legacy capture cannot join the fresh operating epoch',
                'duplicate execute creates exactly one transaction/posting/balance effect',
                'persistent operating mode survives two commits with exact balance']}
        m.check_controller_proof(run,artifact,sql,'b1'*32,self.p)
        for changed in [dict(run,name='Unrelated successful workflow'),dict(run,id=999),dict(run,headSha='a'*40)]:
            with self.subTest(changed=changed),self.assertRaises(RuntimeError):m.check_controller_proof(changed,artifact,sql,'b1'*32,self.p)
        missing=copy.deepcopy(artifact);missing['files'].pop(paths['operating-db.cjs'])
        with self.assertRaises(RuntimeError):m.check_controller_proof(run,missing,sql,'b1'*32,self.p)
        with self.assertRaises(RuntimeError):m.check_controller_proof(run,artifact,dict(sql,status='FAIL'),'b1'*32,self.p)
        with self.assertRaises(RuntimeError):m.check_controller_proof(run,artifact,sql,'e1'*32,self.p)
    def test_normal_off_restoration_never_targets_original_public_api(self):
        state=self.prepare();self.epoch['state']='active';self.containers['3'*64]['State']['Running']=True
        self.containers['4'*64]['State']['Running']=False
        self.host.route_restore_checks=lambda state:None
        self.host.stop_api(state);self.host.restore_analysis(state)
        mutations=[x[-1] for x in self.calls if isinstance(x,list) and x[:2] in [['docker','start'],['docker','stop']]]
        self.assertEqual(mutations,['3'*64,'4'*64])
        self.assertTrue(self.containers['1'*64]['State']['Running']);self.assertTrue(self.containers['2'*64]['State']['Running'])
    def chain(self):
        before=b'location /a {proxy_pass http://127.0.0.1:3001;}\nlocation /b {proxy_pass http://127.0.0.1:3001;}\nlocation /other {proxy_pass http://127.0.0.1:4000;}'
        site=self.root/'nginx-fixture.conf';site.write_bytes(before)
        self.host.packet['routes']['beforeHash']=hashlib.sha256(before).hexdigest()
        self.host.packet['routes']['afterHash']=hashlib.sha256(before.replace(b':3001;',b':3003;')).hexdigest()
        self.host.approval['scopeHash']=digest(self.host.packet)
        for name in ['packet.json','approval.json','claim.json']:(self.root/name).unlink()
        self.host.save('packet.json',self.host.packet);self.host.save('approval.json',self.host.approval)
        self.host.sequence=contextlib.nullcontext
        self.host.image_labels=lambda:{}
        self.host.monitor_proof=lambda:None
        def create(payload):
            self.containers['7'*64]={'Id':'7'*64,'Name':'/'+m.worker_name(self.host.packet),
                'Config':{k:copy.deepcopy(v) for k,v in payload.items() if k!='HostConfig'},
                'HostConfig':copy.deepcopy(payload['HostConfig']),'Image':'sha256:'+'c'*64,
                'Mounts':[], 'State':{'Running':False,'Health':{'Status':'healthy'}}}
            return '7'*64
        self.host.create_worker=create
        def arm(state):self.host.save('unit-fixture.json',{'text':self.host.unit_content()})
        self.host.arm=arm
        def http(url):
            port=url.split('/')[2].split(':')[-1]
            source='a'*40 if port=='3000' else 'b'*40
            return {'version':source,'status':'ready','schemaVersion':1,'contracts':m.legacy.CONTRACTS}
        self.host.http=http
        command=self.command
        def run(args,timeout=30,environment=None):
            if args[:2]==['docker','exec']:
                state=self.host.state()
                return json.dumps({'sourceSha':state['sourceSha'],'epochId':state['epochId'],
                    'observedAt':self.clock*1000,'enabled':self.epoch['state']=='active'})
            return command(args,timeout,environment)
        self.host.run=run
        self.host.pause=lambda seconds:setattr(self,'clock',self.clock+seconds)
        @contextlib.contextmanager
        def boundaries():
            with patch.object(m,'SITE',site),patch.object(m.os,'O_NOFOLLOW',getattr(os,'O_NOFOLLOW',0),create=True):yield
        return boundaries()
    def test_real_host_lifecycle_keeps_two_commits_then_restores_normal_off(self):
        with self.chain():
            state=m.lifecycle.begin(self.host)
            self.assertEqual(state['phase'],'active')
            self.assertTrue(self.containers['7'*64]['State']['Running'])
            database=self.host.database;committed=0
            def db(action,state=None):
                nonlocal committed
                result=database(action,state)
                if action=='status':committed+=1;result['committed']=committed;result['executionFailed']=0
                return result
            self.host.database=db
            original_pause=self.host.pause
            def pause(seconds):
                original_pause(seconds)
                if committed>=2:self.containers['7'*64]['State']['Health']['Status']='unhealthy'
            self.host.pause=pause
            runtime=self.host.runtime
            def health(state):
                if self.containers['7'*64]['State']['Health']['Status']=='unhealthy':raise RuntimeError('WORKER_UNHEALTHY')
                return runtime(state)
            self.host.runtime=health
            self.assertEqual(m.lifecycle.monitor(state,self.host),'runtime_unhealthy')
            self.assertGreaterEqual(committed,2)
            self.assertEqual(self.host.state()['phase'],'closed');self.assertEqual(self.epoch['state'],'closed')
            self.assertFalse(self.containers['7'*64]['State']['Running']);self.assertFalse(self.containers['3'*64]['State']['Running'])
            self.assertTrue(self.containers['4'*64]['State']['Running'])
            self.assertEqual(m.SITE.read_bytes().count(b':3001;'),2)
            self.assertIn(b':4000;',m.SITE.read_bytes())
            mutations=[x[-1] for x in self.calls if isinstance(x,list) and x[:2] in [['docker','start'],['docker','stop']]]
            self.assertNotIn('1'*64,mutations);self.assertNotIn('2'*64,mutations);self.assertNotIn('5'*64,mutations)
    def test_preflight_partial_helper_start_stopped_before_claim_failure(self):
        with self.chain():
            helpers={'running':False};original=self.host.database
            def db(action,state=None):
                helpers['running']=True
                self.assertIsNotNone(self.host.read_json('helper-scope.json'))
                raise RuntimeError('STATUS_RESPONSE_LOST')
            self.host.database=db
            self.host.stop_helpers=lambda state:helpers.update(running=False)
            with self.assertRaisesRegex(RuntimeError,'STATUS_RESPONSE_LOST'):m.lifecycle.begin(self.host)
            self.assertFalse(helpers['running']);self.assertIsNone(self.host.read_json('runtime.json'))
            self.assertIsNone(self.host.read_json('claim.json'))
    def test_close_survives_mutated_packet_and_qualification_loss(self):
        with self.chain():
            state=m.lifecycle.begin(self.host)
            self.host.packet['worker']['imageDigest']='0'*64
            self.host.qualified=lambda:(_ for _ in ()).throw(RuntimeError('QUALIFICATION_LOST'))
            result=m.lifecycle.close(state,self.host,'scope_failure')
            self.assertTrue(result['workerStopped']);self.assertTrue(result['postingOff'])
            self.assertTrue(result['restored']);self.assertTrue(result['helpersStopped']);self.assertEqual(result['blockers'],[])
    def test_foreign_route_blocks_restoration_after_off_and_writer_stop(self):
        with self.chain():
            state=m.lifecycle.begin(self.host)
            m.SITE.write_bytes(m.SITE.read_bytes()+b' # foreign mutation')
            result=m.lifecycle.close(state,self.host)
            self.assertTrue(result['workerStopped']);self.assertTrue(result['postingOff'])
            self.assertFalse(result['restored']);self.assertEqual(result['blockers'],['RESTORATION_UNCONFIRMED'])
            self.assertIn(b'foreign mutation',m.SITE.read_bytes())
            self.assertTrue(self.containers['3'*64]['State']['Running']);self.assertFalse(self.containers['4'*64]['State']['Running'])
    def test_cancellation_after_each_blocking_forward_host_operation_closes_without_next_start(self):
        for step in ['start_api','start_worker_off','verify_worker_off','stop_analysis','promote','activate','ready']:
            with self.subTest(step=step):
                # Each case needs a fresh private generation; all writes remain in TempDirectory.
                if step!='start_api':self.tearDown();self.setUp()
                with self.chain():
                    operation=getattr(self.host,step)
                    def cancelled(state,operation=operation):
                        operation(state);self.host.request_close('closure_requested')
                    setattr(self.host,step,cancelled)
                    with self.assertRaisesRegex(RuntimeError,'CLOSURE_REQUESTED'):m.lifecycle.begin(self.host)
                    self.assertEqual(self.epoch['state'],'closed');self.assertFalse(self.containers['7'*64]['State']['Running'])
                    self.assertEqual(self.host.state()['phase'],'closed')
    def test_fixed_http_url_rejects_public_private_ready_and_arbitrary_targets(self):
        for url in ['https://api.staging.masarifiratibi.com/health/ready',
                    'http://127.0.0.1:3003/health/ready?x=1','http://example.com/health/live']:
            with self.subTest(url=url),self.assertRaisesRegex(RuntimeError,'FIXED_HEALTH_URL_REQUIRED'):m.LocalHost.http(self.host,url)
    def test_snapshot_execution_failure_closes_but_user_rejection_is_diagnostic(self):
        with self.chain():
            state=m.lifecycle.begin(self.host);original=self.host.database
            def rejected(action,state=None):return {**original(action,state),'executionFailed':0,'rejected':4}
            self.host.database=rejected;self.assertTrue(self.host.snapshot(state)['scopeValid'])
            def failed(action,state=None):return {**original(action,state),'executionFailed':1,'rejected':0}
            self.host.database=failed;self.assertFalse(self.host.snapshot(state)['scopeValid'])

@unittest.skipUnless(m is not None and os.name=='posix','requires actual Linux private file/locking primitives')
class PrivateLinuxTests(unittest.TestCase):
    def test_kernel_lock_is_reentrant_and_cancellation_durable_before_wait(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);p,a,_=fixture();h=m.LocalHost(root,p,a);h.target=lambda *args,**kwargs:None
            global_lock=root/'private-global.lock';actual_open=os.open;actual_fstat=os.fstat
            def opened(path,*args,**kwargs):
                return actual_open(global_lock if str(path)=='/run/lock/masarifi-staging-deployment.lock' else path,*args,**kwargs)
            def metadata(fd):
                observed=actual_fstat(fd)
                return types.SimpleNamespace(st_mode=observed.st_mode,st_uid=0,st_nlink=observed.st_nlink)
            # Only the Staging root ownership metadata is modeled. flock, fsync,
            # O_NOFOLLOW and all files operate on the disposable private root.
            with patch.object(m.os,'open',opened),patch.object(m.os,'fstat',metadata):
                import fcntl
                blocked=[]
                with h.sequence():
                    with h.sequence():
                        with global_lock.open('r') as competing:
                            with self.assertRaises(BlockingIOError):fcntl.flock(competing,fcntl.LOCK_EX|fcntl.LOCK_NB)
                with global_lock.open('r') as competing:fcntl.flock(competing,fcntl.LOCK_EX|fcntl.LOCK_NB)
    def test_close_request_fsynced_while_real_global_lock_blocks_cleanup(self):
        fixture_case=HostTests('test_mixed_release_approval_accepts_and_indefinite_manifest_is_operating')
        fixture_case.setUp()
        try:
            h=fixture_case.host;state=fixture_case.prepare();root=fixture_case.root
            h.restore_route=lambda state:None;h.route_restore_checks=lambda state:None;h.verify_restored=lambda state:None
            actual_open=os.open;actual_fstat=os.fstat;global_lock=root/'private-global.lock'
            def opened(path,*args,**kwargs):
                return actual_open(global_lock if str(path)=='/run/lock/masarifi-staging-deployment.lock' else path,*args,**kwargs)
            def metadata(fd):
                observed=actual_fstat(fd)
                return types.SimpleNamespace(st_mode=observed.st_mode,st_uid=0,st_nlink=observed.st_nlink)
            errors=[];receipts=[]
            def close():
                try:receipts.append(m.lifecycle.close(state,h))
                except BaseException as error:errors.append(error)
            with patch.object(m.os,'open',opened),patch.object(m.os,'fstat',metadata):
                import fcntl
                descriptor=actual_open(global_lock,os.O_RDWR|os.O_CREAT,0o600)
                fcntl.flock(descriptor,fcntl.LOCK_EX)
                thread=threading.Thread(target=close);thread.start()
                deadline=time.monotonic()+3
                while not (root/'close-request.json').exists() and time.monotonic()<deadline:time.sleep(.01)
                self.assertTrue((root/'close-request.json').exists())
                self.assertTrue(thread.is_alive());self.assertNotIn('close',fixture_case.calls)
                fcntl.flock(descriptor,fcntl.LOCK_UN);os.close(descriptor)
                thread.join(timeout=3)
                self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
                self.assertTrue(receipts[0]['postingOff']);self.assertTrue(receipts[0]['workerStopped'])
        finally:fixture_case.tearDown()
    def test_symlink_and_nonprivate_control_refused_without_changing_target(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);p,a,_=fixture();h=m.LocalHost(root,p,a)
            target=root/'target.json';target.write_text('{"sentinel":true}');target.chmod(0o600)
            link=root/'runtime.json';link.symlink_to(target)
            with self.assertRaises(RuntimeError):h.read_json('runtime.json')
            self.assertEqual(target.read_text(),'{"sentinel":true}')
            with self.assertRaises(FileExistsError):h.save('runtime.json',{'overwrite':True})
            self.assertEqual(target.read_text(),'{"sentinel":true}')
            target.chmod(0o644)
            with self.assertRaises(RuntimeError):h.read_json('target.json')

class ImplementationTests(unittest.TestCase):
    def test_operating_controller_is_present(self):self.assertTrue(PATH.exists(),'persistent current-topology Host is missing')

if __name__=='__main__':unittest.main()
