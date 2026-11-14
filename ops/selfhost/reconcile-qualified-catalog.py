"""Reconcile measured extension/default-grant drift on the isolated target only."""
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('transfer',ROOT/'stream-rehearsal.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
t.TARGET='masarifi-postgres17'


def qi(value):return '"'+value.replace('"','""')+'"'


def main():
    os.umask(0o077)
    assert t.target_sql("select current_setting('cron.launch_active_jobs')")=='off'
    receipt_path=ROOT/'catalog-reconciled-qualified.json'
    attempt=1
    while receipt_path.exists():
        assert json.loads(receipt_path.read_text())['state']=='failed','Reconciliation already passed'
        attempt+=1
        receipt_path=ROOT/('catalog-reconciled-qualified-r'+str(attempt)+'.json')
    differences=json.loads((ROOT/'catalog-object-differences.json').read_text())
    assert differences['functions']['sourceOnly']==[{'bytes':2634,'hash':'40651be3b043b3943af268f4b3a42567','id':'pgmq.drop_queue(queue_name text)','owner':'postgres'}]
    query="""select json_build_object('function',pg_get_functiondef('pgmq.drop_queue(text)'::regprocedure),
      'settings',(select coalesce(string_agg(format('ALTER DATABASE %I SET %I TO %L;',d.datname,split_part(v,'=',1),substring(v from position('=' in v)+1)),E'\\n' order by v),'')
       from pg_db_role_setting s join pg_database d on d.oid=s.setdatabase cross join lateral unnest(s.setconfig) v
       where s.setrole=0 and d.datname='postgres'));"""
    source=sp.run(['docker','run','--rm','--label','masarifi.selfhost.transfer=20261113','--log-driver=none','-i','--network=host','--read-only','--mount','type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly','--entrypoint=/bin/sh',t.IMAGE],input=t.source_script(['psql','-XAtq','-v','ON_ERROR_STOP=1','-c',query]),capture_output=True,timeout=60)
    assert source.returncode==0,'SOURCE_METADATA_READ_FAILED'
    metadata=json.loads(source.stdout)
    assert hashlib.md5(metadata['function'].encode()).hexdigest()=='40651be3b043b3943af268f4b3a42567'
    statements=['begin;','\\echo STAGE_extension',metadata['function']+';','\\echo STAGE_settings',metadata['settings']]
    changes=0
    for category in ('relationAcl','schemaAcl','functionAcl'):
        for side,verb in (('targetOnly','REVOKE'),('sourceOnly','GRANT')):
            for row in differences.get(category,{}).get(side,[]):
                privilege=row['privilege_type']
                assert privilege in {'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN','USAGE','CREATE','EXECUTE'}
                grantor=qi(row['grantor']);grantee='PUBLIC' if row['grantee']=='PUBLIC' else qi(row['grantee'])
                name=qi(row['nspname'])
                if category=='relationAcl':
                    name+='.'+qi(row['relname'])
                    kind='SEQUENCE' if row['nspname']=='cron' and row['relname'] in ('jobid_seq','runid_seq') else 'TABLE'
                elif category=='functionAcl':
                    kind='FUNCTION';name+='.'+qi(row['proname'])+'('+row['args']+')'
                else:kind='SCHEMA'
                suffix=(' TO '+grantee+(' WITH GRANT OPTION' if row['is_grantable'] else '')) if verb=='GRANT' else ' FROM '+grantee
                statements.extend(['\\echo STAGE_acl_'+str(changes),'SET SESSION AUTHORIZATION '+grantor+';',verb+' '+privilege+' ON '+kind+' '+name+suffix+';','RESET SESSION AUTHORIZATION;'])
                changes+=1
    statements.append('commit;')
    result=sp.run(['docker','exec','-i',t.TARGET,'psql','-h','/tmp','-U','supabase_admin','-d','postgres','-Xq','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],input='\n'.join(statements).encode(),capture_output=True,timeout=60)
    stages=re.findall(rb'^STAGE_[a-z0-9_]+$',result.stdout,re.M)
    receipt={'state':'passed' if result.returncode==0 else 'failed','aclChanges':changes,'extensionFunctions':1,'sourceChanged':False,'errorHash':hashlib.sha256(result.stderr).hexdigest(),'lastStage':stages[-1].decode() if stages else None,'sqlStates':[v.decode() for v in re.findall(rb'ERROR:\s+([0-9A-Z]{5})\b',result.stderr)]}
    receipt_path.write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
    if result.returncode:raise SystemExit(1)


if __name__=='__main__':main()
