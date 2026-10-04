Current October 4 continuation: the [ten-event non-posting evidence](handoffs/2026-10-04-voice-v3-ten-event-nonposting-validation.md) supersedes the initial five-event limit and historical no-inference statements below. Automatic posting remains disabled; Production and final integration are untouched.

# Masarifi Voice v3 implementation and release ledger

Implementation date: 2026-10-03. Accepted baseline: `bb9235f094b7b795f6debf25fe5f42ceca46ae16`. Implementation branch: `codex/voice-auto-batches`, in the managed `voice-auto-batches` worktree. The original checkout and the accepted baseline worktree were preserved.

Initial implementation record (October 3): Local backend, database, extraction-adapter and Mobile implementation is complete. The new server policy defaults **disabled**. No hosted migration, deployment, live configuration change, recording or provider inference was performed. Device and real-provider acceptance below remain required before enabling automatic posting.

## Product contract

One recording produces a batch of zero to ten independent occurrences. Eligible expenses and income create separate normal transactions automatically. Unsafe, incomplete and unsupported occurrences are terminal silent skips. A single transaction is a one-item batch.

The v3 flow is `Record → Stop → Analyzing → actual committed cards/count`. It has no review, confirmation, questionnaire, authentication escalation or resolution endpoint. Completed zero-result batches show “No transactions were added.” A known commit shows “Added N transactions.” A connection failure or unknown result stays pending/checking; it never becomes a guessed zero-result success. Partial operational failure preserves the confirmed cards and count, with a short failure message.

Existing v2 sessions retain their manual confirmation and recovery behavior. Existing proposals are never automatically posted. Normal transaction editing/removal remains available after a v3 commit.

## Implemented lifecycle

1. Mobile native Stop finishes and releases the recorder. An owner-scoped SQLite operation, keyed by permanent capture UUID, takes durable ownership of the audio. The recorder publishes Ready after handoff, without waiting for server work.
2. Each operation independently hashes its M4A, persists its immutable create request, then uses capture-derived idempotency keys for create, process and cancellation. Session identity is persisted before upload/process dispatch. Revision checks and owner generations fence stale callbacks. Leaving the screen or backgrounding pauses transport without implicitly cancelling accepted work.
3. Authenticated contract-v3 session creation snapshots the selected default account and trusted recent-auth context. Accepted upload validation, process reservation, Worker fencing, media lifecycle and provider accounting remain in place.
4. One governed extraction receives the full recording and supplied reference aliases. The accepted basic Vertex schema is extended to an event array. Gemini 3.5 Flash-Lite, global Vertex transport, ZDR/privacy controls, M4A, Arabic/English, route/provider budgets and governed retry behavior are retained. Recording remains limited to 60 seconds and response output to at most 1,200 tokens.
5. The complete envelope is checked before any decision is persisted. Refusal, truncation, overflow, an incomplete envelope or more than ten events reject the whole extraction. Safely separable malformed individual events become skips without discarding valid siblings.
6. Each candidate passes deterministic eligibility, existing canonical proposal validation and transaction normalization. Missing or unsafe events persist only an opaque occurrence identity, ordinal, terminal status, allowlisted reason, policy/schema version and operational timestamps. No v3 transcript or raw extraction response is persisted.
7. The Worker accepts one immutable decision set per session. Eligible commands receive permanent occurrence UUIDs and command hashes; skipped items receive no financial draft. Per-recording provider usage is accounted before business validation. The audio is purged through the retained media lifecycle.
8. The independent `voice.finalize` job claims bounded, fenced batches. Each eligible occurrence posts in its own database transaction under the existing owner ledger lock and consistent session/batch/event locks. It rechecks cancellation, authorization, reference validity and command integrity, then writes the normal transaction/postings/balances/revision/audit/outbox and authoritative receipt atomically.
9. Retries return existing receipts or resume remaining commands. They never regenerate occurrence identities, revive skips or invoke inference after batch acceptance. Mobile polls and owner-scoped recovery reconcile committed IDs and invalidate Home, balances, history, reports and assistant context.

## Eligibility and independent execution

