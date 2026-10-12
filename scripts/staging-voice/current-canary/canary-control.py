"""Bounded fresh-capture canary. Preparation never constitutes human approval."""
import hashlib,json,re

HOST='srv2006836'
PROJECT='qcffvfbpzvpwcwxwjyro'
SOURCE='093b5d0c42f3d68eb2de619aff94b44fbf088a02'
IMAGE='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:8ee5100f2f9de7b5930867eb7cf901c94344452ba8a3ed62954223bbc8fb2bab'
APK='dd965f39fda4b51f072712e6b47f13965131269c0b43b68111a198a5fd60e222'
OWNER='user_3K2ItVcURds22ueEf31Py6e305q'
ACCOUNT='3161601e-1584-40b0-86ec-d170c018b551'
CATEGORY='04000000-0000-4000-8000-000000000006'
HEX=re.compile(r'^[a-f0-9]{64}$')
UUID=re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')

def require(condition,code):
 if not condition:raise RuntimeError(code)

def digest(value):
 return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def validate(scope,approval,now,activation=True):
 for key,value in [('host',HOST),('project',PROJECT),('source',SOURCE),('image',IMAGE),('apkHash',APK),('ownerId',OWNER),('accountId',ACCOUNT),('categoryId',CATEGORY)]:
  require(scope.get(key)==value,'EXACT_STAGING_CANARY_REQUIRED')
 for key,value in [('amountMinor',1000),('maxTransactions',1),('maxPostings',1),('currency','SAR'),('locale','ar'),('durationSeconds',300),('armingSeconds',90)]:
  require(type(scope.get(key)) is type(value) and scope[key]==value,'BOUNDED_FINANCIAL_LIMITS_REQUIRED')
 require(UUID.fullmatch(scope.get('attempt','')),'ATTEMPT_REQUIRED')
 for key in ['clerkSessionHash','financialAPIID','financialAPIConfigurationHash','publicAPIID','publicAPIConfigurationHash','workerTemplateID','workerTemplateConfigurationHash','analysisID','analysisConfigurationHash','nginxBeforeHash','nginxAfterHash','backupHash','backupRestoreHash','offReadinessProofHash','caHash']:
  require(HEX.fullmatch(scope.get(key,'')),'EXACT_PINS_REQUIRED')
 require(set(scope['files'])=={'canary-control.py','canary-host.py','canary-db.cjs'} and all(HEX.fullmatch(x) for x in scope['files'].values()),'CONTROL_PINS_REQUIRED')
 require(set(scope['envHashes'])=={'worker.env','migration.env'} and all(HEX.fullmatch(x) for x in scope['envHashes'].values()),'ENVIRONMENT_PINS_REQUIRED')
 require(type(scope.get('expiresAt')) in (int,float) and scope['expiresAt']>0,'SCOPE_EXPIRY_REQUIRED')
 require(approval and approval.get('kind')=='direct-human-financial-canary-approval' and approval.get('scopeHash')==digest(scope),'DIRECT_FINANCIAL_APPROVAL_REQUIRED')
 require(isinstance(approval.get('verbatim'),str) and 8<=len(approval['verbatim'].strip())<=4096 and isinstance(approval.get('messageReference'),str) and 8<=len(approval['messageReference'])<=256,'HUMAN_EVIDENCE_REQUIRED')
 require(type(approval.get('receivedAt')) in (int,float) and approval['receivedAt']<=now,'APPROVAL_FUTURE')
 if activation:require(now<scope['expiresAt'] and now-approval['receivedAt']<=3600,'ACTIVATION_AUTHORITY_EXPIRED')

def begin(scope,approval,host):
 validate(scope,approval,host.now())
 host.preflight(scope)
 host.claim(scope,approval)
 state=None
 try:
  state=host.prepare(scope,approval)
  host.arm(state)
  host.start_api(state)
  host.start_worker_off(state)
  host.verify_worker_off(state)
  host.stop_analysis(state)
  host.promote(state)
  host.activate(state)
  host.ready(state)
  host.save_ready(state)
  return state
 except BaseException:
  if state is None:state=host.reconcile()
  if state is not None:
   receipt=close(state,host)
   require(receipt['restored'] and not receipt['blockers'],'FAILED_BEGIN_CLOSURE_UNCONFIRMED')
  raise

def close(state,host,reason='closure_requested'):
 host.request_close(reason)
 with host.closure_lock():return close_owned(state,host)

def close_owned(state,host):
 state=host.state() if hasattr(host,'state') and callable(host.state) else state
 host.guard(state)
 report={'postingOff':False,'workerStopped':False,'restored':False,'blockers':[]}
 try:
  receipt=host.close_epoch(state)
  require(receipt.get('state')=='closed' and receipt.get('posting') is False,'OFF_UNCONFIRMED')
  report['postingOff']=True
 except (RuntimeError,OSError,ValueError,KeyError):report['blockers'].append('OFF_UNCONFIRMED')
 try:
  host.stop_worker(state);report['workerStopped']=True
 except (RuntimeError,OSError,ValueError,KeyError):report['blockers'].append('WRITER_STOP_UNCONFIRMED')
 if report['postingOff'] and report['workerStopped']:
  try:
   host.restore_route(state);host.stop_api(state);host.restore_analysis(state);host.verify_restored(state)
   report['restored']=True
  except (RuntimeError,OSError,ValueError,KeyError):report['blockers'].append('RESTORATION_UNCONFIRMED')
 if hasattr(host,'save_closure'):host.save_closure(report)
 return report

def monitor(state,host):
 failures=0
 while True:
  now=host.now();reason=None
  if now>=state['deadline']:reason='deadline'
  else:
   try:snapshot=host.snapshot(state)
   except (RuntimeError,OSError,ValueError,KeyError):snapshot={'scopeValid':False}
   if not snapshot.get('scopeValid') or snapshot.get('committed',0) not in (0,1):reason='scope_failure'
   elif snapshot.get('state')=='closed' or snapshot.get('committed')==1:reason='completed'
   elif snapshot.get('state')=='prepared':
    if snapshot.get('posting') is not False:reason='scope_failure'
    elif now>=state['startsAt']+90:reason='arming_timeout'
   elif snapshot.get('state')!='active' or snapshot.get('posting') is not True:reason='scope_failure'
   else:
    failures=0 if snapshot.get('apiReady') and snapshot.get('workerHealthy') else failures+1
    if failures>=3 and now>=state.get('activationRequestedAt',state['startsAt'])+15:reason='runtime_unhealthy'
  if reason:
   receipt=close(state,host,reason)
   require(receipt['restored'] and not receipt['blockers'],'WATCHDOG_CLOSURE_UNCONFIRMED')
   return reason
  host.pause(2)
