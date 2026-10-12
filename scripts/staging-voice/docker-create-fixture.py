"""Disposable CI only: reproduce create requests without starting an application."""
import copy
import http.client
import json
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import uuid


def run(*args):
    return subprocess.check_output(args, text=True, timeout=60).strip()


class UnixConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')


def request(version, name, payload):
    connection = UnixConnection('localhost', timeout=20)
    try:
        connection.request('POST', '/v' + version + '/containers/create?name=' + name,
                           json.dumps(payload), {'Content-Type': 'application/json'})
        response = connection.getresponse()
        body = json.loads(response.read(65536))
        return {'status': response.status, 'body': body}
    finally:
        connection.close()


def main():
    if not (os.name == 'posix' and os.geteuid() == 0 and
            os.environ.get('GITHUB_ACTIONS') == 'true' and
            socket.gethostname() != 'srv2006836' and
            os.environ.get('GITHUB_REPOSITORY') == 'masarifiratibi-spec/masarifi.ratibi_app'):
        raise RuntimeError('DISPOSABLE_CI_ONLY')
    fixture = json.loads(pathlib.Path(sys.argv[1]).read_text())
    payload = fixture['payload']
    if any(value.split('=', 1)[1] != 'INERT_FIXTURE' for value in payload['Env']):
        raise RuntimeError('INERT_ENVIRONMENT_REQUIRED')
    version = json.loads(run('docker', 'version', '--format', '{{json .Server}}'))
    identity = 'masarifi-create-fixture-' + uuid.uuid4().hex
    network = identity + '-net'
    report = {'fixtureOnly': True, 'applicationStarted': False, 'stagingAccess': False,
              'engine': version, 'stagingEngine': fixture['server'], 'cases': []}
    output = pathlib.Path(os.environ['RUNNER_TEMP'], 'docker-create-report.json')
    names = []
    network_created = False
    with tempfile.TemporaryDirectory(prefix=identity) as temporary:
        ca = pathlib.Path(temporary, 'inert-ca.crt')
        ca.write_text('INERT_FIXTURE')
        try:
            run('docker', 'pull', 'busybox:1.37.0')
            image = run('docker', 'image', 'inspect', 'busybox:1.37.0', '--format', '{{.Id}}')
            run('docker', 'network', 'create', '--internal', '--label', 'org.masarifi.fixture=' + identity, network)
            network_created = True
            for case in ['retained-payload', 'default-hostname', 'zero-shm', 'explicit-request-fields']:
                current = copy.deepcopy(payload)
                current['Image'] = image
                current['HostConfig']['NetworkMode'] = network
                current['HostConfig']['Binds'] = [str(ca) + ':/etc/ssl/certs/masarifi-database-ca.crt:ro']
                if case == 'default-hostname':
                    current['Hostname'] = ''
                if case == 'zero-shm':
                    current['HostConfig']['ShmSize'] = 0
                if case == 'explicit-request-fields':
                    current['Hostname'] = ''
                    # Inspect defaults are not necessarily valid create inputs.
                    keys = ['Binds', 'LogConfig', 'NetworkMode', 'PortBindings', 'RestartPolicy',
                            'AutoRemove', 'CapDrop', 'IpcMode', 'ReadonlyRootfs', 'SecurityOpt',
                            'Tmpfs', 'Memory', 'NanoCpus', 'PidsLimit', 'Init']
                    current['HostConfig'] = {key: current['HostConfig'][key] for key in keys}
                name = identity + '-' + case
                names.append(name)  # Reconcile even a lost create response.
                result = request(version['ApiVersion'], name, current)
                report['cases'].append({'case': case, **result})
                if result['status'] == 201:
                    inspected = json.loads(run('docker', 'inspect', name))[0]
                    if inspected['State']['Running']:
                        raise RuntimeError('FIXTURE_MUST_NEVER_START')
                    report['cases'][-1]['running'] = False
        finally:
            # Keep Engine responses even if a subsequent cleanup command fails.
            report['cleanupVerified'] = False
            output.write_text(json.dumps(report, indent=2))
            errors = []
            for name in names:
                existing = run('docker', 'ps', '-a', '--filter', 'name=^/' + name + '$', '--format', '{{.ID}}')
                if existing:
                    inspected = json.loads(run('docker', 'inspect', name))[0]
                    if inspected['Name'] != '/' + name or inspected['State']['Running']:
                        errors.append('OWNED_STOPPED_FIXTURE_UNCONFIRMED')
                    else:
                        run('docker', 'rm', name)
            if network_created:
                run('docker', 'network', 'rm', network)
            report['cleanupVerified'] = not errors
            output.write_text(json.dumps(report, indent=2))
            if errors:
                raise RuntimeError(';'.join(errors))
    print(json.dumps(report, indent=2))
    if not any(case['status'] == 201 for case in report['cases']):
        raise RuntimeError('NO_CREATE_VARIANT_ACCEPTED')


if __name__ == '__main__':
    main()
