"""Run the pinned Admin on a disposable GitHub VM, without network or live secrets."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import re
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
import zipfile

from candidate_verifier import git, verify_candidate
from runtime_plan import require
import stage_admin


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def download(pins, target):
    request = Request("https://api.github.com/repos/" + os.environ["GITHUB_REPOSITORY"] +
                      "/actions/artifacts/" + str(pins["artifact"]) + "/zip",
                      headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                               "Accept": "application/vnd.github+json"})
    try:
        response = build_opener(NoRedirect()).open(request, timeout=30)
    except HTTPError as error:
        require(error.code == 302 and error.headers["Location"].startswith("https://"), "ARTIFACT_REDIRECT_REQUIRED")
        # The GitHub credential must never follow the signed blob redirect.
        response = urlopen(error.headers["Location"], timeout=60)
    with response, target.open("xb") as output:
        shutil.copyfileobj(response, output)
    stage_admin.verify_file(target, pins["zipBytes"], pins["zipSha256"])


def verify_sources(archive, root, pins):
    inputs = root / "inputs"
    inputs.mkdir()
    with zipfile.ZipFile(archive) as bundle:
        names = ["manifest.json", "masarifi-admin-" + pins["source"] + ".tar.gz"]
        for name in names:
            with bundle.open(name) as incoming, (inputs / name).open("xb") as output:
                shutil.copyfileobj(incoming, output)
    verify_pins = dict(pins, sourceCommit=pins["source"],
                       compatibleCommit=git(Path.cwd().parents[2], "rev-parse", "HEAD").decode().strip())
    report, _ = verify_candidate(Path.cwd().parents[2], inputs / names[1], inputs / names[0], verify_pins)
    require(report["sourceFilesVerified"] == pins["sourceFilesVerified"]
            and report["memberCount"] == pins["members"], "SOURCE_INVENTORY_DRIFT")


def run(args):
    command = subprocess.run(args, capture_output=True, timeout=90)
    require(command.returncode == 0, "DISPOSABLE_DOCKER_COMMAND_FAILED")
    return command.stdout


def public_environment(js_chunks, approved_hashes):
    candidates = {"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": set(), "NEXT_PUBLIC_API_URL": set()}
    patterns = {"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": rb"pk_live_[A-Za-z0-9_-]{10,}",
                "NEXT_PUBLIC_API_URL": rb"https://[^\s\x22\x27\x60\\<>]+"}
    for content in js_chunks:
        for key, pattern in patterns.items():
            candidates[key].update(match.decode() for match in re.findall(pattern, content)
                                   if hashlib.sha256(match).hexdigest() == approved_hashes[key])
    require(all(len(matches) == 1 for matches in candidates.values()), "BUILT_PUBLIC_CONFIGURATION_NOT_FOUND")
    environment = {key: next(iter(matches)) for key, matches in candidates.items()}
    environment.update(NEXT_PUBLIC_CLIENT_MODE="live", NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT="staging",
                       NEXT_PUBLIC_ENABLE_MOCKS="false")
    require(all(hashlib.sha256(content.encode()).hexdigest() == approved_hashes[key]
                for key, content in environment.items()), "PUBLIC_CONFIGURATION_HASH_DRIFT")
    return environment


def cold_start(root, pins, image):
    runtime = stage_admin.admin(root / "artifact.zip", root, pins)
    environment = public_environment((path.read_bytes() for path in
                  (runtime / "apps/admin-web/.next/static").rglob("*.js")), pins["publicConfigurationSha256"])
    environment.update(CLERK_SECRET_KEY="sk_live_replace_with_server_key", NEXT_TELEMETRY_DISABLED="1")
    environment_args = ["--env=" + key + "=" + content for key, content in environment.items()]
    require(image == "ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:53a7a4530dfa0fb9b296d0c5bca3c330bf308fa7160fd7966cea681d092ca2c5",
            "CURRENT_ADMIN_IMAGE_PIN_REQUIRED")
    run(["docker", "pull", "--platform=linux/amd64", image])
    name = root.name
    identity = run(["docker", "create", "--name", name, "--pull=never", "--platform=linux/amd64",
                    "--network=none", "--restart=no", "--read-only", "--user=1000:1000",
                    "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--pids-limit=128",
                    "--memory=512m", "--cpus=0.5", "--no-healthcheck", *environment_args,
                    "--mount", "type=bind,src=" + str(runtime) + ",dst=/workspace,readonly",
                    "--mount", "type=bind,src=" + str(root / "cache") + ",dst=/workspace/apps/admin-web/.next/cache",
                    "--workdir=/workspace/apps/admin-web", "--entrypoint=/nodejs/bin/node", image,
                    "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3040"]).decode().strip()
    try:
        run(["docker", "start", identity])
        script = "const assert=require('node:assert/strict');assert.equal(process.version,'v24.20.0');" + \
                 "require('node:http').get('http://127.0.0.1:3040' + " + json.dumps(pins["staticProbe"]["path"]) + \
                 ",r=>{let b=[];r.on('data',v=>b.push(v));r.on('end',()=>{assert.equal(r.statusCode,200);" + \
                 "assert.equal(require('node:crypto').createHash('sha256').update(Buffer.concat(b)).digest('hex')," + \
                 json.dumps(pins["staticProbe"]["sha256"]) + ");process.stdout.write('QUALIFIED\\n')})})" + \
                 ".on('error',()=>{process.exitCode=1});"
        until = time.monotonic()+90
        while True:
            probe = subprocess.run(["docker", "exec", identity, "/nodejs/bin/node", "-e", script],
                                   capture_output=True, timeout=10)
            if probe.returncode == 0 and probe.stdout == b"QUALIFIED\n":
                break
            if time.monotonic() >= until:
                logs = run(["docker", "logs", "--tail=30", identity]).decode(errors="replace")
                reasons = [reason for reason in ("live mode requires a valid HTTPS API URL",
                           "live mode requires a valid Clerk publishable key", "production requires a valid Clerk secret",
                           "ERR_MODULE_NOT_FOUND", "EACCES", "ENOENT") if reason in logs]
                print(json.dumps({"phase": "cold-start", "knownReasons": reasons,
                                  "logSha256": hashlib.sha256(logs.encode()).hexdigest()}), flush=True)
                raise ValueError("PINNED_ADMIN_COLD_START_FAILED")
            time.sleep(1)
        row = json.loads(run(["docker", "inspect", identity]))[0]
        require(row["State"]["Running"] and not row["State"].get("OOMKilled") and row["RestartCount"] == 0
                and row["HostConfig"]["NetworkMode"] == "none" and not row["HostConfig"].get("PortBindings")
                and row["HostConfig"]["ReadonlyRootfs"] and row["Config"]["User"] == "1000:1000",
                "COLD_START_ISOLATION_OR_STATE_DRIFT")
        return dict(qualified=True, source=pins["source"], artifact=pins["artifact"], buildId=pins["buildId"],
                    runtimeNode="v24.20.0", imageReference=image, actualImageId=row["Image"],
                    staticProbePassed=True, network="none", liveSecretsProvided=False,
                    publicConfigurationHashesMatched=True, serverSecretPlaceholder=True,
                    restartCount=0, hostedActions=False)
    finally:
        run(["docker", "rm", "-f", identity])


def main():
    require(os.name == "posix" and os.geteuid() == 0 and os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("RUNNER_TEMP") and os.environ.get("GH_TOKEN"), "DISPOSABLE_GITHUB_VM_REQUIRED")
    manifest = json.loads(Path("manifest.json").read_bytes())
    with tempfile.TemporaryDirectory(prefix="dashboard-admin-", dir=os.environ["RUNNER_TEMP"]) as tmp:
        root = Path(tmp).resolve()
        print("Downloading pinned existing artifact", flush=True)
        download(manifest["admin"], root / "artifact.zip")
        print("Verifying exact source and archive", flush=True)
        verify_sources(root / "artifact.zip", root, manifest["admin"])
        print("Starting the admitted image without network or live secrets", flush=True)
        receipt = cold_start(root, manifest["admin"], manifest["admin"]["runtimeImageReference"])
        print(json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        reason = str(error) if re.fullmatch(r"[A-Z0-9_]+", str(error)) else type(error).__name__
        raise SystemExit("DISPOSABLE_ADMIN_RUNTIME_QUALIFICATION_FAILED:" + reason) from None
