# Voice diagnostic deployment and next financial acceptance

13 October 2026, Staging only. Recovery branch and existing unrelated uncommitted work are preserved. No Production, device, replay or new financial operation was performed.

## Completed deployment

Direct human approval call `call_7Z0MJuAYThOjH31cNZwHJCcd`, answer “Approve this exact OFF scope once; financial testing paused”, authorized scope `845390dbaeb07679ae43774d9253f66aa13b3ec1ef04bdaa5d20d088bbb1f031`. Attempt `b975ac6f-d4ff-4e06-8c1d-c27d0136d53a` was consumed once and completed successfully at 09:35:32 Riyadh. No retry occurred.

The immutable worker image `sha256:48b5ef586204e781e6adf65fa9dc0d3bfcce6cf4a0303f803a9f99e937ff008f`, source `d8dc50a5bf8e568619cbfcf2a3fbcaa6fdf403c2`, was staged. Migration `20261013053237_voice_scope_rejection_diagnostics.sql` and exactly one history row were installed atomically. No container or route was started, replaced or changed. Posting remains OFF, with zero active epochs and processing jobs.

Independent outcome review verified all 16 protected financial/Voice/session table hashes, previous migration history, function ownership/ACLs, active authentication, routes, environment, CA and container states preserved. Evidence directory: `E:/Masarifi-three-changes-2026-10-12/voice-scope-diagnostics-preparation`, including `deployment-result.json`, `post-off-baseline.json`, one consumed execution receipt and `OFF-RESULT-INDEPENDENT-REVIEW.md`.

## Diagnosis and limits

The historic 10 SAR recording completed provider analysis and failed the exact canary scope check. Zero financial events, transaction/posting writes or balance changes occurred. The command and failed predicate were not retained, so an exact field-level cause cannot be reconstructed safely. The confirmed observability defect is fixed: SQL returns a finite predicate label and the worker logs only that allowlisted label. The posting guard is unchanged; no category override or financial validation relaxation was added.

The 50 SAR recording was explicitly analysis-only after the closed epoch and produced no financial writes. Neither recording nor the retained legacy Voice session is to be replayed.

The unchanged current baseline is 5 accounts, 33 transactions and 33 postings; Test SAR confirmed balance −310 SAR, pending 0, ledger version 4. Fresh actual read-only readiness at 09:53:45 Riyadh verified the exact diagnostic function bodies, ownership, security modes, search paths, ACLs, OFF/idle eligibility and preserved financial/authentication baseline.

## Qualification and next boundary

Runtime qualification: CI `38352317509`, 64 actual disposable SQL tests, 13 backend tests and 26 container tests passed, with type checks, lint and vulnerability verification. Installer/control qualification: CI `38355815371` passed actual atomic rollback, concurrent single-install, repeat/expiry rejection and in-flight reconciliation checks.

Control source `5e5b15dc266f6e3ceb2d496b110095c983fd9656` adds exact read-only diagnostic admission before any new canary runtime claim and repeats it before prepare/activate capability writes. CI `38359218272` passed 5 focused Node tests and 52 Linux lifecycle/control tests in normal and optimized Python, no skips. The qualified financial API and installed APK are reused; no unrelated rebuild was performed.

The new, unapproved proposal is in `E:/Masarifi-three-changes-2026-10-12/voice-diagnostic-canary-preparation`. Scope `c91cde0e74b15db76b2bdba07f92e88ab4207c62cb58799231a85cea29bc15ef`, attempt `92e0198d-05bc-4c9b-9596-f6304a1a14f1`, permits only one NEW 10 SAR Shopping expense on the pinned Test account/session. It reuses API 3003, starts one scoped diagnostic worker/monitor, temporarily switches two API routes, and shuts posting OFF and restores services on commit/failure/deadline. Capture window 300 seconds including 90-second arming; owned cleanup 180-second aggregate command budget after its lock.

Independent final packet review and direct human deployment/financial/new-transaction approval are mandatory before this canary. No such approval is implied by successful OFF deployment or CI. Continuous Auto-Posting remains separately gated after actual bounded financial acceptance passes.
