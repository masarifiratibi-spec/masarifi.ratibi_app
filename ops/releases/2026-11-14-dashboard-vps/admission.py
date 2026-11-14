"""Collect current VPS pins read-only. No Env/config bodies or credentials emitted.

Invoke only on the current authoritative VPS. The returned object is private
evidence; collecting it does not authorize staging, switching or migration.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time

import read_nginx_context as context
from runtime_plan import fingerprint, plan, require

ORIGINALS = {"admin": "masarifi-admin-reflow-97ad2551-20261107",
             "api": "masarifi-admin-recovery-api-7e3bbef0"}


def run(args):
    result = subprocess.run(args, capture_output=True, timeout=30)
    require(result.returncode == 0, "READONLY_COMMAND_FAILED")
    return result.stdout


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def master_identity():
    pid = Path("/run/nginx.pid").read_text().strip()
    require(pid.isdigit() and os.readlink(f"/proc/{pid}/exe") == "/usr/sbin/nginx", "NGINX_MASTER_DRIFT")
    return dict(pid=int(pid), startedTicks=Path(f"/proc/{pid}/stat").read_text().split(") ", 1)[1].split()[19],
                commandSha256=sha(Path(f"/proc/{pid}/cmdline").read_bytes()),
                executableSha256=sha(Path(f"/proc/{pid}/exe").read_bytes()),
                mainConfigSha256=sha(Path("/etc/nginx/nginx.conf").read_bytes()),
                bootId=Path("/proc/sys/kernel/random/boot_id").read_text().strip())


def inventory(rows, exclude=()):
    return [{"id": r["Id"], "name": r["Name"], "image": r["Image"],
             "status": r["State"]["Status"], "running": r["State"]["Running"],
             "startedAt": r["State"]["StartedAt"], "restartCount": r["RestartCount"],
             "configSha256": fingerprint([r[k] for k in ("Config", "HostConfig", "Mounts")])}
            for r in sorted(rows, key=lambda r: r["Id"]) if r["Id"] not in exclude]


def collect(primary_sha):
    require(os.name == "posix" and os.geteuid() == 0, "ROOT_LINUX_REQUIRED")
    state = json.loads(Path("/etc/masarifi/selfhost/cutover-state.json").read_bytes())
    require(state["phase"] == "complete" and state["targetMayAcceptWrites"] is True,
            "CURRENT_WRITABLE_VPS_REQUIRED")
    nginx = context.receipt(primary_hash=primary_sha)
    ids = run(["docker", "ps", "-aq", "--no-trunc"]).decode().splitlines()
    require(ids and all(re.fullmatch(r"[0-9a-f]{64}", value) for value in ids), "DOCKER_IDS_INVALID")
    rows = json.loads(run(["docker", "inspect", *ids]))
    originals, payloads = {}, {}
    for role, name in ORIGINALS.items():
        matches = [r for r in rows if r["Name"] == "/" + name]
        require(len(matches) == 1, "SOURCE_CONTAINER_NOT_UNIQUE")
        row = matches[0]
        pin = dict(name=name, containerId=row["Id"], imageId=row["Image"],
                   startedAt=row["State"]["StartedAt"],
                   configurationSha256=fingerprint([row[k] for k in ("Config", "HostConfig", "Mounts")]),
                   command=(row["Config"].get("Entrypoint") or []) + (row["Config"].get("Cmd") or []))
        payload = plan(row, role, pin)
        originals[role] = dict(pin, mounts=row["Mounts"],
                               healthStatus=row["State"].get("Health", {}).get("Status"),
                               networks=sorted(row["NetworkSettings"]["Networks"]))
        payloads[role] = fingerprint(payload)  # Hash only; never serialize Env.
    require(not any(binding.get("HostPort") in ("3090", "3091")
                    for row in rows for bindings in (row["HostConfig"].get("PortBindings") or {}).values()
                    for binding in bindings or []), "CANDIDATE_DOCKER_PORT_IN_USE")
    endpoints = run(["ss", "-H", "-a", "-n", "-t", "-u"])
    require(not re.search(rb":(?:3090|3091)\b", endpoints), "CANDIDATE_SOCKET_IN_USE")
    config = run(["/usr/sbin/nginx", "-T"])
    require(not re.search(rb":(?:3090|3091)\b", config), "CANDIDATE_NGINX_PORT_IN_USE")
    mounted_files = []
    for role, pin in originals.items():
        for mount in pin["mounts"]:
            source = Path(mount["Source"])
            require(source.is_absolute() and source.exists(), "SOURCE_MOUNT_MISSING")
            if source.is_file():
                mounted_files.append(dict(role=role, source=str(source), target=mount["Destination"],
                                          sha256=sha(source.read_bytes())))
    return dict(schemaVersion=1, observedUnix=time.time(), dataAuthority="current-vps",
                readOnly=True, targetMayAcceptWrites=True, phase="complete", originals=originals,
                plannedPayloadSha256=payloads, inventory=inventory(rows),
                inventorySha256=fingerprint(inventory(rows)), mountFiles=mounted_files,
                nginx=nginx, master=master_identity(),
                ports={"3090": "observed-unused-not-reserved", "3091": "observed-unused-not-reserved"})


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--primary-sha256", required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(collect(args.primary_sha256), sort_keys=True, separators=(",", ":")))
    except Exception:
        raise SystemExit("CURRENT_VPS_READONLY_ADMISSION_FAILED") from None
