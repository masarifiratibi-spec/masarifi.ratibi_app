"""Strict Staging host adapter. No container, route, policy or record mutations."""
import hashlib,json,os,pathlib,socket,stat,subprocess,time,urllib.parse
import diagnostic_control as g
API='1ad4dd895f112bcd16e3aa5075acfaaf96fc88f70fabbf3e9c1bc3c183c01417'
API_SOURCE='093b5d0c42f3d68eb2de619aff94b44fbf088a02'
NODE='/nodejs/bin/node'
class Host:
 def __init__(self,node):
  self.node=node;self.deadline=time.monotonic()+300;self.directory=None;self.scope=None;self.reconciled=False
 def now(self):return time.time()
 def run(self,args,input=None,limit=30):
  remaining=self.deadline-time.monotonic()
  g.require(remaining>0,'SHARED_COMMAND_BUDGET_EXHAUSTED')
  result=subprocess.run(args,input=input,capture_output=True,text=True,timeout=min(limit,remaining))
  g.require(result.returncode==0,'BOUNDED_COMMAND_FAILED')
  return result.stdout.strip()
 def environment(self):
  env={}
  for line in pathlib.Path('/etc/masarifi/migration.env').read_text().splitlines():
   if '=' in line and not line.lstrip().startswith('#'):
    key,value=line.split('=',1);env[key]=value.strip().strip('"').strip("'")
  return env
 def endpoint(self):
  url=urllib.parse.urlsplit(self.environment()['DATABASE_URL'])
  return {'hostname':url.hostname,'port':str(url.port or 5432),'usernameHash':hashlib.sha256(urllib.parse.unquote(url.username).encode()).hexdigest(),'database':url.path}
 def database(self,action='read',scope=None):
  request={'action':action,'url':self.environment()['DATABASE_URL']}
  if scope:request.update(packet=scope['packet'],endpoint=scope['endpoint'])
  # The credential is private child stdin, never a shell argument, file or output.
  return json.loads(self.run(['docker','exec','-i',API,NODE,'-e',self.node+'\nrunCLI();'],json.dumps(request),50))
 def collect(self):
  g.require(socket.gethostname()==g.HOST and os.geteuid()==0,'EXACT_ROOT_STAGING_HOST_REQUIRED')
  containers=[]
  for identity in sorted(self.run(['docker','ps','-aq','--no-trunc']).splitlines()):
   c=json.loads(self.run(['docker','inspect',identity]))[0]
   containers.append({'id':c['Id'],'configurationHash':hashlib.sha256(json.dumps({k:c[k] for k in ('Config','HostConfig','Mounts')},sort_keys=True).encode()).hexdigest(),'running':c['State']['Running'],'health':c['State'].get('Health',{}).get('Status')})
  includes=[]
  for line in self.run(['nginx','-T']).splitlines():
   if line.startswith('# configuration file '):
    name=line[len('# configuration file '):].rstrip(':');p=pathlib.Path(name)
    includes.append({'path':name,'resolved':str(p.resolve()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
  authcode="const {createClerkClient}=require('@clerk/backend');const{createHash}=require('node:crypto');(async()=>{if(process.env.CLERK_INSTANCE_DOMAIN!=='clerk.staging.masarifiratibi.com')throw Error();const x=await createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}).sessions.getSessionList({userId:'user_3K2ItVcURds22ueEf31Py6e305q',status:'active',limit:100});console.log(JSON.stringify({total:x.totalCount,hashes:x.data.filter(s=>s.latestActivity?.isMobile&&s.userId==='user_3K2ItVcURds22ueEf31Py6e305q').map(s=>createHash('sha256').update(s.id).digest('hex')).sort()}));})().catch(()=>{process.exitCode=1;});"
  auth=json.loads(self.run(['docker','exec',API,NODE,'-e',authcode]))
  health={}
  for name,url in [('live','https://api.staging.masarifiratibi.com/health/live'),('compatibility','https://api.staging.masarifiratibi.com/health/compatibility'),('ready','http://127.0.0.1:3001/health/ready')]:
   health[name]=json.loads(self.run(['curl','--silent','--show-error','--fail','--max-time','10',url]))
  g.require(health['live'].get('version')==API_SOURCE and health['ready'].get('status')=='ready','EXISTING_API_READINESS_REQUIRED')
  contracts={'voiceSession':2,'voiceBatch':3,'voiceExtraction':3,'voiceWorker':1,'voiceConfirmation':2,'assistantDirect':2,'assistantProvider':1,'manualReceipt':1}
  g.require(health['compatibility'].get('schemaVersion')==1 and health['compatibility'].get('contracts')==contracts,'EXISTING_API_CONTRACTS_REQUIRED')
  # Health timestamps and counters are volatile; bind actual release/readiness, not timestamps.
  return {'containers':containers,'nginxIncludes':includes,'auth':auth,
   'health':{'release':health['live']['version'],'ready':health['ready']['status'],'contracts':contracts},
   'envHashes':{n:hashlib.sha256(pathlib.Path('/etc/masarifi',n).read_bytes()).hexdigest() for n in ['worker.env','migration.env']},
   'caHash':hashlib.sha256(pathlib.Path('/etc/masarifi/supabase-ca.crt').read_bytes()).hexdigest(),
   'endpoint':self.endpoint(),'database':self.database()}
 def preflight(self,scope):
  g.require(self.collect()==scope['baseline'],'EXACT_HOST_AUTH_DATA_BASELINE_REQUIRED')
  g.require(self.endpoint()==scope['endpoint'],'EXACT_SESSION_ENDPOINT_REQUIRED')
 def claim(self,scope,approval):
  g.validate(scope,approval,self.now())
  self.scope=scope
  base=pathlib.Path('/opt/masarifi');info=base.lstat()
  g.require(not base.is_symlink() and stat.S_ISDIR(info.st_mode) and info.st_uid==0 and base.resolve()==base,'PRIVATE_OWNED_PARENT_REQUIRED')
  directory=base/('voice-diagnostic-'+scope['attempt'])
  os.mkdir(directory,0o700);self.directory=directory
  self.receipt('APPROVAL_CONSUMED',{'scopeHash':g.digest(scope),'approval':approval})
 def receipt(self,status,detail):
  if self.directory is None:return
  name=self.directory/(status+'.json')
  fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as stream:
   json.dump({'status':status,'observedAt':self.now(),'detail':detail},stream);stream.flush();os.fsync(stream.fileno())
 def pull(self,scope):
  self.run(['docker','pull',g.IMAGE],limit=120)
  image=json.loads(self.run(['docker','image','inspect',g.IMAGE]))[0]
  g.require(g.IMAGE in image['RepoDigests'] and image['Config']['Labels'].get('org.opencontainers.image.revision')==g.SOURCE,'EXACT_QUALIFIED_IMAGE_REQUIRED')
  # Fresh preservation and policy check after pulling, before any database DDL.
  self.preflight(scope)
 def apply_once(self,scope):self.database('apply',scope)
 def verify(self,scope):
  self.database('verify',scope)
  current=self.collect();expected={**scope['baseline'],'database':current['database']}
  g.require(current==expected,'HOST_AUTH_ROUTE_PRESERVATION_REQUIRED')
  g.require(current['database']['protected']==scope['baseline']['database']['protected'],'ALL_PROTECTED_ROWS_PRESERVED')
  return {'migrationVerified':True,'posting':False,'activeEpochs':0,'protectedTableCount':16,'hostAuthRoutesPreserved':True,'retryAllowed':False}
 def reconcile(self,scope):
  # One fresh read determines commit state; never replays DDL or changes any records.
  g.require(not self.reconciled,'ONE_RECONCILIATION_ONLY');self.reconciled=True
  self.deadline+=60
  current=self.collect()
  if g.VERSION in current['database']['migrations']:return self.verify(scope)
  g.require(current==scope['baseline'],'FAILED_ATTEMPT_PRESERVATION_UNCONFIRMED')
  return {'migrationVerified':False,'posting':False,'protectedTableCount':16,'hostAuthRoutesPreserved':True,'retryAllowed':False}
