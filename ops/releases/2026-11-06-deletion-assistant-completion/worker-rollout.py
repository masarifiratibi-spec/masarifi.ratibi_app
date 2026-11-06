"""Artifact-bound, idle-only replacement of the existing Assistant worker.

The operator supplies fresh aggregate idle proofs through the authorized database
connector. This program never receives database credentials or changes job rows.
"""
import datetime
import fcntl
import hashlib
import http.client
import json
import pathlib
import re
import socket
import subprocess
import sys
import time
import uuid

ROOT = pathlib.Path('/var/tmp/masarifi-task31-day-evidence-20261106')
REVIEW = ROOT / 'reviewed-v2'
STATE = ROOT / 'rollout-state.private.json'


def now():
    return datetime.datetime.now(datetime.timezone.utc)


def load(path):
    return json.loads(path.read_text())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def run(*args):
    result = subprocess.run(list(args), capture_output=True, timeout=35)
    if result.returncode:
        raise RuntimeError('DOCKER_OPERATION_FAILED_' + args[1])
    return result.stdout


def inspect(cid):
    return json.loads(run('docker', 'inspect', cid))[0]


def save(state):
    temporary = ROOT / 'rollout-state.next.private.json'
    temporary.write_text(json.dumps(state, indent=2))
    temporary.chmod(0o600)
    temporary.replace(STATE)


def idle(path, manifest_sha, nonce=None, after=None):
    proof = load(path)
    assert proof['projectId'] == 'qcffvfbpzvpwcwxwjyro'
    assert proof['reviewedManifestSha256'] == manifest_sha
    assert set(proof['counts']) == {'agentQueued', 'messageQueued', 'agentProcessing', 'messageProcessing', 'claimQueriesInFlight'}
    assert all(type(value) is int and value == 0 for value in proof['counts'].values())
    observed = datetime.datetime.fromisoformat(proof['observedAtUtc'])
    assert -1 <= (now() - observed).total_seconds() <= 10
    if nonce is not None:
        assert proof['pauseNonce'] == nonce and observed > datetime.datetime.fromisoformat(after)
    assert proof['authorizedConnectorReadOnly'] is True


def healthy(cid):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        state = inspect(cid)['State']
        assert state['Running'] and not state['Paused']
        if state.get('Health', {}).get('Status') == 'healthy':
            return
        time.sleep(1)
    raise RuntimeError('WORKER_HEALTH_REQUIRES_RECONCILIATION_DO_NOT_STOP_ACTIVE_WORK')


