"""One approved Admin-only canary/handover. Default action reads state; never touches SQL or workers."""
if not __debug__:
    raise RuntimeError("PYTHON_OPTIMIZATION_FORBIDDEN")
import argparse
import copy
import getpass
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import stat
import subprocess
import tarfile
import tempfile
import time
import urllib.request
import urllib.error
import zipfile

PACKET = Path(__file__).resolve().parent
MANIFEST = json.loads((PACKET / "manifest.json").read_text())
ROOT = Path(MANIFEST["candidate"]["root"])
RUNTIME = ROOT / "runtime"
OLD_ROOT = Path("/opt/masarifi/admin-releases/canonical-721a943b-artifact-20261101-01")
OLD_ID = MANIFEST["observedHosted"]["containerId"]
TARGET = Path("/etc/nginx/sites-available/masarifi-staging")
ENABLED = Path("/etc/nginx/sites-enabled/masarifi-staging")
spec = importlib.util.spec_from_file_location("archive_guard", PACKET / "archive_verifier.py")
archive_guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive_guard)
spec = importlib.util.spec_from_file_location("watchdog", PACKET / "rollback_watchdog.py")
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return digest(json.dumps(data, sort_keys=True, separators=(",", ":")).encode())


def inspect_container(identity):
    return json.loads(subprocess.check_output(["docker", "inspect", identity]))[0]


def original_rows():
    ids = subprocess.check_output(["docker", "ps", "-q"], text=True).split()
    containers = json.loads(subprocess.check_output(["docker", "inspect", *ids]))
    return sorted([
        {"name": d["Name"], "id": d["Id"], "image": d["Image"], "startedAt": d["State"]["StartedAt"],
         "configSha256": canonical({"Config": d["Config"], "HostConfig": d["HostConfig"], "Mounts": d["Mounts"]})}
        for d in containers if d["Name"] != "/" + MANIFEST["candidate"]["name"]
    ], key=lambda d: d["name"])


def admission():
    baseline = json.loads((PACKET / "host-baseline.json").read_text())
    old = inspect_container(OLD_ID)
    assert old["State"]["Running"] and old["State"]["StartedAt"] == baseline["old"]["startedAt"], "OLD_PROCESS_DRIFT"
    assert old["Image"] == MANIFEST["runtimeCandidate"]["targetRuntimeImage"], "RUNTIME_IMAGE_DRIFT"
    assert canonical(old["Config"]["Env"]) == MANIFEST["observedHosted"]["environmentPin"], "ENVIRONMENT_DRIFT"
    assert canonical(original_rows()) == baseline["allRunningIdentitySha256"], "PROTECTED_CONTAINER_DRIFT"
    assert ENABLED.resolve(strict=True) == TARGET and not TARGET.is_symlink(), "ROUTING_LINK_DRIFT"
    assert (OLD_ROOT / "apps/admin-web/.next/BUILD_ID").read_text().strip() == MANIFEST["observedHosted"]["browserBuildId"], "OLD_BUILD_DRIFT"
    return old


def clone_payload(old, runtime, old_root=OLD_ROOT):
    config = copy.deepcopy(old["Config"])
    host = copy.deepcopy(old["HostConfig"])
    assert host["NetworkMode"] == "bridge" and host["ReadonlyRootfs"], "RUNTIME_ISOLATION_DRIFT"
    assert set(host["PortBindings"]) == {"3040/tcp"} and host["PortBindings"]["3040/tcp"] == [{"HostIp": "127.0.0.1", "HostPort": "3040"}], "OLD_PORT_DRIFT"
    mounts = {m["Destination"]: m for m in old["Mounts"]}
    assert len(old["Mounts"]) == 2 and set(mounts) == {"/workspace", "/workspace/apps/admin-web/.next/cache"}, "UNREVIEWED_MOUNT"
    assert mounts["/workspace"]["Source"] == str(old_root) and not mounts["/workspace"]["RW"], "WORKSPACE_DRIFT"
    assert mounts["/workspace/apps/admin-web/.next/cache"]["Source"] == str(old_root / "apps/admin-web/.next/cache") and mounts["/workspace/apps/admin-web/.next/cache"]["RW"], "CACHE_DRIFT"
    assert host.get("Binds") is None and len(host.get("Mounts", [])) == 2, "BIND_SOURCE_DRIFT"
    configured = {m["Target"]: m for m in host["Mounts"]}
    assert set(configured) == set(mounts) and all(m["Type"] == "bind" for m in configured.values()), "CONFIGURED_MOUNT_DRIFT"
    for destination, observed in mounts.items():
        setting = configured[destination]
        assert setting["Source"] == observed["Source"] and setting.get("ReadOnly", False) is not observed["RW"], "CONFIGURED_MOUNT_DRIFT"
        setting["Source"] = str(runtime) + setting["Source"][len(str(old_root)):]
    host["PortBindings"]["3040/tcp"][0]["HostPort"] = "3041"
    # Docker materializes the unset default as false on create. Keep OOM killing
    # enabled explicitly; compare every returned HostConfig field without filtering.
    assert host["OomKillDisable"] is None or host["OomKillDisable"] is False, "OOM_PROTECTION_DRIFT"
    host["OomKillDisable"] = False
    config["Hostname"] = ""
    config["Image"] = old["Image"]
    return {**config, "HostConfig": host}


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(30)
        self.sock.connect("/var/run/docker.sock")


