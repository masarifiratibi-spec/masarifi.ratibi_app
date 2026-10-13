"""Current mixed-release ingress contracts; no network or device operations."""
import copy, importlib.util, pathlib, unittest
P=pathlib.Path(__file__).with_name('operating-ingress.py')
spec=importlib.util.spec_from_file_location('operating_ingress',P)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def container(identity,port,source='a'*40,financial=False):
 return {'Id':identity,'Name':'/masarifi-staging-test-'+identity[:6],
         'Image':'sha256:'+'b'*64,'Config':{'Image':m.IMAGE_PREFIX+'b'*64,'Cmd':['dist/src/main.js'],
          'Env':['SUPABASE_URL=https://'+m.PROJECT+'.supabase.co','MASARIFI_RELEASE_VERSION='+source,
                 'MASARIFI_VOICE_ANALYSIS_ONLY='+('false' if financial else 'true'),'MASARIFI_AI_PROVIDER_ENABLED=true']},
         'HostConfig':{'NetworkMode':m.NETWORK,'PortBindings':{'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':str(port)}]}},
         'Mounts':[],'State':{'Running':not financial,'Health':{'Status':'healthy'}}}

class Host:
 def __init__(self):
  self.containers={'originalAPI':container('0'*64,3000,'c'*40),
   'publicAPI':container('1'*64,3001),'financialAPI':container('3'*64,3003,financial=True)}
  self.urls=[];self.commands=[];self.contracts={'voiceSession':2}
 def inspect(self,identity):return copy.deepcopy(next(c for c in self.containers.values() if c['Id']==identity))
 def http(self,url):
  self.urls.append(url)
  if url.endswith('/health/live'):return {'version':'a'*40}
  if url.endswith('/health/ready'):return {'status':'ready'}
  return {'schemaVersion':1,'contracts':self.contracts}
 def run(self,command):self.commands.append(command)

def pins(host):
 return {role:{'id':c['Id'],'name':c['Name'][1:],'sourceSha':dict(x.split('=',1) for x in c['Config']['Env'])['MASARIFI_RELEASE_VERSION'],
               'imageDigest':'b'*64,'configurationHash':m.configuration_hash(c)} for role,c in host.containers.items()}

