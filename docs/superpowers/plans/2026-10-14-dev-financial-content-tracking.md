# DEV financial-content Tracking implementation plan

> For agentic workers: implement inline with superpowers:executing-plans and test-driven-development; obtain an independent final review before live qualification.

**Goal:** Accept financial SMS from any sender and financial notifications from any non-chat application in the approved DEV client, then post exactly once through the existing Staging ledger.

**Architecture:** Extend the existing nominal accounting policy with optional `sourceAdmissionPolicy: financial_content_v1`, delivered by an authenticated, device-scoped rule snapshot. Only an explicitly approved owner/device/release cohort grants that policy and posting authority. Preserve the existing contract for every other client and every previously retained capture.

**Tech stack:** Existing JS parser, mobile TypeScript, Android Kotlin listener/WorkManager, Nest API and PostgreSQL; no new dependencies.

**Spec / approval:** User's 14 October 2026 instructions: content and effective keywords determine financial candidacy; no source whitelist; SMS may be personal; notifications exclude WhatsApp and other chat apps; classify outgoing as expense and incoming as income; existing default account/currency and Shopping expense fallback; no Production; preserve Voice; qualify DEV step by step before enabling Staging posting.

## Constraints and review focus

- Exact worktree `D:/Masarifi-integration-2026-10-10`, branch `codex/voice-promoted-operating-2026-10-13`, starting HEAD `18074979e5c0c478ce43c27f29bc1b3040c8ee58`.
- Unknown amount/direction must not become an invented financial fact. No direction default was selected. Recognize structured transfer endpoints when ownership is established; keep truly unresolved evidence diagnostic.
- OTP, advertising, failed/pending operations and payment requests remain excluded from posting; explicit owner source blocks remain effective.
- Only new observations after the approved policy boundary enter the new policy. Preserve prior queue entries and identities, without activation replay.
- Same amount alone is never correspondence. Test source revisions, response loss, concurrent SMS/notification imports, independent equal amounts and opposite directions.
- Device impersonation, expired cohorts, another owner and ordinary clients must not obtain broader posting authority.
- Native/JS/API policy disagreement must fail closed; an incompatible DEV binary requires rebuilding DEV only.
- Voice's running monitor pins migration history and services. Prepare a compatible maintenance/handoff scope before changing any pinned live resource; never edit an old immutable scope or reuse an old approval controller.

## Task 1: Shared content admission and extraction

Files: `packages/transaction-parser/nominal-tracking.js`, `index.d.ts`, new `financial-content.test.js`; mobile `sms-import.ts`, `sms-import-queue.ts`, coordinator/background runtime and their tests; Kotlin `FinancialDiscoveryPolicy.kt`/test and native module.

Interface: fifth optional argument to `discoverNominalTrackingMessage` carries `sourceAdmissionPolicy`; omitted policy retains financial-source-only behavior. Effective policy goes through the existing encrypted cache, preparation and compiled native discovery policy. Require a compatible native capability for content admission.

- [x] Write failing tests for personal SMS, unknown non-chat apps, chat exclusion, blocked sources, disabled keywords, OTP/request/failure and independent amount/direction extraction.
- [x] Run `node --test packages/transaction-parser/financial-content.test.js`, confirm expected admission failures.
- [x] Implement minimal optional policy; pass policy through mobile preparation/cache/native admission. Record actual source identities, never relabel personal senders as banks.
- [x] Test round-trip configuration, owner fencing, activation boundary and native capability; run parser suite and affected mobile/native tests.

## Task 2: Scoped configuration and authoritative posting

Files: Tracking controller/service/repository, live mobile service, OpenAPI contract; additive Supabase migration and `tracking-financial-content.integration.spec.ts`.

Interface: rule-snapshot GET accepts optional `deviceId`; exact approved cohort returns content policy and activation time. Backend source eligibility independently checks the item's owner/device/release/channel, policy marker and receipt boundary. Global channels remain review; other clients retain old behavior.

- [x] Add failing API/SQL cases for exact device scope, legacy response compatibility, forged metadata, expiry, chat/explicit block and historical captures.
- [x] Add columns/function without seeding enabled policy/cohort; update checksum manifest through existing tooling.
- [x] Carry policy/boundary into captures; preserve original numerical amount/currency and resolved ledger effect on retries.
- [x] Run typechecks, API tests and disposable database tests against fresh and upgraded complete migration chains.

