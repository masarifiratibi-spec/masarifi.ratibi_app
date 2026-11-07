"""Reviewed temporary Linux QA broker. Credentials travel only in private pipes.

No worker/service activation, shell sourcing, database SQL, container removal,
credential logs, arbitrary image/path/command, or automatic retry is provided.
"""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import selectors
import signal
import stat
import subprocess
import sys
import time

IMAGE = 'ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383'
IMAGE_ID = 'sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383'
API = '98cb120092a0685a003b42f3854523d775905451696ad0b93241706c1cb15fd7'
GENERAL = 'a9c03b8c0d5fff02ce67013767c62ca1b422b6880654b674c5f50cbe4208637d'
NETWORK = 'masarifi-staging_backend'
NODE = '/nodejs/bin/node'
OCI_LABEL = 'org.opencontainers.image.revision'
CONTROL = '/run/masarifi-t03'
RESTORED_KIND = 't03-phase2-restored-once'
RESTORED_SESSION = CONTROL+'/private/restored-phase2-session.json'
RESTORED_EVIDENCE = CONTROL+'/private/restored-phase2-parent-evidence.json'
RESTORED_PREFLIGHT = CONTROL+'/private/restored-phase2-preflight-qualified.json'
PARENT_MANIFEST_PIN = 'f186ea4ed4b60d9a143b662d70c8208c9e9f76b33540d84a8d0889786bbbc5f6'
PARENT_JOURNAL_PIN = '88c7795aaab96f41c1f2ebe916d75b070338c287fa355d0368110ff45b5b4d8d'
PARENT_CONTAINER = 'b4c141b9faea43edb89dfcd164692985df4de94587ecdf1a799da3d228f681b4'
PARENT_RUN = 't03-session-fb5466b129d985fa'
PARENT_PACKAGE = 'b7db2561a1f1da10d2f4e5fc5123b012ba620644b4f5bab82533f28cc7534fd2'
PARENT_ARCHIVE = 'fb5466b129d985faee4c07c0c2f2eefde679fa878364a435003257421036684a'
CA = '/etc/masarifi/supabase-ca.crt'
CA_DEST = '/etc/ssl/certs/masarifi-database-ca.crt'
CA_PIN = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
PHASES = ['QA-T03-WARM-20261025', None, 'QA-T03-WARM-FINAL-20261025', None, 'QA-T03-COLD-20261025', None]
ENV_FILES = [('worker', '/etc/masarifi/worker.env', '968bd7f73bd3936cdd40aad8c099479df8bb40c668d27cc148d6f6bb244afb29'),
             ('api', '/etc/masarifi/qa-t03-api.env', '06506707b7a28c3817fb6afb577a1c9ab84ba11e39962755bd9d612e1984a077'),
             ('bootstrap', '/etc/masarifi/migration.env', '75b5d7fe85405c7b0d1bc257f1c5cc3b884c6f3ec3a8f736223a24ac0669acf1')]
DIAGNOSTICS = json.loads(pathlib.Path(__file__).with_name('diagnostic-codes.json').read_text(encoding='utf-8'))


