"""One-time, separately approved installer for the frozen operating controller.

No approval is synthesized here. Execute consumes a local durable marker before
one SSH dispatch; reconciliation is a separate, once-only read of owned files.
Importing this module has no transport or deployment effects.
"""
import base64
import ast
import contextlib
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import socket
import stat
import subprocess
import sys
import tempfile
import time

sys.dont_write_bytecode = True
HERE = pathlib.Path(__file__).resolve().parent
SSH_TARGET = 'masarifi@187.77.81.97'
KNOWN_HOSTS = pathlib.Path('C:/Users/DELL/.ssh/known_hosts_masarifi_staging')
SSH_BINARY = 'C:/Windows/System32/OpenSSH/ssh.exe'
SSH_IDENTITY = 'C:/Users/DELL/.ssh/masarifi_staging_ed25519'
CONTROLLER_FILES = {'promoted-operating.py', 'operating-ingress.py', 'operating-lifecycle.py',
                    'operating-db.cjs', 'customer-operating-cohort.py', 'canary-host.py', 'canary-control.py'}
SCOPE_FIELDS = {'kind', 'version', 'project', 'host', 'generation', 'packetHash', 'remoteRoot',
                'bootstrapUnit', 'bundleHashes', 'executorHash', 'packetFile', 'bundleFile',
                'localEvidence', 'knownHostsHash'}
APPROVAL_FIELDS = {'kind', 'scopeHash', 'receivedAt', 'activationExpiresAt',
                   'messageReference', 'verbatimMessage', 'operatingApproval'}
HASH = re.compile(r'[a-f0-9]{64}')
UUID = re.compile(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}')


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'),
                      ensure_ascii=False, allow_nan=False).encode('utf-8')


def sha(value):
    return hashlib.sha256(value).hexdigest()


def scope_hash(scope):
    return sha(canonical(scope))


def parse(data):
    def unique(pairs):
        value = {}
        for key, entry in pairs:
            require(key not in value, 'DUPLICATE_JSON_KEY')
            value[key] = entry
        return value
    def invalid(_value):
        raise RuntimeError('NONFINITE_JSON')
    try:
        return json.loads(data, object_pairs_hook=unique, parse_constant=invalid)
    except (ValueError, TypeError, UnicodeError) as error:
        raise RuntimeError('INVALID_JSON') from error


def load_host(root):
    spec = importlib.util.spec_from_file_location('deployment_frozen_operating', root / 'promoted-operating.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class HostSchema:
    # Public inert schema helpers; importing the executor never executes any
    # unverified controller source. Validation loads a pinned private snapshot.
    CONTROLLER_FILES = CONTROLLER_FILES

    @staticmethod
    def scope_name(packet):
        return 'masarifi-customer-voice-' + packet['generation']


host = HostSchema()


def regular_bytes(path, maximum=64 * 1024 * 1024):
    path = pathlib.Path(path)
    try:
        metadata = path.lstat()
        require(path.is_absolute() and path.resolve() == path.absolute() and
                stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1 and
                metadata.st_size <= maximum, 'REGULAR_PINNED_FILE_REQUIRED')
        descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
        with os.fdopen(descriptor, 'rb') as stream:
            current = os.fstat(stream.fileno())
            require((current.st_dev, current.st_ino, current.st_size) ==
                    (metadata.st_dev, metadata.st_ino, metadata.st_size), 'PINNED_FILE_CHANGED')
            data = stream.read(maximum + 1)
        require(len(data) <= maximum, 'PINNED_FILE_TOO_LARGE')
        return data
    except OSError as error:
        raise RuntimeError('PINNED_FILE_UNAVAILABLE') from error


def validate_scope(scope):
    require(isinstance(scope, dict) and set(scope) == SCOPE_FIELDS and
            scope['kind'] == 'promoted-operating-deployment' and type(scope['version']) is int and
            scope['version'] == 1, 'EXACT_DEPLOYMENT_V1_SCOPE_REQUIRED')
    generation = scope['generation']
    require(isinstance(generation, str) and UUID.fullmatch(generation) and
            scope['host'] == 'srv2006836' and scope['project'] == 'qcffvfbpzvpwcwxwjyro' and
            scope['remoteRoot'] == '/opt/masarifi/customer-voice-operating-' + generation and
            scope['bootstrapUnit'] == 'masarifi-customer-voice-' + generation + '-bootstrap.service',
            'EXACT_STAGING_DEPLOYMENT_REQUIRED')
    for field in ['packetHash', 'executorHash', 'knownHostsHash']:
        require(isinstance(scope[field], str) and HASH.fullmatch(scope[field]), 'DEPLOYMENT_HASH_REQUIRED')
    require(isinstance(scope['bundleHashes'], dict) and bool(scope['bundleHashes']), 'EXACT_BUNDLE_REQUIRED')
    for name, value in scope['bundleHashes'].items():
        require(isinstance(name, str) and re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}', name) and
                isinstance(value, str) and HASH.fullmatch(value), 'FLAT_PINNED_BUNDLE_REQUIRED')
    require(isinstance(scope['localEvidence'], list) and bool(scope['localEvidence']), 'REVIEW_EVIDENCE_REQUIRED')
    entries = [scope['packetFile'], scope['bundleFile'], *scope['localEvidence']]
    paths = []
    for entry in entries:
        require(isinstance(entry, dict) and set(entry) == {'path', 'sha256'} and
                isinstance(entry['path'], str) and
                (pathlib.PureWindowsPath(entry['path']).is_absolute() or pathlib.PurePosixPath(entry['path']).is_absolute()) and
                isinstance(entry['sha256'], str) and HASH.fullmatch(entry['sha256']), 'LOCAL_FILE_PIN_REQUIRED')
        paths.append(entry['path'].replace('\\', '/').casefold())
    require(len(paths) == len(set(paths)), 'DISTINCT_LOCAL_EVIDENCE_REQUIRED')


