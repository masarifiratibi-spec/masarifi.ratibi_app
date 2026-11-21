"""Prove the exact extension metadata fix on the stopped, non-serving failed clone."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)


def main():
    state=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text())
    assert state['phase']=='aborted-before-target-writes' and state['targetMayAcceptWrites'] is False
    runtime=io.load('runtime-container');pg=runtime.inspect('masarifi-postgres17')
    if not pg['State']['Running']:runtime.docker_request('POST','/containers/'+pg['Id']+'/start')
    import time
    for _ in range(20):
        try:
            if io.target('select 1;')=='1':break
        except RuntimeError:pass
        time.sleep(1)
    else:raise RuntimeError('PRIVATE_TARGET_NOT_READY')
    count=io.load('final-database').copy_extension_metadata()
    query="begin;set local timezone='UTC';select coalesce(md5(string_agg(to_jsonb(m)::text,'' order by queue_name)),md5('')) from pgmq.meta m;commit;"
    assert io.source(query)==io.target(query),'EXTENSION_ROWS_STILL_DIFFER'
    receipt={'state':'passed','table':'pgmq.meta','exactRows':count,'sourceReadOnly':True,'retainedDump':False,'codeSha256':hashlib.sha256((ROOT/'final-database.py').read_bytes()).hexdigest()}
    io.atomic_json(ROOT/'extension-data-qualified.json',receipt);print(json.dumps(receipt),flush=True)


if __name__=='__main__':main()
