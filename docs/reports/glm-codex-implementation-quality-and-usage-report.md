# GLM and Codex Implementation Quality and Usage Report

**Project**: Masarifi Admin Dashboard  
**Report date**: 2026-07-29  
**Scope**: Implemented Admin Web specs under `apps/admin-web/specs/001-*` through `005-*`  
**Mode**: Analysis/reporting only. No implementation files were modified for this report.

## 1. Executive Summary

Specs 001-004 are supported by verification records and task ledgers as completed. Spec 005 has a verified implemented subset, but it is explicitly not complete: its final report records 89 completed tasks and 65 real unchecked implementation/verification tasks, while the raw checkbox count is 66 because the file still includes a template checkbox line.

GLM/OpenCode was useful when the task was bounded and mechanical: adding initial contracts, routes, repositories, hooks, mock state, and browser journeys. It was less reliable for strict constitution-heavy completion: multiple delegated runs stalled, timed out, or produced output that required Codex review and correction. The best evidence shows GLM created useful draft velocity, but Codex carried final ownership: architecture correction, security/privacy hardening, task-marker reconciliation, final verification, and incomplete-work recovery.

Recommended future workflow: use GLM only for bounded implementation slices after tasks are already explicit, then require Codex review and verification before marking anything complete. Do not use GLM as the sole primary implementer for full specs with many security, RTL, accessibility, mock-contract, and task-ledger constraints.

## 2. Scope and Evidence Reviewed

Evidence inspected:

| Evidence | Notes |
|---|---|
| `git status --short` and `git diff --name-status` | Root Git sees the old root app files as deleted and `apps/` as untracked after reorganization, so Git is weak evidence for per-file authorship. |
| `apps/admin-web/specs/*/tasks.md` | Used for task completion counts, unchecked task evidence, and Spec 004 delegation note. |
| `apps/admin-web/specs/*/verification-report.md` | Used for Specs 001, 002, 003, and 005 verification and delegation evidence. Spec 004 has no separate verification report. |
| `apps/admin-web/specs/*/quickstart.md` | Used for Spec 004 final verification and structure-adjustment evidence. |
| Source inventory under `apps/admin-web/src` and `tests/e2e` | Used to identify landed feature areas, routes, contracts, repositories, hooks, handlers, fixtures, and tests. |
| Current-session history | Used only where repository artifacts do not preserve enough attribution detail. |
| OpenCode relay artifacts | No implementation result files, briefs, or relay logs remain in the workspace; reports say temporary OpenCode artifacts were removed after review. |

Evidence limitations are listed in section 12.

## 3. Spec-by-Spec Attribution Table

| Spec | Status | Task ledger | GLM/OpenCode evidence | Codex evidence | Final verification evidence |
|---|---:|---:|---|---|---|
| 001 Admin Foundation | Complete | 122 done / 0 open | No durable repo evidence of GLM authorship found. | Completion re-audit and final verification recorded in `verification-report.md`. | Typecheck, lint, Vitest, Playwright, build passed; 80/80 visual matrix recorded. |
| 002 Overview Analytics | Complete | 82 done / 0 open | Session evidence says GLM worked and hit limit before completion; repo report does not attribute file authorship. | Report records completed implementation, rerun after E2E/build overlap, and re-audit. | Typecheck, lint, full Vitest, full Playwright, build passed. |
| 003 Users, Devices, Sessions, Access | Mostly complete with deliberate open test-matrix tasks | 127 done / 11 open | `verification-report.md` says GLM 5.2 added first shared permission, safe-error, region-state, user-contract, repository, hook, and mock-handler foundations, then hit five-hour usage limit. | Codex completed user/access slices, corrected many defects, removed temp artifacts, and ran final gates. | Typecheck, lint, Vitest, Playwright, build passed; 11 unchecked tasks remain documented. |
| 004 Revenue and Billing | Complete | 98 done / 0 open | `tasks.md` says first GLM/OpenCode pass stopped after invalid TypeScript and unsafe placeholder contracts; later GLM 5.2 contributed billing routes, repository/hook coverage, and E2E journeys, then stalled before final verification. | Codex repaired E2E race/unsafe-copy issues, removed temp brief, reconciled tasks, and verified locally. | Typecheck, lint, 34 files / 269 tests, 83 Playwright passed / 122 skipped, build passed. |
| 005 Imports and Parsers | In progress, verified subset only | 89 done / 65 real open; 66 raw checkbox opens including template | `verification-report.md` says broad GLM 4.7 created permissions, initial contracts, mock state, and partial handlers; correction run timed out after one hour. | Codex completed typed boundary, fixtures, handlers, repositories, hooks, 15 new routes, permission wiring, views, tests, and review fixes for the implemented subset. | Typecheck, lint, full Vitest, full Playwright, build passed; Spec 005 not confirmed complete. |

