# DEV reliability acceptance — 16 October 2026

This report supersedes the intermediate qualification status in the six dated subplans. Source remains on `codex/voice-promoted-operating-2026-10-13` in `D:/Masarifi-integration-2026-10-10`. Ordinary application and Production releases were not changed.

## Implemented behavior

- Financial questions use the current question and authorized, owner-scoped server data. History resolves relevant follow-ups without replacing a new question. Exact aggregates and coverage supplement bounded details; income, expenses, fees/refunds, accounts, comparisons, budgets, goals, obligations, and permitted report/tracking metadata use their domain definitions. Missing data and unavailable balances remain explicit. Raw recordings, source payloads, report files and unsynced local records are outside the assistant's data tools.
- Unrelated requests receive a brief specialist redirection. Financial answers remain model generated, with factual grounding, bounded repair and rejection of unresolved internal fact references. The assistant does not claim to execute financial changes from read-only tools.
- Accepted chat operations reconcile their existing server status automatically after interrupted/slow requests. Owner-bound durable identifiers prevent resending a question to recover it. Exact late acknowledgements clear the matching draft; pre-reservation errors do not lock the composer. Keyboard/safe-area positioning and plain inline answer formatting were corrected.
- Network startup failures show a localized explanation and recovery action. Local drafts no longer require a network token. Home avoids duplicate account reads and starts independent reads together. Category preparation shares an owner/session-bound in-flight request. Financial writes retain fresh authentication, idempotency and confirmed-save semantics.
- Voice GET status/recovery reads use the existing bounded Clerk read-token path. Upload, processing, confirmation and cancellation still obtain fresh authentication. Automatic posting, ownership fences, durable audio handling and server operating policy are preserved.
- Account deletion now exposes errors, recent-auth verification, the governed deadline, status refresh and cancellation. It revokes provider-wide sessions, writes an immutable anonymized profile tombstone including `deleted_at`, and deletes the external identity last. Retryable provider failure remains retryable rather than being reported as completed. The UI discloses retention of financial records outside registered deletion handlers.
- Safe diagnostic stage durations distinguish overview, model rounds, parallel reads and grounding without recording questions, financial values, provider outputs or secrets. Provider receipt latency is recorded per attempt rather than cumulatively double counted.

## Qualified source and deployed scope

| Area | Qualified revision / result |
| --- | --- |
| API implementation | `c430442b292eaa245a3bfd6dca957e0edda041e2`; 249 unit/contract suites, 1,874 tests passed |
| Final mobile implementation | `34be0aa15f39457be8d2305848ec0e2a7dfb659a`; 490 suites, 3,249 tests passed, zero failed/skipped, 299.108 seconds |
| Real isolated SQL fixtures | Financial data 53 tests; deletion 5 tests plus worker-column privilege regression |
| Required source checks | API/mobile typechecks; scoped lint/format; relevant foundation, finance, Voice, assistant, app-shell, design-system and planning/report boundaries |
| DEV assistant runtime | API loopback 3013, revision `c430442b`; generation `367782af-326b-4b22-b21d-d705185c90db` |
| Isolated deletion qualification | API loopback 3012 and a consumer restricted to the verified disposable Clerk Development subject; revision `5f6518eb`; both stopped and retained after successful qualification |
| Phone | `com.masarifi.mobile.dev`, final combined JS bundle loaded; original owner authenticated; automatic Voice runtime verified |
| Protected Voice runtime | Original revision `95b547ac`; epoch `a7f6f66c-507a-4390-b592-2da44b025091`; ON Posting |

The two new Staging migrations were installed with verified history and protected fingerprints. Original assistant migrations remain unchanged. The ordinary API and Voice runtime were not replaced. Test quota was increased only for the existing Staging owner's financial-assistant workload to 50 per rolling day; shared budgets and Voice policy were not changed.

## Actual acceptance and timings

Native tests covered latest transaction, largest spending, current/prior days, period comparison, financial questions after programming, unrelated questions after finance, greetings and relevant follow-ups, manual-entry help, false premises, and genuinely empty planning collections. Failed earlier attempts and slow recoveries remain in the private evidence; they were not discarded or silently resent. Corrected grounding was retested against the real model.

| Measurement | Observed result | Qualification limit |
| --- | --- | --- |
| Home service reads | Five later samples: median 771 ms; one earlier sample 7,930 ms | Warm session; unequal before/after sample counts; not full-screen paint or p95 |
| Transaction service reads | Five later samples: median 287 ms; one earlier sample 2,653 ms | Same limitation |
| Voice recovery GET path | Five before: median 1,878 ms; five after: median 678 ms; all successful GETs | No audio upload, ASR, processing or posting calls; not a full-recording latency claim |
| Native microphone start/cancel | Recording reached in 670 ms, then cancelled with no upload | Start path only |
| Disposable manual expense | Create 264.7 ms; same-key replay 24.8 ms, exact same transaction/posting | Backend loopback HTTP; excludes token issuance, SSH transport and native UI |
| Latest planning canary | Correct empty-domain answer displayed in 17.163 seconds | One sample; earlier same question took 71.806 seconds |

