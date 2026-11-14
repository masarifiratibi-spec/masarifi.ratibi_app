"""Replace only the disposable target database using a direct, unsaved final stream."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
STATE=Path('/etc/masarifi/selfhost/cutover-state.json')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)


def copy_extension_metadata():
    extension_rows=json.loads(io.source("select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from pgmq.meta m;"))
    assert io.target('select count(*) from pgmq.meta;')=='0','PGMQ_META_RESTORE_BEHAVIOR_CHANGED'
    if extension_rows:
        io.target('insert into pgmq.meta select * from jsonb_populate_recordset(null::pgmq.meta,'+io.ql(json.dumps(extension_rows))+'::jsonb);')
    return len(extension_rows)


def main():
    os.umask(0o077)
    state=json.loads(STATE.read_text());assert state['phase']=='source-fenced' and not state['targetMayAcceptWrites']
    assert io.target("select current_setting('cron.launch_active_jobs')")=='off'
    # The cluster roles, new login passwords and TLS files are outside this database.
    io.target('drop database postgres with(force);',database='template1')
    io.target("create database postgres owner postgres template template0 encoding 'UTF8' locale_provider icu icu_locale 'en-US' lc_collate 'en_US.UTF-8' lc_ctype 'en_US.UTF-8';",database='template1')
    final=ROOT/('final-transfer-'+str(int(state['startedAt'])));final.mkdir(mode=0o700,exist_ok=False)
    for name in ('stream-rehearsal.py','logical_stream.py','precreate-qualified-extensions.py','reconcile-qualified-catalog.py','verify-catalog.py','catalog-summary.sql','constraint-tree.py'):
        body=(ROOT/name).read_text().replace(str(ROOT),str(final))
        (final/name).write_text(body)
    for name in ('database-prepared-qualified.json','roles-transfer-qualified.json','catalog-object-differences.json'):
        (final/name).write_bytes((ROOT/name).read_bytes())
    io.atomic_json(final/'source-fence-original.json',state['originalCatalog'])
    for command in ([str(final/'precreate-qualified-extensions.py')],[str(final/'stream-rehearsal.py'),'database','qualified'],[str(final/'reconcile-qualified-catalog.py')],[str(final/'verify-catalog.py'),'qualified']):
        # Only safe metadata receipts are printed by these reviewed helpers.
        sp.run(['python3','-I',*command],check=True,timeout=io.bounded(1200))
    # pgmq.meta belongs to the extension but is not registered as pg_dump data.
    # Copy its exact frozen rows in memory; the unchanged full row gate checks it.
    extension_count=copy_extension_metadata()
    print(json.dumps({'state':'extension-data-copied','table':'pgmq.meta','rows':extension_count,'retainedDump':False}),flush=True)
    state['phase']='database-copied';io.atomic_json(STATE,state)
    sp.run(['python3','-I',str(ROOT/'verify-final-data.py')],check=True,timeout=io.bounded(700))
    state['phase']='data-verified';io.atomic_json(STATE,state)
    print(json.dumps({'state':'data-verified','retainedDump':False,'cronActive':False}),flush=True)


if __name__=='__main__':main()
