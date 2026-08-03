# Implementation Plan: Imports, Automation, Banks, and Parser Management

**Phase / Spec**: Phase 4 / Spec 005 of 010  
**Date**: 2026-07-29  
**Spec**: [`spec.md`](./spec.md)  
**Input**: Admin Web feature specification

## Summary

Extend the approved `/admin/imports` experience and activate the planned Parser
Management area with 16 frontend-only routes. Preserve the current import page
visual hierarchy while moving its affected data flow onto the expanded,
validated Spec 005 contracts. Use the existing typed API client, TanStack Query,
MSW, shared Admin components, permissions, and test stack. All imported content
remains masked or allowlisted; parser rules remain bounded declarative data; all
mutations are confirmed mock-runtime outcomes. No real parser, transaction,
file, queue, bank, database, backend, or provider operation is included.

## Technical Context

**Language**: TypeScript 5.x in strict mode; no `any`  
**Framework**: Existing Next.js App Router and React application  
**UI and data stack**: Existing Tailwind CSS, TanStack Query, TanStack Table,
React Hook Form, Zod, Recharts, and Lucide Icons  
**Mock boundary**: Existing API client and repository pattern backed by Mock
Service Worker; requests, responses, identifiers, and mutations validated at
the boundary  
**Testing**: Existing Vitest and Playwright setup  
**Storage**: MSW runtime memory only; mutable state resets on reload,
development-server restart, or scenario reset and never enters browser storage  
**Direction**: Arabic RTL default; English LTR ready  
**Target viewports**: 1440px, 1280px, 1024px, 768px, 390px  
**Scope**: Existing `apps/admin-web` project only; no backend implementation,
project initialization, package, or dependency change  
**Performance and scale**: Lists default to 25 rows, allow 25/50/100, and cap
at 100; search/name inputs cap at 120 Unicode characters; reasons/notes at 500;
patterns at 256; sanitized samples at 4 KiB UTF-8; rule definitions and
expected outputs at 8 KiB UTF-8; merchant aliases at 20 entries of 120
characters. An operator must identify the highest-failure source and reach the
matching sessions within 90 seconds. All five viewport journeys must complete
without blocking overflow.  
**Existing implementation**: `/admin/imports`,
`src/features/imports/{contracts,repository,hooks}.ts`, import fixtures/handlers,
navigation, permissions, and focused tests already exist as the approved
foundation. They are extended in place rather than duplicated.

## Constitution Check

*GATE: Evaluated before Phase 0 and re-evaluated after Phase 1 design.*

- [x] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature maps to Phase 4 and planned import, parser, transaction, file, job, permission, and audit capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, parser runtime, queue, bank integration, or real authentication is implemented.
- [x] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [x] Mock HTTP contracts are replaceable by the future NestJS API.
- [x] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [x] RTL/LTR, accessibility, reduced motion, bidirectional identifiers, and all approved viewports are covered.
- [x] Relevant loading, empty, partial, error, success, warning, and permission states are covered.
- [x] Customer/import/financial data is masked or allowlisted; sensitive actions require confirmation.
- [x] External, mocked, user-entered, URL, imported, parser, and API values are treated as untrusted and validated with Zod.
- [x] Rendering, parser previews, links, file boundaries, client storage, environment exposure, errors, and logs are constrained safely.
- [x] Mock permissions remain development-only UX controls; future backend authorization is documented.
- [x] Dependencies remain unchanged.
- [x] Security-sensitive behavior has planned accessible Vitest and Playwright coverage.
- [x] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

**Initial gate result**: PASS. No constitution deviation requires approval.

## Project Structure

### Feature documentation

```text
specs/005-admin-imports-and-parsers/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── admin-imports-parsers.openapi.yaml
└── tasks.md                       # created by /speckit-tasks
```

### Planned Admin Web source footprint