The latest planning canary's backend stages were overview 348 ms, model planning 5,681 ms, three parallel data reads 528 ms, final model answer 3,744 ms, grounding 20 ms. An earlier 71.806-second request spent 56.459 seconds in its second provider call. Model/provider latency remains variable; no universal response-time target or p95 has been established. A historical 94.8-second Voice interval occurred before upload completion; its cause has not been proven or declared fixed.

Actual Android keyboard screenshots show typed input and Send above Gboard. A native unavailable-profile-state exercise displayed the friendly recovery UI and Retry restored the authenticated profile. Phone connectivity was not globally disabled; physical offline coverage and iOS keyboard coverage are not claimed.

## Governed account-deletion qualification

Existing Clerk Development credentials were retrieved through its dashboard and stored privately outside Git. No Production keys were changed. Genuine Development authentication was verified; no freshness claims were forged. The only external identity created for deletion is marked disposable and belongs to the Development instance.

Actual HTTP checks passed: stale-auth rejection, request acceptance, exact same-key replay, cancellation, re-request and status read. A registered device and two additional unregistered provider sessions establish provider-wide cleanup coverage. Before expiry, the external identity and all three original sessions remained active. One clearly marked synthetic wallet and one 0.01 SAR expense verified actual manual save/replay without changing the real owner's ledger.

Final governed request deadline: **2026-10-16 14:15:37.073864 UTC**. The actual worker completed at **14:15:48.560065 UTC**, after the deadline. The server observed the immutable deleted profile with `deleted_at`, email/phone/name removed, the only registered device revoked with its session binding cleared, and the first request still cancelled. At **14:16:00 UTC**, Clerk confirmed the external user and all three original sessions absent (404), with zero active sessions. Before-deadline observations at 14:14:34–36 UTC had confirmed the identity and all three sessions still active. No timestamps, cooling-off policy, or ordinary application were changed to accelerate the test.

Registered handler outcomes recorded ai deleted0, engagement deleted78, tracking deleted113, identity deleted1/anonymized1. The synthetic financial account, transaction and posting remain retained as disclosed. The protected real owner remained active with the same 22 confirmed undeleted transactions.

After these actual DB/provider proofs, a separately reviewed helper stopped only the owned isolated privacy worker, then API, retaining all 144 containers and verifying every other configuration/image/start/restart/running pin and the current Nginx hash. The current c430 assistant pair remained healthy. Fresh Voice observation at 14:16:48 UTC confirmed ON Posting, healthy API/worker, zero pending/failed, unchanged epoch/source and one historical restart. The final native bundle check confirmed the protected owner still authenticated, automatic Voice enabled and no pending audio.

Financial ledger/planning retention is explicitly disclosed by the existing deletion domains; this work does not claim total financial-record erasure. Native destructive UI qualification on the real owner's phone was intentionally excluded. Hosted destructive proof uses the isolated API/worker and disposable Development identity; panel behavior is covered by source/component/HTTP-boundary tests. The phone's existing shared identity/privacy route was not redirected to the isolated test-key service. These deletion fixes were not published into the ordinary/shared identity runtime or Production.

## Evidence

Private evidence root: `D:/Masarifi-preservation-2026-10-16/reliability`.

- `final-combined-mobile-34be0aa1.json` and `.log`; `assistant-stages-api-unit-contract.json` and `.log`.
- `voice-read-auth/native-before-after-summary.json`; `read-benchmark-repeat/five-sample-summary.json`.
- `device-final-v6/final-bundle-*.json`, Metro logs and native screenshots under `device/`.
- `device-final-v5/stages-*.json`, native canary results, and earlier retained evaluation files.
- `clerk-development-private/`: private credential file, exclusive-once HTTP receipts, provider observations, governed deadline and disposable manual fixture evidence. Never publish this directory or copy secrets into Git/logs.
- `runtime-v5/`, `privacy-runtime-v2/`, `privacy-runtime-completion-stop/`, schema/quota receipts, and `progress.md` retain exact operational pins and protections. Do not replay completed actions. The v5 observer's original requirement that the privacy pair remain running is now intentionally obsolete; use the final stop receipts for the stopped-pair baseline rather than replaying the old observer/stop actions.
