"""One approved posting-OFF migration; preparation provides no authority."""
import hashlib,json,re
HOST='srv2006836'
PROJECT='qcffvfbpzvpwcwxwjyro'
SOURCE='d8dc50a5bf8e568619cbfcf2a3fbcaa6fdf403c2'
IMAGE='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:48b5ef586204e781e6adf65fa9dc0d3bfcce6cf4a0303f803a9f99e937ff008f'
SQL='ed4fafabac38162a475a70631bff268ddaccd26ef55884f234692a6aea6df8b8'
VERSION='20261013053237'
HEX=re.compile(r'^[a-f0-9]{64}$')
def require(ok,reason):
 if not ok:raise RuntimeError(reason)
def digest(value):
 return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()
def validate(scope,approval,now):
 for key,value in [('host',HOST),('project',PROJECT),('source',SOURCE),('image',IMAGE),('sqlHash',SQL),('version',VERSION),('budgetSeconds',300)]:
  require(type(scope.get(key)) is type(value) and scope[key]==value,'EXACT_DIAGNOSTIC_SCOPE_REQUIRED')
 require(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',scope.get('attempt','')),'ATTEMPT_REQUIRED')
 require(set(scope.get('files',{}))=={'diagnostic-control.py','diagnostic-host.py','diagnostic-migration.cjs','diagnostic-executor.py'} and all(HEX.fullmatch(h) for h in scope['files'].values()),'CONTROL_PINS_REQUIRED')
 require(scope['endpoint']['port']=='5432' and HEX.fullmatch(scope['endpoint']['usernameHash']),'SESSION_ENDPOINT_REQUIRED')
 require(scope['packet']['sqlHash']==SQL and scope['packet']['version']==VERSION,'EXACT_MIGRATION_REQUIRED')
 require(scope['packet']['name']=='voice_scope_rejection_diagnostics' and scope['packet']['acceptanceBodyHash']=='683de0fd60086962c86b256983b5feadd00f4c300166a82bfc782250de29ebec' and scope['packet']['helperBodyHash']=='ce00e1b5da381a8baa4ac95f3e6882bb73dbccf107ff8007577e9c5410c1696b','EXACT_FUNCTION_BODIES_REQUIRED')
 require(scope['endpoint']=={'hostname':'aws-0-eu-central-1.pooler.supabase.com','port':'5432','usernameHash':'60c9bd607b7b11c44f91049ef22b5811b92ec8938ae8edcca2fc7002f54b4939','database':'/postgres'},'EXACT_STAGING_SESSION_ENDPOINT_REQUIRED')
 require(hashlib.sha256(scope['packet']['sql'].encode()).hexdigest()==SQL,'EXACT_SQL_BYTES_REQUIRED')
 require(scope['baseline']['database']==scope['packet']['expected'],'EXACT_BASELINE_REQUIRED')
 db=scope['baseline']['database']
 require(db['posting'] is False and db['activeEpochs']==0 and db['analysisJobs']==0 and db['assistantJobs']==0 and db['helper'] is None and VERSION not in db['migrations'],'POSTING_OFF_IDLE_UNMIGRATED_REQUIRED')
 require(approval and approval.get('kind')=='direct-human-staging-diagnostic-approval' and approval.get('scopeHash')==digest(scope),'DIRECT_DEPLOYMENT_APPROVAL_REQUIRED')
 require(isinstance(approval.get('verbatim'),str) and 8<=len(approval['verbatim'].strip())<=4096 and isinstance(approval.get('messageReference'),str) and 8<=len(approval['messageReference'])<=256,'HUMAN_EVIDENCE_REQUIRED')
 require(type(approval.get('receivedAt')) in (int,float) and approval['receivedAt']<=now and now-approval['receivedAt']<=3600,'APPROVAL_EXPIRED')
 require(type(scope.get('expiresAt')) in (int,float) and now<scope['expiresAt'] and scope['expiresAt']<=1791882000,'SCOPE_EXPIRED')
def execute(scope,approval,host):
 validate(scope,approval,host.now())
 host.preflight(scope)
 # The exclusive receipt consumes approval before the first host mutation.
 host.claim(scope,approval)
 applied=False
 try:
  validate(scope,approval,host.now())
  host.pull(scope)
  validate(scope,approval,host.now())
  applied=True
  host.apply_once(scope)
  report=host.verify(scope)
  host.receipt('VERIFIED',report)
  return report
 except BaseException:
  # Never rerun the installer or claim that an uncertain COMMIT was rolled back.
  try:
   report=host.reconcile(scope)
   host.receipt('COMMITTED_VERIFIED' if report['migrationVerified'] else 'NOT_COMMITTED_VERIFIED',report)
  except BaseException:
   host.receipt('INSTALLATION_UNCONFIRMED' if applied else 'STAGING_PRESERVATION_UNCONFIRMED',{'retryAllowed':False})
  raise
