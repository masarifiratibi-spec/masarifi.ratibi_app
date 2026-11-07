"""Independent cutover monitor; accepts only a root-owned, separately admitted packet."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import time

import candidate_config as cfg
import host_inventory as inv
import read_nginx_context as context

PACKET = Path(__file__).resolve().parent
PRIVATE = Path(cfg.ROOT) / "rollback"
TARGET = Path("/etc/nginx/sites-available/masarifi-staging")
ENABLED = Path("/etc/nginx/sites-enabled/masarifi-staging")
PRIMARY = Path("/etc/nginx/sites-available/masarifi-production-core-20261105.conf")
PRIMARY_LINK = Path("/etc/nginx/sites-enabled/masarifi-production-core-20261105.conf")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def exact_file(path):
    cfg.require(path.resolve(strict=True)==path and path.is_file(), "UNSAFE_FILE")
    return path.read_bytes()


def emit(path, obj):
    # An acknowledgment must not outlive the actual watcher's ticket/PID.
    with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as out:
        tmp=Path(out.name)
        try:
            out.write(json.dumps(obj,sort_keys=True).encode()+b"\n")
            out.flush()
            os.fsync(out.fileno())
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
    try:
        os.replace(tmp,path)
        if os.name=="posix":
            directory=os.open(path.parent,os.O_DIRECTORY)
            try:os.fsync(directory)
            finally:os.close(directory)
    finally:
        tmp.unlink(missing_ok=True)


def verify_paths(manifest):
    for path,link in ((TARGET,ENABLED),(PRIMARY,PRIMARY_LINK)):
        cfg.require(path.resolve(strict=True)==path and link.parent.resolve(strict=True)==link.parent
                    and link.is_symlink() and link.resolve(strict=True)==path
                    and (link.parent/os.readlink(link)).name==path.name
                    and (link.parent/os.readlink(link)).parent.samefile(path.parent), "ROUTING_LINK_DRIFT")
    cfg.require(sha(exact_file(PRIMARY))==manifest["protectedPrimarySha256"],"PRIMARY_DRIFT")
    cfg.require(metadata(TARGET)==manifest["originalMetadata"],"ORIGINAL_METADATA_DRIFT")


def links(manifest):
    verify_paths(manifest)
    cfg.require(inv.master_identity()==manifest["master"],"MASTER_DRIFT")


def compatible_master(original,current):
    # A replacement pid is admitted exclusively for restoration on the same boot,
    # with the independently observed executable, invocation and primary config.
    return all(original[k]==current[k] for k in ("bootId","masterExeSha256","mainConfigSha256"))


def converge(probe,seconds=8):
    end=time.monotonic()+seconds
    while True:
        try:probe();return
        except (ValueError,OSError,subprocess.SubprocessError):
            if time.monotonic()>=end:raise
            time.sleep(0.2)


def metadata(path):
    s=path.stat()
    return dict(uid=s.st_uid,gid=s.st_gid,mode=stat.S_IMODE(s.st_mode),
                xattrsSha256=cfg.fingerprint({k:sha(os.getxattr(path,k)) for k in sorted(os.listxattr(path))}))


def atomic(target, raw, expected):
    # Preserve uid/gid, permission bits and extended metadata on the pinned inode.
    cfg.require(sha(exact_file(target))==expected,"UNREVIEWED_LIVE_ROUTING")
    s=target.stat()
    attrs={key:os.getxattr(target,key) for key in os.listxattr(target)}
    tmp=None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".support-access-",delete=False) as f:
            tmp=Path(f.name)
            f.write(raw); f.flush()
            os.fchown(f.fileno(),s.st_uid,s.st_gid)
            os.fchmod(f.fileno(),stat.S_IMODE(s.st_mode))
            for key,value in attrs.items(): os.setxattr(f.fileno(),key,value)
            os.fsync(f.fileno())
        cfg.require(target.stat().st_ino==s.st_ino and sha(exact_file(target))==expected,"ROUTING_CHANGED")
        os.replace(tmp,target)
        fd=os.open(target.parent,os.O_DIRECTORY)
        try: os.fsync(fd)
        finally: os.close(fd)
    finally:
        if tmp is not None: tmp.unlink(missing_ok=True)


def nginx_reload():
    # Do not log arbitrary configuration values on validator failure.
    for args in (["/usr/sbin/nginx","-t"],["/usr/sbin/nginx","-s","reload"]):
        subprocess.run(args,check=True,timeout=15,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


def mounted_file(target, source):
    # mountinfo field 5 is the mountpoint (the reviewed paths have no escapes).
    entries=[ln for ln in Path("/proc/self/mountinfo").read_text().splitlines() if ln.split()[4]==str(target)]
    if not entries: return False
    cfg.require(len(entries)==1 and source.is_file() and os.path.samestat(target.stat(),source.stat()),"FOREIGN_FILE_MOUNT")
    return True


def bind_trial(target, source):
    cfg.require(not mounted_file(target,source),"ALREADY_MOUNTED")
    subprocess.run(["mount","--no-mtab","--bind",str(source),str(target)],check=True,timeout=10)
    cfg.require(mounted_file(target,source),"TRIAL_NOT_MOUNTED")


def detach(target,source):
    cfg.require(mounted_file(target,source),"TRIAL_NOT_MOUNTED")
    subprocess.run(["umount","--no-mtab",str(target)],check=True,timeout=10)
    cfg.require(not mounted_file(target,source),"TRIAL_NOT_DETACHED")


def prepare_trial(raw,t):
    source=PRIVATE/"trial"
    cfg.require(not source.exists() and sha(raw)==t["candidateSha256"] and metadata(TARGET)==t["originalMetadata"],
                "TRIAL_PREIMAGE_DRIFT")
    s=TARGET.stat()
    with source.open("xb") as f:
        f.write(raw); f.flush()
        os.fchown(f.fileno(),s.st_uid,s.st_gid);os.fchmod(f.fileno(),stat.S_IMODE(s.st_mode))
        for k in os.listxattr(TARGET):os.setxattr(f.fileno(),k,os.getxattr(TARGET,k))
        os.fsync(f.fileno())
    cfg.require(metadata(source)==t["originalMetadata"],"TRIAL_METADATA_DRIFT")


def finalize_trial(t):
    raw=exact_file(PRIVATE/"trial")
    cfg.require(sha(raw)==t["candidateSha256"] and sha(exact_file(TARGET))==t["candidateSha256"],"TRIAL_DRIFT")
    detach(TARGET,PRIVATE/"trial")
    # Existing workers keep the accepted candidate while its bytes become durable.
    atomic(TARGET,raw,t["originalSha256"])
    nginx_reload()


def binding(ticket,pid):
    return {"ticket":ticket["ticket"],"watchdogPid":pid,"candidateSha256":ticket["candidateSha256"],
            "originalSha256":ticket["originalSha256"],"candidates":ticket["candidates"],"packetSha256":ticket["packetSha256"]}


def restore(ticket, prove):
    verify_paths(ticket)
    original=exact_file(PRIVATE/"original")
    cfg.require(sha(original)==ticket["originalSha256"],"BACKUP_DRIFT")
    if mounted_file(TARGET,PRIVATE/"trial"):
        detach(TARGET,PRIVATE/"trial")
    current=sha(exact_file(TARGET))
    if current==ticket["candidateSha256"]:
        atomic(TARGET,original,current)
    else:
        cfg.require(current==ticket["originalSha256"],"REFUSE_FOREIGN_ROUTING")
    # Original disk bytes alone do not establish what old workers are serving.
    verify_paths(ticket)
    cfg.require(compatible_master(ticket["master"],inv.master_identity()),"RESTORE_MASTER_NOT_ADMITTED")
    r=context.receipt()
    cfg.require(r["contextSha256"]==ticket["contextSha256"] and r["candidateSha256"]==ticket["candidateSha256"],
                "RESTORE_CONTEXT_DRIFT")
    nginx_reload()
    converge(prove)


def notify(message):
    import socket
    dest=os.environ.get("NOTIFY_SOCKET")
    if dest:
        with socket.socket(socket.AF_UNIX,socket.SOCK_DGRAM) as sock:
            sock.sendto(message.encode(),dest if dest[0]!="@" else chr(0)+dest[1:])


def watch(ticket, healthy, prove_old, prove_candidate, install, accept, quiesce=None, now=time.monotonic, sleep=time.sleep):
    ident=binding(ticket,os.getpid())
    cfg.require(ticket["bootId"]==Path("/proc/sys/kernel/random/boot_id").read_text().strip(),"BOOT_CHANGED")
    cfg.require(ticket["deadline"]<=now()+1200,"DEADLINE_INVALID")
    restarting=(PRIVATE/"armed.json").exists()
    if not restarting and now()<ticket["deadline"]:
        links(ticket)
        cfg.require(sha(exact_file(TARGET))==ticket["originalSha256"],"ALREADY_SWITCHED")
        healthy()
        emit(PRIVATE/"armed.json",ident)
    notify("READY=1")
    while not restarting and now()<ticket["deadline"]:
        try:
            notify("WATCHDOG=1")
            links(ticket)
            state=sha(exact_file(TARGET))
            cfg.require(state in (ticket["originalSha256"],ticket["candidateSha256"]),"REFUSE_FOREIGN_ROUTING")
            healthy()
            if (PRIVATE/"abort.json").exists(): break
            request=PRIVATE/"switch.json"
            if state==ticket["originalSha256"] and request.exists():
                cfg.require(json.loads(exact_file(request))==ident and now()<ticket["deadline"]-15,"INVALID_SWITCH_REQUEST")
                install()
                converge(prove_candidate)
                emit(PRIVATE/"switch-observation.json",dict(ident,switchedUnix=time.time()))
                emit(PRIVATE/"switched.json",ident)
            elif state==ticket["candidateSha256"]:
                prove_candidate()
                receipt=PRIVATE/"accept.json"
                if receipt.exists():
                    data=json.loads(exact_file(receipt))
                    if data==dict(ident,accepted=True) and now()<ticket["deadline"]-30:
                        accept()
                        converge(prove_candidate)
                        emit(PRIVATE/"ack.json",data)
                        return
        except (OSError,ValueError,KeyError,RuntimeError,subprocess.SubprocessError):
            break
        sleep(2)
    for attempt in range(4):
        try:
            notify("WATCHDOG=1")
            emit(PRIVATE/"abort.json",{"abort":True})
            restore(ticket,prove_old)
            if quiesce is not None: quiesce()
            emit(PRIVATE/"restored.json",dict(ident,restored=True))
            return
        except Exception:
            if attempt==3: raise
            sleep(2)


if __name__=="__main__":
    import host_release as host
    manifest=host.admitted()
    ticket=host.ticket(manifest)
    watch(ticket,lambda:host.canaries(manifest,ticket),lambda:host.prove_original(ticket),
          lambda:host.candidate_public(manifest),lambda:host.install_trial(manifest,ticket),
          lambda:host.finalize(manifest,ticket),lambda:host.quiesce(manifest,ticket["candidates"]))
