"""Stage only pinned runtime bytes under a fresh private directory; never extract Docker layers."""
import hashlib
import shutil
import tarfile
import zipfile
import os

from runtime_plan import require
from candidate_verifier import validate_runtime_members


def stream_sha(stream):
    digest=hashlib.sha256()
    for block in iter(lambda:stream.read(1024*1024),b""): digest.update(block)
    return digest.hexdigest()


def verify_file(path, n, sha):
    require(path.resolve(strict=True)==path and path.is_file() and path.stat().st_size==n,"FILE_SIZE_DRIFT")
    with path.open("rb") as f:
        require(stream_sha(f)==sha,"FILE_DIGEST_DRIFT")


def admin(zip_path, root, pins):
    verify_file(zip_path,pins["zipBytes"],pins["zipSha256"])
    tar_name="masarifi-admin-"+pins["source"]+".tar.gz"
    archive=root/tar_name
    with zipfile.ZipFile(zip_path) as z:
        require(sorted(z.namelist())==sorted(["manifest.json","SHA256SUMS",tar_name])
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
        require(len(members)==pins["members"] and sum(m.size for m in members)<3*1024**3,
                    "ADMIN_MEMBER_DRIFT")
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
    require((app/".next/BUILD_ID").read_text().strip()==pins["buildId"],"ADMIN_BUILD_DRIFT")
    (app/".next/cache").mkdir(mode=0o755)
    cache=root/"cache"
    cache.mkdir(mode=0o700)
    os.chown(cache,1000,1000)
    # A private parent bounds access on the host; the runtime is bind mounted directly.
    for directory in [runtime,*[d for d in runtime.rglob("*") if not d.is_symlink() and d.is_dir() and d!=cache]]:
        os.chmod(directory,0o755)
    return runtime
