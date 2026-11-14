"""Current-VPS release adapter. Every hosted action requires an exact approved packet.

The manifest is blocked until its missing admission/qualification/actor pins are
resolved. There is deliberately no command which creates an approval receipt.
"""
from copy import deepcopy
import argparse
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import socket
import stat
import subprocess
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

import acceptance_receipt
import admission
import migration_packet
from patch_security_modules import apply_exact_patch
import read_nginx_context as context
import routing_files as files
from runtime_plan import ROOT, NAMES, SERVICE, REPOSITORY, fingerprint, plan, require
import stage_admin
from trial_watchdog import WatchRuntime, watch

PACKET = Path(__file__).resolve().parent
INPUT = Path("/etc/masarifi/selfhost/dashboard-inputs-20261114")
UNIT = "masarifi-dashboard-trial-20261114"
ADMIN = "staging.masarifiratibi.com"
API = "api.staging.masarifiratibi.com"


def run(args, *, data=None, timeout=30):
    p = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    require(p.returncode == 0, "HOST_COMMAND_FAILED")
    return p.stdout


def private_json(path, digest=None):
    require(path.resolve(strict=True) == path and path.parent.stat().st_uid == 0
            and path.parent.stat().st_mode & 0o077 == 0, "PRIVATE_DIRECTORY_REQUIRED")
    s = path.stat()
    require(stat.S_ISREG(s.st_mode) and s.st_uid == 0 and s.st_mode & 0o077 == 0
            and s.st_nlink == 1 and s.st_size <= 2 * 1024**2, "PRIVATE_FILE_REQUIRED")
    value = json.loads(path.read_bytes())
    if digest is not None:
        require(fingerprint(value) == digest, "PRIVATE_RECEIPT_PIN_DRIFT")
    return value


def admitted(pin):
    raw = files.exact_file(PACKET / "manifest.json")
    require(os.name == "posix" and os.geteuid() == 0 and re.fullmatch(r"[a-f0-9]{64}", pin or "")
            and files.sha(raw) == pin, "APPROVED_PACKET_PIN_REQUIRED")
    m = json.loads(raw)
    require(m["status"] == "ready-for-user-approval" and not m["blockers"]
            and m["foundationStatus"] == "success" and m["dataAuthority"] == "current-vps"
            and m["restoreDatabaseOrStorageOnRollback"] is False
            and m["runFrozenConsumers"] is False, "PACKET_BLOCKED")
    require(m["qualification"]["linuxPassed"] is True, "LINUX_QUALIFICATION_REQUIRED")
    for name, digest in m["files"].items():
        require(re.fullmatch(r"[a-zA-Z0-9_.-]+", name) and name != "manifest.json"
                and files.sha(files.exact_file(PACKET / name)) == digest, "PACKET_FILE_DRIFT")
    require(private_json(INPUT / "approval.json") == {"packetSha256": pin,
                "decision": "approved", "actor": "user"}, "EXPLICIT_APPROVAL_RECEIPT_REQUIRED")
    return m


def inspect(identity):
    return json.loads(run(["docker", "inspect", identity]))[0]


def baseline(m):
    receipt = private_json(Path(m["admission"]["receiptPath"]), m["admission"]["canonicalSha256"])
    require(receipt["collectorStatus"] == "passed" and receipt["stableBeforeAfter"] is True
            and receipt["counts"]["targetRunning"] == 30
            and receipt["counts"]["frozenSourceAllStoppedRestartNo"] is True, "LIVE_COLLECTION_NOT_ADMITTED")
    return receipt["collected"]


def same_target():
    s = json.loads(files.exact_file(Path("/etc/masarifi/selfhost/cutover-state.json")))
    require(s["phase"] == "complete" and s["targetMayAcceptWrites"] is True, "VPS_AUTHORITY_CHANGED")


