"""Persistent, exact-ID operating adapter for independently promoted Staging.

This source supplies no approval or executable packet. Check, begin, monitor,
close and recover accept only a protected exact scope plus separate human
approval. Incident closure consumes its durable private journal, independently
of mutable packet files, service health and external qualification evidence.
"""
import contextlib
import copy
import hashlib
import http.client
import importlib.util
import json
import os
import pathlib
import re
import socket
import stat
import sys
import tempfile
import time
import urllib.error
import urllib.request

# Direct script execution must not create unpinned imported bytecode inside the
# protected controller root. systemd also supplies -B for the entry point.
sys.dont_write_bytecode = True
HERE = pathlib.Path(__file__).resolve().parent
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result
legacy = module('promoted_legacy_operating', HERE / 'customer-operating-cohort.py')
ingress = module('promoted_operating_ingress', HERE / 'operating-ingress.py')
lifecycle = module('promoted_operating_lifecycle', HERE / 'operating-lifecycle.py')
canary = module('qualified_canary_host', (HERE / 'canary-host.py') if (HERE / 'canary-host.py').exists()
                else HERE / 'diagnostic-canary' / 'canary-host.py')
require = legacy.require
CONTROLLER_FILES = {'promoted-operating.py', 'operating-ingress.py', 'operating-lifecycle.py',
                    'operating-db.cjs', 'customer-operating-cohort.py', 'canary-host.py', 'canary-control.py'}
PROOF_TYPES = {'helperOff':'posting-off-helper-rehearsal',
               'financialClosure':'owned-canary-financial-closure',
               'backupRestore':'selected-financial-backup-restore',
               'backendCI':'backend-source-ci', 'controllerCI':'operating-controller-source-ci',
               'apkRuntime':'retained-apk-delivery-and-native-reuse'}
# Only the independently qualified507f→29c4 display delta may reuse its canary.
UI_APK_COMPATIBILITY_DIGEST = '730af0becc9e1f3f2e6a98e7a6935566a5254bbf4e88243082d37b1708d1af9e'
APK_COMPATIBILITY_PROOF_TYPE = 'exact-ui-only-canary-apk-compatibility'
CONTROLLER_SOURCE_PATHS={name:'scripts/staging-voice/'+
                         ('diagnostic-canary/' if name in ['canary-host.py','canary-control.py'] else '')+name
                         for name in CONTROLLER_FILES}
SITE = canary.SITE
PUBLIC = canary.PUBLIC

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                    ensure_ascii=False, allow_nan=False).encode()).hexdigest()
def sha(value): return hashlib.sha256(value).hexdigest()
def valid_hash(value): return legacy.valid_hash(value)
def worker_name(packet): return 'masarifi-staging-voice-operating-' + packet['generation']
def scope_name(packet): return legacy.scope_name(packet)
def manifest(packet):
    return {'version':1, 'mode':'operating', 'sourceSha':packet['worker']['sourceSha'],
            'imageDigest':packet['worker']['imageDigest'], 'apkHash':packet['apk']['apkHash'],
            'controlHash':digest(packet), 'newCapturesOnly':True,
            'normalEligibility':True, 'retentionPolicy':'existing-operating'}

def validate_packet(packet, approval, now, activation=True):
    fields = {'kind','version','mode','project','host','generation','controlSourceSha','worker','apis',
              'preservedWorkers','otherContainers','requiredMigrations','apiContracts','baseline',
              'artifacts','proofs','routes','database','apk','incident','recovery'}
    require(isinstance(packet,dict) and set(packet)==fields, 'OPERATING_PACKET_FIELDS_INVALID')
    require(packet['kind']=='promoted-staging-voice-operating' and packet['version'] in (2,3) and
            type(packet['version']) is int and packet['mode']=='operating','OPERATING_PACKET_REQUIRED')
    require(packet['project']==legacy.PROJECT and packet['host']=='srv2006836' and
            legacy.UUID.fullmatch(packet['generation']) and legacy.SHA.fullmatch(packet['controlSourceSha']),
            'STAGING_IDENTITY_REQUIRED')
    require(set(approval)=={'kind','scopeHash','receivedAt','activationExpiresAt','messageReference','verbatimMessage'}
            and approval['kind']=='direct-human-operating-approval' and approval['scopeHash']==digest(packet),
            'DIRECT_EXACT_OPERATING_APPROVAL_REQUIRED')
    received,expires=approval['receivedAt'],approval['activationExpiresAt']
    require(type(received) is int and type(expires) is int and received<=now and
            0<expires-received<=3600,'ONE_HOUR_UTC_SECONDS_APPROVAL_REQUIRED')
    require(isinstance(approval['messageReference'],str) and 8<=len(approval['messageReference'].strip())<=256 and
            isinstance(approval['verbatimMessage'],str) and 8<=len(approval['verbatimMessage'].strip())<=4096,
            'DIRECT_HUMAN_EVIDENCE_REQUIRED')
    if activation:require(now<expires,'ACTIVATION_WINDOW_EXPIRED')
    w=packet['worker']
    require(set(w)=={'templateID','templateConfigurationHash','sourceSha','imageDigest'} and
            all(valid_hash(w[k]) for k in ['templateID','templateConfigurationHash','imageDigest']) and
            legacy.SHA.fullmatch(w['sourceSha']),'WORKER_PINS_REQUIRED')
    require(set(packet['apis'])==set(ingress.PORTS),'EXACT_THREE_API_PINS_REQUIRED')
    identities=[]
    for pin in [*packet['apis'].values(),*packet['preservedWorkers'].values()]:
        require(isinstance(pin,dict) and set(pin)=={'id','name','sourceSha','imageDigest','configurationHash'} and
                all(valid_hash(pin[k]) for k in ['id','imageDigest','configurationHash']) and
                legacy.SHA.fullmatch(pin['sourceSha']) and re.fullmatch(r'masarifi-staging-[a-z0-9-]+',pin['name']),
                'EXACT_CONTAINER_PINS_REQUIRED')
        identities.append(pin['id'])
    require(set(packet['preservedWorkers'])=={'analysis','assistant'} and
            len(set(identities+[w['templateID']]))==6,'DISTINCT_CONTAINER_IDENTITIES_REQUIRED')
    require(packet['apis']['publicAPI']['sourceSha']==packet['apis']['financialAPI']['sourceSha'] and
            packet['apis']['publicAPI']['imageDigest']==packet['apis']['financialAPI']['imageDigest'],
            'COMPATIBLE_PROMOTED_API_REQUIRED')
    require(isinstance(packet['otherContainers'],list),'PRESERVED_INVENTORY_REQUIRED')
    for pin in packet['otherContainers']:
        require(set(pin)=={'id','configurationHash','running'} and valid_hash(pin['id']) and
                valid_hash(pin['configurationHash']) and type(pin['running']) is bool and pin['id'] not in identities,
                'PRESERVED_INVENTORY_REQUIRED')
        identities.append(pin['id'])
    versions=packet['requiredMigrations']
    nominal='20261013235719'
    require(isinstance(versions,list) and
            ((len(versions)==110 and nominal not in versions) or
             (len(versions)==111 and versions[-1]==nominal)) and len(set(versions))==len(versions) and
            all(isinstance(v,str) and re.fullmatch(r'[0-9]{14}',v) for v in versions) and
            versions==sorted(versions) and '20261013053237' in versions,'FULL_QUALIFIED_SCHEMA_REQUIRED')
    require(packet['apiContracts']==legacy.CONTRACTS,'COMPATIBILITY_CONTRACTS_REQUIRED')
    baseline=packet['baseline']
    require(set(baseline)=={'posting','activeEpochs','analysisJobs','migrations','fingerprints','historical'} and
            baseline['posting'] is False and baseline['activeEpochs']==0 and baseline['analysisJobs']==0 and
            baseline['migrations']==versions and isinstance(baseline['historical'],dict) and
            isinstance(baseline['fingerprints'],dict) and bool(baseline['fingerprints']), 'CURRENT_OFF_BASELINE_REQUIRED')
    require(set(packet['artifacts'])==CONTROLLER_FILES and all(valid_hash(x) for x in packet['artifacts'].values()),
            'ALL_CONTROLLER_ARTIFACT_PINS_REQUIRED')
    require(set(packet['database'])=={'migrationEnvHash','databaseCAHash'} and
            all(valid_hash(v) for v in packet['database'].values()), 'DATABASE_ENV_CA_PINS_REQUIRED')
    require(set(packet['apk'])=={'sourceSha','apkHash'} and legacy.SHA.fullmatch(packet['apk']['sourceSha']) and
            valid_hash(packet['apk']['apkHash']), 'SEPARATE_APK_SOURCE_REQUIRED')
    require(packet['incident']=={'restoreIngress':True,'stopOwnedHelpers':True}, 'EXACT_INCIDENT_AUTHORITY_REQUIRED')
    recovery=packet['recovery']
    require(set(recovery)=={'automatic','cooldownSeconds'} and type(recovery['automatic']) is bool and
            type(recovery['cooldownSeconds']) is int and 60<=recovery['cooldownSeconds']<=3600,
            'EXPLICIT_RECOVERY_AUTHORITY_REQUIRED')
    routes=packet['routes']
    require(set(routes)=={'beforeHash','afterHash','includes'} and valid_hash(routes['beforeHash']) and
            valid_hash(routes['afterHash']) and routes['beforeHash']!=routes['afterHash'] and
            isinstance(routes['includes'],list),'EXACT_ROUTE_PINS_REQUIRED')
    proof_types=dict(PROOF_TYPES)
    if packet['version']==3:proof_types['apkCompatibility']=APK_COMPATIBILITY_PROOF_TYPE
    require(set(packet['proofs'])==set(proof_types),'SEPARATE_RAW_PROOF_TYPES_REQUIRED')
    for name,kind in proof_types.items():
        entry=packet['proofs'][name]
        require(entry.get('type')==kind and isinstance(entry.get('path'),str) and valid_hash(entry.get('sha256')),
                'RAW_PROOF_TYPE_BINDING_REQUIRED')
    return packet

