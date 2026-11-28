"""Run the self-hosted publisher or its preflight on the internal database network."""
import json
import os
from pathlib import Path
import subprocess
import sys

release = Path("/opt/masarifi/selfhost/releases/2026-11-20-outbox")
donor = "masarifi-production-import-worker-20261105-97e66588"
image = "sha256:a1b07e1c9d52d0e1aa83f831c33e1171940d94c1b5fa06a262dcabc0170f4aa2"
name = "masarifi-outbox-forward-20261120"
network = "masarifi-selfhost-data"
mode = sys.argv[1]
if mode not in ("test", "check", "create"):
    raise SystemExit("Unknown mode")
info = json.loads(subprocess.check_output(["docker", "inspect", donor]))[0]
if info["Image"] != image or not info["State"]["Running"]:
    raise SystemExit("Reference worker changed")
if subprocess.check_output(["docker", "network", "inspect", "-f", "{{.Internal}}", network]).strip() != b"true":
    raise SystemExit("Internal network required")
ca_path = "/run/secrets/masarifi-database-ca.crt"
ca = next(m for m in info["Mounts"] if m["Destination"] == ca_path)
if ca["RW"] or ca["Source"] != "/etc/masarifi/selfhost/database-ca.crt":
    raise SystemExit("Unexpected database CA mount")
db = next(v.partition("=")[2] for v in info["Config"]["Env"] if v.startswith("DATABASE_URL="))
pg = json.loads(subprocess.check_output(["docker", "inspect", "masarifi-postgres17"]))[0]
db_host = "masarifi-postgres17.internal:" + pg["NetworkSettings"]["Networks"][network]["IPAddress"]
if db_host not in info["HostConfig"]["ExtraHosts"]:
    raise SystemExit("Database address differs from the active worker")
command = ["docker", "create", "--name", name, "--restart", "unless-stopped"] if mode == "create" else ["docker", "run", "--rm"]
command += ["--network", network, "--add-host", db_host, "--read-only", "--user", "65532:65532", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges", "--memory", "192m", "--cpus", "0.35",
            "--pids-limit", "64", "--no-healthcheck", "--log-driver", "journald",
            "--mount", f"type=bind,source={release},target=/release,readonly",
            "--mount", f"type=bind,source={ca['Source']},target={ca_path},readonly",
            "--env", "DATABASE_URL", "--env", f"NODE_EXTRA_CA_CERTS={ca_path}",
            "--entrypoint", "/nodejs/bin/node", image,
            "/release/verify.cjs" if mode == "test" else "/release/publisher.cjs"]
if mode == "check":
    command.append("--check")
subprocess.run(command, env={**os.environ, "DATABASE_URL": db}, check=True)