def protected(m, candidates=()):
    same_target()
    b = baseline(m)
    ids = admission.run(["docker", "ps", "-aq", "--no-trunc"]).decode().splitlines()
    rows = json.loads(admission.run(["docker", "inspect", *ids]))
    require(fingerprint(admission.inventory(rows, exclude=candidates)) == b["inventorySha256"],
            "PROTECTED_CONTAINER_DRIFT")
    require(all(r["State"].get("Health", {}).get("Status") in (None, "healthy")
                for r in rows if r["State"]["Running"] and r["Id"] not in candidates),
            "PROTECTED_SERVICE_UNHEALTHY")
    for item in b["mountFiles"]:
        require(files.sha(files.exact_file(Path(item["source"]))) == item["sha256"], "PROTECTED_MOUNT_DRIFT")
    require(files.sha(files.exact_file(files.PRIMARY)) == m["routing"]["protectedPrimarySha256"],
            "PROTECTED_PRIMARY_DRIFT")


def probe(host, path, port=None):
    origin = f"http://127.0.0.1:{port}" if port else "https://" + host
    request = Request(origin + path, headers={"Host": host, "X-Request-ID": "dashboard-release-readonly"})
    from urllib.error import HTTPError
    try:
        response = urlopen(request, timeout=5)
    except HTTPError as error:
        response = error
    with response:
        body = response.read(2 * 1024**2 + 1)
        require(len(body) <= 2 * 1024**2, "PROBE_BODY_TOO_LARGE")
        return response.status, response.headers, body


def production_ready():
    status, _, body = probe("api.masarifiratibi.com", "/health/ready")
    require(status == 200 and json.loads(body) == {"status": "ready", "checks": {"database": "up", "queue": "up"}},
            "PRODUCTION_NOT_READY")


def static_probe(item, port=None):
    status, _, body = probe(ADMIN, item["path"], port)
    require(status == 200 and files.sha(body) == item["sha256"], "STATIC_GENERATION_DRIFT")


def prove_original(m):
    production_ready()
    static_probe(m["routing"]["originalStaticProbe"])
    require(probe(ADMIN, m["admin"]["staticProbe"]["path"])[0] == 404, "CANDIDATE_STILL_SERVED")


def prove_candidate(m):
    production_ready()
    static_probe(m["admin"]["staticProbe"])
    for prefix in ("/api/v1/admin/support-access/requests", "/api/v1/me/support-access/requests"):
        for suffix, expected in (("", 401), ("/00000000-0000-4000-8000-000000000001?probe=1",
                                           401 if "/admin/" in prefix else 404)):
            status, headers, _ = probe(API, prefix + suffix)
            require(status == expected and headers.get_all("Cache-Control") == ["no-store"],
                    "SUPPORT_INGRESS_OR_CACHE_DRIFT")


def ticket(m):
    t = private_json(files.PRIVATE / "ticket.json")
    require(t["packetSha256"] == files.sha(files.exact_file(PACKET / "manifest.json"))
            and t["candidateSha256"] == m["routing"]["candidateSha256"]
            and t["originalSha256"] == m["routing"]["originalSha256"], "TICKET_DRIFT")
    return t


def canaries(m, t):
    protected(m, t["candidates"].values())
    accepted = files.PRIVATE / "accepted-configs.json"
    configs = private_json(accepted)["configs"] if accepted.exists() else t["configs"]
    for role, identity in t["candidates"].items():
        row = inspect(identity)
        require(row["Id"] == identity and row["Name"] == "/" + NAMES[role]
                and row["State"]["Running"] and not row["State"].get("OOMKilled")
                and row["RestartCount"] == 0 and row["State"]["StartedAt"] == t["started"][role]
                and fingerprint([row[k] for k in ("Config", "HostConfig", "Mounts")]) == configs[role],
                "CANDIDATE_IDENTITY_OR_CONFIG_DRIFT")
    static_probe(m["admin"]["staticProbe"], 3090)
    require(probe(API, "/health/ready", 3091)[0] == 200, "CANDIDATE_API_NOT_READY")


def quiesce(m, t):
    for role, identity in t["candidates"].items():
        row = inspect(identity)
        require(row["Id"] == identity and row["Name"] == "/" + NAMES[role]
                and row["Image"] == baseline(m)["originals"][role]["imageId"]
                and row["Config"]["Labels"].get("masarifi.dashboard.base-container") ==
                    baseline(m)["originals"][role]["containerId"], "REFUSE_FOREIGN_CANDIDATE")
        if row["HostConfig"]["RestartPolicy"] != {"Name": "no", "MaximumRetryCount": 0}:
            run(["docker", "update", "--restart", "no", identity])
        if row["State"]["Running"]:
            run(["docker", "stop", "--time", "15", identity], timeout=25)
        after = inspect(identity)
        require(not after["State"]["Running"] and after["HostConfig"]["RestartPolicy"] ==
                {"Name": "no", "MaximumRetryCount": 0}, "CANDIDATE_NOT_QUIESCED")


