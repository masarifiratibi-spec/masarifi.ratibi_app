"""Pinned staging-dashboard rollback. Default is read-only; execution needs human approval."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time

SOURCE = "f865131a4cfdcd8ef4b88c3287f125f4d33112e4"
ORIGINAL_SHA = "be7856f0d5f6183f14fdf01b136e5f4d30eaa15ecefc091aed0cc91c870b7b17"
TARGET = Path("/etc/nginx/sites-available/masarifi-staging")
ENABLED = Path("/etc/nginx/sites-enabled/masarifi-staging")
ROOT = Path("/opt/masarifi/admin-releases/dashboard-ui-f865131a4cfd-20261107")
ORIGINAL = ROOT / "rollback/masarifi-staging.original"
ACCEPTANCE = ROOT / "rollback/acceptance.json"


def digest(value):
    return hashlib.sha256(value).hexdigest()


def proposed_proxy(original, expected_sha=None):
    expected_sha = ORIGINAL_SHA if expected_sha is None else expected_sha
    if digest(original) != expected_sha:
        raise RuntimeError("ORIGINAL_PROXY_PIN_MISMATCH")
    result, count = re.subn(rb"(proxy_pass\s+http://127\.0\.0\.1:)3040(?=\s*;)", rb"\g<1>3041", original)
    if count != 1:
        raise RuntimeError("DASHBOARD_UPSTREAM_COUNT_MISMATCH")
    return result


def validate_current(original, current, expected_sha=None):
    candidate = proposed_proxy(original, expected_sha)
    if current == original:
        return "original"
    if current != candidate:
        raise RuntimeError("UNREVIEWED_ROUTING_DRIFT")
    return "candidate"


def accepted(runtime_sha):
    try:
        if ACCEPTANCE.is_symlink():
            return False
        record = json.loads(ACCEPTANCE.read_text())
    except (OSError, ValueError):
        return False
    if not isinstance(record, dict):
        return False
    return record.get("sourceCommit") == SOURCE and record.get("runtimeSha256") == runtime_sha and record.get("accepted") is True


def check_paths():
    if TARGET.is_symlink() or TARGET.resolve(strict=True) != TARGET or ORIGINAL.is_symlink() or ENABLED.resolve(strict=True) != TARGET:
        raise RuntimeError("ROUTING_PATH_DRIFT")


def restore(original):
    check_paths()
    state = validate_current(original, TARGET.read_bytes())
    # Replace only the reviewed file. Running Nginx workers retain their current config until reload.
    if state == "candidate":
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=TARGET.parent, prefix=".dashboard-rollback-", delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(original)
                stream.flush()
                os.fsync(stream.fileno())
                os.fchmod(stream.fileno(), 0o644)
                os.fchown(stream.fileno(), 0, 0)
            os.replace(temporary, TARGET)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    # Original disk bytes do not prove that existing workers loaded them. Retry reloads too.
    check_paths()
    subprocess.run(["nginx", "-t"], check=True)
    subprocess.run(["nginx", "-s", "reload"], check=True)
    print(json.dumps({"rollback": "original proxy restored and reloaded", "sha256": digest(original)}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--action", choices=["inspect", "watch", "restore"], default="inspect")
    parser.add_argument("--execute-approved", action="store_true", help="operator assertion only; does not grant approval")
    parser.add_argument("--runtime-sha256", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{64}", args.runtime_sha256):
        raise RuntimeError("RUNTIME_PIN_REQUIRED")
    check_paths()
    original = ORIGINAL.read_bytes()
    state = validate_current(original, TARGET.read_bytes())
    if args.action == "inspect":
        print(json.dumps({"routingState": state, "originalSha256": digest(original), "candidateSha256": digest(proposed_proxy(original)), "hostChanged": False}))
        return
    if not args.execute_approved or os.geteuid() != 0:
        raise RuntimeError("EXACT_HUMAN_APPROVAL_AND_ROOT_REQUIRED")
    packet = json.loads(Path(__file__).with_name("manifest.json").read_text())
    if packet["sourceCommit"] != SOURCE or packet["runtimeCandidate"]["sha256"] != args.runtime_sha256:
        raise RuntimeError("REVIEWED_RUNTIME_PIN_MISMATCH")
    if args.action == "watch":
        deadline = time.monotonic() + 600
        while time.monotonic() < deadline:
            if accepted(args.runtime_sha256):
                print(json.dumps({"watchdog": "disarmed by matching explicit acceptance"}))
                return
            time.sleep(2)
    restore(original)


if __name__ == "__main__":
    main()
