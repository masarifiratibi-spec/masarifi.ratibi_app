# Risk Review Report: Spec 004 Revenue and Billing

## 1. Executive summary

Two confirmed mock-boundary defects were fixed. Billing handlers previously
ignored all documented permissions, and malformed direct queries/mutations
escaped Zod as HTTP 500 errors. The eight frontend routes remain mock-only,
masked, currency-explicit, and operational after the fixes.

## 2. Spec status

- Tasks: 98/98 checked.
- Routes: 8/8 present.
- Current status: safe to mark complete after this corrective review.
- Git status was inspected; the parent reorganization leaves `apps/` untracked,
  so unrelated changes were preserved and a clean attribution diff is unavailable.

## 3. Strengths

- AED and SAR are kept separate.
- Payment-event projections reject prohibited provider/payment fields.
- Runtime mutations are in-memory, expected-state aware, and mock-only.
- All eight routes render in every configured viewport.
- Plan, promotion, payment, and reconciliation inputs use strict contracts.

## 4. Issues found

| ID | Area | Finding | Evidence | Severity | Probability | Risk Score | Priority | Fix Status |
|---|---|---|---|---|---|---:|---|---|
| BIL-001 | Permissions | All 16 billing mock operations accepted direct calls without checking their documented read/manage permissions. | `billing.ts` had zero role-header or `hasPermission` checks; the new repository test returned subscription overview data to `content-manager`. | High | High | 9 | Urgent | Fixed |
| BIL-002 | Validation/errors | Invalid direct query and mutation payloads threw Zod errors inside MSW and became HTTP 500 responses instead of safe 400 errors. | New direct-fetch tests reproduced HTTP 500 and MSW stack output for invalid pagination and `{}` failed-payment action. | Medium | High | 6 | High priority | Fixed |

## 5. Risk matrix

- Urgent: BIL-001, fixed.
- High priority: BIL-002, fixed.
- No remaining scored frontend finding.

## 6. Severity and probability justification

BIL-001 was High because permission-protected financial operations and
projections were callable by every simulated role. BIL-002 was Medium because
it leaked an unsafe failure mode and broke the stable validation contract, but
the API client still redacted the response. Both probabilities were High
because the defects reproduced on every matching direct request.

## 7. Fixes applied

- Enforced the exact least-privilege permission on all billing GET/POST handlers.
- Rejected invalid/unknown role headers with safe HTTP 403.
- Replaced throwing query/body parsing at the handler boundary with safe,
  strict parsing and HTTP 400 validation responses.

## 8. Files changed

- `src/mocks/handlers/billing.ts`
- `src/features/billing/repository.test.ts`
- `specs/004-admin-revenue-and-billing/risk-review-report.md`

## 9. Tests added or improved

- Unauthorized billing overview regression.
- Malformed direct query regression.
- Malformed direct mutation regression.
- Focused final result: 1 file / 17 tests passed.

## 10. Verification commands and exact results

| Command | Exact result |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run test` | Exit 0; 45 files / 497 tests passed |
| `npm run test:e2e` | Exit 0; 171 passed / 199 intentionally skipped / 0 failed; the billing all-route test passed at 1440, 1280, 1024, 768, and 390 |
| `npm run build` | Exit 0; all eight billing routes generated |

## 11. Remaining risks

Real billing authorization, provider idempotency, webhooks, reconciliation,
immutable audit, and payment-provider controls remain future backend work.

## 12. Tasks that remain unchecked and why

None. The implementation consolidates several task-named view files into
`BillingViews.tsx`; `quickstart.md` documents that approved structure change.

## 13. Final risk rating

Low after fixes. Critical: 0. High: 1 fixed. Medium: 1 fixed. Low: 0. Highest
remaining risk: Low, limited to documented backend deferrals.

## 14. Final completion recommendation

Spec 004 is safe to mark complete. Issues fixed: 2. Issues deferred: 0 frontend
defects.
