# Risk Review Report: Spec 006 AI Management and Automation Intelligence

## 1. Executive summary

All ten approved Phase 5 routes and their metadata-only operational workflows
are now implemented. The review confirmed ten issues: seven High and three
Medium. All ten were fixed at their contract, permission, deterministic-state,
handler, repository, UI, or test boundary. Required verification is green.

No Critical finding was confirmed. The feature is safe to mark functionally
complete within the frontend/mock scope, with Low residual runtime risk. The
task ledger remains 76/118 because 42 highly granular fixture, gated
implementation, and test-matrix markers do not have complete evidence and were
not checked by inference.

## 2. Spec status

- Tasks: 76/118 checked; 42 remain unchecked.
- Routes: all ten required routes are present and emitted by the production
  build.
- User stories: overview, provider/model operations, prompt governance,
  usage/failure triage, response reports, and safety-rule operations are
  available through strict typed mock boundaries.
- Verification: typecheck, lint, 497 Vitest tests, the full Playwright suite,
  focused 25-case/five-viewport AI coverage, and production build passed.
- Status: functionally complete in the approved frontend/mock scope; task-ledger
  closure remains intentionally incomplete.

## 3. Strengths

- Contracts structurally exclude raw prompts, conversations, responses,
  provider payloads, credentials, and unknown fields.
- Role projections omit disallowed fields rather than masking them after
  retrieval.
- Original requests, attempts, and fallbacks remain distinct; currencies are
  not combined without authoritative normalization.
- Mutations require explicit reason, expected state/revision, safe confirmation,
  pending locks, deterministic results, and conflict handling.
- Provider fallback, prompt activation, rollback, failure triage, report
  disposition, and safety coverage rules preserve deterministic integrity.
- Arabic RTL is the default, English LTR remains usable, semantic tables/mobile
  cards are available, and complex controls are safely withheld at 390px.
- The repository/hook/MSW layering remains replaceable by the deferred backend;
  no real provider, database, authentication, or secret integration was added.

## 4. Issues found

| ID | Area | Finding | Evidence | Severity | Probability | Risk Score | Priority | Fix Status |
|---|---|---|---|---|---|---:|---|---|
| AI-001 | Route availability | Six approved routes were absent. | Initial build emitted only overview, providers list/detail, and models; spec required prompts list/detail, usage, failures, reports, and safety rules too. | High | High | 9 | Urgent | Fixed |
| AI-002 | Requirements/runtime | Prompt, usage/failure, report, and safety workflows lacked contracts, handlers, hooks, state, views, and journeys. | Initial source and task inspection found no implementation for T058–T101. | High | High | 9 | Urgent | Fixed |
| AI-003 | Actions/data integrity | Provider/model operations were read-only and did not expose confirmation, mutation locks, persistence, or conflict recovery. | Initial `AiViews.tsx` had no operational action path; direct action coverage was absent. | High | High | 9 | Urgent | Fixed |
| AI-004 | Permissions | Direct AI overview/provider/model reads and provider actions did not enforce documented permissions. | A new direct repository regression returned provider inventory to `billing-operator` before the handler fix. | High | High | 9 | Urgent | Fixed |
| AI-005 | Validation/errors | Malformed direct queries/actions were ignored or surfaced as unhandled Zod HTTP 500 errors. | A 121-character search returned 200 and an empty action body produced an MSW Zod exception before strict parsing/error mapping. | Medium | High | 6 | High priority | Fixed |
| AI-006 | Empty state | The empty overview scenario violated its own schema and became an error state. | Handler emitted `metrics: []` while the response schema required a non-empty array. | Medium | High | 6 | High priority | Fixed |
| AI-007 | Accessibility/RTL/responsive | Implemented AI pages were English-first; the provider table lacked headers/mobile cards and empty overview lacked an explicit accessible message. | Initial component markup and focused render tests reproduced each defect. | Medium | High | 6 | High priority | Fixed |
| AI-008 | Verification | AI browser coverage initially exercised only the overview and could not verify required routes, mutations, privacy, keyboard behavior, or five viewports. | Initial `tests/e2e/ai-management.spec.ts` contained one overview journey. | High | High | 9 | Urgent | Fixed |
| AI-009 | Least-privilege projections | Support, security, and billing projections did not match the documented per-resource field boundaries. | New direct projection tests exposed provider/model/usage fields beyond each limited role's approved context. | High | High | 9 | Urgent | Fixed |
| AI-010 | Mutation persistence/focus | Several confirmed actions returned success without persisting deterministic state, and a successful triage action attempted to restore focus to a removed trigger. | Repository follow-up reads did not reflect mutations; the full Playwright rerun reproduced four focus failures after `acknowledge`. | High | High | 9 | Urgent | Fixed |

