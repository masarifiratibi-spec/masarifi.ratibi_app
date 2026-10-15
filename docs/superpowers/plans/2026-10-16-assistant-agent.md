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
- [x] New DEV-only assistant runtime and exact route; real model qualification on fresh existing data, preserve all containers/Voice/ledger, provide joint DEV test steps.

## Review focus

Owner changes during auth; cancellation during model/tool I/O; stale worker completion; date/currency ambiguity; partial historical data; ungrounded numeric claims; unsupported provider schema; per-call accounting and quota replay; ordinary requests accidentally entering new runtime.

## Execution decisions

User approved execution of the in-chat plan and requested this same branch/worktree. Implement directly without another approval round. Independent mobile/data domains run in parallel per dispatching-parallel-agents. Full financial access means scoped retrieval across domains, not unbounded prompt dumps. Keep existing deployed workers untouched by giving DEV jobs a separate durable lease table; public requests remain processing while that table owns work, preventing legacy workers from consuming them.

## Local verification before isolated deployment

- API AI/config: 49 suites, 603 tests passed. Contract: 40 passed. Security: 20 passed, four existing database-dependent checks skipped.
- Real isolated PostgreSQL: 32 assistant tool/queue tests passed. The two original migrations were also applied to an isolated fixture, with all seven read domains, receipt/finish/fail flows and route/period/price denial checks verified. Fixture restoration was verified afterward.
- Mobile: full baseline 484 suites / 3156 tests passed; final adapter/metadata changes covered by 69 assistant API tests, plus typecheck and boundary checks.
- Independent review findings addressed: durable dispatch budget across retries, conservative crash cost, fresh consent/route/period authorization, bounded model payload and pagination offsets.
- Prepared bilingual evaluation corpus: 100 cases, explicitly not executed against live models.
- Full combined API test invocation exceeded local memory; focused projects run separately. No claim of a full repository test run.
- Existing chat policy is reused (including per-feature and monthly limits); no quota/settings changes.

## Deployment qualification

Deployed the owner-scoped DEV Assistant API/worker from source `d7a4d8942fa7d8502d82ea5f2390063ebd802976`. Only the exact DEV-header assistant upstream changed; ordinary assistant traffic remains on its existing upstream. The two original migrations were applied once on Staging, with exact source checksums. Later runtime upgrades verified those same migrations without applying SQL changes.

All 126 original container pins were verified unchanged through deployment and final observation, including the original assistant worker and both continuous Voice processes. Financial fingerprints across all 15 financial tables and Voice policy/control fingerprints matched the baseline. Voice remains active in operating mode without expiry, with its original manifest and fresh heartbeat. Original ordinary/Production applications were not operated or released.

The actual DEV service completed fresh real-model read cases for latest transaction, largest individual expense versus category ranking, compound income/expense totals, the contextual Egyptian follow-up for yesterday, and equal-length month comparison. Responses were independently checked against current owner data. The first compound test exposed an ungrounded response failure; explicit zero-period facts and exact display validation fixed it, and a fresh five-case group passed. The final provider-schema change also passed two new real-model cases; receipts identify the configured `openai/gpt-6-luna` route through `azure`.

Timing remains variable. The corrected latest-transaction case took about 4 seconds; complex questions before the final numeric-reference constraint took about 15–28 seconds. The two final compound/comparison cases took 14.3 and 16.4 seconds, each requiring data selection and answer generation. These are small-sample observations, not an SLA or proof of general model quality. Warm authentication measured 1–6 ms and availability HTTP reads about 0.3 seconds; provider calls dominate the remaining latency.

The prepared 100-case corpus has not been run against a live model. Existing quota and monthly budget settings were preserved. Full CI at `d6242b77` passed application, mobile, database, security scanning and three browser sizes; remaining jobs were superseded by a new exact-runtime-source run. Exact-source CI: https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38819161713 (check the live result; do not infer a green full workflow from focused tests).

Private source/runtime receipts, question operations, actual responses, timing and preservation proofs are retained under `D:/Masarifi-preservation-2026-10-16/assistant-agent`, outside Git.

## Joint DEV checks

1. Open the existing DEV app (`com.masarifi.mobile.dev`) and its intelligent assistant. Use only DEV/Staging for these checks; keep the current phone connected to its development computer.
2. Ask naturally for the latest transaction, then ask a follow-up about its category or date. Verify the actual transaction details rather than a count of recent transactions.
3. Compare the largest single expense with the highest-spend category; check each against transactions/reports for the same period.
4. Ask for today's income and expenses together, then say “ونفس الكلام لأمبارح؟”. Check local dates and zero totals where the recorded period is empty.
5. Try a personally relevant account, budget, obligation or savings question. Check that missing or ambiguous data produces a useful clarification or limitation.
6. Record the exact question, response, period and response time for any weak answer. Continue with fresh read questions within the existing quota; do not replay historical audio/SMS or confirm financial actions during read qualification.

## Follow-up: financial specialty and keyboard

The user reported that this DEV conversation offered programming help and the Android keyboard covered the composer. Implemented the bounded fixes on the same branch/worktree:

- Direct unrelated tasks and brief introductions return short server-owned scope notices before action routing, availability checks, financial reads or quota reservation. Model decisions also support a closed out-of-scope result, and explicit programming output is refused. Financial software names, financial program/plan requests and contextual financial follow-ups remain supported. The numerical quota policy is unchanged.
- Moved keyboard avoidance around the full conversation flex area with the existing top safe inset. Native show/hide lifecycle prevents residual padding after dismissal. The Android device verified visible multiline typing and send, scrolling, and Back dismissal without route loss; the original draft was restored. No native identity/configuration/permission changes were required.
- Scope notices map to `safe_redirect` with a localized specialty heading. They carry no financial period, facts, proposed action or missing-data warning.

Backend runtime source: `c35ab714ef8b09c78d07196321a4c52949d3936b`, new DEV-only API/worker on port 3008. The mobile-only notice-warning correction is `50bdac980b074a160b54c09d732e8dafbd9c2a03`. Existing schema checksums were verified without applying migrations. The original 126 containers and all unrelated current container pins were preserved; only the previous owned DEV assistant worker was retired after the private queue drained. Voice remained operating with its original manifest and no expiry.

Verification: API AI/config 51 suites / 638 tests passed; AI contracts 18 tests passed. Mobile 485 suites / 3170 tests passed, with 70 adapter tests and typecheck passing after the final notice correction. Physical Android keyboard behavior was verified; iOS geometry has regression coverage but no physical-device qualification. Independent review found and fixed overly broad programming detection and the canonical mobile block-label schema mismatch.

Two fresh native UI questions in the existing conversation—programming ability and Python code for expenses—returned the brief scope refusal in about 3.6 and 2.0 seconds. Owner usage and private agent-job counts stayed unchanged, as did all 15 financial table fingerprints and Voice policy/control fingerprints. A missed initial automation tap created no request and is excluded from these timings. Unknown semantic refusal variants were not live-model qualified because the existing rolling financial quota was already exhausted; no quota override or bypass was introduced.

The preceding full CI for source `d7a4d894` finished successfully. Follow-up source CI is https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38824813965; application/mobile checks have passed and the remaining jobs were still running at the last observation. Private receipts and hardware evidence are under `D:/Masarifi-preservation-2026-10-16/assistant-specialization`.
