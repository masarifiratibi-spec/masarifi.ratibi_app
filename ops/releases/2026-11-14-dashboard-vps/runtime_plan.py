"""Pure Docker API payload planning; no engine, subprocess, filesystem or network."""
from copy import deepcopy
import hashlib
import json
from urllib.parse import urlsplit

ROOT = "/opt/masarifi/admin/releases/dashboard-vps-fd834905-20261114"
NAMES = {"api": "masarifi-dashboard-api-fd834905-20261114",
         "admin": "masarifi-dashboard-admin-fd834905-20261114"}
CACHE = "/workspace/apps/admin-web/.next/cache"
SERVICE = "/app/dist/src/security/security.service.js"
REPOSITORY = "/app/dist/src/security/security.repository.js"


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def change_mount(host, target, source):
    found = 0
    for item in host.get("Mounts") or []:
        if item["Target"] == target:
            require(item["Type"] == "bind", "MOUNT_TYPE_DRIFT")
            item["Source"] = source
            found += 1
    binds = host.get("Binds") or []
    for index, bind in enumerate(binds):
        parts = bind.split(":")
        require(len(parts) == 3, "UNSUPPORTED_BIND_SYNTAX")
        if parts[1] == target:
            binds[index] = ":".join((source, *parts[1:]))
            found += 1
    require(found == 1, "MOUNT_SOURCE_COUNT_DRIFT")


def plan(row, role, pins):
    require(role in NAMES, "UNKNOWN_ROLE")
    require(row["Id"] == pins["containerId"] and row["Name"] == "/" + pins["name"]
            and row["Image"] == pins["imageId"] and row["State"]["Running"]
            and row["State"]["StartedAt"] == pins["startedAt"] and row["RestartCount"] == 0,
            "SOURCE_IDENTITY_DRIFT")
    require(fingerprint([row[k] for k in ("Config", "HostConfig", "Mounts")])
            == pins["configurationSha256"], "SOURCE_CONFIG_DRIFT")
    conf, host = deepcopy(row["Config"]), deepcopy(row["HostConfig"])
    require(host["ReadonlyRootfs"] and not host["Privileged"]
            and host.get("CapDrop") == ["ALL"]
            and any(value in ("no-new-privileges", "no-new-privileges:true")
                    for value in host.get("SecurityOpt") or [])
            and not host.get("VolumesFrom") and not host.get("AutoRemove")
            and not host.get("PublishAllPorts") and host["NetworkMode"] not in ("host", "none")
            and conf["User"] not in ("", "0", "root", "0:0"), "SOURCE_ISOLATION_DRIFT")
    require((conf.get("Entrypoint") or []) + (conf.get("Cmd") or []) == pins["command"],
            "SOURCE_COMMAND_DRIFT")
    require(host["RestartPolicy"] == {"Name": "unless-stopped", "MaximumRetryCount": 0},
            "SOURCE_RESTART_DRIFT")
    port, old_port, new_port = ("3000", "3033", "3091") if role == "api" else ("3040", "3041", "3090")
    require(host["PortBindings"] == {port + "/tcp": [{"HostIp": "127.0.0.1", "HostPort": old_port}]},
            "SOURCE_PORT_DRIFT")
    host["PortBindings"][port + "/tcp"][0]["HostPort"] = new_port
    host["RestartPolicy"] = {"Name": "no", "MaximumRetryCount": 0}
    conf["Image"], conf["Hostname"] = row["Image"], ""
    conf["Labels"] = {k: v for k, v in (conf.get("Labels") or {}).items()
                      if not k.startswith("com.docker.compose.")}
    conf["Labels"].update({"masarifi.dashboard.trial": "20261114-fd834905",
                           "masarifi.dashboard.base-container": row["Id"]})
    mounts = {m["Destination"]: m for m in row["Mounts"]}
    require(len(mounts) == len(row["Mounts"]) and all(m["Type"] == "bind" for m in mounts.values()),
            "SOURCE_MOUNTS_DRIFT")
    if role == "api":
        require(len(mounts) == 29 and SERVICE in mounts and REPOSITORY not in mounts
                and all(not m["RW"] for m in mounts.values()), "API_MOUNTS_DRIFT")
        entries = conf.get("Env") or []
        env = dict(v.split("=", 1) for v in entries)
        require(len(env) == len(entries) and env.get("MASARIFI_PROCESS_KIND") == "api"
                and env.get("NODE_ENV") == "production"
                and env.get("MASARIFI_RUNTIME_SCOPE") == "project-server"
                and env.get("MASARIFI_STORAGE_PROVIDER") == "filesystem"
                and not env.get("SUPABASE_URL") and not env.get("SUPABASE_SERVICE_ROLE_KEY")
                and env.get("NODE_TLS_REJECT_UNAUTHORIZED", "1") != "0", "API_SCOPE_DRIFT")
        database_keys = [k for k in env if k.endswith("DATABASE_URL")]
        require("DATABASE_URL" in database_keys, "API_DATABASE_REQUIRED")
        for key in database_keys:
            url = urlsplit(env[key])
            require(url.scheme in ("postgres", "postgresql") and url.hostname
                    and not any(word in url.hostname.lower() for word in ("supabase", "localhost"))
                    and url.hostname != "127.0.0.1", "OBSOLETE_DATABASE_TARGET")
        require(conf["WorkingDir"] == "/app" and pins["command"][-1] == "dist/src/main.js",
                "API_ENTRYPOINT_DRIFT")
        change_mount(host, SERVICE, ROOT + "/modules/security/security.service.js")
        host.setdefault("Mounts", [])
        if host["Mounts"] is None:
            host["Mounts"] = []
        host["Mounts"].append({"Type": "bind", "Source": ROOT + "/modules/security/security.repository.js",
                               "Target": REPOSITORY, "ReadOnly": True})
    else:
        require(set(mounts) == {"/workspace", CACHE} and not mounts["/workspace"]["RW"]
                and mounts[CACHE]["RW"] and conf["User"] == "1000:1000"
                and conf["WorkingDir"] == "/workspace/apps/admin-web", "ADMIN_MOUNTS_OR_USER_DRIFT")
        change_mount(host, "/workspace", ROOT + "/runtime")
        change_mount(host, CACHE, ROOT + "/cache")
    networks = {}
    for name, endpoint in row["NetworkSettings"]["Networks"].items():
        require(not endpoint.get("IPAMConfig"), "STATIC_NETWORK_NOT_ADMITTED")
        networks[name] = {} if name == "bridge" else {"Aliases": [NAMES[role]]}
    require(networks, "SOURCE_NETWORKS_REQUIRED")
    return {**conf, "HostConfig": host,
            "NetworkingConfig": {"EndpointsConfig": networks}}
