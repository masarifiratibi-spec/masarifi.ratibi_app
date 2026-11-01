# Masarifi Voice v3 Processing and Accuracy Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:systematic-debugging before each proposed defect repair, superpowers:test-driven-development for changed behavior, and superpowers:verification-before-completion before claims. Steps use checkbox syntax. Preserve the user's existing authorization; this handoff does not require another general plan-approval round.

**Goal:** Make Voice results finish or fail truthfully, establish accurate bilingual extraction on Samsung, and complete bounded Staging readiness without crossing the unapproved financial-canary boundary.

**Architecture:** Retain the accepted session/batch/occurrence identities, compact provider contract, independent eligibility and atomic ledger execution. Separate operational/test waiting from provider accuracy and native recorder readiness. Change only boundaries whose defects are demonstrated; unknown financial outcomes remain recoverable.

**Tech Stack:** Node24, NestJS, PostgreSQL17/Supabase/PGMQ, Expo55/React Native, SQLite journal, SamsungADB, Gemini3.5 Flash-Lite on google-vertex/global, GitHub exact-SHA CI and immutable GHCR images.

**Spec:** [Complete current handoff and retained product contract](../../handoffs/2026-10-04-voice-v3-processing-repair.md). [Domain implementation](../../voice-v3-implementation.md) is historical where it disagrees with the handoff.

## Global Constraints

- All implementation, execution updates and reports in English. Existing Arabic product strings remain supported.
- Work in `C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final`, branch `codex/voice-auto-batches`; acceptance remote `ratibi` / `masarifiratibi-spec/masarifi.ratibi_app`.
- Frozen runtime candidate30984cfd3e2a9606d63588c23802147bbbb492df has green full exact-SHA CI. Do not reopen green code without contrary evidence.
- `Voice Session → Batch → 0..10 events`; every independently safe supported expense/income auto-commits, unsafe events silently skip. No Review/Confirm/questionnaire.
- Preserve60-second M4A/AAC capture,1200 output tokens, accepted model/provider/compact schema, Arabic/English, ZDR/privacy, retry limits and USD2 budgets.
- No Production, branch integration, broad Worker resumption, uncontrolled backlog drain, quota increase, persistent role grants or unapproved financial posting.
- Keep automatic policyOFF through Tasks1–6. No new public extraction-only product lifecycle or bypass of financial authorization is needed for diagnostics.
- Preserve onboarding, v2 compatibility, canonical/reference validation, owner boundaries, accounting holds, exact identities, receipts and ledger consistency.
- Never guess successful/zero results from timeouts. Never re-infer accepted batches, revive skips or replay deleted old audio.
- Skipped content and raw financial interpretations must not appear in logs, outbox, exports or customer APIs.

## Review Focus

1. A503 after create committed must retain the same identity; only a separately proven definitive pre-create rejection may retire locally. Covered in Task2.
2. One uncertain batch alongside another active batch must not claim completion or hide committed cards. Existing309 display regression plus Task2 recovery verification.
3. Whole-response truncation/overflow must never post a prefix; model-complete=true must not substitute for fixture completeness. Covered in Task5.
4. Recording B must not depend on A's inference, cancellation or media cleanup; a slow automation dump must not distort measurements. Covered in Task6.
5. Cancellation/retry after partial commit must preserve receipts and balances, with no cross-owner execution. Covered in Task7.

## Task 1: Reconcile the exact state and recover deployment access

**Files:** Read the handoff, `.github/workflows/backend-foundation.yml`, ignored `.superpowers/sdd/voice-v3-staging-acceptance/acceptance-report.md`, CI evidence and host controls. Append sanitized results to the evidence report; no production code changes.

**Interfaces:** Consumes309 candidate/CI/image and known deployedc6. Produces a fresh SHA/image/APK/policy/quota/queue/lease/reference inventory and verified deployment access, or a precise external blocker.

