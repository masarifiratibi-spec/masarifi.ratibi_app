# Quickstart: Spec 005 Planning and Verification

## Scope

Implement only Phase 4 inside `apps/admin-web`. Preserve and extend the approved
`/admin/imports` page, then add the planned import-session, exception, bank,
sender, parser, version, merchant, and category routes. Reuse the existing
Admin shell, components, semantic tokens, typed API client, import feature
boundary, query provider, permission system, MSW setup, and tests.

Do not initialize a project, install dependencies, connect NestJS/Supabase,
process files or messages, run parsers, create transactions, control queues,
connect banks, persist mock state, or redesign the approved UI.

## Prerequisites

- Existing Admin Web dependencies are installed.
- Specs 001-004 and their shared behavior remain intact.
- The active feature directory is `specs/005-admin-imports-and-parsers`.
- Phase 4 implementation tasks have been generated and completed before this
  guide is used as a completion check.

## Planning artifacts

- [`spec.md`](./spec.md): clarified requirements and acceptance criteria
- [`plan.md`](./plan.md): architecture and constitution gates
- [`research.md`](./research.md): resolved planning decisions
- [`data-model.md`](./data-model.md): read models, commands, invariants, and
  transitions
- [`contracts/admin-imports-parsers.openapi.yaml`](./contracts/admin-imports-parsers.openapi.yaml):
  proposed replaceable frontend contract
- `tasks.md`: generated later by `/speckit-tasks`

## Implementation sequence

1. Add RED contract tests for strict schemas, bounds, safe projections,
   authoritative totals, declarative rules, and version lifecycle.
2. Extend the existing import contracts and add deterministic fictional
   fixtures, validated handlers, and resettable Phase 4 runtime state.
3. Extend the existing repository/hooks and locked mutations.
4. Add granular permissions, route precedence, development-only role forwarding
   to mock handlers, and activate Parser Management navigation.
5. Preserve and extend Import Overview; then add sessions and exception queues.
6. Add bank/sender, parser rule/test/version, and merchant/category routes.
7. Add component and browser coverage for privacy, permissions, confirmations,
   accessibility, RTL/LTR, responsive behavior, and all relevant states.
8. Run focused checks, then the complete verification suite. Update task
   checkboxes only with evidence actually observed.

## Local application

Run from `apps/admin-web`:

```powershell
npm run dev
```

Use the local URL printed by Next.js. The default Admin route is `/admin`; the
Phase 4 entry route is `/admin/imports`.

## Focused verification

Exact filenames may be consolidated during implementation when one grouped test
better matches the final view structure. Run the applicable focused files:

```powershell
npm run test -- src/features/imports/contracts.test.ts src/features/imports/repository.test.ts src/features/imports/hooks.test.ts src/features/imports/ImportParserViews.test.tsx src/mocks/phase4-import-state.test.ts src/core/permissions/role-map.test.ts src/tests/no-direct-fixtures.test.ts
npm run test:e2e -- tests/e2e/imports-parsers.spec.ts --project=desktop-1440
npm run test:e2e -- tests/e2e/accessibility.spec.ts tests/e2e/permissions.spec.ts
npm run test:e2e -- tests/e2e/visual-preservation.spec.ts
```

Expected outcomes:

- Contract tests accept boundary values and reject unknown, oversized, unsafe,
  contradictory, or unauthorized values.
- Repository/state tests prove authoritative totals, safe projections,
  scenario behavior, lifecycle invariants, conflict handling, reset behavior,
  and pending locks.
- Component tests exercise production schemas and views rather than duplicated
  inline models.
- Browser tests complete the Phase 4 journeys without raw-content exposure,
  focus loss, console errors, blocking overflow, or false mutation success.

## Complete automated verification

Run after all focused checks pass:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Each command must exit successfully. Do not report a command as passing if it
was skipped, inferred, or failed.

## Route verification

Open all Phase 4 routes:

```text
/admin/imports
/admin/imports/sessions
/admin/imports/sessions/[importId]
/admin/imports/failed
/admin/imports/low-confidence
/admin/imports/duplicates
/admin/imports/unsupported
/admin/parsers/banks
/admin/parsers/banks/[bankId]
/admin/parsers/senders
/admin/parsers/rules
/admin/parsers/rules/[ruleId]
/admin/parsers/test-cases
/admin/parsers/versions
/admin/parsers/merchant-rules
/admin/parsers/category-rules
```

For applicable routes verify:

- default success
- loading/slow
- empty
- large pagination
- partial region
- validation
- forbidden and limited/context projections
- not found and gone
- conflict and stale revision
- rate limited
- unavailable
- unsafe response/masking violation
- internal error
- pending duplicate mutation

## Primary journey verification

1. **Overview to sessions**: Identify the highest-failure source, apply the
   matching filters, and reach the session list within 90 seconds.
2. **Session detail and retry handoff**: Confirm safe metadata/preview,
   permission projection, confirmation, pending lock, conflict, and mock result.
3. **Exception queues**: Exercise the permitted outcomes for failed,
   low-confidence, duplicate, and unsupported-format records.
4. **Bank and sender coverage**: Review bank regions and reject malformed,
   unsafe, overlapping, or stale sender changes.
5. **Parser rule and test preview**: Reject non-declarative/oversized input and
   compare only explicitly fictional expected/actual normalized values.
6. **Version lifecycle**: Verify Draft -> Testing -> Active -> Retired, one
   Active per scope, mandatory-test gating, and rollback creating a new Draft.
7. **Merchant/category rules**: Verify alias/pattern/confidence/scope bounds,
   overlap conflicts, confirmation, and accessible outcomes.

## Platform and counting verification

- Verify All, Android, and iOS source/volume/performance views.
- Confirm Android shows only applicable SMS/notification capability context.
- Confirm iOS shows only applicable Shortcut/App Intent/Share Extension/
  screenshot/receipt/voice context.
- Confirm combined event totals are additive only when explicitly marked
  non-duplicated.
- Confirm retries, replays, and duplicate candidates do not inflate original
  import totals.
- Confirm no unique customer total is calculated by adding iOS and Android.

## Privacy and security verification

- Confirm customer-linked previews contain only the documented allowlist.
- Confirm amounts and other customer-derived value fields remain masked.
- Confirm full normalized values appear only in explicitly fictional parser
  tests.
- Confirm limited/context responses structurally omit previews, parser
  definitions, and protected actions.
- Confirm unsafe markup, bidi-control abuse, unknown fields, recursive/dynamic
  rule definitions, malformed patterns, oversized UTF-8 input, and raw payloads
  are rejected before rendering.
- Confirm direct forbidden mock mutations return a safe forbidden error, even
  if UI controls are bypassed.
- Confirm imported content, parser drafts, samples, customer values, action
  state, tokens, and secrets do not enter URLs, browser storage, logs,
  screenshots, errors, or browser-visible environment variables.
- Confirm no real file, parser, queue, transaction, bank, backend, database, or
  provider call occurs.

## Responsive, direction, and accessibility verification

- Verify 1440px, 1280px, 1024px, 768px, and 390px.
- Verify Arabic RTL and English LTR readiness.
- At 390px, verify monitoring and urgent triage remain available while complex
  parser editing, comparison, version release, and bulk configuration show the
  desktop-required state.
- Verify keyboard search/filter/pagination/detail/confirmation/cancel flows,
  visible focus, focus restoration, semantic tables/cards/forms/dialogs,
  accessible chart summaries, status text beyond color, 44px touch targets,
  bidirectional identifiers, and reduced motion.
- Capture browser console/page errors for every route smoke.

## Completion evidence

Record actual command exits, test counts, route/state coverage, viewport
results, accessibility/privacy findings, and any justified deferral in the
implementation report or `tasks.md`. A Phase 4 completion claim requires
observable evidence for every acceptance criterion in `spec.md`.

## Completion evidence recorded on 2026-07-29

The final completion pass preserved the current implementation structure and
verified the remaining implementation tasks without recreating historical RED
evidence.

- `npm run typecheck`: PASS, exit 0
- `npm run lint`: PASS, exit 0
- Focused Spec 005 Vitest command: PASS, 5 files / 121 tests
- Focused Spec 005 Playwright route checks across 1440, 1280, 1024, 768, and
  390: PASS, 12 passed / 28 intentional project skips
- Focused permissions Playwright check: PASS, 14 passed / 56 intentional
  project skips
- Focused accessibility Playwright check: PASS, 7 passed / 18 intentional
  project skips
- `npm run test`: PASS, 39 files / 425 tests
- `npm run test:e2e`: PASS, 132 passed / 188 intentional project skips
- `npm run build`: PASS, Next.js production build generated 26 static pages,
  including all 16 Spec 005 routes

The remaining unchecked tasks are historical RED/baseline tasks whose required
pre-implementation failures were not captured before code existed. They remain
unchecked intentionally and are documented in `verification-report.md`; they are
not missing Phase 4 runtime implementation.