class IngressTests(unittest.TestCase):
 def test_public_readiness_uses_promoted_port_without_touching_original(self):
  h=Host();m.api_health(h,pins(h),False,h.contracts)
  self.assertEqual(h.urls,['http://127.0.0.1:3001/health/live','http://127.0.0.1:3001/health/ready','http://127.0.0.1:3001/health/compatibility'])
  self.assertEqual(h.commands,[])
 def test_financial_readiness_uses_retained_port(self):
  h=Host();p=pins(h);h.containers['financialAPI']['State']['Running']=True
  m.api_health(h,p,True,h.contracts)
  self.assertTrue(all(':3003/' in x for x in h.urls))
 def test_separate_api_and_original_sources_are_preserved(self):
  h=Host();p=pins(h);self.assertNotEqual(p['originalAPI']['sourceSha'],p['publicAPI']['sourceSha'])
  m.preserved_apis(h,p,financial_running=False)
 def test_wrong_port_binding_is_rejected_even_with_matching_config_pin(self):
  for role,wrong in [('publicAPI',3000),('financialAPI',3001)]:
   with self.subTest(role=role):
    h=Host();h.containers[role]['HostConfig']['PortBindings']['3000/tcp'][0]['HostPort']=str(wrong)
    with self.assertRaisesRegex(RuntimeError,'API_LOOPBACK_BINDING_REQUIRED'):m.preserved_apis(h,pins(h),False)
 def test_wildcard_binding_rejected(self):
  h=Host();h.containers['publicAPI']['HostConfig']['PortBindings']['3000/tcp'][0]['HostIp']='0.0.0.0'
  with self.assertRaisesRegex(RuntimeError,'API_LOOPBACK_BINDING_REQUIRED'):m.preserved_apis(h,pins(h),False)
 def test_actual_drift_rejected_before_http(self):
  for field,value in [('Image',m.IMAGE_PREFIX+'d'*64),('Env',[])]:
   with self.subTest(field=field):
    h=Host();p=pins(h);h.containers['publicAPI']['Config'][field]=value
    with self.assertRaises(RuntimeError):m.api_health(h,p,False,h.contracts)
    self.assertEqual(h.urls,[])
 def test_foreign_identity_rejected(self):
  h=Host();p=pins(h);p['publicAPI']['id']='3'*64
  with self.assertRaises(RuntimeError):m.preserved_apis(h,p,False)
 def test_stopped_selected_api_rejected(self):
  h=Host()
  with self.assertRaisesRegex(RuntimeError,'API_RUNNING_STATE_CHANGED'):m.api_health(h,pins(h),True,h.contracts)
 def test_contract_drift_rejected(self):
  h=Host();p=pins(h)
  with self.assertRaisesRegex(RuntimeError,'API_CONTRACTS_CHANGED'):m.api_health(h,p,False,{'voiceSession':99})
 def test_two_routes_change_and_every_other_byte_stays(self):
  before=b'location /api { proxy_pass http://127.0.0.1:3001; }\nlocation /voice { proxy_pass http://127.0.0.1:3001; }\nlocation /admin { proxy_pass http://127.0.0.1:3002; }\n# preserve Arabic UTF-8\n'
  after=m.financial_route(before)
  self.assertEqual(after,before.replace(b'proxy_pass http://127.0.0.1:3001;',b'proxy_pass http://127.0.0.1:3003;'))
  self.assertEqual(m.restore_route(after),before)
 def test_wrong_or_extra_route_targets_refused(self):
  for before in [b'proxy_pass http://127.0.0.1:3000;'*2,b'proxy_pass http://127.0.0.1:3001;',b'proxy_pass http://127.0.0.1:3001;'*3,b'proxy_pass http://127.0.0.1:3001;'*2+b'proxy_pass http://127.0.0.1:3003;']:
   with self.subTest(before=before):
    with self.assertRaisesRegex(RuntimeError,'EXACT_TWO_API_ROUTES_REQUIRED'):m.financial_route(before)
 def test_candidate_release_mismatch_refused(self):
  h=Host();p=pins(h);p['financialAPI']['sourceSha']='d'*40
  with self.assertRaisesRegex(RuntimeError,'COMPATIBLE_API_RELEASE_REQUIRED'):m.preserved_apis(h,p,False)
 def test_duplicate_environment_refused_with_matching_pin(self):
  h=Host();h.containers['publicAPI']['Config']['Env'].append('MASARIFI_VOICE_ANALYSIS_ONLY=false')
  with self.assertRaisesRegex(RuntimeError,'API_ENVIRONMENT_INVALID'):m.api_health(h,pins(h),False,h.contracts)
 def test_unhealthy_public_api_refused_before_http(self):
  h=Host();h.containers['publicAPI']['State']['Health']['Status']='unhealthy'
  with self.assertRaisesRegex(RuntimeError,'API_UNHEALTHY'):m.api_health(h,pins(h),False,h.contracts)
  self.assertEqual(h.urls,[])
 def test_bad_live_or_ready_results_refused(self):
  for key in ['live','ready']:
   with self.subTest(key=key):
    h=Host();original=h.http
    h.http=lambda url:{} if url.endswith('/'+key) else original(url)
    with self.assertRaisesRegex(RuntimeError,'API_NOT_READY'):m.api_health(h,pins(h),False,h.contracts)
 def test_malformed_reverse_route_refused(self):
  for value in [b'proxy_pass http://127.0.0.1:3003;',b'proxy_pass http://127.0.0.1:3003;'*3,b'proxy_pass http://127.0.0.1:3003;'*2+b'proxy_pass http://127.0.0.1:3001;']:
   with self.subTest(value=value):
    with self.assertRaisesRegex(RuntimeError,'EXACT_TWO_API_ROUTES_REQUIRED'):m.restore_route(value)

if __name__=='__main__':unittest.main()
