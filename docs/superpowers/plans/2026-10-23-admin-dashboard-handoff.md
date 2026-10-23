# Admin Dashboard Recovery — Continuation Handoff

Prepared on 2026-10-23 (Asia/Riyadh) at the user's request to continue in a new chat.

## Objective and authorization

Continue IMPLEMENTING the approved comprehensive Masarifi Admin Dashboard recovery plan. This is an implementation task, not a new audit or planning exercise. Finish the remaining tasks, test and independently review them. The user explicitly requested Superpowers and approved the implementation plan; do not ask again whether to continue.

- **Worktree:** `D:/Masarifi-integration-2026-10-10`
- **Branch:** `codex/voice-promoted-operating-2026-10-13`
- **Current HEAD:** `9a6ce6e78aafd8a60a82ed8e2db1c222c5fa0cb5`
- **Original implementation baseline:** `5781c488`
- The environment may initially point to `D:/MY Work/0Part_Time/MASREFY _Final`. Do not work there; pass the correct workdir explicitly.
- PowerShell on Windows. Local implementation/tests/commits are authorized. No deployment, hosted migrations, shared-provider/customer mutations or physical-device writes have been performed or authorized by this implementation scope.
- Preserve financial posting, Voice, recent-primary-login policy, exact permissions and expiring audited customer support-access grants. Paid billing and advanced marketing remain deferred.

## Read these first; do not restart completed work

All paths below are relative to the worktree unless stated otherwise.

1. Tracked approved implementation plan: `docs/superpowers/plans/2026-10-23-admin-dashboard-recovery.md`.
2. Durable ledger: `.superpowers/sdd/2026-10-23-admin-dashboard-recovery/progress.md`.
3. Shared execution/DB context: `.superpowers/sdd/2026-10-23-admin-dashboard-recovery/implementation-context.md`.
4. Current requirements: `.superpowers/sdd/2026-10-23-admin-dashboard-recovery/task-2-brief.md`.
5. `apps/admin-web/AGENTS.md` and relevant bundled Next.js docs before frontend edits.

The ignored SDD workspace holds briefs, reports, review packages, test receipts, database scripts/data and Staging baseline evidence. **Do not run git clean -fdx, delete that workspace, reset the checkout, or discard the current uncommitted changes.** This handoff and the plan are tracked documents; important execution evidence is still in ignored scratch.

## Progress

| Task | Status |
|---|---|
|1. Truthful overview, real mobile activity, correct reports/exports|COMPLETE and independently accepted at `9a6ce6e7`|
|2. Safe governance, security idempotency/live wiring, truthful operations|PARTIALLY IMPLEMENTED, UNCOMMITTED, NOT REVIEWED; resume here|
|3. AI/import filters, pagination, parser revisions, prompt tests|Not dispatched|
|4. Essential live customer users/devices/sessions/lifecycle|Not dispatched|
|5. Admin/mobile support conversation and attachments|Not dispatched|
|6. Shell/navigation/responsive/accessibility/integration/evidence|Not dispatched|

Task briefs 1–6 already exist in the SDD workspace. Do not narrow the full approved scope to only Task1 or Task2.

## Task1: accepted implementation and evidence

Commits:

- `b45625d3`: approved implementation plan.
- `7e56a8e7`: isolated database verification documentation.
- `93d1a8e3`: measured activity and truthful report exports.
- `5f921f90`: Task1 verification documentation.
- `9a6ce6e7`: fixes to export observation/local-date/OpenAPI contracts after independent review.

Task1 removed fabricated overview values/ratios/freshness, introduced explicit null/unavailable/partial measurement metadata and authoritative customer/device/import/AI/support counts. It added coarse authenticated native-mobile-only activity with deduplication, collection-start boundaries, reporting timezone, rolling-30-day membership and retention. It repaired dataset-specific CSVs, currency handling, exact granted financial read ranges and audit action classification. No financial posting or Voice behavior changed.

Two additive Task1 migrations:

- `supabase/migrations/20261023095047_admin_report_measurements.sql`
- `supabase/migrations/20261023104253_admin_export_observation_bounds.sql`

Independent review initially found four P2 gaps, ALL now fixed and accepted:

1. Mobile activity endpoint has explicit stable OpenAPI operation/security/strict-body/response documentation.
2. Partial monthly activity history remains partial in export snapshot and CSV metadata.
3. Activity export uses one bounded consistent observation instead of independent offset snapshots.
4. Relative support report dates derive in the authorized target customer's timezone and return actual bounds.

Evidence in SDD workspace:

- `task-1-report.md` (including appended fix report).
- `task-1-review.md` (original findings).
- `task-1-fix1-review.md` (**SPEC PASS / QUALITY PASS**, all four addressed, no new important breakage).
- Final reports/OpenAPI gate: **36 suites / 190 tests passed**.
- Full Admin before backend-only fix round: **91 files / 953 tests passed**.
- Focused Mobile: **2 suites / 18 tests passed**.
- API/Admin/Mobile TypeScript passed; changed-file lint and migration checksums passed. Existing mobile AppShell cleanup-ref lint warning is documented.
- Controller independently applied finalized sources to fresh and historical-upgrade disposable databases: **15/15 measurement/export integration tests on EACH**, both at 152 migrations. Receipts `task-1-fix1-{fresh,upgrade}-tests.{json,log}`.
- These are genuine native PostgreSQL18 tests, not Supabase17/provider/hosted acceptance.

## Task2: exact current state

The original worker was `/root/implement_admin_governance`, isolated context, Astra/high. A user/tool interruption occurred. At handoff, `interrupt_agent` returned **not_found**; the old worker cannot be assumed resumable from the new chat. No new worker should run concurrently with an old one. Inspect available agents, preserve edits, and dispatch a replacement only after confirming no active implementer. A replacement must continue the current diff, not restart Task2.

There is **no Task2 report/commit yet**. HEAD remains `9a6ce6e7`. Latest worker-reported signals (not final acceptance):

- Real DB concurrent replay cases for incidents/support access/roles: 4/4 GREEN.
- Admin Feature Flag/API-monitoring regressions: 30/30 GREEN.
- Bounded governance/provider pagination replacing fetch-all was being implemented.
- Three real DB health/current-maintenance regressions were RED; implementation was written, GREEN not yet reported.
- Live security nullable contracts/views and provider-outcome receipts were still unfinished.

Uncommitted tracked files at handoff:

```text
apps/admin-web/src/features/governance/SettingsViews.tsx
apps/admin-web/src/features/governance/repository.test.ts
apps/admin-web/src/features/governance/repository.ts
apps/admin-web/src/features/system-health/repository.test.ts
apps/admin-web/src/features/system-health/repository.ts
apps/api/specs/013-performance-caching-observability-operations/contracts/openapi.yaml
apps/api/src/operations/operations.schemas.ts
apps/api/src/security/security.repository.ts
apps/api/src/security/security.service.ts
```

Untracked Task2 files to PRESERVE:

```text
apps/api/test/integration/operations/operations-recovery.integration.spec.ts
apps/api/test/integration/security/security-replay.integration.spec.ts
supabase/migrations/20261023110600_admin_security_replay_operations_recovery.sql
supabase/migrations/20261023111132_admin_operations_truthful_bounded_reads.sql
supabase/migrations/20261023111444_admin_security_provider_outcome_receipts.sql
```

At handoff the first two candidate migrations are 7,678 and 16,631 bytes. **The provider-outcome migration is EMPTY (0 bytes), CLI-created but unfinished. Do not apply/record an empty migration.** The apply script rejects empty candidates. Check actual database history before deciding which Task2 candidates are pending; no final source-replay proof exists for Task2.

### Binding Task2 controller rulings (also in ledger)

**Security idempotency admission:** The generic `private.claim_idempotency_key` intentionally rejects Admin with FINANCIAL_ACCESS_DENIED. The tracking helper only allows tracking/admin/parser operations. Add a security-only claim/complete wrapper over the existing durable table/lease algorithm, with explicit security-operation → canonical permission allowlist, authenticated principal scope and API-role-only execution. Preserve existing financial/tracking helper behavior and raw-table denial. Test denied/unknown operation, equal concurrent replay, changed-payload conflict and original result replay. One pure support-scope validation function needed a targeted API execute grant; review that narrowly.