def docker_create(payload):
    connection = DockerConnection("localhost")
    try:
        connection.request("POST", "/containers/create?name=" + MANIFEST["candidate"]["name"], json.dumps(payload), {"Content-Type": "application/json"})
        response = connection.getresponse()
        body = response.read()
        if response.status != 201:
            raise RuntimeError("DOCKER_CREATE_FAILED_STATUS_" + str(response.status))
        return json.loads(body)["Id"]
    finally:
        connection.close()


def write_state(state):
    path = ROOT / "state.json"
    temporary = path.with_suffix(".new")
    temporary.write_text(json.dumps(state, indent=2) + "\n")
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def verify_created(old, candidate, payload):
    before, after = copy.deepcopy(old["Config"]), copy.deepcopy(candidate["Config"])
    before.pop("Hostname"); after.pop("Hostname")
    before["Image"] = old["Image"]
    assert candidate["Image"] == MANIFEST["runtimeCandidate"]["targetRuntimeImage"], "CANDIDATE_IMAGE_PIN_MISMATCH"
    assert before == after and canonical(candidate["Config"]["Env"]) == MANIFEST["observedHosted"]["environmentPin"], "CANDIDATE_CONFIG_DRIFT"
    assert candidate["HostConfig"] == payload["HostConfig"], "CANDIDATE_HOST_CONFIG_DRIFT"


def verify_staged_tree(archive, runtime):
    """Compare all runnable bytes/links to the pinned tar, except its writable cache."""
    cache = "apps/admin-web/.next/cache"
    assert runtime.is_dir() and not runtime.is_symlink(), "STAGED_RUNTIME_ROOT_DRIFT"
    with tarfile.open(archive, "r:gz") as bundle:
        members = bundle.getmembers()
        archive_guard.validate_runtime_members(members)
        expected = {cache}
        parents = {parent.as_posix() for parent in Path(cache).parents if parent.as_posix() != "."}
        for member in members:
            path = Path(member.name)
            expected.add(member.name)
            parents.update(parent.as_posix() for parent in path.parents if parent.as_posix() != ".")
        expected.update(parents)
        # Walk without following any link; reject replaced parent directories and extras.
        for directory, dirs, files in os.walk(runtime, followlinks=False):
            for name in dirs + files:
                path = Path(directory) / name
                relative = path.relative_to(runtime).as_posix()
                assert relative in expected, "STAGED_UNEXPECTED_ENTRY: " + relative
                if relative == cache:
                    assert stat.S_ISDIR(path.lstat().st_mode), "STAGED_CACHE_NOT_DIRECTORY"
                    dirs.remove(name)
                elif relative in parents:
                    assert stat.S_ISDIR(path.lstat().st_mode), "STAGED_PARENT_NOT_DIRECTORY: " + relative
        assert stat.S_ISDIR((runtime / cache).lstat().st_mode), "STAGED_CACHE_NOT_DIRECTORY"
        for member in members:
            if member.name == cache or member.name.startswith(cache + "/"):
                continue
            path = runtime / member.name
            mode = path.lstat().st_mode
            if member.isdir():
                assert stat.S_ISDIR(mode), "STAGED_DIRECTORY_DRIFT: " + member.name
            elif member.issym():
                assert stat.S_ISLNK(mode) and os.readlink(path) == member.linkname, "STAGED_SYMLINK_DRIFT: " + member.name
            else:
                assert stat.S_ISREG(mode) and stat.S_IMODE(mode) & 0o111 == member.mode & 0o111, "STAGED_EXECUTABLE_DRIFT: " + member.name
                expected_hash = hashlib.sha256()
                with bundle.extractfile(member) as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b""):
                        expected_hash.update(block)
                assert archive_guard.file_digest(path) == expected_hash.hexdigest(), "STAGED_RUNTIME_BYTES_DRIFT: " + member.name


