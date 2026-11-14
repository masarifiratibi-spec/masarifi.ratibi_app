"""Hash-bound Nginx trial files and restoration. Imported only by an approved adapter."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import time
from contextlib import contextmanager

from runtime_plan import require, fingerprint, ROOT
import admission as inv
import read_nginx_context as context

PACKET = Path(__file__).resolve().parent
PRIVATE = Path(ROOT) / "rollback"
TARGET = Path("/etc/nginx/sites-available/masarifi-staging")
ENABLED = Path("/etc/nginx/sites-enabled/masarifi-staging")
PRIMARY = Path("/etc/nginx/sites-available/masarifi-production-core-20261105.conf")
PRIMARY_LINK = Path("/etc/nginx/sites-enabled/masarifi-production-core-20261105.conf")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def exact_file(path):
    require(path.resolve(strict=True)==path and path.is_file(), "UNSAFE_FILE")
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
        require(path.resolve(strict=True)==path and link.parent.resolve(strict=True)==link.parent
                    and link.is_symlink() and link.resolve(strict=True)==path
                    and (link.parent/os.readlink(link)).name==path.name
                    and (link.parent/os.readlink(link)).parent.samefile(path.parent), "ROUTING_LINK_DRIFT")
    require(sha(exact_file(PRIMARY))==manifest["protectedPrimarySha256"],"PRIMARY_DRIFT")
    require(metadata(TARGET)==manifest["originalMetadata"],"ORIGINAL_METADATA_DRIFT")


def links(manifest):
    verify_paths(manifest)
    require(inv.master_identity()==manifest["master"],"MASTER_DRIFT")


def compatible_master(original,current):
    # A replacement pid is admitted exclusively for restoration on the same boot,
    # with the independently observed executable, invocation and primary config.
    return all(original[k]==current[k] for k in ("bootId","executableSha256","commandSha256","mainConfigSha256"))


def converge(probe,seconds=8,deadline=None):
    end=min(time.monotonic()+seconds, deadline) if deadline is not None else time.monotonic()+seconds
    while True:
        try:
            require(time.monotonic()<end,"PROBE_WINDOW_CLOSED")
            probe()
            require(time.monotonic()<end,"PROBE_WINDOW_CLOSED")
            return
        except (ValueError,OSError,subprocess.SubprocessError):
            if time.monotonic()>=end:raise
            time.sleep(0.2)


def metadata(path):
    s=path.stat()
    return dict(uid=s.st_uid,gid=s.st_gid,mode=stat.S_IMODE(s.st_mode),
                xattrsSha256=fingerprint({k:sha(os.getxattr(path,k)) for k in sorted(os.listxattr(path))}))


def atomic(target, raw, expected):
    # Preserve uid/gid, permission bits and extended metadata on the pinned inode.
    require(sha(exact_file(target))==expected,"UNREVIEWED_LIVE_ROUTING")
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
        require(target.stat().st_ino==s.st_ino and sha(exact_file(target))==expected,"ROUTING_CHANGED")
        os.replace(tmp,target)
        fd=os.open(target.parent,os.O_DIRECTORY)
        try: os.fsync(fd)
        finally: os.close(fd)
    finally:
        if tmp is not None: tmp.unlink(missing_ok=True)


def nginx_reload(deadline=None):
    # Do not log arbitrary configuration values on validator failure.
    for args in (["/usr/sbin/nginx","-t"],["/usr/sbin/nginx","-s","reload"]):
        budget=15 if deadline is None else min(15,deadline-time.monotonic())
        require(budget>0,"ACCEPTANCE_WINDOW_CLOSED")
        subprocess.run(args,check=True,timeout=budget,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


def require_acceptance_open(ticket):
    require(time.monotonic()<ticket["deadline"] and not (PRIVATE/"abort.json").exists(),
            "ACCEPTANCE_WINDOW_CLOSED")


@contextmanager
def decision_lock():
    import fcntl
    with (PRIVATE/"decision.lock").open("a+b") as lock:
        fcntl.flock(lock.fileno(),fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock.fileno(),fcntl.LOCK_UN)


def publish_acceptance(ticket,receipt):
    with decision_lock():
        require_acceptance_open(ticket)
        emit(PRIVATE/"accepted.json",receipt)


def publish_abort(receipt):
    with decision_lock():
        require(not (PRIVATE/"accepted.json").exists(),"ALREADY_ACCEPTED_USE_RESTORE")
        emit(PRIVATE/"abort.json",receipt)


def mounted_file(target, source):
    # mountinfo field 5 is the mountpoint (the reviewed paths have no escapes).
    entries=[ln for ln in Path("/proc/self/mountinfo").read_text().splitlines() if ln.split()[4]==str(target)]
    if not entries: return False
    require(len(entries)==1 and source.is_file() and os.path.samestat(target.stat(),source.stat()),"FOREIGN_FILE_MOUNT")
    return True


def bind_trial(target, source):
    require(not mounted_file(target,source),"ALREADY_MOUNTED")
    subprocess.run(["mount","--no-mtab","--bind",str(source),str(target)],check=True,timeout=10)
    require(mounted_file(target,source),"TRIAL_NOT_MOUNTED")


def detach(target,source):
    require(mounted_file(target,source),"TRIAL_NOT_MOUNTED")
    subprocess.run(["umount","--no-mtab",str(target)],check=True,timeout=10)
    require(not mounted_file(target,source),"TRIAL_NOT_DETACHED")


def prepare_trial(raw,t):
    source=PRIVATE/"trial"
    require(not source.exists() and sha(raw)==t["candidateSha256"] and metadata(TARGET)==t["originalMetadata"],
                "TRIAL_PREIMAGE_DRIFT")
    s=TARGET.stat()
    with source.open("xb") as f:
        f.write(raw); f.flush()
        os.fchown(f.fileno(),s.st_uid,s.st_gid);os.fchmod(f.fileno(),stat.S_IMODE(s.st_mode))
        for k in os.listxattr(TARGET):os.setxattr(f.fileno(),k,os.getxattr(TARGET,k))
        os.fsync(f.fileno())
    require(metadata(source)==t["originalMetadata"],"TRIAL_METADATA_DRIFT")


def finalize_trial(t):
    require_acceptance_open(t)
    raw=exact_file(PRIVATE/"trial")
    require(sha(raw)==t["candidateSha256"] and sha(exact_file(TARGET))==t["candidateSha256"],"TRIAL_DRIFT")
    detach(TARGET,PRIVATE/"trial")
    require_acceptance_open(t)
    # Existing workers keep the accepted candidate while its bytes become durable.
    atomic(TARGET,raw,t["originalSha256"])
    require_acceptance_open(t)
    nginx_reload(t["deadline"])
    require_acceptance_open(t)


def restore(ticket, prove):
    verify_paths(ticket)
    original=exact_file(PRIVATE/"original")
    require(sha(original)==ticket["originalSha256"],"BACKUP_DRIFT")
    if mounted_file(TARGET,PRIVATE/"trial"):
        detach(TARGET,PRIVATE/"trial")
    current=sha(exact_file(TARGET))
    if current==ticket["candidateSha256"]:
        atomic(TARGET,original,current)
    else:
        require(current==ticket["originalSha256"],"REFUSE_FOREIGN_ROUTING")
    # Original disk bytes alone do not establish what old workers are serving.
    verify_paths(ticket)
    require(compatible_master(ticket["master"],inv.master_identity()),"RESTORE_MASTER_NOT_ADMITTED")
    r=context.receipt(primary_hash=ticket["protectedPrimarySha256"])
    require(r["contextSha256"]==ticket["contextSha256"] and r["candidateSha256"]==ticket["candidateSha256"],
                "RESTORE_CONTEXT_DRIFT")
    nginx_reload()
    converge(prove)


def notify(message):
    import socket
    dest=os.environ.get("NOTIFY_SOCKET")
    if dest:
        with socket.socket(socket.AF_UNIX,socket.SOCK_DGRAM) as sock:
            sock.sendto(message.encode(),dest if dest[0]!="@" else chr(0)+dest[1:])
