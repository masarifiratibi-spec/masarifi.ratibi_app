"""Disposable GitHub VM only: a systemd watchdog outlives its operator process."""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

import routing_files as files
from trial_watchdog import WatchRuntime, watch


def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)


def gate():
    require(os.name == "posix" and os.geteuid() == 0
            and os.environ.get("GITHUB_ACTIONS") == "true"
            and Path("/proc/1/comm").read_text().strip() == "systemd",
            "DISPOSABLE_SYSTEMD_GITHUB_VM_REQUIRED")


def child(root):
    gate()
    require(root.is_relative_to(Path(os.environ["RUNNER_TEMP"]).resolve())
            and root.name.startswith("dashboard-timeout-"), "PRIVATE_FIXTURE_ROOT_REQUIRED")
    target, trial = root / "site.conf", root / "trial"
    old = b'location = /probe { return 200 "original"; }'
    new = old.replace(b"original", b"candidate")
    target.write_bytes(old)
    (root / "original").write_bytes(old)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    config = root / "nginx.conf"
    config.write_text(f"pid {root}/master.pid; error_log {root}/error.log; events {{}} "
                      f"http {{ access_log off; server {{ listen 127.0.0.1:{port}; include {target}; }} }}")
    nginx = ["/usr/sbin/nginx", "-p", str(root), "-c", str(config)]
    master = subprocess.Popen(nginx + ["-g", "daemon off;"])
    events = []

    def reload():
        for args in (["-t"], ["-s", "reload"]):
            subprocess.run(nginx + args, check=True, capture_output=True, timeout=5)

    def prove(want):
        def probe():
            with urlopen(f"http://127.0.0.1:{port}/probe", timeout=1) as response:
                if response.read() != want:
                    raise ValueError("SERVED_GENERATION_WRONG")
        files.converge(probe, seconds=5)
        events.append(want.decode() + "-served")

    ticket = dict(ticket="disposable-fixture", packetSha256="a" * 64,
                  candidateSha256=files.sha(new), originalSha256=files.sha(old),
                  candidates={"fixture": str(master.pid)},
                  originalMetadata=files.metadata(target),
                  bootId=Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
                  deadline=time.monotonic() + 20)
    files.PRIVATE, files.TARGET = root, target

    class Adapter:
        def read(self, name):
            path = root / (name + ".json")
            return json.loads(path.read_bytes()) if path.exists() else None

        def emit(self, name, value):
            files.emit(root / (name + ".json"), value)

        def notify(self):
            files.notify("WATCHDOG=1")

        def protected(self):
            require(master.poll() is None, "FIXTURE_MASTER_STOPPED")

        healthy = protected

        def prove_original(self):
            prove(b"original")

        def prove_candidate(self):
            prove(b"candidate")

        def install(self):
            files.prepare_trial(new, ticket)
            files.bind_trial(target, trial)
            reload()

        def restore(self):
            if files.mounted_file(target, trial):
                files.detach(target, trial)
            require(target.read_bytes() == old, "ORIGINAL_DISK_NOT_PRESERVED")
            reload()

        def quiesce(self):
            events.append("quiesced-after-proof")

        def finalize(self, _):
            raise RuntimeError("FIXTURE_MUST_EXPIRE")

    try:
        prove(b"original")
        files.emit(root / "fixture.json", {"port": port})
        files.notify("READY=1")
        started = time.monotonic()
        outcome = watch(ticket, Adapter(), WatchRuntime(os.getpid(), ticket["bootId"]))
        files.emit(root / "result.json", dict(outcome=outcome, elapsed=time.monotonic()-started,
                                              events=events, originalBytes=target.read_bytes() == old))
    finally:
        master.send_signal(signal.SIGTERM)
        master.wait(timeout=8)
        if files.mounted_file(target, trial):
            files.detach(target, trial)


def operator(root):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if (root / "armed.json").exists():
            identity = json.loads((root / "armed.json").read_bytes())
            files.emit(root / "switch.json", identity)
            while time.monotonic() < deadline:
                if (root / "switched.json").exists():
                    os._exit(31)  # Simulate loss of the console/operator process.
                time.sleep(.1)
        time.sleep(.1)
    raise RuntimeError("FIXTURE_SWITCH_NOT_OBSERVED")


def parent():
    gate()
    with tempfile.TemporaryDirectory(prefix="dashboard-timeout-", dir=os.environ["RUNNER_TEMP"]) as tmp:
        root = Path(tmp).resolve()
        unit = root.name
        subprocess.run(["systemd-run", "--no-block", "--unit=" + unit, "--service-type=notify",
                        "--property=PrivateMounts=yes", "--property=Restart=on-failure",
                        "--property=WatchdogSec=10s", "--property=TimeoutStartSec=20s",
                        "--setenv=GITHUB_ACTIONS=true", "--setenv=RUNNER_TEMP=" + os.environ["RUNNER_TEMP"],
                        sys.executable, "-B", str(Path(__file__).resolve()), "child", str(root)],
                       check=True, capture_output=True, timeout=10)
        try:
            result = subprocess.run([sys.executable, "-B", str(Path(__file__).resolve()), "operator", str(root)],
                                    timeout=18)
            require(result.returncode == 31, "OPERATOR_DID_NOT_DISCONNECT_AFTER_SWITCH")
            until = time.monotonic() + 35
            while time.monotonic() < until and not (root / "result.json").exists():
                time.sleep(.2)
            receipt = json.loads((root / "result.json").read_bytes())
            require(receipt["outcome"] == "restored" and receipt["elapsed"] >= 18
                    and receipt["originalBytes"] and "candidate-served" in receipt["events"]
                    and receipt["events"][-2:] == ["original-served", "quiesced-after-proof"]
                    and not (root / "accepted.json").exists(), "INDEPENDENT_TIMEOUT_RESTORATION_FAILED")
            print("PASS real systemd unit restored served Nginx after operator process exited; original disk bytes retained")
        finally:
            subprocess.run(["systemctl", "stop", unit], capture_output=True, timeout=15)
            subprocess.run(["systemctl", "reset-failed", unit], capture_output=True, timeout=5)


if __name__ == "__main__":
    if sys.argv[1:2] == ["child"]:
        child(Path(sys.argv[2]).resolve())
    elif sys.argv[1:2] == ["operator"]:
        operator(Path(sys.argv[2]).resolve())
    else:
        parent()
