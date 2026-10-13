"""Actual disposable CI systemd qualification; never runs the financial Host."""
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import socket
import stat
import subprocess
import time
import uuid


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def command(args, accepted=(0,)):
    result = subprocess.run(args, capture_output=True, text=True, timeout=15)
    require(result.returncode in accepted, 'DISPOSABLE_SYSTEMD_COMMAND_FAILED')
    return result


def state(name):
    result = command(['systemctl', 'show', name, '--property=ActiveState',
                      '--property=SubState', '--property=Result', '--property=NRestarts'])
    return dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)


def exclusive(path, data, mode):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def main():
    require(os.name == 'posix' and os.getuid() == 0 and
            os.environ.get('GITHUB_ACTIONS') == 'true' and
            os.environ.get('GITHUB_REPOSITORY') == 'masarifiratibi-spec/masarifi.ratibi_app' and
            os.environ.get('GITHUB_REF') == 'refs/heads/codex/voice-promoted-operating-2026-10-13' and
            socket.gethostname() != 'srv2006836' and
            pathlib.Path('/proc/1/comm').read_text().strip() == 'systemd',
            'DISPOSABLE_GITHUB_SYSTEMD_RUNNER_ONLY')
    parent = pathlib.Path(os.environ['RUNNER_TEMP']).resolve()
    require(parent.is_dir() and parent != pathlib.Path('/') and
            re.fullmatch(r'[A-Za-z0-9_./-]+', str(parent)), 'DISPOSABLE_RUNNER_TEMP_REQUIRED')
    root = parent / ('masarifi-disposable-bootstrap-' + str(uuid.uuid4()))
    root.mkdir(mode=0o700)
    source = pathlib.Path(__file__).with_name('promoted-operating-deploy.py')
    spec = importlib.util.spec_from_file_location('disposable_bootstrap_definition', source)
    deploy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deploy)
    require(not hasattr(deploy, 'LIVE_APPROVAL'), 'NO_LIVE_APPROVAL_ALLOWED')
    units = []
    cases = []
    started = time.monotonic()
    coordination = pathlib.Path('/run/lock/masarifi-staging-deployment.lock')
    directory = coordination.parent.lstat()
    require(stat.S_ISDIR(directory.st_mode) and directory.st_uid == 0 and
            stat.S_IMODE(directory.st_mode) == 0o1777 and
            coordination.parent.resolve() == coordination.parent,
            'ACTUAL_ROOT_OWNED_STICKY_1777_COORDINATION_DIRECTORY_REQUIRED')
    # This fixed production coordination path is exercised only on the guarded
    # disposable runner, and only if absent. Never adopt an existing runner file.
    exclusive(coordination, b'', 0o644)
    try:
        before = coordination.stat()
        require(before.st_uid == 0 and before.st_nlink == 1 and before.st_mode & 0o777 == 0o644,
                'DISPOSABLE_EXISTING_COORDINATION_MODE_REQUIRED')
        platform = deploy.RemotePlatform()
        probe = ("import fcntl,os,sys\nfd=os.open(sys.argv[1],os.O_RDWR|os.O_NOFOLLOW)\n"
                 "try:\n fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)\n print('ACQUIRED')\n"
                 "except BlockingIOError:print('BLOCKED')\nfinally:os.close(fd)\n")
        with platform.deployment_lock(platform.deadline(5)):
            require(command(['/usr/bin/python3', '-c', probe, str(coordination)]).stdout.strip() == 'BLOCKED',
                    'ACTUAL_COORDINATION_LOCK_MUST_EXCLUDE_COMPETING_WRITER')
        require(command(['/usr/bin/python3', '-c', probe, str(coordination)]).stdout.strip() == 'ACQUIRED',
                'ACTUAL_COORDINATION_LOCK_MUST_RELEASE')
        after = coordination.stat()
        require((before.st_dev, before.st_ino, before.st_mode, before.st_uid, before.st_size) ==
                (after.st_dev, after.st_ino, after.st_mode, after.st_uid, after.st_size),
                'EXISTING_COORDINATION_FILE_MUST_REMAIN_UNCHANGED')
        cases.append('actual root-owned sticky1777 directory and0644 coordination lock exclude competitor, release and preserve permissions/inode')
        for outcome in ['success', 'failed']:
            require(time.monotonic() - started < 60, 'DISPOSABLE_SYSTEMD_QUALIFICATION_BUDGET')
            fixture = root / outcome
            fixture.mkdir(mode=0o700)
            # The financial Host is never copied or invoked. Only this inert
            # filesystem recorder runs under the exact generated unit settings.
            stub = ("import json,pathlib,sys\n"
                    "p=pathlib.Path(__file__).with_name('calls.jsonl')\n"
                    "with p.open('a') as f:f.write(json.dumps({'action':sys.argv[1]})+'\\n')\n"
                    "sys.exit(7 if sys.argv[1]=='begin' and " + repr(outcome == 'failed') + " else 0)\n")
            exclusive(fixture / 'promoted-operating.py', stub.encode(), 0o600)
            name = root.name + '-' + outcome + '.service'
            unit = pathlib.Path('/run/systemd/system') / name
            missing = command(['systemctl', 'show', name, '--property=LoadState',
                               '--property=FragmentPath', '--property=ActiveState', '--property=SubState'])
            absent = dict(line.split('=', 1) for line in missing.stdout.splitlines() if '=' in line)
            require(absent.get('LoadState') == 'not-found' and absent.get('FragmentPath') == '' and
                    absent.get('ActiveState') == 'inactive', 'ACTUAL_FRESH_UNIT_QUERY_REQUIRED')
            text = deploy.bootstrap_text({'remoteRoot': str(fixture)})
            require('Type=oneshot\nRemainAfterExit=yes\n' in text and
                    'Restart=no\nTimeoutStartSec=300\nTimeoutStopSec=180\n' in text,
                    'EXACT_GENERATED_BOOTSTRAP_SETTINGS_REQUIRED')
            # Match the real installation: a private root-owned unit file and
            # one fresh systemd symlink, rather than a readable alternate unit.
            private_unit = fixture / name
            exclusive(private_unit, text.encode(), 0o600)
            os.symlink(private_unit, unit)
            units.append(unit)
            command(['systemctl', 'daemon-reload'])
            result = command(['systemctl', 'start', name], (0, 1))
            calls = lambda: [json.loads(line)['action'] for line in
                             (fixture / 'calls.jsonl').read_text().splitlines()]
            observed = state(name)
            require(observed.get('NRestarts') == '0', 'DISPOSABLE_BOOTSTRAP_MUST_NOT_RESTART')
            if outcome == 'success':
                require(result.returncode == 0 and observed.get('ActiveState') == 'active' and
                        observed.get('SubState') == 'exited' and calls() == ['begin'],
                        'SUCCESSFUL_BEGIN_MUST_REMAIN_ACTIVE_WITHOUT_EARLY_CLOSE')
                command(['systemctl', 'stop', name])
                require(state(name).get('ActiveState') == 'inactive' and calls() == ['begin', 'close'],
                        'OWNED_STOP_MUST_CLOSE_EXACTLY_ONCE')
                cases.append('actual successful oneshot remains active without early closure; owned stop closes once')
            else:
                require(result.returncode != 0 and observed.get('ActiveState') == 'failed' and
                        calls() == ['begin', 'close'], 'ACTUAL_FAILED_BEGIN_MUST_AUTOMATICALLY_CLOSE_ONCE')
                cases.append('actual failed begin invokes ExecStopPost once without restart or a second begin')
    finally:
        for unit in units:
            command(['systemctl', 'stop', unit.name], (0, 1, 5))
            command(['systemctl', 'reset-failed', unit.name], (0, 1))
            # Exact paths created exclusively in this invocation; no recursive
            # deletion, glob cleanup, or operation against application services.
            unit.unlink()
        if units:
            command(['systemctl', 'daemon-reload'])
        current = coordination.lstat()
        require((current.st_dev, current.st_ino) == (before.st_dev, before.st_ino),
                'ONLY_EXCLUSIVELY_OWNED_DISPOSABLE_COORDINATION_FILE_MAY_BE_REMOVED')
        coordination.unlink()
    print(json.dumps({'status': 'PASS', 'behavioralCases': len(cases), 'cases': cases,
                      'executorSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                      'disposableOnly': True, 'productionOrStagingAccess': False,
                      'physicalDeviceOperations': False, 'financialHostExecuted': False}))


if __name__ == '__main__':
    main()