def validate_approval(scope, approval, now, activation=True):
    require(isinstance(approval, dict) and set(approval) == APPROVAL_FIELDS and
            approval['kind'] == 'direct-human-operating-deployment-approval' and
            approval['scopeHash'] == scope_hash(scope), 'DIRECT_EXACT_DEPLOYMENT_APPROVAL_REQUIRED')
    inner = approval['operatingApproval']
    require(isinstance(inner, dict) and set(inner) == APPROVAL_FIELDS - {'operatingApproval'} and
            inner['kind'] == 'direct-human-operating-approval' and inner['scopeHash'] == scope['packetHash'],
            'SEPARATE_EXACT_OPERATING_APPROVAL_REQUIRED')
    for field in ['receivedAt', 'activationExpiresAt', 'messageReference', 'verbatimMessage']:
        require(approval[field] == inner[field], 'SAME_DIRECT_HUMAN_REPLY_REQUIRED')
    received, expires = approval['receivedAt'], approval['activationExpiresAt']
    require(type(received) is int and type(expires) is int and received <= now and
            0 < expires - received <= 3600, 'ONE_HOUR_APPROVAL_REQUIRED')
    if activation:
        require(now < expires, 'ACTIVATION_WINDOW_EXPIRED')
    require(isinstance(approval['messageReference'], str) and
            8 <= len(approval['messageReference'].strip()) <= 256 and
            isinstance(approval['verbatimMessage'], str) and
            8 <= len(approval['verbatimMessage'].strip()) <= 4096, 'HUMAN_MESSAGE_EVIDENCE_REQUIRED')


