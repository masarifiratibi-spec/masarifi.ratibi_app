"""Provision only the private, non-serving rehearsal database. No source writes."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

IMAGE = 'sha256:5a4314708484bec672de2c09653a5c01fb1c84a998564ac231b0325e2238ed5b'
QUALIFIED = sys.argv[1:] == ['qualified']
NAME = 'masarifi-postgres17' if QUALIFIED else 'masarifi-postgres17-rehearsal'
NETWORK = 'masarifi-selfhost-data'
DATA = Path('/srv/masarifi/postgresql17' if QUALIFIED else '/srv/masarifi/postgresql17-rehearsal')
RECEIPTS = Path('/var/tmp/masarifi-selfhost-20261113')


def run(*args, timeout=90):
    result = subprocess.run(args, capture_output=True, timeout=timeout)
    if result.returncode:
        # Provisioning has no user data/credentials, but retain only a bounded diagnostic.
        raise RuntimeError(f'{args[:3]} exited {result.returncode}: {result.stderr.decode()[-400:]}')
    return result.stdout


def main():
    assert sys.argv[1:] in ([], ['qualified']), 'Unknown preparation mode'
    os.umask(0o077)
    image = json.loads(run('docker', 'image', 'inspect', IMAGE))[0]
    assert image['Id'] == IMAGE
    assert not DATA.exists(), 'Target already exists; inspect its receipt instead of overwriting it'
    assert not subprocess.run(['docker', 'container', 'inspect', NAME], capture_output=True).returncode == 0, 'Container already exists'
    before = {c['Id']: (c['Image'], c['State']['StartedAt']) for c in json.loads(run('docker', 'inspect', *run('docker', 'ps', '-q').decode().split()))}
    RECEIPTS.mkdir(mode=0o700, exist_ok=True)
    DATA.mkdir(mode=0o700, parents=True)
    assert DATA.resolve() == DATA and not DATA.is_symlink()
    os.chown(DATA, 100, 101)
    mount = f'type=bind,src={DATA},dst=/var/lib/postgresql/data'
    run('docker', 'run', '--rm', '--log-driver=none', '--network=none', '--user=100:101', '--mount', mount,
        '--entrypoint=initdb', IMAGE, '-D', '/var/lib/postgresql/data',
        '--username=supabase_admin', '--auth-local=trust', '--auth-host=reject',
        '--encoding=UTF8', '--locale-provider=icu', '--icu-locale=en-US', '--locale=en_US.UTF-8')
    if subprocess.run(['docker', 'network', 'inspect', NETWORK], capture_output=True).returncode:
        run('docker', 'network', 'create', '--internal', '--label', 'masarifi.scope=selfhost', NETWORK)
    network = json.loads(run('docker', 'network', 'inspect', NETWORK))[0]
    assert network['Internal'] and network.get('Labels', {}).get('masarifi.scope') == 'selfhost'
    run('docker', 'run', '--detach', '--name', NAME, '--network', NETWORK,
        '--user=100:101', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
        '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--pids-limit=128',
        '--memory=768m', '--cpus=1', '--shm-size=128m', '--mount', mount,
        '--log-driver=journald', '--log-opt', 'tag=masarifi.postgres.rehearsal',
        '--label', 'masarifi.scope=selfhost', '--restart=unless-stopped',
        '--entrypoint=postgres', IMAGE, '-D', '/var/lib/postgresql/data',
        '-c', 'listen_addresses=*', '-c', 'unix_socket_directories=/tmp',
        '-c', 'shared_preload_libraries=pg_cron,pg_stat_statements',
        '-c', 'cron.database_name=postgres', '-c', 'cron.launch_active_jobs=off',
        '-c', 'shared_buffers=128MB', '-c', 'work_mem=4MB', '-c', 'max_connections=100',
        '-c', 'log_statement=none', '-c', 'log_min_messages=fatal', '-c', 'log_min_error_statement=panic',
        '-c', 'log_parameter_max_length=0', '-c', 'log_parameter_max_length_on_error=0')
    for _ in range(30):
        probe = subprocess.run(['docker', 'exec', NAME, 'pg_isready', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres'], capture_output=True)
        if probe.returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError('REHEARSAL_DATABASE_NOT_READY')
    target = json.loads(run('docker', 'inspect', NAME))[0]
    assert not target['HostConfig'].get('PortBindings')
    after = {c['Id']: (c['Image'], c['State']['StartedAt']) for c in json.loads(run('docker', 'inspect', *before))}
    assert before == after, 'Existing service identity changed'
    receipt = {'container': NAME, 'image': IMAGE, 'data': str(DATA), 'network': NETWORK,
               'publishedPorts': [], 'cronActiveJobs': False, 'existingServicesPreserved': len(before),
               'state': 'rehearsal-empty-ready'}
    path = RECEIPTS / ('database-prepared-qualified.json' if QUALIFIED else 'database-prepared.json')
    with path.open('x') as file:
        json.dump(receipt, file, indent=2)
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