**Post-commit Clerk effects:** Existing `security.service.ts` creates invitation token material before repository mutation, then delivers after commit; session revocation/disable effects also happen after commit. DB replay alone cannot claim provider success. A MINIMAL durable provider-outcome receipt is within Task2 scope; a new general delivery platform is not required:

- Persist pending before effect, completed with original SAFE public result after success, failed/uncertain on failure.
- Completed equal replay returns original result without another provider call or new token.
- Failed/uncertain replay reports explicit provider-unavailable/pending; never fake success.
- Invitation raw token stays process-local; do not persist/log/expose it or deliver a different token on ambiguous replay.
- `revokeAll` replay must not revoke sessions created after the original command.
- Local disable remains authoritative; expose pending/failed provider revocation instead of swallowing failure.
- Reuse an existing suitable outbox handler if present. A crash gap between external effect and receipt must be truthful pending recovery, not an unsupported exactly-once claim. Test lost-response-after-completion, uncertain failure and payload mismatch.
- Hash actual user-command semantics before random/server enrichment; include principal+operation+meaningful payload. Do not let generated tokenHash produce false idempotency mismatch.

Complete the entire Task2 brief: Feature Flag audience/platform safety (restricted never default-enabled), real security/privacy/support-access/audit wiring, unknown/stale health, separate HTTP/job telemetry, direct current maintenance lookup and working job pagination. Customer user APIs belong to Task4.

## Isolated database — currently STOPPED

At handoff `pg_ctl status` reports **no server running** after interruption. Do not assume a product failure. Restart ONLY this owned cluster when needed:

- Binaries: `C:/Program Files/PostgreSQL/18/bin`.
- Data directory: `D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-23-admin-dashboard-recovery/native-db/data`.
- Bind: `127.0.0.1:55442`, user postgres, trust-auth isolated test data.
- Main connection: `postgresql://postgres@127.0.0.1:55442/postgres`.
- Existing Windows PostgreSQL on **5432** reports recovery mode and is NOT our test target. Do not modify/start/reset it.
- Docker Desktop startup failed on its existing `sailor-ingest.sock`; do not factory reset/delete Docker data to repair this task.

Start pg_ctl through hidden Start-Process per Windows rule, passing the exact data directory and `native-db/postgres.log`. Verify `SHOW data_directory` and port55442. Avoid PowerShell `Start-Process -Wait` on pg_ctl start: it may wait indefinitely for the server descendant even after ready. Prior unified exec13574 may have been terminated by interruption; do not rely on its lifetime.

Native cluster uses plan-local official SQL-only PGMQ1.4.4 and pgTAP1.3.3, minimal Supabase storage-table fixtures, real app migrations/roles/RLS/transactions. It does not simulate Storage HTTP, Clerk, provider integrations or target Supabase PostgreSQL17.

Scripts under `native-db`:

- `apply.cjs`: apply pending NONEMPTY source migrations, normalize CRLF, transaction each; records history. Run from repo root. Optional `MASARIFI_NATIVE_TEST_DATABASE=admin_recovery_fresh` or `admin_recovery_upgrade` (guarded names, fixed55442).
- `test-rls.cjs [filename substrings]`: actual SQL pgTAP suites, TAP failure detection.
- `README.md`, bootstrap files, baseline dump and receipts.

Historical baseline is **150** migrations. The archive `baseline-151.dump` includes an initially empty scratch history row for Task1 candidate20261023095047 but not that candidate's schema. Do not mistake this for source replay. The controller separately proved actual finalized Task1 fresh/upgrade behavior. Read ledger/native README for restore caveats before rebuilding: PGMQ extension-owned queue tables are omitted by dump; filtered ACL TOC + actual pgmq.create + exact grants were needed. Do not delete/recreate any database outside the fixed named disposable databases and verified owned data directory.

Some broad baseline SQL tests already fail due to obsolete inactive-profile fixtures/security/financial expectations. Do not weaken production policies to satisfy those old tests. Separate pre-existing failures from new regressions.

## Test and workflow rules