def decode_bundle(scope, bundle):
    require(isinstance(bundle, dict) and set(bundle) == set(scope['bundleHashes']), 'EXACT_BUNDLE_SET_REQUIRED')
    files = {}
    for name, encoded in bundle.items():
        require(isinstance(encoded, str), 'BASE64_BUNDLE_REQUIRED')
        try:
            data = base64.b64decode(encoded, validate=True)
        except ValueError as error:
            raise RuntimeError('INVALID_BASE64_BUNDLE') from error
        require(len(data) <= 16 * 1024 * 1024 and sha(data) == scope['bundleHashes'][name], 'BUNDLE_HASH_CHANGED')
        files[name] = data
    require(CONTROLLER_FILES | {'packet.json'} <= set(files), 'CONTROLLER_BUNDLE_REQUIRED')
    packet = parse(files['packet.json'])
    require(scope_hash(packet) == scope['packetHash'] and packet.get('project') == scope['project'] and
            packet.get('host') == scope['host'] and packet.get('generation') == scope['generation'] and
            isinstance(packet.get('artifacts'), dict) and set(packet['artifacts']) == CONTROLLER_FILES and
            all(sha(files[name]) == value for name, value in packet['artifacts'].items()), 'PACKET_BUNDLE_BINDING_REQUIRED')
    expected = CONTROLLER_FILES | {'packet.json'}
    require(isinstance(packet.get('proofs'), dict), 'RAW_PROOFS_REQUIRED')
    entries = list(packet['proofs'].values())
    for name, nested in [('helperOff', 'approvedPacket'), ('financialClosure', 'successPreservation'),
                         ('controllerCI', 'sourceArtifact'), ('controllerCI', 'sqlQualification'),
                         ('apkRuntime', 'reusedNative')]:
        require(isinstance(packet['proofs'].get(name), dict) and
                isinstance(packet['proofs'][name].get(nested), dict), 'NESTED_RAW_PROOF_REQUIRED')
        entries.append(packet['proofs'][name][nested])
    for entry in entries:
        require(isinstance(entry, dict) and isinstance(entry.get('path'), str), 'RAW_PROOF_PATH_REQUIRED')
        name = entry['path'].removeprefix(scope['remoteRoot'] + '/')
        require(entry['path'] == scope['remoteRoot'] + '/' + name and name in files and
                name not in expected and name not in {'approval.json', scope['bootstrapUnit']} and
                entry.get('sha256') == sha(files[name]), 'EXACT_PRIVATE_PROOF_BUNDLE_REQUIRED')
        expected.add(name)
    require(set(files) == expected, 'UNAPPROVED_BUNDLE_FILE_REFUSED')
    return packet, files


def checked(scope, approval, now, activation=True):
    validate_scope(scope)
    validate_approval(scope, approval, now, activation)
    data = {}
    for entry in [scope['packetFile'], scope['bundleFile'], *scope['localEvidence']]:
        value = regular_bytes(entry['path'])
        require(sha(value) == entry['sha256'], 'LOCAL_EVIDENCE_HASH_CHANGED')
        data[entry['path']] = value
    require(sha(regular_bytes(pathlib.Path(__file__).resolve())) == scope['executorHash'], 'EXECUTOR_HASH_CHANGED')
    known = regular_bytes(KNOWN_HOSTS)
    require(sha(known) == scope['knownHostsHash'], 'KNOWN_HOST_HASH_CHANGED')
    bundle = parse(data[scope['bundleFile']['path']])
    packet, files = decode_bundle(scope, bundle)
    require(data[scope['packetFile']['path']] == files['packet.json'], 'EXACT_PACKET_FILE_REQUIRED')
    sources = {}
    for name in CONTROLLER_FILES:
        flat = HERE / name
        source = flat if flat.exists() or flat.is_symlink() else HERE / 'diagnostic-canary' / name
        sources[name] = regular_bytes(source)
        require(sha(sources[name]) == packet['artifacts'][name], 'FROZEN_CONTROLLER_SOURCE_CHANGED')
    # Execute the exact verified bytes, including the complete imported graph,
    # from a new private flat snapshot. This closes import-before-pin and stale
    # module races without altering or importing unpinned workspace files.
    with tempfile.TemporaryDirectory(prefix='masarifi-operating-validation-') as directory:
        root = pathlib.Path(directory)
        for name, data in sources.items():
            exclusive_write(root / name, data)
        frozen = load_host(root)
        frozen.validate_packet(packet, approval['operatingApproval'], now, activation)
    return {'scope': scope, 'approval': approval, 'bundle': bundle}


def sync_directory(path):
    if os.name == 'posix':
        descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def exclusive_write(path, data):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    sync_directory(pathlib.Path(path).parent)


def attempt_marker(scope_path, scope, name, value, create=False):
    # The signed packet location anchors consumption. Copying the scope or
    # approval elsewhere cannot create another local dispatch reservation.
    root = pathlib.Path(scope['packetFile']['path']).resolve().parent / ('execution-' + scope['generation'])
    if create:
        try:
            root.mkdir(mode=0o700)
            sync_directory(root.parent)
        except FileExistsError as error:
            raise RuntimeError('DEPLOYMENT_ALREADY_CONSUMED_NEVER_RETRY') from error
    require(root.is_dir() and root.resolve() == root.absolute() and not root.is_symlink(), 'CONSUMED_ATTEMPT_REQUIRED')
    try:
        exclusive_write(root / name, canonical(value))
    except FileExistsError as error:
        raise RuntimeError('ATTEMPT_ALREADY_CONSUMED_NEVER_RETRY') from error
    return root


