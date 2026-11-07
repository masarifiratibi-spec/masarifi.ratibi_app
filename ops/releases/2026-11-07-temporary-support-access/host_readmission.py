"""Observe the admitted host in memory. No Docker writes, proxy writes, SQL or reloads."""
import json
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlsplit

import candidate_config as cfg
import host_inventory as inv
import read_nginx_context as context


def same_target(container, project):
    env=dict(v.split("=",1) for v in container["Config"]["Env"])
    u=urlsplit(env["DATABASE_URL"])
    params=parse_qsl(u.query,strict_parsing=True,keep_blank_values=True)
    if len(dict(params))!=len(params) or any(k not in ("sslmode","sslrootcert","connect_timeout","channel_binding") for k,_ in params):
        return False
    if any(k in env for k in ("PGHOST","PGHOSTADDR","PGSERVICE","PGSERVICEFILE","PGOPTIONS","PGDATABASE","PGUSER","PGPORT")):
        return False
    return u.scheme in ("postgres","postgresql") and not u.fragment and u.port in (None,5432,6543) and u.path=="/postgres" and (
        u.hostname=="db."+project+".supabase.co" or (u.hostname or "").endswith(".pooler.supabase.com")
        and (unquote(u.username or "")).endswith("."+project))


def collect(m,b):
    route=context.receipt()
    recovery=inv.run(["docker","ps","--no-trunc","--filter","publish=3033","--format","{{.ID}}"]).decode().splitlines()
    # Docker's publish filter can refer to the internal port; match the actual host binding instead.
    rows=json.loads(inv.run(["docker","inspect",*inv.run(["docker","ps","-q"]).decode().splitlines()]))
    matches=[r for r in rows if any(v.get("HostIp")=="127.0.0.1" and v.get("HostPort")=="3033"
        for bindings in (r["HostConfig"].get("PortBindings") or {}).values() for v in (bindings or []))]
    cfg.require(len(matches)==1 and (not recovery or recovery==[matches[0]["Id"]]),"RECOVERY_BINDING_NOT_UNIQUE")
    project=m["migration"]["targetProject"]
    cfg.require(all(same_target(r,project) for r in (matches[0],inv.inspect(b["actualApi"]["id"]))),"API_PROJECT_BINDING_DRIFT")
    result=dict(contextSha256=route["contextSha256"],candidateSha256=route["candidateSha256"],
        diff=route["diff"],hostInventory=inv.inventory(b),headroom=inv.headroom(),
        recovery=dict(containerId=matches[0]["Id"],image=matches[0]["Image"],startedAt=matches[0]["State"]["StartedAt"],
                      configAndHostConfigSha256=inv.inspect_pin(matches[0]["Id"]),databaseProject=project))
    if m["api"].get("imageId") and m["api"].get("sourceCommit"):
        result["plannedPayloadSha256"]={role:cfg.fingerprint(cfg.plan(inv.inspect(b[name]["id"]),role,m,b))
                                       for role,name in (("api","actualApi"),("admin","admin"))}
    return result


if __name__=="__main__":
    p=Path(__file__).resolve().parent
    print(json.dumps(collect(json.loads((p/"manifest.json").read_bytes()),json.loads((p/"host-baseline.json").read_bytes()))))
