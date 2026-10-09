# Final Automatic Financial Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the combined release into deterministic, privacy-preserving, zero-touch financial tracking with real Samsung/Staging proof.

**Architecture:** Native admission uses a compact policy compiled from the current database rule snapshot and user overrides. The existing shared parser remains authoritative; API/database eligibility and LedgerService retain financial authority. Source assurance, content evidence, account resolution and duplicate identity are independent checks.

**Tech Stack:** Kotlin/Android NotificationListenerService/WorkManager, Expo React Native/Hermes/SQLCipher, shared JavaScript transaction parser, NestJS, PostgreSQL/Supabase, existing deployment/CI controls.

**Spec:** `docs/superpowers/specs/2026-10-09-final-automatic-tracking.md`.

## Global constraints

- Do not modify Production or merge main without separate user approval.
- Keep AI fallback disabled; no new routine LLM dependency or quota consumption.
- Extend existing combined release; preserve newer Voice/Assistant changes and all unrelated owner data.
- Unknown weak/nonfinancial text must never be durably stored or uploaded.
- Explicit source blocks and protected lifecycle/exclusions precede source confidence.
- No invented amount, currency, direction, successful status, category, account or reversal linkage.
- Existing authoritative ledger and durable idempotency paths only.
- Install compatible Dev APK in place; preserve application ID, signing identity, sign-in and data.
- Real financial transactions are initiated by the user after a fresh READY cue.

## Phase 1: audit and integration base

Verified 2026-10-09: `ratibi/main=ecfba4d`; latest combined branch and Staging API are `de74723f63f6f0d04b652b26efdebce2eb758cb6`, including Voice base `976dd92`. Isolated managed worktree reused; implementation branch `codex/tracking-final-automatic`. No unrelated tracked changes.

Actual Staging: migration `20261009113629`; engine `2.0.0`; release `bundled-sa-ae-2026-10-09`; 23 rule groups; 430 default rows over 5 owners (86/owner, 40 AR/46 EN); channel review/AI false. EGP exists in the 12 supported ledger currencies; current test owner has only active SAR cash.

Current correct functionality:
- Idempotent profile default initialization/backfill preserves existing custom/disabled rows.
- Atomic versioned rule snapshot, owner-isolated cached configuration, encrypted capture/SQLCipher queues.
- Native SMS content triggers, notification callback, WorkManager/Headless JS, durable channel/native/revision identities.
- Protected status/exclusion rules, structured amount/balance separation, reference reservation and ledger operation recovery.
- Shared LedgerService and financial screen synchronization.