def ssh_argv(known_hosts):
    return [SSH_BINARY, '-F', 'NUL', '-i', SSH_IDENTITY, '-o', 'ConnectTimeout=10',
            '-o', 'ConnectionAttempts=1', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
            '-o', 'GlobalKnownHostsFile=NUL', '-o', 'UserKnownHostsFile=' + str(known_hosts),
            '-o', 'UpdateHostKeys=no', '-o', 'ClearAllForwardings=yes', SSH_TARGET, 'sudo -n python3 -B -']


def transport_result(scope, run, source, known_hosts, reconcile_only=False):
    try:
        completed = run(ssh_argv(known_hosts), input=source, text=True, capture_output=True,
                        timeout=660 if not reconcile_only else 60)
        stdout, stderr = completed.stdout or '', completed.stderr or ''
        value = None
        try:
            value = parse(stdout)
        except RuntimeError:
            pass
        ready = isinstance(value, dict) and value.get('status') == 'AUTHORIZED_PERSISTENT_OPERATING_READY' and all(
            value.get(field) == scope[field] for field in ['packetHash', 'generation', 'remoteRoot', 'bootstrapUnit']) and \
            value.get('scopeHash') == scope_hash(scope) and isinstance(value.get('epochId'), str) and \
            UUID.fullmatch(value['epochId']) and isinstance(value.get('workerID'), str) and HASH.fullmatch(value['workerID'])
        readonly = isinstance(value, dict) and value.get('status') == 'OWNED_OPERATING_READ_ONLY' and \
            value.get('scopeHash') == scope_hash(scope) and value.get('readOnly') is True
        return {'outcome': 'readOnly' if reconcile_only and readonly and completed.returncode == 0 else
                'ready' if ready and completed.returncode == 0 else 'unknown',
                'exitCode': completed.returncode, 'stdoutSha256': sha(stdout.encode()),
                'stderrSha256': sha(stderr.encode()), 'scopeHash': scope_hash(scope), 'neverRetry': True,
                'receipt': value if (ready or readonly) else None}
    except (subprocess.SubprocessError, OSError) as error:
        result = {'outcome': 'unknown', 'exitCode': None, 'scopeHash': scope_hash(scope), 'neverRetry': True}
        for field, observed in [('stdoutSha256', getattr(error, 'output', None)),
                                ('stderrSha256', getattr(error, 'stderr', None))]:
            if isinstance(observed, str): observed = observed.encode()
            if isinstance(observed, bytes): result[field] = sha(observed)
        return result


def execute(scope_path, approval_path, run=subprocess.run, now=time.time):
    scope = parse(regular_bytes(pathlib.Path(scope_path).resolve()))
    approval = parse(regular_bytes(pathlib.Path(approval_path).resolve()))
    payload = checked(scope, approval, now())
    source = remote_source(payload)
    known = regular_bytes(KNOWN_HOSTS)
    require(sha(known) == scope['knownHostsHash'], 'KNOWN_HOST_HASH_CHANGED')
    # Directory reservation and fsynced exclusive marker precede any transport.
    root = attempt_marker(scope_path, scope, 'consumed.json',
                          {'scopeHash': scope_hash(scope), 'packetHash': scope['packetHash'],
                           'generation': scope['generation'], 'consumedAt': int(now()), 'neverRetry': True}, create=True)
    exclusive_write(root / 'known_hosts', known)
    result = transport_result(scope, run, source, root / 'known_hosts')
    exclusive_write(root / 'result.json', canonical(result))
    return result