def probe(port, item):
    request = urllib.request.Request("http://127.0.0.1:" + str(port) + item["path"], headers={"Host": "staging.masarifiratibi.com"})
    with urllib.request.urlopen(request, timeout=10) as response:
        assert response.status == 200 and digest(response.read()) == item["sha256"], "HTTP_PROBE_PIN_MISMATCH"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def protected_route_challenge(port):
    request = urllib.request.Request("http://127.0.0.1:" + str(port) + "/admin", headers={"Host": "staging.masarifiratibi.com"})
    try:
        response = urllib.request.build_opener(NoRedirect).open(request, timeout=10)
        status, location = response.status, response.headers.get("Location", "")
        response.close()
    except urllib.error.HTTPError as error:
        status, location = error.code, error.headers.get("Location", "")
    expected = MANIFEST["anonymousChallenge"]
    assert status == expected["status"] and location.startswith(expected["locationPrefix"]), "PROTECTED_ROUTE_CHALLENGE_MISMATCH"


def served_probe():
    item = MANIFEST["runtimeCandidate"]["staticProbe"]
    data = subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--max-time", "10", "--resolve", "staging.masarifiratibi.com:443:127.0.0.1", "https://staging.masarifiratibi.com" + item["path"]])
    assert digest(data) == item["sha256"], "SERVED_BUILD_PIN_MISMATCH"


def canary():
    state = json.loads((ROOT / "state.json").read_text())
    current = inspect_container(state["containerId"])
    assert current["Name"] == "/" + MANIFEST["candidate"]["name"] and current["State"]["Running"] and not current["State"].get("OOMKilled") and current["RestartCount"] == 0, "CANDIDATE_PROCESS_FAILED"
    if "candidateConfigSha256" in state:
        assert canonical({"Config": current["Config"], "HostConfig": current["HostConfig"], "Mounts": current["Mounts"]}) == state["candidateConfigSha256"] and current["State"]["StartedAt"] == state["startedAt"], "CANDIDATE_RUNTIME_DRIFT"
    for item in [MANIFEST["runtimeCandidate"]["staticProbe"], *MANIFEST["brandAssets"]]:
        probe(3041, item)
    protected_route_challenge(3041)
    return state


def stop_failed_candidate(identity):
    current = inspect_container(identity)
    assert current["Name"] == "/" + MANIFEST["candidate"]["name"] and current["Image"] == MANIFEST["runtimeCandidate"]["targetRuntimeImage"], "REFUSE_FOREIGN_CONTAINER_STOP"
    if current["State"]["Running"]:
        subprocess.run(["docker", "stop", "--time", "15", identity], check=True, stdout=subprocess.DEVNULL)


def start_and_qualify(identity):
    try:
        subprocess.run(["docker", "start", identity], check=True, stdout=subprocess.DEVNULL)
        deadline = time.monotonic() + 60
        while True:
            try:
                for _ in range(3): canary()
                break
            except Exception:
                if time.monotonic() >= deadline: raise
                time.sleep(2)
        admission()
        return inspect_container(identity)
    except Exception:
        stop_failed_candidate(identity)
        raise


