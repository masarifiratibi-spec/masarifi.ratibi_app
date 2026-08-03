# Quickstart: Spec 006 Planning and Verification

## Scope

Implement only Phase 5 inside `apps/admin-web`. Add the ten AI Management routes
through one `features/ai` boundary and reuse the existing shell, components,
semantic tokens, API client, query provider, permission system, MSW setup,
locked mutations, and tests.

Do not install dependencies, initialize another project, call an AI provider,
receive raw AI/customer content, expose credentials, persist mock state, build
backend services, control queues, or redesign approved pages.

## Prerequisites

- Existing Admin Web dependencies are installed.
- Specs 001-005 and their shared behavior remain intact.
- Active feature directory: `specs/006-admin-ai-management`.
- Phase 5 implementation tasks are generated and completed before this guide
  is used as a completion check.

## Planning artifacts

- [`spec.md`](./spec.md): clarified behavior and acceptance criteria
- [`plan.md`](./plan.md): implementation design and constitution gates
- [`research.md`](./research.md): resolved planning decisions
- [`data-model.md`](./data-model.md): read models, commands, invariants, and
  transitions
- [`contracts/admin-ai-management.openapi.yaml`](./contracts/admin-ai-management.openapi.yaml):
  proposed replaceable frontend contract
- `tasks.md`: generated later by `/speckit-tasks`

## Implementation sequence

1. Add RED contract tests for identifiers, bounds, projections, authoritative
   classifications, counting/currency rules, fallback graphs, prompt lifecycle,
   excerpt safety, and safety coverage.
2. Add AI contracts, deterministic fixtures, validated handlers, and resettable
   runtime state.
3. Add the AI repository, query hooks, and locked mutations.
4. Extend permissions/route rules and activate the existing AI navigation item.
5. Deliver Overview, Providers/Detail, and Models.
6. Deliver Prompt Versions/Detail and lifecycle actions.
7. Deliver Usage, Failures, Response Reports, and Safety Rules.
8. Add complete states, privacy projections, confirmations, conflict recovery,
   accessibility, RTL/LTR, responsive behavior, and browser coverage.
9. Run focused checks, then the complete verification suite.

## Baseline evidence

- 2026-07-29 `npm run typecheck`: exit 0.
- 2026-07-29 `npm run lint`: exit 0.
- 2026-07-29 `npm run test`: exit 0; 39 test files passed, 425 tests passed.
- 2026-07-29 `npm run build`: exit 0; Next.js generated 32 app routes.

## US1 evidence

- 2026-07-29 `npm run test -- src/features/ai/contracts.test.ts src/features/ai/repository.test.ts src/features/ai/hooks.test.ts src/features/ai/AiOverview.test.tsx`: exit 0; 4 test files passed, 27 tests passed.
- 2026-07-29 `npm run test:e2e -- tests/e2e/ai-management.spec.ts`: exit 0; Playwright ran the configured 5 viewport projects and 5 tests passed.

## US2 evidence

- 2026-07-29 `npm run test -- src/features/ai/contracts.test.ts src/features/ai/repository.test.ts src/mocks/phase5-ai-state.test.ts src/features/ai/AiViews.test.tsx`: exit 0; 4 test files passed, 32 tests passed for the implemented provider/model read surface and provider action validation.
- 2026-07-29 `npm run typecheck`: exit 0.
- 2026-07-29 `npm run lint`: exit 0.

## Local application

Run from `apps/admin-web`:

```powershell
npm run dev
```

Use the printed local URL. Phase 5 begins at `/admin/ai`.

## Focused verification

Exact filenames may be consolidated during implementation:

```powershell
npm run test -- src/features/ai/contracts.test.ts src/features/ai/repository.test.ts src/features/ai/hooks.test.ts src/features/ai/AIManagementViews.test.tsx src/mocks/phase5-ai-state.test.ts src/core/permissions/role-map.test.ts src/tests/no-direct-fixtures.test.ts
npm run test:e2e -- tests/e2e/ai-management.spec.ts --project=desktop-1440
npm run test:e2e -- tests/e2e/accessibility.spec.ts tests/e2e/permissions.spec.ts
npm run test:e2e -- tests/e2e/visual-preservation.spec.ts
```

Expected outcomes:

- Contracts reject unknown, oversized, unsafe, contradictory, or
  unauthorized values.
- Repository/state tests prove authoritative metrics, counting/currency
  semantics, safe projections, fallback/lifecycle invariants, conflicts,
  pending locks, and resets.
- Component tests exercise production schemas and views rather than duplicated
  test-only models.
- Browser tests complete the primary routes without content exposure, focus
  loss, console errors, blocking overflow, or false mutation success.

## Complete automated verification

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Every command must exit successfully. Never report inferred or skipped checks
as passing.

## Route verification

```text
/admin/ai
/admin/ai/providers
/admin/ai/providers/[providerId]
/admin/ai/models
/admin/ai/prompts
/admin/ai/prompts/[promptId]
/admin/ai/usage
/admin/ai/failures
/admin/ai/reports
/admin/ai/safety-rules
```