def reconcile(scope_path, approval_path, run=subprocess.run, now=time.time):
    scope = parse(regular_bytes(pathlib.Path(scope_path).resolve()))
    approval = parse(regular_bytes(pathlib.Path(approval_path).resolve()))
    checked(scope, approval, now(), activation=False)
    root = pathlib.Path(scope['packetFile']['path']).resolve().parent / ('execution-' + scope['generation'])
    consumed = parse(regular_bytes(root / 'consumed.json'))
    require(consumed.get('scopeHash') == scope_hash(scope) and consumed.get('packetHash') == scope['packetHash'] and
            consumed.get('generation') == scope['generation'] and consumed.get('neverRetry') is True,
            'EXACT_CONSUMED_ATTEMPT_REQUIRED')
    known = regular_bytes(root / 'known_hosts')
    require(sha(known) == scope['knownHostsHash'], 'CONSUMED_KNOWN_HOST_CHANGED')
    source = readonly_source(scope)
    attempt_marker(scope_path, scope, 'reconciliation-consumed.json',
                   {'scopeHash': scope_hash(scope), 'readOnly': True, 'consumedAt': int(now()), 'neverRetry': True})
    result = transport_result(scope, run, source, root / 'known_hosts', reconcile_only=True)
    exclusive_write(root / 'reconciliation-result.json', canonical(result))
    return result


def remaining(platform, deadline):
    left = deadline - platform.monotonic()
    require(left > 0, 'BOUNDED_DEPLOYMENT_DEADLINE')
    return left


def bootstrap_text(scope):
    root = scope['remoteRoot']
    return ('[Unit]\nDescription=Approved one-time Staging voice operating bootstrap\nAfter=docker.service\n'
            '[Service]\nType=oneshot\nRemainAfterExit=yes\nUser=root\nWorkingDirectory=' + root + '\n'
            'ExecStart=/usr/bin/python3 -B ' + root + '/promoted-operating.py begin\n'
            'ExecStopPost=/usr/bin/python3 -B ' + root + '/promoted-operating.py close\n'
            'Restart=no\nTimeoutStartSec=300\nTimeoutStopSec=180\n')


