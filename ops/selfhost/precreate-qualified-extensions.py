"""Create extensions under their original owners before importing the qualified clone."""
import json
from pathlib import Path
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
assert json.loads((ROOT/'roles-transfer-qualified.json').read_text())['state']=='passed'
assert not (ROOT/'extensions-prepared-qualified.json').exists()
sql="""
begin;
alter database postgres owner to postgres;
revoke all on database postgres from public;
grant connect,temporary on database postgres to public;
grant create,connect,temporary on database postgres to postgres;
grant create on database postgres to supabase_etl_admin,supabase_storage_admin;
grant create,connect,temporary on database postgres to dashboard_user;
create schema extensions authorization postgres;
create schema pgmq authorization postgres;
create schema vault authorization supabase_admin;
alter role postgres superuser;
set session authorization postgres;
create extension pg_stat_statements with schema extensions version '1.11';
create extension pgcrypto with schema extensions version '1.3';
create extension pgmq with schema pgmq version '1.5.1';
create extension "uuid-ossp" with schema extensions version '1.1';
reset session authorization;
alter role postgres nosuperuser;
create extension pg_cron with schema pg_catalog version '1.6.4';
create extension supabase_vault with schema vault version '0.3.1';
commit;
"""
p=sp.run(['docker','exec','-i','masarifi-postgres17','psql','-h','/tmp','-U','supabase_admin','-d','postgres','-Xq','-v','ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True,timeout=60)
assert p.returncode==0,'EXTENSION_PREPARATION_FAILED'
probe=sp.run(['docker','exec','masarifi-postgres17','psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtc',"select rolsuper from pg_roles where rolname='postgres';"],capture_output=True,timeout=10)
assert probe.returncode==0 and probe.stdout.strip()==b'f'
receipt={'state':'passed','postgresSuperuser':False,'precreatedSchemas':['extensions','pgmq','vault'],'extensionOwnersPreserved':True,'sourceChanged':False}
with (ROOT/'extensions-prepared-qualified.json').open('x') as file:json.dump(receipt,file,indent=2)
print(json.dumps(receipt),flush=True)
