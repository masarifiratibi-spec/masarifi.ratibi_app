# Voice v3 runtime investigation execution

Approved: the user's ten-section end-to-end investigation plan in this chat.
Spec: `docs/handoffs/2026-10-04-voice-v3-processing-repair.md` and its retained product contract.

## Constraints

Work only in this existing worktree. No Production, merges, financial transactions, automatic-posting enablement, provider fallback, budget increase, or app-data clearing. Preserve unknown outcomes and independent recordings. Document a reproduced root cause before each behavioral repair. Keep diagnostics metadata-only. A mock or legacy shadow is not Samsung end-to-end v3 acceptance.

## Ordered tasks

1. Freeze source/API/APK/policy/count baseline; preserve existing device evidence.
2. Reproduce generic and precise gate-off responses with the real journal, service, capture provider, batch hook and Home UI; record dispatches, state and recording B availability.
3. Create failing regressions for recorder file-check/discard waits, server-terminal cleanup, stale responses and cancellation identity. Record root causes before any fixes.
4. Add minimal Staging-only correlation/instrumentation; fix only demonstrated nonfinancial boundaries with RED/GREEN tests.
5. Verify scheduled purge routing and backend liveness without starting a global worker; repair only a demonstrated safe boundary.
6. Resolve actual Staging access and align exact tested artifacts; preserve device data and prior evidence. No deploy from a dirty or unverified image.
7. Run a controlled Samsung trace only when its result/cancellation/cleanup path is test ready. Investigate acquisition/provider/parser accuracy separately, with posting OFF and the existing reviewed bounded shadow where necessary.
8. Independently review changed boundaries, run appropriate checks, report exact evidence and remaining gates. Stop before the first financial canary.

## Verification

Mobile uses actual SQLite with only native/network boundaries replaced. Test normal and uncertain admission, terminal receipt cleanup failure/timeout, late owner callbacks, native file-check timeout, rejected Stop with hanging discard, stale analyzing after terminal, cancellation mapping, concurrent recording readiness and cold navigation ordering.
Backend tests use real job-registry routing with inert workers and existing gateway/worker/parser suites. Live checks remain read-only until the pinned artifact and controlled path pass.