```text
src/
├── app/admin/
│   ├── imports/
│   │   ├── page.tsx                         # preserve and extend approved page
│   │   ├── sessions/page.tsx
│   │   ├── sessions/[importId]/page.tsx
│   │   ├── failed/page.tsx
│   │   ├── low-confidence/page.tsx
│   │   ├── duplicates/page.tsx
│   │   └── unsupported/page.tsx
│   └── parsers/
│       ├── banks/page.tsx
│       ├── banks/[bankId]/page.tsx
│       ├── senders/page.tsx
│       ├── rules/page.tsx
│       ├── rules/[ruleId]/page.tsx
│       ├── test-cases/page.tsx
│       ├── versions/page.tsx
│       ├── merchant-rules/page.tsx
│       └── category-rules/page.tsx
├── features/imports/
│   ├── contracts.ts                        # extend existing
│   ├── repository.ts                       # extend existing
│   ├── hooks.ts                            # extend existing
│   ├── ImportsViews.tsx                    # grouped import/session/queue views
│   ├── ParserViews.tsx                     # grouped bank/rule/test/version views
│   └── RuleManagementViews.tsx             # add only if ParserViews needs a cohesive split
├── mocks/
│   ├── fixtures/imports.ts                 # replace affected legacy shapes
│   ├── handlers/imports.ts                 # extend existing
│   └── phase4-import-state.ts
└── core/permissions/
    ├── permissions.ts
    └── role-map.ts

tests/e2e/
└── imports-parsers.spec.ts
```

The exact component filenames are selected during tasks/implementation around
cohesive views; the plan intentionally does not require one wrapper file per
route. Tests remain beside the smallest production unit they verify.

**Structure decision**: Keep the entire phase inside the existing
`features/imports` boundary because import triage and parser management share
contracts, permissions, safe identifiers, mock state, and operational handoffs.
Use a few cohesive grouped views, not one component per route and not one giant
view file. Extend the existing import fixture and handler family and add one
Phase 4 runtime-state module only where mutation/history behavior requires it.

## Implementation Design

### 1. Preserve and harden the existing import foundation

1. Retain the approved `/admin/imports` layout, card hierarchy, charts, table
   density, Arabic copy style, responsive behavior, and design tokens.
2. Extend the existing import contracts, repository, hooks, fixtures, and
   handlers rather than adding a parallel overview implementation.
3. Replace affected legacy generic `ImportRecord` usage with the Spec 005
   feature contracts where necessary; do not refactor unrelated shared types.
4. Keep page files thin: route composition, permission boundary, and feature
   view only. No page imports a fixture.

### 2. Contract and repository boundaries

1. Define explicit Zod schemas for query parameters, safe identifiers,
   platform/source/status filters, pagination, details, previews, actions, and
   error responses.
2. Parse and bound all route/search/filter/sort/page/form values before request
   construction and validate every response before presentation.
3. Keep import and parser endpoints in the existing
   `features/imports/repository.ts`; split the file later only if implementation
   size produces a measured review/ownership problem.
4. Expose TanStack Query hooks and locked mutation hooks; components never call
   `fetch`, MSW, or fixture modules directly.
5. Treat combined event totals, deduplication state, confidence, review
   eligibility, parser test results, and version eligibility as authoritative
   contract values. Do not recompute them in views.

### 3. Sanitized data and parser safety

1. Import-session and unsupported-format previews allow only source, masked
   bank/sender, transaction direction/type, ISO currency, coarse date, masked
   merchant/category, confidence, warnings, and omission labels.
2. Customer-derived amounts and other value-bearing fields remain masked.
3. Parser tests may expose full normalized values only for explicitly labelled,
   locally seeded fictional samples unrelated to customer data.
4. Parser rules use a bounded declarative structure containing allowlisted
   match, capture, normalization, and output-mapping operations. No arbitrary
   code, dynamic evaluation, recursive structure, network call, or unbounded
   executable pattern is accepted.
5. Imported strings, patterns, diagnostics, and structured previews render as
   plain text; no raw HTML/Markdown/JSON console is introduced.

### 4. Mock HTTP and runtime state

1. Extend the registered import handler family; do not add a parallel handler
   registry.
2. Seed deterministic UAE/Saudi, Arabic/English, iOS/Android, multi-source,
   retry/replay, failure, confidence, duplicate, unsupported, bank, sender,
   rule, test, version, merchant, and category cases.
3. Keep mutations in module memory only and reset on reload, server restart, or
   scenario reset.
4. Support success, empty, large, slow, partial, unauthorized, forbidden, not
   found, expired, validation, conflict, rate limited, unavailable, unsafe
   response, and internal-error scenarios.
