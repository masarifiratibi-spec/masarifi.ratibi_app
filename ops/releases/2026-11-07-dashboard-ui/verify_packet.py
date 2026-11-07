"""Read-only verification of pinned dashboard source and Linux runtime; never deploys."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import posixpath
import subprocess
import tarfile


def file_digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def validate_runtime_members(members):
    allowed_api = {"apps/api/src/reports/reports.admin.ts", "apps/api/src/reports/reports.admin-types.ts"}
    names = set()
    symlinks = set()
    for member in members:
        path = PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts or path.as_posix() != member.name or not (
            member.name == "apps/admin-web" or member.name.startswith("apps/admin-web/") or member.name in allowed_api
        ):
            raise RuntimeError("RUNTIME_ARCHIVE_SCOPE_MISMATCH")
        if any(part.startswith(".env") or part.endswith(".env") for part in path.parts):
            raise RuntimeError("PRIVATE_ENVIRONMENT_IN_RUNTIME")
        if member.name in names or not (member.isfile() or member.isdir() or member.issym()):
            raise RuntimeError("RUNTIME_MEMBER_INVALID")
        if member.issym():
            target = posixpath.normpath(posixpath.join(posixpath.dirname(member.name), member.linkname))
            if member.linkname.startswith("/") or not target.startswith("apps/admin-web/"):
                raise RuntimeError("RUNTIME_SYMLINK_OUTSIDE_APP")
            symlinks.add(member.name)
        names.add(member.name)
    # Check the complete archive, independent of ordering, before any extraction.
    for name in names:
        if any(str(parent) in symlinks for parent in PurePosixPath(name).parents):
            raise RuntimeError("RUNTIME_SYMLINK_ANCESTOR")
    for member in members:
        if not member.issym():
            continue
        # Do not collapse '..' across a link target: kernel path resolution follows links first.
        parts = list(PurePosixPath(member.name).parent.parts)
        for part in member.linkname.split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                parts.pop()
            else:
                parts.append(part)
            if parts[:2] != ["apps", "admin-web"]:
                raise RuntimeError("RUNTIME_SYMLINK_OUTSIDE_APP")
            if "/".join(parts) in symlinks:
                raise RuntimeError("RUNTIME_SYMLINK_TARGET_CHAIN")
    return names


def verify_runtime(manifest, root, runtime, runtime_manifest):
    candidate = manifest["runtimeCandidate"]
    if file_digest(runtime) != candidate["sha256"] or runtime.stat().st_size != candidate["bytes"]:
        raise RuntimeError("RUNTIME_ARCHIVE_PIN_MISMATCH")
    if file_digest(runtime_manifest) != candidate["manifestSha256"]:
        raise RuntimeError("RUNTIME_MANIFEST_PIN_MISMATCH")
    receipt = json.loads(runtime_manifest.read_text(encoding="utf-8"))
    tree = subprocess.check_output(["git", "rev-parse", manifest["sourceCommit"] + ":apps/admin-web"], cwd=root, text=True).strip()
    expected = {
        "sourceSha": manifest["sourceCommit"],
        "adminGitTree": tree,
        "lockSha256": candidate["lockSha256"],
        "buildId": candidate["buildId"],
        "node": "v24.16.0",
        "npm": "11.17.0",
        "publicConfigurationSha256": candidate["publicConfigurationSha256"],
        "runtimeSecretsIncluded": False,
    }
    for key, value in expected.items():
        if receipt.get(key) != value:
            raise RuntimeError("RUNTIME_IDENTITY_MISMATCH: " + key)
    required = {
        "apps/admin-web/.next/BUILD_ID",
        "apps/admin-web/.next/required-server-files.json",
        "apps/admin-web/node_modules/next/package.json",
        "apps/admin-web/package-lock.json",
    }
    with tarfile.open(runtime, "r:gz") as bundle:
        names = validate_runtime_members(bundle.getmembers())
        if not required <= names:
            raise RuntimeError("RUNTIME_REQUIRED_FILES_MISSING")
        build = bundle.extractfile("apps/admin-web/.next/BUILD_ID").read().decode().strip()
        lock = bundle.extractfile("apps/admin-web/package-lock.json").read()
        if build != candidate["buildId"] or hashlib.sha256(lock).hexdigest() != candidate["lockSha256"]:
            raise RuntimeError("RUNTIME_BUILD_OR_LOCK_MISMATCH")
        for item in manifest["sourceFiles"]:
            entry = bundle.extractfile(item["path"])
            if entry is None or hashlib.sha256(entry.read()).hexdigest() != item["candidateSha256"]:
                raise RuntimeError("RUNTIME_SOURCE_PIN_MISMATCH: " + item["path"])
    return {"linuxRuntimeVerified": True, "buildId": build, "hostedAcceptance": "pending exact approval and execution"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--runtime", type=Path)
    parser.add_argument("--runtime-manifest", type=Path)
    parser.add_argument("--source-only", action="store_true")
    args = parser.parse_args()
    packet = Path(__file__).resolve().parent
    root = packet.parents[2]
    manifest = json.loads((packet / "manifest.json").read_text(encoding="utf-8"))
    canonical_baseline = (packet / "host-baseline.json").read_bytes().replace(b"\r\n", b"\n")
    if hashlib.sha256(canonical_baseline).hexdigest() != manifest["hostBaselineSha256"]:
        raise RuntimeError("HOST_BASELINE_PIN_MISMATCH")
    archive = args.archive or Path(manifest["sourceArchive"]["localPath"])
    digest = lambda data: hashlib.sha256(data).hexdigest()
    if digest(archive.read_bytes()) != manifest["sourceArchive"]["sha256"]:
        raise RuntimeError("SOURCE_ARCHIVE_HASH_MISMATCH")
    source = manifest["sourceCommit"]
    subprocess.run(["git", "merge-base", "--is-ancestor", source, "HEAD"], cwd=root, check=True)
    with tarfile.open(archive, "r:gz") as bundle:
        for member in bundle.getmembers():
            parts = PurePosixPath(member.name).parts
            if ".." in parts or member.name.startswith("/") or not (member.name in ("apps", "apps/admin-web") or member.name.startswith("apps/admin-web/")):
                raise RuntimeError("ARCHIVE_SCOPE_MISMATCH")
            if parts and parts[-1].startswith(".env") and parts[-1] != ".env.example":
                raise RuntimeError("PRIVATE_ENVIRONMENT_IN_ARCHIVE")
        for item in manifest["sourceFiles"]:
            committed = subprocess.run(["git", "show", source + ":" + item["path"]], cwd=root, check=True, capture_output=True).stdout
            archived = bundle.extractfile(item["path"])
            if archived is None or digest(committed) != item["candidateSha256"] or digest(archived.read()) != item["candidateSha256"]:
                raise RuntimeError("SOURCE_FILE_PIN_MISMATCH: " + item["path"])
    if manifest["hostedActivationApproved"] or manifest["hostedActivationPerformed"]:
        raise RuntimeError("THIS_PACKET_DOES_NOT_AUTHORIZE_ACTIVATION")
    result = {"sourceVerified": True, "sourceCommit": source, "files": len(manifest["sourceFiles"]), "hostedActivation": "not approved or performed"}
    if not args.source_only:
        runtime = args.runtime or Path(manifest["runtimeCandidate"]["localPath"])
        runtime_manifest = args.runtime_manifest or runtime.parent / "manifest.json"
        result.update(verify_runtime(manifest, root, runtime, runtime_manifest))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