class RemotePlatform:
    def target(self):
        require(os.name == 'posix' and socket.gethostname() == 'srv2006836' and os.getuid() == 0,
                'EXACT_ROOT_STAGING_TARGET_REQUIRED')

    def now(self): return time.time()
    def monotonic(self): return time.monotonic()
    def deadline(self, seconds): return self.monotonic() + seconds
    def pause(self, seconds): time.sleep(seconds)
    def root_path(self, scope): return pathlib.Path(scope['remoteRoot'])
    def unit_path(self, name): return pathlib.Path('/etc/systemd/system') / name

    def parent(self, path):
        require(path.resolve() == path.absolute(), 'REMOTE_PARENT_SYMLINK_REFUSED')
        for directory in [path, *path.parents]:
            metadata = directory.lstat()
            require(stat.S_ISDIR(metadata.st_mode) and metadata.st_uid == 0 and
                    not metadata.st_mode & 0o022, 'ROOT_OWNED_REMOTE_PARENT_REQUIRED')

    def absent(self, path):
        require(not os.path.lexists(path), 'FRESH_REMOTE_PATH_REQUIRED')

    def mkdir(self, path):
        path.mkdir(mode=0o700)
        sync_directory(path.parent)

    def write(self, path, data): exclusive_write(path, data)
    def link(self, path, target):
        os.symlink(target, path)
        sync_directory(path.parent)

    def run(self, args, deadline, timeout=15):
        limit = min(timeout, remaining(self, deadline))
        try:
            result = subprocess.run(args, capture_output=True, text=True, timeout=limit,
                                    env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin',
                                         'DOCKER_HOST': 'unix:///var/run/docker.sock'})
        except (OSError, subprocess.SubprocessError) as error:
            raise RuntimeError('BOUNDED_HOST_COMMAND_FAILED') from error
        require(result.returncode == 0, 'HOST_COMMAND_FAILED')
        return result.stdout.strip()

    def unit_state(self, name, deadline):
        output = self.run(['systemctl', 'show', name, '--property=LoadState', '--property=FragmentPath',
                           '--property=ActiveState', '--property=SubState'], deadline)
        return dict(line.split('=', 1) for line in output.splitlines() if '=' in line)

    def fresh_units(self, names, deadline):
        self.parent(pathlib.Path('/opt/masarifi'))
        self.parent(pathlib.Path('/etc/systemd/system'))
        for name in names:
            for directory in ['/etc/systemd/system', '/run/systemd/system', '/usr/lib/systemd/system', '/lib/systemd/system']:
                self.absent(pathlib.Path(directory) / name)
            state = self.unit_state(name, deadline)
            require(state.get('LoadState') == 'not-found' and state.get('FragmentPath') == '' and
                    state.get('ActiveState') == 'inactive', 'FRESH_SYSTEMD_UNIT_REQUIRED')

    @contextlib.contextmanager
    def deployment_lock(self, deadline):
        import fcntl
        path = pathlib.Path('/run/lock/masarifi-staging-deployment.lock')
        self.parent(path.parent)
        descriptor = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            metadata = os.fstat(descriptor)
            require(stat.S_ISREG(metadata.st_mode) and metadata.st_uid == 0 and metadata.st_nlink == 1 and
                    stat.S_IMODE(metadata.st_mode) == 0o600, 'PRIVATE_DEPLOYMENT_LOCK_REQUIRED')
            while True:
                try:
                    fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    self.pause(min(.05, remaining(self, deadline)))
            yield
        finally:
            os.close(descriptor)

    def precheck(self, root, packet, approval, deadline):
        for name, value in packet['artifacts'].items():
            require(sha(regular_bytes(root / name)) == value, 'INSTALLED_CONTROLLER_SOURCE_CHANGED')
            remaining(self, deadline)
        frozen = load_host(root)
        view = frozen.LocalHost(root, packet, approval)
        view.run = lambda args, timeout=30, environment=None: self.run(args, deadline, timeout)
        frozen.require(view.run is not None, 'FIXED_READ_ONLY_SETUP_REQUIRED')
        view.validate()
        view.qualified()
        frozen.ingress.preserved_apis(view, packet['apis'], False)
        view.cohort(True)
        view.route_guard()
        before = frozen.SITE.read_bytes()
        require(sha(before) == packet['routes']['beforeHash'] and
                sha(frozen.ingress.financial_route(before)) == packet['routes']['afterHash'], 'EXACT_PREACTIVATION_ROUTE_REQUIRED')
        # This pure payload validation inspects the stopped pinned template and
        # image only. It never calls preflight/database or starts a helper.
        view.worker_payload({'scope': packet, 'epochId': packet['generation']})
        expected = {pin['id'] for pin in [*packet['apis'].values(), *packet['preservedWorkers'].values(),
                                         *packet['otherContainers']]}
        expected.add(packet['worker']['templateID'])
        inventory = view.run(['docker', 'ps', '-a', '--no-trunc', '--format', '{{.ID}}']).splitlines()
        require(len(inventory) == len(set(inventory)) and set(inventory) == expected, 'EXACT_FULL_CONTAINER_INVENTORY_REQUIRED')
        self.frozen = frozen
        remaining(self, deadline)

    def ready(self, root, packet, scope):
        reader = OwnedReader(root, scope)
        state = reader.read('runtime.json')
        incident = reader.read('incident.json')
        if state is None or incident is None or reader.read('close-request.json') is not None:
            return None
        require(isinstance(incident, dict) and isinstance(incident.get('immutable'), dict) and
                all(state.get(k) == v for k, v in incident['immutable'].items()) and
                state.get('scope') == packet and state.get('scopeHash') == scope['packetHash'] and
                state.get('generation') == scope['generation'], 'OWNED_READY_PROVENANCE_REQUIRED')
        if state.get('phase') != 'active': return None
        require(isinstance(state.get('epochId'), str) and UUID.fullmatch(state['epochId']) and
                isinstance(state.get('workerID'), str) and HASH.fullmatch(state['workerID']) and
                isinstance(state.get('manifestHash'), str) and HASH.fullmatch(state['manifestHash']), 'OWNED_READY_IDENTITIES_REQUIRED')
        receipts = [reader.read(path.name) for path in sorted(root.glob('ready-*.json'))]
        for receipt in receipts:
            if isinstance(receipt, dict) and receipt.get('status') == 'AUTHORIZED_PERSISTENT_OPERATING_READY' and \
                    all(receipt.get(k) == state.get(k) for k in ['generation', 'epochId', 'workerID', 'manifestHash']) and \
                    receipt.get('expiresAt', False) is None:
                # Reuse the frozen controller's read-only health/monitor fences.
                # Never call its database/status/preflight helper from the poll.
                deadline = self.ready_deadline
                remaining(self, deadline)
                view = self.frozen.LocalHost(root, packet, reader.read('approval.json'))
                view.closure_deadline = deadline
                view.run = lambda args, timeout=30, environment=None: self.run(args, deadline, timeout)
                view.validate(activation=False)
                view.qualified()
                view.guard(state)
                view.cohort(False)
                view.public_ready(True)
                require(view.runtime(state).get('enabled') is True, 'CURRENT_OWNED_READY_HEARTBEAT_REQUIRED')
                view.monitor_proof()
                view.final_fence(state, active=True)
                return {'status': receipt['status'], 'scopeHash': scope_hash(scope), 'packetHash': scope['packetHash'],
                        'generation': scope['generation'], 'remoteRoot': scope['remoteRoot'],
                        'bootstrapUnit': scope['bootstrapUnit'], 'epochId': state['epochId'], 'workerID': state['workerID']}
        return None


