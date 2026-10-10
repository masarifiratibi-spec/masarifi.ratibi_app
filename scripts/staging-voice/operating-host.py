import sys,json,pathlib,subprocess,hashlib,os,time,urllib.request,datetime

ROOT=pathlib.Path(__file__).resolve().parent
PACKET=json.loads((ROOT/'packet.json').read_text())
SHA=PACKET['sourceSha']; DIGEST=PACKET['imageDigest']
IMAGE='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:'+DIGEST
RELEASE='/opt/masarifi/releases/'+SHA
SCOPE='dev-voice-operating-'+PACKET['attemptId']
UNIT='masarifi-'+SCOPE+'-monitor.service'
WORKER='masarifi-staging-voice-epoch-1'
BASE=['docker','compose','--env-file','/etc/masarifi/compose.env']
for name in ['compose.backend.yml','release-version.yml','voice-runtime.yml','voice-analysis.yml']:
 BASE+=['-f',RELEASE+'/docker/staging/'+name]
ENV=dict(os.environ,MASARIFI_BACKEND_REPOSITORY='ghcr.io/masarifiratibi-spec/masarifi-backend',MASARIFI_BACKEND_DIGEST=DIGEST,MASARIFI_RELEASE_VERSION=SHA)

def run(args,timeout=60):
 x=subprocess.run(args,capture_output=True,text=True,env=ENV,timeout=timeout)
 if x.returncode:
  raise RuntimeError('CONTROL_COMMAND_FAILED:'+args[0]+':'+str(x.returncode))
 return x.stdout.strip()

def inspect(name):
 return json.loads(run(['docker','inspect',name]))[0]

def target():
 assert os.getuid()==0 and str(ROOT)=='/opt/masarifi/'+SCOPE
 assert PACKET['project']=='qcffvfbpzvpwcwxwjyro' and PACKET['mode']=='operating'

def pins():
 target()
 # The packet pins the owned Voice runtime, not the shared API release pointer.
 # A separately validated compatible API deployment may advance that pointer.
 for name,value in PACKET['envHashes'].items():
  assert hashlib.sha256(pathlib.Path('/etc/masarifi/'+name).read_bytes()).hexdigest()==value,'ENV_PIN_CHANGED'
 for name,value in PACKET['files'].items():
  assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==value,'CONTROL_PIN_CHANGED'
 for name,value in PACKET['composeHashes'].items():
  assert hashlib.sha256(pathlib.Path(RELEASE+'/docker/staging/'+name).read_bytes()).hexdigest()==value,'COMPOSE_PIN_CHANGED'
 assert inspect('masarifi-staging-worker-1')['State']['Running']==False

def epoch():
 e=json.loads((ROOT/'epoch.json').read_text())
 assert len(e['epochId'])==36 and e['manifestHash']==PACKET['epochManifestHash']
 return e

def db_close():
 target()
 assert hashlib.sha256(pathlib.Path('/etc/masarifi/migration.env').read_bytes()).hexdigest()==PACKET['envHashes']['migration.env']
 assert hashlib.sha256((ROOT/'close-epoch.cjs').read_bytes()).hexdigest()==PACKET['files']['close-epoch.cjs']
 result=json.loads(run(['docker','run','--rm','--network','masarifi-staging_backend','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit','128','--memory','512m','--env-file','/etc/masarifi/migration.env','-e','MASARIFI_PROCESS_KIND=migration','-e','MASARIFI_RELEASE_VERSION='+SHA,'-v','/etc/masarifi/supabase-ca.crt:/etc/ssl/certs/masarifi-database-ca.crt:ro','-v',str(ROOT)+':/control:ro',IMAGE,'/control/close-epoch.cjs']))
 assert result['posting']==False and result['state']=='closed'
 return result

def stop_checked(name,service=None,scope=None,expected_id=None):
 if scope:
  present=run(['docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.Names}}'])
  if not present: return
 c=inspect(name)
 if expected_id is not None and c['Id']!=expected_id: return
 assert c['HostConfig']['NetworkMode']=='masarifi-staging_backend'
 if service:
  assert c['Config']['Labels']['com.docker.compose.project']=='masarifi-staging'
  assert c['Config']['Labels']['com.docker.compose.service']==service
 if scope: assert c['Config']['Labels'].get('org.masarifi.scope')==scope
 # Stop the inspected identity, never a name that could have been replaced.
 if c['State']['Running']: run(['docker','stop','--time','5',c['Id']],20)