def qualified_canary_apk(packet, compatibility):
    if packet['version']==2:
        require(compatibility is None,'V2_APK_COMPATIBILITY_NOT_AUTHORIZED')
        return packet['apk']['apkHash']
    require(packet['version']==3 and isinstance(compatibility,dict) and
            digest(compatibility)==UI_APK_COMPATIBILITY_DIGEST,'EXACT_UI_APK_COMPATIBILITY_REQUIRED')
    require(compatibility['installedAPK']==packet['apk'] and
            all(compatibility['worker'][key]==packet['worker'][key] for key in ['sourceSha','imageDigest']),
            'UI_APK_COMPATIBILITY_SUBJECT_CHANGED')
    return compatibility['referenceAPK']['apkHash']


def check_financial_proof(raw, preservation, packet, compatibility=None):
    require(raw.get('readOnly') is True and valid_hash(raw.get('scopeHash')) and isinstance(raw.get('files'),dict),
            'RAW_FINANCIAL_CLOSURE_REQUIRED')
    files=raw['files'];state=files['runtime.json'];canary_packet=state['packet']
    require(canary_packet['mode']=='canary' and canary_packet['controlHash']==raw['scopeHash'] and
            canary_packet['project']==packet['project'] and canary_packet['sourceSha']==packet['worker']['sourceSha'] and
            canary_packet['imageDigest']==packet['worker']['imageDigest'] and
            canary_packet['apkHash']==qualified_canary_apk(packet,compatibility),
            'RAW_CANARY_RELEASE_BINDING_REQUIRED')
    closures=[v for k,v in files.items() if k.startswith('closure-')]
    verifications=[v for k,v in files.items() if k.startswith('financial-verification-')]
    require(bool(closures) and all(v.get('postingOff') is True and v.get('restored') is True and
            v.get('workerStopped') is True and v.get('blockers')==[] for v in closures), 'FINANCIAL_CLOSURE_UNCONFIRMED')
    require(bool(verifications) and all(v.get('financialPreserved') is True and v.get('committed')==1 and
            v.get('pendingMinor')==0 for v in verifications),'RETAINED_FINANCIAL_ACCEPTANCE_REQUIRED')
    require(preservation.get('authenticationPreserved') is True and
            preservation['result']['control']['posting'] is False and
            preservation['result']['session']['status']=='confirmed' and
            len(preservation['result']['events'])==1 and preservation['result']['events'][0]['status']=='committed',
            'RAW_SUCCESS_PRESERVATION_REQUIRED')

def check_controller_proof(run,source,sql,sql_hash,packet):
    workflow='Promoted Voice Operating Qualification'
    require(run.get('name')==workflow and run.get('status')=='completed' and run.get('conclusion')=='success' and
            run.get('headSha',run.get('head_sha'))==packet['controlSourceSha'] and type(run.get('id')) is int,
            'EXACT_OPERATING_WORKFLOW_REQUIRED')
    require(source.get('workflowName')==workflow and source.get('runId')==run['id'] and
            source.get('sourceSha')==packet['controlSourceSha'] and source.get('disposableOnly') is True and
            source.get('stagingDeployment') is False and source.get('physicalDeviceOperations') is False and
            source.get('missingFiles')==[] and isinstance(source.get('files'),dict), 'RAW_SOURCE_ARTIFACT_BINDING_REQUIRED')
    require(all(source['files'].get(CONTROLLER_SOURCE_PATHS[name])==value for name,value in packet['artifacts'].items()),
            'EXACT_CONTROLLER_SOURCE_ARTIFACT_REQUIRED')
    require(source.get('evidenceFiles',{}).get('promoted-operating-database.json')==sql_hash and
            valid_hash(source.get('evidenceFiles',{}).get('promoted-operating-python.log')), 'RAW_SQL_ARTIFACT_BINDING_REQUIRED')
    required={'stale legacy capture cannot join the fresh operating epoch',
              'duplicate execute creates exactly one transaction/posting/balance effect',
              'persistent operating mode survives two commits with exact balance'}
    cases=sql.get('cases')
    require(sql.get('status')=='PASS' and sql.get('actualProductionHelperSQL') is True and
            sql.get('productionOrStagingAccess') is False and isinstance(cases,list) and
            sql.get('behavioralCases')==len(cases) and required.issubset(cases), 'ACTUAL_DISPOSABLE_OPERATING_SQL_REQUIRED')

def check_helper_packet(result,raw,raw_hash,packet):
    require(result.get('evidenceHashes',{}).get('approved-packet.json')==raw_hash and
            raw.get('kind')=='posting-off-helper-rehearsal' and raw.get('project')==packet['project'] and
            raw.get('host')==packet['host'] and raw.get('sourceSha')==packet['worker']['sourceSha'] and
            raw.get('imageDigest')==packet['worker']['imageDigest'] and raw.get('financialEpochAuthority') is None,
            'RAW_HELPER_PACKET_SUBJECT_REQUIRED')
    require(raw.get('files',{}).get('customer-operating-cohort.py')==packet['artifacts']['customer-operating-cohort.py'] and
            raw.get('readOnlyIngress')==packet['apis']['publicAPI'] and
            raw.get('baseline',{}).get('migrations')==packet['requiredMigrations'] and
            raw.get('baseline',{}).get('fingerprints')==packet['baseline']['fingerprints'] and
            raw.get('cohort',{}).get('envHashes',{}).get('migration.env')==packet['database']['migrationEnvHash'] and
            raw.get('cohort',{}).get('databaseCAHash')==packet['database']['databaseCAHash'],
            'RAW_CURRENT_HELPER_IMPLEMENTATION_BINDING_REQUIRED')

