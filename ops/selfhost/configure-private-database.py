"""Enable verified TLS and least-privilege logins on the isolated target only."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shlex
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
SECRETS=Path('/etc/masarifi/selfhost')
DATA=Path('/srv/masarifi/postgresql17')
NAME='masarifi-postgres17'
HOST='masarifi-postgres17.internal'
ROLES=('masarifi_api_login','masarifi_worker_login')
spec=importlib.util.spec_from_file_location('transfer',ROOT/'stream-rehearsal.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t);t.TARGET=NAME


def run(args,**kwargs):
    result=sp.run(args,capture_output=True,timeout=60,**kwargs)
    if result.returncode:raise RuntimeError('PRIVATE_DATABASE_COMMAND_FAILED: '+args[0]+' errorHash='+hashlib.sha256(result.stderr).hexdigest())
    return result.stdout


def sql(query):
    return run(['docker','exec','-i',NAME,'psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtq','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],input=query.encode()).decode().strip()


def main():
    os.umask(0o077)
    assert json.loads((ROOT/'catalog-comparison-qualified.json').read_text())['state']=='passed'
    assert sql("select current_setting('cron.launch_active_jobs')")=='off'
    assert not (ROOT/'database-tls-ready.json').exists(),'TLS preparation already qualified'
    before={c['Id']:(c['Image'],c['State']['StartedAt']) for c in json.loads(run(['docker','inspect',*run(['docker','ps','-q']).decode().split()])) if c['Name']!='/'+NAME}
    container=json.loads(run(['docker','inspect',NAME]))[0]
    assert not container['HostConfig'].get('PortBindings')
    network=json.loads(run(['docker','network','inspect','masarifi-selfhost-data']))[0]
    assert network['Internal'] is True
    address=container['NetworkSettings']['Networks']['masarifi-selfhost-data']['IPAddress']
    subnet=network['IPAM']['Config'][0]['Subnet']
    assert str(DATA.resolve())==str(DATA) and not DATA.is_symlink()
    SECRETS.mkdir(mode=0o700,parents=True,exist_ok=True)
    credentials_path=SECRETS/'database-credentials.json'
    if credentials_path.exists():credentials=json.loads(credentials_path.read_text())
    else:
        credentials={role:secrets.token_urlsafe(48) for role in ROLES}
        with credentials_path.open('x') as file:json.dump(credentials,file)
        credentials_path.chmod(0o400)
    assert set(credentials)==set(ROLES) and all(len(p)>=48 for p in credentials.values())
    ca_key=SECRETS/'database-ca.key';ca=SECRETS/'database-ca.crt'
    tls=DATA/'tls';tls.mkdir(mode=0o700,exist_ok=True);os.chown(tls,100,101)
    key=tls/'server.key';cert=tls/'server.crt';csr=SECRETS/'database-server.csr';extensions=SECRETS/'database-server.ext'
    if not ca.exists():
        assert not ca_key.exists(),'Incomplete CA preparation'
        run(['openssl','req','-x509','-newkey','rsa:3072','-nodes','-days','3650','-sha256','-subj','/CN=Masarifi private database CA','-keyout',str(ca_key),'-out',str(ca)])
        ca_key.chmod(0o600);ca.chmod(0o644)
    if not cert.exists():
        assert not key.exists(),'Incomplete database certificate preparation'
        run(['openssl','req','-new','-newkey','rsa:3072','-nodes','-sha256','-subj','/CN='+HOST,'-keyout',str(key),'-out',str(csr)])
        extensions.write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:'+HOST+',IP:'+address+'\n')
        run(['openssl','x509','-req','-in',str(csr),'-CA',str(ca),'-CAkey',str(ca_key),'-CAcreateserial','-out',str(cert),'-days','825','-sha256','-extfile',str(extensions)])
        key.chmod(0o600);cert.chmod(0o644);os.chown(key,100,101);os.chown(cert,100,101)
    role_sql="set pg_stat_statements.track_utility=off; set password_encryption='scram-sha-256'; begin;\n"
    for role,password in credentials.items():role_sql+='alter role "'+role+'" password '+"'"+password.replace("'","''")+"';\n"
    sql(role_sql+'commit;')
    sql("alter system set ssl='on';\nalter system set ssl_cert_file='/var/lib/postgresql/data/tls/server.crt';\nalter system set ssl_key_file='/var/lib/postgresql/data/tls/server.key';")
    hba='local all all trust\nhostssl postgres '+','.join(ROLES)+' '+subnet+' scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n'
    hba_file=DATA/'pg_hba.conf'
    assert not hba_file.is_symlink()
    temporary=DATA/'pg_hba.conf.selfhost-new';temporary.write_text(hba);temporary.chmod(0o600);os.chown(temporary,100,101);temporary.replace(hba_file)
    assert sql('select pg_reload_conf()')=='t'
    assert sql("select current_setting('ssl')")=='on'
    assert sql('select count(*) from pg_hba_file_rules where error is not null')=='0'
    assert sql('select count(*) from pg_file_settings where error is not null')=='0'
    def probe(role,sslmode='verify-full',hostname=HOST):
        values={'PGHOST':hostname,'PGPORT':'5432','PGUSER':role,'PGPASSWORD':credentials[role],'PGDATABASE':'postgres','PGSSLMODE':sslmode,'PGSSLROOTCERT':'/certs/ca.crt','PGCONNECT_TIMEOUT':'5','PGAPPNAME':'masarifi-private-tls-qualification'}
        script=('set -eu\n'+''.join('export '+k+'='+shlex.quote(v)+'\n' for k,v in values.items())+"exec psql -XAtq -v ON_ERROR_STOP=1 -c \"select json_build_object('role',current_user,'ssl',(select ssl from pg_stat_ssl where pid=pg_backend_pid()),'superuser',(select rolsuper from pg_roles where rolname=current_user),'bypassrls',(select rolbypassrls from pg_roles where rolname=current_user))\"\n").encode()
        return sp.run(['docker','run','--rm','--log-driver=none','-i','--network=masarifi-selfhost-data','--add-host='+hostname+':'+address,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--mount','type=bind,src='+str(ca)+',dst=/certs/ca.crt,readonly','--entrypoint=/bin/sh',t.IMAGE],input=script,capture_output=True,timeout=30)
    for role in ROLES:
        result=probe(role)
        assert result.returncode==0,'VERIFIED_TLS_LOGIN_FAILED: '+role
        row=json.loads(result.stdout)
        assert row=={'role':role,'ssl':True,'superuser':False,'bypassrls':False}
    assert probe(ROLES[0],hostname='wrong-database-name.internal').returncode!=0,'HOSTNAME_VERIFICATION_MISSING'
    assert probe(ROLES[0],sslmode='disable').returncode!=0,'PLAINTEXT_DATABASE_ACCESS_ALLOWED'
    after={c['Id']:(c['Image'],c['State']['StartedAt']) for c in json.loads(run(['docker','inspect',*before]))}
    assert before==after,'Existing serving service changed'
    receipt={'state':'private-tls-ready','container':NAME,'host':HOST,'privateAddress':address,'subnet':subnet,'port':5432,'ca':str(ca),'credentialsFile':str(credentials_path),'verifiedLoginRoles':list(ROLES),'plaintextRejected':True,'wrongHostnameRejected':True,'publishedPorts':[],'cronActiveJobs':False,'existingServicesPreserved':len(before),'sourceChanged':False}
    (ROOT/'database-tls-ready.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
