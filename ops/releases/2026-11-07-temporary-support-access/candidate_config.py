"""Construct reviewed Docker create requests in memory. Never output environment values."""
from copy import deepcopy
import hashlib
import json
import re

ROOT = "/opt/masarifi/support-access-20261107"
RUNTIME = ROOT + "/runtime"
CACHE = "/workspace/apps/admin-web/.next/cache"


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def fingerprint(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def plan(old, role, manifest, baseline):
    require(role in ("admin", "api"), "UNKNOWN_ROLE")
    prior = baseline["admin" if role == "admin" else "actualApi"]
    port = str(prior["containerPort"] if role == "admin" else prior["runtime"]["containerPort"])
    old_port = prior["hostPort" if role == "admin" else "port"]
    require(old["Id"] == prior["id"] and old["Image"] == "sha256:"+prior["image"] and
            old["Name"] == "/"+prior["name"] and old["State"]["Running"] and
            old["State"]["StartedAt"] == prior["startedAt"], "SOURCE_CONTAINER_DRIFT")
    conf, host = deepcopy(old["Config"]), deepcopy(old["HostConfig"])
    runtime = prior["runtime"]
    require(host["ReadonlyRootfs"] and not host["Privileged"] and not host.get("VolumesFrom")
            and host["NetworkMode"] == runtime["network"] and host["Memory"] == runtime["memoryBytes"]
            and host["NanoCpus"] == runtime["nanoCpus"] and host["OomKillDisable"] in (False,None),
            "SOURCE_ISOLATION_DRIFT")
    require(conf["User"] == runtime["user"] and conf["WorkingDir"] == runtime["workingDirectory"] and
            (conf["Entrypoint"] or []) + (conf["Cmd"] or []) == runtime["command"], "SOURCE_PROCESS_DRIFT")
    expected = {port+"/tcp":[{"HostIp":"127.0.0.1","HostPort":str(old_port)}]}
    require(host["PortBindings"] == expected, "SOURCE_PORT_DRIFT")
    require(manifest["candidate"][role+"HostPort"] == (3042 if role=="api" else 3043), "CANDIDATE_PORT_DRIFT")
    host["PortBindings"][port+"/tcp"][0]["HostPort"] = str(manifest["candidate"][role+"HostPort"])
    host["OomKillDisable"] = False
    mounts = {m["Destination"]:m for m in old["Mounts"]}
    require(len(mounts)==len(old["Mounts"]) and all(m["Type"]=="bind" for m in mounts.values()), "SOURCE_MOUNT_DRIFT")
    conf["Hostname"] = ""
    if role == "admin":
        require(set(mounts)=={"/workspace",CACHE} and not host.get("Binds") and len(host["Mounts"])==2, "ADMIN_MOUNT_DRIFT")
        for spec in host["Mounts"]:
            dest = spec["Target"]
            require(dest in mounts and spec["Type"]=="bind", "ADMIN_MOUNT_TARGET_DRIFT")
            suffix = "" if dest == "/workspace" else "/apps/admin-web/.next/cache"
            ro = dest == "/workspace"
            require(spec["Source"]==mounts[dest]["Source"]==runtime["rootMount"]+suffix
                    and mounts[dest]["RW"] is not ro and spec.get("ReadOnly",False) is ro,"ADMIN_MOUNT_POLICY_DRIFT")
            spec["Source"]=RUNTIME+suffix
        conf["Image"]=old["Image"]
    else:
        ca = runtime["mounts"][0]
        require(set(mounts)=={ca["target"]} and mounts[ca["target"]]["Source"]==ca["source"]
                and not mounts[ca["target"]]["RW"], "API_CA_DRIFT")
        conf["Image"] = manifest["api"]["imageId"]
        require(re.fullmatch("sha256:[a-f0-9]{64}",conf["Image"] or ""), "API_IMAGE_PIN_MISSING")
        sha = manifest["api"]["sourceCommit"]
        require(re.fullmatch("[a-f0-9]{40}",sha), "API_COMMIT_REQUIRED")
        env = conf["Env"]
        require(len({v.partition("=")[0] for v in env})==len(env) and
                "MASARIFI_PROCESS_KIND=api" in env and "NODE_ENV=production" in env and
                "MASARIFI_RELEASE_VERSION="+prior["publicHealthVersion"] in env, "API_ENV_MODE_OR_RELEASE_DRIFT")
        conf["Env"] = ["MASARIFI_RELEASE_VERSION="+sha if v.startswith("MASARIFI_RELEASE_VERSION=") else v for v in env]
    return {**conf, "HostConfig":host}


def expected_mounts(old,role):
    mounts=deepcopy(old["Mounts"])
    if role=="admin":
        for m in mounts:
            m["Source"]=RUNTIME+("" if m["Destination"]=="/workspace" else "/apps/admin-web/.next/cache")
    return mounts


def verify_created(inspect, payload, name, mounts):
    expected = {k:v for k,v in payload.items() if k!="HostConfig"}
    observed = deepcopy(inspect["Config"])
    require(inspect["Name"]=="/"+name and inspect["Image"]==expected["Image"] and
            observed.pop("Hostname")==inspect["Id"][:12] and expected.pop("Hostname")==""
            and observed==expected and inspect["HostConfig"]==payload["HostConfig"] and
            sorted(inspect["Mounts"],key=lambda m:m["Destination"])==sorted(mounts,key=lambda m:m["Destination"])
            and inspect["State"]["Status"]=="created", "CREATED_CONTAINER_DRIFT")
    return fingerprint({"Config":inspect["Config"],"HostConfig":inspect["HostConfig"],"Mounts":inspect["Mounts"]})
