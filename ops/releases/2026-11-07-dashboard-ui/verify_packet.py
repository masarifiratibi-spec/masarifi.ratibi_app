"""Read-only verification of the dashboard source packet; never deploys."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    packet = Path(__file__).resolve().parent
    root = packet.parents[2]
    manifest = json.loads((packet / "manifest.json").read_text(encoding="utf-8"))
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
    print(json.dumps({"sourceVerified": True, "sourceCommit": source, "files": len(manifest["sourceFiles"]), "hostedActivation": "not approved or performed", "runtimeArtifactQualified": False}))


if __name__ == "__main__":
    main()
