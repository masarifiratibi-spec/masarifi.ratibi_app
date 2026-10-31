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
