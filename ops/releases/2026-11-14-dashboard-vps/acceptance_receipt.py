"""Admit private, ticket-specific browser evidence. Never emit the underlying receipts."""
import hashlib
import json
import re
import stat
import time

from runtime_plan import require

CHECKS={"create-persisted","owner-fresh-consent","separate-review","masked-status-workspace",
        "assigned-end","external-revoke","expiry-clears-workspace","stale-version-conflict",
        "uncertain-replay-same-receipt","wrong-owner-denied","wrong-assignee-denied","self-review-denied",
        "refresh-and-session-continuity","existing-routes-and-services"}

# An operator captures actual browser observations privately. Tags describe
# expected outcomes; opaque digests identify real receipts without storing PII.
CASES={
 "create-persisted":("requester",(200,201),"pending-readback"),
 "owner-fresh-consent":("customer",(200,201),"consent-recorded"),
 "separate-review":("reviewer",(200,201),"approved"),
 "masked-status-workspace":("assignee",(200,),"only-masked-account-status"),
 "assigned-end":("assignee",(200,201),"ended"),
 "external-revoke":("revoker",(200,201),"revoked-and-workspace-cleared"),
 "expiry-clears-workspace":("assignee",(403,404,410),"expired-and-workspace-cleared"),
 "stale-version-conflict":("reviewer",(409,),"no-new-decision"),
 "uncertain-replay-same-receipt":("requester",(200,201),"original-receipt-returned"),
 "wrong-owner-denied":("otherCustomer",(403,404),"no-owner-access"),
 "wrong-assignee-denied":("otherAssignee",(403,404),"no-grant-change"),
 "self-review-denied":("requester",(403,),"no-review"),
 "refresh-and-session-continuity":("assignee",(200,),"session-and-version-retained"),
 "existing-routes-and-services":("requester",(200,),"protected-routes-and-identities-unchanged")}


def hex_digest(value):
    return isinstance(value,str) and re.fullmatch("[a-f0-9]{64}",value) is not None


def observation(case,o,r,t):
    role,status,outcome=CASES[case]
    require(isinstance(o,dict) and o.get("actorDigest")==r["actorDigests"][role]
            and o.get("requestDigest")==r["caseRequestDigests"][case]
            and o.get("httpStatus") in status and o.get("outcome")==outcome and
            type(o.get("version")) is int and o["version"]>0 and hex_digest(o.get("evidenceSha256"))
            and t["switchedUnix"]<=o.get("observedUnix",0)<=r["observedUnix"],"CASE_OBSERVATION_INVALID")
    if case!="existing-routes-and-services":
        require(o.get("cacheControl")=="no-store","CASE_CACHE_POLICY_INVALID")
    if case=="uncertain-replay-same-receipt":
        require(hex_digest(o.get("firstReceipt")) and o["firstReceipt"]==o.get("replayReceipt"),"REPLAY_RECEIPT_DRIFT")
    if case=="masked-status-workspace":
        require(o.get("projection")==["account-status/read-status"] and o.get("rawFields")==[],"WORKSPACE_PROJECTION_DRIFT")


def private_bytes(path,limit):
    require(path.resolve(strict=True)==path and path.parent.stat().st_uid==0 and
            path.parent.stat().st_mode & 0o077==0,"PRIVATE_EVIDENCE_DIRECTORY_REQUIRED")
    s=path.stat()
    require(stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_mode&0o077==0 and
            0<s.st_size<=limit and s.st_nlink==1,"PRIVATE_EVIDENCE_FILE_REQUIRED")
    return path.read_bytes()


def verify(directory,ticket,digest,read=private_bytes):
    raw=read(directory/"acceptance.json",65536)
    require(hashlib.sha256(raw).hexdigest()==digest,"PRIVATE_RECEIPT_DIGEST_DRIFT")
    r=json.loads(raw)
    require(r["packetSha256"]==ticket["packetSha256"] and r["ticket"]==ticket["ticket"]
            and r["candidates"]==ticket["candidates"] and r["candidateSha256"]==ticket["candidateSha256"]
            and ticket["createdUnix"]<=ticket["switchedUnix"]<=r["observedUnix"]<=time.time()+2,"PRIVATE_RECEIPT_BINDING_DRIFT")
    actors=r["actorDigests"]
    require(actors==ticket["actorDigests"] and set(actors)=={rule[0] for rule in CASES.values()} and all(hex_digest(v) for v in actors.values())
            and len({actors["customer"],actors["requester"],actors["reviewer"]})==3
            and actors["revoker"]!=actors["assignee"] and actors["customer"]!=actors["otherCustomer"]
            and actors["assignee"]!=actors["otherAssignee"],
            "PRIVATE_RECEIPT_ACTORS_INVALID")
    require(r["scope"]=={"resource":"account-status","action":"read-status"} and
            set(r["checks"])==set(r["caseRequestDigests"])==CHECKS and all(hex_digest(v) for v in r["caseRequestDigests"].values()),
            "PRIVATE_RECEIPT_CASES_INCOMPLETE")
    require(len({r["caseRequestDigests"][k] for k in ("create-persisted","owner-fresh-consent","separate-review",
            "masked-status-workspace","assigned-end")})==1,"PRIMARY_FLOW_REQUEST_DRIFT")
    for case in CHECKS:
        entry=r["checks"][case]
        require(entry["passed"] is True and re.fullmatch("[a-f0-9]{64}",entry["sha256"]),"CASE_FAILED")
        evidence=read(directory/(case+".json"),2*1024**2)
        require(hashlib.sha256(evidence).hexdigest()==entry["sha256"],"CASE_EVIDENCE_DRIFT")
        record=json.loads(evidence)
        require(record["ticket"]==ticket["ticket"] and record["case"]==case and record["passed"] is True
                and isinstance(record["observations"],list) and record["observations"],"CASE_RECEIPT_INVALID")
        for o in record["observations"]:observation(case,o,r,ticket)
    return digest
