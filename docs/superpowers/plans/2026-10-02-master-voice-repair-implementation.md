# Masarifi Voice — local implementation and release evidence

Date: 2026-10-02, Asia/Riyadh. Implementation authorized by the user's “PLEASE IMPLEMENT THIS PLAN” request.

**Status: local repairs implemented and verified; release and physical acceptance pending. The historical Vertex HTTP 400 remains unresolved.**

Branch: `codex/master-voice-repair`. Implementation baseline: `eae3ecbcf9bdfbdbf846df109f2e5319abe5d63e`. The candidate is the commit containing this document.

Workspace: `C:/Users/DELL/.codex/worktrees/master-voice-repair/MASREFY _Final`.

Specification: [Master Repair Plan](2026-10-01-master-voice-repair-plan.md). Its original analysis-era approval/status wording is preserved as historical evidence; the subsequent implementation request authorized this local phase. Existing handoffs and attachments were not altered.

## Outcome and limits

The client now has one application runtime, one serialized native recorder, explicit asynchronous ownership fences and durable owner-scoped transport/confirmation identity. The server enforces upload, cancellation, Worker claims, integrity and bounded provider attempts. Confirmation uses the existing ledger and reconciles an authoritative execution receipt after response loss or bookkeeping failure.

The real SQL/API/Worker/gateway request/response/Mobile-parser/ledger path passes offline Arabic expense and English income journeys, including cancellation and exactly-once confirmation. **The upstream is fake.** The synthetic M4A fixture establishes the application contract and Worker gate, not playable audio, successful Gemini inference or Samsung behavior.

No production deployment, CI dispatch, APK build/install, physical recording, upstream inference, credential rotation, budget increase or model/provider substitution was performed. Fictional transactions exist only in disposable local test databases.

## Implemented tasks

