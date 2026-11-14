"""Verify a GitHub artifact ZIP and its Docker-save runtime in memory, without loading it."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile
import zipfile
import zlib

TAR = "backend-candidate.tar.gz"
META = "backend-candidate-manifest.json"
ID = "backend-candidate-image.txt"


def require(ok, why):
    if not ok:
        raise ValueError(why)


def stream_sha(stream):
    h = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        h.update(chunk)
    return h.hexdigest()


def scan_entry(stream, keep, remaining):
    raw=hashlib.sha256()
    diff=hashlib.sha256()
    capture=bytearray()
    first=True; decoder=None; count=0
    for chunk in iter(lambda:stream.read(128*1024),b""):
        raw.update(chunk)
        if keep: capture.extend(chunk)
        if first and chunk.startswith(b"\x1f\x8b"): decoder=zlib.decompressobj(31)
        first=False
        if decoder is None:
            count+=len(chunk); diff.update(chunk)
        else:
            while chunk:
                out=decoder.decompress(chunk,1024*1024)
                count+=len(out); diff.update(out)
                require(count<=remaining and not decoder.unused_data,"LAYER_EXPANSION_LIMIT_OR_TRAILING_DATA")
                chunk=decoder.unconsumed_tail
        require(count<=remaining,"LAYER_EXPANSION_LIMIT")
    require(decoder is None or decoder.eof,"INCOMPLETE_LAYER")
    return raw.hexdigest(),diff.hexdigest(),count,bytes(capture)


def verify(path, zip_sha, zip_bytes, commit):
    require(re.fullmatch("[a-f0-9]{40}", commit), "SOURCE_PIN_REQUIRED")
    require(path.stat().st_size == zip_bytes, "ZIP_SIZE_DRIFT")
    with path.open("rb") as f:
        require(stream_sha(f) == zip_sha, "ZIP_DIGEST_DRIFT")
    with zipfile.ZipFile(path) as z:
        require(sorted(z.namelist()) == sorted([TAR, META, ID]), "UNEXPECTED_ZIP_SCOPE")
        require(z.getinfo(META).file_size < 4096 and z.getinfo(ID).file_size < 100, "METADATA_TOO_LARGE")
        raw = z.read(META)
        meta = json.loads(raw)
        identity = z.read(ID).decode("ascii").strip()
        require(re.fullmatch("sha256:[a-f0-9]{64}", identity), "INVALID_IMAGE_ID")
        size = z.getinfo(TAR).file_size
        require(0 < size <= 2 * 1024**3, "ARCHIVE_SIZE_LIMIT")
        with z.open(TAR) as f:
            archive_sha = stream_sha(f)
        require(meta == dict(sourceCommit=commit,imageId=identity,archiveSha256=archive_sha,
            archiveBytes=size,format="docker-save-gzip",hostedActivationPerformed=False)
            and meta["hostedActivationPerformed"] is False, "CI_MANIFEST_DRIFT")
        contents = {}
        uncompressed = {}
        captured = {}
        seen = set()
        total = 0
        expanded = 0
        with z.open(TAR) as f, tarfile.open(fileobj=f, mode="r|gz") as tar:
            for m in tar:
                name = m.name
                require(name == PurePosixPath(name).as_posix() and not name.startswith("/")
                    and ".." not in name.split("/") and "\\" not in name and ":" not in name
                    and name not in seen and len(seen) < 2048, "INVALID_SAVE_ENTRY")
                seen.add(name)
                if m.isdir():
                    continue
                total += m.size
                require(m.isfile() and not m.sparse and total <= 5 * 1024**3, "INVALID_SAVE_TYPE_OR_SIZE")
                stream = tar.extractfile(m)
                keep=name in ("manifest.json","index.json","repositories","oci-layout",identity[7:]+".json","blobs/sha256/"+identity[7:])
                if keep: require(0<m.size<2*1024**2,"IMAGE_METADATA_TOO_LARGE")
                digest,diff,count,small=scan_entry(stream,keep or (name.startswith("blobs/") and m.size<131072),5*1024**3-expanded)
                expanded+=count
                if small: captured[name]=small
                uncompressed[name]=diff
                if name.startswith("blobs/"):
                    require(name == "blobs/sha256/"+digest, "OCI_BLOB_DIGEST_DRIFT")
                contents[name] = digest
        rows = json.loads(captured["manifest.json"])
        require(isinstance(rows,list) and len(rows)==1, "SAVE_REQUIRES_ONE_IMAGE")
        row = rows[0]
        require(row["RepoTags"] == ["masarifi-backend:"+commit] and contents[row["Config"]] == identity[7:], "IMAGE_TAG_OR_CONFIG_DRIFT")
        image = json.loads(captured[row["Config"]])
        conf = image["config"]
        require(image["os"] == "linux" and image["architecture"] == "amd64"
            and conf["User"] == "65532:65532" and conf["WorkingDir"] == "/app"
            and conf["Entrypoint"] == ["/nodejs/bin/node"] and conf["Cmd"] == ["dist/src/main.js"]
            and conf["Labels"]["org.opencontainers.image.revision"] == commit, "IMAGE_RUNTIME_DRIFT")
        require(image["rootfs"]["type"] == "layers" and 0 < len(row["Layers"]) == len(image["rootfs"]["diff_ids"]), "LAYER_COUNT_DRIFT")
        for name, diff_id in zip(row["Layers"], image["rootfs"]["diff_ids"]):
            require(re.fullmatch("sha256:[a-f0-9]{64}", diff_id) and name in contents and
                    diff_id == "sha256:"+uncompressed[name], "LAYER_PIN_DRIFT")
        if "repositories" in captured:
            repos=json.loads(captured["repositories"])
            require(set(repos)=={"masarifi-backend"} and set(repos["masarifi-backend"])=={commit},"UNREVIEWED_REPOSITORY_TAG")
        if "index.json" in captured:
            index=json.loads(captured["index.json"])
            for depth in range(3):
                entries=index.get("manifests")
                require(index.get("schemaVersion")==2 and isinstance(entries,list) and len(entries)==1,"UNREVIEWED_OCI_INDEX")
                entry=entries[0]
                for key in ("io.containerd.image.name","org.opencontainers.image.ref.name"):
                    tag=entry.get("annotations",{}).get(key)
                    require(tag is None or tag in [commit,"masarifi-backend:"+commit,"docker.io/library/masarifi-backend:"+commit],"UNREVIEWED_OCI_TAG")
                digest=entry["digest"]; require(re.fullmatch("sha256:[a-f0-9]{64}",digest),"UNSUPPORTED_OCI_DIGEST")
                child=json.loads(captured["blobs/sha256/"+digest[7:]])
                if "manifests" in child:
                    index=child;continue
                require(child["config"]["digest"]==identity and
                        [v["digest"] for v in child["layers"]]==["sha256:"+contents[n] for n in row["Layers"]],"OCI_IMAGE_DRIFT")
                break
            else: raise ValueError("OCI_INDEX_DEPTH")
    return dict(zipSha256=zip_sha,zipBytes=zip_bytes,archiveSha256=archive_sha,archiveBytes=size,
                manifestSha256=hashlib.sha256(raw).hexdigest(),imageId=identity,sourceCommit=commit,
                imageCommand=conf["Entrypoint"]+conf["Cmd"],user=conf["User"],layers=len(row["Layers"]))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("zip",type=Path)
    p.add_argument("github_sha256")
    p.add_argument("github_bytes",type=int)
    p.add_argument("merge_sha")
    a = p.parse_args()
    print(json.dumps(verify(a.zip,a.github_sha256,a.github_bytes,a.merge_sha),indent=2))