## 4. GLM Work Inventory

Work with direct repository evidence:

| Spec | GLM work accepted or partially accepted | GLM work later corrected/replaced | GLM work incomplete/deleted |
|---|---|---|---|
| 003 | Initial permission/safe-error/region-state/user-contract/repository/hook/mock-handler foundations. | Codex corrected route permission inheritance, stale cross-role data, strict parsing, action errors, duplicate IDs, mobile behavior, expiry behavior, and workspace scenarios. | Run hit five-hour usage limit; no completion claim accepted. Temporary briefs/logs removed. |
| 004 | Later GLM 5.2 pass contributed billing routes, repository/hook coverage, and E2E journeys. | Codex repaired E2E race and unsafe-copy issues. | First GLM/OpenCode pass was stopped after invalid TypeScript and unsafe placeholder contracts. Later run stalled before final verification. Temporary brief removed. |
| 005 | Broad GLM 4.7 created Phase 4 permissions, initial contracts, mock state, and partial handlers. | Codex corrected role header behavior, route permission precedence, projection leakage, mutable snapshots, unsupported operation/action mismatch, stale navigation test, and ambiguous locators. | Focused correction timed out after one hour. Large parts of Spec 005 remain incomplete. Temporary artifacts were deleted after results were recorded. |

Work with session evidence but weak repository attribution:

| Spec | Evidence-backed classification |
|---|---|
| 002 | GLM worked on Phase 1 / Spec 002 and usage ended before completion could be confirmed. The final repo report attributes completed implementation to the final review state, not to exact GLM files. Classify as shared or unclear attribution. |
| 001 | No durable evidence found that GLM authored implementation. Classify as Codex/shared/unclear only. |

## 5. Codex Work Inventory

Codex-owned or Codex-finalized work supported by reports:

| Area | Work completed |
|---|---|
| Spec 001 | Foundation verification, design preservation matrix, security/accessibility review, no-direct-fixtures check, task ledger cleanup, final re-audit. |
| Spec 002 | Overview analytics completion, typed data boundary validation, platform unique-customer invariant review, E2E rerun after build lock conflict, task re-audit. |
| Spec 003 | Completed user list/detail/action, device, session, bulk action, access request, and temporary workspace slices after GLM limit; fixed security, accessibility, stale state, permission, and validation defects. |
| Spec 004 | Repaired GLM output after invalid TypeScript/placeholder pass and stalled later pass; finalized billing views, route coverage, task ledger, quickstart evidence, and verification. |
| Spec 005 | Completed the implemented subset after GLM timeout: typed contracts, deterministic fixtures/state, handlers, repositories, hooks, 15 new routes, permission wiring, responsive views, tests, and security/clean-code fixes. Kept incomplete items unchecked. |

Codex also preserved the key architectural boundary across specs: pages route through typed feature hooks, repositories, MSW handlers, contracts, and deterministic fixtures instead of importing raw mock arrays directly.

## 6. Quality Scorecard

Scores are evidence-based judgments, not exact measurements. GLM scores refer to initial delegated output, not the final landed implementation after Codex correction.

| Category | GLM/OpenCode | Reason | Codex | Reason | Final combined |
|---|---:|---|---:|---|---:|
| Requirement adherence | 5 | Useful starts in Specs 003-005, but limits/stalls and incomplete Spec 005 scope prevented full adherence. | 8 | Completed or honestly deferred requirements; Specs 001-004 verified, Spec 005 not overclaimed. | 8 |
| Code correctness | 5 | Spec 004 first pass had invalid TypeScript and unsafe placeholders; Spec 005 needed multiple correctness fixes. | 8 | Final suites passed; Codex fixed concrete behavioral defects. | 8 |
| TypeScript quality | 5 | Invalid TypeScript and placeholder contracts are recorded for Spec 004. | 9 | Final scans/typecheck passed and no application `any` was reported in changed scopes. | 8 |
| Architecture | 6 | GLM contributed useful contracts/routes/hooks but left unsafe or incomplete boundaries. | 8 | Reused feature boundaries and avoided unnecessary wrapper files; kept pages thin. | 8 |
| Design-system consistency | 6 | No direct evidence of major landed GLM design drift, but Codex reports preserving/correcting visual consistency. | 8 | Reused approved shell, tokens, tables/cards, dialogs, and route hierarchy. | 8 |
| Security and privacy | 4 | Unsafe placeholder contracts, projection leakage, invalid role header behavior, and mutable mock snapshots required correction. | 9 | Fixed privacy/security defects and verified scans for forbidden APIs/data. | 8 |
| Accessibility | 5 | GLM output required dialog ID, accessible-name, focus, and mobile corrections. | 8 | Codex added/fixed focus restoration, accessible names, live outcomes, touch targets, and viewport coverage. | 8 |
| RTL/LTR support | 6 | GLM likely followed existing patterns but did not complete all required proof, especially Spec 005. | 8 | Final shared suites cover completed specs; Spec 005 still has LTR evidence gap. | 7 |
| Responsive implementation | 6 | Some mobile/access responsiveness required Codex correction in Spec 003. | 8 | Verified five viewports for completed specs and Spec 005 subset. | 8 |
| Test quality | 5 | GLM added useful tests/journeys but also left false-green or incomplete evidence risks; historical RED evidence was often missing. | 8 | Codex improved tests, reran affected/full suites, and did not mark missing RED evidence as complete. | 8 |
| Self-verification | 4 | Runs stalled/timed out/hit usage limit; several final claims were superseded by Codex review. | 9 | Commands and skipped/failed attempts are recorded with pass/fail distinctions. | 8 |
| Delegated-scope completion | 4 | Spec 003 hit five-hour limit, Spec 004 stalled, Spec 005 correction timed out and remains incomplete. | 8 | Codex completed 001-004 and the verified Spec 005 subset. | 7 |
| Rework burden | 4 | Created meaningful review/correction load in Specs 003-005. | 8 | Rework was purposeful and mostly landed as verified fixes. | 6 |