Gaps and exact ownership:
| Component/files | Current behavior | Required correction / approach | Risk and acceptance |
|---|---|---|---|
| `packages/transaction-parser/index.js`, `index.d.ts`, `default-rules.json` | Custom phrases handled separately in mobile; limited Egypt aliases/wording; generic subtype families force review | Shared deterministic discovery policy and evidence; default/custom matches recorded together; explicit independent completion/direction/account eligibility | False positives, status override, ambiguity: bilingual/mixed/marketing/OTP/incomplete corpus |
| `apps/mobile/src/features/tracking/sms-import.ts` | Native notifications already filtered; custom unknown matches imply group direction/review; amount-only content survives; disabled SMS source not excluded | Unified discovery; neutral custom phrases; explicit blocked sources; provenance and missing-evidence reasons | Custom-only/amount-only rejection; no fabricated financial values |
| `apps/mobile/modules/masarifi-sms-inbox/android/src/main/java/com/masarifi/smsinbox/{TrackingRuntime,MasarifiNotificationListenerService,MasarifiSmsInboxModule}.kt` | Trusted package gate precedes all inspection; one 200-record/7-day queue | Versioned local admission policy; unknown strong-only queue; blocked/self exclusions; separate noisy-source limits and shorter unknown retention | No callback persistence/upload for irrelevant text; offline/cache/restart/native parity |
| `apps/mobile/modules/masarifi-sms-inbox/index.ts`, `src/services/tracking-background-runtime.ts` | Native bridge receives trusted packages only | Propagate complete discovery policy, blocked packages and current owner/consent generation | Failed/stale snapshots fail closed for discovery; no owner/consent resurrection |
| `TrackingStatusScreen.tsx`, `components/TrackingKeywordChips.tsx`, `features/onboarding/keyword-rules.ts`, live tracking service | Saves do not resync; no keyword disable UI; all new entries expense; default edits/deletes misrepresent published asset | Neutral discovery entry, default immutable wording with toggle, custom edit/delete, immediate validated refresh | Persist/restart/offline; disable actually suppresses phrase; optimistic version conflict; UI journeys |
| `supabase/migrations`, `tracking.service.ts`, `tracking.dto.ts`, `tracking.repository.ts` | Default row delete reactivates original asset; keyword group schema lacks neutral discovery; source trust hard gate | Guard default semantics, neutral group, governed scoped rollout/independent source evidence; additive ordered migration and contract validation | Owner isolation, fresh DB defaults, repeat seed, old clients, versioned rollback |
| v2 `prepare_import_session`/`finalize_import_session`, `tracking.worker.ts` | Review for deposit/transfers/withdrawals/refunds; only expense/fee/salary auto eligibility | Eligibility based on resolvable ledger operation; external/internal transfer distinct; safe automatic linkage only with proof | No double-counted transfers; cash destination/reversal required; full ledger invariants |
| `private.reserve_tracking_capture`, duplicate preparation/decision, API recovery | Trusted/untrusted assurance not separated in canonical reservation/similarity hold | Prevent unknown poisoning trusted identities; proven shared-reference coalescing; uncertain similarities hold without merging independent events | Forged first observation, same amounts, concurrency, revised status, response loss |
| `tracking-save-confirmation.ts`, native `CaptureConfirmation.kt`, scoped engagement worker | Generic confirmation; server delivery readiness depends on inactive broad consumer | Post-commit localized amount/currency/direction confirmation; scoped event delivery only; stable notification identity | One banner, no false success, permission denial doesn't fail ledger; no historical outbox drain |
| Staging deployment and Samsung | Existing Dev variant lacks FCM; background/real save not proven; no EGP account | Compatible APK, scoped worker/API exact image, explicit EGP test mapping, before/after receipts | Sign-in/data preserve, foreground/background/locked/offline/restart; actual SMS/notification |

## Review focus

1. A forged unknown notification arrives before the genuine trusted SMS and must not suppress it.
2. Two independent purchases share amount/currency and occur close together; no silent merge.
3. A user disables default wording then deletes/edits/restores; no accidental reactivation.
4. A notification revision changes pending to completed while offline; one eligible financial effect only.
5. EGP capture cannot default into SAR cash or assume every EGP message belongs to the test bank account.

## Task 1 — shared discovery and privacy admission

**Files:** parser package; `sms-import.ts` and tests; new native `FinancialDiscoveryPolicy.kt` and JUnit tests; listener, queue policy, module bridge, background runtime and tests.

**Interfaces:** `compileFinancialDiscoveryPolicy(snapshot, overrides)` produces versioned immutable native policy; `discoverFinancialMessage(input, snapshot, overrides)` returns financial evidence and classification using the shared matcher. Native policy returns discard/trusted/discovered, never posting authority.

- [ ] Add failing tests: published action/status + transaction amount/currency; custom + independent financial context; custom alone/amount alone/promos/OTP/chat rejected; AR/EN/mixed/digits; blocked/self/consent disabled; missing config.
- [ ] Run focused mobile/parser/native tests and record expected failures.
- [ ] Implement one shared rule-derived policy; native admission only stores admitted candidates; preserve package, lifecycle and owner generation.
- [ ] Add independent unknown queue quota/per-package cap, retention and counters without bodies in diagnostics.
- [ ] Verify native/shared parity, privacy no-persist/no-enqueue, offline/restart/revisions; commit checked deliverable.

## Task 2 — keyword semantics and configuration lifecycle

**Files:** app keyword UI/helpers, live tracking service/coordinator, DTO/domain types/localization, additive database migration and integration tests.

**Interfaces:** persisted neutral financial phrase; `enabled` override suppresses wording; published status safety stays protected. Mutation completes with refreshed cached and native configuration, or reports refresh failure without losing saved state.

- [ ] Reproduce default delete/edit reactivation and current missing individual toggle in failing integration/UI tests.
- [ ] Add neutral group; preserve legacy groups; forbid published default wording edits/deletes through API; mobile default action toggles only, custom edit/delete.
- [ ] Make phrase deduplication match DB ownership/case semantics; preserve custom and disabled rows under default seeding/restoration.
- [ ] Refresh effective rules/native configuration after successful save/restore; last-valid cache offline and reconnect tests.
- [ ] Update explicit notification consent/local retention wording; verify UI layouts and Admin legacy/v2 distinction; commit.

