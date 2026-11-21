"""Disposable Linux CI only: exercise a regular-file mount with a real Nginx master."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

import watchdog as wd


def check(ok,reason):
    if not ok: raise RuntimeError(reason)


def runner():
    check(os.geteuid()==0 and os.environ.get("GITHUB_ACTIONS")=="true" and
          os.readlink("/proc/self/ns/mnt")!=os.readlink("/proc/1/ns/mnt"),"PRIVATE_CI_NAMESPACE_REQUIRED")
    with tempfile.TemporaryDirectory(prefix="support-access-ci-",dir="/tmp") as tmp:
        root=Path(tmp)
        target=root/"site.conf"
        source=root/"trial"
        probe=root/"nginx.conf"
        old=b'location = /probe { return 200 "original"; }'
        new=old.replace(b"original",b"candidate")
        target.write_bytes(old)
        source.write_bytes(new)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
        probe.write_text(f"pid {root}/master.pid; error_log {root}/error.log; events {{}} "
                         f"http {{ access_log off; server {{ listen 127.0.0.1:{port}; include {target}; }} }}")
        nginx=["/usr/sbin/nginx","-p",tmp,"-c",str(probe)]
        def reload():
            subprocess.run(nginx+["-t"],check=True,timeout=5)
            subprocess.run(nginx+["-s","reload"],check=True,timeout=5)
        def serves(want):
            until=time.monotonic()+5
            while time.monotonic()<until:
                try:
                    with urlopen(f"http://127.0.0.1:{port}/probe",timeout=1) as rsp:
                        if rsp.read()==want:return
                except OSError:pass
                time.sleep(0.1)
            raise RuntimeError("WRONG_SERVED_GENERATION")
        # A namespace terminating with the trial still mounted must leave original bytes.
        subprocess.run(["unshare","--mount","--propagation","private",sys.executable,"-B",__file__,
                        "child",str(target),str(source)],check=True,timeout=10)
        check(not wd.mounted_file(target,source) and target.read_bytes()==old,"NAMESPACE_EXIT_PERSISTED_TRIAL")
        master=subprocess.Popen(nginx+["-g","daemon off;"])
        try:
            serves(b"original")
            wd.bind_trial(target,source)
            impostor=root/"foreign";impostor.write_bytes(new)
            try:wd.mounted_file(target,impostor)
            except ValueError as exc:check(str(exc)=="FOREIGN_FILE_MOUNT","WRONG_REJECTION")
            else:raise RuntimeError("FOREIGN_MOUNT_ACCEPTED")
            reload();serves(b"candidate")
            wd.detach(target,source)
            check(target.read_bytes()==old,"ORIGINAL_DISK_CHANGED")
            reload();serves(b"original")
            wd.bind_trial(target,source);reload();serves(b"candidate")
            from unittest.mock import patch
            with patch.object(wd,"PRIVATE",root),patch.object(wd,"TARGET",target),patch.object(wd,"nginx_reload",reload):
                wd.finalize_trial(dict(candidateSha256=wd.sha(new),originalSha256=wd.sha(old)))
            check(not wd.mounted_file(target,source) and target.read_bytes()==new,"ACCEPTED_BYTES_NOT_PERSISTENT")
            serves(b"candidate")
        finally:
            master.terminate();master.wait(timeout=8)
            if wd.mounted_file(target,source):wd.detach(target,source)
    print("PASS namespace exit, scoped trial, live candidate, rollback, foreign mount rejection, accepted persistence")


if __name__=="__main__":
    if sys.argv[1:2]==["child"]:
        target,source=map(Path,sys.argv[2:])
        check(os.geteuid()==0 and os.environ.get("GITHUB_ACTIONS")=="true" and
              os.readlink("/proc/self/ns/mnt")!=os.readlink("/proc/1/ns/mnt") and
              target.parent==source.parent and target.parent.parent==Path("/tmp") and
              target.parent.name.startswith("support-access-ci-"),"DISPOSABLE_PATH_REQUIRED")
        wd.bind_trial(target,source)
        check(target.read_bytes()==source.read_bytes(),"CHILD_TRIAL_ABSENT")
    else:runner()