def install_remote(payload, platform=None):
    platform = platform or RemotePlatform()
    platform.target()
    deadline = platform.deadline(120)
    require(isinstance(payload, dict) and set(payload) == {'scope', 'approval', 'bundle'}, 'EXACT_REMOTE_PAYLOAD_REQUIRED')
    scope, approval = payload['scope'], payload['approval']
    validate_scope(scope)
    validate_approval(scope, approval, platform.now())
    packet, files = decode_bundle(scope, payload['bundle'])
    root = platform.root_path(scope)
    units = [scope['bootstrapUnit'], 'masarifi-customer-voice-' + scope['generation'] + '-monitor.service']
    with platform.deployment_lock(deadline):
        platform.absent(root)
        platform.fresh_units(units, deadline)
        remaining(platform, deadline)
        platform.mkdir(root)
        for name, data in sorted(files.items()):
            remaining(platform, deadline)
            platform.write(root / name, data)
        platform.write(root / 'approval.json', canonical(approval['operatingApproval']))
        platform.write(root / 'deployment-scope.json', canonical(scope))
        platform.write(root / 'deployment-approval.json', canonical(approval))
        platform.precheck(root, packet, approval['operatingApproval'], deadline)
        validate_approval(scope, approval, platform.now())
        platform.write(root / scope['bootstrapUnit'], bootstrap_text(scope).encode())
        platform.link(platform.unit_path(scope['bootstrapUnit']), root / scope['bootstrapUnit'])
        platform.run(['systemctl', 'daemon-reload'], deadline)
        validate_approval(scope, approval, platform.now())
        remaining(platform, deadline)
    # Host.begin acquires this same deployment lock. Release it before the one
    # nonblocking start; systemd owns its cleanup even if SSH disappears.
    validate_approval(scope, approval, platform.now())
    platform.run(['systemctl', 'start', '--no-block', scope['bootstrapUnit']], deadline)
    ready_deadline = platform.monotonic() + 500
    platform.ready_deadline = ready_deadline
    while True:
        remaining(platform, ready_deadline)
        receipt = platform.ready(root, packet, scope)
        state = platform.unit_state(scope['bootstrapUnit'], ready_deadline)
        if receipt and state.get('ActiveState') == 'active' and state.get('SubState') == 'exited':
            return receipt
        require(state.get('ActiveState') not in ['failed', 'inactive'], 'BOOTSTRAP_NOT_READY_NEVER_RETRY')
        platform.pause(min(.5, remaining(platform, ready_deadline)))


