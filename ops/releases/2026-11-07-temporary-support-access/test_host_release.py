"""No Docker daemon, privileged socket, hosted credentials, or real filesystem under /etc."""
from copy import deepcopy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

import candidate_config as cfg
import host_release as host
import host_inventory as inv
import watchdog as wd


class Controls(unittest.TestCase):
    def setUp(self):
        self.b=json.loads(Path(__file__).with_name("host-baseline.json").read_bytes())
        self.m=json.loads(Path(__file__).with_name("manifest.json").read_bytes())
        self.m["api"].update(imageId="sha256:"+"a"*64,sourceCommit="c"*40)

    def test_recovery_disables_restart_even_if_candidate_was_already_stopped(self):
        for running in (False,True):
            row={"Id":"fixture","Name":"/"+self.m["candidate"]["apiName"],"Image":self.m["api"]["imageId"],
                 "State":{"Running":running},"HostConfig":{"RestartPolicy":{"Name":"unless-stopped"}}}
            calls=[]
            def engine(cmd,**kw):
                calls.append(cmd)
                if cmd[1]=="update":row["HostConfig"]["RestartPolicy"]["Name"]="no"
                elif cmd[1]=="stop":row["State"]["Running"]=False
            with patch.object(inv,"inspect",return_value=row),patch.object(host,"run",side_effect=engine):
                host.quiesce(self.m,{"api":"fixture"})
            self.assertEqual(calls,[["docker","update","--restart","no","fixture"]]+
                             ([["docker","stop","--time","15","fixture"]] if running else []))

    def test_recovery_refuses_foreign_candidates_and_unconfirmed_stops(self):
        row={"Id":"fixture","Name":"/foreign","Image":self.m["api"]["imageId"],
             "State":{"Running":True},"HostConfig":{"RestartPolicy":{"Name":"no"}}}
        with patch.object(inv,"inspect",return_value=row),patch.object(host,"run") as cmd:
            with self.assertRaisesRegex(ValueError,"REFUSE_FOREIGN"):
                host.quiesce(self.m,{"api":"fixture"})
            cmd.assert_not_called()
            row["Name"]="/"+self.m["candidate"]["apiName"]
            with self.assertRaisesRegex(ValueError,"CANDIDATE_NOT_QUIESCED"):
                host.quiesce(self.m,{"api":"fixture"})
            cmd.assert_called_once_with(["docker","stop","--time","15","fixture"],timeout=25)

    def original(self,role):
        base=self.b["actualApi" if role=="api" else "admin"]
        rt=base["runtime"]
        container_port="3000" if role=="api" else "3040"
        host_port="3001" if role=="api" else "3041"
        mounts=[(m["target"],m["source"],False) for m in rt["mounts"]] if role=="api" else [
            ("/workspace",rt["rootMount"],False),(cfg.CACHE,rt["rootMount"]+"/apps/admin-web/.next/cache",True)]
        env=["A=fixture","NODE_ENV=production","MASARIFI_PROCESS_KIND=api","MASARIFI_RELEASE_VERSION="+self.b["actualApi"]["publicHealthVersion"]]
        return {"Name":"/"+base["name"],"Id":base["id"],"Image":"sha256:"+base["image"],
            "State":{"Running":True,"StartedAt":base["startedAt"]},
            "Config":{"Hostname":"old","User":rt["user"],"Env":env,"WorkingDir":rt["workingDirectory"],
                      "Entrypoint":rt["command"][:1],"Cmd":rt["command"][1:]},
            "Mounts":[{"Type":"bind","Destination":dest,"Source":src,"RW":rw} for dest,src,rw in mounts],
            "HostConfig":{"ReadonlyRootfs":True,"Privileged":False,"VolumesFrom":None,"NetworkMode":rt["network"],
                "Memory":rt["memoryBytes"],"NanoCpus":rt["nanoCpus"],"OomKillDisable":None,
                "RestartPolicy":{"Name":"unless-stopped","MaximumRetryCount":0},
                "Mounts":[{"Type":"bind","Target":dest,"Source":src,"ReadOnly":not rw} for dest,src,rw in mounts],
                "PortBindings":{container_port+"/tcp":[{"HostIp":"127.0.0.1","HostPort":host_port}]}}}

    def test_api_main_and_new_release_only(self):
        old=self.original("api"); before=deepcopy(old)
        p=cfg.plan(old,"api",self.m,self.b)
        self.assertEqual(old,before)
        self.assertEqual(p["Env"][:-1],old["Config"]["Env"][:-1])
        self.assertEqual(p["Env"][-1],"MASARIFI_RELEASE_VERSION="+"c"*40)
        self.assertEqual(p["HostConfig"]["Mounts"],old["HostConfig"]["Mounts"])
        self.assertEqual(p["HostConfig"]["PortBindings"],{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3042"}]})
        self.assertEqual(p["HostConfig"]["RestartPolicy"]["Name"],"no")
        for mutate in (lambda r:r["Config"]["Cmd"].append("dist/worker.js"),
                       lambda r:r["HostConfig"]["PortBindings"]["3000/tcp"][0].update(HostIp="0.0.0.0"),
                       lambda r:r["Config"]["Env"].append("A=duplicate"),
                       lambda r:r["Mounts"][0].update(RW=True)):
            item=deepcopy(old);mutate(item)
            with self.assertRaises(ValueError): cfg.plan(item,"api",self.m,self.b)

    def test_admin_cache_is_private_and_full_observed_config_must_match(self):
        old=self.original("admin");p=cfg.plan(old,"admin",self.m,self.b)
        self.assertEqual(p["Env"],old["Config"]["Env"])
        self.assertEqual([m["ReadOnly"] for m in p["HostConfig"]["Mounts"]],[True,False])
        self.assertTrue(p["HostConfig"]["Mounts"][1]["Source"].startswith(cfg.RUNTIME+"/"))
        identity="1"*64;name=self.m["candidate"]["adminName"]
        observed={k:deepcopy(v) for k,v in p.items() if k!="HostConfig"}
        observed["Hostname"]=identity[:12]
        row=dict(Name="/"+name,Image=old["Image"],Config=observed,Id=identity,
                 HostConfig=deepcopy(p["HostConfig"]),State={"Status":"created"},Mounts=cfg.expected_mounts(old,"admin"))
        mounts=deepcopy(row["Mounts"])
        digest=cfg.verify_created(row,p,name,mounts)
        self.assertEqual(len(digest),64)
        row["HostConfig"]["Privileged"]=True
        with self.assertRaises(ValueError):cfg.verify_created(row,p,name,mounts)
        row["HostConfig"]["Privileged"]=False
        row["Mounts"][0]["RW"]=True
        with self.assertRaises(ValueError):cfg.verify_created(row,p,name,mounts)

    def test_blocked_manifest_cannot_stage(self):
        raw=json.dumps(dict(self.m,state="blocked-not-admitted")).encode()
        with patch.object(os,"geteuid",return_value=0,create=True),patch.object(wd,"exact_file",return_value=raw):
            with self.assertRaisesRegex(ValueError,"PACKET_NOT_ADMITTED"):
                host.admitted("a"*64)

    def test_restart_policy_change_refuses_foreign_name_before_docker_update(self):
        original=self.original("api");identity=original["Id"]
        t=dict(candidates={"api":identity},configs={"api":"unused"},started={"api":"unused"})
        with patch.object(inv,"inspect",return_value=original),patch.object(host,"run") as engine:
            with self.assertRaisesRegex(ValueError,"TRIAL_RESTART_DRIFT"):host.enable_accepted_restart(self.m,t)
            engine.assert_not_called()

    def test_accepted_policy_update_detects_unrelated_config_drift(self):
        row=self.original("api");identity="a"*64
        row["Id"]=identity;row["Name"]="/"+self.m["candidate"]["apiName"]
        row["HostConfig"]["RestartPolicy"]={"Name":"no","MaximumRetryCount":0}
        t=dict(candidates={"api":identity},configs={"api":cfg.fingerprint({k:row[k] for k in ("Config","HostConfig","Mounts")})},
               started={"api":row["State"]["StartedAt"]})
        changed=deepcopy(row);changed["HostConfig"]["RestartPolicy"]["Name"]="unless-stopped"
        changed["HostConfig"]["ReadonlyRootfs"]=False
        with patch.object(inv,"inspect",side_effect=[row,changed]),patch.object(host,"run") as engine:
            with self.assertRaisesRegex(ValueError,"ACCEPTED_RESTART_OR_IDENTITY_DRIFT"):host.enable_accepted_restart(self.m,t)
            engine.assert_called_once_with(["docker","update","--restart","unless-stopped",identity])


class Rollback(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name).resolve()
        self.target=self.root/"stage"
        self.target.write_bytes(b"original")
        (self.root/"original").write_bytes(b"original")
        for name,value in (("PRIVATE",self.root),("TARGET",self.target)):
            ctx=patch.object(wd,name,value);ctx.start();self.addCleanup(ctx.stop)
        self.t=dict(ticket="t",packetSha256="f"*64,candidateSha256=wd.sha(b"new"),
            originalSha256=wd.sha(b"original"),candidates={"admin":"1"*64,"api":"2"*64},
            protectedPrimarySha256="3"*64,deadline=90,bootId="boot",contextSha256="x")
        mount=patch.object(wd,"mounted_file",return_value=False)
        mount.start();self.addCleanup(mount.stop)
        for obj,attr in ((wd,"verify_paths"),(wd,"compatible_master"),(inv,"master_identity")):
            mock=patch.object(obj,attr,return_value=True);mock.start();self.addCleanup(mock.stop)
        self.t["master"]={}
        r=patch.object(wd.context,"receipt",return_value={"contextSha256":"x","candidateSha256":self.t["candidateSha256"]})
        r.start();self.addCleanup(r.stop)
        self.n=0

    def test_original_disk_still_requires_reload_and_endpoint_proof(self):
        with patch.object(wd,"links"),patch.object(wd,"nginx_reload") as reload:
            proof=Mock()
            wd.restore(self.t,proof)
            reload.assert_called_once();proof.assert_called_once()
            self.target.write_bytes(b"foreign")
            with self.assertRaisesRegex(ValueError,"REFUSE_FOREIGN_ROUTING"):
                wd.restore(self.t,proof)
            self.assertEqual(self.target.read_bytes(),b"foreign")

    def drive(self,after_arm,healthy=lambda:None):
        boot=Path("/proc/sys/kernel/random/boot_id")
        original=Path.read_text
        now=lambda:self.n
        def read(path,*a,**kw):
            return "boot" if path==boot else original(path,*a,**kw)
        def sleep(_):
            self.n+=3
            after_arm()
        with patch.object(Path,"read_text",read),patch.object(wd,"links"),patch.object(wd,"nginx_reload"),patch.object(wd,"atomic",
             side_effect=lambda p,b,_:p.write_bytes(b)):
            wd.watch(self.t,healthy,lambda:None,lambda:None,lambda:self.target.write_bytes(b"new"),
                     lambda:None,now=now,sleep=sleep)

    def test_expiry_reverts_both_candidates_route_and_stale_acceptance_fails(self):
        def change():
            if self.n==3:
                self.target.write_bytes(b"new")
                wd.emit(self.root/"accept.json",dict(wd.binding(self.t,os.getpid()+1),accepted=True))
        self.drive(change)
        self.assertTrue((self.root/"restored.json").exists())
        self.assertFalse((self.root/"ack.json").exists())
        self.assertEqual(self.target.read_bytes(),b"original")

    def test_two_candidate_acceptance_needs_exact_ticket_and_live_pid(self):
        def change():
            if self.n==3:
                wd.emit(self.root/"switch.json",wd.binding(self.t,os.getpid()))
            if self.n==6:
                wd.emit(self.root/"accept.json",dict(wd.binding(self.t,os.getpid()),accepted=True))
        self.drive(change)
        self.assertTrue((self.root/"switched.json").is_file())
        self.assertEqual(json.loads((self.root/"ack.json").read_bytes())["candidates"],self.t["candidates"])
        self.assertFalse((self.root/"restored.json").exists())

    def test_unhealthy_candidate_restores_without_waiting_for_expiry(self):
        def change():
            self.target.write_bytes(b"new")
        def healthy():
            if self.n>=3: raise ValueError("API_NOT_READY")
        self.drive(change,healthy)
        self.assertEqual(self.n,3)
        self.assertEqual(self.target.read_bytes(),b"original")

    def test_restarted_watchdog_reverts_even_with_old_pid_acceptance(self):
        wd.emit(self.root/"armed.json",wd.binding(self.t,os.getpid()+1))
        wd.emit(self.root/"accept.json",dict(wd.binding(self.t,os.getpid()+1),accepted=True))
        self.target.write_bytes(b"new")
        self.drive(lambda:None)
        self.assertTrue((self.root/"restored.json").exists())
        self.assertFalse((self.root/"ack.json").exists())
        self.assertEqual(self.target.read_bytes(),b"original")

    def test_restore_reloads_after_first_attempt_already_put_original_on_disk(self):
        self.target.write_bytes(b"new")
        reload=Mock(side_effect=[RuntimeError("reload rejected"),None])
        with patch.object(wd,"links"),patch.object(wd,"nginx_reload",reload),patch.object(wd,"atomic",
             side_effect=lambda p,b,_:p.write_bytes(b)):
            with self.assertRaises(RuntimeError): wd.restore(self.t,lambda:None)
            self.assertEqual(self.target.read_bytes(),b"original")
            proof=Mock()
            wd.restore(self.t,proof)
            proof.assert_called_once()
            self.assertEqual(reload.call_count,2)

    def test_trial_is_detached_before_replacement_master_is_checked(self):
        events=[]
        self.target.write_bytes(b"new")
        def remove(*_):
            self.target.write_bytes(b"original");events.append("detach")
        def master():
            events.append("checked");return {"pid":"new"}
        with patch.object(wd,"mounted_file",return_value=True),patch.object(wd,"detach",side_effect=remove),\
             patch.object(inv,"master_identity",side_effect=master),patch.object(wd,"nginx_reload"):
            wd.restore(self.t,lambda:events.append("proved"))
        self.assertEqual(events,["detach","checked","proved"])

    def test_durable_acceptance_precedes_any_persistent_candidate(self):
        wd.emit(self.root/"external-evidence.json",{"privateReceiptSha256":"3"*64})
        with patch.object(host,"verify_evidence"),patch.object(host,"canaries"),patch.object(host,"candidate_public"),\
             patch.object(host.time,"monotonic",return_value=0),patch.object(host,"enable_accepted_restart"),patch.object(wd,"finalize_trial",
             side_effect=OSError("interrupted before persistent rename")):
            with self.assertRaises(OSError):host.finalize({},self.t)
        decision=json.loads((self.root/"commit.json").read_bytes())
        self.assertEqual(decision["ticket"],self.t["ticket"])
        self.assertEqual(decision["privateReceiptSha256"],"3"*64)
        self.assertEqual(self.target.read_bytes(),b"original")
        self.assertFalse((self.root/"ack.json").exists())

    def test_readback_is_bound_to_one_approved_packet_and_target(self):
        with patch.object(host,"INPUT",self.root):
            m=host.migration
            row=dict(database_matches=True,cluster_sha256=m.CLUSTER,ledger_count=178,
                prior_versions_sha256=m.HISTORY,latest_version=m.VERSION,migration_name=m.NAME,
                statement_count=1,sql_sha256=m.SHA,consent_constraint=m.NEW)
            import time
            obj=dict(project="qcffvfbpzvpwcwxwjyro",packetSha256="f"*64,observedUnix=time.time(),result=row)
            wd.emit(self.root/"database-attestation.json",obj);host.attest_schema("f"*64)
            row["statement_count"]=2;wd.emit(self.root/"database-attestation.json",obj)
            with self.assertRaisesRegex(ValueError,"DATABASE_LEDGER"):host.attest_schema("f"*64)
            with self.assertRaisesRegex(ValueError,"ATTESTATION_STALE"):host.attest_schema("e"*64)

    def test_postaccept_rollback_refuses_active_or_unknown_cutover_writer(self):
        from subprocess import CompletedProcess
        for props in (b"ActiveState=active\nLoadState=loaded\nMainPID=12\n",b"",b"ActiveState=inactive\nLoadState=loaded\n"):
            with patch.object(host.subprocess,"run",return_value=CompletedProcess([],0,stdout=props)),\
                 self.assertRaisesRegex(ValueError,"CUTOVER_WATCHDOG_STATE_UNRESOLVED"):
                host.rollback_admission({},self.t)

    def test_manual_rollback_ack_follows_original_proof_and_candidate_stop(self):
        ident=wd.binding(self.t,123)
        order=[]
        def restore(t,prove):order.append("restored");prove()
        with patch.object(host,"ticket",return_value=self.t),patch.object(host,"rollback_admission",return_value=ident),\
             patch.object(host,"run",return_value=str(os.getpid()).encode()),patch.object(wd,"restore",side_effect=restore),\
             patch.object(host,"prove_original",side_effect=lambda _:order.append("proved")),\
             patch.object(host,"quiesce",side_effect=lambda *_:order.append("stopped")):
            host.rollback_accepted({},"f"*64,worker=True)
        self.assertEqual(order,["restored","proved","stopped"])
        self.assertEqual(json.loads((self.root/"rolled-back.json").read_bytes()),dict(ident,restored=True))

    def test_manual_abort_cannot_overwrite_an_acceptance_decision(self):
        wd.emit(self.root/"commit.json",{"decision":"accepted"})
        with patch.object(host,"ticket",return_value=self.t),self.assertRaisesRegex(ValueError,"ALREADY_ACCEPTED"):
            host.abort_trial({})
        self.assertFalse((self.root/"abort.json").exists())


if __name__=="__main__":
    unittest.main()