class Adapter:
    def __init__(self, m, t):
        self.m, self.t = m, t

    def read(self, name):
        path = files.PRIVATE / (name + ".json")
        return private_json(path) if path.exists() else None

    def emit(self, name, value):
        files.emit(files.PRIVATE / (name + ".json"), value)
        if name == "switched":
            files.emit(files.PRIVATE / "switch-observation.json", {"switchedUnix": time.time()})

    def notify(self):
        files.notify("WATCHDOG=1")

    def protected(self):
        files.links(self.t)
        protected(self.m, self.t["candidates"].values())

    def healthy(self):
        canaries(self.m, self.t)

    def prove_original(self):
        prove_original(self.m)

    def prove_candidate(self):
        files.converge(lambda: prove_candidate(self.m))

    def install(self):
        attest_migration(self.m)
        master = self.t["master"]["pid"]
        require(os.readlink("/proc/self/ns/mnt") == os.readlink("/proc/1/ns/mnt") ==
                os.readlink(f"/proc/{master}/ns/mnt"), "MASTER_MOUNT_NAMESPACE_REQUIRED")
        proposed = []
        r = context.receipt(primary_hash=self.t["protectedPrimarySha256"], candidate_sink=proposed.append)
        require(r["contextSha256"] == self.t["contextSha256"] and r["candidateSha256"] == self.t["candidateSha256"],
                "FRESH_ROUTING_CONTEXT_DRIFT")
        files.prepare_trial(proposed[0], self.t)
        files.bind_trial(files.TARGET, files.PRIVATE / "trial")
        files.nginx_reload()

    def restore(self):
        files.restore(self.t, self.prove_original)

    def quiesce(self):
        quiesce(self.m, self.t)

    def finalize(self, digest):
        observed = private_json(files.PRIVATE / "switch-observation.json")
        acceptance_receipt.verify(INPUT / "evidence", dict(self.t, **observed), digest)
        self.healthy()
        require(time.monotonic() < self.t["deadline"] - 20, "ACCEPTANCE_WINDOW_CLOSED")
        files.emit(files.PRIVATE / "commit.json", {"decision": "accepted", "packetSha256": self.t["packetSha256"],
                                                   "evidenceSha256": digest, "ticket": self.t["ticket"]})
        configs = {}
        for role, identity in self.t["candidates"].items():
            before = inspect(identity)
            run(["docker", "update", "--restart", "unless-stopped", identity])
            after = inspect(identity)
            expected = deepcopy(before["HostConfig"])
            expected["RestartPolicy"] = {"Name": "unless-stopped", "MaximumRetryCount": 0}
            require(after["HostConfig"] == expected and after["Config"] == before["Config"]
                    and after["Mounts"] == before["Mounts"] and after["State"]["Running"]
                    and after["State"]["StartedAt"] == before["State"]["StartedAt"]
                    and after["RestartCount"] == 0, "ACCEPTED_POLICY_DRIFT")
            configs[role] = fingerprint([after[k] for k in ("Config", "HostConfig", "Mounts")])
        files.emit(files.PRIVATE / "accepted-configs.json", {"configs": configs})
        files.finalize_trial(self.t)


