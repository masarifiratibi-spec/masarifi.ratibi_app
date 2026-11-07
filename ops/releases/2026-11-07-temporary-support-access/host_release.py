"""Stage, switch or accept only a separately approved, fingerprinted release packet."""
import argparse
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import time
from urllib.parse import urlsplit

import candidate_config as cfg
import host_inventory as inv
import migration_packet as migration
import nginx_delta as ng
import read_nginx_context as context
import stage_archives
import watchdog as wd
import acceptance_receipt
import host_readmission

ROOT=Path(cfg.ROOT)
INPUT=Path("/opt/masarifi/support-access-inputs-20261107")
UNIT="masarifi-support-access-watchdog-20261107"
SCRIPTS=("host_release.py","host_inventory.py","candidate_config.py","watchdog.py","stage_archives.py",
         "api_archive.py","candidate_verifier.py","migration_packet.py","nginx_delta.py","read_nginx_context.py",
         "acceptance_receipt.py","host_readmission.py")


def admitted(pin=None):
    raw=wd.exact_file(wd.PACKET/"manifest.json")
    m=json.loads(raw)
    cfg.require(os.geteuid()==0 and m["state"]=="prepared-for-execution-review" and
                m["qualification"]["foundation"]=="success" and m["qualification"]["staging"]=="success"
                and m["qualification"]["journal"]=="success","PACKET_NOT_ADMITTED")
    if pin is None: pin=wd.exact_file(wd.PRIVATE/"approved-packet.sha256").decode().strip()
    cfg.require(pin==wd.sha(raw),"EXACT_APPROVED_MANIFEST_REQUIRED")
    for f in SCRIPTS:
        cfg.require(wd.sha(wd.exact_file(wd.PACKET/f))==m["executorSha256"][f],"EXECUTOR_DRIFT")
    cfg.require(wd.sha(wd.exact_file(wd.PACKET/"host-baseline.json"))==m["hostBaselineSha256"],"BASELINE_DRIFT")
    return m


def baseline():
    return json.loads(wd.exact_file(wd.PACKET/"host-baseline.json"))


def check_inventory(m,exclude=()):
    cfg.require(inv.inventory(baseline(),exclude)==m["routing"]["hostInventory"],"PROTECTED_RUNTIME_DRIFT")


def read_route(m):
    receipt=context.receipt()
    for k in ("contextSha256","candidateSha256"):
        cfg.require(receipt[k]==m["routing"][k],"NGINX_CONTEXT_OR_CANDIDATE_DRIFT")
    return receipt


def run(args,timeout=30):
    return subprocess.check_output(args,stderr=subprocess.DEVNULL,timeout=timeout)


