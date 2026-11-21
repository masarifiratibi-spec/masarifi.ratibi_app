"""Report differing object identities and hashes, without function bodies or row data."""
import importlib.util
import json
from pathlib import Path
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('transfer',ROOT/'stream-rehearsal.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
prefix=(ROOT/'catalog-summary.sql').read_text().split('\nselect json_build_object(')[0]
query=prefix+"""
select json_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('id',nspname||'.'||proname||'('||args||')','owner',owner,'hash',md5(definition),'bytes',length(definition)) order by nspname,proname,args) from function_summary),
 'relationAcl',(select jsonb_agg(to_jsonb(x) order by nspname,relname,grantor,grantee,privilege_type) from relation_acl x),
 'schemaAcl',(select jsonb_agg(to_jsonb(x) order by nspname,grantor,grantee,privilege_type) from schema_acl x),
 'constraints',(select jsonb_agg(to_jsonb(x) order by nspname,conname,definition) from constraint_summary x),
 'functionAcl',(select jsonb_agg(to_jsonb(x) order by nspname,proname,args,grantor,grantee,privilege_type) from function_acl x)
);
"""
source=sp.run(['docker','run','--rm','--log-driver=none','-i','--network=host','--read-only','--mount','type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly','--entrypoint=/bin/sh',t.IMAGE],input=t.source_script(['psql','-XAtq','-v','ON_ERROR_STOP=1','-c',query]),capture_output=True,timeout=60)
target=sp.run(['docker','exec','-i','masarifi-postgres17','psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtq','-v','ON_ERROR_STOP=1'],input=query.encode(),capture_output=True,timeout=60)
assert source.returncode==target.returncode==0,'CATALOG_DIAGNOSTIC_FAILED'
a=json.loads(source.stdout);b=json.loads(target.stdout)
differences={}
for key in a:
    left={json.dumps(x,sort_keys=True) for x in a[key] or []}
    right={json.dumps(x,sort_keys=True) for x in b[key] or []}
    if left!=right:
        differences[key]={'sourceOnly':[json.loads(x) for x in sorted(left-right)],'targetOnly':[json.loads(x) for x in sorted(right-left)]}
(ROOT/'catalog-object-differences.json').write_text(json.dumps(differences,indent=2))
print(json.dumps(differences),flush=True)