## 5. Risk matrix

| Priority | Open | Fixed | Findings |
|---|---:|---:|---|
| Urgent (9–12) | 0 | 7 | AI-001, AI-002, AI-003, AI-004, AI-008, AI-009, AI-010 |
| High priority (6–8) | 0 | 3 | AI-005, AI-006, AI-007 |
| Normal priority (3–5) | 0 | 0 | None |
| Low priority (1–2) | 0 | 0 | None |

## 6. Severity and probability justification

The seven High findings removed required routes, bypassed least privilege,
exposed incorrect projections, or allowed operational actions to be misleading
or inconsistent. Each had High probability because a direct request, source
inspection, build result, follow-up read, or browser journey reproduced it.

The three Medium findings consistently broke safe boundary errors, required
empty behavior, or accessible RTL/mobile operation. Their impact did not expose
real secrets or corrupt real financial data because the feature remains a
deterministic frontend prototype.

## 7. Fixes applied

- Added all missing routes and the approved prompt, usage, failure, report, and
  safety workflows.
- Added strict metadata-only contracts, bounded sanitized report excerpts,
  declarative safety schemas, action schemas, and safe aggregate/context
  projections.
- Added repository/hook/MSW operations with permission enforcement, strict
  query/body validation, safe error mapping, deterministic scenarios, filtering,
  sorting, pagination, and targeted invalidation.
- Added deterministic provider/model, prompt, failure, report, and safety state
  transitions, including revision checks, fallback coverage, activation gates,
  rollback-created drafts, and reset isolation.
- Corrected billing, support, and security permissions and structural
  projections.
- Added Arabic-first semantic views, responsive cards/desktop-required notices,
  explicit loading/empty/error/success states, reasoned confirmation dialogs,
  live feedback, and valid focus restoration after disappearing actions.
- Added focused and global browser coverage for routes, permissions, privacy,
  confirmation, prompt gating, accessibility, performance, visual preservation,
  RTL/LTR, and all five required viewports.

## 8. Files changed

Primary Phase 5 changes:

- `src/app/admin/ai/**/page.tsx`
- `src/features/ai/contracts.ts`
- `src/features/ai/repository.ts`
- `src/features/ai/hooks.ts`
- `src/features/ai/AiOverview.tsx`
- `src/features/ai/AiViews.tsx`
- `src/mocks/fixtures/ai.ts`
- `src/mocks/phase5-ai-state.ts`
- `src/mocks/handlers/ai.ts`
- `src/mocks/browser.ts`
- `src/mocks/server.ts`
- `src/test/setup.ts`
- `src/components/admin/ConfirmDialog.tsx`
- `tests/e2e/ai-management.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/permissions.spec.ts`
- `tests/e2e/performance.spec.ts`
- `tests/e2e/visual-preservation.spec.ts`
- Phase 5 unit tests, `tasks.md`, `quickstart.md`, and this report

The parent Git worktree was already reorganized: legacy root files appear
deleted while `apps/` is untracked. No reset, staging, commit, or unrelated
cleanup was performed, so a normal tracked diff cannot isolate these app edits.

## 9. Tests added or improved

- Contract tests for strict query/action input, authoritative money/counting,
  provider compatibility, metadata-only operations, Unicode report bounds, and
  declarative safety.