class Engine(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(30)
        self.sock.connect("/var/run/docker.sock")


def create(payload,name):
    conn=Engine("localhost")
    try:
        conn.request("POST","/containers/create?name="+name,body=json.dumps(payload),headers={"Content-Type":"application/json"})
        res=conn.getresponse()
        cfg.require(res.status==201,"CREATE_DISPATCH_UNCERTAIN_RECONCILE_BY_NAME")
        return json.loads(res.read())["Id"]
    finally: conn.close()


def local(port,path,domain):
    conn=http.client.HTTPConnection("127.0.0.1",port,timeout=3)
    try:
        conn.request("GET",path,headers={"Host":domain,"Connection":"close"})
        res=conn.getresponse()
        body=res.read(1024*1024)
        return res.status,dict((k.lower(),v) for k,v in res.getheaders()),body
    finally: conn.close()


ADMIN="staging.masarifiratibi.com"
API="api.staging.masarifiratibi.com"
PRIMARY="api.masarifiratibi.com"
OLD_ASSET="/_next/static/HpKjKCcL4BG8PJNVU5_VI/_buildManifest.js"
OLD_DIGEST="9476e0afd3f9da68a64e6ec58631191fd3eaca62c9f5a377e7517fe9a89e59ea"


def public(host,path):
    # A fresh verified TLS connection to the local Nginx for each probe.
    raw=run(["curl","--noproxy","*","--silent","--show-error","--max-time","4","--resolve",
        host+":443:127.0.0.1","--dump-header","-","https://"+host+path],timeout=6)
    headers,body=raw.split(b"\r\n\r\n",1)
    lines=headers.split(b"\r\n")
    cache=[v.split(b":",1)[1].strip().lower() for v in lines if v.lower().startswith(b"cache-control:")]
    return int(lines[0].split()[1]),cache,body


def unchanged_public(m):
    for host,version in ((API,baseline()["actualApi"]["publicHealthVersion"]),(PRIMARY,m["routing"]["primaryPublicVersion"])):
        status,_,body=public(host,"/health/live")
        cfg.require(status==200 and json.loads(body)["version"]==version,"DEFAULT_OR_PRIMARY_ROUTE_DRIFT")
    cfg.require(public(API,"/health/ready")[0]==404 and public(API,"/api/v1/me/mobile-activity")[0]==401,
                "PROTECTED_LOCATION_DRIFT")


def prove_original(t):
    m=admitted()
    current=inv.inventory(baseline(),t["candidates"].values())
    expected=m["routing"]["hostInventory"]
    cfg.require(wd.compatible_master(expected,current) and all(current[k]==v for k,v in expected.items()
                if k not in ("masterPid","masterStartTicks")),"PROTECTED_RESTORE_INVENTORY_DRIFT")
    unchanged_public(m)
    status,_,body=public(ADMIN,OLD_ASSET)
    cfg.require(status==200 and wd.sha(body)==OLD_DIGEST,"OLD_ADMIN_NOT_SERVED")
    cfg.require(public(ADMIN,m["admin"]["staticProbe"]["path"])[0]==404,"OLD_ADMIN_ALSO_SERVES_NEW_BUILD")
    for family in ng.API_PATHS:
        status,cache,_=public(API,family.decode())
        cfg.require(status==401 and cache==[],"OLD_SUPPORT_ROUTE_NOT_SERVED")


def candidate_public(m):
    unchanged_public(m)
    item=m["admin"]["staticProbe"]
    status,_,body=public(ADMIN,item["path"])
    cfg.require(status==200 and wd.sha(body)==item["sha256"],"NEW_STATIC_NOT_SERVED")
    for family in ng.API_PATHS:
        for suffix in ("", "/00000000-0000-4000-8000-000000000001?probe=1"):
            status,cache,_=public(API,family.decode()+suffix)
            cfg.require(status==401 and cache==[b"no-store"],"SUPPORT_ROUTE_OR_POLICY_DRIFT")


def probe_member(m,role):
    if role=="api":
        live=local(3042,"/health/live",API)
        ready=local(3042,"/health/ready",API)
        cfg.require(live[0]==200 and json.loads(live[2])["version"]==m["api"]["sourceCommit"]
                    and ready[0]==200 and json.loads(ready[2])=={"status":"ready","checks":{"database":"up","queue":"up"}},
                    "API_NOT_READY")
    else:
        item=m["admin"]["staticProbe"]
        status,_,body=local(3043,item["path"],ADMIN)
        cfg.require(status==200 and wd.sha(body)==item["sha256"],"ADMIN_STATIC_DRIFT")
        status,headers,_=local(3043,"/admin",ADMIN)
        dest=urlsplit(headers.get("location",""))
        cfg.require(status==307 and (dest.scheme,dest.netloc,dest.path)==
                    ("https","accounts.staging.masarifiratibi.com","/sign-in"),"ADMIN_AUTH_CHALLENGE_DRIFT")


def ticket(m):
    t=json.loads(wd.exact_file(wd.PRIVATE/"ticket.json"))
    cfg.require(t["candidateSha256"]==m["routing"]["candidateSha256"] and t["originalSha256"]==m["routing"]["originalSha256"]
        and t["packetSha256"]==wd.sha(wd.exact_file(wd.PACKET/"manifest.json")),"WATCH_TICKET_DRIFT")
    return t


def canaries(m,t):
    check_inventory(m,t["candidates"].values())
    for role,identity in t["candidates"].items():
        row=inv.inspect(identity)
        cfg.require(row["State"]["Running"] and not row["State"].get("OOMKilled") and row["RestartCount"]==0 and
            row["State"]["StartedAt"]==t["started"][role] and cfg.fingerprint(
                {"Config":row["Config"],"HostConfig":row["HostConfig"],"Mounts":row["Mounts"]})==t["configs"][role],
            "CANDIDATE_STATE_DRIFT")
        probe_member(m,role)


def plans(m):
    b=baseline()
    payloads={role:cfg.plan(inv.inspect(b[key]["id"]),role,m,b) for role,key in (("api","actualApi"),("admin","admin"))}
    cfg.require({k:cfg.fingerprint(v) for k,v in payloads.items()}==m["candidate"]["plannedPayloadSha256"],
                "CANDIDATE_CONFIG_PIN_DRIFT")
    return payloads


def schema_probe(identity):
    # No DSN/financial/customer values cross the Docker CLI. This is a read-only consistency check.
    script="""const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:2000,
      options:'-c default_transaction_read_only=on -c statement_timeout=3000'});(async()=>{try{await c.connect();
      const r=await c.query("select pg_get_constraintdef(oid) as constraint from pg_constraint where conrelid='private.support_access_requests'::regclass and conname='support_access_requests_customer_check' and convalidated");
      if(r.rows.length!==1)process.exitCode=1;else process.stdout.write(r.rows[0].constraint)
      }catch{process.exitCode=1}finally{await c.end()}})()"""
    cfg.require(run(["docker","exec",identity,"/nodejs/bin/node","-e",script],timeout=8).decode()==migration.NEW,
                "HOSTED_POSTIMAGE_NOT_ADMITTED")


def attest_schema(pin):
    # This receipt comes from separately targeted Supabase read_migration_result.sql,
    # not from the API login (which should not gain migration-ledger privileges).
    receipt=json.loads(wd.exact_file(INPUT/"database-attestation.json"))
    cfg.require(receipt["packetSha256"]==pin and receipt["project"]=="qcffvfbpzvpwcwxwjyro" and
                0<=time.time()-receipt["observedUnix"]<=900,"DATABASE_ATTESTATION_STALE")
    cfg.require(receipt["result"]==dict(database_matches=True,cluster_sha256=migration.CLUSTER,
        ledger_count=178,prior_versions_sha256=migration.HISTORY,latest_version=migration.VERSION,
        migration_name=migration.NAME,statement_count=1,sql_sha256=migration.SHA,consent_constraint=migration.NEW),
        "DATABASE_LEDGER_OR_POSTIMAGE_DRIFT")


def stage(m,pin):
    observed=host_readmission.collect(m,baseline())
    for key in ("hostInventory","contextSha256","candidateSha256","recovery"):
        cfg.require(observed[key]==m["routing"][key],"FRESH_HOST_READMISSION_DRIFT")
    cfg.require(observed["plannedPayloadSha256"]==m["candidate"]["plannedPayloadSha256"],"PAYLOAD_READMISSION_DRIFT")
    room=observed["headroom"]
    cfg.require(room["portsFree"] and room["freeDiskBytes"]>=5*1024**3 and
                room["availableMemoryBytes"]>=2*1024**3,"HEADROOM_OR_PORT_DRIFT")
    payloads=plans(m)
    attest_schema(pin)
    schema_probe(baseline()["actualApi"]["id"])
    for role in payloads:
        cfg.require(not run(["docker","ps","-aq","--filter","name=^/"+m["candidate"][role+"Name"]+"$"]).strip(),
                    "CANDIDATE_NAME_ALREADY_EXISTS")
    cfg.require(ROOT.parent.resolve(strict=True)==ROOT.parent and INPUT.resolve(strict=True)==INPUT,
                "RELEASE_PATH_DRIFT")
    ROOT.mkdir(mode=0o700)
    wd.PRIVATE.mkdir(mode=0o700)
    (wd.PRIVATE/"approved-packet.sha256").write_text(pin+"\n")
    (wd.PRIVATE/"original").write_bytes(wd.exact_file(wd.TARGET))
    wd.emit(wd.PRIVATE/"state.json",{"phase":"stage dispatched"})
    stage_archives.admin(INPUT/"admin.zip",ROOT,m["admin"])
    stage_archives.api(INPUT/"api.zip",m["api"])
    ids={}
    try:
        stage_sidecars(m,pin,payloads,ids)
    except BaseException:
        # No ingress operation runs in stage; keep failed artifacts/receipts.
        if wd.sha(wd.exact_file(wd.TARGET))==m["routing"]["originalSha256"]:
            quiesce(m,ids)
        raise


def stage_sidecars(m,pin,payloads,ids):
    starts={}; configs={}
    for role,payload in payloads.items():
        name=m["candidate"][role+"Name"]
        wd.emit(wd.PRIVATE/"state.json",{"phase":"create dispatched","name":name,"ids":ids})
        ids[role]=create(payload,name)
        orig=inv.inspect(baseline()["actualApi" if role=="api" else "admin"]["id"])
        configs[role]=cfg.verify_created(inv.inspect(ids[role]),payload,name,cfg.expected_mounts(orig,role))
    for role,identity in ids.items():
        wd.emit(wd.PRIVATE/"state.json",{"phase":"start dispatched","role":role,"ids":ids})
        run(["docker","start",identity])
        starts[role]=inv.inspect(identity)["State"]["StartedAt"]
    t=dict(ticket=secrets.token_hex(24),candidates=ids,started=starts,configs=configs,packetSha256=pin,
           originalSha256=m["routing"]["originalSha256"],candidateSha256=m["routing"]["candidateSha256"],
           protectedPrimarySha256=baseline()["routing"]["primarySha256"],bootId=Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
           deadline=time.monotonic()+900,createdUnix=time.time(),master=inv.master_identity(),originalMetadata=wd.metadata(wd.TARGET),
           contextSha256=m["routing"]["contextSha256"])
    deadline=time.monotonic()+60
    while True:
        try: canaries(m,t); break
        except Exception:
            if time.monotonic()>deadline: raise
            time.sleep(2)
    schema_probe(ids["api"])
    wd.emit(wd.PRIVATE/"ticket.json",t)
    wd.emit(wd.PRIVATE/"state.json",{"phase":"both private canaries passed","ids":ids})


def quiesce(m,ids):
    # Do not stop any existing service or reconcile a create operation by name.
    for role,identity in ids.items():
        cfg.require(role in ("api","admin"),"UNREVIEWED_CANDIDATE_ROLE")
        row=inv.inspect(identity)
        expected=m["api"]["imageId"] if role=="api" else "sha256:"+baseline()["admin"]["image"]
        cfg.require(row["Id"]==identity and row["Name"]=="/"+m["candidate"][role+"Name"]
                    and row["Image"]==expected and row["Id"] not in (baseline()["admin"]["id"],baseline()["actualApi"]["id"]),
                    "REFUSE_FOREIGN_CANDIDATE_STOP")
        if row["State"]["Running"]: run(["docker","stop","--time","15",identity],timeout=25)


def live_watch(m,t):
    data=json.loads(wd.exact_file(wd.PRIVATE/"armed.json"))
    pid=int(run(["systemctl","show","--property=MainPID","--value",UNIT+".service"]))
    cfg.require(pid>1 and data==wd.binding(t,pid) and time.monotonic()<t["deadline"]-15
                and not any((wd.PRIVATE/n).exists() for n in ("abort.json","restored.json","ack.json")),
                "WATCHDOG_NOT_ARMED")
    return data


def switch(m):
    t=ticket(m)
    cfg.require(not (wd.PRIVATE/"armed.json").exists(),"SWITCH_ALREADY_DISPATCHED")
    canaries(m,t);read_route(m);prove_original(t)
    run(["systemd-run","--no-block","--unit="+UNIT,"--service-type=notify","--property=Restart=on-failure",
         "--property=RestartForceExitStatus=SIGTERM SIGHUP SIGINT SIGPIPE","--property=WatchdogSec=120s",
         "--property=PrivateMounts=no","--property=RestartSec=2s","--property=StartLimitIntervalSec=0",
         "/usr/bin/python3","-B",str(wd.PACKET/"watchdog.py")])
    for _ in range(60):
        if (wd.PRIVATE/"armed.json").is_file(): break
        time.sleep(0.25)
    ident=live_watch(m,t)
    wd.emit(wd.PRIVATE/"switch.json",ident)
    for _ in range(60):
        if (wd.PRIVATE/"switched.json").exists() and json.loads(wd.exact_file(wd.PRIVATE/"switched.json"))==ident:
            return
        if (wd.PRIVATE/"abort.json").exists(): break
        time.sleep(1)
    raise RuntimeError("SWITCH_NOT_ACKNOWLEDGED_READ_STATE")


def install_trial(m,t):
    # The watchdog alone writes routing. An operator stopped or disconnected at
    # any point cannot hold a switch lock or prevent rollback.
    cfg.require(os.readlink("/proc/self/ns/mnt")==os.readlink("/proc/1/ns/mnt")==
                os.readlink("/proc/"+str(t["master"]["masterPid"])+"/ns/mnt"),"NOT_MASTER_MOUNT_NAMESPACE")
    wd.links(t);read_route(m);canaries(m,t);prove_original(t)
    wd.prepare_trial(proposed_bytes(m),t)
    wd.bind_trial(wd.TARGET,wd.PRIVATE/"trial")
    wd.nginx_reload()


def verify_evidence(t,digest):
    switched=json.loads(wd.exact_file(wd.PRIVATE/"switch-observation.json"))
    identity=wd.binding(t,switched["watchdogPid"])
    cfg.require(switched==dict(identity,switchedUnix=switched["switchedUnix"])
                and json.loads(wd.exact_file(wd.PRIVATE/"armed.json"))==identity,"SWITCH_OBSERVATION_DRIFT")
    return acceptance_receipt.verify(INPUT/"evidence",dict(t,switchedUnix=switched["switchedUnix"]),digest)


def finalize(m,t):
    marker=json.loads(wd.exact_file(wd.PRIVATE/"external-evidence.json"))
    verify_evidence(t,marker["privateReceiptSha256"])
    canaries(m,t);candidate_public(m)
    cfg.require(time.monotonic()<t["deadline"]-20,"ACCEPTANCE_WINDOW_CLOSED")
    # The durable decision precedes durable routing. A reboot before rename
    # exposes the original; after rename the exact candidate already has a
    # committed private acceptance decision. ack.json is completion, not authority.
    wd.emit(wd.PRIVATE/"commit.json",dict(wd.binding(t,os.getpid()),privateReceiptSha256=marker["privateReceiptSha256"],
                                           decision="accepted",observedUnix=time.time()))
    enable_accepted_restart(m,t)
    wd.finalize_trial(t)


def enable_accepted_restart(m,t):
    # Only the two accepted immutable IDs may inherit their originals' restart
    # policy. Verify that Docker changed no other configuration or process.
    configs={}
    for role,identity in t["candidates"].items():
        before=inv.inspect(identity)
        fingerprint=lambda r:cfg.fingerprint({k:r[k] for k in ("Config","HostConfig","Mounts")})
        cfg.require(before["Id"]==identity and before["Name"]=="/"+m["candidate"][role+"Name"]
                    and fingerprint(before)==t["configs"][role] and
                    before["HostConfig"]["RestartPolicy"]=={"Name":"no","MaximumRetryCount":0},"TRIAL_RESTART_DRIFT")
        run(["docker","update","--restart","unless-stopped",identity])
        after=inv.inspect(identity)
        expected=dict(before["HostConfig"],RestartPolicy={"Name":"unless-stopped","MaximumRetryCount":0})
        cfg.require(after["Id"]==identity and after["HostConfig"]==expected and after["Config"]==before["Config"]
                    and after["Mounts"]==before["Mounts"] and after["State"]["Running"]
                    and after["State"]["StartedAt"]==t["started"][role] and after["RestartCount"]==0,
                    "ACCEPTED_RESTART_OR_IDENTITY_DRIFT")
        configs[role]=fingerprint(after)
    canaries(m,dict(t,configs=configs))
    wd.emit(wd.PRIVATE/"accepted-configs.json",dict(wd.binding(t,os.getpid()),configs=configs))


def proposed_bytes(m):
    # Use the same context parser and candidate calculation as the admitted receipt.
    raw=[]
    receipt=context.receipt(candidate_sink=raw.append)
    cfg.require(len(raw)==1 and receipt["contextSha256"]==m["routing"]["contextSha256"] and
                wd.sha(raw[0])==m["routing"]["candidateSha256"],"CANDIDATE_BYTES_DRIFT")
    return raw[0]


def accept(m,evidence):
    t=ticket(m)
    cfg.require(evidence and len(evidence)==64 and all(c in "0123456789abcdef" for c in evidence),
                "PRIVATE_ACCEPTANCE_RECEIPT_REQUIRED")
    data=live_watch(m,t)
    verify_evidence(t,evidence)
    canaries(m,t);candidate_public(m)
    cfg.require(wd.mounted_file(wd.TARGET,wd.PRIVATE/"trial") and wd.sha(wd.exact_file(wd.TARGET))==t["candidateSha256"],"CANDIDATE_NOT_INSTALLED")
    wd.emit(wd.PRIVATE/"external-evidence.json",{"privateReceiptSha256":evidence})
    wd.emit(wd.PRIVATE/"accept.json",dict(data,accepted=True))
    for _ in range(30):
        if (wd.PRIVATE/"ack.json").exists() and json.loads(wd.exact_file(wd.PRIVATE/"ack.json"))==dict(data,accepted=True):
            return
        time.sleep(1)
    raise RuntimeError("NO_WATCHDOG_ACK")


if __name__=="__main__":
    os.umask(0o077)
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("action",choices=["stage","switch","accept"])
    p.add_argument("--approved-packet-sha256",required=True)
    p.add_argument("--private-acceptance-sha256")
    args=p.parse_args()
    m=admitted(args.approved_packet_sha256)
    if args.action=="stage": stage(m,args.approved_packet_sha256)
    elif args.action=="switch": switch(m)
    else: accept(m,args.private_acceptance_sha256)