def require(condition, code):
    if not condition:
        raise ValueError(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def sanitize_child_failure(value):
    value = value if isinstance(value, dict) else {}
    safe = {'ok': False, 'phase': value.get('phase') if value.get('phase') in DIAGNOSTICS['phases'] else 'configuration', 'code': value.get('code') if value.get('code') in DIAGNOSTICS['guards'] else 'QA_HOST_STAGE_FAILED'}
    if value.get('sqlstate') in DIAGNOSTICS['sqlstates']:
        safe['sqlstate'] = value['sqlstate']
    if safe['code'] in DIAGNOSTICS['pathGuards'] and isinstance(value.get('publicPath'), str) and re.fullmatch(r'node_modules/[A-Za-z0-9@._/-]{1,220}', value['publicPath']):
        safe['publicPath'] = value['publicPath']
    return safe


def package_qualification_path(package_pin):
    require(re.fullmatch(r'[a-f0-9]{64}', package_pin or ''), 'QA_HOST_REVIEWED_PINS')
    return CONTROL+'/private/package-qualified-'+package_pin+'.json'


def read_package_qualification(package_pin, archive_pin):
    receipt = json.loads(read_checked(package_qualification_path(package_pin), 1000, 0o600))
    require(receipt['packagePin'] == package_pin and receipt['archivePin'] == archive_pin, 'QA_HOST_PACKAGE_NOT_QUALIFIED')
    return receipt


def write_package_qualification(package_pin, archive_pin, run_id):
    exclusive_private(package_qualification_path(package_pin), encode({'packagePin': package_pin, 'archivePin': archive_pin, 'runId': run_id}))


def record_child_failure(record, value):
    require(re.fullmatch(r't03-[a-z0-9-]{1,100}', record.get('runId', '')), 'QA_HOST_RUN_ID')
    safe = sanitize_child_failure(value)
    exclusive_private(CONTROL+'/control/'+record['runId']+'/failure.json', encode(safe))
    return safe


def canonical_json(value):
    """Match the existing JS canonical key order, including astral/BMP keys.

    This metadata schema has strings, booleans, null and safe integer scalars;
    unsupported/nonfinite numeric types fail instead of silently normalizing.
    """
    if isinstance(value, dict):
        require(all(isinstance(key, str) for key in value), 'QA_HOST_CANONICAL_TYPE')
        keys = sorted(value, key=lambda key: key.encode('utf-16-be', errors='surrogatepass'))
        return '{'+','.join(canonical_json(key)+':'+canonical_json(value[key]) for key in keys)+'}'
    if isinstance(value, list):
        return '['+','.join(canonical_json(item) for item in value)+']'
    require(value is None or isinstance(value, (str, bool)) or (isinstance(value, int) and abs(value) <= 9007199254740991), 'QA_HOST_CANONICAL_TYPE')
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


def canonical_sha(value):
    return digest(canonical_json(value).encode('utf-8', errors='strict'))


def verify_inspection_pins(raw, raw_pin, canonical_pin):
    require(re.fullmatch(r'[a-f0-9]{64}', raw_pin or '') and re.fullmatch(r'[a-f0-9]{64}', canonical_pin or ''), 'QA_HOST_REVIEWED_INSPECTION_REQUIRED')
    value = json.loads(raw)
    require(digest(raw) == raw_pin and canonical_sha(value) == canonical_pin, 'QA_HOST_REVIEWED_INSPECTION_REQUIRED')
    require(value.get('enabled') is False, 'QA_HOST_INSPECTION_STATE')
    return value


def open_directory(path):
    require(os.path.isabs(path), 'QA_HOST_ABSOLUTE_PATH')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for part in path.strip('/').split('/'):
            if not part:
                continue
            require(part not in ('.', '..'), 'QA_HOST_PATH')
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = child
            identity = os.fstat(fd)
            require(identity.st_uid in (0, 1000, 65532) and not identity.st_mode & 0o002, 'QA_HOST_DIRECTORY_IDENTITY')
        return fd
    except BaseException:
        os.close(fd)
        raise


def read_checked(path, uid, mode, limit=262144):
    parent = open_directory(os.path.dirname(path))
    try:
        fd = os.open(os.path.basename(path), os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
    finally:
        os.close(parent)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_uid == uid and before.st_gid == uid and stat.S_IMODE(before.st_mode) == mode and 0 < before.st_size <= limit, 'QA_HOST_FILE_IDENTITY')
        result = bytearray()
        while len(result) <= limit:
            chunk = os.read(fd, min(65536, limit+1-len(result)))
            if not chunk:
                break
            result.extend(chunk)
        after = os.fstat(fd)
        require(len(result) == before.st_size and (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns, before.st_uid, before.st_gid, before.st_mode) == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns, after.st_uid, after.st_gid, after.st_mode), 'QA_HOST_FILE_CHANGED')
        return bytes(result)
    finally:
        os.close(fd)


