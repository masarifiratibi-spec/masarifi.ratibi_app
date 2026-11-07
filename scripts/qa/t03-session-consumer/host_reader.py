"""Read only approved Linux files into an inherited private pipe. Never source env data.

No network, Docker launch, credential args, stdout, or environment mutation. The
reviewed host invocation must supply FD 3 as a private pipe directly to the adapter.
"""
import grp
import hashlib
import json
import os
import pwd
import stat
import sys
import subprocess
import re

FILES = (("worker", "/etc/masarifi/worker.env"),
         ("api", "/etc/masarifi/api.env"),
         ("bootstrap", "/etc/masarifi/migration.env"),
         ("manifest", "/run/masarifi-t03/private/session.json"))
LIMIT = 65536


def attest(manifest, package_pin):
    """Only selected public Docker metadata is read. Never retrieve Config.Env."""
    host = manifest["host"]
    for key in ("apiContainerId", "generalWorkerContainerId"):
        if not re.fullmatch(r"[a-f0-9]{64}", host[key]):
            raise ValueError("QA_READER_CONTAINER_IDENTITY")

    def inspect(identity, template):
        result = subprocess.run(["docker", "inspect", "--format", template, identity],
                                check=True, capture_output=True, timeout=10)
        return result.stdout.decode("utf-8").strip()

    image_id = inspect(host["apiContainerId"], "{{.Image}}")
    running = inspect(host["generalWorkerContainerId"], "{{json .State.Running}}")
    worker_kind = inspect(host["generalWorkerContainerId"], '{{range .Config.Env}}{{if eq . "MASARIFI_PROCESS_KIND=worker"}}worker{{end}}{{end}}')
    if (image_id != "sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383"
            or running != "false" or worker_kind != "worker"):
        raise ValueError("QA_READER_HOST_CHANGED")
    overlay = manifest["configuration"]["normal"]["overlay"]
    if overlay != {"MASARIFI_PROCESS_KIND": "worker"}:
        raise ValueError("QA_READER_CONFIG_CHANGED")
    return {"packageSha256": package_pin, "image": host["image"], "imageId": image_id,
            "generalWorkerRunning": False, "network": "masarifi-staging_backend",
            "configOverlaySha256": hashlib.sha256(json.dumps(overlay, sort_keys=True, separators=(",", ":")).encode()).hexdigest()}


def read_private(path, uid, gid):
    """Open exact regular files without following symlinks; bind read to fstat."""
    # Walk using directory handles: O_NOFOLLOW on every component prevents an
    # ancestor replacement between pathname inspection and the final open.
    parent = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    parts = path.strip("/").split("/")
    try:
        for part in parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
            os.close(parent)
            parent = child
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
    finally:
        os.close(parent)
    try:
        before = os.fstat(fd)
        if (not stat.S_ISREG(before.st_mode) or stat.S_IMODE(before.st_mode) != 0o600
                or before.st_uid != uid or before.st_gid != gid or not 0 < before.st_size <= LIMIT):
            raise ValueError("QA_READER_FILE_IDENTITY")
        chunks = []
        total = 0
        while True:
            chunk = os.read(fd, LIMIT + 1 - total)
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
            if total > LIMIT:
                raise ValueError("QA_READER_SIZE")
        after = os.fstat(fd)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
                after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
            raise ValueError("QA_READER_CHANGED")
        return b"".join(chunks).decode("utf-8", errors="strict")
    finally:
        os.close(fd)


def main():
    if (sys.platform != "linux" or len(sys.argv) != 5
            or sys.argv[1] != "--reviewed-session-sha256" or sys.argv[3] != "--reviewed-package-sha256"
            or not all(re.fullmatch(r"[a-f0-9]{64}", sys.argv[index]) for index in (2, 4))):
        raise ValueError("QA_READER_PLATFORM_OR_ARGUMENTS")
    output = os.fstat(3)
    if not (stat.S_ISFIFO(output.st_mode) or stat.S_ISSOCK(output.st_mode)) or os.isatty(3):
        raise ValueError("QA_READER_PRIVATE_PIPE_REQUIRED")
    uid = pwd.getpwnam("masarifi").pw_uid
    gid = grp.getgrnam("masarifi").gr_gid
    frame = {key: read_private(path, uid, gid) for key, path in FILES}
    if hashlib.sha256(frame["manifest"].encode("utf-8")).hexdigest() != sys.argv[2]:
        raise ValueError("QA_READER_MANIFEST_PIN")
    manifest = json.loads(frame["manifest"])
    if manifest["provenance"]["reviewedArtifactSha256"] != sys.argv[4]:
        raise ValueError("QA_READER_PACKAGE_PIN")
    frame["hostAttestation"] = attest(manifest, sys.argv[4])
    payload = json.dumps(frame, separators=(",", ":")).encode("utf-8")
    # Small bounded frame; write all, close to give the consumer an unambiguous EOF.
    try:
        view = memoryview(payload)
        while view:
            written = os.write(3, view)
            if written <= 0:
                raise ValueError("QA_READER_PIPE_CLOSED")
            view = view[written:]
    finally:
        os.close(3)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # No exception messages, file contents or credential-derived values leave stderr.
        sys.stderr.write("QA_PRIVATE_READER_FAILED\n")
        sys.exit(1)