- Repository/direct-handler tests for all operation families, malformed input,
  least privilege, limited projections, deterministic mutations, conflicts,
  activation gates, fallback persistence, empty state, and unavailable state.
- Deterministic-state tests for reset, revision conflicts, fallback coverage,
  operational transitions, and rollback-created drafts.
- Component tests for Arabic overview, explicit empty state, semantic provider
  tables/cards, safe provider/model rendering, and secret exclusion.
- A 25-case focused AI Playwright matrix across 1440, 1280, 1024, 768, and 390,
  plus global accessibility, permissions, performance, and visual-preservation
  coverage.

## 10. Verification commands and exact results

| Command | Exact result |
|---|---|
| `npx vitest run src/features/ai src/mocks/phase5-ai-state.test.ts` | Exit 0; 6 files / 52 tests passed |
| `npm run test:e2e -- tests/e2e/ai-management.spec.ts` | Exit 0; 25 passed / 0 skipped / 0 failed across 1440, 1280, 1024, 768, and 390 |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run test` | Exit 0; 45 files / 497 tests passed |
| `npm run test:e2e` | Exit 0; final artifact status `passed`, zero failed tests; full run recorded 171 passed / 199 intentional project skips |
| `npm run build` | Exit 0; compiled successfully, generated 34 static pages, and emitted all ten Phase 5 routes |

The final Playwright artifact is `test-results/.last-run.json` and records
`{"status":"passed","failedTests":[]}`.

## 11. Remaining risks

- Forty-two unchecked task markers request exhaustive fixture permutations,
  gated implementation evidence, and finer-grained contract/state/hook/
  component/direct-handler matrices beyond the implemented regression set.
  This is traceability/test-depth debt, not a confirmed runtime defect.
- `npm install` reported dependency advisory counts, but package impact was not
  classified. `npm audit` could not be run because the environment rejected
  exporting dependency metadata to the registry without explicit authorization.
  This is an unclassified repository-level follow-up, not a confirmed Spec 006
  vulnerability.
- Production authorization, provider-secret handling, prompt retention,
  routing/rate/spend controls, idempotency, queues, safety enforcement,
  immutable audit, monitoring, and incident response remain correctly deferred
  in `plan.md`.
- The pre-existing Git reorganization prevents a trustworthy tracked diff until
  the repository owner reconciles the root/app move.

## 12. Tasks that remain unchecked and why

Forty-two tasks remain unchecked:

- T041, T043–T045, T047–T048, and T052–T053: exhaustive provider/model state,
  hook, component, browser, and fixture matrices and their gated implementation
  markers are only partially represented.
- T058–T065 and T067–T068: prompt edge-case matrices, complete lifecycle
  fixture permutations, and implementation markers gated on those tests are
  not exhaustively evidenced.
- T072–T080 and T082–T083: usage/failure currency, state, hook, component,
  browser, and gated implementation evidence exceed the focused regression set.
- T087–T095 and T097–T098: complete 279/280/281, surrogate, severity/status,
  duplicate, hook, component, browser, and gated implementation matrices are
  not exhaustive.
- T102–T103: direct-handler and cross-scenario coverage exists through
  repository/browser tests, but the exact requested `handlers/ai.test.ts`
  matrix was not created.

They remain unchecked because a green aggregate suite is not evidence that each
listed permutation exists.

## 13. Final risk rating

Low residual runtime risk for the implemented frontend/mock feature.

- Critical: 0
- High: 7, all fixed
- Medium: 3, all fixed
- Low: 0
- Highest remaining confirmed finding risk: none
- Highest remaining concern: unclassified dependency-audit and test-depth debt

## 14. Final completion recommendation

Issues fixed: 10. Confirmed issues deferred: 0. The Spec 006 implementation is
safe to mark functionally complete within its approved frontend/mock scope
because every confirmed in-scope issue was fixed and every required verification
command succeeded. Do not mark the 42 remaining task markers complete until
their explicitly named exhaustive evidence is added.
