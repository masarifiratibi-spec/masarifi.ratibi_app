"""Disposable Engine create/start/stop with inert sleep only; no app or credentials."""
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
# Retain the full production adapter/HostConfig. Replace only fixture process fields.
payload['Entrypoint']=['/bin/sleep'];payload['Cmd']=['60'];payload['WorkingDir']='/'
payload['Healthcheck']['Test']=['CMD','/bin/true']
network='masarifi-staging_backend';report={'status':'FAILED','applicationStarted':False,'inertProcessStarted':False,'stagingAccess':False,'engine':json.loads(run('docker','version','--format','{{json .Server}}')),'fixtureProcessOverrides':{'Entrypoint':['/bin/sleep'],'Cmd':['60'],'WorkingDir':'/','Healthcheck.Test':['CMD','/bin/true']},'phases':[]}
output=pathlib.Path(os.environ['RUNNER_TEMP'])/'worker-create-report.json'
run('docker','network','create','--internal',network)
try:
 with tempfile.TemporaryDirectory(prefix='canary-create-only-') as temporary:
  host=h.LocalHost(temporary,scope,None);identity=host.create_worker(payload);scope['workerTemplateID']=identity
  state={'workerID':identity,'workerPayloadHash':h.g.digest(payload)}
  inspected=host.inspect(identity);actual=h.inspected_worker_payload(inspected)
  report['normalizationDifferences']={key:{'requested':payload.get(key),'inspected':actual.get(key)} for key in sorted(set(payload)|set(actual)) if payload.get(key)!=actual.get(key)}
  for phase in ['created','running','stopped','running-again','stopped-final']:
   if phase in ['running','running-again']:run('docker','start',identity);report['inertProcessStarted']=True
   if phase in ['stopped','stopped-final']:
    # Original production stop_worker method, with only fixture provenance bypassed.
    host.guard=lambda _:None;host.stop_worker(state)
   container=host.worker(state);expected_running=phase in ['running','running-again']
   if container['State']['Running'] is not expected_running:raise RuntimeError('EXACT_INERT_PHASE_REQUIRED')
   raw={**copy.deepcopy(container['Config']),'HostConfig':copy.deepcopy(container['HostConfig'])};raw['Hostname']=''
   changed=[key for key in sorted(set(payload)|set(raw)) if payload.get(key)!=raw.get(key)]
   if changed not in [[],['HostConfig']]:raise RuntimeError('UNEXPECTED_RUNTIME_NORMALIZATION')
   report['phases'].append({'phase':phase,'running':expected_running,'rawPayloadMatches':raw==payload,'rawOomKillDisable':container['HostConfig']['OomKillDisable'],'normalizedPayloadMatches':h.inspected_worker_payload(container)==payload,'productionWorkerProof':True})
  # Prove the preserved pre-fix digest would reject the observed startup difference.
  report['oldGuardRejectsRuntimeNull']=any(p['rawOomKillDisable'] is None and not p['rawPayloadMatches'] for p in report['phases'][1:])
  if not report['oldGuardRejectsRuntimeNull']:raise RuntimeError('STARTUP_NORMALIZATION_NOT_REPRODUCED')
  report.update(status='PASS',exactPayloadMatchesInspection=True,engineHostname=container['Config']['Hostname'],productionStopMethodQualified=True)
finally:
 ids=run('docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}')
 if ids:
  c=json.loads(run('docker','inspect',name))[0]
  if c['Name']!='/'+name or c['Config']['Labels'].get('org.masarifi.scope')!='masarifi-canary-'+attempt:raise RuntimeError('OWNED_FIXTURE_REQUIRED')
  if c['State']['Running']:run('docker','stop','--time','5',name)
  if json.loads(run('docker','inspect',name))[0]['State']['Running']:raise RuntimeError('OWNED_STOPPED_REQUIRED')
  run('docker','rm',name)
 run('docker','network','rm',network);report['cleanupVerified']=not run('docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}')
 output.write_text(json.dumps(report,indent=2))
print(json.dumps(report))