## Task 3 — financial eligibility, source assurance and duplicates

**Files:** parser/rule assets/corpus, `tracking.dto.ts`, service/repository/worker, additive SQL eligibility/capture reservation migration, ledger/tracking contract/integration/security tests.

**Interfaces:** eligibility reports exact missing evidence; source registration is not discovery. Strong unknown-only text cannot prove authenticity; independently corroborated provider/reference evidence can join an eligible verified logical event without permanent source trust.

- [ ] Add failing tests for complete trusted expenses/income/deposits, externally directed transfer vs own-account transfer, cash withdrawal mapping and safe refund/reversal linkage.
- [ ] Extend deterministic Egypt/Arabic/English/mixed assets and aliases; keep protected lifecycle precedence.
- [ ] Remove subtype blanket review only where existing ledger semantics and complete identities make operation safe; use specific missing-field reasons otherwise.
- [ ] Add server-enforced independent-proof path for unknown observations; do not double-count message fields as independent authenticity; never automatically trust.
- [ ] Separate unverified reference reservations from verified identities; no untrusted prior-review similarity can quarantine an otherwise genuine trusted event.
- [ ] Prove lost-response/worker restart/channel revision recovery and same-amount independent events; run authoritative ledger tests; commit.

## Task 4 — scoped automatic rollout and confirmation

**Files:** governed tracking rule/channel migration/API; existing scoped deployment scripts; confirmation service/native presentation; selected engagement worker path and tests.

- [ ] Add failing owner-scope rollout tests: test owner can be automatic while every other owner remains review.
- [ ] Require exact eligible rules/release and owner opt-in; initial discovery-only stage then bounded automatic cohort.
- [ ] Generate post-commit localized amount/currency/direction notification and existing safe transaction navigation; one stable banner on retries.
- [ ] Deliver only newly created tracking cohort events; preserve Voice worker/monitor, do not start broad backlog consumer.
- [ ] Verify notification denial and response-loss financial independence; commit.

## Task 5 — exact candidate verification, deployment and Dev APK

- [ ] Mobile Jest/typecheck/lint, parser corpus, native listener/admission/queue JUnit, API unit/contracts/security, real DB integration/migrations/seed, Voice/Assistant/Manual/ledger regressions.
- [ ] Fresh whole-branch reviewer and one test-first repair pass for material findings.
- [ ] Push isolated candidate for exact-commit CI/image scanning; no main merge.
- [ ] Verify exact-image cross-feature compatibility; deploy API/scoped tracking/confirmation worker only to Staging after gates pass.
- [ ] Build new signed `com.masarifi.mobile.dev` APK with existing compatible signing key; verify signer/application ID before `adb install -r`; preserve owner/sign-in and prior SAR data.
- [ ] Sync native policy and verify rule/engine/release/migration/API/worker versions on device and Staging.

## Task 6 — physical Samsung acceptance and handoff

- [ ] Create authorized `EGP Tracking Test` bank/wallet with opening 0 EGP, tracking enabled; map only verified source/instruments and preserve SAR.
- [ ] Prepare permissions/switches/Listener connection/device state and clean queue/review/transaction/posting/balance baseline.
- [ ] Say READY only after baseline; user makes genuine EGP 1–5 transfer. Inspect actual SMS/app source and both intake paths without assumed sender.
- [ ] Prove discovery-only first, then scoped zero-touch ledger posting and one confirmation; report unresolved fields accurately.
- [ ] Cover foreground/background/locked/OS termination/reopen/reboot/offline/reconnect/permissions/battery as real device permits; never substitute fake SMS for physical acceptance.
- [ ] Record PASS/FAIL/BLOCKED matrix by message family/language/currency/lifecycle/duplicates/ledger/UI/notification, final SHA/APK/versions and Android limits.

## Execution ledger

- 2026-10-09: latest combined base audited; isolated branch created. No implementation changes yet. User approved Staging-only EGP bank/wallet account 0 opening balance.
- Ruling: latest final request supersedes always-review unknown-source design. Discovery admits unknown strong candidates; auto eligibility must have independent source/reference assurance. Unverifiable notification-only content gets a specific missing-proof exception, not a fabricated assertion of authenticity.
- Ruling: preserve existing review mode until code/compatibility gates pass; then enable only the explicitly scoped acceptance owner. Do not use global automatic channel as a shortcut.
