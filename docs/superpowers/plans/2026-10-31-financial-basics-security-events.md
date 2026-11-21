# Financial basics and owner security events

Scope: the user cancelled budget/savings from this batch and requested only the other two items, with the basic implementation and sequential acceptance. TalkBack remains excluded.

## Design and constraints

Reuse the existing salary, obligation, credit-card and category modules; first inspect their actual state and existing save/read tests. Reuse the existing owner security-events endpoint and screen. Expose only owner events, with bounded pagination, loading/error/empty states and retry. Keep the existing account, Redmi, branch, APK, Metro PID33696 and draft2026-13. No migrations, new dependencies, provider calls, financial postings, deletion or permission changes. Original user records must remain unchanged. Any live sample writes require a concrete, bounded scope consistent with the user's authorization.

## Task 1 — Financial basics

1. Capture read-only preservation evidence and inspect whether populated records already exist.
2. Run the existing focused save/read journeys; fix only a demonstrated regression, with a failing test first.
3. Accept available live read paths; prepare the exact minimal additive data scope if populated live saving still needs user authorization. Do not claim fixture acceptance as live acceptance.

## Task 2 — Security events

1. Demonstrate cache isolation and live-route gaps with failing tests. Check owner filtering at the server interface, including callers with admin permissions.
2. Reuse the existing screen and service; add owner query isolation/fencing and explicit owner filtering only where needed. Preserve lazy route loading.
3. Verify focused tests, type checks and lint, then perform a read-only phone check where available. Record deployed/source differences honestly.

## Completion

One independent review of the complete patch, preservation comparison, and updated handoff/evidence. Continue on the same branch; no merge or Production work.

## User continuation —1 November2026

The user authorized resuming deployment with verified English terminal input and completing the remaining assistant actions/states, capture and owner/privacy tasks without stalling on routine implementation choices. Do not recreate the accepted card/categories. Finish the current deployment first; preserve the original account/data/draft/APK/Metro and all completed acceptance. Work on safe independent source gaps while external access is unavailable. A live provider window is distinct from completed01–09 and must never reuse them; no destructive account/role/security operation or original financial-record change follows from routine implementation discretion.

Additional demonstrated task: action-preview reads must isolate cached disclosure and late responses by owner. Add failing hook tests, reuse the existing owner-key/read-context pattern, verify preview confirmation/rejection/unknown-outcome regression coverage, and review the narrow patch. Do not build a new assistant tool system or relax existing gates.

Runtime continuation: ordinary composer commands lack an explicit intent hint, and public admission therefore sends them into the read-only agent. Reuse existing intent routing only for clear commands or explicit UI intents; preserve read/how-to/programming classification. Staging currently has a read-agent worker, a sync-only general worker and a voice-only analysis worker. Reuse the existing AiWorker action processor inside the assistant-only worker context, after its existing scope guard, and stop both processors before closing. Verify regressions and offline module qualification. Before activation, require zero claimable legacy assistant jobs, preserved assistant-only/voice-off scope, the same annual credential and budget configuration, and guarded API/assistant-worker rollback; no other services, migrations or old queues. Financial/provider live acceptance requires its own bounded scope and must never reuse01–09.

## Simplified transaction review — latest user direction

Deferred by the user's subsequent explicit instruction on1 November2026. Stop further work, deployment and live acceptance for assistant expense/income creation until the user resumes it. The existing compact presentation is implemented, but end-to-end creation is not accepted as complete. The user's own “ضيف صرف50 ريال” attempt returned a read-only refusal; screenshot/source inspection made no new source or financial changes.

Replace the long transaction review with a compact review inside the assistant answer: expense/income plus exact amount (one type step above body), actual account name, date and supplied merchant only. Show Confirm and Cancel; Confirm itself is the explicit decision, without another review dialog or navigating away. Show Added only after authoritative success, or Cancelled after authoritative cancellation. Reuse the existing guarded preview query, ownership/signature fences, idempotent operation and financial refresh. Keep other action flows unchanged. Missing evidence/context, hidden amounts, expiry and unknown outcomes still block confirmation. Read the account name from the existing owner endpoint; never display a fabricated name. No new provider or financial test follows from this presentation change; scope11's unused request is not replayed after its window.