Overall scores:

| Subject | Score | Summary |
|---|---:|---|
| GLM initial output | 5/10 | Helpful scaffolding and some usable implementation, but unreliable as a finisher under strict spec/verification constraints. |
| Codex corrections and implementation | 8.5/10 | Strong final ownership, verification discipline, and honest deferral handling; some cost came from orchestration and repeated recovery. |
| Final combined implementation | 8/10 for Specs 001-004; 6.5/10 including incomplete Spec 005 | Specs 001-004 are verified complete. Spec 005 has a solid verified subset but remains incomplete by its own task ledger. |

## 7. Rework Analysis

Exact percentages cannot be calculated because the admin app is untracked at the root and OpenCode relay artifacts were removed. The following is an evidence-based estimate from verification notes and current files.

| Rework class | Estimate | Evidence |
|---|---:|---|
| Accepted unchanged | Low to moderate | GLM foundations in Specs 003/005 and billing routes/hooks/E2E in Spec 004 survived in some form, but exact unchanged lines cannot be proven. |
| Accepted after minor correction | Moderate | Spec 004 later GLM pass contributed routes/repository/hook coverage/journeys; Codex fixed race/unsafe-copy issues. |
| Substantially rewritten or corrected | Moderate to high | Spec 003 and Spec 005 reports list many Codex corrections to permissions, projections, validation, mutable state, accessibility, and tests. |
| Deleted | Low | Temporary OpenCode briefs/logs were removed; Spec 005 removed an action without an OpenAPI operation. |
| Left incomplete | High for Spec 005 | 65 real Spec 005 tasks remain unchecked; correction run timed out. |
| Completed later by Codex | High | Codex fallback is explicitly recorded for Specs 003 and 005; Spec 004 final verification and corrections are Codex-owned. |

Recurring GLM problems supported by evidence:

- Invalid TypeScript and unsafe placeholder contracts in the first Spec 004 pass.
- Stalling or usage-limit exhaustion before final verification in Specs 003 and 004.
- Timed-out correction in Spec 005.
- Incomplete RED evidence capture before implementation in Specs 003 and 005.
- Security/privacy defects needing Codex correction: projection leakage, unsafe role header behavior, mutable mock snapshots.
- Test fragility or weakness needing Codex correction: stale navigation expectation, ambiguous accessible-name locators, Playwright readiness/race issues.
- Scope incompletion in Spec 005, especially full filters, retry flow, bank/sender detail/edit validation, parser editor/preview lifecycle, merchant/category forms, permission/scenario/LTR reconciliation.

## 8. Token and Efficiency Analysis

Known usage evidence:

| Evidence | Impact |
|---|---|
| Spec 003 GLM 5.2 reached a five-hour usage limit. | High delegated consumption; incomplete scope. |
| Spec 004 first GLM/OpenCode pass stopped after invalid TypeScript/placeholders. | Consumption produced rework. |
| Spec 004 later GLM 5.2 pass stalled before final verification. | Useful implementation, but Codex still paid final verification/review cost. |
| Spec 005 broad GLM 4.7 run completed partially; correction timed out after one hour. | Some useful scaffolding, but significant Codex fallback required. |
| OpenCode logs/briefs were removed after review. | Exact token counts and precise duration details unavailable. |
| Verification reports record many repeated full-suite runs. | Expensive but useful because final claims required proof. |

Estimated relative consumption:

| Actor/workflow | Efficiency score | Assessment |
|---|---:|---|
| GLM/OpenCode | 4.5/10 | Saved some typing on scaffolding and route/test generation, but stalls and correction load reduced the gain. |
| Codex as orchestrator/reviewer | 7/10 | Spent extra usage reviewing and repairing, but prevented false completion and preserved architecture/security. |
| Combined GLM + Codex workflow | 5.5/10 | Likely useful for Spec 004-sized bounded chunks, but inefficient for broad full-spec delegation and Spec 005-scale complexity. |

Sources of avoidable consumption:

- Broad delegation briefs covering too many routes, contracts, states, and tests in one run.
- Rerunning or recovering after stalled delegated sessions.
- Repairing invalid TypeScript, placeholder contracts, and test races after generation.
- Reconstructing attribution after temporary logs and briefs were deleted.
- Historical RED tasks that could not be retroactively proven.

Useful consumption:

- GLM generated initial foundations and some broad implementation surface.
- Codex review caught defects that would have been easy to miss in a large generated diff.
- Full verification runs gave reliable completion evidence for Specs 001-004.
- Task-ledger reconciliation prevented false-green completion claims.

## 9. Problems and Successful Patterns

Problems:

| Pattern | Evidence |
|---|---|
| Delegating full specs is too broad | Specs 003 and 005 ended with provider limits/timeouts and Codex fallback. |
| Generated code can look complete while missing verification | Spec 005 has passing gates for a subset but 65 real tasks remain open. |
| Historical RED evidence is fragile | Specs 003 and 005 leave RED-process tasks unchecked because failures were not captured before implementation. |
| Mock security boundaries need human review | Spec 005 required fixes for projection leakage, invalid role headers, and mutable runtime state. |
| Tests need semantic review | Ambiguous locators, stale expectations, and races required correction. |

Successful patterns:

| Pattern | Evidence |
|---|---|
| Typed contracts + repositories + hooks | Present across overview, users/access, billing, and imports feature folders. |
| Thin Next.js route files | Routes under `src/app/admin` import feature views and avoid fixture imports. |
| Honest task ledgers | Specs 003 and 005 keep unverifiable or incomplete work unchecked. |
| Structure simplification | Spec 004 consolidated billing views in `BillingViews.tsx` instead of creating empty wrapper files. |
| Full final gates | Completed specs record typecheck, lint, Vitest, Playwright, and build results. |

## 10. Recommended Workflow for Future Specs

Use a mixed workflow, but narrow the GLM slice.

Recommended process:

1. Codex owns spec reading, constitution interpretation, task slicing, and final review.
2. GLM receives one bounded implementation slice at a time: one route group, one repository/handler pair, or one focused test file set.
3. GLM must not be asked to complete an entire multi-story spec in one broad pass.
4. Keep delegation artifacts until the final report is written so attribution is not lost.
5. Require GLM to produce small diffs and exact command output, but treat those claims as untrusted until Codex reruns the commands.
6. Codex marks tasks complete only from real files and executed verification.

Best delegation targets for GLM:

- Mechanical route wiring.
- Initial Zod schema/test scaffolding from an already written OpenAPI contract.
- Straight repository/hook methods following an existing pattern.
- Repetitive Playwright smoke journeys after selectors and route states already exist.

Avoid delegating to GLM as primary owner for:

- Final task-ledger reconciliation.
- Security/privacy boundaries.
- Permission matrices.
- Accessibility and RTL/LTR sign-off.
- Large cross-story specs.
- Anything where missing a subtle invariant creates false completion, such as unique customer counts, payment/provider payload allowlists, or sensitive data projections.

## 11. Final Verdict

GLM was useful in this project, but not as a finisher. It helped produce scaffolding and some substantial implementation surface, especially in Spec 004 and the early parts of Specs 003 and 005. It also created rework through incomplete runs, invalid TypeScript, unsafe placeholders, missing RED evidence, and partial verification.

Codex should remain the owner for architecture, security, accessibility, RTL/LTR, task reconciliation, and final verification. Future Masarifi specs should use GLM only for bounded implementation, not broad primary implementation.

Practical recommendation: **Codex-led mixed workflow with GLM as a bounded implementer**. For complex specs, split by user story and stop after each slice for Codex review. For high-risk slices, use Codex alone.

## 12. Evidence Limitations

- The repository root shows the app reorganization as root deletions plus an untracked `apps/` tree, so Git cannot reliably attribute individual app file authorship.
- OpenCode briefs, relay logs, events, and result files were mostly removed after review. This report relies on surviving verification reports, task notes, quickstart notes, current files, and current-session history.
- Exact token counts are unavailable. Efficiency scores are qualitative and evidence-based.
- Exact rework percentages are unavailable. Rework proportions are estimates, labeled as such.
- Spec 002 GLM involvement is supported by session history, but not by durable repository attribution.
- Spec 005 is not complete. Its passing verification gates prove the implemented subset, not the entire spec.