| Condition     | Implemented policy                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meaning       | Completed independent expense/income only. Repayments, transfers, loans, obligations and unsupported semantics skip.                                                                                                                        |
| Amount        | Explicit nonzero safe integer minor units, correctly signed for extraction and within canonical ledger bounds. No guessed amount.                                                                                                           |
| Account       | Explicit item/shared alias must resolve. Only genuinely omitted account uses the operation's snapshotted default. Ownership, active state and currency are rechecked before posting.                                                        |
| Currency      | Explicit/shared currency must match the account. Genuinely omitted currency deterministically inherits the resolved account currency. No implicit conversion.                                                                               |
| Date          | Explicit/shared date must be a real supported date. Genuine omission uses capture-local date and the saved capture offset. Explicit ambiguity never defaults.                                                                               |
| Category      | Supplied taxonomy alias must match transaction kind and active owner/global reference rules. Expense requires a category; existing nullable income-category behavior remains.                                                               |
| Independence  | Full-story corrections, totals/components and uncertain boundaries must be resolved before eligibility. Separate identical purchases retain separate occurrence identities.                                                                 |
| Confidence    | A bounded policy veto only; it never supplies missing fields or grants authorization.                                                                                                                                                       |
| Authorization | Owner/profile/RBAC, configured recent-auth age/thresholds, aggregate same-currency safeguards and the existing ledger write rate limit remain enforced. Missing required recent auth skips the affected cohort without a user step-up task. |

The narrow SQL execution capability independently checks command shape, canonical values, source, text bounds, date format and occurrence-derived external reference. The Worker has no general customer impersonation or direct ledger-table mutation grant.

An item invalidated before posting is skipped and its command content is removed in the same database transaction. Named account-balance-limit violations similarly roll back that item and allow independent siblings to continue. Unexpected database, audit, outbox, receipt or delivery failures remain operational retries rather than semantic skips. Finalization uses bounded leases, a 30-second retry delay and five execution attempts per occurrence. A failing occurrence does not block independently healthy siblings; exhausted item retries produce operational failure while committed receipts remain visible. Session expiry purges unexecuted command content even while the automatic gate is disabled.

Cancellation uses the same owner/session/batch locking boundary as posting. Before durable submission, capture audio is discarded. Afterwards, remaining eligible work is cancelled and command content removed; already committed receipts remain authoritative. Offline cancellation intent is persisted before transport. Lost responses reconcile through owner-scoped receipts rather than inventing an outcome.

## Storage and API changes

Forward migration: `supabase/migrations/20261003145030_voice_automatic_batches.sql`. Existing migrations were not rewritten; the checksum manifest includes the new migration.

Private tables separate policy, capture context, accepted batch, occurrence outcome and temporary eligible command. Owner-qualified foreign keys, occurrence uniqueness, receipt uniqueness, bounded commands, RLS and restricted function grants protect the domain boundaries. No customer-facing pending financial drafts are created for skipped items. Eligible payloads are removed on commit, skip or cancellation; expired unexecuted work is purged. Committed financial records retain the existing ledger audit/retention lifecycle.

Public v3 results contain only `sessionId`, `batchId`, processing `status`, `transactionIds`, `addedCount` and `ledgerVersion`. The owner recovery listing adds creation time solely for pagination. Internal reasons, candidate fields, proposals, model confidence and reasoning are not returned. New endpoints:

- `GET /api/v1/voice/sessions/:sessionId/batch`
- `GET /api/v1/voice/batches/recovery`

Existing create/upload/process/cancel/session/recovery endpoints dispatch by contract version. V3 clients send `X-Voice-Contract: 3`. Legacy confirmation remains contract-v2 only. OpenAPI describes both compatible contracts and contains no v3 item-resolution endpoint.

Mobile SQLite migration 15 adds an owner-scoped multi-operation journal, leaving the v2 singleton recovery record intact. Terminal server results delete local audio before clearing its reference, preserving cleanup retry after deletion failure. Definitive pre-create cancellation, expiry, missing/corrupt audio or rejected creation can retire locally because upload/process cannot have been dispatched without a durable session ID. Unknown create responses retain the original identity for retry/reconciliation. Restored cancellation controls are published before network recovery completes. Server discovery includes the last seven days plus unresolved finalizing work, paginates monotonically, and polls unresolved sessions separately. Idle Mobile recovery does not repeatedly download terminal history. Clean terminal local records retain at most seven days and 100 rows; pending operations and undeleted media remain recoverable.

## Local verification