def check_apk_proofs(delivery,reuse,packet):
    apk=packet['apk']
    require(delivery.get('sourceCommit')==apk['sourceSha'] and delivery.get('apkSha256')==apk['apkHash'] and
            delivery.get('sourceInputsStillMatch') is True and delivery.get('mobileFocusedTestsPassed')==162 and
            delivery.get('mobileTypecheck')=='PASS' and delivery.get('mobileLintErrors')==0 and
            delivery.get('independentReview')=='PASS_NO_BLOCKING_FINDINGS','RAW_RETAINED_APK_DELIVERY_REQUIRED')
    require(reuse.get('status')=='PASS_LOCAL_BUNDLE_WITH_QUALIFIED_NATIVE_REUSE' and reuse.get('sha256')==apk['apkHash'] and
            reuse.get('certificateSha256')==legacy.CERTIFICATE and legacy.SHA.fullmatch(reuse.get('nativeBaseSource','')) and
            reuse.get('nativeLibrariesUnchanged')==92 and reuse.get('dexFilesUnchanged')==6 and
            reuse.get('manifestAndResourcesUnchanged') is True and
            reuse.get('changedPackagedPayloads')==['assets/index.android.bundle'],'RAW_QUALIFIED_APK_NATIVE_REUSE_REQUIRED')