| Task | Concrete implementation                                                                                                                                                                                                                                                                                     | Main behavioral evidence                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T00  | Preserved plan/evidence; isolated implementation worktree; controlled native/transport promises and events; real database and ledger fixtures.                                                                                                                                                              | Baseline 96 Mobile and 16 API checks; first-tap, allocation, preparation cleanup and session projection failures reproduced before repair.                                                                        |
| T01  | Exact public session projection; version-2 create/confirm contracts; capture timestamp/offset; separate PROCESS identity; explicit recovery/result projection.                                                                                                                                              | Actual service serialization passes Mobile's strict Zod schemas; SQL Worker input uses the reservation's PROCESS operation.                                                                                       |
| T02  | Adapter exclusivity before awaits; native events before preparation; HIGH_QUALITY/M4A retained; native 60-second limit; bounded preparation/terminal waits; one Stop/Cancel terminal promise; native duration and file validity; cleanup on failure/late completion.                                        | Concurrent Start, prepare failure/timeout, Start no-op, resolved Stop with native error, delayed terminal events and repeated/overlapping terminal commands. Physical behavior remains a gate.                    |
| T03  | Root-mounted VoiceCaptureProvider; views consume its commands; owner/attempt/revision fences; same-tap permission continuation; capture cancellation on lifecycle interruption; no per-view global cleanup.                                                                                                 | Hook/Home/installed navigator regressions; stale Start/poll fencing; microphone release before failed server Cancel; owner change/session expiry clears private review state immediately.                         |
| T04  | Authenticated immutable audio PUT; owner/deadline/MIME/declared and actual length/hash checks; server cancellation; Worker fencing; retained media references/tombstones for late legacy uploads and deletion retries.                                                                                      | Wrong owner rejected before consuming body; identical replay; mismatched bytes; cancelled work; expired work; purge backoff/capability lifetime. Lost SQL upload acknowledgement retains accepted media.          |
| T05  | SQLCipher v14 operation journal via existing database/key/transaction helpers; stable create/process/cancel keys before dispatch; bounded identity/token/network work; owner-scoped CAS cleanup; same-operation recovery/retry.                                                                             | Real Node SQLite CAS/isolation checks; lost create/process/confirm response cases; delayed owner/token; identity acquisition timeout; saved-journal discard performs no server cancellation.                      |
| T06  | Claims limited to available concurrency; active lease renewal and complete fences; governed total inference timeout replaces false three-second header deadline; download deadline includes body; downloaded length/hash verified before dispatch.                                                          | Real database reclaim/fencing/expiry; stalled body cancellation; healthy slow response; already-aborted dispatch; media integrity rejection.                                                                      |
| T07  | Durable max-two attempt ledger under PROCESS identity; authorization before each dispatch; existing workload/global budget gates; one quota event; usage before content parsing; conservative unknown-outcome holds; no blind redispatch after unknown dispatch.                                            | Actual SQL dispatch cap across reclaim, changed-policy rejection, global budget exhaustion before fallback, failed/billable usage and unknown reservation retention.                                              |
| T08  | Exact-envelope offline assertions; capture reference date/offset in context; bounded structural diagnostics; refusal/truncation/error envelope rejection; existing governed model/provider/privacy/schema retained.                                                                                         | Fake gateway request verifies model/provider-only routing, no implicit fallback, ZDR, no training, strict schema, output limit and M4A payload. **Exact Vertex 400 field-level repair remains pending evidence.** |
| T09  | Supported live expense/income only; nullable merchant/note; optional income category; editable date/note; real transcript language; ambiguity requires account confirmation; incompatible selections cleared; unsupported promises hidden.                                                                  | Domain/component/mapping tests for optional values, category/type changes and live controls. No automatic financial save.                                                                                         |
| T10  | Reviewed local calendar day and actual offset; canonical normalized ledger command before claim; safe money/date/text/reference checks; expense category required at both API and SQL confirmation boundaries.                                                                                              | Riyadh-before-noon normalization, invalid calendar/future time/safe integer/control text/reference tests; actual ledger integration and expense rejection before claim mutation.                                  |
| T11  | Encrypted exact authorized request/key/version before POST; immutable decision identity; active lease cannot be stolen; expired lease resumes stored ledger key; receipt validates ownership/source/identity; proposal/session completion; legacy receipt reconciliation; Saved survives ancillary failure. | Real ledger exactly once/replay, active lease, commit then completion failure, altered payload rejection, legacy receipt recovery, local restart/response-loss replay, definitive rejection returns to review.    |
| T12  | Integrated offline AR expense cancel, AR expense confirm and EN income confirm; real SQL/Storage boundary orchestration with fake object transport/upstream; actual Mobile parsers and ledger; bounded safe diagnostics and release evidence.                                                               | Arabic cancellation has no mutation; expense/income produce correct signed balance effects; confirmation replay returns same resource; one quota event per processed session.                                     |

Primary modules:

- Mobile: `features/voice/VoiceCaptureRuntime.tsx`, `useVoiceCapture.ts`, `VoiceReview.tsx`, `VoiceCaptureScreen.tsx`, `features/home/HomeSummary.tsx`, `state/voice-capture.ts`, `services/platform/voice-recorder-service.ts`, `services/live/voice-api-service.ts`, `voice-api-contract.ts`, `storage/voice-pending-session.ts`, `storage/database.ts`, root layout.
- API/Worker: existing `src/ai/ai.{controller,dto,service,repository,gateway,storage,worker}.ts`, scoped abort helper, existing HTTP validation and logger.
- Database: forward migration `20261001211129_master_voice_repair.sql`; checksum manifest updated. Existing applied migrations and ledger implementation were preserved.

## Final review corrections

One independent read-only final reviewer inspected the complete change. No critical issue was identified. Its expiry-column typo and missing Arabic expense journey were corrected and tested. Other identified issues were repaired during review: accepted media deletion after lost SQL acknowledgement, microphone cleanup ordering, definitive confirmation rejection recovery, Home processing Cancel, stale post-confirm side effects, global fallback budget enforcement and legacy receipt recovery.

