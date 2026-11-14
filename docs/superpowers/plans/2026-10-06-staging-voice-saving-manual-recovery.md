# Staging Voice saving and Manual Add recovery

Authorization: implement the human's October 6 plan, including exact-source CI, Staging-only deployment, matching APK and in-place Samsung delivery. No financial writes, Posting enablement, valid Manual Save, Production changes, merge, general worker start, unrelated backlog processing or evidence deletion. Separate approval is required for each financial milestone.

Goal: record → extract → automatically save → normal Home card/Transactions row → authoritative balances, with durable identity and no duplicates. Two-capture acceptance, Manual acceptance and ordinary all-eligible-Staging-tester readiness are separate results.

## Tasks

1. Add Staging-only safe Manual diagnostics (stage, hashed operation correlation, HTTP/domain/request metadata); fix missing known error mappings. Preserve uncertainty semantics. Reproduce regressions RED→GREEN.
2. Fix finance-derived net-worth invalidation and retry failed Voice finance reads on repeated receipt/recovery/foreground; preserve owner isolation and normal transaction components. Reproduce regressions RED→GREEN.
3. Add default-disabled Staging epoch admission with filtered extraction/finalization/retention capabilities. Exclude prior sessions and analysis-only work. Bound canary admission to two locale slots, actual session/time/hash, Cash/Food expenses of 2500 SAR minor units each, deadline and count/amount limits. Recheck admission before execution and preserve standard ledger/idempotency capabilities. Test with disposable SQL fixtures only.
4. Add dedicated continuous Voice runtime using the same processing engine for canary and ordinary operation. No OperationsWorker/start/runOnce or global finalization/purge calls. Add scoped heartbeat/status and closure controls. Initial settings: concurrency/claim limit 1, poll 500 ms, renewable lease 120 s. Ordinary admission includes all eligible Staging owners in the approved epoch.
5. Independently review the full delta, repair important findings, commit without merge, push to ratibi, run all exact-candidate CI gates including k6. Build/deploy matching backend and APK with admission/Posting OFF. Verify package/signing compatibility and install in place only when no human recording is active.
6. Verify nonposting Samsung behavior and actual OFF-only closure/API restore/health. Present prepared two-capture approval packet and stop. Do not claim financial acceptance from tests or analysis-only results.

## Voice approval packet (not permission)

Staging qcffvfbpzvpwcwxwjyro; Samsung RK8XB00N33K; owner user_3K8mSI8JwKzzOJ55tNuWrcx9lPy. Maximum 600 seconds, two transactions/two postings/5000 minor units expense. English then Arabic, one capture each, each expense 2500 minor units SAR, Cash cf321db5-b5ff-4192-b94f-621505ac7801, Food 04000000-0000-4000-8000-000000000002. No fee/transfer/obligation/additional event. Occurrence is the capture's Riyadh day. At most one post-commit same-event replay per case, no additional effects. No Manual activity. Unexpected/unknown outcome stops rather than creates another operation.

English: “I spent twenty-five Saudi riyals in cash on food.” Arabic: “صرفت خمسة وعشرين ريال سعودي نقدًا على الطعام”. Expected cumulative Cash/net-worth −25/−50 SAR and expense +25/+50 SAR. Pin source, image, APK/config/control hashes, fresh baseline and exact UTC window in the packet. After any result/deadline close admission/Posting, stop dedicated financial runtime, restore healthy analysis-only operation and retain evidence.

## Follow-up milestones

Manual: inspect preserved draft/operation/receipt read-only. If new Save evidence is required, prepare an isolated Staging draft using the same form/pickers/service, copying business fields without unresolved UUID. Freeze its exact fields and expected effects for separate one-transaction approval. Capture correlated failure, reproduce its actual cause before fixing, then repeat exact-candidate release gates. Unknown outcomes reconcile same identity. Historical root cause remains unconfirmed unless evidence identifies it.

Ordinary Voice: prepare financial API mode, provider enabled with unchanged route/safety, dedicated worker, analysis worker stopped, general worker stopped, approved operating epoch for all eligible authenticated Staging testers. Test multiple owners/concurrent captures/restarts/retries/cancellation/revocation, scoped retention, heartbeat and pending/failure visibility. Verify Home/Transactions/balances/live reports without outbox drain. Prepare a separate named-participant bounded operating trial and obtain financial approval before running. Passing the two captures does not authorize this configuration or prove ordinary readiness.

## Review focus

- Already-unknown Manual identity must survive later definite errors.
- Failed finance reads must retry without another transaction or owner leakage.
- Epoch revocation/deadline/count gates must fence in-flight execution.
- Historical jobs/media must not be claimed or cleaned.
- CI/backend/APK must refer to the same candidate; physical acceptance must be reported separately.