- [ ] Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git diff 30984cf -- apps supabase docker .github`. Preserve any documentation-only successor and unrelated changes.
- [ ] Inspect `gh run view 37211453396 --repo masarifiratibi-spec/masarifi.ratibi_app --json headSha,status,conclusion,jobs`. Expected exact309 andsuccess. Verify artifact digest5cfbe812... against the downloaded image receipt; do not deploy a moving tag.
- [ ] Read public health and the Supabase policy, v3 inventory, transaction/posting/balance counts, current budget/holds and database size. Expected last snapshot: c6 deployed, gateOFF, zero finances,28provider attempts; discrepancies require reconciliation before work.
- [ ] Diagnose SSH timeout with bounded port/connectivity and existing provider/server status checks. Public API is healthy, so do not call it a general outage. Keep existing host-key verification; do not rotate credentials/open ports. After2–3 failures, change the diagnostic approach or report the access dependency.
- [ ] Verify existing owner pin, references, onboarding state, migration82history/checksums and stopped Worker through available read-only paths. Read queue/backlog/leases; do not claim empty queues or delete pending work.

**Gate:** A signed/checksummed runtime artifact and current safety baseline are identified. Deployment access may remain an external blocker; continue offline Tasks2/5 diagnostic preparation rather than requesting general authorization again.

## Task 2: Make definitive unavailability terminate honestly without losing unknown outcomes

**Files:**

- Existing fix: `apps/mobile/src/features/voice/VoiceBatchStatus.tsx`, `VoiceBatchStatus.test.tsx` — preserve309.
- If the gate-off stall is reproduced: modify `apps/api/src/ai/ai.repository.ts` (`mapped(error: unknown): Error`), `apps/api/src/platform/http/safe-exception.filter.ts`, and `apps/mobile/src/services/live/voice-batch-api-service.ts` (`send`, existing create catch).
- Test: `apps/api/test/integration/ai/voice-batch.spec.ts`, `apps/api/test/unit/http/safe-exception-filter.spec.ts`; create `apps/mobile/src/services/live/voice-batch-unavailable.test.ts` using real journal logic and a real SQLite fixture/native SDK boundaries.
- Read/update OpenAPI contract/error documentation only where its current schema requires the new operational code.

**Interfaces:** SQLgateOFF rejection before create transaction commits → allowlisted503 `{ code: 'VOICE_AUTOMATIC_UNAVAILABLE' }`; Mobile POSTcreate receives that precise code → existing `VoiceBatchRequestRejected` → `VoiceBatchLocalTerminalError('failed')`. Generic503, malformed replies, lost responses and already-created sessions continue existing recovery.

- [ ] Trace and reproduce: SQL `create_voice_session_v3` gate raises before session/context creation; repository transaction rolls back; current mapper/filter returngenericAI_UNAVAILABLE; Mobile marks it uncertain and retries. Also reproduce a generic503/lost create response after a successful create. This second case must stay recoverable.
- [ ] Write RED tests before changing implementation. RealPG gate-off create must return the proposed specific code with no session/context or financial effect. SafeExceptionFilter must preserve only the allowlisted code at503 and never leak SQL details. Mobile tests must assert:

```text
Exact503+VOICE_AUTOMATIC_UNAVAILABLE on POSTcreate:
  runBatch rejects VoiceBatchLocalTerminalError('failed');
  real persisted journal phase=failed, audioReference/createBody/processBody=null;
  recovery reports localFailure, not an endless pending capture;
  no upload/process dispatch occurs.
Generic503 / AI_UNAVAILABLE / invalid JSON / timeout / mismatched status:
  original capture identity, immutable create body and audio remain recoverable;
  never report completed-zero or discard a possibly accepted operation.
Already-created replay while policyOFF:
  authoritative existing create receipt is returned/reconciled, not falsely retired.
Definitive rejection followed by local audio-delete failure:
  persist the terminal failure and clear executable create/process bodies;
  retain audio ownership for cleanup retry;
  direct runBatch/recovery after the service becomes available must not create,
  upload, process or resurrect this failed capture.
