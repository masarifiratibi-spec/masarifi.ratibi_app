# Voice analysis-only result after operating monitor shutdown

The approved continuous operating activation reached READY at 11:05 UTC on 13 October 2026. A subsequent guard closure occurred before the customer's next capture; READY did not mean posting remained ON indefinitely.

Read-only evidence is retained privately under `E:/Masarifi-three-changes-2026-10-12/voice-new-posting-investigation`. No recording was retried, replayed or financially posted during investigation. The customer's direct request authorized one screenshot with identity/foreground checks; no additional device operations were performed.

## Confirmed sequence

- 11:12:11.914 UTC: retained control helper journal entered `executing`.
- 11:12:22.189 UTC: Supabase PostgreSQL logged SQLSTATE `57014`, statement timeout, on the 836-character baseline SELECT containing global historical counts including unpublished outbox events. It was not a user cancellation. The frozen production baseline SELECT has the same length and query shape; the timed-out individual subplan is not established by retained logs.
- 11:12:23.974 UTC: the owned control helper was stopped after the failed status execution.
- 11:12:24 UTC: the monitor requested `scope_failure` closure.
- 11:12:25.683 UTC: the owned epoch closed with posting OFF.
- Retained closure receipts report writer stopped, posting OFF, routes/services restored, helpers stopped, and no blockers.
- 11:14:55.105 UTC (14:14:55 Riyadh): the customer's new capture started, 149.422 seconds after closure. It was admitted analysis-only and produced two expense analyses, 20 SAR and 50 SAR.

The capture has a completed analysis batch and confirmed session, `analysis_only=true`, no epoch membership, and no financial events. Its UI correctly reports analyzed but not saved and explicitly says analysis did not change balances. All four complete financial fingerprints match the preactivation baseline: accounts 5, transactions 34, postings 34, balances 5. The displayed account balance remains -320 SAR.

## Narrow correction

The recurring monitor previously invoked full `status`, repeating activation baseline scans every five seconds. Historical counts and complete financial fingerprints were not used by its operating decisions. A timeout in that unnecessary work closed otherwise healthy posting.

The correction adds an explicit read-only `monitor` action and switches only recurring `LocalHost.snapshot` to it. Policy, all 110 migration versions, exact acceptance/diagnostic function provenance, owned epoch/manifest/mode/hash/expiry, current-epoch enforcement and scoped event/failure counts remain checked. Full status, admission, activation financial locks/baseline, READY, heartbeat, runtime health, duplicate prevention and fail-closed cleanup remain unchanged. Timeouts are not increased and failures are not retried. Bounded stage/code diagnostics now reach the service journal without raw exceptions, SQL, environment or credentials; logging failure does not block closure.

Focused regressions first failed on the original implementation, then passed. Real disposable PostgreSQL qualification additionally holds exclusive locks on unrelated historical/financial-baseline relations while exercising the production read-only monitor. Removing unrelated scans does not guarantee indefinite performance of every scoped query.

The correction is not deployed or activated by this evidence record. The previous one-time activation approval is consumed. A fresh exact deployment/activation approval is required after qualification; this recording and all legacy Voice captures must remain unreplayed.
