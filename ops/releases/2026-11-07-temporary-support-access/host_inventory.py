"""Read-only, sanitized admission for the two original loopback services and protected peers."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

import candidate_config as cfg


def run(argv):
    return subprocess.check_output(argv,stderr=subprocess.DEVNULL,timeout=15)


def inspect(identity):
    return json.loads(run(["docker","inspect",identity]))[0]


def digest(b):
    return hashlib.sha256(b).hexdigest()


def inspect_pin(identity):
    return digest(run(["docker","inspect","--format","{{json .Config}} {{json .HostConfig}}",identity]))


def inventory(baseline, exclude=()):
    ids=sorted(run(["docker","ps","--no-trunc","--format","{{.ID}}"]).decode().splitlines())
    ids=[i for i in ids if i not in exclude]
    set_hash=digest(("".join(i+"\n" for i in ids)).encode())
    cfg.require(set_hash==baseline["runningContainerIdsSortedSha256"],"ORIGINAL_CONTAINER_SET_DRIFT")
    rows=json.loads(run(["docker","inspect",*ids]))
    protected=[]
    for row in sorted(rows,key=lambda r:r["Id"]):
        cfg.require(row["State"]["Running"],"ORIGINAL_STOPPED")
        protected.append([row["Id"],row["Name"],row["Image"],row["State"]["StartedAt"],row["RestartCount"],
                          cfg.fingerprint([row["Config"],row["HostConfig"],row["Mounts"]])])
    for name in ("actualApi","admin","protectedPrimaryApi","protectedLegacyApi3000"):
        orig=baseline[name]
        found=[r for r in rows if r["Name"]=="/"+orig["name"]]
        cfg.require(len(found)==1,"HOST_IDENTITY_MISSING")
        row=found[0]
        cfg.require(row["Image"]=="sha256:"+orig["image"] and row["Id"]==orig.get("id",row["Id"])
                    and row["State"]["StartedAt"]==orig.get("startedAt",row["State"]["StartedAt"]),"HOST_IDENTITY_DRIFT")
        if "configAndHostConfigSha256" in orig:
            cfg.require(inspect_pin(row["Id"])==orig["configAndHostConfigSha256"],"DOCKER_CONFIG_DRIFT")
    return dict(protectedSha256=cfg.fingerprint(protected),originalIdsSha256=set_hash,**master_identity())


def master_identity():
    pid=Path("/run/nginx.pid").read_text().strip()
    cfg.require(pid.isdigit() and os.readlink(f"/proc/{pid}/exe")=="/usr/sbin/nginx","MASTER_EXECUTABLE_DRIFT")
    exe=Path(f"/proc/{pid}/exe")
    master=Path(f"/proc/{pid}/cmdline").read_bytes().rstrip(b"\0")
    cfg.require(master==b"nginx: master process /usr/sbin/nginx -g daemon on; master_process on;","MASTER_ARGUMENTS_DRIFT")
    return dict(masterPid=int(pid),masterStartTicks=Path(f"/proc/{pid}/stat").read_text().split(") ",1)[1].split()[19],
        masterExeSha256=digest(exe.read_bytes()),mainConfigSha256=digest(Path("/etc/nginx/nginx.conf").read_bytes()),
        bootId=Path("/proc/sys/kernel/random/boot_id").read_text().strip())


def headroom():
    mem=next(int(s.split()[1])*1024 for s in Path("/proc/meminfo").read_text().splitlines() if s.startswith("MemAvailable:"))
    return dict(availableMemoryBytes=mem,freeDiskBytes=shutil.disk_usage("/opt").free,
        portsFree=not run(["ss","-lntH","( sport = :3042 or sport = :3043 )"]).strip())
