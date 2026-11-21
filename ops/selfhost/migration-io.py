"""Private in-memory SQL I/O; never emit SQL errors, credentials or row values."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess as sp
import os
import time

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('transfer',ROOT/'stream-rehearsal.py')
transfer=importlib.util.module_from_spec(spec);spec.loader.exec_module(transfer)


def load(name):
    spec=importlib.util.spec_from_file_location(name.replace('-','_'),ROOT/(name+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def bounded(seconds):
    deadline=os.environ.get('MASARIFI_CUTOVER_DEADLINE')
    if deadline is None:return seconds
    remaining=float(deadline)-time.time()
    if remaining<=0:raise RuntimeError('CUTOVER_DEADLINE_EXCEEDED')
    return min(seconds,remaining)


def checked(args,*,input=None,timeout=60):
    result=sp.run(args,input=input,capture_output=True,timeout=bounded(timeout))
    if result.returncode:raise RuntimeError('MIGRATION_COMMAND_FAILED:'+args[0]+':'+hashlib.sha256(result.stderr).hexdigest())
    return result.stdout


def source(sql,*,write=False,timeout=90):
    return checked(['docker','run','--rm','--label','masarifi.selfhost.transfer=20261113','--log-driver=none','-i','--network=host','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--mount','type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly','--entrypoint=/bin/sh',transfer.IMAGE],input=transfer.source_script(['psql','-XAtq','-v','ON_ERROR_STOP=1','-c',sql],read_only=not write),timeout=timeout).decode().strip()


def target(sql,*,database='postgres',timeout=90):
    return checked(['docker','exec','-i','masarifi-postgres17','psql','-h','/tmp','-U','supabase_admin','-d',database,'-XAtq','-v','ON_ERROR_STOP=1'],input=sql.encode(),timeout=timeout).decode().strip()


def atomic_json(path,value):
    import os
    path=Path(path);temporary=path.with_name(path.name+'.new')
    with temporary.open('w') as file:
        json.dump(value,file,indent=2);file.flush();os.fsync(file.fileno())
    temporary.chmod(0o600);temporary.replace(path)
    descriptor=os.open(path.parent,os.O_DIRECTORY)
    try:os.fsync(descriptor)
    finally:os.close(descriptor)


def qi(value):return '"'+value.replace('"','""')+'"'
def ql(value):return "'"+value.replace("'","''")+"'"
