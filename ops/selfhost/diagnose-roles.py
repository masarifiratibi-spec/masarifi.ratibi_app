"""Diagnose the rehearsal role import in a transaction that always rolls back."""
import importlib.util
import re
import subprocess as sp
from pathlib import Path

root = Path('/var/tmp/masarifi-selfhost-20261113')
spec = importlib.util.spec_from_file_location('transfer', root / 'stream-rehearsal.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)
p = sp.run(['docker', 'run', '--rm', '--log-driver=none', '-i', '--network=host', '--read-only',
            '--mount', 'type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly',
            '--entrypoint=/bin/sh', transfer.IMAGE],
           input=transfer.source_script(['pg_dumpall', '--roles-only', '--no-role-passwords']), capture_output=True, timeout=60)
assert p.returncode == 0, 'SOURCE_ROLE_READ_FAILED'
sql = re.sub(r'^CREATE ROLE [A-Za-z_][A-Za-z_0-9]*;\s*$', '', p.stdout.decode(), flags=re.M)
# Disabling default_transaction_read_only is session configuration, not a role statement.
sql = 'BEGIN;\n' + sql + '\nROLLBACK;\n'
p = sp.run(['docker', 'exec', '-i', transfer.TARGET, 'psql', '-h', '/tmp', '-U', 'masarifi_selfhost_admin',
            '-d', 'postgres', '-Xq', '-v', 'ON_ERROR_STOP=1'], input=sql.encode(), capture_output=True, timeout=60)
print('DIAGNOSTIC_EXIT', p.returncode)
for match in re.finditer(r'(permission denied to (?:grant|set|alter) role|role) "([A-Za-z_][A-Za-z_0-9]*)"', p.stderr.decode()):
    print('ROLE_DIAGNOSTIC', match.group(1), match.group(2))
for line in sql.splitlines():
    if re.fullmatch(r'GRANT [A-Za-z_0-9 ,]+ TO [A-Za-z_0-9 ,]+(?: WITH [A-Z_ ,]+)?(?: GRANTED BY [A-Za-z_0-9]+)?;', line):
        print('MEMBERSHIP', line)
