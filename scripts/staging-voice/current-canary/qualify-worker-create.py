"""Disposable exact Engine create+inspect only; no application start or credentials."""
import copy,http.client,importlib.util,json,os,pathlib,socket,subprocess,sys,tempfile,uuid
P=pathlib.Path(__file__).parent
sp=importlib.util.spec_from_file_location('host',P/'canary-host.py');h=importlib.util.module_from_spec(sp);sp.loader.exec_module(h)
def run(*args):return subprocess.check_output(args,text=True,timeout=60).strip()
if not(os.geteuid()==0 and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_REPOSITORY')=='masarifiratibi-spec/masarifi.ratibi_app' and socket.gethostname()!='srv2006836'):raise RuntimeError('DISPOSABLE_CI_ONLY')
template=json.loads((P/'scrubbed-worker-template.json').read_text())
if not all(x.split('=',1)[1]=='INERT_FIXTURE' for x in template['Config']['Env']):raise RuntimeError('INERT_ENV_REQUIRED')
run('docker','pull','busybox:1.37.0');image=json.loads(run('docker','image','inspect','busybox:1.37.0'))[0]
h.g.IMAGE=image['Id'];template['Config']['Env']=[x for x in template['Config']['Env'] if not x.startswith('SUPABASE_URL=')]+['SUPABASE_URL=https://'+h.g.PROJECT+'.supabase.co']
attempt=str(uuid.uuid4());name='masarifi-canary-worker-'+attempt
scope={'attempt':attempt,'workerTemplateID':template['Id'],'workerTemplateConfigurationHash':h.configuration(template)}
payload=h.worker_payload(template,scope,str(uuid.uuid4()),image['Config'].get('Labels'))
network='masarifi-staging_backend';report={'status':'FAILED','applicationStarted':False,'stagingAccess':False,'engine':json.loads(run('docker','version','--format','{{json .Server}}'))}
output=pathlib.Path(os.environ['RUNNER_TEMP'])/'worker-create-report.json'
run('docker','network','create','--internal',network)
try:
 with tempfile.TemporaryDirectory(prefix='canary-create-only-') as temporary:
  host=h.LocalHost(temporary,scope,None);identity=host.create_worker(payload);scope['workerTemplateID']=identity
  state={'workerID':identity,'workerPayloadHash':h.g.digest(payload)}
  inspected=host.inspect(identity);actual={**copy.deepcopy(inspected['Config']),'HostConfig':copy.deepcopy(inspected['HostConfig'])};actual['Hostname']=''
  report['normalizationDifferences']={key:{'requested':payload.get(key),'inspected':actual.get(key)} for key in sorted(set(payload)|set(actual)) if payload.get(key)!=actual.get(key)}
  container=host.worker(state)
  if container['State']['Running']:raise RuntimeError('INERT_FIXTURE_STARTED')
  report.update(status='PASS',exactPayloadMatchesInspection=True,engineHostname=container['Config']['Hostname'])
finally:
 ids=run('docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}')
 if ids:
  c=json.loads(run('docker','inspect',name))[0]
  if c['State']['Running'] or c['Name']!='/'+name:raise RuntimeError('OWNED_STOPPED_REQUIRED')
  run('docker','rm',name)
 run('docker','network','rm',network);report['cleanupVerified']=not run('docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}')
 output.write_text(json.dumps(report,indent=2))
print(json.dumps(report))
