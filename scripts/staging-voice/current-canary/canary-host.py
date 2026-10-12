"""Current retained-container canary adapter. CLI requires separate exact approval."""
import contextlib,copy,datetime,hashlib,http.client,importlib.util,json,os,pathlib,socket,stat,subprocess,sys,time

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('canary_control',HERE/'canary-control.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
SITE=pathlib.Path('/etc/nginx/sites-available/masarifi-staging')
PUBLIC='https://api.staging.masarifiratibi.com'

def sha(value):return hashlib.sha256(value).hexdigest()
def configuration(container):return sha(json.dumps({k:container[k] for k in ('Config','HostConfig','Mounts')},sort_keys=True).encode())

def inspected_worker_payload(container):
 actual={**copy.deepcopy(container['Config']),'HostConfig':copy.deepcopy(container['HostConfig'])};actual['Hostname']=''
 # Docker may clear this optional false value at startup; disabling OOM remains rejected.
 if 'OomKillDisable' in actual['HostConfig'] and actual['HostConfig']['OomKillDisable'] is None:actual['HostConfig']['OomKillDisable']=False
 return actual

def synchronize_runtime(expected,observed):
 g.require({k:v for k,v in observed.items() if k!='activationRequestedAt'}=={k:v for k,v in expected.items() if k!='activationRequestedAt'},'MONITOR_RUNTIME_CHANGED')
 if 'activationRequestedAt' in observed:
  value=observed['activationRequestedAt']
  g.require(type(value) in (int,float) and observed['startsAt']<=value<observed['startsAt']+90,'ACTIVATION_METADATA_INVALID')
  expected['activationRequestedAt']=value
 return expected

def promoted(before):
 old=b'proxy_pass http://127.0.0.1:3001;'
 g.require(before.count(old)==2,'EXACT_TWO_API_ROUTES_REQUIRED')
 return before.replace(old,b'proxy_pass http://127.0.0.1:3003;')

def worker_payload(template,scope,epoch,image_labels=None):
 g.require(template['Id']==scope['workerTemplateID'] and configuration(template)==scope['workerTemplateConfigurationHash'] and not template['State']['Running'],'WORKER_TEMPLATE_CHANGED')
 payload=copy.deepcopy(template['Config']);host=copy.deepcopy(template['HostConfig'])
 env=dict(x.split('=',1) for x in payload['Env'])
 g.require(env['SUPABASE_URL']=='https://'+g.PROJECT+'.supabase.co' and payload['Cmd']==['dist/src/staging-voice-worker.js'],'SCOPED_WORKER_TEMPLATE_REQUIRED')
 env.update({'MASARIFI_PROCESS_KIND':'worker','MASARIFI_RELEASE_VERSION':g.SOURCE,'MASARIFI_STAGING_VOICE_EPOCH_ID':epoch,'MASARIFI_VOICE_ANALYSIS_ONLY':'false','MASARIFI_AI_ASSISTANT_ONLY':'false','MASARIFI_AI_PROVIDER_ENABLED':'true','MASARIFI_AI_WORKER_POLL_MS':'500','MASARIFI_AI_JOB_BATCH_SIZE':'1','MASARIFI_AI_MAX_CONCURRENCY':'1','MASARIFI_AI_LEASE_SECONDS':'120'})
 payload['Env']=[key+'='+value for key,value in env.items()];payload['Image']=g.IMAGE;payload['Hostname']=''
 payload['Healthcheck']={'Test':['CMD','/nodejs/bin/node','dist/src/staging-voice-healthcheck.js'],'Interval':5000000000,'Timeout':3000000000,'StartPeriod':10000000000,'Retries':2}
 payload['Labels']={**(image_labels or {}),'org.masarifi.scope':'masarifi-canary-'+scope['attempt'],'org.masarifi.epoch':epoch}
 host['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
 # Docker 29.8.1 canonicalizes null to false; explicitly retain its enabled OOM killer.
 if host.get('OomKillDisable') is None:host['OomKillDisable']=False
 g.require(host['NetworkMode']=='masarifi-staging_backend' and host['ReadonlyRootfs'] and not host['Privileged'] and not host.get('CapAdd') and host['CapDrop']==['ALL'] and not host.get('PortBindings'),'ISOLATED_SCOPED_WRITER_REQUIRED')
 return {**payload,'HostConfig':host}

class LocalHost:
 def __init__(self,root,scope,approval):
  self.root=pathlib.Path(root);self.scope=scope;self.approval=approval;self.sequence_lock=None;self.cleanup_deadline=None
 @contextlib.contextmanager
 def cleanup_budget(self):
  previous=self.cleanup_deadline;deadline=time.monotonic()+180
  self.cleanup_deadline=min(previous,deadline) if previous is not None else deadline
  try:yield
  finally:self.cleanup_deadline=previous
 @contextlib.contextmanager
 def closure_lock(self):
  if self.sequence_lock is not None:
   yield;return
  import fcntl
  lock=self.root/'lifecycle.lock';st=lock.lstat()
  g.require(stat.S_ISREG(st.st_mode) and st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o600,'PRIVATE_LIFECYCLE_LOCK_REQUIRED')
  with lock.open('r') as fd:
   fcntl.flock(fd,fcntl.LOCK_EX)
   try:yield
   finally:fcntl.flock(fd,fcntl.LOCK_UN)
 def release_sequence(self):
  if self.sequence_lock is not None:
   self.sequence_lock.close();self.sequence_lock=None
 def request_close(self,reason):
  g.require(reason in ['closure_requested','deadline','scope_failure','completed','arming_timeout','runtime_unhealthy'],'CLOSURE_REASON_REQUIRED')
  state=self.state();self.guard(state)
  target=self.root/'close-request.json'
  try:self.save('close-request.json',{'epochId':state['epochId'],'scopeHash':g.digest(self.scope),'reason':reason,'requestedAt':self.now()})
  except FileExistsError:
   value=json.loads(target.read_text());g.require(value['epochId']==state['epochId'] and value['scopeHash']==g.digest(self.scope),'FOREIGN_CANCELLATION_PRESERVED')
 def not_cancelled(self):g.require(not (self.root/'close-request.json').exists(),'CANARY_CLOSURE_ALREADY_REQUESTED')
 def now(self):return time.time()
 def pause(self,seconds):time.sleep(seconds)
 def run(self,args,timeout=20,input=None):
  if self.cleanup_deadline is not None:
   remaining=self.cleanup_deadline-time.monotonic()
   g.require(remaining>0,'AGGREGATE_CLEANUP_BUDGET_EXHAUSTED')
   timeout=min(timeout,remaining)
  try:r=subprocess.run(args,input=input,capture_output=True,text=True,timeout=timeout,env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','DOCKER_HOST':'unix:///var/run/docker.sock'})
  except subprocess.SubprocessError:raise RuntimeError('BOUNDED_HOST_COMMAND_TIMEOUT') from None
  g.require(r.returncode==0,'BOUNDED_HOST_COMMAND_FAILED');return r.stdout.strip()
 def inspect(self,identity):return json.loads(self.run(['docker','inspect',identity]))[0]
 def save(self,name,value):
  target=self.root/name
  with target.open('x',encoding='utf-8') as f:json.dump(value,f,sort_keys=True)
  target.chmod(0o600)
 def pin(self,path,digest):
  p=pathlib.Path(path);g.require(not p.is_symlink() and p.resolve()==p.absolute() and sha(p.read_bytes())==digest,'PIN_CHANGED')
 def state(self):return json.loads((self.root/'runtime.json').read_text())
 def persist(self,state):
  target=self.root/'runtime.json';temporary=self.root/'runtime.pending'
  with temporary.open('x',encoding='utf-8') as f:json.dump(state,f,sort_keys=True);f.flush();os.fsync(f.fileno())
  temporary.chmod(0o600);os.replace(temporary,target)
 def cohort(self,analysis_running=None):
  s=self.scope
  for identity,key in [(s['publicAPIID'],'publicAPIConfigurationHash'),(s['analysisID'],'analysisConfigurationHash')]:
   c=self.inspect(identity);g.require(configuration(c)==s[key],'PRESERVED_COHORT_CHANGED')
   expected=True if identity==s['publicAPIID'] else analysis_running
   if expected is not None:g.require(c['State']['Running'] is expected,'PRESERVED_COHORT_STATE_CHANGED')
  public=self.inspect(s['publicAPIID']);g.require(public['State']['Health']['Status']=='healthy','PUBLIC_API_UNHEALTHY')
  for item in s['otherContainers']:
   c=self.inspect(item['id']);g.require(configuration(c)==item['configurationHash'] and c['State']['Running'] is item['running'],'UNRELATED_CONTAINER_CHANGED')
 def candidate(self):
  c=self.inspect(self.scope['financialAPIID']);g.require(configuration(c)==self.scope['financialAPIConfigurationHash'] and c['Config']['Image']==g.IMAGE,'QUALIFIED_API_CHANGED');return c
 def route_guard(self):
  st=SITE.lstat();g.require(stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_gid==0 and st.st_nlink==1 and stat.S_IMODE(st.st_mode)==0o644 and SITE.resolve()==SITE,'PROTECTED_ROUTE_REQUIRED')
  g.require(sha(SITE.read_bytes()) in [self.scope['nginxBeforeHash'],self.scope['nginxAfterHash']],'FOREIGN_ROUTE_PRESERVED')
  for item in self.scope['nginxIncludes']:
   p=pathlib.Path(item['path']);g.require(str(p.resolve())==item['resolved'],'NGINX_INCLUDE_CHANGED')
   if item['resolved']!=str(SITE):self.pin(item['resolved'],item['sha256'])
  includes=[]
  for line in self.run(['nginx','-T']).splitlines():
   if line.startswith('# configuration file '):includes.append(line[len('# configuration file '):].rstrip(':'))
  g.require(sorted(includes)==sorted(x['path'] for x in self.scope['nginxIncludes']),'NGINX_INCLUDE_SET_CHANGED')
 def guard(self,state):
  g.require(socket.gethostname()==g.HOST and os.getuid()==0,'ROOT_STAGING_REQUIRED')
  g.validate(self.scope,self.approval,self.now(),activation=False)
  g.require(self.root==pathlib.Path('/opt/masarifi/masarifi-canary-'+self.scope['attempt']) and not self.root.is_symlink(),'OWNED_ROOT_REQUIRED')
  for name in ['scope.json','approval.json','runtime.json']:
   st=(self.root/name).lstat();g.require(stat.S_ISREG(st.st_mode) and st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o600,'PRIVATE_CONTROL_REQUIRED')
  st=self.root.lstat();g.require(st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o700,'PRIVATE_ROOT_REQUIRED')
  g.require(json.loads((self.root/'scope.json').read_text())==self.scope and json.loads((self.root/'approval.json').read_text())==self.approval,'CONTROL_CHANGED')
  synchronize_runtime(state,self.state())
  # Closure provenance deliberately does not depend on any service's health.
 def qualified(self):
  for name,digest in self.scope['files'].items():self.pin(self.root/name,digest)
  for name,digest in self.scope['envHashes'].items():self.pin('/etc/masarifi/'+name,digest)
  self.pin('/etc/masarifi/supabase-ca.crt',self.scope['caHash'])
 def advancing(self,state):
  self.guard(state);self.not_cancelled();g.validate(self.scope,self.approval,self.now())
  g.require(self.now()<min(state['deadline'],state['startsAt']+90),'FIXED_ARMING_WINDOW_EXPIRED')
  value=self.database('status',state)
  g.require(value['currentEpochMatches'] and value['state']=='prepared' and value['posting'] is False and value['members']==0,'PREPARED_OFF_FORWARD_FENCE_REQUIRED')
  self.qualified();self.cohort();self.candidate();self.route_guard()
 def database(self,action,state=None):
  g.require(action in ['baseline','prepare','reconcile','activate','status','close','verify'],'DATABASE_ACTION_REQUIRED')
  if state is not None:self.guard(state)
  self.pin('/etc/masarifi/migration.env',self.scope['envHashes']['migration.env'])
  self.pin('/etc/masarifi/supabase-ca.crt',self.scope['caHash'])
  g.require(configuration(self.inspect(self.scope['publicAPIID']))==self.scope['publicAPIConfigurationHash'],'DATABASE_READER_IDENTITY_CHANGED')
  env={}
  for line in pathlib.Path('/etc/masarifi/migration.env').read_text().splitlines():
   if '=' in line and not line.lstrip().startswith('#'):
    key,value=line.split('=',1);env[key]=value.strip().strip('"').strip("'")
  code=(self.root/'canary-db.cjs').read_text() if (self.root/'canary-db.cjs').exists() else (HERE/'canary-db.cjs').read_text()
  g.require(sha(code.encode())==self.scope['files']['canary-db.cjs'],'APPROVED_DATABASE_HELPER_REQUIRED')
  if action=='activate':self.not_cancelled();g.validate(self.scope,self.approval,self.now())
  request={'action':action,'scope':self.scope,'scopeHash':g.digest(self.scope),'state':state,'url':env['DATABASE_URL'],'approvalReceivedAt':self.approval['receivedAt']}
  return json.loads(self.run(['docker','exec','-i',self.scope['publicAPIID'],'/nodejs/bin/node','-e',code],input=json.dumps(request),timeout=25))
 def auth(self):
  code="""const {createClerkClient}=require('@clerk/backend');const {createHash}=require('node:crypto');(async()=>{if(process.env.CLERK_INSTANCE_DOMAIN!=='clerk.staging.masarifiratibi.com')throw Error();const x=await createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}).sessions.getSessionList({userId:'user_3K2ItVcURds22ueEf31Py6e305q',status:'active',limit:100});console.log(JSON.stringify({total:x.totalCount,hashes:x.data.filter(s=>s.latestActivity?.isMobile&&s.userId==='user_3K2ItVcURds22ueEf31Py6e305q').map(s=>createHash('sha256').update(s.id).digest('hex'))}));})().catch(()=>{process.exitCode=1;});"""
  value=json.loads(self.run(['docker','exec',self.scope['publicAPIID'],'/nodejs/bin/node','-e',code]))
  g.require(value=={'total':1,'hashes':[self.scope['clerkSessionHash']]},'CURRENT_AUTH_SESSION_CHANGED')
 def preflight(self,scope):
  g.require(socket.gethostname()==g.HOST and os.getuid()==0 and self.scope==scope,'ROOT_STAGING_REQUIRED')
  self.cohort(True);self.candidate();self.route_guard();self.auth()
  g.require(not self.candidate()['State']['Running'] and sha(SITE.read_bytes())==scope['nginxBeforeHash'],'CURRENT_OFF_COHORT_REQUIRED')
  self.pin('/etc/masarifi/worker.env',scope['envHashes']['worker.env']);self.pin('/etc/masarifi/supabase-ca.crt',scope['caHash'])
  for name,digest in scope['files'].items():self.pin(HERE/name,digest)
  g.require(not self.root.exists(),'ATTEMPT_ALREADY_CONSUMED')
  g.require(not self.run(['docker','ps','-a','--filter','name=^/masarifi-canary-worker-'+scope['attempt']+'$','--format','{{.ID}}']),'WRITER_NAME_ALREADY_USED')
  with socket.socket() as probe:probe.bind(('127.0.0.1',3003))
  observed=self.database('baseline');g.require(observed['financial']==scope['baseline'],'FINANCIAL_BASELINE_CHANGED')
  a=observed['admission'];g.require(a['posting'] is False and a['activeEpochs']==0 and a['analysisJobs']==0 and a['assistantJobs']==0 and a['eligible'] and a['currentState'] in [None,'closed'] and a['migrationSelfGrant'] is False,'OFF_IDLE_ELIGIBLE_REQUIRED')
 def claim(self,scope,approval):
  self.root.mkdir(mode=0o700)
  import fcntl
  self.sequence_lock=(self.root/'lifecycle.lock').open('x');(self.root/'lifecycle.lock').chmod(0o600)
  fcntl.flock(self.sequence_lock,fcntl.LOCK_EX)
  for name in scope['files']:
   target=self.root/name;target.write_bytes((HERE/name).read_bytes());target.chmod(0o600)
  self.save('scope.json',scope);self.save('approval.json',approval)
  before=SITE.read_bytes();after=promoted(before)
  g.require(sha(before)==scope['nginxBeforeHash'] and sha(after)==scope['nginxAfterHash'],'EXACT_ROUTE_DIFF_REQUIRED')
  for name,value in [('nginx-before.conf',before),('nginx-after.conf',after)]:
   target=self.root/name;target.write_bytes(value);target.chmod(0o600)
 def prepare(self,scope,approval):
  start=self.now();packet={'version':2,'mode':'canary','project':g.PROJECT,'device':'f66a40694eca','attemptId':scope['attempt'],'sourceSha':g.SOURCE,'imageDigest':g.IMAGE.split('sha256:')[1],'apkHash':g.APK,'controlHash':g.digest(scope),'ownerId':g.OWNER,'clerkSessionHash':scope['clerkSessionHash'],'accountId':g.ACCOUNT,'categoryId':g.CATEGORY,'kind':'expense','maxTransactions':1,'maxPostings':1,'expenseMinor':1000,'maxExpenseMinor':1000,'currency':'SAR','locale':'ar','startsAt':datetime.datetime.fromtimestamp(start,datetime.timezone.utc).isoformat(),'deadline':datetime.datetime.fromtimestamp(start+300,datetime.timezone.utc).isoformat()}
  state={'packet':packet,'startsAt':start,'deadline':start+300,'epochId':None,'manifestHash':None,'workerID':None}
  self.persist(state)
  prepared=self.database('prepare',state);g.require(prepared['state']=='prepared' and g.UUID.fullmatch(prepared['epochId']) and g.HEX.fullmatch(prepared['manifestHash']),'PREPARATION_RECEIPT_REQUIRED')
  state.update(epochId=prepared['epochId'],manifestHash=prepared['manifestHash']);self.persist(state)
  image=json.loads(self.run(['docker','image','inspect',g.IMAGE]))[0]
  payload=worker_payload(self.inspect(scope['workerTemplateID']),scope,state['epochId'],image['Config'].get('Labels'))
  state['workerPayloadHash']=g.digest(payload);self.persist(state)
  identity=self.create_worker(payload);g.require(g.HEX.fullmatch(identity),'CREATED_WRITER_ID_REQUIRED')
  state['workerID']=identity;self.persist(state);self.worker(state);return state
 def create_worker(self,payload):
  class Unix(http.client.HTTPConnection):
   def connect(self):self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(self.timeout);self.sock.connect('/var/run/docker.sock')
  c=Unix('localhost',timeout=15)
  try:
   version=self.run(['docker','version','--format','{{.Server.APIVersion}}']);g.require(__import__('re').fullmatch(r'1\.\d+',version),'ENGINE_VERSION_INVALID')
   c.request('POST','/v'+version+'/containers/create?name=masarifi-canary-worker-'+self.scope['attempt'],json.dumps(payload),{'Content-Type':'application/json'})
   response=c.getresponse();body=response.read(65536)
   if response.status!=201:
    target=self.root/'private-create-rejection.bin';fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(body)
   g.require(response.status==201,'WRITER_CREATE_HTTP_'+str(response.status)+'_BODY_SHA256_'+sha(body));return json.loads(body)['Id']
  finally:c.close()
 def reconcile(self):
  if not (self.root/'runtime.json').exists():return None
  state=self.state()
  # A response lost during epoch preparation is looked up by its exact manifest.
  if state['epochId'] is None:
   found=self.database('reconcile',state)
   if found is None:return None
   g.require(g.UUID.fullmatch(found['epochId']) and g.HEX.fullmatch(found['manifestHash']) and found['state'] in ['prepared','closed'],'PREPARATION_RECONCILIATION_REQUIRED')
   state.update(epochId=found['epochId'],manifestHash=found['manifestHash']);self.persist(state)
  name='masarifi-canary-worker-'+self.scope['attempt']
  if state['workerID'] is None and self.run(['docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}']):
   c=self.inspect(name);g.require(c['Config']['Labels'].get('org.masarifi.scope')=='masarifi-canary-'+self.scope['attempt'] and c['Config']['Labels'].get('org.masarifi.epoch')==state['epochId'],'FOREIGN_WRITER_PRESERVED')
   state['workerID']=c['Id'];self.persist(state)
  return state
 def worker(self,state):
  if state['workerID'] is None:return None
  c=self.inspect(state['workerID']);g.require(c['Name']=='/masarifi-canary-worker-'+self.scope['attempt'],'WRITER_IDENTITY_CHANGED')
  actual=inspected_worker_payload(c)
  g.require(g.digest(actual)==state['workerPayloadHash'],'WRITER_CONFIGURATION_CHANGED');return c
 def unit(self):return 'masarifi-canary-'+self.scope['attempt']+'.service'
 def unit_content(self):
  return '[Unit]\nDescription=Approved bounded Staging Voice canary\nAfter=docker.service\n[Service]\nType=exec\nUser=root\nWorkingDirectory='+str(self.root)+'\nExecStart=/usr/bin/python3 '+str(self.root)+'/canary-host.py monitor\nExecStopPost=/usr/bin/python3 '+str(self.root)+'/canary-host.py close\nRestart=no\nTimeoutStopSec=180\n'
 def monitor_proof(self):
  target=self.root/self.unit();st=target.lstat()
  g.require(stat.S_ISREG(st.st_mode) and st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o600 and target.read_text()==self.unit_content(),'MONITOR_SOURCE_CHANGED')
  linked=pathlib.Path('/etc/systemd/system')/self.unit()
  g.require(linked.is_symlink() and linked.resolve()==target,'MONITOR_LINK_CHANGED')
  fragment=self.run(['systemctl','show',self.unit(),'--property=FragmentPath','--value'])
  g.require(fragment in [str(target),str(linked)] and pathlib.Path(fragment).resolve()==target,'MONITOR_FRAGMENT_CHANGED')
  g.require(not self.run(['systemctl','show',self.unit(),'--property=DropInPaths','--value']),'MONITOR_DROPINS_REJECTED')
  g.require(self.run(['systemctl','is-active',self.unit()])=='active','INDEPENDENT_MONITOR_REQUIRED')
  receipt=json.loads((self.root/'monitor-invocation.json').read_text())
  g.require(receipt['unitHash']==sha(self.unit_content().encode()) and receipt['invocation']==self.run(['systemctl','show',self.unit(),'--property=InvocationID','--value']),'MONITOR_INVOCATION_CHANGED')
 def arm(self,state):
  self.advancing(state)
  unit=self.unit_content()
  target=self.root/self.unit();target.write_text(unit);target.chmod(0o600)
  g.require(self.run(['systemctl','show',self.unit(),'--property=LoadState','--value'])=='not-found','FOREIGN_UNIT_PRESERVED')
  self.run(['systemctl','link',str(target)]);self.run(['systemctl','start',self.unit()])
  invocation=self.run(['systemctl','show',self.unit(),'--property=InvocationID','--value'])
  g.require(__import__('re').fullmatch(r'[a-f0-9]{32}',invocation),'MONITOR_INVOCATION_REQUIRED')
  self.save('monitor-invocation.json',{'invocation':invocation,'unitHash':sha(unit.encode())})
  end=min(self.now()+15,state['startsAt']+90)
  while self.now()<end:
   self.not_cancelled()
   lines=self.run(['journalctl','_SYSTEMD_INVOCATION_ID='+invocation,'--no-pager','-o','cat'])
   if 'CANARY_MONITOR_ARMED' in lines:self.monitor_proof();return
   g.require(self.run(['systemctl','is-active',self.unit()])=='active','MONITOR_NOT_ACTIVE');self.pause(.2)
  raise RuntimeError('MONITOR_NOT_ARMED')
 def wait(self,state,probe,seconds=30):
  end=min(self.now()+seconds,state['deadline'])
  while self.now()<end:
   self.not_cancelled()
   available=False
   try:
    available=probe()
   except (RuntimeError,OSError,ValueError,KeyError):pass
   self.not_cancelled()
   if available:return
   self.pause(.5)
  raise RuntimeError('BOUNDED_READINESS_NOT_CONFIRMED')
 def api_ready(self):
  c=self.candidate()
  if not c['State']['Running'] or c['State'].get('Health',{}).get('Status')!='healthy':return False
  live=self.http('http://127.0.0.1:3003/health/live');ready=self.http('http://127.0.0.1:3003/health/ready')
  return live.get('version')==g.SOURCE and ready.get('status')=='ready'
 def http(self,url):
  return json.loads(self.run(['curl','--noproxy','*','--proto','=https,http','--max-time','5','--fail','--silent','--show-error',url],timeout=7))
 def start_api(self,state):self.advancing(state);self.run(['docker','start',self.scope['financialAPIID']]);self.wait(state,self.api_ready)
 def start_worker_off(self,state):self.advancing(state);self.worker(state);self.run(['docker','start',state['workerID']])
 def runtime(self,state):
  self.worker(state)
  data=self.run(['docker','exec',state['workerID'],'/nodejs/bin/node','-e',"process.stdout.write(require('node:fs').readFileSync('/tmp/staging-voice-health.json','utf8'))"])
  value=json.loads(data);g.require(value['sourceSha']==g.SOURCE and value['epochId']==state['epochId'] and 0<=self.now()*1000-value['observedAt']<=15000,'CURRENT_WORKER_HEARTBEAT_REQUIRED');return value
 def verify_worker_off(self,state):
  self.wait(state,lambda:self.runtime(state).get('enabled') is False,20)
  status=self.database('status',state);g.require(status['posting'] is False and status['state']=='prepared' and status['members']==0 and status['currentEpochMatches'],'OFF_BOOTSTRAP_REQUIRED')
 def stop_analysis(self,state):self.advancing(state);self.cohort(True);self.run(['docker','stop','--time','5',self.scope['analysisID']]);self.cohort(False)
 def replace_route(self,desired,expected):
  self.route_guard();g.require(SITE.read_bytes()==expected,'FOREIGN_ROUTE_PRESERVED')
  temp=SITE.with_name('.masarifi-canary-'+self.scope['attempt']+'.tmp')
  with temp.open('xb') as f:f.write(desired);f.flush();os.fsync(f.fileno())
  temp.chmod(0o644);os.replace(temp,SITE)
  self.run(['nginx','-t']);self.run(['systemctl','reload','nginx'])
 def promote(self,state):
  self.advancing(state);self.cohort(False)
  self.replace_route((self.root/'nginx-after.conf').read_bytes(),(self.root/'nginx-before.conf').read_bytes())
  self.public_ready(True)
 def public_ready(self,financial):
  self.route_guard()
  g.require(sha(SITE.read_bytes())==self.scope['nginxAfterHash' if financial else 'nginxBeforeHash'],'SELECTED_PUBLIC_ROUTE_REQUIRED')
  c=self.candidate() if financial else self.inspect(self.scope['publicAPIID'])
  g.require(c['State']['Running'] and c['State'].get('Health',{}).get('Status')=='healthy','SELECTED_API_LIVE_HEALTH_REQUIRED')
  env=dict(x.split('=',1) for x in c['Config']['Env'])
  g.require(env.get('MASARIFI_VOICE_ANALYSIS_ONLY')==('false' if financial else 'true'),'API_VOICE_MODE_REQUIRED')
  # /health/ready is deliberately private in the qualified ingress configuration.
  live=self.http(PUBLIC+'/health/live');compat=self.http(PUBLIC+'/health/compatibility')
  ready=self.http('http://127.0.0.1:'+('3003' if financial else '3001')+'/health/ready')
  g.require(live.get('version')==g.SOURCE and ready.get('status')=='ready','PUBLIC_READINESS_REQUIRED')
  expected={'voiceSession':2,'voiceBatch':3,'voiceExtraction':3,'voiceWorker':1,'voiceConfirmation':2,'assistantDirect':2,'assistantProvider':1,'manualReceipt':1}
  g.require(compat.get('schemaVersion')==1 and compat.get('contracts')==expected,'PUBLIC_CONTRACTS_REQUIRED')
 def activate(self,state):
  self.advancing(state);self.auth();self.cohort(False);self.public_ready(True);self.monitor_proof()
  g.require(self.now()<state['startsAt']+90,'FIXED_ARMING_WINDOW_EXPIRED')
  self.not_cancelled();g.validate(self.scope,self.approval,self.now())
  state['activationRequestedAt']=self.now();self.persist(state)
  result=self.database('activate',state);self.save('activation-receipt.json',result)
 def ready(self,state):
  self.not_cancelled()
  self.wait(state,lambda:self.runtime(state).get('enabled') is True,20)
  self.run(['docker','exec',state['workerID'],'/nodejs/bin/node','dist/src/staging-voice-healthcheck.js'])
  self.public_ready(True)
 def save_ready(self,state):
  self.not_cancelled()
  status=self.database('status',state)
  g.require(status['currentEpochMatches'] and status['state']=='active' and status['posting'] is True and status['committed']==0,'LIVE_UNCOMMITTED_CANARY_REQUIRED')
  self.not_cancelled();self.save('ready.json',{'status':'AUTHORIZED_SINGLE_FRESH_10_SAR_WINDOW_READY','deadline':state['deadline'],'epochId':state['epochId'],'workerID':state['workerID']})
 def snapshot(self,state):
  synchronize_runtime(state,self.state())
  self.guard(state);value=self.database('status',state)
  value['scopeValid']=value['currentEpochMatches'] and value['members']<=1 and (value['deadline'] is None or abs(datetime.datetime.fromisoformat(value['deadline']).timestamp()-state['deadline'])<.001)
  value['apiReady']=False;value['workerHealthy']=False
  if value['state']=='active' and value['committed']==0:
   try:self.qualified();self.monitor_proof();self.cohort(False);self.route_guard();self.public_ready(True);value['apiReady']=self.api_ready();value['workerHealthy']=self.runtime(state).get('enabled') is True
   except (RuntimeError,OSError,ValueError,KeyError):pass
  return value
 def close_epoch(self,state):
  receipt=self.database('close',state);g.require(receipt['currentEpochMatches'],'FOREIGN_EPOCH_PRESERVED');return receipt
 def stop_worker(self,state):
  self.guard(state);c=self.worker(state)
  if c is not None and c['State']['Running']:self.run(['docker','stop','--time','5',c['Id']])
  if c is not None:g.require(not self.worker(state)['State']['Running'],'WRITER_STOP_UNCONFIRMED')
 def restore_route(self,state):
  self.guard(state);self.route_guard();before=(self.root/'nginx-before.conf').read_bytes();after=(self.root/'nginx-after.conf').read_bytes()
  g.require(sha(before)==self.scope['nginxBeforeHash'] and sha(after)==self.scope['nginxAfterHash'] and promoted(before)==after,'ROLLBACK_ROUTE_PINS_REQUIRED')
  if SITE.read_bytes()==after:self.replace_route(before,after)
  else:self.run(['nginx','-t']);self.run(['systemctl','reload','nginx'])
 def stop_api(self,state):
  self.guard(state);c=self.candidate()
  if c['State']['Running']:self.run(['docker','stop','--time','5',c['Id']])
  g.require(not self.candidate()['State']['Running'],'API_STOP_UNCONFIRMED')
 def restore_analysis(self,state):
  self.guard(state)
  c=self.inspect(self.scope['analysisID']);g.require(configuration(c)==self.scope['analysisConfigurationHash'],'ANALYSIS_IDENTITY_CHANGED')
  if not c['State']['Running']:self.run(['docker','start',self.scope['analysisID']])
  self.cohort(True)
 def verify_restored(self,state):
  self.guard(state);self.cohort(True);self.public_ready(False)
  g.require(sha(SITE.read_bytes())==self.scope['nginxBeforeHash'],'PUBLIC_ROUTE_NOT_RESTORED')
  self.save('financial-verification-'+str(time.time_ns())+'.json',self.database('verify',state))
 def save_closure(self,receipt):self.save('closure-'+str(time.time_ns())+'.json',receipt)

def main():
 action=sys.argv[1];root=HERE
 if action=='begin':
  scope=json.loads((root/'scope.json').read_text());approval=json.loads((root/'approval.json').read_text())
  host=LocalHost('/opt/masarifi/masarifi-canary-'+scope['attempt'],scope,approval)
  try:
   result=g.begin(scope,approval,host);print(json.dumps({'status':'AUTHORIZED_SINGLE_FRESH_10_SAR_WINDOW_READY','deadline':result['deadline'],'epochId':result['epochId']}),flush=True)
  finally:host.release_sequence()
 else:
  g.require(action in ['monitor','close'],'CANARY_MODE_REQUIRED')
  scope=json.loads((root/'scope.json').read_text());approval=json.loads((root/'approval.json').read_text());host=LocalHost(root,scope,approval);state=host.state();host.guard(state)
  if action=='monitor':
   host.qualified()
   host.database('status',state);print('CANARY_MONITOR_ARMED',flush=True);print(json.dumps({'closedReason':g.monitor(state,host)}),flush=True)
  else:
   receipt=g.close(state,host);print(json.dumps(receipt),flush=True);g.require(receipt['restored'] and not receipt['blockers'],'CLOSURE_UNCONFIRMED')

if __name__=='__main__':main()