For applicable routes verify success, loading/slow, empty, large pagination,
partial regions, validation, aggregate/context/forbidden projections, not
found/expired, conflict/stale revision, rate limit, provider unavailable,
unsafe response/masking violation, internal error, and duplicate pending
mutation.

## Primary journey verification

1. **Overview**: Identify the highest-impact feature/provider/failure and open
   matching records within 90 seconds.
2. **Provider and model**: Review health/coverage and reject cyclic, duplicate,
   incompatible, uncovered, or stale fallback/assignment changes.
3. **Prompt lifecycle**: Verify Draft -> Testing -> Active -> Retired, required
   test gating, one Active per feature/locale, and rollback creating a Draft.
4. **Usage and failures**: Filter/paginate metadata, preserve one original
   request count, separate attempts/fallbacks, and triage safe failures.
5. **Reports**: Confirm only a future-backend-sanitized excerpt of at most 280
   characters is accepted; exercise every disposition.
6. **Safety**: Reject executable/oversized definitions, invalid transitions,
   stale revisions, and required-coverage gaps.

## Platform, counting, and cost verification

- Verify All, iOS, Android, and Unknown reporting context.
- Confirm unknown attribution is visible and never guessed.
- Confirm customer totals are not calculated by adding iOS and Android.
- Confirm retries/fallbacks do not inflate original-request totals.
- Confirm platform does not create separate fallback chains.
- Confirm currencies remain separate unless authoritative normalized amount,
  currency, and conversion timestamp are all present.

## Privacy and security verification

- Confirm usage/failure contracts contain metadata only.
- Confirm raw prompts, conversations, responses, customer financial values,
  provider payloads, keys, tokens, and credentials never enter UI contracts,
  fixtures, URLs, storage, logs, screenshots, errors, or environment values.
- Confirm report excerpts are allowlisted, future-backend supplied, capped at
  280 Unicode characters, and visibly masked/omitted.
- Confirm prompt previews/tests are explicitly fictional and bounded.
- Confirm limited projections structurally omit protected fields.
- Confirm unsafe HTML/Markdown, bidi-control abuse, unknown fields, malformed
  structures, executable prompt/safety definitions, and oversized inputs are
  rejected before rendering.
- Confirm direct forbidden mock mutations return safe forbidden errors.
- Confirm no real provider, backend, database, queue, or network operation
  occurs.

## Performance, responsive, direction, and accessibility verification

- Measure 20 representative standard mock overview/detail samples: at least
  95% show usable content within two seconds.
- Measure 20 representative standard filter/sort/pagination samples: at least
  95% complete within one second. Labeled slow scenarios are reported
  separately.
- Verify 1440px, 1280px, 1024px, 768px, and 390px.
- Verify Arabic RTL and English LTR readiness.
- At 390px, preserve overview/outage/severe report monitoring and show a
  desktop-required state for complex configuration.
- Verify keyboard flows, visible focus, focus restoration, semantic tables/
  cards/forms/dialogs, accessible chart summaries, status text beyond color,
  44px touch targets, bidirectional identifiers, and reduced motion.
- Capture page and console errors for every route smoke.

## Completion evidence

Record actual command exits, test counts, route/state coverage, performance,
viewport results, accessibility/privacy findings, and justified deferrals in
`tasks.md` or the implementation report. A completion claim requires observable
evidence for every acceptance criterion in `spec.md`.

## Risk-review completion evidence — 2026-07-29

### US2–US5 focused evidence

- `npx vitest run src/features/ai src/mocks/phase5-ai-state.test.ts`: exit 0;
  6 files and 52 tests passed.
- `npm run test:e2e -- tests/e2e/ai-management.spec.ts`: exit 0; 25 passed,
  0 skipped, and 0 failed. The same route, privacy, filter, confirmation, prompt
  gate, and focus flows passed at 1440, 1280, 1024, 768, and 390.
- All ten Phase 5 routes were exercised. Arabic RTL is the default; the shared
  language control was exercised for English LTR readiness.

### Static privacy and security review

The scoped production scan of `src/features/ai`, `src/app/admin/ai`, and the
AI mock boundary found no `dangerouslySetInnerHTML`, browser storage, debug
logging, public environment secrets, random/time-derived Phase 5 state, direct
production fixture imports, real provider/backend calls, or raw prompt,
response, credential, or provider-payload fields. Fixture imports found under
`src/features/ai` are test-only. Declarative safety definitions reject
executable fields, and sanitized report excerpts are bounded by Unicode code
point. The production controls deferred in `plan.md` remain documented and
unimplemented.

### Final required commands

| Command | Observed result |
|---|---|
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run test` | Exit 0; 45 files and 497 tests passed |
| `npm run test:e2e` | Exit 0; final Playwright artifact status `passed`, zero failed tests; 171 passed and 199 intentional project skips in the full run |
| `npm run build` | Exit 0; compiled successfully, generated 34 static pages, and emitted all ten Phase 5 routes |

The task ledger is now 76/118 checked. The remaining 42 markers describe
broader fixture permutations and more granular contract/state/hook/component/
direct-handler tests than were implemented. They remain unchecked rather than
being inferred from green aggregate verification. See `risk-review-report.md`
for the final risk decision.