class Engine(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(20)
        self.sock.connect('/var/run/docker.sock')


def create(before, image, name):
    config = {**before['Config'], 'Image': image}
    version = run('docker', 'version', '--format', '{{.Server.APIVersion}}').decode().strip()
    connection = Engine('localhost')
    try:
        connection.request('POST', '/v' + version + '/containers/create?name=' + name,
                           json.dumps({**config, 'HostConfig': before['HostConfig']}),
                           {'Content-Type': 'application/json'})
        response = connection.getresponse()
        body = response.read()
        assert response.status == 201, 'CREATE_FAILED_WITHOUT_START'
        return json.loads(body)['Id'], config
    finally:
        connection.close()


def check_serving(base, old, active):
    ids = run('docker', 'ps', '-q').decode().split()
    actual = {c['Id']: (c['Image'], c['State']['StartedAt']) for c in json.loads(run('docker', 'inspect', *ids))}
    expected = {c['id']: (c['imageId'], c['startedAt']) for c in base['containers'] if c['id'] != old}
    assert all(actual.get(cid) == values for cid, values in expected.items())
    assert set(actual) == set(expected) | {active}


def host_config_matches(actual, expected):
    # Docker persists legacy null as false on creation; both leave OOM killing enabled.
    # Permit only that observed representation change, never true or another field.
    if expected.get('OomKillDisable', 'missing') is None and actual.get('OomKillDisable', 'missing') is False:
        expected = {**expected, 'OomKillDisable': False}
    return actual == expected


def main(action):
    assert action in ['prepare', 'pause-forward', 'replace-forward', 'pause-rollback', 'replace-rollback', 'resume', 'watch']
    manifest_path = REVIEW / 'manifest.json'
    manifest = load(manifest_path)
    approval = load(ROOT / 'actual-user-approval-v2.private.json')
    assert approval['approved'] is True and approval['actualUserReply'].strip()
    manifest_sha = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    assert approval['reviewedManifestSha256'] == manifest_sha
    assert approval['reviewedWorkerImageId'] == manifest['candidateImageId']
    assert hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest() == manifest['reviewedFilePins']['worker-rollout.py']
    assert all(hashlib.sha256((REVIEW / name).read_bytes()).hexdigest() == pin for name, pin in manifest['reviewedFilePins'].items())
    base = load(ROOT / 'worker-before.private.json')
    before = base['workerInspect']
    old = manifest['originalWorkerId']
    assert old == before['Id'] and before['Image'] == manifest['baseImageId']
    assert digest(before['Config']) == manifest['workerConfigSha256']
    assert digest(before['HostConfig']) == manifest['workerHostConfigSha256']
    with (ROOT / 'rollout.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if action == 'watch':
            # The pause caller starts this process before pausing; its fixed
            # deadline restores only a still-paused process, never a second worker.
            state = load(STATE)
            if sys.argv[2] != state['pauseNonce'] or now() < datetime.datetime.fromisoformat(state['pauseExpiresAtUtc']):
                return
            paused = inspect(state['pausedId'])['State']
            if paused['Running'] and paused['Paused']:
                run('docker', 'unpause', state['pausedId'])
                state['watchdogResumedOriginalPause'] = True
                state['phase'] = 'prepared-runtime-verified' if state['pauseDirection'] == 'forward' else 'active'
                save(state)
            return
        operation = sys.argv[2]
        assert re.fullmatch(r'[a-z][a-z0-9-]{0,63}', operation)
        marker = ROOT / ('rollout-' + action + '-' + operation + '-dispatch.json')
        assert not marker.exists(), 'RECONCILE_CONSUMED_ACTION_NOT_REPLAY'
        marker.write_text(json.dumps({'atUtc': now().isoformat(), 'action': action}))
        if action == 'prepare':
            state = load(STATE)
            assert state['phase'] == 'created-stopped'
            assert state['candidateId'] == manifest['preparedCandidateId']
            current = inspect(old)
            check_serving(base, old, old)
            assert current['State']['Running'] and not current['State']['Paused']
            assert current['Config'] == before['Config'] and current['HostConfig'] == before['HostConfig']
            expected = {**before['Config'], 'Image': manifest['candidateImageId']}
            assert state['expectedConfig'] == expected
            cid = state['candidateId']
            created = inspect(cid)
            assert not created['State']['Running']
            assert created['Image'] == manifest['candidateImageId'] and created['Config'] == expected and host_config_matches(created['HostConfig'], before['HostConfig'])
            assert set(created['NetworkSettings']['Networks']) == {'masarifi-staging_backend'}
            state = load(STATE)
            state['phase'] = 'prepared-runtime-verified'
            save(state)
        elif action in ['pause-forward', 'pause-rollback']:
            state = load(STATE)
            forward = action == 'pause-forward'
            assert state['phase'] == ('prepared-runtime-verified' if forward else 'active')
            idle(ROOT / (action + '-' + operation + '-idle.private.json'), manifest_sha)
            target = old if forward else state['candidateId']
            check_serving(base, old, target)
            assert inspect(target)['State']['Running'] and not inspect(target)['State']['Paused']
            assert inspect(target)['Config'] == (before['Config'] if forward else state['expectedConfig'])
            assert host_config_matches(inspect(target)['HostConfig'], before['HostConfig'])
            state.update(pausedId=target, pauseNonce=str(uuid.uuid4()), pauseDirection='forward' if forward else 'rollback', pauseExpiresAtUtc=(now()+datetime.timedelta(seconds=30)).isoformat())
            save(state)
            with (ROOT / (action + '-' + operation + '-watchdog.private.log')).open('x') as log:
                subprocess.Popen([sys.executable, '-B', '-c', 'import runpy,time,sys;time.sleep(30);sys.argv=[sys.argv[1],"watch",sys.argv[2]];runpy.run_path(sys.argv[0],run_name="__main__")', str(pathlib.Path(__file__).resolve()), state['pauseNonce']], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
            run('docker', 'pause', target)
            state.update(phase='paused', pausedAtUtc=now().isoformat())
            save(state)
        elif action in ['replace-forward', 'replace-rollback']:
            state = load(STATE)
            forward = action == 'replace-forward'
            assert state['phase'] == 'paused' and state['pauseDirection'] == ('forward' if forward else 'rollback')
            assert (datetime.datetime.fromisoformat(state['pauseExpiresAtUtc']) - now()).total_seconds() >= 8
            idle(ROOT / (action + '-' + operation + '-idle.private.json'), manifest_sha, state['pauseNonce'], state['pausedAtUtc'])
            target = old if forward else state['candidateId']
            check_serving(base, old, target)
            destination = state['candidateId'] if forward else old
            assert target == state['pausedId'] and inspect(target)['State']['Paused']
            assert not inspect(destination)['State']['Running']
            # Actual Docker pause/manual-stop behavior was qualified in isolation.
            # Never send this signal until both fresh post-pause idle gates pass.
            run('docker', 'stop', '--signal', 'SIGKILL', '--timeout', '1', target)
            assert not inspect(target)['State']['Running']
            run('docker', 'rename', target, 'masarifi-task31-assistant-rollback-20261106' if forward else 'masarifi-task31-assistant-failed-20261106')
            run('docker', 'rename', destination, before['Name'].lstrip('/'))
            run('docker', 'start', destination)
            state.update(phase='active' if forward else 'rolled-back', activeId=destination)
            save(state)
            healthy(destination)
            check_serving(base, old, destination)
        elif action == 'resume':
            state = load(STATE)
            assert state['phase'] == 'paused'
            target = state['pausedId']
            assert inspect(target)['State']['Running'] and inspect(target)['State']['Paused']
            run('docker', 'unpause', target)
            state['phase'] = 'prepared-runtime-verified' if state['pauseDirection'] == 'forward' else 'active'
            save(state)
        else:
            raise RuntimeError('UNKNOWN_OPERATION')
        print(json.dumps({'action': action, 'phase': load(STATE)['phase'], 'atUtc': now().isoformat()}))


if __name__ == '__main__':
    main(sys.argv[1])