class LocalHost(legacy.LocalHost):
    def __init__(self,root,packet=None,approval=None,incident=False):
        super().__init__(root)
        if incident:
            journal=self.read_json('incident.json')
            if journal is not None:self.packet=journal['immutable']['scope'];self.approval=None
            else:
                helpers=self.read_json('helper-scope.json')
                require(isinstance(helpers,dict) and helpers.get('scopeHash')==digest(helpers.get('scope')),
                        'PRIVATE_HELPER_PROVENANCE_REQUIRED')
                self.packet=helpers['scope'];self.approval=helpers['approval']
        else:
            self.packet=copy.deepcopy(packet) if packet is not None else self.read_json('packet.json')
            self.approval=copy.deepcopy(approval) if approval is not None else self.read_json('approval.json')
        self._sequence_depth=0
        self.cleanup_deadline=None

    def _private(self,path,directory=False):
        metadata=path.lstat()
        require(path.resolve()==path.absolute() and metadata.st_uid==0 and
                (stat.S_ISDIR(metadata.st_mode) if directory else stat.S_ISREG(metadata.st_mode)) and
                stat.S_IMODE(metadata.st_mode)==(0o700 if directory else 0o600) and
                (directory or metadata.st_nlink==1),'PRIVATE_CONTROL_REQUIRED')

    def target(self,generation,incident=False):
        require(os.name=='posix' and socket.gethostname()=='srv2006836' and os.getuid()==0 and
                legacy.UUID.fullmatch(generation) and self.root==pathlib.Path('/opt/masarifi/customer-voice-operating-'+generation),
                'ROOT_STAGING_SCOPE_REQUIRED')
        self._private(self.root,True)

    def read_json(self,name):
        require(pathlib.Path(name).name==name,'PRIVATE_FILENAME_REQUIRED')
        path=self.root/name
        if not path.exists():
            require(not path.is_symlink(),'PRIVATE_SYMLINK_REFUSED');return None
        self._private(path)
        descriptor=os.open(path,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
        with os.fdopen(descriptor,'r',encoding='utf-8') as stream:
            return legacy.parse_json(stream.read(1048577))

    def save(self,name,value):
        require(pathlib.Path(name).name==name,'PRIVATE_FILENAME_REQUIRED')
        descriptor=os.open(self.root/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
        with os.fdopen(descriptor,'w',encoding='utf-8') as stream:
            json.dump(value,stream,sort_keys=True,allow_nan=False);stream.flush();os.fsync(stream.fileno())
        self._sync_directory()

    def _sync_directory(self):
        if os.name=='posix':
            descriptor=os.open(self.root,os.O_RDONLY|os.O_DIRECTORY|getattr(os,'O_NOFOLLOW',0))
            try:os.fsync(descriptor)
            finally:os.close(descriptor)

    def state(self):
        state=self.read_json('runtime.json');require(isinstance(state,dict),'OWNED_RUNTIME_REQUIRED');return state

    def persist(self,state,initial=False):
        self.target(state['generation'],incident=True)
        if initial:self.save('runtime.json',state);return
        old=self.state();incident=self.read_json('incident.json')
        require({k:state.get(k) for k in incident['immutable']}==incident['immutable'],'IMMUTABLE_RUNTIME_CHANGED')
        for field in ['epochId','manifestHash','workerID','workerPayloadHash']:
            require(old[field] is None or old[field]==state[field],'OWNED_IDENTITY_REPLACEMENT_REFUSED')
        require(old['phase']!='closed' or state['phase']=='closed','CLOSED_RUNTIME_OVERWRITE_REFUSED')
        if self.read_json('close-request.json') is not None:
            require(state['phase'] in ['closing','closed'] or state==old,'CANCELLED_RUNTIME_OVERWRITE_REFUSED')
        descriptor,name=tempfile.mkstemp(prefix='.runtime-',dir=self.root)
        try:
            os.chmod(name,0o600)
            with os.fdopen(descriptor,'w',encoding='utf-8') as stream:
                json.dump(state,stream,sort_keys=True,allow_nan=False);stream.flush();os.fsync(stream.fileno())
            os.replace(name,self.root/'runtime.json');self._sync_directory()
        finally:
            if os.path.exists(name):os.unlink(name)

    @contextlib.contextmanager
    def sequence(self):
        if self._sequence_depth:
            self._sequence_depth+=1
            try:yield
            finally:self._sequence_depth-=1
            return
        self.target(self.packet['generation'])
        import fcntl
        descriptors=[]
        def coordination_parent():
            directory=pathlib.Path('/run/lock')
            require(directory.resolve()==directory.absolute(),'PRIVATE_SEQUENCE_PARENT_REQUIRED')
            for parent in [directory,*directory.parents]:
                metadata=parent.lstat()
                require(stat.S_ISDIR(metadata.st_mode) and metadata.st_uid==0 and
                        (not metadata.st_mode&0o022 or
                         (parent==directory and stat.S_IMODE(metadata.st_mode)==0o1777)),
                        'PRIVATE_SEQUENCE_PARENT_REQUIRED')
        try:
            for path in ['/run/lock/masarifi-staging-deployment.lock',self.root/'lifecycle.lock']:
                shared=path=='/run/lock/masarifi-staging-deployment.lock'
                if shared:coordination_parent()
                def identity(metadata):
                    require(stat.S_ISREG(metadata.st_mode) and metadata.st_uid==0 and metadata.st_nlink==1 and
                            stat.S_IMODE(metadata.st_mode) in ((0o600,0o644) if shared else (0o600,)),
                            'PRIVATE_SEQUENCE_LOCK_REQUIRED')
                    return metadata.st_dev,metadata.st_ino
                target=pathlib.Path(path)
                try:before=identity(target.lstat())
                except FileNotFoundError:before=None
                descriptor=os.open(path,os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600);descriptors.append(descriptor)
                opened=identity(os.fstat(descriptor))
                require((before is None or before==opened) and opened==identity(target.lstat()),
                        'SEQUENCE_LOCK_REPLACED')
                fcntl.flock(descriptor,fcntl.LOCK_EX)
                if shared:coordination_parent()
                require(opened==identity(os.fstat(descriptor))==identity(target.lstat()),'SEQUENCE_LOCK_REPLACED')
            self._sequence_depth=1
            try:yield
            finally:self._sequence_depth=0
        finally:
            for descriptor in reversed(descriptors):os.close(descriptor)

    @contextlib.contextmanager
    def cleanup_budget(self):
        previous=self.closure_deadline
        deadline=self.monotonic()+180
        self.closure_deadline=min(previous,deadline) if previous is not None else deadline
        try:yield
        finally:self.closure_deadline=previous

    @contextlib.contextmanager
    def runner_lock(self,role):
        import fcntl
        require(role in ['control','close'],'DATABASE_RUNNER_ROLE_INVALID')
        descriptor=os.open(self.root/('.database-'+role+'.lock'),os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
        try:
            metadata=os.fstat(descriptor)
            require(metadata.st_uid==0 and stat.S_ISREG(metadata.st_mode) and metadata.st_nlink==1 and
                    stat.S_IMODE(metadata.st_mode)==0o600,'DATABASE_RUNNER_LOCK_INVALID')
            deadline=self.monotonic()+35
            if self.closure_deadline is not None:deadline=min(deadline,self.closure_deadline)
            while True:
                try:fcntl.flock(descriptor,fcntl.LOCK_EX|fcntl.LOCK_NB);break
                except BlockingIOError:
                    remaining=deadline-self.monotonic()
                    require(remaining>0,'DATABASE_RUNNER_LOCK_TIMEOUT')
                    self.pause(min(.05,remaining))
            yield
        finally:os.close(descriptor)

    def validate(self,activation=True):
        validate_packet(self.packet,self.approval,self.now(),activation)
        self.target(self.packet['generation'])
        require(self.read_json('packet.json')==self.packet and self.read_json('approval.json')==self.approval,
                'APPROVED_CONTROL_CHANGED')

    def qualified(self):
        for name,value in self.packet['artifacts'].items():self.pin(self.root/name,value)
        self.pin('/etc/masarifi/migration.env',self.packet['database']['migrationEnvHash'])
        self.pin('/etc/masarifi/supabase-ca.crt',self.packet['database']['databaseCAHash'])
        self.check_proofs()

    def proof(self,entry):
        self.pin(entry['path'],entry['sha256'])
        return legacy.parse_json(pathlib.Path(entry['path']).read_text(encoding='utf-8'))

    def check_proofs(self):
        proofs=self.packet['proofs'];helper=self.proof(proofs['helperOff'])
        require(helper.get('status')=='PASS' and helper.get('postingOff') is True and helper.get('activeEpochs')==0 and
                helper.get('helpersStopped') is True and helper.get('runtimeClosed') is True and
                helper.get('realFinancialTransactionCreated') is False and helper.get('physicalDeviceOperation') is False and
                helper.get('financialBaselineUnchanged') is True and helper.get('completeMigrationHistoryUnchanged') is True and
                helper.get('originalServicePinsUnchanged') is True and helper.get('promotedIngressUnchanged') is True and
                len(helper.get('onlyNewContainers',[]))==2 and len(set(helper['onlyNewContainers']))==2 and
                all(valid_hash(x) for x in helper['onlyNewContainers']), 'RAW_HELPER_ONLY_OFF_PROOF_REQUIRED')
        helper_packet=self.proof(proofs['helperOff']['approvedPacket'])
        check_helper_packet(helper,helper_packet,proofs['helperOff']['approvedPacket']['sha256'],self.packet)
        financial=self.proof(proofs['financialClosure'])
        preservation=self.proof(proofs['financialClosure']['successPreservation'])
        compatibility=self.proof(proofs['apkCompatibility']) if self.packet['version']==3 else None
        check_financial_proof(financial,preservation,self.packet,compatibility)
        backup=self.proof(proofs['backupRestore'])
        require(backup.get('status')=='PASS' and backup.get('stagingModified') is False and
                backup.get('ledgerBalanceMismatches')==0 and valid_hash(backup.get('backupSha256')) and
                backup.get('financialFingerprints')==self.packet['baseline']['fingerprints'] and
                all(v.get('exactRowHashMatches') is True for v in backup.get('tables',{}).values()) and
                bool(backup.get('tables')),'SELECTED_CURRENT_FINANCIAL_RESTORE_REQUIRED')
        for key,source in [('backendCI',self.packet['worker']['sourceSha']),('controllerCI',self.packet['controlSourceSha'])]:
            raw=self.proof(proofs[key]);require(raw.get('conclusion')=='success' and
                raw.get('headSha',raw.get('head_sha'))==source,'EXACT_CI_SOURCE_PROOF_REQUIRED')
            if key=='controllerCI':
                source_artifact=self.proof(proofs[key]['sourceArtifact'])
                sql=self.proof(proofs[key]['sqlQualification'])
                check_controller_proof(raw,source_artifact,sql,proofs[key]['sqlQualification']['sha256'],self.packet)
        apk=self.proof(proofs['apkRuntime'])
        reuse=self.proof(proofs['apkRuntime']['reusedNative'])
        check_apk_proofs(apk,reuse,self.packet)

    def checked_preserved(self,pins,analysis_running=None):
        for role,pin in pins.items():
            c=self.inspect(pin['id'])
            require(c['Id']==pin['id'] and c['Name']=='/'+pin['name'] and
                    ingress.configuration_hash(c)==pin['configurationHash'] and
                    c['Config']['Image']==legacy.IMAGE_PREFIX+pin['imageDigest'] and
                    legacy.environment(c).get('MASARIFI_RELEASE_VERSION')==pin['sourceSha'], 'PRESERVED_WORKER_CHANGED')
            expected=analysis_running if role=='analysis' else True
            if expected is not None:require(c['State']['Running'] is expected,'PRESERVED_WORKER_STATE_CHANGED')

    def cohort(self,analysis_running=None):
        for role in ['originalAPI','publicAPI']:ingress.checked_api(self,self.packet['apis'][role],role,True)
        self.checked_preserved(self.packet['preservedWorkers'],analysis_running)
        for pin in self.packet['otherContainers']:
            c=self.inspect(pin['id']);require(c['Id']==pin['id'] and ingress.configuration_hash(c)==pin['configurationHash'] and
                    c['State']['Running'] is pin['running'],'UNRELATED_CONTAINER_CHANGED')

    def route_guard(self):
        # Qualified exact route metadata and all Nginx includes are reused unchanged.
        view=type('RouteView',(),{})()
        view.scope={'nginxBeforeHash':self.packet['routes']['beforeHash'],
                    'nginxAfterHash':self.packet['routes']['afterHash'],
                    'nginxIncludes':self.packet['routes']['includes']}
        view.run=self.run;view.pin=self.pin
        canary.LocalHost.route_guard(view)

    def preflight(self):
        self.validate();self.qualified();ingress.preserved_apis(self,self.packet['apis'],False)
        self.cohort(True);self.route_guard()
        require(sha(SITE.read_bytes())==self.packet['routes']['beforeHash'],'CURRENT_PUBLIC_3001_ROUTE_REQUIRED')
        require(self.read_json('runtime.json') is None and self.read_json('incident.json') is None and
                self.read_json('close-request.json') is None,'OPERATING_GENERATION_ALREADY_CONSUMED')
        template=self.inspect(self.packet['worker']['templateID'])
        require(not template['State']['Running'] and ingress.configuration_hash(template)==
                self.packet['worker']['templateConfigurationHash'],'QUALIFIED_STOPPED_WORKER_TEMPLATE_REQUIRED')
        helper_scope={'scope':copy.deepcopy(self.packet),'scopeHash':digest(self.packet),'approval':copy.deepcopy(self.approval)}
        existing=self.read_json('helper-scope.json')
        if existing is None:self.save('helper-scope.json',helper_scope)
        else:require(existing==helper_scope,'PRIVATE_HELPER_PROVENANCE_CHANGED')
        try:
            observed=self.database('status')
            require({k:observed.get(k) for k in self.packet['baseline']}==self.packet['baseline'] and
                    (observed.get('epoch') is None or observed['epoch'].get('state')=='closed'), 'CURRENT_OFF_DATABASE_REQUIRED')
            self.validate();self.not_cancelled()
        finally:
            # Preflight is outside lifecycle.begin's prepared-epoch handler.
            # Its own helper scope/journals therefore precede any helper start.
            with self.cleanup_budget():self.stop_helpers(self.identity())

    def claim(self):
        self.validate()
        require(self.read_json('incident.json') is None and self.read_json('runtime.json') is None,
                'OPERATING_GENERATION_ALREADY_CONSUMED')
        # Protected control files are supplied by a separately approved installer.
        # The claim does not change deployment files or shared credentials.
        self.save('claim.json',{'scopeHash':digest(self.packet),'generation':self.packet['generation'],'claimedAt':int(self.now())})

    def identity(self):
        return {'generation':self.packet['generation'],'sourceSha':self.packet['worker']['sourceSha'],
                'imageDigest':self.packet['worker']['imageDigest'],**self.packet['database']}

    def prepare(self):
        self.validate();self.not_cancelled()
        intent={**self.identity(),'scopeHash':digest(self.packet),'scope':copy.deepcopy(self.packet),
                'manifest':manifest(self.packet),'manifestIntentHash':digest(manifest(self.packet)),'manifestHash':None,
                'approvalReceivedAt':self.approval['receivedAt'],'activationExpiresAt':self.approval['activationExpiresAt'],
                'startsAt':int(self.now()),'epochId':None,'workerID':None,'workerPayloadHash':None,
                'workerCreation':'absent','phase':'preparing'}
        immutable={k:v for k,v in intent.items() if k not in ['epochId','manifestHash','workerID','workerPayloadHash','workerCreation','phase']}
        self.save('incident.json',{'immutable':immutable})
        self.persist(intent,initial=True)
        self.not_cancelled();self.validate()
        prepared=self.database('prepare',intent)
        self.prepared_receipt(prepared,intent,reconciled=False)
        intent.update(epochId=prepared['epochId'],manifestHash=prepared['manifestHash'],phase='prepared');self.persist(intent)
        self.forward(intent)
        payload=self.worker_payload(intent)
        self.save('worker-payload.json',payload)
        intent.update(workerPayloadHash=digest(payload),workerCreation='creating');self.persist(intent)
        identity=self.create_worker(payload)
        require(valid_hash(identity),'CREATED_WRITER_ID_REQUIRED')
        intent.update(workerID=identity,workerCreation='confirmed');self.persist(intent)
        return intent

    def prepared_receipt(self,value,state,reconciled=True):
        require(isinstance(value,dict) and legacy.UUID.fullmatch(value.get('epochId','')) and
                valid_hash(value.get('manifestHash')) and (state['manifestHash'] is None or
                value.get('manifestHash')==state['manifestHash']) and
                (value.get('matches') is True if reconciled else value.get('state')=='prepared') and
                value.get('state') in ['prepared','closed'],'EXACT_PREPARATION_RECEIPT_REQUIRED')

    def reconcile(self):
        state=self.read_json('runtime.json')
        if state is None:return None
        self.guard(state)
        if state['epochId'] is None:
            found=self.database('reconcile',state)
            if found is None:
                self.request_close('failed_begin');state['phase']='closing';self.persist(state)
                self.stop_helpers(state)
                self.save('no-owned-epoch-reconcile.json',{'kind':'no-owned-epoch-reconciliation',
                    'generation':state['generation'],'manifestIntentHash':state['manifestIntentHash'],'epochId':None})
                return None
            self.prepared_receipt(found,state)
            state.update(epochId=found['epochId'],manifestHash=found['manifestHash'],
                         phase='closed' if found['state']=='closed' else 'closing')
            self.persist(state)
        else:
            found=self.database('reconcile',state)
            require(found is not None and found.get('epochId')==state['epochId'],'OWNED_EPOCH_RECONCILIATION_REQUIRED')
            self.prepared_receipt(found,state)
        if state['workerCreation']=='creating':
            identity=self.lookup_worker()
            if identity is not None:
                state['workerID']=identity
                self.worker(state)
            state['workerCreation']='uncertain';state['phase']='closing';self.persist(state)
        return state

    def guard(self,state):
        self.target(state['generation'],incident=True)
        incident=self.read_json('incident.json');observed=self.state()
        require(isinstance(incident,dict) and set(incident)=={'immutable'} and
                all(observed.get(k)==v and state.get(k)==v for k,v in incident['immutable'].items()),
                'PRIVATE_INCIDENT_PROVENANCE_CHANGED')
        scope=incident['immutable']['scope']
        require(digest(scope)==incident['immutable']['scopeHash'] and digest(state['manifest'])==state['manifestIntentHash'] and
                state['manifest']==manifest(scope), 'PRIVATE_MANIFEST_PROVENANCE_CHANGED')
        require((state['epochId'] is None and state['manifestHash'] is None) or
                (legacy.UUID.fullmatch(state['epochId']) and valid_hash(state['manifestHash'])), 'PRIVATE_EPOCH_RECEIPT_REQUIRED')
        for field in ['epochId','manifestHash','workerID','workerPayloadHash']:
            require(state[field]==observed[field],'STALE_OWNED_IDENTITY_REFUSED')

    def not_cancelled(self):
        require(self.read_json('close-request.json') is None,'OPERATING_CLOSURE_REQUESTED')

    def request_close(self,reason):
        require(reason in ['closure_requested','failed_begin','failed_recovery','scope_failure','arming_timeout','runtime_unhealthy','epoch_closed'],
                'OPERATING_CLOSURE_REASON_REQUIRED')
        state=self.state();self.guard(state)
        request={'generation':state['generation'],'scopeHash':state['scopeHash'],'manifestIntentHash':state['manifestIntentHash'],
                 'epochId':state['epochId'],'reason':reason,'requestedAt':int(self.now())}
        try:self.save('close-request.json',request)
        except FileExistsError:
            old=self.read_json('close-request.json')
            require(all(old.get(k)==request[k] for k in ['generation','scopeHash','manifestIntentHash']),
                    'FOREIGN_CANCELLATION_PRESERVED')

    def epoch_status(self,state,active):
        value=self.database('status',state);epoch=value.get('epoch')
        require(isinstance(epoch,dict) and epoch.get('epochId')==state['epochId'] and
                epoch.get('manifestHash')==state['manifestHash'] and epoch.get('matches') is True and
                value.get('currentEpoch')==state['epochId'] and epoch.get('mode')=='operating' and
                value.get('enforced') is True and
                epoch.get('expiresAt') is None and epoch.get('state')==('active' if active else 'prepared') and
                value.get('posting') is active,'EXACT_OWNED_EPOCH_FENCE_REQUIRED')
        return value

    def final_fence(self,state,active=False):
        self.guard(state);self.not_cancelled();self.validate(activation=not active)
        require(self.state()['phase'] not in ['closing','closed'],'OPERATING_EPOCH_CLOSING')
        if not active:require(self.now()<state['startsAt']+90,'OPERATING_ARMING_WINDOW_EXPIRED')

    def forward(self,state,active=False):
        self.final_fence(state,active)
        self.epoch_status(state,active)
        self.qualified();self.cohort();self.route_guard()
        candidate=self.inspect(self.packet['apis']['financialAPI']['id'])
        ingress.checked_api(self,self.packet['apis']['financialAPI'],'financialAPI',candidate['State']['Running'])
        self.epoch_status(state,active)
        self.final_fence(state,active)

    def image_labels(self):
        image=json.loads(self.run(['docker','image','inspect',legacy.IMAGE_PREFIX+self.packet['worker']['imageDigest']]))[0]
        require(image['Config']['Labels'].get('org.opencontainers.image.revision')==self.packet['worker']['sourceSha'],
                'WORKER_IMAGE_SOURCE_CHANGED')
        return image['Config']['Labels']

    def worker_payload(self,state):
        scope=state['scope'];w=scope['worker'];template=self.inspect(w['templateID'])
        require(template['Id']==w['templateID'] and ingress.configuration_hash(template)==w['templateConfigurationHash'] and
                template['State']['Running'] is False,'WORKER_TEMPLATE_CHANGED')
        payload=copy.deepcopy(template['Config']);host=copy.deepcopy(template['HostConfig']);env={}
        for entry in payload['Env']:
            key,value=entry.split('=',1);require(key not in env,'UNIQUE_WORKER_ENV_REQUIRED');env[key]=value
        require(env.get('SUPABASE_URL')=='https://'+legacy.PROJECT+'.supabase.co' and
                payload['Cmd']==['dist/src/staging-voice-worker.js'] and
                payload['Image']==legacy.IMAGE_PREFIX+w['imageDigest'] and
                env.get('MASARIFI_RELEASE_VERSION')==w['sourceSha'],'SCOPED_WORKER_TEMPLATE_REQUIRED')
        env.update(MASARIFI_PROCESS_KIND='worker',MASARIFI_RELEASE_VERSION=w['sourceSha'],
                   MASARIFI_STAGING_VOICE_EPOCH_ID=state['epochId'],MASARIFI_VOICE_ANALYSIS_ONLY='false',
                   MASARIFI_AI_ASSISTANT_ONLY='false',MASARIFI_AI_PROVIDER_ENABLED='true',
                   MASARIFI_AI_WORKER_POLL_MS='500',MASARIFI_AI_JOB_BATCH_SIZE='1',MASARIFI_AI_MAX_CONCURRENCY='1',
                   MASARIFI_AI_LEASE_SECONDS='120')
        payload.update(Env=[key+'='+value for key,value in env.items()],Image=legacy.IMAGE_PREFIX+w['imageDigest'],Hostname='',
                       Labels={**self.image_labels(),'org.masarifi.scope':scope_name(scope),'org.masarifi.epoch':state['epochId']},
                       Healthcheck={'Test':['CMD','/nodejs/bin/node','dist/src/staging-voice-healthcheck.js'],
                                    'Interval':5000000000,'Timeout':3000000000,'StartPeriod':10000000000,'Retries':2})
        host['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
        if host.get('OomKillDisable') is None:host['OomKillDisable']=False
        require(host['NetworkMode']==legacy.NETWORK and host['ReadonlyRootfs'] is True and
                host['Privileged'] is False and not host.get('CapAdd') and host['CapDrop']==['ALL'] and
                not host.get('PortBindings') and host.get('OomKillDisable') is False,'ISOLATED_SCOPED_WRITER_REQUIRED')
        return {**payload,'HostConfig':host}

    def create_worker(self,payload):
        class Unix(http.client.HTTPConnection):
            def connect(connection):
                connection.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
                connection.sock.settimeout(connection.timeout);connection.sock.connect('/var/run/docker.sock')
        version=self.run(['docker','version','--format','{{.Server.APIVersion}}'])
        require(re.fullmatch(r'1\.[0-9]+',version),'ENGINE_API_VERSION_REQUIRED')
        state=self.state();self.forward(state)
        connection=Unix('localhost',timeout=15)
        try:
            connection.request('POST','/v'+version+'/containers/create?name='+worker_name(state['scope']),
                               json.dumps(payload),{'Content-Type':'application/json'})
            response=connection.getresponse();body=response.read(65537)
            require(len(body)<=65536 and response.status==201,'WRITER_CREATION_UNCERTAIN')
            return legacy.parse_json(body.decode())['Id']
        finally:connection.close()

    def lookup_worker(self):
        state=self.state();name=worker_name(state['scope'])
        present=self.run(['docker','ps','-a','--no-trunc','--filter','name=^/'+name+'$','--format','{{.ID}}'])
        if not present:return None
        require(valid_hash(present),'AMBIGUOUS_WRITER_ID_REQUIRED');return present

    def worker(self,state):
        if state['workerID'] is None:return None
        c=self.inspect(state['workerID'])
        require(c['Id']==state['workerID'] and c['Name']=='/'+worker_name(state['scope']) and
                digest(canary.inspected_worker_payload(c))==state['workerPayloadHash'],'EXACT_OWNED_WRITER_CHANGED')
        return c

    def unit(self):return scope_name(self.state())+'-monitor.service'
    def unit_content(self):
        return '[Unit]\nDescription=Approved persistent Staging Voice operating scope\nAfter=docker.service\n[Service]\nType=exec\nUser=root\nWorkingDirectory='+str(self.root)+'\nExecStart=/usr/bin/python3 -B '+str(self.root)+'/promoted-operating.py monitor\nExecStopPost=/usr/bin/python3 -B '+str(self.root)+'/promoted-operating.py close\nRestart=no\nTimeoutStopSec=180\n'

    def arm(self,state):
        self.forward(state)
        self.save('monitor-unit.json',{'name':self.unit(),'text':self.unit_content()})
        target=pathlib.Path('/etc/systemd/system')/self.unit()
        self.forward(state)
        descriptor=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
        with os.fdopen(descriptor,'w') as stream:stream.write(self.unit_content());stream.flush();os.fsync(stream.fileno())
        self.forward(state);self.run(['systemctl','daemon-reload'])
        self.forward(state);self.run(['systemctl','start',self.unit()])
        self.monitor_proof()

    def monitor_proof(self):
        target=pathlib.Path('/etc/systemd/system')/self.unit();metadata=target.lstat()
        require(stat.S_ISREG(metadata.st_mode) and metadata.st_uid==0 and stat.S_IMODE(metadata.st_mode)==0o644 and
                target.read_text()==self.unit_content(),'MONITOR_SOURCE_CHANGED')
        require(self.run(['systemctl','show',self.unit(),'--property=FragmentPath','--value'])==str(target) and
                self.run(['systemctl','show',self.unit(),'--property=Restart','--value'])=='no' and
                self.run(['systemctl','is-active',self.unit()])=='active','EXACT_PERSISTENT_MONITOR_REQUIRED')

    def wait(self,state,probe,active=False,seconds=20):
        deadline=self.monotonic()+seconds
        while self.monotonic()<deadline:
            self.forward(state,active)
            try:ready=probe()
            except (RuntimeError,OSError,ValueError,KeyError,TypeError):ready=False
            self.final_fence(state,active)
            if ready:return
            self.pause(.5)
        raise RuntimeError('BOUNDED_READINESS_UNCONFIRMED')

    def http(self,url):
        allowed={PUBLIC+'/health/'+path for path in ['live','compatibility']}
        allowed.update('http://127.0.0.1:'+str(port)+'/health/'+path for port in ingress.PORTS.values()
                       for path in ['live','ready','compatibility'])
        require(url in allowed,'FIXED_HEALTH_URL_REQUIRED')
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args,**kwargs):raise RuntimeError('HEALTH_REDIRECT_REFUSED')
        timeout=3
        if self.closure_deadline is not None:
            remaining=self.closure_deadline-self.monotonic();require(remaining>0,'OPERATING_CLOSURE_DEADLINE');timeout=min(timeout,remaining)
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
        try:
            with opener.open(url,timeout=timeout) as response:
                require(response.geturl()==url,'HEALTH_REDIRECT_REFUSED');body=response.read(65537)
                require(len(body)<=65536,'HEALTH_RESPONSE_TOO_LARGE');return legacy.parse_json(body.decode())
        except (urllib.error.URLError,TimeoutError):raise RuntimeError('BOUNDED_HEALTH_FAILED') from None

    def public_ready(self,financial):
        scope=self.packet;self.route_guard()
        require(sha(SITE.read_bytes())==scope['routes']['afterHash' if financial else 'beforeHash'],'SELECTED_ROUTE_REQUIRED')
        ingress.api_health(self,scope['apis'],financial,scope['apiContracts'])
        live=self.http(PUBLIC+'/health/live');compat=self.http(PUBLIC+'/health/compatibility')
        require(live.get('version')==scope['apis']['publicAPI']['sourceSha'] and compat.get('schemaVersion')==1 and
                compat.get('contracts')==scope['apiContracts'],'PUBLIC_LIVE_CONTRACTS_REQUIRED')

    def start_api(self,state):
        self.forward(state)
        c=ingress.checked_api(self,self.packet['apis']['financialAPI'],'financialAPI',False)
        self.forward(state);self.run(['docker','start',c['Id']])
        self.wait(state,lambda:ingress.api_health(self,self.packet['apis'],True,self.packet['apiContracts']) is not None)

    def start_worker_off(self,state):
        require(state['workerCreation']=='confirmed','WRITER_CREATION_UNCERTAIN')
        self.forward(state);c=self.worker(state)
        require(c is not None and c['State']['Running'] is False,'EXACT_STOPPED_WRITER_REQUIRED')
        self.forward(state);self.run(['docker','start',c['Id']]);self.final_fence(state)

    def runtime(self,state):
        self.worker(state)
        result=legacy.parse_json(self.run(['docker','exec',state['workerID'],'/nodejs/bin/node','-e',
                                          "process.stdout.write(require('node:fs').readFileSync('/tmp/staging-voice-health.json','utf8'))"]))
        require(result['sourceSha']==state['sourceSha'] and result['epochId']==state['epochId'] and
                0<=self.now()*1000-result['observedAt']<=15000,'CURRENT_OWNED_HEARTBEAT_REQUIRED');return result

    def verify_worker_off(self,state):
        self.wait(state,lambda:self.runtime(state).get('enabled') is False)
        self.epoch_status(state,False);self.final_fence(state)

    def stop_analysis(self,state):
        self.forward(state);self.cohort(True);pin=self.packet['preservedWorkers']['analysis']
        self.forward(state);self.run(['docker','stop','--time','5',pin['id']]);self.cohort(False);self.final_fence(state)

    def replace_route(self,desired,expected,state=None):
        self.route_guard();require(SITE.read_bytes()==expected,'FOREIGN_ROUTE_PRESERVED')
        if state is not None:self.forward(state)
        temporary=SITE.with_name('.masarifi-operating-'+self.state()['generation']+'.tmp')
        descriptor=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
        with os.fdopen(descriptor,'wb') as stream:stream.write(desired);stream.flush();os.fsync(stream.fileno())
        if state is not None:
            self.forward(state);require(SITE.read_bytes()==expected,'FOREIGN_ROUTE_PRESERVED')
        os.replace(temporary,SITE)
        self.run(['nginx','-t']);self.run(['systemctl','reload','nginx'])

    def promote(self,state):
        self.forward(state);self.cohort(False)
        before=SITE.read_bytes();after=ingress.financial_route(before)
        require(sha(before)==self.packet['routes']['beforeHash'] and sha(after)==self.packet['routes']['afterHash'],
                'EXACT_TWO_ROUTE_DIFF_REQUIRED')
        self.forward(state);self.replace_route(after,before,state);self.public_ready(True);self.final_fence(state)

    def activate(self,state):
        self.forward(state);self.public_ready(True);self.monitor_proof();self.cohort(False)
        self.forward(state)
        state['activationRequestedAt']=int(self.now());self.persist(state)
        self.final_fence(state)
        receipt=self.database('activate',state)
        require(receipt.get('epochId')==state['epochId'] and 'startedAt' in receipt and
                'expiresAt' in receipt and receipt['expiresAt'] is None,'INDEFINITE_OPERATING_ACTIVATION_REQUIRED')
        self.epoch_status(state,True);self.final_fence(state,True)
        state['phase']='active';self.persist(state)

    def ready(self,state):
        self.wait(state,lambda:self.runtime(state).get('enabled') is True,active=True)
        self.public_ready(True);self.monitor_proof();self.final_fence(state,True)

    def save_ready(self,state):
        self.forward(state,True);self.epoch_status(state,True);self.final_fence(state,True)
        self.save('ready-'+str(time.time_ns())+'.json',{'status':'AUTHORIZED_PERSISTENT_OPERATING_READY',
                  'generation':state['generation'],'epochId':state['epochId'],'workerID':state['workerID'],
                  'manifestHash':state['manifestHash'],'expiresAt':None})
        if 'recoveryRequestedAt' in state:
            state['lastRecoveryAt']=int(self.now());del state['recoveryRequestedAt'];self.persist(state)

    def database(self,action,state=None):
        require(action in ['status','monitor','prepare','reconcile','activate','close'],'DATABASE_ACTION_REQUIRED')
        if action=='close':self.guard(state);identity=state;scope=state['scope']
        else:
            self.validate(activation=action in ['prepare','activate']);identity=state or self.identity();scope=self.packet
        self.pin('/etc/masarifi/migration.env',identity['migrationEnvHash'])
        self.pin('/etc/masarifi/supabase-ca.crt',identity['databaseCAHash'])
        self.pin(self.root/'operating-db.cjs',scope['artifacts']['operating-db.cjs'])
        code=(self.root/'operating-db.cjs').read_text(encoding='utf-8')
        control={'project':scope['project'],'manifest':state['manifest'] if state else manifest(scope),
                 'requiredMigrations':scope['requiredMigrations'],'baseline':scope['baseline'],
                 'epochId':state['epochId'] if state else None,'manifestHash':state['manifestHash'] if state else None,
                 'approvalReceivedAt':state['approvalReceivedAt'] if state else self.approval['receivedAt'],
                 'activationExpiresAt':state['activationExpiresAt'] if state else self.approval['activationExpiresAt'],
                 'startsAt':state['startsAt'] if state else int(self.now())}
        role='close' if action=='close' else 'control'
        # A lost control exec response is reconciled exactly once through the
        # independent close helper. Its uncertain control journal is retained.
        control_journal=self.read_runner('control')
        if action=='reconcile' and control_journal and control_journal['phase']!='idle':role='close'
        with self.runner_lock(role):
            if action!='close':
                self.validate(activation=action in ['prepare','activate'])
                if action!='reconcile':self.not_cancelled()
                if state is not None:self.guard(state)
            try:runner=legacy.retained_database_runner(self,identity,role)
            except (RuntimeError,OSError,ValueError,KeyError,TypeError):
                journal=self.read_runner(role)
                if journal:
                    journal['phase']='uncertain';self.write_runner(role,journal)
                    try:
                        owned=legacy.checked_database_runner(self,journal)
                        if owned['State']['Running']:self.run(['docker','stop','--time','1',owned['Id']],timeout=10)
                    except (RuntimeError,OSError,ValueError,KeyError,TypeError):pass
                raise
            journal=self.read_runner(role);journal['phase']='executing';self.write_runner(role,journal)
            try:
                if action in ['prepare','activate']:
                    self.not_cancelled();self.validate();require(self.now()<control['activationExpiresAt'],'ACTIVATION_WINDOW_EXPIRED')
                result=legacy.parse_json(self.run(['docker','exec','--env','OPERATING_ACTION='+action,
                    '--env','OPERATING_CONTROL='+json.dumps(control,sort_keys=True,separators=(',',':')),
                    runner,'/nodejs/bin/node','-e',code],timeout=30))
            except (RuntimeError,OSError,ValueError,KeyError,TypeError):
                try:self.run(['docker','stop','--time','1',runner],timeout=10)
                except (RuntimeError,OSError):pass
                raise
            journal['phase']='idle';self.write_runner(role,journal)
        return result

    def close_epoch(self,state):
        receipt=self.database('close',state)
        require(receipt.get('currentEpochMatches') is True and receipt.get('state')=='closed' and
                receipt.get('posting') is False,'EXACT_OWNED_OFF_REQUIRED')
        bound={'generation':state['generation'],'manifestHash':state['manifestHash'],'epochId':state['epochId'],'receipt':receipt}
        existing=self.read_json('owned-off-receipt.json')
        if existing is None:self.save('owned-off-receipt.json',bound)
        else:require(existing==bound,'OWNED_OFF_RECEIPT_CHANGED')
        return receipt

    def stop_worker(self,state):
        self.guard(state);c=self.worker(state)
        if c is None and state['workerCreation'] in ['creating','uncertain']:
            identity=self.lookup_worker()
            if identity is not None:
                state['workerID']=identity;c=self.worker(state)
                state['workerCreation']='uncertain';state['phase']='closing';self.persist(state)
        if c is not None:
            if c['State']['Running']:self.run(['docker','stop','--time','5',c['Id']],timeout=15)
            require(self.worker(state)['State']['Running'] is False,'WRITER_STOP_UNCONFIRMED')

    def route_restore_checks(self,state):
        self.guard(state);scope=state['scope'];require(scope['incident']['restoreIngress'] is True,'RESTORATION_NOT_AUTHORIZED')
        off=self.read_json('owned-off-receipt.json')
        require(off is not None and off['epochId']==state['epochId'] and off['manifestHash']==state['manifestHash'] and
                off['generation']==state['generation'] and off['receipt']['posting'] is False and
                off['receipt']['state']=='closed' and off['receipt']['currentEpochMatches'] is True,'OWNED_OFF_RESTORATION_REQUIRED')
        writer=self.worker(state)
        require(writer is None or writer['State']['Running'] is False,'STOPPED_WRITER_RESTORATION_REQUIRED')
        for role in ['originalAPI','publicAPI']:ingress.checked_api(self,scope['apis'][role],role,True)
        self.checked_preserved(scope['preservedWorkers'])
        for pin in scope['otherContainers']:
            c=self.inspect(pin['id']);require(ingress.configuration_hash(c)==pin['configurationHash'] and
                c['State']['Running'] is pin['running'],'UNRELATED_CONTAINER_CHANGED')
        # Use the private immutable scope during incident route checks.
        packet=self.packet
        try:self.packet=scope;self.route_guard()
        finally:self.packet=packet
        c=self.inspect(scope['apis']['financialAPI']['id'])
        ingress.checked_api(self,scope['apis']['financialAPI'],'financialAPI',c['State']['Running'])

    def restore_route(self,state):
        self.route_restore_checks(state);scope=state['scope'];current=SITE.read_bytes()
        if sha(current)==scope['routes']['afterHash']:
            before=ingress.restore_route(current);require(sha(before)==scope['routes']['beforeHash'],'EXACT_RESTORE_ROUTE_REQUIRED')
            packet=self.packet
            try:self.packet=scope;self.replace_route(before,current)
            finally:self.packet=packet
        else:require(sha(current)==scope['routes']['beforeHash'],'FOREIGN_ROUTE_PRESERVED')

    def stop_api(self,state):
        self.route_restore_checks(state);pin=state['scope']['apis']['financialAPI']
        c=self.inspect(pin['id']);ingress.checked_api(self,pin,'financialAPI',c['State']['Running'])
        if c['State']['Running']:self.run(['docker','stop','--time','5',c['Id']],timeout=15)
        ingress.checked_api(self,pin,'financialAPI',False)

    def restore_analysis(self,state):
        self.route_restore_checks(state);pin=state['scope']['preservedWorkers']['analysis'];c=self.inspect(pin['id'])
        if not c['State']['Running']:self.run(['docker','start',pin['id']],timeout=15)
        self.checked_preserved(state['scope']['preservedWorkers'],True)

    def verify_restored(self,state):
        self.route_restore_checks(state);self.checked_preserved(state['scope']['preservedWorkers'],True)
        packet=self.packet
        try:self.packet=state['scope'];self.public_ready(False)
        finally:self.packet=packet

    def stop_helpers(self,state):self.stop_database_runners(state)

    def save_closure(self,receipt):
        state=self.state();state['phase']='closed' if not receipt['blockers'] else 'closing';self.persist(state)
        self.save('closure-'+str(time.time_ns())+'.json',receipt)

    def snapshot(self,state):
        self.guard(state);self.not_cancelled();self.validate(activation=False)
        try:value=self.database('monitor',state)
        except (RuntimeError,OSError,ValueError,KeyError,TypeError) as error:
            # Retain a finite diagnostic in the service journal. Never emit SQL,
            # environment, command stderr or arbitrary exception text. Reporting
            # must not replace the original error or obstruct fail-closed cleanup.
            match=re.fullmatch(r'OPERATING_DATABASE_FAILED_MONITOR_(CONFIGURATION|CONNECTION|TRANSACTION|STATUS|SCHEMA|COMMIT)_([A-Z0-9]{5}|ERR_ASSERTION|UNAVAILABLE)',str(error))
            diagnostic={'error':'OPERATING_MONITOR_DATABASE_FAILED','stage':match[1].lower() if match else 'unavailable',
                        'code':match[2] if match else 'UNAVAILABLE'}
            try:sys.stderr.write(json.dumps(diagnostic)+'\n')
            except (OSError,ValueError,TypeError):pass
            raise
        epoch=value.get('epoch') or {}
        result={**value,'state':epoch.get('state'),'mode':epoch.get('mode'),
                'currentEpochMatches':value.get('currentEpoch')==state['epochId'] and epoch.get('matches') is True and
                    epoch.get('manifestHash')==state['manifestHash'] and epoch.get('epochId')==state['epochId'],
                'scopeValid':epoch.get('expiresAt') is None and value.get('executionFailed',0)==0 and
                    value.get('enforced') is True,
                'apiReady':False,'workerHealthy':False}
        self.qualified();self.cohort(False if epoch.get('state')=='active' else None);self.route_guard();self.monitor_proof()
        if epoch.get('state')=='active':
            try:
                self.public_ready(True);result['apiReady']=True
                result['workerHealthy']=self.runtime(state).get('enabled') is True
            except (RuntimeError,OSError,ValueError,KeyError,TypeError):pass
        self.not_cancelled();self.guard(state)
        return result

    def recovery_fence(self,state):
        require(state['scope']['recovery']['automatic'] is True,'RECOVERY_NOT_AUTHORIZED')
        require(state['workerCreation']=='confirmed','WRITER_CREATION_UNCERTAIN')
        require(self.now()>=state.get('lastRecoveryAt',state.get('activationRequestedAt',state['startsAt']))+
                state['scope']['recovery']['cooldownSeconds'],'RECOVERY_COOLDOWN_REQUIRED')
        self.forward(state,True);self.public_ready(True);self.monitor_proof();self.cohort(False)
        self.final_fence(state,True)

    def start_worker(self,state):
        self.recovery_fence(state);c=self.worker(state)
        require(c is not None and c['State']['Running'] is False,'RECOVERY_STOPPED_EXACT_WRITER_REQUIRED')
        self.recovery_fence(state)
        state['recoveryRequestedAt']=int(self.now());self.persist(state)
        self.final_fence(state,True);self.run(['docker','start',c['Id']],timeout=15);self.final_fence(state,True)

def main():
    require(len(sys.argv)==2 and sys.argv[1] in ['check','begin','monitor','close','recover'],'OPERATING_ACTION_REQUIRED')
    action=sys.argv[1];host=LocalHost(HERE,incident=action=='close')
    if action=='close' and host.read_json('runtime.json') is None:
        host.target(host.packet['generation'],incident=True)
        helper_scope=host.read_json('helper-scope.json')
        validate_packet(helper_scope['scope'],helper_scope['approval'],host.now(),activation=False)
        with host.sequence():
            with host.cleanup_budget():host.stop_helpers(host.identity())
        result={'kind':'owned-helper-stop','helpersStopped':True,'financialEpochAuthority':False}
    elif action=='close':result=lifecycle.close(host.state(),host)
    elif action=='monitor':result={'closedReason':lifecycle.monitor(host.state(),host)}
    elif action=='recover':
        host.validate(activation=False)
        require(host.packet['recovery']['automatic'] is True,'RECOVERY_NOT_AUTHORIZED')
        lifecycle.recover(host.state(),host);result={'recovery':'ready'}
    elif action=='begin':state=lifecycle.begin(host);result={'epochId':state['epochId'],'status':'AUTHORIZED_PERSISTENT_OPERATING_READY'}
    else:host.preflight();result={'status':'APPROVED_CURRENT_TOPOLOGY_PREFLIGHT_PASS'}
    print(json.dumps(result,sort_keys=True))
    if action=='close' and result.get('kind')!='owned-helper-stop':require(not result['blockers'] and result['postingOff'] and result['workerStopped'] and
                               result['restored'] and result['helpersStopped'],'OPERATING_CLOSURE_UNCONFIRMED')

if __name__=='__main__':main()
