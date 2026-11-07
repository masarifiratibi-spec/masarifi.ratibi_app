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
    finally:
        tmp.unlink(missing_ok=True)


def links(manifest):
    for path,link in ((TARGET,ENABLED),(PRIMARY,PRIMARY_LINK)):
        cfg.require(path.resolve(strict=True)==path and link.parent.resolve(strict=True)==link.parent
                    and link.is_symlink() and link.resolve(strict=True)==path
                    and (link.parent/os.readlink(link)).name==path.name
                    and (link.parent/os.readlink(link)).parent.samefile(path.parent), "ROUTING_LINK_DRIFT")
    cfg.require(sha(exact_file(PRIMARY))==manifest["protectedPrimarySha256"],"PRIMARY_DRIFT")
    cfg.require(inv.master_identity()==manifest["master"] and metadata(TARGET)==manifest["originalMetadata"],
                "MASTER_OR_METADATA_DRIFT")


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


def binding(ticket,pid):
    return {"ticket":ticket["ticket"],"watchdogPid":pid,"candidateSha256":ticket["candidateSha256"],
            "originalSha256":ticket["originalSha256"],"candidates":ticket["candidates"],"packetSha256":ticket["packetSha256"]}


def restore(ticket, prove):
    links(ticket)
    original=exact_file(PRIVATE/"original")
    cfg.require(sha(original)==ticket["originalSha256"],"BACKUP_DRIFT")
    current=sha(exact_file(TARGET))
    if current==ticket["candidateSha256"]:
        atomic(TARGET,original,current)
    else:
        cfg.require(current==ticket["originalSha256"],"REFUSE_FOREIGN_ROUTING")
    # Original disk bytes alone do not establish what old workers are serving.
    links(ticket)
    r=context.receipt()
    cfg.require(r["contextSha256"]==ticket["contextSha256"] and r["candidateSha256"]==ticket["candidateSha256"],
                "RESTORE_CONTEXT_DRIFT")
    nginx_reload()
    prove()


def watch(ticket, healthy, prove_old, prove_candidate, lock, quiesce=None, now=time.monotonic, sleep=time.sleep):
    ident=binding(ticket,os.getpid())
    cfg.require(ticket["bootId"]==Path("/proc/sys/kernel/random/boot_id").read_text().strip(),"BOOT_CHANGED")
    cfg.require(ticket["deadline"]<=now()+1200,"DEADLINE_INVALID")
    links(ticket)
    restarting=(PRIVATE/"armed.json").exists()
    if not restarting and now()<ticket["deadline"]:
        cfg.require(sha(exact_file(TARGET))==ticket["originalSha256"],"ALREADY_SWITCHED")
        healthy()
        emit(PRIVATE/"armed.json",ident)
    # If systemd replaces a lost watchdog PID, never inherit its acceptance.
    while not restarting and now()<ticket["deadline"]:
        try:
            with lock():
                links(ticket)
                state=sha(exact_file(TARGET))
                cfg.require(state in (ticket["originalSha256"],ticket["candidateSha256"]),"REFUSE_FOREIGN_ROUTING")
                healthy()
                if (PRIVATE/"abort.json").exists(): break
                receipt=PRIVATE/"accept.json"
                if state==ticket["candidateSha256"]:
                    prove_candidate()
                    if receipt.exists():
                        data=json.loads(exact_file(receipt))
                        if data==dict(ident,accepted=True) and now()<ticket["deadline"]:
                            emit(PRIVATE/"ack.json",data)
                            return
        except (OSError,ValueError,KeyError,RuntimeError,subprocess.SubprocessError):
            break
        sleep(2)
    # Always retry validation, reload and proof, even if an earlier try restored bytes.
    for attempt in range(4):
        try:
            with lock():
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
          lambda:host.candidate_public(manifest),host.cutover_lock,
          lambda:host.quiesce(manifest,ticket["candidates"]))
