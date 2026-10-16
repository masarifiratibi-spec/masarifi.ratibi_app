# DEV finance assistant and application reliability

The user authorized autonomous implementation and testing on 16 October 2026, including computer/DEV phone access, and explicitly asked not to wait for routine approvals while they sleep. Continue the existing `D:/Masarifi-integration-2026-10-10` worktree and `codex/voice-promoted-operating-2026-10-13` branch.

## Outcomes

1. The assistant answers the current question, uses previous turns only to resolve financial follow-ups, analyzes authenticated application financial data, and briefly redirects unrelated requests. A financial question after programming must work; an unrelated question after a financial one must not receive the previous financial answer. Successful financial answers remain model generated and grounded in exact server data, with owner-local dates, fees/refunds, currency separation, pagination and coverage disclosed correctly. No invented amount or action completion.
2. Account deletion must expose actionable authentication failures, progress and the actual deletion/cooling-off state, and complete the existing governed deletion workflow without silent failure or account resurrection. Verify destruction only on a distinct disposable test identity; never delete or sign out the real owner to test it.
3. An unavailable network must have clear Arabic/English explanatory UI and a usable recovery action. Previously cached data may be shown only with honest freshness; never misrepresent an unsuccessful save or stale balance as confirmed/current.
4. Measure and remove unnecessary serial requests, forced authentication refreshes and blocking refreshes in home/startup, transactions, manual entry and Voice. Retain owner/session fencing, idempotency, local durable queues, exact accounting and Voice automatic posting. Do not claim a latency target passed without observed timings.

## Scope and operational constraints

Only DEV `com.masarifi.mobile.dev` and Staging project `qcffvfbpzvpwcwxwjyro`. Preserve the ordinary application, Production, all pre-existing unrelated containers, financial records, and Voice ON Posting under epoch `a7f6f66c-507a-4390-b592-2da44b025091`. No historical audio/SMS/request replay. Coordinate all device access and deployments through the root agent. No broad environment, quota, privacy-policy or global budget changes as a substitute for fixing defects.

Use existing services, components and patterns; changes should fix observed causes rather than introduce a replacement architecture. Independent read-only audits can run concurrently; implement and qualify each outcome in a recorded sequence. User authorization supersedes skill handoff/approval gates, but not requirements to preserve real data and prove correctness.

## Acceptance evidence

Regression tests must fail before the fix and pass after it for each nontrivial defect. Run relevant suites, type/lint checks, independent whole-change review and DEV/native checks. AI quality additionally needs live model questions that switch topics and cover supported domains; mocked model tests prove transport/data contracts only. Record failures and limitations, including unavailable domains and physical iOS coverage, without claiming universal model accuracy. Keep a durable execution ledger and a final handoff with exact source/runtime/evidence pins.