| Verification                                                    | Result                                                                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API full unit/contract selection                                | 211 suites, 1,400 tests passed.                                                                                                                                                       |
| Mobile full Jest suite                                          | 454 suites, 2,513 tests passed.                                                                                                                                                       |
| Final Mobile recovery/runtime selection after edge-case changes | 2 suites, 43 tests passed, including three additional definitive pre-create failure cases.                                                                                            |
| Fresh database Voice integration selection                      | 5 suites, 49 tests passed against `voice_v3_release`, bootstrapped from the complete current migration set.                                                                           |
| Voice/ledger/operations security selection                      | 4 suites, 19 tests passed, including live ledger ownership tests. V3 receipt/recovery/cancellation owner isolation is also covered by the integration selection.                      |
| API checks                                                      | Typecheck, lint, API/Worker/migration builds and migration checksums passed.                                                                                                          |
| Mobile checks                                                   | Typecheck and complete frontend quality/boundary checks passed; changed production files have no lint errors. The existing `useVoiceCapture` hook warning remains outside the change. |
| Independent final review                                        | No blocking functional or security findings after repairs and regression verification.                                                                                                |
| Whitespace                                                      | `git diff --check` passed.                                                                                                                                                            |

The disposable database used loopback PostgreSQL 18 and real pgmq SQL with minimal local auth/storage scaffolding. Hosted Supabase uses PostgreSQL 17; official-environment migration/role/extension acceptance remains a release gate. No production database was used. Mobile Jest uses `--forceExit` for the existing open-handle behavior. The isolated worktree's ignored Android privacy manifest was copied from the original checkout after confirming equivalent app configuration; no tracked native configuration or dependencies were changed.

Tests cover one/three/five synthetic bilingual extraction envelopes; zero-result and mixed batches; canonical defaults and ambiguity; unsupported semantics; skipped-content privacy; late invalidation; identical independent occurrences; duplicate Worker delivery; fencing; receipts after partial completion; cancellation; recent-auth aggregation; restricted capabilities; and failures at transaction, posting, balance, revision, audit, outbox and receipt boundaries. Bilingual Worker journey tests use synthetic provider responses through the actual adapter/accounting/finalization path. They do **not** prove real-model correctness or five-event output fit within 1,200 tokens.

## Remaining release acceptance

Before deployment/enabling, run exact-revision CI and official disposable Supabase/PostgreSQL 17 migration/security checks. Approved, bounded Gemini/Vertex Arabic and English canaries must demonstrate complete five-event output under the existing token cap. A failed proof blocks release; it does not permit increasing budgets, adding inference calls or posting a truncated prefix.

Physical Samsung acceptance must cover the four-event story, single/three/five events, zero safe events, mixed unsafe events, repeated recordings, cancellation races, offline recovery, backgrounding and termination. For the four-event story, safely resolved breakfast, taxi and household purchases produce three normal cards; the unsupported repayment produces no transaction, draft or question. Verify balances, receipts, provider accounting and media cleanup.

Timing-only bounded instrumentation measures permission, audio mode, native preparation/start/stop/completion/release, file check, journal handoff, tap-to-recording and handoff-to-Ready. No audio, identity or financial content is logged. Confirm Ready within 250 ms after native release and durable local handoff, measuring native preparation separately. No physical lag improvement or timing acceptance is claimed by local tests. Diagnose the measured Samsung boundary independently; do not mask it with sleeps.

## Rollout and rollback

The migration creates `private.voice_automatic_policy` with `enabled=false`. Applying source alone therefore does not authorize automatic posting. Enabling it is a separate controlled release action after the acceptance above. Gate-off v3 create requests fail safely; compatible v2 operations remain manual. Do not enable the gate as part of local verification or retroactively convert v2 proposals.

Stage the database capabilities and governed finalizer, then compatible API/Worker and v3 Mobile builds. Enable automatic decisions only after the approved release checks. Monitor aggregate skip reasons, duplicate effects, finalization failures, provider holds, normal transaction corrections/removals and bounded recorder timings without retaining raw skipped content.

Rollback sets the server policy disabled through the authorized operations process. It blocks new v3 creation and further automatic financial execution and leaves existing accepted decisions/receipts intact. Gate pauses do not consume finalization retries. Uncommitted commands remain paused until authorized resumption, cancellation or expiry cleanup; committed transactions and normal history remain. Existing in-flight extraction can persist its accounted decision set while execution is paused. Never re-infer accepted batches, change their occurrence identities, resurrect terminal skips, create review tasks or automatically reverse committed financial records. Use normal audited transaction management for corrections.

This worktree is intentionally retained for review and release assembly. The October 4 continuation freezes an isolated candidate and runs exact-SHA CI before reporting it. Controlled non-posting provider capacity probes are authorized and documented in the ten-event handoff. No final integration, hosted migration, application deployment or financial Staging canary is performed. See the dated handoff for current evidence and the ten-event decision.
