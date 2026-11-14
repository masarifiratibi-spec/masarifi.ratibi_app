"""Use existing active Clerk sessions only. Tokens stay in the shadow process memory."""
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp
import sys
import base64
from urllib.parse import urlsplit

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')


def main():
    os.umask(0o077)
    assert sys.argv[1:] in ([],['finance'],['finance-check'],['features'],['features-check'],['tracking']),'Unknown auth verification mode'
    tracking=sys.argv[1:]==['tracking']
    finance=sys.argv[1:] in (['finance'],['finance-check'])
    features=sys.argv[1:]==['features']
    feature_results=sys.argv[1:]==['features-check']
    operational=os.environ.get('MASARIFI_VERIFY_OPERATIONAL')=='1'
    suffix='-operational' if operational else ''
    shadow=json.loads((ROOT/'shadow-created.json').read_text())
    if operational:
        cutover=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text())
        assert cutover['targetMayAcceptWrites'] and cutover['phase'] in ('operational-target-awaiting-final-acceptance','complete')
        current=json.loads(sp.check_output(['docker','inspect','masarifi-production-core-api-20261105-97e66588']))[0]
        assert current['Id'] in [row['id'] for row in cutover['newConsumers']]
        configuration=dict(value.split('=',1) for value in current['Config']['Env'])
        assert urlsplit(configuration['DATABASE_URL']).hostname=='masarifi-postgres17.internal'
        shadow={'id':current['Id'],'addresses':{},'port':None}
    consumers=json.loads((ROOT/'runtime-originals.json').read_text())
    configured=[]
    for consumer in consumers:
        container=json.loads(sp.check_output(['docker','inspect',consumer['id']]))[0]
        configured.append(dict(value.split('=',1) for value in container['Config']['Env']))
    primary=json.loads(sp.check_output(['docker','inspect',shadow['id']]))[0]
    env=dict(value.split('=',1) for value in primary['Config']['Env'])
    owners=[]
    for configuration in configured:
        if configuration.get('CLERK_SECRET_KEY')!=env['CLERK_SECRET_KEY']:continue
        for key,value in configuration.items():
            if 'OWNER_ID' in key and value.startswith('user_') and value not in owners:owners.append(value)
    query="select coalesce(json_agg(id),'[]'::json) from (select id from public.profiles where status='active' and id ~ '^user_[A-Za-z0-9]{20,40}$' order by id desc limit 20) p"
    result=sp.run(['docker','exec','masarifi-postgres17','psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtq','-v','ON_ERROR_STOP=1','-c',query],capture_output=True,timeout=15)
    assert result.returncode==0,'AUTH_FIXTURE_PROFILE_QUERY_FAILED'
    for value in json.loads(result.stdout):
        if value not in owners:owners.append(value)
    assert owners,'NO_EXISTING_PROFILE_FOR_AUTH_PROBE'
    payload={'owners':owners[:24],'origin':'https://api.masarifiratibi.com' if operational else 'http://'+shadow['addresses']['masarifi-selfhost-data']+':'+str(shadow['port'])}
    if sys.argv[1:]==['finance-check']:payload['fixture']=json.loads((ROOT/('finance'+suffix+'-fixtures.json')).read_text())
    if features:payload['audioBase64']=base64.b64encode((ROOT/'fixtures/voice.wav').read_bytes()).decode()
    if feature_results:payload['fixture']=json.loads((ROOT/('functional'+suffix+'-fixtures.json')).read_text())
    code=(ROOT/('verify-tracking.cjs' if tracking else 'verify-feature-results.cjs' if feature_results else 'verify-feature-api.cjs' if features else 'verify-finance-sync.cjs' if finance else 'verify-clerk-auth.cjs')).read_text()
    # Script and private subject selectors travel on stdin, not Docker args/Env/logs.
    wrapper="const source="+json.dumps(code)+";const data="+json.dumps(json.dumps(payload))+";const read=require('node:fs').readFileSync;require('node:fs').readFileSync=function(path,...args){return path===0?data:read(path,...args)};new Function('require',source)(require);"
    probe=sp.run(['docker','exec','-i',shadow['id'],'/nodejs/bin/node'],input=wrapper.encode(),capture_output=True,timeout=180)
    try:receipt=json.loads(probe.stdout)
    except ValueError:raise RuntimeError('AUTH_PROBE_INVALID_OUTPUT: '+hashlib.sha256(probe.stderr).hexdigest()) from None
    private=receipt.pop('_private',None)
    if private:(ROOT/(('finance' if finance else 'functional')+suffix+'-fixtures.json')).write_text(json.dumps(private))
    if feature_results and receipt.get('state')=='passed' and not operational:
        for phase in ('reports','assistant','voice'):
            assert json.loads((ROOT/('functional-'+phase+'.json')).read_text())['state']=='passed','MISSING_WORKER_GATE:'+phase
        receipt['actualWorkerPhases']=['reports','assistant','voice']
    if operational:
        receipt.pop('rehearsalOnly',None)
        receipt['operational']=True;receipt['publicHttps']=True
    name='tracking' if tracking else 'functional-runtime' if feature_results else 'feature-api' if features else 'finance-sync' if finance else 'clerk-auth'
    (ROOT/(name+suffix+'-verification.json')).write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
    if probe.returncode:raise SystemExit(probe.returncode)


if __name__=='__main__':main()