def stage():
    old = admission()
    assert digest(TARGET.read_bytes()) == watchdog.ORIGINAL_SHA, "PROXY_PREIMAGE_DRIFT"
    assert not ROOT.exists(), "STAGE_ALREADY_DISPATCHED_RECONCILE_RECEIPT"
    assert not subprocess.check_output(["ss", "-H", "-ltn", "sport = :3041"], text=True).strip(), "PORT_3041_IN_USE"
    assert not subprocess.check_output(["docker", "ps", "-aq", "--filter", "name=^/" + MANIFEST["candidate"]["name"] + "$"], text=True).strip(), "CANDIDATE_NAME_IN_USE"
    assert shutil.disk_usage(OLD_ROOT).free >= 2 * 1024**3, "DISK_ADMISSION_FAILED"
    available = next(int(s.split()[1]) for s in Path("/proc/meminfo").read_text().splitlines() if s.startswith("MemAvailable:"))
    assert available >= 1536 * 1024, "MEMORY_ADMISSION_FAILED"
    ROOT.mkdir(mode=0o700)
    write_state({"phase": "download dispatched", "sourceCommit": MANIFEST["sourceCommit"]})
    url = getpass.getpass("One-use HTTPS artifact URL (hidden): ")
    assert url.startswith("https://"), "ARTIFACT_HTTPS_REQUIRED"
    archive = ROOT / "artifact.zip"
    with urllib.request.urlopen(url, timeout=45) as response, archive.open("wb") as output:
        shutil.copyfileobj(response, output)
    del url
    assert archive_guard.file_digest(archive) == MANIFEST["runtimeCandidate"]["artifactZipSha256"], "CI_ZIP_PIN_MISMATCH"
    runtime_name = "masarifi-admin-" + MANIFEST["sourceCommit"] + ".tar.gz"
    with zipfile.ZipFile(archive) as bundle:
        assert set(bundle.namelist()) == {"manifest.json", "SHA256SUMS", runtime_name}, "ZIP_SCOPE_MISMATCH"
        with bundle.open(runtime_name) as source, (ROOT / runtime_name).open("wb") as output:
            shutil.copyfileobj(source, output)
        ci_bytes = bundle.read("manifest.json")
    assert digest(ci_bytes) == MANIFEST["runtimeCandidate"]["manifestSha256"], "CI_MANIFEST_PIN_MISMATCH"
    runtime = ROOT / runtime_name
    assert archive_guard.file_digest(runtime) == MANIFEST["runtimeCandidate"]["sha256"], "RUNTIME_ARCHIVE_PIN_MISMATCH"
    RUNTIME.mkdir()
    with tarfile.open(runtime, "r:gz") as bundle:
        archive_guard.validate_runtime_members(bundle.getmembers())
        bundle.extractall(RUNTIME, filter="data")
    for item in MANIFEST["sourceFiles"]:
        assert archive_guard.file_digest(RUNTIME / item["path"]) == item["candidateSha256"], "STAGED_SOURCE_PIN_MISMATCH"
    assert (RUNTIME / "apps/admin-web/.next/BUILD_ID").read_text().strip() == MANIFEST["runtimeCandidate"]["buildId"], "STAGED_BUILD_PIN_MISMATCH"
    cache = RUNTIME / "apps/admin-web/.next/cache"
    cache.mkdir(exist_ok=True)
    os.chown(cache, 1000, 1000)
    for parent in [ROOT, RUNTIME]: os.chmod(parent, 0o755)
    (ROOT / "rollback").mkdir(mode=0o700)
    (ROOT / "rollback/masarifi-staging.original").write_bytes(TARGET.read_bytes())
    packet_target = ROOT / "review-packet"
    shutil.copytree(PACKET, packet_target)
    verify_staged_tree(runtime, RUNTIME)
    payload = clone_payload(old, RUNTIME)
    write_state({"phase": "container create dispatched", "sourceCommit": MANIFEST["sourceCommit"]})
    identity = docker_create(payload)
    write_state({"phase": "container created", "sourceCommit": MANIFEST["sourceCommit"], "containerId": identity})
    candidate = inspect_container(identity)
    verify_created(old, candidate, payload)
    current = start_and_qualify(identity)
    write_state({"phase": "canary qualified", "sourceCommit": MANIFEST["sourceCommit"], "containerId": identity, "startedAt": current["State"]["StartedAt"], "candidateConfigSha256": canonical({"Config": current["Config"], "HostConfig": current["HostConfig"], "Mounts": current["Mounts"]})})
    print(json.dumps({"phase": "canary qualified", "containerId": identity, "buildId": MANIFEST["runtimeCandidate"]["buildId"], "environmentPreserved": True, "originalContainersPreserved": True}))


