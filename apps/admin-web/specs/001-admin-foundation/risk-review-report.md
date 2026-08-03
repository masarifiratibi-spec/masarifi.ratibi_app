# Risk Review Report: Spec 001 Admin Foundation

## 1. Executive summary

The foundation is implemented and its shared verification suite passes. One
high-severity mock-boundary permission defect was confirmed and fixed: roles
without `system-health.read` could call the system-health mock endpoints
directly. No production backend or real authorization is present or implied.

## 2. Spec status

- Tasks: 122/122 checked.
- Required foundation routes: present.
- Current status: safe to mark complete after the fixes and fresh verification
  in this report.
- Git context: the parent worktree is heavily reorganized and `apps/` is
  untracked from the parent repository. Existing unrelated changes were
  preserved.

## 3. Strengths

- Typed route/component → hook → repository → MSW boundaries are established.
- Arabic RTL, theme, keyboard, masking, permission, and five-viewport browser
  coverage are present.
- Shared API errors reject unsafe payload details.
- No direct production-page fixture imports or unsafe HTML rendering were found.

## 4. Issues found

| ID | Area | Finding | Evidence | Severity | Probability | Risk Score | Priority | Fix Status |
|---|---|---|---|---|---|---:|---|---|
| FND-001 | Permissions | System-health GET and refresh handlers did not enforce `system-health.read`, so a disallowed simulated role could retrieve operational projections directly. | `src/mocks/handlers/system-health.ts` had no role check; the new repository regression test failed with HTTP 200 for `billing-operator`. | High | High | 9 | Urgent | Fixed |

## 5. Risk matrix

- Urgent: FND-001, fixed.
- High priority: none remaining.
- Normal priority: none remaining.
- Low priority: none remaining.

## 6. Severity and probability justification

FND-001 was High because it contradicted the least-privilege route and mock API
contract and exposed operational infrastructure projections. Probability was
High because every direct request without the permission was accepted.

## 7. Fixes applied

- Added allowlisted simulated-role evaluation to both system-health handlers.
- Return a safe HTTP 403 response before scenario or fixture processing.

## 8. Files changed

- `src/mocks/handlers/system-health.ts`
- `src/features/system-health/repository.test.ts`
- `specs/001-admin-foundation/risk-review-report.md`

## 9. Tests added or improved

- Added a repository-boundary regression proving `billing-operator` cannot read
  system-health data.
- Red state: focused test returned HTTP 200.
- Green state: 1 file / 3 tests passed.

## 10. Verification commands and exact results

| Command | Exact result |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run test` | Exit 0; 45 files / 497 tests passed |
| `npm run test:e2e` | Exit 0; 171 passed / 199 intentionally skipped / 0 failed across 370 scheduled cases |
| `npm run build` | Exit 0; Next.js compiled and generated 34 static pages, including every Spec 001 route |

The configured Playwright projects cover 1440, 1280, 1024, 768, and 390 pixels.

## 11. Remaining risks

Production authorization, authentication, database policy, rate limiting, and
infrastructure controls remain correctly deferred to future backend work.

## 12. Tasks that remain unchecked and why

None.

## 13. Final risk rating

Low. Critical: 0. High: 1 fixed. Medium: 0. Low: 0. Highest remaining risk:
Low, limited to explicitly deferred backend trust boundaries.

## 14. Final completion recommendation

Spec 001 is safe to mark complete. Issues fixed: 1. Issues deferred: 0 frontend
defects; production backend protections remain out of scope.
