"""Start storage on the private Docker network; do not change public routing or any API."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess as sp
import time
import urllib.request

ROOT = Path('/var/tmp/masarifi-selfhost-20261113')
DATA = Path('/srv/masarifi/files')
KEY = Path('/etc/masarifi/selfhost/storage.key')
NAME = 'masarifi-private-storage'
TAG = 'masarifi-private-storage:20261113'


def run(*args):
    p = sp.run(args, capture_output=True, timeout=120)
    if p.returncode:
        raise RuntimeError('STORAGE_PREPARATION_COMMAND_FAILED:' + str(p.returncode))
    return p.stdout


def main():
    os.umask(0o077)
    assert not (ROOT / 'storage-prepared.json').exists(), 'Inspect existing receipt instead of repeating'
    baseline = json.loads((ROOT / 'inventory.json').read_text())
    api = next(c for c in baseline if c['name'] == '/masarifi-production-core-api-20261105-97e66588')
    live = json.loads(run('docker', 'inspect', api['name']))[0]
    assert live['Image'] == api['image'], 'LIVE_IMAGE_CHANGED'
    ids = run('docker', 'ps', '-q').decode().split()
    before = {c['Id']: (c['Image'], c['State']['StartedAt']) for c in json.loads(run('docker', 'inspect', *ids))}
    base = 'masarifi-selfhost-base:' + live['Image'][7:19]
    run('docker', 'tag', live['Image'], base)
    image = json.loads(run('docker', 'image', 'inspect', base))[0]
    assert image['Id'] == live['Image']
    for item in image['Config'].get('Env', []):
        assert not any(part in item.split('=', 1)[0] for part in ('DATABASE_URL', 'SECRET', 'TOKEN', 'PASSWORD', 'SERVICE_ROLE_KEY')), 'IMAGE_CONTAINS_CREDENTIAL_CONFIGURATION'
    context = ROOT / 'storage-image'
    assert context.is_dir() and (context / 'service.mjs').is_file() and (context / 'Dockerfile').is_file()
    run('docker', 'build', '--network=none', '--pull=false', '--build-arg', 'BASE_IMAGE=' + base, '-t', TAG, str(context))
    DATA.mkdir(mode=0o700, parents=True, exist_ok=True)
    assert DATA.resolve() == DATA and not DATA.is_symlink()
    os.chown(DATA, 65532, 65532)
    KEY.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    existing_probe = sp.run(['docker', 'inspect', NAME], capture_output=True)
    existing = json.loads(existing_probe.stdout)[0] if existing_probe.returncode == 0 else None
    if existing:
        assert existing['Config'].get('Labels', {}).get('masarifi.scope') == 'selfhost'
        # Docker may assign a new image ID on a byte-identical rebuild. Qualify
        # the served bytes and base layers, not the mutable tag or build timestamp.
        assert existing['Config']['User'] == '65532:65532'
        assert existing['HostConfig']['ReadonlyRootfs']
        assert existing['Config']['Entrypoint'] == ['/nodejs/bin/node']
        assert existing['Config']['Cmd'] == ['/app/selfhost/storage.mjs']
        served_sha = run('docker', 'exec', NAME, '/nodejs/bin/node', '-e', "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/selfhost/storage.mjs')).digest('hex'))").decode()
        assert served_sha == hashlib.sha256((context / 'service.mjs').read_bytes()).hexdigest()
        binary_probe = "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.execPath)).digest('hex'))"
        assert run('docker', 'exec', NAME, '/nodejs/bin/node', '-e', binary_probe) == run('docker', 'exec', live['Id'], '/nodejs/bin/node', '-e', binary_probe), 'RUNTIME_BINARY_DIFFERS'
        mounts = {m['Destination']: m['Source'] for m in existing['Mounts']}
        assert mounts.get('/data') == str(DATA) and mounts.get('/run/secrets/storage-key') == str(KEY)
        assert KEY.is_file() and not KEY.is_symlink() and len(KEY.read_text().strip()) >= 32
    else:
        assert not KEY.exists(), 'Existing storage key requires reconciliation'
        with KEY.open('x') as file:
            file.write(secrets.token_urlsafe(48))
        os.chown(KEY, 65532, 65532)
        KEY.chmod(0o400)
    origins = sorted({value.strip() for c in json.loads(run('docker', 'inspect', *ids)) for entry in c['Config']['Env'] if entry.startswith('MASARIFI_CORS_ORIGINS=') for value in entry.split('=', 1)[1].split(',') if value.strip().startswith('https://')})
    if not existing:
      run('docker', 'run', '--detach', '--name', NAME, '--network', 'masarifi-selfhost-data', '--ip', '172.16.3.3',
        '--user=65532:65532', '--init', '--read-only', '--cap-drop=ALL',
        '--security-opt=no-new-privileges:true', '--pids-limit=64', '--memory=192m', '--cpus=0.5',
        '--mount', f'type=bind,src={DATA},dst=/data',
        '--mount', f'type=bind,src={KEY},dst=/run/secrets/storage-key,readonly',
        '--restart=unless-stopped',
        '--log-driver=journald', '--log-opt', 'tag=masarifi.storage',
        '--label', 'masarifi.scope=selfhost', '--env', 'MASARIFI_STORAGE_ROOT=/data',
        '--env', 'MASARIFI_STORAGE_URL=https://api.masarifiratibi.com',
        '--env', 'MASARIFI_RELEASE_VERSION=selfhost-20261113',
        '--env', 'MASARIFI_CORS_ORIGINS=' + ','.join(origins), TAG)
    storage = json.loads(run('docker', 'inspect', NAME))[0]
    private_ip = storage['NetworkSettings']['Networks']['masarifi-selfhost-data']['IPAddress']
    assert private_ip and json.loads(run('docker', 'network', 'inspect', 'masarifi-selfhost-data'))[0]['Internal']
    private_origin = 'http://' + private_ip + ':8080'
    for _ in range(30):
        try:
            with urllib.request.urlopen(private_origin + '/health/ready', timeout=2) as response:
                assert json.load(response)['status'] == 'ready'
            break
        except (OSError, ValueError):
            time.sleep(1)
    else:
        raise RuntimeError('STORAGE_NOT_READY')
    after = {c['Id']: (c['Image'], c['State']['StartedAt']) for c in json.loads(run('docker', 'inspect', *before))}
    assert before == after, 'EXISTING_SERVICE_IDENTITY_CHANGED'
    receipt = {'state': 'private-ready', 'container': NAME,
               'image': storage['Image'],
               'codeSha256': hashlib.sha256((context / 'service.mjs').read_bytes()).hexdigest(),
               'data': str(DATA), 'keyFile': str(KEY), 'listen': private_origin,
               'publicRouteChanged': False, 'existingServicesPreserved': len(before)}
    with (ROOT / 'storage-prepared.json').open('x') as file:
        json.dump(receipt, file, indent=2)
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__':
    main()
