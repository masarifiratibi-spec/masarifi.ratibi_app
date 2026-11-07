"""Exact-ID ingress checks for the independently promoted Staging topology.

This module has no CLI or deployment authority. The operating controller must
provide its approved, immutable pins before using these checks or route bytes.
"""
import hashlib
import json
import re

PROJECT='qcffvfbpzvpwcwxwjyro'
NETWORK='masarifi-staging_backend'
IMAGE_PREFIX='ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:'
PORTS={'originalAPI':3000,'publicAPI':3001,'financialAPI':3003}
HEX=re.compile(r'^[a-f0-9]{64}$')
SHA=re.compile(r'^[a-f0-9]{40}$')
PUBLIC_TARGET=b'proxy_pass http://127.0.0.1:3001;'
FINANCIAL_TARGET=b'proxy_pass http://127.0.0.1:3003;'

def require(value,reason):
 if not value:raise RuntimeError(reason)

def configuration_hash(container):
 data={k:container.get(k) for k in ['Config','HostConfig','Mounts','Image']}
 return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def checked_api(host,pin,role,running):
 require(role in PORTS and isinstance(pin,dict) and set(pin)=={'id','name','sourceSha','imageDigest','configurationHash'},'EXACT_API_PIN_REQUIRED')
 require(all(isinstance(pin[k],str) and HEX.fullmatch(pin[k]) for k in ['id','imageDigest','configurationHash']) and
         isinstance(pin['sourceSha'],str) and SHA.fullmatch(pin['sourceSha']) and
         isinstance(pin['name'],str) and re.fullmatch(r'masarifi-staging-[a-z0-9-]+',pin['name']),'EXACT_API_PIN_REQUIRED')
 c=host.inspect(pin['id'])
 require(c['Id']==pin['id'] and c['Name']=='/'+pin['name'] and configuration_hash(c)==pin['configurationHash'],'API_CONFIGURATION_CHANGED')
 require(c['State']['Running'] is running,'API_RUNNING_STATE_CHANGED')
 require(c['Config']['Image']==IMAGE_PREFIX+pin['imageDigest'] and c['Config']['Cmd']==['dist/src/main.js'],'API_IMAGE_OR_COMMAND_CHANGED')
 entries=c['Config']['Env'];env={}
 for entry in entries:
  require(isinstance(entry,str) and '=' in entry,'API_ENVIRONMENT_INVALID')
  key,value=entry.split('=',1);require(key not in env,'API_ENVIRONMENT_INVALID');env[key]=value
 require(env.get('SUPABASE_URL')=='https://'+PROJECT+'.supabase.co' and
         env.get('MASARIFI_RELEASE_VERSION')==pin['sourceSha'] and env.get('MASARIFI_AI_PROVIDER_ENABLED')=='true' and
         env.get('MASARIFI_VOICE_ANALYSIS_ONLY')==('false' if role=='financialAPI' else 'true'),'API_MODE_OR_SOURCE_CHANGED')
 require(c['HostConfig']['NetworkMode']==NETWORK and c['HostConfig']['PortBindings']==
         {'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':str(PORTS[role])}]},'API_LOOPBACK_BINDING_REQUIRED')
 return c

def preserved_apis(host,pins,financial_running):
 require(set(pins)==set(PORTS) and len({p['id'] for p in pins.values()})==3,'DISTINCT_API_IDENTITIES_REQUIRED')
 require(pins['publicAPI']['sourceSha']==pins['financialAPI']['sourceSha'] and
         pins['publicAPI']['imageDigest']==pins['financialAPI']['imageDigest'],'COMPATIBLE_API_RELEASE_REQUIRED')
 for role in PORTS:checked_api(host,pins[role],role,financial_running if role=='financialAPI' else True)

def api_health(host,pins,financial,contracts):
 require(type(financial) is bool,'API_SELECTION_REQUIRED')
 preserved_apis(host,pins,financial)
 role='financialAPI' if financial else 'publicAPI'
 c=checked_api(host,pins[role],role,True)
 require(c['State'].get('Health',{}).get('Status')=='healthy','API_UNHEALTHY')
 prefix='http://127.0.0.1:'+str(PORTS[role])+'/health/'
 live,ready,compat=[host.http(prefix+endpoint) for endpoint in ['live','ready','compatibility']]
 require(live.get('version')==pins[role]['sourceSha'] and ready.get('status')=='ready','API_NOT_READY')
 require(compat.get('schemaVersion')==1 and compat.get('contracts')==contracts,'API_CONTRACTS_CHANGED')
 return c

def financial_route(before):
 require(isinstance(before,bytes) and before.count(PUBLIC_TARGET)==2 and FINANCIAL_TARGET not in before,'EXACT_TWO_API_ROUTES_REQUIRED')
 return before.replace(PUBLIC_TARGET,FINANCIAL_TARGET)

def restore_route(after):
 require(isinstance(after,bytes) and after.count(FINANCIAL_TARGET)==2 and PUBLIC_TARGET not in after,'EXACT_TWO_API_ROUTES_REQUIRED')
 return after.replace(FINANCIAL_TARGET,PUBLIC_TARGET)