```

- [ ] Run API tests against isolated realPG/Supabase migrations; hosted read-only evidence is not a replacement for a new integration regression. Do not change Staging policy for a test. If local Docker is unavailable, use isolated official CI and report skips accurately.
- [ ] Implement only demonstrated boundaries: exact SQLmessage match before generic mapper, one safe public operational error mapping, and an exact503/body-code match **restricted to POST `/api/v1/voice/sessions`** inside the existing bounded request/check-owner flow. Reuse existing terminal phases; other endpoints cannot trigger pre-create retirement. If the cleanup-failure regression fails, make `retireLocal`, the terminal/no-session `submit` guard and cleanup-only `recoverBatches` preserve terminality before media deletion, retaining the audio reference until successful cleanup. Do not add a new financial state/schema or permit that cleanup path to invoke create/upload/process.
- [ ] Parse an error reply within the existing10-second bounded request, recheck owner/epoch afterwards, and treat parsing failures as uncertainty. Do not display the error code or gate internals to the user; use the existing short failure message.
- [ ] Run the new regressions, existing Voice API/journal/recovery/Home/status tests, Mobile typecheck/lint, API typecheck/lint/OpenAPI and relevant security gates. Request independent review of the definitive-vs-unknown distinction.
- [ ] Commit only the proven repair, then run full exact-SHA CI withk6. If reproduction does not establish the proposed guarantee, retain309's conservative behavior and report the finding; do not guess that any503 means no creation.

**Gate:** The original policy-off stall has a truthful failure outcome, genuine unknown outcomes retain identities/recovery, and normal processing/results remain intact. This task does not fix speech accuracy.

## Task 3: Deploy the exact tested immutable candidate to Staging, gateOFF

**Files:** `docker/staging/compose.backend.yml`; create a versioned ignored deployment wrapper/archive/evidence, based on `deploy-c6daa22.sh`. Do not run old1b1/c6wrappers unchanged.

**Interfaces:** Consumes Task1 access/baseline and latest green runtime SHA/image (309 if no Task2 code change). Produces healthy pinned API, same-image Worker created/not-started, idempotently verified migration history and unchanged unrelated runtime configuration.

- [ ] Archive only exact committed deployment files with `git archive`; hash the archive. Pin fullSHA/digest, expected current old release, and env fingerprints. Never build a local dirty image for release.
- [ ] Verify gateOFF, Worker not running, owner admission fail-closed, API loopback and original env fingerprints immediately before deployment. Prepare an exact prior-image rollback wrapper; neither wrapper may enable posting or start a scheduler.
- [ ] Pull the tested digest, run its immutable migrator, start only API and recreate Worker with `--no-start`. Do not recreate Admin or alter onboarding/provider/env budgets. Check compiled module/image labels and API fullreleaseSHA, not an environment variable alone.
- [ ] Repeat migrator idempotency proof: still82history entries and both fixed migration checksums. Check no new finance/context rows. Verify API/ClamAV health, ordinary owner routes and admission filter, then atomically update the release symlink/pins.
- [ ] Record immutable artifact, timestamps, migration output, read-only financial/accounting baseline and rollback availability. Stop on any mismatch; preserve authoritative existing financial receipts.

**Gate:** Hosted Storage repair and Mobile-compatible backend are deployed with automatic financial postingOFF and ordinary Worker paused. No claim of provider/financial/device acceptance.

## Task 4: Reconcile only the two known media references through the purge boundary

**Files:** Versioned ignored recovery context based on `samsung-shadow.cjs`, `lock-shadow-purge.cjs`, `run-shadow-purge.sh`; original manifests/baselines remain immutable. Actual production methods: `AiStorage.delete`, `AiRepository.claimPurges` / `completePurge`, existing Worker purge behavior.

**Interfaces:** Original cancelledAR/EN capture identities and receipts + new tested artifact provenance → exact-object deletion accepted and authoritative media reference cleared once; unrelated due rows unchanged.

- [ ] Prepare a recovery-only context recording `originalCandidate=c6...`, repairSHA/image/module hashes, original capture/StorageRef hashes and baseline fingerprints. Do not replace old baselinecandidate fields, dispatch markers or labels to force an old script through guards.
- [ ] Independently review target selection, no-inference/no-financial capability, bounded foreign-row locking and role restoration. Respect active purge/upload/media capability leases; wait for actual expiry rather than resetting metadata.
- [ ] Reuse the prior lock-only safeguard: bound due set<=40, lock unrelated rows within the short transaction, snapshot before/after; Worker claimslimit1 and asserts exact target/ref. Existing temporary migration-role grant must roll back and restore original membership; no permanent grants or unrelated claims.
- [ ] Invoke actual compiled newAiStorage on the exact already-missing object; accept only the precise verified missing-object response. Complete through `complete_voice_media_purge`, not directSQL nulling or Storage metadata deletion. Repeat separately for the other pinned capture after fresh due/lease checks.
- [ ] Verify target reference cleanup, unchanged unrelated snapshots, original role membership, no new provider attempt, no finances and protected accounting holds/configuration. Keep failed-marker/lease history as provenance; do not erase audit evidence.

**Gate:** Both old samples are operationally reconciled; unknown costs and unrelated media are untouched. Storage defect now has hosted proof.

## Task 5: Diagnose and repair actual bilingual extraction accuracy, bounded and non-posting

**Files:** Read `apps/api/src/ai/voice-batch.ts`, `ai.gateway.ts`, `ai.worker.ts`, `ledger/ledger.dto.ts`; prepare a separately versioned ignored shadow/accuracy helper and operator protocol. Only modify production files after a boundary-specific defect is proved. Tests then belong in existing Voice batch/gateway/Worker suites.

**Interfaces:** Newly consented fictional SamsungM4A + exact production modules/config + transient truth table → per-occurrence presence/field/amount-scale booleans, envelope metadata and real accounting receipt; never persisted raw output or financial proposals.

- [ ] Review historical two failures and independent slot-preservation proof. Test the accuracy comparator offline for reordered events, missing events, legitimate repeats, amount signs/minor-unit scaling, malformed one-item siblings and complete=false/>10. Assert real data, not mocked internal helper calls. No code defect is assumed from opaque failure booleans.
- [ ] Keep automatic gateOFF. Reuse the existing reviewed legacy-carrier shadow for extraction diagnosis rather than inventing an extraction-only product mode. If a temporary carrier APK is needed, verify the existing backup hash/certificate, install in place without clearing data, preserve login/onboarding and restore compatiblev3 immediately after capture preparation. Clearly label evidence `legacyCarrier=true,endToEndV3=false`.
- [ ] Update helper guard/provenance for the newly deployed artifact, preserving old controls. Intercept acceptance before batch/proposal/ledger persistence, keep normal Worker paused, require exactly one pinned claim/dispatch. Prepare actual post-test cancellation and exact media cleanup before asking the user to speak; prove these paths offline first.
- [ ] Add transient diagnostics that distinguish acquisition from model/normalization: M4A byte-size/hash, declared duration versus independently parsed container duration/codec/channel metadata; complete/finish status; provider event count; decoded event count; exact expected occurrence/field checks; amount-equals-expected / expected-major-unit-scale booleans before and after canonical normalization. Persist only bounded metadata/booleans, no raw amounts, transcript, excerpts, candidate strings or reasoning. Do not send audio to another provider.
- [ ] Start with at most **two fresh paid calls**, one at a time. First English focused amount fixture: “I paid twenty-five Saudi riyals for breakfast from cash. I received my five thousand Saudi riyal salary in cash.” Second, only after review, Arabic four-event fixture from the handoff. Fix account/category/date expectations and show test-ready state first; ask the human to confirm actual spoken fixture once. No automatic Retry or reuse of deleted samples.
- [ ] Before each dispatch check owner/session/capture pin, effective provider/prompt/config fingerprints, maxUSD0.1316 reservation and live monthly budget/unknown holds. Record actual input/output tokens, latency/cost, dispatch/receipt count, no-truncation/completeness, cancellation/purge and unchanged financial snapshot. Stop after any mismatch; do not spend the remaining quota blindly.
- [ ] Locate the first failing boundary. For a proved capture/container issue, fix only capture/upload code with a RED regression. For a normalization/scale/comparator issue, fix the deterministic adapter/comparator with bilingual RED fixtures. For correct full audio but wrong provider values/omission, document that evidence and test the smallest justified prompt/representation repair offline before a bounded real confirmation. Do not change model/provider, ten-event maximum, token cap or budget without a separately quantified, evidence-backed need.
- [ ] After repair, require full expected-field agreement on fresh Arabic/English four-event fixtures, then bounded human10-event acceptance per language as budget permits. Existing syntheticcapacity is retained; new device accuracy does not replace overflow rejection. A complete=true result missing a safely supplied expected occurrence fails acceptance.

**Gate:** Cause is evidenced and repaired, fresh bilingual human fixtures agree exactly, media/privacy/accounting clean, no financial effect. If unresolved, report the precise boundary and stop before financial approval; no inference-output confidence waiver.

## Task 6: Install the compatible final Mobile build and prove the real result/recorder path

**Files:** `apps/mobile/eas.json`, runtime/native recorder/journal/status files (read; no arbitrary timing refactor); ignored signed build/timing/device evidence. Existing `app/+native-intent.tsx` and security diagnostic.

**Interfaces:** Latest tested Mobile Git tree + matching internal test signing certificate + deployed compatible backend → physical truthful states, repeat readiness, retained onboarding/v2/security.

- [ ] Build a preview from the exact final runtimeSHA only if installedtree lacks its changes. Pin EAS source/tree/environment/package/certificate/APKhash. If matching test-key re-signing is necessary, verify all non-signature payload entries unchanged; no uninstall/data clear or Production key use.
- [ ] Install in place and verify preserved authenticated owner/onboarding/Home/account fixtures. Under gateOFF, a rejected create must end in the tested short failure state; do not call this successful analysis. Network-unknown case must showChecking, keep recoverable identity, permit recording B and never claim zero additions. Confirm no v3 Review/Confirm UI.
- [ ] Measure fixed-stage opt-in timing: Tap/permission/audio/native preparation/start and Stop/completion/release/durable handoff/Ready. RequireReady<=250ms after release+handoff, no second tap and no unrelated server/cancel/cleanup dependency. Separately report native preparation and upload/claim/provider/finalization/refresh latency; no invented end-to-end SLA.
- [ ] Start recording B while one pinned, nonposting shadow A is demonstrably in actual provider execution; use its dispatch latch/timestamps and a bounded local control capture rather than paid duplication. Label carrier limitations. Repeat the genuinev3→v3 case later in Task7. Include background/foreground, termination/recovery, offline state and stale callback isolation.
- [ ] Avoid UI-idle dumps during active capture; reject stale XML after a failed dump. Preserve real durations. Run actual native-link benign/malformed/Arabic/percent cold/live checks without credential text; rerun the existing decoder and Router regressions if source changed. Preserve legacyv2 completion compatibility.
- [ ] Record exactAPK/certificate/tree, screenshots limited to the test app, timing samples and local/server reconciliation. Independent review must distinguish measured local readiness from completed provider/financial acceptance.

**Gate:** Installed Mobile matches the final candidate; stalled/unknown states are honest, recording readiness is measured and security/onboarding/v2 remain intact. Actual committed-card path still awaits financial approval.

## Task 7: Reach the financial approval boundary; then execute the scoped acceptance matrix

**Files:** Evidence/protocol only unless a real failure proves another defect. Use existing financial functions and normal transaction UI; no general Worker mutation capability.

**Interfaces:** All nonfinancial gates + fresh accounting/fixture/security/rollback baseline + explicit human first-canary approval → at most the pinned owner/capture's authoritative transactions/cards/receipts.

- [ ] Prepare the ten-event English canary in the handoff:10cards,9expense/1income; cash+485000minor,card−32000minor,total+453000minor. Every expected field, not count alone, must match. Max reserveUSD0.1316; before/after ledger versions and exact financial IDs prove effects.
- [ ] Recheck fixtures/defaults/current owner auth, owner ingress/no bypass, policyOFF, fullSHA/image/APK, migrationchecksums, quota/holds/provider accounting, stale/active claims, exact idempotency state and disable control. Queue inventory is not empty: prove selected work is isolated, do not drain backlog.
- [ ] **STOP before enabling automatic posting or the first financial dispatch.** Report the concrete candidate, successful gates, remaining limitations and exact one-recording test. Ask only for the existing explicit first-financial-canary approval; never treat maintenance “Approva” or this handoff as that approval.
- [ ] Only after approval, admit the test owner narrowly and run pinned bounded work. Database policy is global; admission/session inventory and one-shot selection must independently prevent another owner's financial processing. Do not start an ordinary scheduler. Disable/hold immediately on discrepancy.
- [ ] On first success, continue the already-approved bounded Staging matrix: Arabic/English/mixedsafe-unsafe/zero-safe, omitteddefaults versus explicitambiguity, unsupportedrepayment no card/draft, intentionalidenticalpurchases, duplicateWorker/Mobile identities, droppedresponses, partial crash without newinference, cancellation races, apprestart/background and A/Brealv3 recordings. Per-item postings/balances/audit/outbox/receipts must be atomic; committedsiblings remain; unsafeitems have no effects or retained content.
- [ ] Inspect public responses, logs/export/notifications and command cleanup for privacy; cross-owner/RBAC rejection must produce no dispatch or finances. Use receipt reconciliation for unknown outcomes. Corrections are ordinary audited edits/removals, never erased financial history or newinference on accepted work.

**Gate:** Financial matrix passes under bounded Staging scope, or the exact failure remains visible. No Production or final integration is authorized by this plan.

## Task 8: Final independent review and release report

**Files:** Update `docs/handoffs/2026-10-04-voice-v3-processing-repair.md`, `docs/voice-v3-implementation.md` pointers and the ignored acceptance report with current evidence. Store new artifacts under clearly versioned private paths.

- [ ] For each runtime commit run focused meaningful regressions, then full exact-SHA CI withk6, immutable image/container/security/migration gates and required compatible Mobile build. Do not use1b1/309 greenCI as proof of later code. Preserve all real skips, warnings and inherited dependency exposure.
- [ ] Independently review changed boundaries and the whole final diff against the accepted baseline; no broad refactor/model/dependency churn. Verify reviewer claims against files/tests/live receipts.
- [ ] Produce one English report with exactSHA/image/APK/signature/build/tree, migration history/checksums, CI links/counts, provider/accounting receipts/cumulative costs, no-finance nonposting proof, Samsung stage timings, per-item card/transaction/posting counts, balances, idempotency/cancellation/recovery, privacy/security/onboarding/v2 and unresolved blockers.
- [ ] State exactly whether long processing is fixed on the installed build, whether human accuracy passed, whether financial acceptance ran and whether normal Worker capacity remains a separate gate. Stop before Production/final integration; preserve rollback/disable controls and committed receipts.

## First execution commands (PowerShell, read-only)

```powershell
Set-Location -LiteralPath 'C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final'
git status --short
git branch --show-current
git rev-parse HEAD
git diff 30984cf -- apps supabase docker .github
gh run view 37211453396 --repo masarifiratibi-spec/masarifi.ratibi_app --json headSha,status,conclusion,jobs
Invoke-RestMethod -Uri 'https://api.staging.masarifiratibi.com/health/live' -TimeoutSec 10
C:/platform-tools/platform-tools/adb.exe devices -l
```

For later source changes, from `apps/mobile` run `node node_modules/jest/bin/jest.js --runInBand --forceExit` and `npm run typecheck`; forceExit is an inherited CI behavior, not permission to hide failures. From `apps/api` use the actual package scripts and real isolated DB configuration; absent local DB produces skips, not release proof. Dispatch fresh fullCI with explicitrepository/ref andrun_k6=true, verify returnedheadSHA, retrieve exactartifact, and independently review before deployment.

## Plan self-review

- Contract, ten-event/provider/privacy/ledger invariants are carried by the handoff and global constraints.
- Task2 owns definitive-versus-unknown result semantics; Tasks3–4 own immutable deployment/purge; Task5 owns evidence-based accuracy; Task6 owns physical/UI readiness; Task7 owns approval/financial correctness.
- No operation relies on equality-based transaction deduplication, an empty global queue, a fabricated result or a permanently privileged Worker.
- Operational tasks validate existing behavior; only demonstrated defects receive TDD code changes. No tests are required for this human-readable documentation itself.
- No new general approval round is introduced. Human speech is requested only after test preparation; first financial approval remains the existing explicit boundary.