class DockerHTTP(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(30)
        self.sock.connect("/var/run/docker.sock")


def docker(method, path, body=None):
    connection = DockerHTTP("localhost", timeout=30)
    try:
        connection.request(method, path, body=json.dumps(body).encode() if body is not None else None,
                           headers={"Content-Type": "application/json"} if body is not None else {})
        response = connection.getresponse()
        raw = response.read(2 * 1024**2)
        require(response.status < 400, "DOCKER_REQUEST_FAILED")
        return json.loads(raw) if raw else None
    finally:
        connection.close()


def verify_created(row, payload, role, original):
    conf = {k: v for k, v in payload.items() if k not in ("HostConfig", "NetworkingConfig")}
    actual = deepcopy(row["Config"])
    require(actual.pop("Hostname") == row["Id"][:12] and conf.pop("Hostname") == ""
            and actual == conf and row["HostConfig"] == payload["HostConfig"]
            and row["Image"] == original["Image"] and row["Name"] == "/" + NAMES[role]
            and row["State"]["Status"] == "created", "CREATED_CONFIG_DRIFT")
    expected = deepcopy(original["Mounts"])
    for mount in expected:
        if role == "admin":
            mount["Source"] = ROOT + ("/runtime" if mount["Destination"] == "/workspace" else "/cache")
        elif mount["Destination"] == SERVICE:
            mount["Source"] = ROOT + "/modules/security/security.service.js"
    observed = {m["Destination"]: m for m in row["Mounts"]}
    if role == "api":
        extra = observed.pop(REPOSITORY, {})
        require(extra.get("Type") == "bind" and extra.get("Source") == ROOT + "/modules/security/security.repository.js"
                and extra.get("RW") is False and extra.get("Mode") in ("", "ro")
                and extra.get("Propagation") in ("", "rprivate"), "NEW_REPOSITORY_MOUNT_DRIFT")
    require(sorted(observed.values(), key=lambda v: v["Destination"]) == sorted(expected, key=lambda v: v["Destination"]),
            "CREATED_EXISTING_MOUNTS_DRIFT")
    require(set(row["NetworkSettings"]["Networks"]) == set(payload["NetworkingConfig"]["EndpointsConfig"]),
            "CREATED_NETWORKS_DRIFT")


def qualify_modules(m, original):
    argv = ["docker", "run", "--rm", "--pull=never", "--log-driver=none", "--network=none",
            "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
            "--memory=384m", "--pids-limit=64", "--user", original["Config"]["User"],
            "--entrypoint=/nodejs/bin/node", "--workdir=/app"]
    sources = {v["Destination"]: v["Source"] for v in original["Mounts"]}
    sources.update({SERVICE: ROOT + "/modules/security/security.service.js",
                    REPOSITORY: ROOT + "/modules/security/security.repository.js"})
    for target, source in sorted(sources.items()):
        require("," not in source + target, "UNSUPPORTED_MOUNT_PATH")
        argv += ["--mount", f"type=bind,src={source},dst={target},readonly"]
    script = "const assert=require('node:assert/strict');assert.equal(process.version,'v24.20.0');" + \
             "for(const name of ['security.repository','security.service','security.dto','security.controller'])" + \
             "require('/app/dist/src/security/'+name+'.js');process.stdout.write('QUALIFIED\\n');"
    require(run(argv + [original["Image"], "-e", script], timeout=45) == b"QUALIFIED\n",
            "EXACT_IMAGE_MODULE_QUALIFICATION_FAILED")


def stage_overlay(m, api_source):
    modules = Path(ROOT) / "modules" / "security"
    modules.mkdir(parents=True, mode=0o755)
    for filename, info in m["apiOverlay"]["modules"].items():
        raw = run(["docker", "exec", api_source["Id"], "/nodejs/bin/node", "-e",
                   "process.stdout.write(require('node:fs').readFileSync(process.argv[1]))",
                   "/app/dist/src/security/" + filename])
        changed = apply_exact_patch(raw, files.exact_file(PACKET / (filename + ".patch")), info, filename)
        require(files.sha(changed) == info["afterSha256"], "RAW_OVERLAY_POSTIMAGE_DRIFT")
        with (modules / filename).open("xb") as out:
            out.write(changed)
        (modules / filename).chmod(0o444)
    qualify_modules(m, api_source)


def stage(m, pin):
    b = baseline(m)
    fresh = admission.collect(m["routing"]["protectedPrimarySha256"])
    for field in ("originals", "plannedPayloadSha256", "inventorySha256", "mountFiles", "nginx", "master"):
        require(fresh[field] == b[field], "FRESH_HOST_ADMISSION_DRIFT")
    production_ready()
    prove_original(m)
    require(not Path(ROOT).exists() and Path(ROOT).parent.resolve(strict=True) == Path(ROOT).parent,
            "FRESH_RELEASE_DIRECTORY_REQUIRED")
    room = os.statvfs(Path(ROOT).parent)
    available = next(int(line.split()[1]) * 1024 for line in Path("/proc/meminfo").read_text().splitlines()
                     if line.startswith("MemAvailable:"))
    require(room.f_bavail * room.f_frsize >= 5 * 1024**3 and available >= 2 * 1024**3,
            "CANDIDATE_HEADROOM_REQUIRED")
    for name in NAMES.values():
        require(not run(["docker", "ps", "-aq", "--filter", "name=^/" + name + "$"]).strip(),
                "CANDIDATE_NAME_ALREADY_EXISTS")
    Path(ROOT).mkdir(mode=0o700)
    files.PRIVATE.mkdir(mode=0o700)
    files.emit(files.PRIVATE / "stage-owner.json", {"packetSha256": pin, "createdUnix": time.time()})
    with (files.PRIVATE / "original").open("xb") as backup:
        backup.write(files.exact_file(files.TARGET))
        backup.flush()
        os.fsync(backup.fileno())
    stage_admin.admin(INPUT / "admin-artifact.zip", Path(ROOT), m["admin"])
    sources = {role: inspect(b["originals"][role]["containerId"]) for role in NAMES}
    stage_overlay(m, sources["api"])
    candidates = {}
    try:
        configs, started = {}, {}
        for role in NAMES:
            payload = plan(sources[role], role, b["originals"][role])
            require(fingerprint(payload) == b["plannedPayloadSha256"][role], "PAYLOAD_PIN_DRIFT")
            created = docker("POST", "/containers/create?name=" + quote(NAMES[role]), payload)
            require(re.fullmatch(r"[0-9a-f]{64}", created["Id"]) and not created.get("Warnings"), "CREATE_NOT_ADMITTED")
            candidates[role] = created["Id"]
            files.emit(files.PRIVATE / "partial-candidates.json", {"candidates": candidates})
            verify_created(inspect(created["Id"]), payload, role, sources[role])
            docker("POST", "/containers/" + created["Id"] + "/start")
            row = inspect(created["Id"])
            configs[role] = fingerprint([row[k] for k in ("Config", "HostConfig", "Mounts")])
            started[role] = row["State"]["StartedAt"]
        t = dict(ticket=secrets.token_hex(32), packetSha256=pin, candidates=candidates, configs=configs, started=started,
                 createdUnix=time.time(), deadline=time.monotonic()+1200, bootId=b["master"]["bootId"],
                 originalSha256=m["routing"]["originalSha256"], candidateSha256=m["routing"]["candidateSha256"],
                 protectedPrimarySha256=m["routing"]["protectedPrimarySha256"], contextSha256=b["nginx"]["contextSha256"],
                 master=b["master"], originalMetadata=files.metadata(files.TARGET), actorDigests=m["actorDigests"])
        files.emit(files.PRIVATE / "ticket.json", t)
        until = time.monotonic()+90
        while True:
            try:
                canaries(m, t)
                break
            except (ValueError, OSError):
                if time.monotonic() >= until:
                    raise
                time.sleep(2)
        launch_watchdog(m, pin)
        files.emit(files.PRIVATE / "staged.json", {"packetSha256": pin, "candidates": candidates, "coldStartPassed": True})
    except BaseException:
        if candidates:
            quiesce(m, {"candidates": candidates})
        raise


def migrate(m):
    t = ticket(m)
    canaries(m, t)
    raw = files.exact_file(INPUT / "canonical-migration.sql")
    rendered = migration_packet.render(raw, m["migration"])
    postgres = next(v for v in baseline(m)["inventory"] if v["name"] == "/masarifi-postgres17")
    run(["docker", "exec", "-i", postgres["id"], "psql", "-Xq", "-v", "ON_ERROR_STOP=1",
         "-h", "/tmp", "-U", m["migration"]["executor"], "-d", "postgres"], data=rendered.encode(), timeout=25)
    files.emit(files.PRIVATE / "migration.json", {"packetSha256": t["packetSha256"], "version": migration_packet.VERSION,
               "clusterSha256": m["migration"]["clusterSha256"], "state": "committed-on-current-vps"})
    canaries(m, t)


def attest_migration(m):
    """Resolve an uncertain commit read-only, without repeating the transaction."""
    t = ticket(m)
    canaries(m, t)
    postgres = next(v for v in baseline(m)["inventory"] if v["name"] == "/masarifi-postgres17")
    prior = migration_packet.LEDGER_HASH.replace("from supabase_migrations.schema_migrations)",
              "from supabase_migrations.schema_migrations where version<>'20261107140100')")
    query = f"""begin read only;
set local statement_timeout='3s';
select jsonb_build_object(
 'cluster', (select encode(sha256(convert_to(system_identifier::text,'UTF8')),'hex') from pg_control_system())='{m['migration']['clusterSha256']}',
 'database', current_database()='postgres' and current_user='{m['migration']['executor']}',
 'constraint', {migration_packet.CONSTRAINT}=$check${migration_packet.NEW}$check$,
 'priorLedger', {prior}='{m['migration']['ledgerSha256']}',
 'memberships', {migration_packet.MEMBERSHIP_HASH}='{m['migration']['membershipsSha256']}',
 'count', (select count(*)=178 and max(version)='20261107140100' from supabase_migrations.schema_migrations),
 'entry', exists(select from supabase_migrations.schema_migrations where version='20261107140100'
   and name='support_access_denial_without_consent' and cardinality(statements)=1
   and encode(sha256(convert_to(statements[1],'UTF8')),'hex')='{migration_packet.SHA}'));
rollback;"""
    raw = run(["docker", "exec", "-i", postgres["id"], "psql", "-XqAt", "-v", "ON_ERROR_STOP=1",
               "-h", "/tmp", "-U", m["migration"]["executor"], "-d", "postgres"], data=query.encode(), timeout=8)
    result = json.loads(raw)
    require(result == dict.fromkeys(("cluster", "database", "constraint", "priorLedger", "memberships", "count", "entry"), True),
            "VPS_MIGRATION_POSTIMAGE_NOT_ADMITTED")
    return result


def unit_pid(name=UNIT):
    value = run(["systemctl", "show", "--property=MainPID", "--value", name + ".service"]).decode().strip()
    require(value.isdigit(), "UNIT_PID_UNREADABLE")
    return int(value)


def live_identity(m):
    t = ticket(m)
    ident = private_json(files.PRIVATE / "armed.json")
    pid = unit_pid()
    require(pid > 0 and ident == dict(t, watchdogPid=pid)
            and t["bootId"] == Path("/proc/sys/kernel/random/boot_id").read_text().strip(), "WATCHDOG_NOT_ARMED")
    return ident


def launch_watchdog(m, pin):
    run(["systemd-run", "--no-block", "--unit=" + UNIT, "--service-type=notify",
         "--property=Restart=on-failure", "--property=RestartForceExitStatus=SIGTERM SIGHUP SIGINT SIGPIPE",
         "--property=WatchdogSec=120s", "--property=PrivateMounts=no", "--property=RestartSec=2s",
         "--property=StartLimitIntervalSec=0", "/usr/bin/python3", "-B", str(PACKET / "host_release.py"),
         "watch", "--approved-packet-sha256", pin])
    until = time.monotonic()+20
    while time.monotonic() < until:
        if (files.PRIVATE / "armed.json").exists():
            live_identity(m)
            return
        time.sleep(.25)
    raise RuntimeError("WATCHDOG_ARMING_UNPROVEN")


def cleanup_unarmed(m, pin):
    owner = files.PRIVATE / "stage-owner.json"
    if not owner.exists():
        return
    require(private_json(owner)["packetSha256"] == pin, "STAGE_OWNERSHIP_DRIFT")
    if (files.PRIVATE / "armed.json").exists() and unit_pid() > 0:
        live_identity(m)
        return
    candidates = {}
    for role, name in NAMES.items():
        ids = run(["docker", "ps", "-aq", "--no-trunc", "--filter", "name=^/" + name + "$"]).decode().splitlines()
        require(len(ids) <= 1, "STAGE_CANDIDATE_NOT_UNIQUE")
        if ids:
            row = inspect(ids[0])
            require(row["Config"]["Labels"].get("masarifi.dashboard.base-container") ==
                    baseline(m)["originals"][role]["containerId"], "STAGE_CANDIDATE_OWNERSHIP_DRIFT")
            candidates[role] = ids[0]
    if candidates:
        quiesce(m, {"candidates": candidates})


def dispatch_stage(m, pin):
    require(not Path(ROOT).exists(), "FRESH_RELEASE_DIRECTORY_REQUIRED")
    script = str(PACKET / "host_release.py")
    cleanup = "/usr/bin/python3 -B " + script + " cleanup-unarmed --approved-packet-sha256 " + pin
    run(["systemd-run", "--no-block", "--unit=" + UNIT + "-stage",
         "--property=RuntimeMaxSec=300s", "--property=TimeoutStopSec=45s",
         "--property=ExecStopPost=" + cleanup,
         "/usr/bin/python3", "-B", script, "stage-worker", "--approved-packet-sha256", pin])


def request_trial(m):
    canaries(m, ticket(m))
    attest_migration(m)
    require(not (files.PRIVATE / "switched.json").exists(), "SWITCH_ALREADY_DISPATCHED")
    files.emit(files.PRIVATE / "switch.json", live_identity(m))


def request_acceptance(m, digest):
    require(re.fullmatch(r"[0-9a-f]{64}", digest or ""), "PRIVATE_EVIDENCE_DIGEST_REQUIRED")
    t, identity = ticket(m), live_identity(m)
    require(private_json(files.PRIVATE / "switched.json") == identity, "SERVED_SWITCH_NOT_ACKNOWLEDGED")
    observed = private_json(files.PRIVATE / "switch-observation.json")
    acceptance_receipt.verify(INPUT / "evidence", dict(t, **observed), digest)
    files.emit(files.PRIVATE / "accept.json", dict(identity, evidenceSha256=digest))


def restore_worker(m):
    require(unit_pid(UNIT + "-restore") == os.getpid() and unit_pid() == 0, "INDEPENDENT_RESTORE_REQUIRED")
    t = ticket(m)
    adapter = Adapter(m, t)
    adapter.restore()
    adapter.quiesce()
    files.emit(files.PRIVATE / "rolled-back.json", {"packetSha256": t["packetSha256"], "restored": True})


def dispatch_restore(m, pin):
    require(unit_pid() == 0, "USE_ABORT_WHILE_TRIAL_WATCHDOG_IS_ACTIVE")
    ticket(m)
    run(["systemd-run", "--no-block", "--unit=" + UNIT + "-restore", "--property=Restart=on-failure",
         "--property=RestartSec=2s", "--property=StartLimitBurst=3", "--property=StartLimitIntervalSec=120s",
         "/usr/bin/python3", "-B", str(PACKET / "host_release.py"), "restore-worker", "--approved-packet-sha256", pin])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("stage", "stage-worker", "cleanup-unarmed", "migrate", "attest", "trial",
                                         "watch", "accept", "abort", "restore", "restore-worker"))
    parser.add_argument("--approved-packet-sha256", required=True)
    parser.add_argument("--evidence-sha256")
    args = parser.parse_args()
    os.umask(0o077)
    m = admitted(args.approved_packet_sha256)
    if args.action == "stage":
        dispatch_stage(m, args.approved_packet_sha256)
    elif args.action == "stage-worker":
        require(unit_pid(UNIT + "-stage") == os.getpid(), "INDEPENDENT_STAGE_REQUIRED")
        stage(m, args.approved_packet_sha256)
    elif args.action == "cleanup-unarmed":
        cleanup_unarmed(m, args.approved_packet_sha256)
    elif args.action == "migrate":
        migrate(m)
        attest_migration(m)
    elif args.action == "attest":
        attest_migration(m)
    elif args.action == "trial":
        request_trial(m)
    elif args.action == "watch":
        require(unit_pid() == os.getpid(), "INDEPENDENT_WATCHDOG_REQUIRED")
        t = ticket(m)
        files.notify("READY=1")
        runtime = WatchRuntime(os.getpid(), Path("/proc/sys/kernel/random/boot_id").read_text().strip())
        watch(t, Adapter(m, t), runtime)
    elif args.action == "accept":
        request_acceptance(m, args.evidence_sha256)
    elif args.action == "abort":
        files.emit(files.PRIVATE / "abort.json", live_identity(m))
    elif args.action == "restore":
        dispatch_restore(m, args.approved_packet_sha256)
    else:
        restore_worker(m)
    print(json.dumps({"action": args.action, "dispatchedOrVerified": True, "dataAuthority": "current-vps"}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit("CURRENT_VPS_RELEASE_ACTION_NOT_ACKNOWLEDGED_READ_PRIVATE_STATE") from None