5. Enforce expected-current-state and pending locks for retry handoffs,
   exception reviews, sender/rule changes, version actions, and
   merchant/category changes.
6. Add the validated development-only simulated role to mock requests so MSW
   can return safe forbidden responses for direct mutation attempts. This
   remains UX/test simulation and is never described as production
   authorization.

### 5. UI delivery order

1. Extend Import Overview and deliver the session list/detail routes.
2. Deliver failed, low-confidence, duplicate, and unsupported-format queues.
3. Activate Parser Management navigation and deliver supported-bank/detail and
   sender routes.
4. Deliver parser-rule list/editor/test preview, test cases, and versions.
5. Deliver merchant and category rule routes.
6. Add route/action permissions, all relevant states, confirmation, pending
   locks, conflict recovery, announcements, responsive behavior, and
   accessibility across the completed flows.
7. At 390px, retain monitoring and urgent triage; show the specified
   desktop-required state for complex rule editing, comparison, version
   release, and bulk configuration.

### 6. Parser version lifecycle

1. Model `draft -> testing -> active -> retired`.
2. Allow one active version per declared parser scope.
3. Block activation unless every enabled required test passes.
4. Simulated rollback creates a new draft based on the selected historical
   version; it never edits immutable version history.
5. Invalid transition, stale version, missing test, existing active version,
   denied permission, and duplicate submission return safe explicit outcomes.

### 7. Verification strategy

- **Vitest contracts**: valid/invalid bounds, strict unknown-field rejection,
  safe identifiers, response masking, platform/event invariants, declarative
  rule allowlist, lifecycle transitions, and unsafe-response rejection.
- **Vitest repositories/hooks**: query serialization, response validation,
  authoritative totals, scenario matrix, cache invalidation, pending locks,
  conflicts, and reset behavior.
- **Vitest components**: forms, errors, tables/cards, region states, previews,
  permission labels, confirmations, focus restoration, status announcements,
  and desktop-required state.
- **Playwright**: all 16 routes, primary import/session/triage/bank/parser
  journeys, denied routes/actions, masking, unsafe text, lifecycle gating,
  keyboard dialogs/focus, RTL/LTR, reduced motion, and five-viewport visual/
  overflow/runtime-console checks.
- **Static review**: no `any`, direct fixture imports, raw customer content,
  unsafe HTML, debug logs, secrets, browser persistence, backend routes, new
  dependencies, or scattered raw colors in changed production files.

## Backend Alignment

**Planned modules**: `transaction-imports`, `transaction-parsers`,
`transactions` (normalized outcomes only), `files` (metadata only), `jobs`
(future processing handoff), `users`, `profiles`, `devices`, `roles`,
`permissions`, and `audit-logs`  
**Planned entities**: `transaction_imports`, `imported_messages`,
`import_items`, `duplicate_candidates`, `parser_rules`, `parser_versions`,
`merchant_rules`, `merchant_aliases`, `uploaded_files`, `transactions`,
`categories`, `profiles`, `devices`, `audit_logs`, and role/permission mappings  
**Proposed contracts**: Typed frontend models and mock HTTP operations in
[`contracts/admin-imports-parsers.openapi.yaml`](./contracts/admin-imports-parsers.openapi.yaml)  
**Deferred production security**: NestJS authorization/validation,
Supabase Auth/RLS and persistence, storage isolation, upload/content scanning,
retention deletion, encryption, parser execution sandboxing/resource limits,
deduplication and transaction integrity, queue/idempotency controls, immutable
audit storage, rate limiting, monitoring, and incident response

## Post-Design Constitution Check

**Result**: PASS. Research, data model, API contract, and quickstart preserve the
approved import UI, use the existing import feature boundary, add no
dependency or persistence, keep all data behind typed replaceable repositories,
and explicitly cover masking, untrusted input, parser safety, permissions,
confirmation, accessibility, RTL/LTR, responsive behavior, complete UI states,
and evidence-based verification. No deviation or unresolved clarification
remains.

## Complexity Tracking

No constitution deviation. Extending the existing import feature with a few
cohesive grouped views is the minimum structure that preserves current code
without creating a second feature package or a single oversized 16-route view.
