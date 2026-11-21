"""Read-only logical transfer into the non-serving rehearsal database; no dump file."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shlex
import subprocess as sp
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit, unquote

IMAGE = 'sha256:5a4314708484bec672de2c09653a5c01fb1c84a998564ac231b0325e2238ed5b'
QUALIFIED = len(sys.argv) == 3 and sys.argv[2] == 'qualified'
TARGET = 'masarifi-postgres17' if QUALIFIED else 'masarifi-postgres17-rehearsal'
ROOT = Path('/var/tmp/masarifi-selfhost-20261113')
ENV = Path('/etc/masarifi/migration.env')


def target_sql(sql):
    p = sp.run(['docker', 'exec', '-i', TARGET, 'psql', '-h', '/tmp', '-U', 'supabase_admin',
                '-d', 'postgres', '-XAt', '-v', 'ON_ERROR_STOP=1'], input=sql.encode(), capture_output=True, timeout=30)
    if p.returncode:
        raise RuntimeError('TARGET_PROBE_FAILED')
    return p.stdout.decode().strip()


def source_script(command, read_only=True):
    env = {}
    for line in ENV.read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            k, value = line.split('=', 1)
            parts = shlex.split(value)
            env[k] = parts[0] if parts else ''
    u = urlsplit(env['DATABASE_URL'])
    assert u.hostname == 'aws-0-eu-central-1.pooler.supabase.com' and u.username == 'postgres.qcffvfbpzvpwcwxwjyro'
    values = {'PGHOST': u.hostname, 'PGPORT': str(u.port or 5432), 'PGUSER': unquote(u.username),
              'PGPASSWORD': unquote(u.password), 'PGDATABASE': u.path.lstrip('/') or 'postgres',
              'PGSSLMODE': 'verify-full', 'PGSSLROOTCERT': '/certs/ca.crt', 'PGCONNECT_TIMEOUT': '10',
              'PGAPPNAME': 'masarifi-selfhost-rehearsal',
              'PGOPTIONS': '-c default_transaction_read_only='+('on' if read_only else 'off')+' -c lock_timeout=5000'}
    # Credentials travel only over the container's stdin, never args, logs, disk or Docker Env.
    return ('set -eu\nunset PGSERVICE PGSERVICEFILE\n' + ''.join('export '+k+'='+shlex.quote(v)+'\n' for k, v in values.items()) + 'exec '+shlex.join(command)+'\n').encode()


def transfer(mode):
    os.umask(0o077)
    assert mode in ('roles', 'database')
    prepared = json.loads((ROOT / ('database-prepared-qualified.json' if QUALIFIED else 'database-prepared.json')).read_text())
    assert prepared['state'] == 'rehearsal-empty-ready' and prepared['cronActiveJobs'] is False
    assert target_sql("select current_setting('cron.launch_active_jobs')") == 'off'
    receipt_path = ROOT / (mode + ('-transfer-qualified.json' if QUALIFIED else '-transfer.json'))
    assert not receipt_path.exists(), 'Already attempted: inspect the receipt and reconcile target before retrying'
    if mode == 'database':
        assert json.loads((ROOT / ('roles-transfer-qualified.json' if QUALIFIED else 'roles-transfer-r2.json')).read_text())['state'] == 'passed'
        assert target_sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth','audit','storage','supabase_migrations') and c.relkind in('r','p')") == '0'
        command = ['pg_dump', '--format=plain', '--no-publications', '--no-subscriptions', '--lock-wait-timeout=5s']
    else:
        command = ['pg_dumpall', '--roles-only', '--no-role-passwords']
    started = time.monotonic()
    if mode == 'roles' and QUALIFIED:
        source = sp.run(['docker', 'run', '--rm', '--label', 'masarifi.selfhost.transfer=20261113', '--log-driver=none', '-i', '--network=host', '--read-only',
                         '--mount', 'type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly',
                         '--entrypoint=/bin/sh', IMAGE], input=source_script(command), capture_output=True, timeout=60)
        assert source.returncode == 0, 'SOURCE_ROLE_READ_FAILED'
        # The fresh target already has the source bootstrap identity, OID 10.
        create = b'\nCREATE ROLE supabase_admin;\n'
        assert source.stdout.count(create) == 1, 'BOOTSTRAP_ROLE_DUMP_DRIFT'
        roles = source.stdout.replace(create, b'\n')
        target = sp.run(['docker', 'exec', '-i', TARGET, 'psql', '-h', '/tmp', '-U', 'supabase_admin',
                          '-d', 'postgres', '-Xq', '--single-transaction', '-v', 'ON_ERROR_STOP=1'],
                         input=roles, capture_output=True, timeout=60)
        receipt = {'mode': mode, 'state': 'passed' if target.returncode == 0 else 'failed',
                   'seconds': round(time.monotonic()-started, 3), 'sourceExit': 0, 'targetExit': target.returncode,
                   'errorHash': hashlib.sha256(target.stderr).hexdigest(), 'retainedDump': False, 'sourceReadOnly': True}
        with receipt_path.open('x') as file: json.dump(receipt, file, indent=2)
        print(json.dumps(receipt), flush=True)
        if target.returncode: raise SystemExit(1)
        return
    producer = sp.Popen(['docker', 'run', '--rm', '--label', 'masarifi.selfhost.transfer=20261113', '--log-driver=none', '-i', '--network=host', '--read-only',
                         '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
                         '--mount', 'type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly',
                         '--entrypoint=/bin/sh', IMAGE], stdin=sp.PIPE, stdout=sp.PIPE, stderr=sp.PIPE)
    consumer = sp.Popen(['docker', 'exec', '-i', TARGET, 'psql', '-h', '/tmp', '-U', 'supabase_admin',
                         '-d', 'postgres', '-Xq', '-v', 'ON_ERROR_STOP=1'], stdin=sp.PIPE if QUALIFIED else producer.stdout, stdout=sp.DEVNULL, stderr=sp.PIPE)
    if not QUALIFIED: producer.stdout.close()
    producer.stdin.write(source_script(command)); producer.stdin.close(); producer.stdin = None
    readers=ThreadPoolExecutor(max_workers=2)
    source_errors=readers.submit(producer.stderr.read)
    target_errors=readers.submit(consumer.stderr.read)
    try:
        if QUALIFIED:
            assert json.loads((ROOT/'extensions-prepared-qualified.json').read_text())['state'] == 'passed'
            spec = importlib.util.spec_from_file_location('logical_stream', ROOT/'logical_stream.py')
            module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
            try:
                for line in module.skip_precreated_schemas(producer.stdout, {'extensions','pgmq','vault'}):
                    consumer.stdin.write(line)
                consumer.stdin.close(); consumer.stdin = None
            except BrokenPipeError:
                producer.kill()
                try:consumer.stdin.close()
                except BrokenPipeError:pass
                consumer.stdin = None
        consumer.wait(timeout=1200);producer.wait(timeout=30)
        target_error=target_errors.result(timeout=5);source_error=source_errors.result(timeout=5)
    except BaseException:
        for process in (producer,consumer):
            if process.poll() is None:process.kill()
        for process in (producer,consumer):process.wait(timeout=10)
        raise
    finally:
        readers.shutdown(wait=True)
    state = 'passed' if producer.returncode == 0 and consumer.returncode == 0 else 'failed'
    # Provider errors can contain SQL/row values; do not print or persist their text.
    hints = ['permission denied', 'already exists', 'does not exist', 'SSL error', 'certificate verify failed', 'connection timed out', 'must be owner', 'must be superuser']
    errors = source_error + target_error
    receipt = {'mode': mode, 'state': state, 'seconds': round(time.monotonic()-started, 3),
               'sourceExit': producer.returncode, 'targetExit': consumer.returncode,
               'errorHash': hashlib.sha256(errors).hexdigest(),
               'diagnosticHints': [hint for hint in hints if hint.encode() in errors],
               'retainedDump': False, 'sourceReadOnly': True, 'targetCronActive': False}
    with receipt_path.open('x') as file:
        json.dump(receipt, file, indent=2)
    print(json.dumps(receipt), flush=True)
    if state != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    assert len(sys.argv) in (2,3) and (len(sys.argv)==2 or sys.argv[2]=='qualified'), 'Unknown transfer mode'
    transfer(sys.argv[1])
