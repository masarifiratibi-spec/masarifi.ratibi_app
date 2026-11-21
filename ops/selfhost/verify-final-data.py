"""Compare the frozen source and target using counts/multiset hashes/sequence state."""
import importlib.util
import json
from pathlib import Path
import time

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)


def fingerprint(reader):
    catalog=json.loads(reader("select coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind) order by n.nspname,c.relname),'[]'::json) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','audit','auth','storage','pgmq','supabase_migrations','vault','cron') and c.relkind in ('r','p','S');"))
    tables=[];sequences=[]
    for row in catalog:
        relation=io.qi(row['schema'])+'.'+io.qi(row['name'])
        identity=io.ql(row['schema']+'.'+row['name'])
        if row['kind']=='S':
            sequences.append('select json_build_object(\'id\','+identity+",'lastValue',last_value::text,'called',is_called) value from "+relation)
        else:
            tables.append("select json_build_object('id',"+identity+",'rows',count(*),'digest',coalesce(md5(string_agg(h,'' order by h)),md5(''))) value from (select md5(to_jsonb(t)::text) h from "+relation+' t) hashes')
    def rows(parts):
        values=json.loads(reader("begin isolation level repeatable read read only;set local timezone='UTC';select coalesce(json_agg(value),'[]'::json) from ("+' union all '.join(parts)+') valueset;commit;',timeout=300)) if parts else []
        assert len(values)==len(parts) and len({row['id'] for row in values})==len(values),'FINGERPRINT_RELATION_IDENTITY'
        return sorted(values,key=lambda row:row['id'])
    return {'tables':rows(tables),'sequences':rows(sequences)}


def main():
    state=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text())
    assert state['phase']=='database-copied' and state['targetMayAcceptWrites'] is False
    started=time.monotonic();source=fingerprint(io.source);target=fingerprint(io.target)
    receipt={'state':'passed' if source==target else 'failed','tableCount':len(source['tables']),'sequenceCount':len(source['sequences']),'seconds':round(time.monotonic()-started,3),'source':source,'target':target}
    io.atomic_json(ROOT/'final-data-verification.json',receipt)
    print(json.dumps({key:value for key,value in receipt.items() if key not in ('source','target')}),flush=True)
    assert source==target,'FINAL_ROW_OR_SEQUENCE_MISMATCH'


if __name__=='__main__':main()
