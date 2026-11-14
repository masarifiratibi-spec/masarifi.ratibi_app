"""Routing restoration fixtures; no real /etc, Docker, Nginx or services."""
import tempfile,unittest
import os
import time
from pathlib import Path
from unittest.mock import Mock,patch
import routing_files as wd
import admission as inv

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

    @unittest.skipUnless(os.name=="posix","Production decision serialization uses Linux flock")
    def test_abort_published_first_prevents_an_accepted_receipt(self):
        self.t["deadline"]=time.monotonic()+10
        wd.publish_abort({"ticket":"t"})
        with self.assertRaisesRegex(ValueError,"ACCEPTANCE_WINDOW_CLOSED"):
            wd.publish_acceptance(self.t,{"ticket":"t"})
        self.assertFalse((self.root/"accepted.json").exists())

    @unittest.skipUnless(os.name=="posix","Production decision serialization uses Linux flock")
    def test_completed_acceptance_rejects_later_abort_instead_of_silently_ignoring_it(self):
        self.t["deadline"]=time.monotonic()+10
        wd.publish_acceptance(self.t,{"ticket":"t"})
        with self.assertRaisesRegex(ValueError,"ALREADY_ACCEPTED_USE_RESTORE"):
            wd.publish_abort({"ticket":"t"})
        self.assertTrue((self.root/"accepted.json").exists())
        self.assertFalse((self.root/"abort.json").exists())

    @unittest.skipUnless(os.name=="posix","Production decision serialization uses Linux flock")
    def test_expired_window_cannot_publish_an_accepted_receipt(self):
        self.t["deadline"]=time.monotonic()-1
        with self.assertRaisesRegex(ValueError,"ACCEPTANCE_WINDOW_CLOSED"):
            wd.publish_acceptance(self.t,{"ticket":"t"})
        self.assertFalse((self.root/"accepted.json").exists())

    def test_reload_stops_before_signal_when_validation_exhausts_the_window(self):
        clock=[10]
        def command(*args,**kwargs):clock[0]=12
        with patch.object(wd.time,"monotonic",side_effect=lambda:clock[0]), \
             patch.object(wd.subprocess,"run",side_effect=command) as execute:
            with self.assertRaisesRegex(ValueError,"ACCEPTANCE_WINDOW_CLOSED"):
                wd.nginx_reload(deadline=11)
        self.assertEqual(execute.call_count,1)
        self.assertEqual(execute.call_args.kwargs["timeout"],1)

    def test_original_disk_still_requires_reload_and_endpoint_proof(self):
        with patch.object(wd,"links"),patch.object(wd,"nginx_reload") as reload:
            proof=Mock()
            wd.restore(self.t,proof)
            reload.assert_called_once();proof.assert_called_once()
            self.target.write_bytes(b"foreign")
            with self.assertRaisesRegex(ValueError,"REFUSE_FOREIGN_ROUTING"):
                wd.restore(self.t,proof)
            self.assertEqual(self.target.read_bytes(),b"foreign")

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