def exclusive_private(path, payload, uid=1000, gid=1000):
    """Create through a checked directory FD, then bind permissions to that FD."""
    parent = open_directory(os.path.dirname(path))
    try:
        fd = os.open(os.path.basename(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=parent)
        try:
            os.fchown(fd, uid, gid)
            os.fchmod(fd, 0o600)
            identity = os.fstat(fd)
            require(stat.S_ISREG(identity.st_mode) and identity.st_nlink == 1 and identity.st_uid == uid and identity.st_gid == gid and stat.S_IMODE(identity.st_mode) == 0o600, 'QA_HOST_OUTPUT_IDENTITY')
            view = memoryview(payload)
            while view:
                n = os.write(fd, view)
                require(n > 0, 'QA_HOST_OUTPUT_WRITE')
                view = view[n:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(parent)
    finally:
        os.close(parent)


def new_directory(path, uid=0, gid=0):
    parent = open_directory(os.path.dirname(path))
    try:
        os.mkdir(os.path.basename(path), 0o700, dir_fd=parent)
        child = os.open(os.path.basename(path), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            os.fchown(child, uid, gid)
            os.fchmod(child, 0o700)
            os.fsync(child)
        finally:
            os.close(child)
        os.fsync(parent)
    finally:
        os.close(parent)


def ensure_control():
    if not os.path.lexists(CONTROL):
        new_directory(CONTROL)
        exclusive_private(CONTROL+'/ownership.json', encode({'scope': 'finite-t03-qa-v1'}), 0, 0)
        new_directory(CONTROL+'/private')
        new_directory(CONTROL+'/control')
        new_directory(CONTROL+'/journal', 65532, 65532)
    require(json.loads(read_checked(CONTROL+'/ownership.json', 0, 0o600)) == {'scope': 'finite-t03-qa-v1'}, 'QA_HOST_CONTROL_OWNERSHIP')
    for part, owner in [('', 0), ('/private', 0), ('/control', 0), ('/journal', 65532)]:
        fd = open_directory(CONTROL+part)
        try:
            value = os.fstat(fd)
            require(value.st_uid == owner and stat.S_IMODE(value.st_mode) == 0o700, 'QA_HOST_CONTROL_PERMISSIONS')
        finally:
            os.close(fd)


def command(args, limit=262144, timeout=15):
    # Docker metadata commands have no credential inputs. Bound both output streams.
    result = subprocess.run(args, capture_output=True, timeout=timeout, check=False)
    require(len(result.stdout) <= limit and len(result.stderr) <= 32768 and result.returncode == 0, 'QA_HOST_DOCKER_COMMAND')
    return result.stdout


def inspect(identity):
    require(re.fullmatch(r'[a-f0-9]{64}', identity), 'QA_HOST_CONTAINER_ID')
    template = '{"Id":{{json .Id}},"Image":{{json .Image}},"ImageRef":{{json .Config.Image}},"Running":{{json .State.Running}},"User":{{json .Config.User}},"ReadonlyRootfs":{{json .HostConfig.ReadonlyRootfs}},"Restart":{{json .HostConfig.RestartPolicy.Name}},"LogDriver":{{json .HostConfig.LogConfig.Type}},"Network":{{json .HostConfig.NetworkMode}},"Labels":{{json .Config.Labels}},"Mounts":{{json .Mounts}},"Command":{{json .Config.Cmd}},"Entrypoint":{{json .Config.Entrypoint}},"Healthcheck":{{if .Config.Healthcheck}}{{json .Config.Healthcheck.Test}}{{else}}null{{end}},"CapDrop":{{json .HostConfig.CapDrop}},"SecurityOpt":{{json .HostConfig.SecurityOpt}},"PidsLimit":{{json .HostConfig.PidsLimit}},"Memory":{{json .HostConfig.Memory}},"NanoCpus":{{json .HostConfig.NanoCpus}},"PortBindings":{{json .HostConfig.PortBindings}}}'
    value = json.loads(command(['docker', 'inspect', '--format', template, identity]))
    value['Mounts'] = sorted([{'Source': m['Source'], 'Destination': m['Destination'], 'RW': m['RW'], 'Type': m['Type']} for m in value['Mounts']], key=lambda m: m['Destination'])
    return value


def mounts(mode, package_root):
    values = [{'Source': package_root, 'Destination': '/app/qa-t03', 'RW': False, 'Type': 'bind'}]
    if mode != 'package-only':
        values.append({'Source': CA, 'Destination': CA_DEST, 'RW': False, 'Type': 'bind'})
    if mode == 'session':
        values.append({'Source': CONTROL+'/journal', 'Destination': CONTROL+'/journal', 'RW': True, 'Type': 'bind'})
    return sorted(values, key=lambda m: m['Destination'])


def container_command(mode, package_pin, archive_pin, run_id, package_root):
    args = ['docker', 'create', '--pull', 'never', '--name', run_id, '--label', 'masarifi.t03.scope=finite-qa', '--label', 'masarifi.t03.package='+package_pin, '--label', 'masarifi.t03.archive='+archive_pin, '--label', 'masarifi.t03.run='+run_id, '--user', '65532:65532', '--read-only', '--no-healthcheck', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '64', '--memory', '256m', '--cpus', '0.5', '--restart', 'no', '--log-driver', 'none', '--network', 'none' if mode == 'package-only' else NETWORK, '--entrypoint', NODE]
    for mount in mounts(mode, package_root):
        args += ['--mount', 'type=bind,source='+mount['Source']+',target='+mount['Destination']+('' if mount['RW'] else ',readonly')]
    if mode != 'package-only':
        args += ['-i', '--env', 'NODE_EXTRA_CA_CERTS='+CA_DEST]
    return args+[IMAGE, '/app/qa-t03/scripts/qa/t03-session-consumer/host-entry.cjs', '--'+mode, package_pin]


def expected_identity(record):
    return {'Id': record['id'], 'Image': IMAGE_ID, 'ImageRef': IMAGE, 'User': '65532:65532', 'ReadonlyRootfs': True, 'Restart': 'no', 'LogDriver': 'none', 'Network': 'none' if record['mode'] == 'package-only' else NETWORK, 'Labels': {'masarifi.t03.scope': 'finite-qa', 'masarifi.t03.package': record['packagePin'], 'masarifi.t03.archive': record['archivePin'], 'masarifi.t03.run': record['runId']}, 'Mounts': mounts(record['mode'], record['packageRoot']), 'Command': ['/app/qa-t03/scripts/qa/t03-session-consumer/host-entry.cjs', '--'+record['mode'], record['packagePin']], 'Entrypoint': [NODE], 'Healthcheck': ['NONE'], 'CapDrop': ['ALL'], 'SecurityOpt': ['no-new-privileges'], 'PidsLimit': 64, 'Memory': 268435456, 'NanoCpus': 500000000}


def validate_owned(record, value):
    contract = expected_identity(record)
    labels = value.get('Labels')
    require(isinstance(labels, dict) and set(labels) == (set(contract['Labels'])|{OCI_LABEL}) and all(labels[key] == item for key, item in contract['Labels'].items()), 'QA_HOST_OWNED_IDENTITY_MISMATCH')
    # Only the four exact QA labels authorize ownership. The one verified inherited
    # OCI label is informational; image ID/reference, exact ID and other gates bind it.
    for key, expected in contract.items():
        if key == 'Labels':
            continue
        require(value.get(key) == expected, 'QA_HOST_OWNED_IDENTITY_MISMATCH')
    require(not value.get('PortBindings'), 'QA_HOST_OWNED_PORTS')


def stop_owned(record):
    value = inspect(record['id'])
    validate_owned(record, value)
    if value['Running']:
        command(['docker', 'stop', '--time', '90', record['id']], timeout=110)
    value = inspect(record['id'])
    validate_owned(record, value)
    require(value['Running'] is False, 'QA_HOST_STOP_UNRESOLVED')


def bounded_attach(record, frame, deadline):
    """No unbounded communicate(), shell, terminal output or Docker logs."""
    attach = ['docker', 'start', '-a']+([] if record['mode'] == 'package-only' else ['-i'])+[record['id']]
    child = subprocess.Popen(attach, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    selector = selectors.DefaultSelector()
    buffers = {'stdout': bytearray(), 'stderr': bytearray()}
    data = memoryview(frame)
    for stream, name in [(child.stdout, 'stdout'), (child.stderr, 'stderr')]:
        os.set_blocking(stream.fileno(), False)
        selector.register(stream, selectors.EVENT_READ, name)
    os.set_blocking(child.stdin.fileno(), False)
    selector.register(child.stdin, selectors.EVENT_WRITE, 'stdin')
    try:
        while selector.get_map():
            require(time.time() < deadline, 'QA_HOST_STAGE_DEADLINE')
            for key, _ in selector.select(min(0.5, max(0, deadline-time.time()))):
                if key.data == 'stdin':
                    if data:
                        try:
                            data = data[os.write(key.fileobj.fileno(), data):]
                        except BlockingIOError:
                            continue
                    if not data:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                else:
                    chunk = os.read(key.fileobj.fileno(), 16384)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                        continue
                    buffers[key.data].extend(chunk)
                    require(len(buffers[key.data]) <= (524288 if key.data == 'stdout' else 32768), 'QA_HOST_PRIVATE_OUTPUT_LIMIT')
        status = child.wait(timeout=5)
        try:
            result = json.loads(bytes(buffers['stdout']).decode('utf-8', errors='strict'))
        except (ValueError, UnicodeError):
            result = {'ok': False, 'phase': 'configuration', 'code': 'QA_HOST_STAGE_FAILED'}
        if not isinstance(result, dict):
            result = {'ok': False, 'phase': 'configuration', 'code': 'QA_HOST_STAGE_FAILED'}
        if status != 0 or result.get('ok', True) is not True:
            raise PublicStageFailure(record_child_failure(record, result))
        return result
    finally:
        selector.close()
        for stream in (child.stdin, child.stdout, child.stderr):
            if not stream.closed:
                stream.close()
        for value in buffers.values():
            value.clear()
        # The exact persisted container identity, not a discovered PID/tree, owns cleanup.
        stop_owned(record)
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            raise ValueError('QA_HOST_ATTACH_CLEANUP_UNRESOLVED')


def verify_host(package_pin):
    api, worker = inspect(API), inspect(GENERAL)
    require(api['Id'] == API and api['Image'] == IMAGE_ID and api['Running'] and api['ReadonlyRootfs'] and api['User'] == '65532:65532' and api['Network'] == NETWORK, 'QA_HOST_API_CHANGED')
    require(api['Mounts'] == [{'Source': CA, 'Destination': CA_DEST, 'RW': False, 'Type': 'bind'}], 'QA_HOST_API_MOUNTS_CHANGED')
    require(worker['Id'] == GENERAL and worker['Running'] is False, 'QA_HOST_GENERAL_WORKER_CHANGED')
    require(digest(read_checked(CA, 0, 0o644, 8192)) == CA_PIN, 'QA_HOST_CA_CHANGED')
    return {'packageSha256': package_pin, 'image': IMAGE, 'imageId': IMAGE_ID, 'generalWorkerRunning': False, 'network': NETWORK, 'configOverlaySha256': digest(b'{"MASARIFI_PROCESS_KIND":"worker"}')}


def collect_restored_parent():
    raw = read_checked(CONTROL+'/private/session.json', 1000, 0o600)
    require(digest(raw) == PARENT_MANIFEST_PIN, 'QA_HOST_RESTORED_PARENT_PIN')
    parent = json.loads(raw)
    require(parent['sessionId'] == 't03-qa-fb5466b129d985fa', 'QA_HOST_RESTORED_PARENT_IDENTITY')
    record = json.loads(read_checked(CONTROL+'/control/'+PARENT_RUN+'/identity.json', 1000, 0o600))
    require(record['id'] == PARENT_CONTAINER and record['mode'] == 'session' and record['runId'] == PARENT_RUN and record['manifestPin'] == PARENT_MANIFEST_PIN and record['packagePin'] == PARENT_PACKAGE and record['archivePin'] == PARENT_ARCHIVE and record['packageRoot'] == '/opt/masarifi/qa-t03/packages/'+PARENT_ARCHIVE, 'QA_HOST_RESTORED_PARENT_IDENTITY')
    value = inspect(PARENT_CONTAINER)
    validate_owned(record, value)
    require(value['Running'] is False, 'QA_HOST_RESTORED_PARENT_RUNNING')
    stop = json.loads(command(['docker', 'inspect', '--format', '{"exitCode":{{json .State.ExitCode}},"oomKilled":{{json .State.OOMKilled}}}', PARENT_CONTAINER]))
    require(stop == {'exitCode': 1, 'oomKilled': False}, 'QA_HOST_RESTORED_PARENT_EXIT')
    failure = json.loads(read_checked(CONTROL+'/control/'+PARENT_RUN+'/failure.json', 1000, 0o600))
    require(failure == {'ok': False, 'phase': 'candidate', 'code': 'QA_HOST_STAGE_FAILED'}, 'QA_HOST_RESTORED_PARENT_FAILURE')
    require(journal_status(parent, False) == {'phase': 1, 'claims': 1, 'status': 'stopped', 'expectedNote': PHASES[0], 'version': 2}, 'QA_HOST_RESTORED_PARENT_STATE')
    directory = CONTROL+'/journal/'+parent['sessionId']
    fd = open_directory(directory)
    try:
        names = set(os.listdir(fd))
    finally:
        os.close(fd)
    committed = sorted(n for n in names if re.fullmatch(r'[0-9]{5}\.committed', n))
    require(committed and names == {f'{i:05d}'+suffix for i in range(len(committed)) for suffix in ('.json', '.committed')}, 'QA_HOST_RESTORED_PARENT_PARTIAL')
    journal = read_checked(directory+'/'+committed[-1].replace('.committed', '.json'), 65532, 0o600)
    require(digest(journal) == PARENT_JOURNAL_PIN, 'QA_HOST_RESTORED_JOURNAL_PIN')
    state = json.loads(journal)['state']
    require(state['inflight'] is None and state['operations'] == [parent['binding']['initialRow']['operation_id']] and state['mutations'] == [parent['binding']['initialRow']['id']] and state['directReceipts'] == [] and state['failure'] == 'SESSION_EXECUTION_FAILED', 'QA_HOST_RESTORED_PARENT_STATE')
    worker = inspect(GENERAL)
    require(worker['Id'] == GENERAL and worker['Running'] is False, 'QA_HOST_GENERAL_WORKER_CHANGED')
    require(not os.path.lexists(CONTROL+'/journal/restored-parent-'+PARENT_MANIFEST_PIN+'.admission'), 'QA_HOST_RESTORED_PARENT_CONSUMED')
    return {'parentManifestRaw': raw.decode('utf-8', errors='strict'), 'parentJournalRaw': journal.decode('utf-8', errors='strict'), 'ownedStop': {'containerId': PARENT_CONTAINER, 'contractMatch': True, 'running': False, 'portsEmpty': True, 'exitCode': 1, 'oomKilled': False}, 'journalChainValidated': True, 'generalWorkerRunning': False}


def private_frame(mode, package_root, package_pin, expectation_pin, manifest_pin, session_id, duration, restored=False, rehearsal=False):
    frame = {key: read_checked(filename, 1000, 0o600, 65536).decode('utf-8', errors='strict') for key, filename, _ in ENV_FILES}
    for key, _, pin in ENV_FILES:
        require(digest(frame[key].encode()) == pin, 'QA_HOST_CONFIG_PIN')
    frame['hostAttestation'] = verify_host(package_pin)
    if restored:
        frame['restoredParent'] = collect_restored_parent()
        if mode == 'bind' or rehearsal:
            require(re.fullmatch(r't03-[a-z0-9-]{1,100}', session_id or ''), 'QA_HOST_SESSION_ID')
            frame.update({'manifest': '{}', 'restoredBindingRequest': 'rehearsal' if rehearsal else 'bind', 'sessionId': session_id, 'deadlineAt': None if rehearsal else time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()+duration))})
        else:
            manifest = read_checked(RESTORED_SESSION, 1000, 0o600)
            require(digest(manifest) == manifest_pin, 'QA_HOST_MANIFEST_PIN')
            m = json.loads(manifest)
            require(m['restoredSuccessor']['kind'] == RESTORED_KIND, 'QA_HOST_RESTORED_MANIFEST')
            saved = json.loads(read_checked(RESTORED_EVIDENCE, 1000, 0o600))
            require(canonical_sha(saved) == canonical_sha(frame['restoredParent']) == m['restoredSuccessor']['parentEvidenceSha256'], 'QA_HOST_RESTORED_EVIDENCE_CHANGED')
            frame['manifest'] = manifest.decode('utf-8', errors='strict')
    elif mode in ('preflight', 'session'):
        manifest = read_checked(CONTROL+'/private/session.json', 1000, 0o600)
        require(digest(manifest) == manifest_pin, 'QA_HOST_MANIFEST_PIN')
        frame['manifest'] = manifest.decode('utf-8')
    else:
        scope = json.loads(read_checked(package_root+'/scripts/qa/t03-session-consumer/inspection-scope.json', 0, 0o444))
        expectations = {'enabled': False, 'scope': scope, 'apiContainerId': API, 'generalWorkerContainerId': GENERAL}
        if mode == 'bind':
            raw = read_checked(CONTROL+'/private/expectations.json', 1000, 0o600, 524288)
            require(digest(raw) == expectation_pin, 'QA_HOST_EXPECTATIONS_PIN')
            expectations = json.loads(raw)
        frame.update({'manifest': '{}', 'expectations': expectations, 'sessionId': session_id, 'deadlineAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time()+duration))})
    payload = encode(frame)
    require(len(payload) <= 262144, 'QA_HOST_PRIVATE_FRAME_LIMIT')
    return payload


def sanitized_status(manifest, state, running):
    require(state['sessionId'] == manifest['sessionId'] and isinstance(state['phase'], int) and 0 <= state['phase'] <= 6 and isinstance(state['claims'], int) and 0 <= state['claims'] <= manifest['maxClaims'] == 6, 'QA_HOST_JOURNAL_STATE')
    phase = state['phase']
    require(state['version'] == manifest['binding']['initialVersion']+phase and state['note'] == (None if phase == 0 else PHASES[phase-1]) and state['status'] in ('running', 'stopped', 'completed'), 'QA_HOST_JOURNAL_STATE')
    require(state['status'] != 'completed' or phase == 6, 'QA_HOST_JOURNAL_STATE')
    return {'phase': phase, 'claims': state['claims'], 'status': state['status'] if state['status'] != 'running' or running else 'stopped', 'expectedNote': state['note'], 'version': state['version']}


def journal_status(manifest, running):
    directory = CONTROL+'/journal/'+manifest['sessionId']
    fd = open_directory(directory)
    try:
        identity = os.fstat(fd)
        require(identity.st_uid == 65532 and stat.S_IMODE(identity.st_mode) == 0o700, 'QA_HOST_JOURNAL_IDENTITY')
        names = sorted(n for n in os.listdir(fd) if re.fullmatch(r'[0-9]{5}\.committed', n))
    finally:
        os.close(fd)
    require(names, 'QA_HOST_JOURNAL_NOT_READY')
    previous = None
    for sequence, name in enumerate(names):
        require(name == f'{sequence:05d}.committed', 'QA_HOST_JOURNAL_SEQUENCE')
        raw = read_checked(directory+f'/{sequence:05d}.json', 65532, 0o600)
        marker = read_checked(directory+'/'+name, 65532, 0o600, 64)
        require(marker == digest(raw).encode(), 'QA_HOST_JOURNAL_COMMIT')
        record = json.loads(raw)
        require(record['sequence'] == sequence and record['previous'] == previous, 'QA_HOST_JOURNAL_CHAIN')
        previous = digest(raw)
    return sanitized_status(manifest, record['state'], running)


def verify_public_tree(root, package_pin):
    raw = read_checked(root+'/package-manifest.json', 0, 0o444, 4194304)
    require(digest(raw) == package_pin, 'QA_HOST_PACKAGE_PIN')
    manifest = json.loads(raw)
    require(manifest['image'] == IMAGE and manifest['version'] == 1, 'QA_HOST_PACKAGE_IDENTITY')
    expected = {'package-manifest.json'}
    for entry in manifest['files']:
        name = entry['path']
        require(re.fullmatch(r'[A-Za-z0-9@._/-]+', name) and not any(p in ('', '.', '..') for p in name.split('/')), 'QA_HOST_PUBLIC_PATH')
        expected.add(name)
        data = read_checked(root+'/'+name, 0, 0o444, 4194304)
        require(len(data) == entry['bytes'] and digest(data) == entry['sha256'], 'QA_HOST_PUBLIC_FILE_MISMATCH')
    actual = set()
    for directory, folders, files in os.walk(root, followlinks=False):
        for folder in folders:
            fd = open_directory(directory+'/'+folder); os.close(fd)
        actual.update(os.path.relpath(directory+'/'+name, root) for name in files)
    require(actual == expected, 'QA_HOST_PUBLIC_FILE_SET')


class PublicStageFailure(Exception):
    def __init__(self, value):
        self.value = value


def write_binding(manifest, restored):
    payload = encode(manifest)
    require(b'postgresql://' not in payload and b'postgres://' not in payload, 'QA_HOST_BIND_SECRET_REJECTED')
    if restored:
        evidence = collect_restored_parent()
        require(manifest['restoredSuccessor']['kind'] == RESTORED_KIND and manifest['restoredSuccessor']['parentEvidenceSha256'] == canonical_sha(evidence), 'QA_HOST_RESTORED_EVIDENCE_CHANGED')
        exclusive_private(RESTORED_EVIDENCE, encode(evidence))
    exclusive_private(RESTORED_SESSION if restored else CONTROL+'/private/session.json', payload)
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['package-only', 'inspect', 'approve-inspection', 'bind', 'preflight', 'session', 'stop', 'status'])
    for key in ('package-sha256', 'archive-sha256', 'expectations-sha256', 'manifest-sha256', 'inspection-sha256', 'inspection-canonical-sha256'):
        parser.add_argument('--'+key)
    parser.add_argument('--run-id')
    parser.add_argument('--session-id')
    parser.add_argument('--duration', type=int, default=3600)
    parser.add_argument('--restored-successor', action='store_true')
    parser.add_argument('--restored-rehearsal', action='store_true')
    args = parser.parse_args()
    require(not args.restored_successor or args.mode in ('bind', 'preflight', 'session', 'status', 'stop'), 'QA_HOST_RESTORED_MODE')
    require(not args.restored_rehearsal or (args.restored_successor and args.mode == 'preflight' and args.manifest_sha256 is None), 'QA_HOST_RESTORED_REHEARSAL')
    require(sys.platform == 'linux' and os.geteuid() == 0, 'QA_HOST_LINUX_ROOT_REQUIRED')
    require(all(re.fullmatch(r'[a-f0-9]{64}', v or '') for v in (args.package_sha256, args.archive_sha256)), 'QA_HOST_REVIEWED_PINS')
    package_root = '/opt/masarifi/qa-t03/packages/'+args.archive_sha256
    require(os.path.realpath(os.path.join(os.path.dirname(__file__), '../../..')) == package_root, 'QA_HOST_BROKER_LOCATION')
    verify_public_tree(package_root, args.package_sha256)
    ensure_control()
    if args.mode == 'approve-inspection':
        raw = read_checked(CONTROL+'/private/inspection.json', 1000, 0o600, 524288)
        approved = verify_inspection_pins(raw, args.inspection_sha256, args.inspection_canonical_sha256)
        approved['enabled'] = True
        payload = encode(approved)
        exclusive_private(CONTROL+'/private/expectations.json', payload)
        return {'ok': True, 'kind': 'approved-expectations', 'sha256': digest(payload), 'canonicalSha256': canonical_sha(approved), 'bytes': len(payload)}
    if args.mode in ('stop', 'status'):
        require(re.fullmatch(r't03-[a-z0-9-]{1,100}', args.run_id or ''), 'QA_HOST_RUN_ID')
        record = json.loads(read_checked(CONTROL+'/control/'+args.run_id+'/identity.json', 1000, 0o600))
        require(record['runId'] == args.run_id and record['packagePin'] == args.package_sha256 and record['archivePin'] == args.archive_sha256 and record.get('restoredSuccessor', False) == args.restored_successor, 'QA_HOST_RUN_BINDING')
        if args.mode == 'stop':
            stop_owned(record)
            return {'ok': True, 'status': 'stopped'}
        value = inspect(record['id']); validate_owned(record, value)
        raw = read_checked(RESTORED_SESSION if args.restored_successor else CONTROL+'/private/session.json', 1000, 0o600)
        require(digest(raw) == args.manifest_sha256 == record['manifestPin'], 'QA_HOST_MANIFEST_PIN')
        verify_host(args.package_sha256)
        return journal_status(json.loads(raw), value['Running'])
    require(60 <= args.duration <= 7200, 'QA_HOST_DURATION')
    if args.restored_successor and args.mode == 'bind':
        require(args.duration <= 3600 and not os.path.lexists(RESTORED_SESSION) and not os.path.lexists(RESTORED_EVIDENCE), 'QA_HOST_RESTORED_BIND_ONCE')
    if args.mode != 'package-only':
        read_package_qualification(args.package_sha256, args.archive_sha256)
    require(re.fullmatch(r't03-[a-z0-9-]{1,100}', args.run_id or ''), 'QA_HOST_RUN_ID')
    run_id = args.run_id
    run_path = CONTROL+'/control/'+run_id
    new_directory(run_path)
    record = {'runId': run_id, 'packagePin': args.package_sha256, 'archivePin': args.archive_sha256, 'mode': args.mode, 'packageRoot': package_root, 'created': time.time(), 'manifestPin': args.manifest_sha256, 'restoredSuccessor': args.restored_successor}
    frame = b''
    deadline = time.time()+90
    if args.mode != 'package-only':
        require(re.fullmatch(r't03-[a-z0-9-]{1,100}', args.session_id or '') or args.mode in ('preflight', 'session'), 'QA_HOST_SESSION_ID')
        frame = private_frame(args.mode, package_root, args.package_sha256, args.expectations_sha256, args.manifest_sha256, args.session_id, args.duration, args.restored_successor, args.restored_rehearsal)
        if args.mode == 'session':
            preflight = json.loads(read_checked(RESTORED_PREFLIGHT if args.restored_successor else CONTROL+'/private/preflight-qualified.json', 1000, 0o600))
            require(preflight == {'packagePin': args.package_sha256, 'archivePin': args.archive_sha256, 'manifestPin': args.manifest_sha256}, 'QA_HOST_PREFLIGHT_NOT_QUALIFIED')
            session = json.loads(json.loads(frame)['manifest'])
            require(session['provenance']['reviewedArtifactSha256'] == args.package_sha256, 'QA_HOST_SESSION_PACKAGE')
            deadline = datetime.datetime.fromisoformat(session['deadlineAt'].replace('Z', '+00:00')).timestamp()+120
            require(time.time() < deadline <= time.time()+7320, 'QA_HOST_SESSION_DEADLINE')
            # Keep the temporary broker alive if the browser terminal closes.
            signal.signal(signal.SIGHUP, signal.SIG_IGN)
    record['deadline'] = deadline
    exclusive_private(run_path+'/intent.json', encode(record))
    identity = command(container_command(args.mode, args.package_sha256, args.archive_sha256, run_id, package_root)).decode().strip()
    require(re.fullmatch(r'[a-f0-9]{64}', identity), 'QA_HOST_CREATE_IDENTITY')
    record['id'] = identity
    # Durable exact ID exists before start/credential pipe; browser failure cannot erase it.
    exclusive_private(run_path+'/identity.json', encode(record))
    try:
        validate_owned(record, inspect(identity))
        result = bounded_attach(record, frame, deadline)
    finally:
        frame = b''
        stop_owned(record)
    exclusive_private(run_path+'/completion.json', encode({'completed': time.time(), 'containerStopped': True}))
    if args.mode == 'package-only':
        require(result.get('kind') == 'package-only', 'QA_HOST_PACKAGE_RESULT')
        write_package_qualification(args.package_sha256, args.archive_sha256, run_id)
        return result
    if args.mode == 'inspect':
        require(result.get('kind') == 'inspect-only-unreviewed' and result.get('claims') == 0 and result.get('dataWrites') == 0, 'QA_HOST_INSPECTION_RESULT')
        scope = json.loads(read_checked(package_root+'/scripts/qa/t03-session-consumer/inspection-scope.json', 0, 0o444))
        inspection = {key: result[key] for key in ('catalogSqlJsonSha256', 'searchPath', 'timeZone', 'contracts', 'indexes', 'relations')}
        inspection.update({'enabled': False, 'scope': scope, 'apiContainerId': API, 'generalWorkerContainerId': GENERAL})
        payload = encode(inspection)
        exclusive_private(CONTROL+'/private/inspection.json', payload)
        return {'ok': True, 'kind': 'inspect-awaiting-independent-review', 'sha256': digest(payload), 'canonicalSha256': canonical_sha(inspection), 'searchPath': inspection['searchPath'], 'timeZone': inspection['timeZone'], 'bytes': len(payload), 'claims': 0, 'dataWrites': 0}
    if args.mode == 'bind':
        require(result.get('kind') == 'private-binding' and result.get('manifest', {}).get('sessionId') == args.session_id, 'QA_HOST_BIND_RESULT')
        payload = write_binding(result['manifest'], args.restored_successor)
        return {'ok': True, 'kind': 'private-binding-awaiting-review', 'sha256': digest(payload), 'bytes': len(payload), 'claims': 0, 'dataWrites': 0}
    if args.mode == 'preflight':
        require(result == {'outcome': 'read-only-preflight-passed', 'claimed': 0, 'executed': 0}, 'QA_HOST_PREFLIGHT_RESULT')
        if args.restored_rehearsal:
            return {'ok': True, 'kind': 'read-only-restored-admissibility-rehearsal', 'claims': 0, 'dataWrites': 0, 'newClock': False}
        exclusive_private(RESTORED_PREFLIGHT if args.restored_successor else CONTROL+'/private/preflight-qualified.json', encode({'packagePin': args.package_sha256, 'archivePin': args.archive_sha256, 'manifestPin': args.manifest_sha256}))
        return {'ok': True, 'kind': 'read-only-preflight', 'claims': 0, 'dataWrites': 0}
    require(result.get('outcome') == 'completed' and result.get('phases') == 6 and 0 <= result.get('claims', -1) <= 6, 'QA_HOST_SESSION_RESULT')
    return {'ok': True, 'phase': 6, 'claims': result['claims'], 'status': 'completed', 'expectedNote': None}


if __name__ == '__main__':
    try:
        print(json.dumps(main(), separators=(',', ':')))
    except PublicStageFailure as error:
        print(json.dumps(error.value, separators=(',', ':')))
        sys.exit(1)
    except BaseException:
        # Never print child stderr, exception text, inputs, credentials or private rows.
        print('{"ok":false,"code":"QA_HOST_BROKER_STOPPED_REVIEW_PRIVATE_STATE"}')
        sys.exit(1)