## Task 3: Movement identity across channels

Files: new migration's reservation/correspondence logic and database integration cases; preserve current ledger idempotency and saved-effect validation.

Interface: observation identities remain native event identities; supported financial correspondence reuses one durable movement reservation. Reference-free ambiguity is internal diagnostic work, not amount-based merging or an invented second effect.

- [x] Write failing concurrent opposite-channel, response-loss, equal-value independent and opposite-direction tests.
- [x] Implement narrowly evidenced correspondence and immutable reservation/effect validation. Keep existing imports compatible.
- [x] Assert transaction counts, immutable posting counts, balance deltas and retry agreement in real disposable PostgreSQL.

## Task 4: Review, DEV build, Staging rollout and qualification

- [ ] Run required checks; independent combined-change review; resolve important findings with failing regression tests.
- [ ] Build/install only compatible `com.masarifi.mobile.dev`, retaining its data and the ordinary package. Prepare fresh private deployment/cohort evidence and backup; no secrets or actual SMS bodies in Git.
- [ ] Verify Voice monitor/service/schema compatibility before Staging-only migration/API/Tracking deployment. If live continuity needs a protected handoff, prepare its concrete scope before execution.
- [ ] Enable the exact DEV cohort with a fresh capture boundary; verify ordinary clients/global release modes unchanged and Voice healthy.
- [ ] User grants notification access in Android. Qualify one new SMS expense, an explicitly linked non-chat test notification, one income, retries/revisions and independent equal amounts; inspect actual ledger effects and quiet financial-screen refresh.
- [ ] Report actual results, remaining evidence limits and exact next user step. Never claim force-stop capture, Production deployment or historical replay.

## Execution ledger

- Pre-flight: optional policy travels parser → cache/preparation/native → authenticated device snapshot → authoritative SQL; all consumers must preserve omission semantics.
- Ruling: default category is Shopping for unknown expenses, not a default direction. The user did not select an incoming/outgoing fallback; unresolved direction requires evidence.
- Baseline: clean tree on starting HEAD; user-approved notification source rule for installed Alinma exists on Staging, global rollout remains review and zero active Tracking cohorts. Temporary preparation helpers/evidence remain outside Git.

- Verification update: parser 34/34; final affected mobile 192/192; prior whole mobile suite 3076/3076; API Tracking/contract 105/105; real disposable Tracking 110/110 then content 22/22; schema 111→112 preserves the complete legacy configuration and revision. Independent review's four important findings reproduced and repaired. Native build and same DEV signature verified; ordinary native 44 input hashes restored. Compatible Voice monitor tests 27/27 plus real SQL 37/37, local Python 47 executed and 8 Linux-only skips. DEV installation succeeded; no Staging deployment or posting activation yet.
# Physical qualification repair: Android and restricted worker (14 October 2026)

The first post-activation DEV SMS reached the parser but did not post. Android's ICU rejected the JVM-only Unicode regex flag in notification normalization. Separately, the deployed worker login cannot assume the API role used by the general LedgerService repositories. Do not widen that login or store API credentials in the worker.

Replace the unsupported flag with an explicit Unicode whitespace class. Preserve native queues and install the updated, identically signed DEV package in place. Ordinary generated Android inputs must be restored after the DEV build.

Add a nominal-only worker capability accepting a capture ID and live lease. It derives the owned command from current eligible evidence, reserves the original identity, validates any saved effect, and atomically uses the existing ledger posting helpers with rate limiting, ledger idempotency, audit/outbox and item acceptance. Keep the configured recent-auth decision before invocation. Legacy imports and manual/Voice paths retain their existing behavior. Migration `20261014181609` adds the function without rewriting captures or financial records.

Qualification: reproduce the restricted-login failure in a disposable database; test no API role authority, threshold refusal, response loss, concurrent channels, equal independent events and actual balances. Reapply the complete 113-migration chain and independently review the combined fix. Voice controllers must explicitly qualify the new full history; old scopes remain immutable and cannot be reused for deployment.

The retained physical SMS must resume with the same source identity, original activation boundary, item and session. Verify one expense/posting and exactly a one-riyal balance reduction before claiming acceptance. Staging deployment and any required temporary Voice maintenance use a fresh concrete scope; preserve the ordinary installation and all old Voice work. No Production operation.
