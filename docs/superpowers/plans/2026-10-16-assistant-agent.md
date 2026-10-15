# Grounded Assistant Implementation Plan

**Goal:** Execute the approved review plan so DEV chat uses the model and the owner's real financial data.

**Architecture:** A separate durable assistant queue and worker serve only the new DEV admission. The existing chat storage/API contracts and action confirmation stay intact. A bounded model/read-tool loop uses private claim-fenced reads, exact facts and conversation context.

**Tech Stack:** Existing NestJS, PostgreSQL, OpenRouter gateway, Expo and Clerk. No new dependencies.

**Spec:** ../specs/2026-10-16-assistant-agent-design.md

## Constraints

- Existing worktree D:/Masarifi-integration-2026-10-10 and branch codex/voice-promoted-operating-2026-10-13.
- DEV com.masarifi.mobile.dev and Staging only; preserve all existing services and continuous Voice ON Posting.
- Financial writes require the existing validated preview/confirmation; read qualification has zero ledger effects.
- No historical audio/SMS replay. Private runtime evidence stays outside Git.

## Tasks

- [x] DEV/owner admission and a durable isolated queue, claim fencing, retry/cancel recovery, ordinary-route regression tests.
- [x] Fixed authenticated financial tools: overview, accounts, transactions/search/ranking, summary/comparison, planning, profile and tracking completeness; real PostgreSQL tests.
- [x] Model-driven query/answer loop, fact rendering, period resolution by model with explicit owner clock, bounded conversation context, safe output/action validation and per-call accounting.
- [x] Assistant-only token caching/single flight, parallel reads, direct response lookup, DEV header and regression tests.
- [x] Regression/evaluation corpus from the review, local API/mobile checks, independent review and source/runtime provenance.
- [ ] New DEV-only assistant runtime and exact route; real model qualification on fresh existing data, preserve all containers/Voice/ledger, provide joint DEV test steps.

## Review focus

Owner changes during auth; cancellation during model/tool I/O; stale worker completion; date/currency ambiguity; partial historical data; ungrounded numeric claims; unsupported provider schema; per-call accounting and quota replay; ordinary requests accidentally entering new runtime.

## Execution decisions

User approved execution of the in-chat plan and requested this same branch/worktree. Implement directly without another approval round. Independent mobile/data domains run in parallel per dispatching-parallel-agents. Full financial access means scoped retrieval across domains, not unbounded prompt dumps. Keep existing deployed workers untouched by giving DEV jobs a separate durable lease table; public requests remain processing while that table owns work, preventing legacy workers from consuming them.

## Local verification before isolated deployment

- API AI/config: 49 suites, 584 tests passed. Contract: 40 passed. Security: 20 passed, four existing database-dependent checks skipped.
- Real isolated PostgreSQL: 31 assistant tool/queue tests passed. Temporary test rows rolled back; this is not live-model quality evidence.
- Mobile: full baseline 484 suites / 3156 tests passed; final metadata changes covered by 63 assistant API tests, plus typecheck and boundary checks.
- Independent review findings addressed: durable dispatch budget across retries, conservative crash cost, fresh consent/route/period authorization, bounded model payload and pagination offsets.
- Prepared bilingual evaluation corpus: 100 cases, explicitly not executed against live models.
- Full combined API test invocation exceeded local memory; focused projects run separately. No claim of a full repository test run.
- Existing chat policy is reused (including per-feature and monthly limits); no quota/settings changes.

## Deployment qualification still required

Only the new owner-scoped DEV Assistant API/worker and exact DEV-header assistant route may change on Staging. Run original migration qualification, pin source artifacts, verify all 126 existing containers and continuous Voice before/after, then use fresh read-only questions for real-model acceptance and timing. No Production or ordinary-app release is included.