def switch():
    admission()
    state = canary()
    assert state["phase"] == "canary qualified", "HANDOVER_ALREADY_DISPATCHED_RECONCILE_RECEIPT"
    original = TARGET.read_bytes()
    proposed = watchdog.proposed_proxy(original)
    assert digest(proposed) == MANIFEST["routingCandidateSha256"], "PROXY_CANDIDATE_PIN_MISMATCH"
    root_packet = ROOT / "review-packet"
    log = (ROOT / "rollback/watchdog.log").open("ab", buffering=0)
    watch = subprocess.Popen(["python3", str(root_packet / "rollback_watchdog.py"), "--action", "watch", "--execute-approved", "--runtime-sha256", MANIFEST["runtimeCandidate"]["sha256"]], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    time.sleep(2)
    assert watch.poll() is None, "ROLLBACK_WATCHDOG_NOT_ARMED"
    state.update({"phase": "handover dispatched", "watchdogPid": watch.pid})
    write_state(state)
    try:
        watchdog.check_paths()
        with tempfile.NamedTemporaryFile(dir=TARGET.parent, prefix=".dashboard-candidate-", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(proposed); stream.flush(); os.fsync(stream.fileno()); os.fchmod(stream.fileno(), 0o644); os.fchown(stream.fileno(), 0, 0)
        assert digest(TARGET.read_bytes()) == watchdog.ORIGINAL_SHA, "PROXY_CHANGED_DURING_HANDOVER"
        os.replace(temporary, TARGET)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["nginx", "-s", "reload"], check=True)
        admission(); canary(); served_probe()
    except Exception:
        watchdog.restore(original)
        raise
    state["phase"] = "candidate serving; authenticated acceptance pending"
    write_state(state)
    print(json.dumps({"phase": state["phase"], "buildId": MANIFEST["runtimeCandidate"]["buildId"], "watchdogPid": watch.pid, "rollbackDeadlineSeconds": 600}))


def accept():
    admission(); state = canary()
    assert state["phase"] == "candidate serving; authenticated acceptance pending", "NO_PENDING_HANDOVER"
    marker = ROOT / "rollback/acceptance.new"
    original = watchdog.ORIGINAL.read_bytes()
    try:
        assert digest(TARGET.read_bytes()) == MANIFEST["routingCandidateSha256"], "CANDIDATE_NOT_ROUTED"
        served_probe()
        marker.write_text(json.dumps({"accepted": True, "sourceCommit": MANIFEST["sourceCommit"], "runtimeSha256": MANIFEST["runtimeCandidate"]["sha256"], "watchdogPid": state["watchdogPid"]}))
        os.replace(marker, ROOT / "rollback/acceptance.json")
        deadline = time.monotonic() + 8
        acknowledgment = ROOT / "rollback/watchdog-ack.json"
        while True:
            try:
                ack = json.loads(acknowledgment.read_text())
                confirmed = ack == {"accepted": True, "sourceCommit": MANIFEST["sourceCommit"], "runtimeSha256": MANIFEST["runtimeCandidate"]["sha256"], "watchdogPid": state["watchdogPid"]}
            except (OSError, ValueError):
                confirmed = False
            if confirmed: break
            if time.monotonic() >= deadline: raise RuntimeError("WATCHDOG_ACCEPTANCE_NOT_ACKNOWLEDGED_RECONCILE_ROUTING")
            time.sleep(0.2)
        assert digest(TARGET.read_bytes()) == MANIFEST["routingCandidateSha256"], "ROUTING_CHANGED_DURING_ACCEPTANCE"
        admission(); canary(); served_probe()
        state["phase"] = "accepted after public and authenticated browser verification"
        write_state(state)
    except Exception:
        marker.unlink(missing_ok=True)
        (ROOT / "rollback/acceptance.json").unlink(missing_ok=True)
        watchdog.restore(original)
        state["phase"] = "acceptance failed; old proxy restored"
        write_state(state)
        raise
    print(json.dumps({"phase": state["phase"], "buildId": MANIFEST["runtimeCandidate"]["buildId"], "protectedContainerDigest": canonical(original_rows())}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["inspect", "stage", "switch", "accept"], nargs="?", default="inspect")
    parser.add_argument("--execute-approved", action="store_true")
    args = parser.parse_args()
    for key in ["brandAssets", "routingCandidateSha256", "anonymousChallenge"]:
        if key not in MANIFEST: raise RuntimeError("REVIEW_PACKET_INCOMPLETE: " + key)
    if args.action == "inspect":
        old = admission()
        print(json.dumps({"admitted": True, "oldContainerId": old["Id"], "originalContainerDigest": canonical(original_rows())}))
    else:
        assert args.execute_approved and MANIFEST["hostedActivationApproved"] is True and os.geteuid() == 0, "EXACT_APPROVAL_AND_ROOT_REQUIRED"
        {"stage": stage, "switch": switch, "accept": accept}[args.action]()
