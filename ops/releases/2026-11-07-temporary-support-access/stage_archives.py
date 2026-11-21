"""Stage only pinned runtime bytes under a fresh private directory; never extract Docker layers."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import tarfile
import zipfile
import os

import api_archive
import candidate_config as cfg
from candidate_verifier import validate_runtime_members


def verify_file(path, n, sha):
    cfg.require(path.resolve(strict=True)==path and path.is_file() and path.stat().st_size==n,"FILE_SIZE_DRIFT")
    with path.open("rb") as f:
        cfg.require(api_archive.stream_sha(f)==sha,"FILE_DIGEST_DRIFT")


def admin(zip_path, root, pins):
    verify_file(zip_path,pins["zipBytes"],pins["zipSha256"])
    tar_name="masarifi-admin-"+pins["artifactSourceCommit"]+".tar.gz"
    archive=root/tar_name
    with zipfile.ZipFile(zip_path) as z:
        cfg.require(sorted(z.namelist())==sorted(["manifest.json","SHA256SUMS",tar_name])
                    and z.getinfo("manifest.json").file_size<8192 and
                    hashlib.sha256(z.read("manifest.json")).hexdigest()==pins["manifestSha256"]
                    and z.getinfo(tar_name).file_size==pins["archiveBytes"],"ADMIN_ZIP_SCOPE_DRIFT")
        with z.open(tar_name) as src, archive.open("xb") as dst: shutil.copyfileobj(src,dst)
    verify_file(archive,pins["archiveBytes"],pins["archiveSha256"])
    runtime=root/"runtime"
    runtime.mkdir(mode=0o755)
    with tarfile.open(archive,"r:gz") as tar:
        members=tar.getmembers()
        validate_runtime_members(members)
        cfg.require(len(members)==52750 and sum(m.size for m in members)<3*1024**3,"ADMIN_MEMBER_DRIFT")
        # No symlink exists while regular files/directories are written. Never restore archive owners/devices.
        for m in members:
            path=runtime/m.name
            path.parent.mkdir(mode=0o755,parents=True,exist_ok=True)
            if m.isdir(): path.mkdir(mode=0o755,exist_ok=True)
            if m.isfile():
                with tar.extractfile(m) as src,path.open("xb") as dst: shutil.copyfileobj(src,dst)
                os.chmod(path,0o555 if m.mode & 0o111 else 0o444)
        for m in members:
            if m.issym(): (runtime/m.name).symlink_to(m.linkname)
    app=runtime/"apps/admin-web"
    cfg.require((app/".next/BUILD_ID").read_text().strip()==pins["buildId"],"ADMIN_BUILD_DRIFT")
    cache=app/".next/cache"
    cache.mkdir(mode=0o700)
    os.chown(cache,1000,1000)
    # A private parent bounds access on the host; the runtime is bind mounted directly.
    for directory in [runtime,*[d for d in runtime.rglob("*") if not d.is_symlink() and d.is_dir() and d!=cache]]:
        os.chmod(directory,0o755)
    return runtime


def api(zip_path, pins):
    verify_file(zip_path,pins["zipBytes"],pins["zipSha256"])
    actual=api_archive.verify(zip_path,pins["zipSha256"],pins["zipBytes"],pins["sourceCommit"])
    cfg.require(all(actual[k]==pins[k] for k in actual),"API_ARCHIVE_DRIFT")
    tag="masarifi-backend:"+pins["sourceCommit"]
    found=subprocess.check_output(["docker","image","ls","--no-trunc","--format","{{.ID}}",tag],timeout=15).decode().splitlines()
    cfg.require(found in ([],[pins["imageId"]]),"REFUSE_RETAG_EXISTING_IMAGE")
    if not found:
        with zipfile.ZipFile(zip_path) as z,z.open(api_archive.TAR) as src:
            with subprocess.Popen(["docker","image","load"],stdin=subprocess.PIPE,
                                  stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL) as child:
                try:
                    shutil.copyfileobj(src,child.stdin)
                    child.stdin.close()
                    cfg.require(child.wait(timeout=120)==0,"IMAGE_LOAD_FAILED")
                except BaseException:
                    child.kill()
                    raise
    actual_id=subprocess.check_output(["docker","image","inspect","--format","{{.Id}}",tag],timeout=10).decode().strip()
    cfg.require(actual_id==pins["imageId"],"LOADED_API_IMAGE_DRIFT")