class OwnedReader:
    """Protected owned files only; no Host, database, Docker, or mutation calls."""
    def __init__(self, root, scope):
        self.root, self.scope = root, scope

    def read(self, name):
        require(isinstance(name, str) and pathlib.Path(name).name == name, 'OWNED_FILENAME_REQUIRED')
        path = self.root / name
        if not os.path.lexists(path): return None
        metadata = path.lstat()
        require(metadata.st_uid == 0 and stat.S_ISREG(metadata.st_mode) and
                stat.S_IMODE(metadata.st_mode) == 0o600 and metadata.st_nlink == 1, 'PRIVATE_OWNED_FILE_REQUIRED')
        return parse(regular_bytes(path, 1024 * 1024))

    def snapshot(self):
        platform = RemotePlatform()
        platform.target()
        require(self.root == pathlib.Path(self.scope['remoteRoot']), 'EXACT_OWNED_ROOT_REQUIRED')
        if not os.path.lexists(self.root):
            return {'status': 'OWNED_OPERATING_READ_ONLY', 'scopeHash': scope_hash(self.scope),
                    'readOnly': True, 'rootAbsent': True}
        metadata = self.root.lstat()
        require(self.root.resolve() == self.root.absolute() and stat.S_ISDIR(metadata.st_mode) and
                metadata.st_uid == 0 and stat.S_IMODE(metadata.st_mode) == 0o700, 'PRIVATE_OWNED_ROOT_REQUIRED')
        require(self.read('deployment-scope.json') == self.scope, 'EXACT_OWNED_DEPLOYMENT_SCOPE_REQUIRED')
        names = ['runtime.json', 'incident.json', 'close-request.json', 'owned-off-receipt.json',
                 'no-owned-epoch-reconcile.json']
        names += [p.name for p in sorted(self.root.glob('ready-*.json'))]
        names += [p.name for p in sorted(self.root.glob('closure-*.json'))]
        require(len(names) <= 256, 'BOUNDED_OWNED_RECEIPTS_REQUIRED')
        files = {name: self.read(name) for name in names}
        return {'status': 'OWNED_OPERATING_READ_ONLY', 'scopeHash': scope_hash(self.scope), 'readOnly': True,
                'generation': self.scope['generation'], 'files': files,
                'bootstrap': platform.unit_state(self.scope['bootstrapUnit'], platform.deadline(15))}


def runtime_source(names):
    imports = ('import base64,contextlib,hashlib,importlib.util,json,os,pathlib,re,socket,stat,subprocess,sys,time\n'
               'sys.dont_write_bytecode=True\n')
    constants = '\n'.join(name + '=set(' + repr(sorted(globals()[name])) + ')'
                          for name in ['CONTROLLER_FILES', 'SCOPE_FIELDS', 'APPROVAL_FIELDS'])
    constants += '\nHASH=re.compile(' + repr(HASH.pattern) + ')\nUUID=re.compile(' + repr(UUID.pattern) + ')\n'
    # AST spans also work for importlib-loaded modules absent from sys.modules;
    # only explicitly listed fixed definitions enter the remote interpreter.
    source = pathlib.Path(__file__).read_text(encoding='utf-8')
    lines = source.splitlines(keepends=True)
    definitions = {node.name: ''.join(lines[node.lineno - 1:node.end_lineno])
                   for node in ast.parse(source).body if isinstance(node, (ast.FunctionDef, ast.ClassDef))}
    return imports + constants + '\n' + '\n'.join(definitions[name] for name in names)


def remote_source(payload):
    names = ['require', 'canonical', 'sha', 'scope_hash', 'parse', 'load_host', 'regular_bytes',
             'validate_scope', 'validate_approval', 'decode_bundle', 'sync_directory', 'exclusive_write',
             'remaining', 'bootstrap_text', 'RemotePlatform', 'OwnedReader', 'install_remote']
    encoded = base64.b64encode(canonical(payload)).decode()
    return runtime_source(names) + '\npayload=parse(base64.b64decode(' + repr(encoded) + ',validate=True))\n' + \
        'result=install_remote(payload)\nprint(canonical(result).decode())\n'


def readonly_source(scope):
    names = ['require', 'canonical', 'sha', 'scope_hash', 'parse', 'regular_bytes', 'remaining', 'RemotePlatform', 'OwnedReader']
    encoded = base64.b64encode(canonical(scope)).decode()
    return runtime_source(names) + '\nscope=parse(base64.b64decode(' + repr(encoded) + ',validate=True))\n' + \
        'result=OwnedReader(pathlib.Path(scope["remoteRoot"]),scope).snapshot()\nprint(canonical(result).decode())\n'


def main():
    require(len(sys.argv) == 4 and sys.argv[1] in ['execute', 'reconcile'], 'EXPLICIT_DEPLOYMENT_ACTION_REQUIRED')
    action = execute if sys.argv[1] == 'execute' else reconcile
    result = action(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
    print(canonical(result).decode())
    if result['outcome'] == 'unknown':
        raise SystemExit(2)


if __name__ == '__main__':
    main()