Subsequent executor checks found and repaired:

- expiry must clear claimant, token and lease together, while respecting the existing failure-code/status constraint;
- the migration must restore/revoke its temporary role before the real migration runner records history;
- startup recovery must run for the authenticated owner from idle Home, without waiting for microphone permission;
- identity acquisition must have a deadline;
- identity/session-status changes must immediately conceal previous Voice review data;
- live expense confirmation must require a category at both API and SQL boundaries.

The startup and owner-review regressions were observed RED, then GREEN. The uncategorized expense RED check did not throw before the repair. The accepted-upload acknowledgement regression also reproduced deletion before its correction.

## Verification receipts

| Gate                            | Result and scope                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Mobile suite               | **453 suites / 2,500 tests passed** at the broad integrated snapshot. Subsequent startup/owner/deadline changes were verified with affected suites below.                                                |
| Final targeted Voice            | **6 suites / 71 tests passed**, including final runtime, native recorder, live transport, owner fences, privacy and encrypted journal checks. Used `--detectOpenHandles`; clean process exit.            |
| Final Mobile shell/auth/Home    | **6 suites / 121 tests passed**, including installed navigator bootstrap, protected navigation, Home, recorder screen and Clerk bridge.                                                                  |
| Full API unit/contract/security | **248 suites / 1,394 tests passed**; 1 suite / 8 tests skipped by existing prerequisites. Subsequent category-boundary change passed 21 affected unit tests.                                             |
| Real database broad gate        | **33 suites / 116 tests passed**, 1 suite / 4 tests skipped by existing prerequisites. Included AI, Assistant, budgets/quota, privacy, restricted availability role, ledger and security integrations.   |
| Final financial boundary        | **5 tests passed** against the final forward migration, including SQL category guard and real legacy receipt recovery. Final identity/journey suites additionally passed **14 tests** on that migration. |
| Real migration runner           | **3 tests passed**: forward apply/idempotency/exact inventory, checksum tamper rejection and concurrent migration lock.                                                                                  |
| Types/lint                      | API and Mobile TypeScript checks passed; API lint passed. Mobile lint has zero errors and existing/test import warnings; final changed production runtime/transport lint passed without warnings.        |
| Frontend boundaries             | Complete `npm run check:frontend-quality` passed. No changes to Clerk/bootstrap/router gating or encryption-key creation.                                                                                |
| Git/format                      | Changed TypeScript/TSX/YAML formatted; `git diff --check` passed; migration checksums verified.                                                                                                          |

The full Mobile/shell runs used `--forceExit` because the installed Clerk library opens a Jest MessagePort. The same handle was independently reproduced on the untouched baseline's RootLayoutOptions test (5 passed tests); it is not evidence of a new Voice timer leak. Final targeted Voice checks exited normally with open-handle detection.

Expected error logs from ledger fault-injection tests are not failures. No skipped test is counted as passing.

Database environment: disposable loopback PostgreSQL 18.6 at port 54432 with pinned PGMQ 1.13.0 (source SHA `32c075bb6dbed66a303d1a792393c93e36c09a97`). All repository migrations applied; API and Worker RPCs used their actual restricted roles. Supabase Storage's metadata schema was present, but its HTTP transport was mocked. Docker/Supabase Storage HTTP integration was unavailable locally. This limitation must be closed before release.

Local raw receipts are retained in the ignored `.superpowers/sdd/2026-10-01-master-voice-repair-plan/` directory; that directory and local test databases are not production artifacts or CI evidence.

## Reproduction commands

Run from the respective application directory using installed Node 24 dependencies. Unit/contract/security tests use fake upstreams. Do not provide OpenRouter credentials to any local test.