The explicitly invoked Superpowers SDD workflow is already in progress. Skill root:
`C:/Users/DELL/.codex/plugins/cache/openai-curated-remote/superpowers/7.0.1/skills`.

- Read SDD `references/resuming.md` and the ledger. **One implementation agent at a time**, then independent task review, fix loop, then next task. No parallel implementation agents; workers do not spawn reviewers/helpers.
- Meaningful TDD before behavior fixes; real DB tests for SQL. Each report records exact RED/GREEN commands/output, files, commits and limitations. Controller reviews rather than editing product code itself.
- Model choices per skill: isolated context (`fork_turns:none`) and explicit model. Tasks with broad security/integration judgment have used Astra/high. No need for new user-owned sidebar chats for subtasks.
- Admin tests MUST use direct Node from apps/admin-web:
  `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism`
  Installed npm11 can swallow flags through npm test. Default parallel tests previously exhausted memory. One heavy suite at a time.
- API Jest from apps/api: `node node_modules/jest/bin/jest.js --selectProjects unit contract integration security --runInBand --testPathPatterns='relevant-pattern'`.
- Live DB tests: process env `MASARIFI_LIVE_DATABASE_TESTS=1` and correct `DATABASE_URL`. No credentials in tracked files.
- Update/validate checksums using existing `npm run migration:checksums:update` / `npm run migration:checksums` from apps/api. New endpoints/changed contracts must pass OpenAPI drift.
- Git Bash scripts must use `C:/Program Files/Git/bin/bash.exe`, not WSL bash. SDD `review-package PLAN BASE HEAD` produces ignored diff package.
- Task2 review base is `9a6ce6e7`. Commit only completed own files after checks; no blanket commit of incomplete migration.
- Before each fix wave read SDD `references/fix-loop.md`: original implementer rounds1–3, complete findings, appended test evidence, scoped re-review. At most5 rounds, ledger rulings/deferred minors.
- Final review covers whole implementation range `5781c488..FINAL_HEAD`, not merge-base with earlier unrelated branch history. Use capable independent reviewer, consolidated fix wave and scoped re-review. Only finish branch after all tasks and available gates pass.
- Communicate concisely in Arabic to user; no repeated permission question for approved work. Current request is a handoff, so no additional implementation should be started in this old chat.

## Authenticated Staging browser now WORKS — baseline only

Earlier CUA initialization/Cloudflare access failed, but a tool update fixed connection. Authenticated existing Chrome profile `masarifi.ratibi` successfully opened the deployed baseline without entering credentials or solving CAPTCHA. **Do not describe authenticated Staging as permanently blocked.** This branch has not been deployed, so baseline access is not candidate acceptance.

- Dashboard: `https://staging.masarifiratibi.com/admin`.
- API health: `https://api.staging.masarifiratibi.com/health/live` returned200 in prior audit.
- CUA browserID3, old agent tab415604986. Handles/IDs may expire across chats; get fresh inventory, follow current CUA docs. Native app APIs disabled.
- Existing tab was marked handoff. Do not extract tokens, credentials or private financial content. Read-only QA only.
- Baseline overview: main metric/subscription/health regions fail to load; partial platform/recent activity data renders; stale experimental-data wording; Production badge incorrectly shown on Staging.
- AI baseline: changing30d→7d changed scope label while displayed77/5 counts remained unchanged. This UI alone does not prove wrong database contents; seeded Task3 tests must verify filtering.
- Support baseline: filters plus header-only table, no rows or explicit empty/error state. No server-count assertion and no real ticket mutation attempted.
- Mobile390x844 drawer: focus stayed on external opener, Tab went to Change Language behind overlay, no modal dialog and main not inert; environment absent on mobile. Closed drawer and RESET viewport afterward.
- Evidence: `staging-baseline-observation.md`, `staging-support-baseline.png`, `staging-drawer-390-baseline.png` in SDD workspace.

## Next actions for the new chat

