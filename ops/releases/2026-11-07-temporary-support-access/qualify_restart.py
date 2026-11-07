"""Disposable GitHub VM: two real Docker containers, no pulls, ports or dependencies."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

import candidate_config as cfg
import host_inventory as inv
import host_release as host
import watchdog as wd


def run(*args):
    return subprocess.check_output(args,timeout=60,stderr=subprocess.STDOUT).decode().strip()


def main():
    if os.environ.get("GITHUB_ACTIONS")!="true" or not os.environ.get("RUNNER_TEMP"):
        raise RuntimeError("DISPOSABLE_GITHUB_RUNNER_REQUIRED")
    with tempfile.TemporaryDirectory(prefix="packet-policy-",dir=os.environ["RUNNER_TEMP"]) as td:
        tmp=Path(td)
        tag=tmp.name+":ci"
        (tmp/"idle.c").write_text("#include <unistd.h>\nint main(void){for(;;) pause();}\n")
        run("cc","-static","-Os","-o",str(tmp/"idle"),str(tmp/"idle.c"))
        (tmp/"Dockerfile").write_text('FROM scratch\nCOPY idle /idle\nUSER 65532:65532\nENTRYPOINT ["/idle"]\n')
        run("docker","build","--network","none","-t",tag,td)
        ids={};configs={};starts={}
        manifest={"candidate":{role+"Name":tmp.name+"-"+role for role in ("api","admin")}}
        try:
            for role in ("api","admin"):
                identity=run("docker","create","--name",manifest["candidate"][role+"Name"],"--restart","no",
                             "--network","none","--read-only",tag)
                ids[role]=identity
                run("docker","start",identity)
                row=inv.inspect(identity)
                configs[role]=cfg.fingerprint({k:row[k] for k in ("Config","HostConfig","Mounts")})
                starts[role]=row["State"]["StartedAt"]
            ticket=dict(ticket="ci",candidates=ids,configs=configs,started=starts,packetSha256="1"*64,
                        originalSha256="2"*64,candidateSha256="3"*64)
            with patch.object(wd,"PRIVATE",tmp),patch.object(host,"canaries") as probes:
                host.enable_accepted_restart(manifest,ticket)
                probes.assert_called_once()
            receipt=json.loads((tmp/"accepted-configs.json").read_bytes())
            for role,identity in ids.items():
                after=inv.inspect(identity)
                assert after["HostConfig"]["RestartPolicy"]=={"Name":"unless-stopped","MaximumRetryCount":0}
                assert after["State"]["StartedAt"]==starts[role] and after["RestartCount"]==0
                assert receipt["configs"][role]==cfg.fingerprint({k:after[k] for k in ("Config","HostConfig","Mounts")})
            # Exercise both states encountered during an operator rollback. The
            # only simulated input is the baseline of protected predecessor IDs.
            image=inv.inspect(ids["api"])["Image"]
            manifest["api"]={"imageId":image}
            predecessor={"actualApi":{"id":"not-the-trial-api"},"admin":{"id":"not-the-trial-admin","image":image[7:]}}
            run("docker","stop","--time","1",ids["admin"])
            with patch.object(host,"baseline",return_value=predecessor):
                host.quiesce(manifest,ids)
                host.prove_quiesced(manifest,ids)
        finally:
            for identity in ids.values():run("docker","rm","-f",identity)
            run("docker","image","rm",tag)
    print("PASS both accepted IDs kept their start times; rollback left both stopped with automatic restart disabled")


if __name__=="__main__":main()