Mobile:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
npm run check:frontend-quality
node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --runTestsByPath src/features/voice/useVoiceCapture.test.tsx src/features/voice/voice-privacy.test.tsx src/services/live/voice-api-service.test.ts src/services/live/voice-transport-recovery.test.ts src/services/platform/voice-recorder-service.test.ts src/storage/voice-operation-journal.test.ts
node node_modules/jest/bin/jest.js --runInBand --forceExit
```

API:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node node_modules/ts-node/dist/bin.js src/platform/database/migration-checksums.ts
node node_modules/jest/bin/jest.js --selectProjects unit contract security --runInBand
```

Real database gates require a separately provisioned disposable local database with all migrations and PGMQ. Set `MASARIFI_LIVE_DATABASE_TESTS=1` and a verified loopback-only `DATABASE_URL`. Never point these fixture-writing tests at Staging or Production.

```powershell
if (([Uri]$env:DATABASE_URL).Host -notin @('127.0.0.1','localhost')) { throw 'Disposable loopback database required' }
$env:MASARIFI_LIVE_DATABASE_TESTS='1'
$taskFiles=@(rg --files test/integration/ai; rg --files test/integration/ledger; rg --files test/integration/security)
node node_modules/jest/bin/jest.js --selectProjects integration --runInBand --runTestsByPath $taskFiles
node node_modules/jest/bin/jest.js --selectProjects e2e --runInBand --runTestsByPath test/e2e/migration-apply.e2e-spec.ts test/e2e/migration-checksum.e2e-spec.ts test/e2e/migration-concurrency.e2e-spec.ts
```

Use explicit test paths. Do not use `--testPathPatterns=ai` in a checkout named `master-voice-repair`: “repair” contains “ai”, causing that filter to select unrelated paths.

## Release gates — not executed

1. **Checkpoint A:** local implementation checks above pass. Close real Supabase Storage HTTP coverage and any environment-dependent skipped prerequisites before declaring the complete release gate passed. Exact Vertex field-level uncertainty remains explicit.
2. **Checkpoint B:** obtain release authorization; review one candidate SHA; required exact-SHA CI; one backend/migration release and one compatible APK. Verify digests, signature/hash, migration version and unchanged route/privacy/budget configuration. No diagnostic deployment series.
3. **Checkpoint C:** separately approved real Samsung lifecycle tests, Cancel before upload; prove no session/reservation/inference. Permission dialog, immediate Stop, overlap, background, lock, contention and native duration cap remain physically unverified.
4. **Checkpoint D:** separately approved bounded provider canary after fresh quota/policy preflight. Keep existing provider/model/ZDR/no-training/schema/budgets. Stop at the first failed boundary. Repeat opaque Vertex 400 means stop paid testing and obtain a content-free provider trace; do not guess schema/MIME changes or switch providers.
5. **Checkpoint E:** bounded approved AR/EN acceptance from the Master Plan, normally four successful processing sessions with the canary counted once. New fictional physical financial confirmations require explicit authorization. Verify cancellation has no mutation, confirmation exactly once, correct balance/history, morning Riyadh date and restart persistence.

Current Vertex diagnostics are an investigation tool, not a demonstrated fix. Neither offline green checks nor the historical CI/APK prove these release gates.

## Rollback and safety

- Forward additive migration; preserve operation/attempt/decision records and media tombstones.
- Contain a release blocker by disabling Voice only under release authorization. Keep unrelated application functionality intact.
- Do not process new unresolved decisions using the old backend/APK semantics.
- Preserve unknown cost holds; never raise budgets or count a reservation as a charge.
- Preserve unresolved encrypted confirmation journals and authoritative ledger receipts.
- Never delete/reverse a valid financial transaction as cleanup.
- Keep existing authentication, profile/bootstrap, SQLCipher keys, app lock, RBAC, ledger and Assistant protections.
- Production remains out of scope.

**No physical acceptance checkbox has been marked complete. This document closes local implementation work, not release approval or the unresolved provider defect.**