1. Confirm exact branch/HEAD/current diff, read ledger and Task2 brief/context. Preserve all WIP.
2. Confirm no old implementation agent is active. Resume or replace Task2 implementer carrying its current diff, brief and rulings. It must first inspect work already present and finish the empty provider receipt migration, remaining live security wiring and validation. Do not redo Task1.
3. Start only the isolated55442 test cluster if needed; verify exact data directory. Check which Task2 migrations actually applied before replay. Reject empty candidate.
4. Finish Task2 RED/GREEN, correct contracts/checksums/types/lint, write task-2-report.md, commit, then independent review of9a6ce6e7..Task2HEAD and fix loop.
5. Execute Tasks3–6 sequentially with review gates; use existing briefs. Carry any shared interfaces/decisions to the next task.
6. Final source fresh/upgrade/RLS checks, full appropriate API/Admin/Mobile/build/browser journeys, page→API→source capability matrix and prioritized repaired findings. Compare deployed candidate only after separately authorized deployment; preserve honest external acceptance gates.

**Do not claim the whole plan is complete. Only Task1 is accepted. Task2 is incomplete and uncommitted.**

## Continuation checkpoint — WIP publication (2026-10-23)

The user explicitly requested publishing the five completed local commits through `9a6ce6e7`, then saving and publishing all current tracked/untracked product changes as a WIP commit on the same branch. This checkpoint does not accept Task 2 as complete.

- Task 1 remains complete and independently accepted. Tasks 3–6 remain outstanding.
- Task 2 remains incomplete, without a final report, final checks, or independent task review. Preserve and resume the WIP rather than restart it.
- The isolated PostgreSQL cluster was restarted and verified at the exact plan-local data directory, port 55442. The scratch database now records 155 migrations. Recheck running status after interruptions.
- The provider-outcome migration `20261023111444_admin_security_provider_outcome_receipts.sql` is now nonempty and was applied to the scratch database. The earlier EMPTY warning describes the old handoff state only. Final source fresh/upgrade verification remains outstanding.
- Implementer reported expanded provider/replay tests 10/10 GREEN on real native PostgreSQL with mocked Clerk. Operations recovery 3/3 GREEN. New bounded privacy/deletion/retention detail tests and Admin live-repository wiring tests were RED before implementation; final GREEN evidence for the latest WIP is not established.
- Latest changes include nullable live security contracts, audit/privacy/security views, bounded repository wiring and operations UI/tests. No claim that all these changes pass final verification.
- The replacement implementer `/root/resume_admin_governance` stopped on a usage-limit error. No active implementer should be assumed. Resume using the existing ledger/briefs/rulings and independent review gates.
- Ignored SDD evidence and the isolated database remain local and are not included in the Git WIP snapshot.

## Latest checkpoint — main-agent continuation (2026-10-23)

This checkpoint supersedes earlier incomplete-task notes above.

- Tasks1–3 are accepted. Task1 was not restarted. Task2 final commits include `fdfb6a52`/`02cdfb1c`; Task3 is `c7ccd671`. These were pushed on the same branch at the user's request.
- The user explicitly prohibited Astra and all other agents. The Task4 worker was stopped before product edits; all Task4 implementation, verification and review is by the main agent. Continue main-agent-only unless the user changes that instruction.
- Task4 is complete locally at `f669ce3a` plus self-review fix `6740b8fc`. Final Admin96files978tests, API19suites106tests, native fresh/upgrade10tests each passed. Types/lint/checksums passed. Five legacy privacy-local tests remain skipped because their distinct database guard was preserved.
- Task4 uses five additive migrations through `20261023191927`; owned scratch/fresh/upgrade databases now have162migrations. Source replay receipts and complete reports are in the preserved SDD workspace. The old customer-candidate refresh script is retired; use finalized source migrations.
- Provider effects run only in the existing worker process, never by assuming its role in an API request. Customer detail exposes safe pending/failed/completed revocation status. Admin targets are excluded from customer reads and lifecycle actions.
- Task4 has only author self-review, per the explicit main-agent-only instruction. No independent review is claimed. No Task4 push or deployment has occurred.
- Next: Task5 Admin/mobile support, then Task6 shell/integration/evidence, with the existing briefs and ledger. Carry Task2 audit lower-bound presentation and Task3 provenance-constraint minor findings into final integration. Also reconcile new customer audit display labels in Task6.
- Evidence summary: `docs/evidence/2026-10-23-admin-dashboard/customer-admin-verification.md`.
