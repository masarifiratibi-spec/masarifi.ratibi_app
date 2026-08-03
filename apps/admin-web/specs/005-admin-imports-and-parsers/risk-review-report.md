# Risk Review Report: Spec 005 Imports and Parsers

## 1. Executive summary

The 16 routes and typed operational flows are present. Two high-severity legacy
boundary defects were fixed: the original imports overview allowed direct reads
without `imports.read`, and the legacy retry endpoint accepted an empty,
unconfirmed request without expected state or revision.

## 2. Spec status

- Tasks: 105/154 checked; 49 unchecked.
- Routes: 16/16 present.
- Runtime acceptance behavior: verified after fixes.
- Historical/exhaustive task ledger: incomplete.
- Git status was inspected; the parent reorganization leaves `apps/` untracked,
  so unrelated changes were preserved and a clean attribution diff is unavailable.

## 3. Strengths

- Parser definitions are declarative and reject executable/network-capable
  content.
- Raw imported messages/files and financial values are omitted from views.
- Deterministic in-memory transitions enforce revision and lifecycle rules.
- Tables/cards, keyboard confirmation, conflict, masking, and permissions have
  browser coverage.
- All 16 routes render at every approved viewport.

## 4. Issues found

| ID | Area | Finding | Evidence | Severity | Probability | Risk Score | Priority | Fix Status |
|---|---|---|---|---|---|---:|---|---|
| IMP-001 | Permissions/privacy | `GET /api/v1/admin/imports` returned masked import projections to roles without `imports.read`. | New repository regression returned HTTP 200 and four records to `billing-operator`. | High | High | 9 | Urgent | Fixed |
| IMP-002 | Data integrity | `POST /api/v1/admin/imports/:id/retry` accepted an empty body and scheduled the retry without confirmation, expected state, revision, or reason. | New direct-fetch regression returned HTTP 200 for an empty request. | High | High | 9 | Urgent | Fixed |
| IMP-003 | Test evidence | Forty-nine test-first tasks remain unchecked even though the consolidated runtime suites cover their major behaviors. | `tasks.md` contains 49 unchecked RED/focused-test tasks; `verification-report.md` explicitly classifies them. | Low | High | 3 | Normal priority | Deferred |

## 5. Risk matrix

- Urgent: IMP-001 and IMP-002, fixed.
- Normal priority: IMP-003 remains.

## 6. Severity and probability justification

IMP-001 and IMP-002 were High because permission/privacy projections and a
sensitive state-changing handoff could be invoked incorrectly. Probability was
High because both happened on every direct request. IMP-003 is Low severity
because the behavior is covered by consolidated tests, but High probability
because the ledger is visibly incomplete.

## 7. Fixes applied

- Enforced `imports.read` on the legacy overview handler.
- Validate retry IDs through `safeIdSchema`.
- Require the existing strict action contract with reason, confirmation token,
  expected `failed` state, and revision 1.
- Reject missing/invalid retry bodies with safe HTTP 400, missing records with
  404, and stale state/revision with 409.

## 8. Files changed

- `src/mocks/handlers/imports.ts`
- `src/features/imports/repository.ts`
- `src/features/imports/repository.test.ts`
- `specs/005-admin-imports-and-parsers/risk-review-report.md`

## 9. Tests added or improved

- Unauthorized legacy imports overview regression.
- Unconfirmed direct retry regression.
- Focused final result: imports repository 1 file / 15 tests passed.

## 10. Verification commands and exact results

| Command | Exact result |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run test` | Exit 0; 45 files / 497 tests passed |
| `npm run test:e2e` | Exit 0; 171 passed / 199 intentionally skipped / 0 failed; Spec 005 all-route coverage passed at all five viewports |
| `npm run build` | Exit 0; all 16 Spec 005 routes generated |

## 11. Remaining risks

The unchecked historical test tasks remain a documentation/traceability gap.
Real import ingestion, parsing, transaction writes, file scanning, and backend
authorization remain correctly out of scope.

## 12. Tasks that remain unchecked and why

Forty-nine tasks remain unchecked. T009 is a pre-edit E2E baseline that was not
run. The other unchecked tasks request historical RED observations or
fine-grained test files whose behavior is now consolidated in the passing
contracts, repository, hook, state, component, permission, accessibility, and
Playwright suites. They cannot be truthfully marked as historical RED evidence.

## 13. Final risk rating

Medium due to ledger traceability, not a confirmed runtime defect. Critical: 0.
High: 2 fixed. Medium: 0. Low: 1 remaining. Highest remaining risk: IMP-003,
score 3.

## 14. Final completion recommendation

The Spec 005 runtime is safe, but do not mark all 154 tasks complete while 49
remain unchecked. Issues fixed: 2. Issues deferred: 1 because historical RED
evidence cannot be recreated honestly.