def health(financial,worker=False):
 pins()
 api=inspect('masarifi-staging-api-1')
 assert api['State']['Running']
 assert api['State']['Health']['Status']=='healthy'
 values=dict(v.split('=',1) for v in api['Config']['Env'])
 assert values['MASARIFI_VOICE_ANALYSIS_ONLY']==('false' if financial else 'true')
 assert values['SUPABASE_URL']=='https://qcffvfbpzvpwcwxwjyro.supabase.co'
 assert inspect('masarifi-staging-analysis-worker-1')['State']['Running']==(not financial)
 with urllib.request.urlopen('http://127.0.0.1:3000/health/live',timeout=5) as response: live=json.load(response)
 with urllib.request.urlopen('http://127.0.0.1:3000/health/ready',timeout=5) as response: ready=json.load(response)
 assert ready['status']=='ready'
 assert live['version']==values.get('MASARIFI_RELEASE_VERSION'),'API_VERSION_UNCONFIRMED'
 with urllib.request.urlopen('http://127.0.0.1:3000/health/compatibility',timeout=5) as response: compatibility=json.load(response)
 expected=PACKET.get('apiContracts')
 assert isinstance(expected,dict) and expected,'API_COMPATIBILITY_EXPECTATIONS_REQUIRED'
 assert compatibility.get('schemaVersion')==1 and all(
  compatibility.get('contracts',{}).get(name)==version for name,version in expected.items()
 ),'API_COMPATIBILITY_INVALID'
 state=None
 if worker:
  c=inspect(WORKER)
  assert c['Config']['Image']==IMAGE and c['State']['Running']
  assert c['Config']['Labels']['org.masarifi.scope']==SCOPE
  assert c['State']['Health']['Status']=='healthy'
  run(['docker','exec',WORKER,'/nodejs/bin/node','dist/src/staging-voice-healthcheck.js'],5)
  state=json.loads(run(['docker','exec',WORKER,'/nodejs/bin/node','-e',"process.stdout.write(require('node:fs').readFileSync('/tmp/staging-voice-health.json','utf8'))"],5))
  assert state['epochId']==epoch()['epochId'] and state['mode']=='operating' and state['enabled']==True
 return {'at':datetime.datetime.now(datetime.UTC).isoformat(),'financialApi':financial,'sourceSha':SHA,'apiSourceSha':live['version'],'api':'healthy','analysisWorker':not financial,'generalWorker':False,'voiceRuntime':state}

def wait_health(financial,worker=False):
 for _ in range(45):
  try: return health(financial,worker)
  except Exception: time.sleep(1)
 raise RuntimeError('OPERATING_HEALTH_UNCONFIRMED')

def switch_api():
 pins(); health(False)
 command=BASE+['-f',str(ROOT/'financial-api.yml')]
 # Reject invalid configuration before stopping any healthy runtime component.
 run(command+['config','--quiet'])
 stop_checked('masarifi-staging-analysis-worker-1','analysis-worker')
 run(command+['up','-d','--no-deps','api'])
 return wait_health(True)

def close():
 target()
 errors=[]
 # The financial fence remains independent of mutable deployment pins.
 closed=False
 try:
  result=db_close()
  assert result['posting'] is False and result['state']=='closed'
  closed=True
 except Exception as error: errors.append(type(error).__name__)
 # Fence financial Voice in SQL and stop only this monitor's scoped financial
 # worker. Even if SQL is unavailable, stopping that writer prevents further
 # automatic execution. Closure failure remains an alarm, never a reason to
 # kill Manual/Assistant ingress or replace the shared API.
 try: stop_checked(WORKER,scope=SCOPE)
 except Exception as error: errors.append(type(error).__name__)
 if errors: raise RuntimeError('CLOSURE_UNCONFIRMED:'+','.join(errors))
 return {'posting':False,'state':'closed','sharedApi':'preserved','analysisRestoration':'explicit_guarded_cohort_required'}

mode=sys.argv[1]
target()
if mode=='preflight':
 pins(); print(json.dumps(health(False)))
elif mode=='switch-api':
 print(json.dumps(switch_api()))
elif mode=='start-worker':
 pins(); health(True); e=epoch()
 ENV['MASARIFI_STAGING_VOICE_EPOCH_ID']=e['epochId']
 run(BASE+['-f',RELEASE+'/docker/staging/compose.voice-epoch.yml','-f',str(ROOT/'financial-api.yml'),'--profile','voice-financial','up','-d','--no-deps','voice-epoch'])
 print(json.dumps(wait_health(True,True)))
elif mode=='status': print(json.dumps(health(True,True)))
elif mode=='close': print(json.dumps(close()))
elif mode=='install-monitor':
 pins(); health(True,True)
 unit='[Unit]\nDescription=Masarifi Dev Voice operating health closure\nAfter=docker.service network-online.target\n[Service]\nType=simple\nUser=root\nExecStart=/usr/bin/python3 '+str(ROOT/'host-control.py')+' monitor\nRestart=on-failure\nRestartSec=5\n[Install]\nWantedBy=multi-user.target\n'
 p=pathlib.Path('/etc/systemd/system/'+UNIT)
 with p.open('x') as f: f.write(unit)
 p.chmod(0o644)
 run(['systemd-analyze','verify',str(p)])
 run(['systemctl','daemon-reload'])
 run(['systemctl','enable','--now',UNIT])
 assert run(['systemctl','is-active',UNIT])=='active'
 print(json.dumps({'monitor':UNIT,'active':True}))
elif mode=='monitor':
 failures=0
 while True:
  try: health(True,True); failures=0
  except Exception:
   failures+=1
   if failures>=3:
    print(json.dumps({'event':'operating_health_failed','closing':True}),flush=True)
    print(json.dumps(close()),flush=True)
    break
  time.sleep(10)
else: raise RuntimeError('UNKNOWN_CONTROL_MODE')
