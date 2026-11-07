"""Fixture receipts, never actual authenticated data."""
from pathlib import Path
import hashlib
import json
import time
import unittest

import acceptance_receipt as receipt
import host_readmission as host


class Target(unittest.TestCase):
    project="qcffvfbpzvpwcwxwjyro"

    def matches(self,url,*extra):
        return host.same_target({"Config":{"Env":["DATABASE_URL="+url,*extra]}},self.project)

    def test_direct_and_pooler(self):
        self.assertTrue(self.matches("postgresql://fixture@db."+self.project+".supabase.co/postgres?sslmode=require"))
        self.assertTrue(self.matches("postgres://fixture%2E"+self.project+"@aws-0.pooler.supabase.com:6543/postgres"))

    def test_pg_target_overrides_and_foreign_project(self):
        url="postgres://fixture@db."+self.project+".supabase.co/postgres"
        for query in ("host=other","h%6fst=other","hostaddr=1","port=1234","dbname=other","user=other",
                      "service=other","options=-c","sslmode=require&sslmode=disable"):
            with self.subTest(query=query): self.assertFalse(self.matches(url+"?"+query))
        self.assertFalse(self.matches(url,"PGHOSTADDR=other"))
        self.assertFalse(self.matches("postgres://fixture.other@aws-0.pooler.supabase.com/postgres"))


def encode(value):return json.dumps(value,sort_keys=True).encode()
def sha(value):return hashlib.sha256(value).hexdigest()


class Receipt(unittest.TestCase):
    def setUp(self):
        self.t=dict(ticket="fixture",packetSha256="a"*64,candidates={"api":"b"*64,"admin":"c"*64},
                    candidateSha256="d"*64,createdUnix=time.time()-2,switchedUnix=time.time()-1)
        self.files={}
        self.r=dict(self.t,observedUnix=time.time(),scope={"resource":"account-status","action":"read-status"},
            actorDigests={"customer":"1"*64,"requester":"1"*64,"assignee":"1"*64,"reviewer":"2"*64,
                         "revoker":"2"*64,"otherCustomer":"3"*64,"otherAssignee":"3"*64},
            caseRequestDigests={k:"3"*64 for k in receipt.CHECKS},checks={})
        for case in receipt.CHECKS:
            role,status,outcome=receipt.CASES[case]
            o=dict(actorDigest=self.r["actorDigests"][role],requestDigest="3"*64,httpStatus=status[0],outcome=outcome,
                   evidenceSha256="4"*64,version=2,observedUnix=self.r["observedUnix"],cacheControl="no-store",
                   firstReceipt="4"*64,replayReceipt="4"*64,projection=["account-status/read-status"],rawFields=[])
            raw=encode({"case":case,"ticket":"fixture","passed":True,"observations":[o]})
            self.files[case+".json"]=raw
            self.r["checks"][case]={"sha256":sha(raw),"passed":True}

    def verify(self,digest=None):
        raw=encode(self.r)
        self.files["acceptance.json"]=raw
        return receipt.verify(Path("."),self.t,digest or sha(raw),lambda p,_:self.files[p.name])

    def test_complete_ticket_and_independent_actor(self):
        self.assertEqual(len(self.verify()),64)
        self.r["actorDigests"]["reviewer"]="1"*64
        with self.assertRaisesRegex(ValueError,"ACTORS_INVALID"):self.verify()

    def test_refuses_unbound_digest_and_replay(self):
        with self.assertRaisesRegex(ValueError,"DIGEST_DRIFT"):self.verify("e"*64)
        self.r["ticket"]="previous"
        with self.assertRaisesRegex(ValueError,"BINDING_DRIFT"):self.verify()

    def test_rejects_tampered_missing_or_failed_case(self):
        self.files["assigned-end.json"]+=b" "
        with self.assertRaisesRegex(ValueError,"CASE_EVIDENCE_DRIFT"):self.verify()
        self.r["checks"]["assigned-end"]["passed"]=False
        with self.assertRaisesRegex(ValueError,"CASE_FAILED"):self.verify()
        del self.r["checks"]["assigned-end"]
        with self.assertRaisesRegex(ValueError,"CASES_INCOMPLETE"):self.verify()

    def test_false_or_empty_record_cannot_supply_a_positive_case(self):
        case="assigned-end"
        for values in ({"passed":False,"observations":["fixture"]},{"passed":True,"observations":[]}):
            raw=encode({"case":case,"ticket":"fixture",**values})
            self.files[case+".json"]=raw
            self.r["checks"][case]["sha256"]=sha(raw)
            with self.assertRaisesRegex(ValueError,"CASE_RECEIPT_INVALID"):self.verify()

    def test_rejects_placeholder_wrong_actor_old_session_and_missing_cache_policy(self):
        case="masked-status-workspace"
        row=json.loads(self.files[case+".json"]);o=row["observations"][0]
        for change in (None,dict(o,actorDigest="8"*64),dict(o,observedUnix=self.t["createdUnix"]),
                       dict(o,cacheControl="public"),dict(o,rawFields=["balance"])):
            row["observations"]=[change];raw=encode(row)
            self.files[case+".json"]=raw;self.r["checks"][case]["sha256"]=sha(raw)
            with self.assertRaises(ValueError):self.verify()
