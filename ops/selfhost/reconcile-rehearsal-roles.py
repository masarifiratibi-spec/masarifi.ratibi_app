"""Align the empty target's bootstrap identity with source, then restore memberships atomically."""
import hashlib
import importlib.util
import json
import re
import subprocess as sp
import time
from pathlib import Path

root = Path('/var/tmp/masarifi-selfhost-20261113')
target = 'masarifi-postgres17-rehearsal'
spec = importlib.util.spec_from_file_location('transfer', root / 'stream-rehearsal.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)


def sql(user, command):
    p = sp.run(['docker', 'exec', '-i', target, 'psql', '-h', '/tmp', '-U', user, '-d', 'postgres',
                '-XAtq', '-v', 'ON_ERROR_STOP=1'], input=command.encode(), capture_output=True, timeout=30)
    assert p.returncode == 0, 'TARGET_ROLE_RECONCILIATION_FAILED'
    return p.stdout.decode().strip()


assert not (root / 'roles-transfer-r2.json').exists()
assert sql('supabase_admin', "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth','audit','storage','supabase_migrations') and c.relkind in('r','p')") == '0'
assert sql('supabase_admin', "select current_setting('cron.launch_active_jobs')") == 'off'
# PostgreSQL 17 role grants attributed to a superuser require ADMIN OPTION unless
# that role is the bootstrap superuser (OID 10). Source OID 10 is supabase_admin.
# No application object exists yet; only the trial bootstrap names are reconciled.
if sql('supabase_admin', 'select rolname from pg_roles where oid=10') == 'masarifi_selfhost_admin':
    sql('masarifi_selfhost_admin', 'create role masarifi_rehearsal_swap superuser login;')
    sql('masarifi_rehearsal_swap', 'begin; alter role supabase_admin rename to masarifi_rehearsal_placeholder; alter role masarifi_selfhost_admin rename to supabase_admin; commit;')
    sql('supabase_admin', 'begin; drop role masarifi_rehearsal_swap; drop role masarifi_rehearsal_placeholder; commit;')
assert sql('supabase_admin', 'select rolname from pg_roles where oid=10') == 'supabase_admin'
started = time.monotonic()
p = sp.run(['docker', 'run', '--rm', '--log-driver=none', '-i', '--network=host', '--read-only',
            '--mount', 'type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly',
            '--entrypoint=/bin/sh', transfer.IMAGE],
           input=transfer.source_script(['pg_dumpall', '--roles-only', '--no-role-passwords']), capture_output=True, timeout=60)
assert p.returncode == 0, 'SOURCE_ROLE_READ_FAILED'
source = p.stdout.decode()
names = set(re.findall(r'^CREATE ROLE ([A-Za-z_][A-Za-z_0-9]*);$', source, re.M))
existing = set(sql('supabase_admin', "select rolname from pg_roles where left(rolname,3)<>'pg_'").splitlines())
if names != existing:
    print('ROLE_SET_DIAGNOSTIC', json.dumps({'sourceOnly': sorted(names-existing), 'targetOnly': sorted(existing-names)}))
assert names == existing, 'ROLE_SET_DRIFT'
source = re.sub(r'^CREATE ROLE [A-Za-z_][A-Za-z_0-9]*;\s*$', '', source, flags=re.M)
p = sp.run(['docker', 'exec', '-i', target, 'psql', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres',
            '-Xq', '--single-transaction', '-v', 'ON_ERROR_STOP=1'], input=source.encode(), capture_output=True, timeout=60)
receipt = {'mode': 'roles', 'state': 'passed' if p.returncode == 0 else 'failed',
           'seconds': round(time.monotonic()-started, 3), 'targetExit': p.returncode,
           'errorHash': hashlib.sha256(p.stderr).hexdigest(), 'roles': len(names),
           'bootstrapRole': 'supabase_admin', 'retainedDump': False, 'sourceReadOnly': True}
with (root / 'roles-transfer-r2.json').open('x') as file:
    json.dump(receipt, file, indent=2)
print(json.dumps(receipt), flush=True)
if p.returncode:
    raise SystemExit(1)
