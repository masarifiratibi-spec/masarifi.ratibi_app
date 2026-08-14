# Implementation Plan: Frontend Quality and Delivery

**Branch**: `010-frontend-quality` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-frontend-quality/spec.md`

## Summary

Harden the completed SPEC-001 through SPEC-009 frontend as one deliverable without redesigning
their features. Audit every server/platform capability against its existing typed contract and
owner, normalize only the missing version/replay/conflict guarantees, compose the existing
fixtures into a resettable cross-spec scenario catalog, and add one aggregate quality boundary
and delivery ledger. Verify Arabic/English parity, accessibility, privacy, offline/sync behavior,
dense-list performance, and the Android/iOS product stories with focused and full automation plus
honestly recorded native and participant evidence. Reuse current repositories, adapters, query
ownership, validation routes, and design-system components; add no generic service framework,
new production integration, dependency, or database migration unless an implementation audit
proves a SPEC-010 requirement cannot be met by the existing schema.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, Expo SQLite 14, Expo SecureStore 13,
Expo Notifications 0.28.19, TanStack Query 5, Zustand 4, Zod 3, i18next 23, React Hook Form 7,
React Native SVG 15, and the existing Masarifi design system; no new dependency planned

**Storage**: Existing SQLite schema v7 for authoritative local records, operation histories,
conflicts, notification/assistant history, subscriptions, and support; SecureStore-backed
preferences/session values; validation evidence and delivery-gate results remain versioned
documents rather than application records; no schema change planned

**Testing**: Jest 29 with jest-expo and React Native Testing Library; existing real stateful
SQLite test doubles/migration checks; Node boundary scripts; Android development-build validation
with ADB; iOS/VoiceOver validation on macOS/Xcode when available; structured participant evidence
for the 12-person bilingual accessibility/trust study

**Target Platform**: Android API 23+ with target API 34 and iOS versions supported by Expo SDK 51;
portrait phones down to 320 by 568 logical pixels, large phones, and adaptive tablets; web is a
non-authoritative preview for native capabilities

**Project Type**: Shared Expo and React Native mobile application with local typed providers

**Performance Goals**: Useful returning-user shell within 2 seconds in at least 95% of documented
runs; useful content within 2 seconds for 1,000-record transaction or notification fixtures;
fewer than 100 mounted content rows; stable duplicate-free paging; optional requests never block
primary navigation or manual capture

**Constraints**: Frontend-only; one owner per server-shaped record; stable operation IDs and exact
successful replay; no automatic merge/overwrite of financial conflicts; additive contract change
within a major version and migration/compatibility proof for breaking change; deterministic and
resettable scenarios; no secrets, provider calls, raw errors, sensitive analytics, camera,
receipts, investments, or iOS SMS claim; complete Arabic RTL/English LTR parity; English numerals;
200% text; screen readers; reduced motion; 44 by 44 targets; blocked required gates prevent closure
without a documented time-bounded product-owner exception

**Scale/Scope**: Final hardening across nine completed feature specs, eight existing boundary
areas, all Core V1 service contracts and feature routes, the existing 313-suite regression set,
at least 1,000 dense records per measured list, eight SPEC-010 user stories, two native platform
stories, and one 12-person bilingual accessibility/trust study

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust — PASS**: Existing finance, planning, report, assistant, notification,
  subscription, security, and support owners remain canonical. Stable operations replay exact
  success, failed attempts may retry, concurrent financial versions are preserved for explicit
  user selection, automatic changes expose correction/undo, and assistant mutations retain
  preview plus confirmation. Privacy checks cover UI, notifications, logs, analytics, evidence,
  and screen-reader output.
- **Platform honesty — PASS**: Existing Android tracking and local-notification adapters keep
  education, permission recovery, unavailable states, and manual fallbacks. iOS validation uses
  manual/voice alternatives and never claims direct SMS access. Native evidence is passed only on
  the actual platform; missing macOS/Xcode remains blocked unless the approved exception process
  is used.
- **Language and access — PASS**: Catalog parity, logical direction, English numerals,
  locale-aware formatting, screen readers, 200% text, non-color meaning, contrast, reduced motion,
  focus order, and minimum targets are aggregate delivery gates. Participant outcomes use the
  clarified bilingual sample, not automated-test inference.
- **Design system — PASS**: Existing semantic tokens, financial primitives, feedback states,
  forms, overlays, navigation, accessible charts, and validation routes are reused. SPEC-010 adds
  no parallel component library or feature-specific token set.
- **Architecture and proof — PASS**: Existing domain, service contract, mock/platform provider,
  repository, Query, and Zustand boundaries are audited and minimally corrected in place. One
  aggregate boundary script composes—not replaces—the current checks. Focused behavior tests,
  full regression, persistence proof, privacy inspection, performance fixtures, visual/native QA,
  and delivery evidence cover completion.

## Project Structure

### Documentation (this feature)

```text
specs/010-frontend-quality/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- frontend-quality-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
|-- spec.md
`-- validation.md                 # implementation/delivery evidence
```

### Source Code (`apps/mobile`)

```text
app/
|-- _layout.tsx
|-- (public)/                     # auth and language entry
|-- (onboarding)/                 # Android/iOS honest platform paths
|-- (tabs)/                       # Home, Transactions, Add, Reports, More
|-- foundation/                   # existing development validation routes
`-- [feature routes]/             # accounts through support; audited in place

src/
|-- domain/                       # canonical validated financial/lifecycle types
|-- services/
|   |-- contracts/                # capability contracts; add version metadata only where absent
|   |-- mocks/                    # deterministic providers
|   `-- platform/                 # permission, recording, biometric, notification adapters
|-- storage/                      # SQLite v7 repositories, operations, conflicts, protected storage
|-- state/                        # shell/preferences/drafts only; no server-record duplication
|-- features/                     # feature-owned screens, queries, controllers, and focused tests
|-- design-system/                # semantic components/tokens and accessibility checks
|-- localization/messages/        # Arabic/English catalogs
|-- analytics/                    # immutable allowlisted event definitions
`-- test-utils/
    |-- [existing feature fixtures]
    `-- frontend-quality-scenarios.ts  # thin manifest composing existing fixtures

scripts/
|-- check-[existing-feature]-boundaries.mjs
|-- check-frontend-quality-boundaries.mjs
`-- check-frontend-quality-boundaries.test.mjs
```

**Structure Decision**: Keep the current single mobile application and feature ownership. Add a
thin scenario manifest and aggregate boundary only where the specification needs cross-feature
proof. Contract version metadata belongs beside existing client contracts; operation and conflict
behavior stays in its owning repository/service. Do not add a service registry, event bus, second
state store, general repository layer, scenario database, analytics SDK, visual-test framework, or
release dashboard.

## Implementation Strategy

### Slice 1: Architecture inventory and enforceable ownership

- Build a requirements-to-owner inventory covering every Core V1 server/platform capability,
  contract, provider, repository, query owner, local-store allowance, route, and fallback.
- Add one aggregate boundary self-test and checker that runs the current eight feature boundaries
  and rejects direct provider/database use in UI, server-shaped records in Zustand, secrets,
  unsupported iOS SMS claims, sensitive logs/analytics, raw feature colors/strings, and unguarded
  financial mutation paths.
- Add explicit contract-major metadata and compatibility fixtures only to contracts that lack it;
  prove compatible additive results and reject incompatible major versions before a provider is
  used.
- Fix violations at the owning seam. Do not relocate working domains or introduce wrappers solely
  for architectural uniformity.

### Slice 2: Stable operation replay and non-destructive conflict resolution

- Audit manual, voice, tracking, finance, planning, report, notification, assistant, subscription,
  privacy, and support mutations for stable operation identity, exact success replay, failure
  eviction/retry, current-version checks, and one financial effect.
- Normalize missing behavior with the existing operation result patterns in each owner; do not add
  a global operation coordinator.
- Ensure conflict records preserve both local and later versions, their source/version/timestamp,
  and a safe financial-effect summary. Remove any automatic merge or overwrite branch.
- Add owner-level persistence and concurrency tests for simultaneous attempts, restart replay,
  rollback, explicit keep-local/keep-later/keep-both choices where valid, and unchanged unresolved
  records.

### Slice 3: Deterministic cross-spec scenarios and reset

- Compose existing foundation, shell, finance, tracking, voice, planning, reports, notification,
  assistant, subscription, settings, and support fixtures into one named scenario manifest.
- Cover new, empty, typical, dense, partial, stale, disabled, read-only, loading, failure, offline,
  permission, duplicate, low-confidence, pending, conflict, and recovery profiles with valid IDs
  and relationships.
- Provide a development/test-only selector using existing validation-route conventions and one
  reset command that clears only fixture-owned local records before reseeding a selected profile.
- Prove two resets yield equivalent observable state and that reset never touches non-fixture user
  data outside an explicitly disposable validation profile.

### Slice 4: Offline/sync truth and error recovery

- Trace local drafts/pending records through create, retry, fail, conflict, resolve, reconnect, and
  synchronized transitions; preserve input and never show pending work as synchronized.
- Standardize safe error outcomes and applicable user actions through existing feature state and
  feedback components, without exposing provider/storage text.
- Verify navigation and manual capture remain available while optional dashboard/report/assistant
  requests are delayed or failed.
- Add cross-feature journey tests proving one owner, correct invalidation, no duplicate effect, and
  consistent financial values after reconnect.

### Slice 5: Localization, accessibility, and visual hardening

- Run catalog parity and hard-coded-string gates across every route, state, notification, error,
  chart summary, and accessibility label; retain the approved English-numeral financial format.
- Audit logical layout/focus and directional icons in Arabic RTL and English LTR. Correct only
  actual mismatches using current primitives and tokens.
- Exercise 200% text, small/large phones, keyboard, long Arabic content, hidden values, themes,
  reduced motion, non-color status, charts, overlays, safe areas, and 44 by 44 targets.
- Record TalkBack and VoiceOver evidence on available native platforms. Conduct the clarified
  12-person bilingual study with at least four regular screen-reader users; keep raw participant
  identity and sensitive content outside the repository.

### Slice 6: Privacy, analytics, performance, and release evidence

- Enumerate all analytics definitions and construct immutable allowlisted payloads; add adversarial
  mutation tests and forbidden-field scans for amounts, balances, IDs, messages, transcripts,
  assistant/support content, secrets, and raw errors.
- Scan source, bundled configuration, test output, logs, screenshots, and retained evidence for
  production credentials and protected content. Redact or omit unsafe evidence rather than mask it
  after storage.
- Warm then measure startup shell and 1,000-record lists with stable fixtures; assert useful-content
  thresholds, mounted-row bound, stable paging, and optional-request non-blocking behavior.
- Create `validation.md` as the single ledger for command, environment/device, scenario, result,
  measurement, evidence path, warnings, risks, blocks, and approved exceptions.

### Slice 7: End-to-end product acceptance and closure

- Run Android sign-in, tracking education/choice, clear and uncertain capture, affected account/
  transaction/budget/report/obligation views, in-app and phone notifications, assistant explanation,
  correction/undo, permission recovery, foreground/background/cold response, offline retry, themes,
  languages, 200% text, and TalkBack.
- On macOS/Xcode, run the iOS sign-in plus manual/voice alternative through the same downstream
  financial, notification, assistant, and correction outcomes; explicitly verify zero SMS-access
  claims and VoiceOver behavior.
- Re-run every focused gate, all boundary self-tests, typecheck, lint, full Jest, privacy scan, and
  performance measures after native fixes.
- Mark closure only when every required gate passes or a product-owner exception records scope,
  risk, owner, expiry, and follow-up evidence. Task markers alone are never acceptance proof.

## Phase 0: Research Outcome

[research.md](research.md) records the decisions to harden the existing feature architecture,
version contracts without a registry, keep operation replay with its owner, preserve conflicts,
compose fixtures rather than duplicate them, retain schema v7, use a document-based delivery
ledger, aggregate current boundaries, measure existing virtualized lists, and require honest native
and participant evidence. No planning clarification remains open.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines capability metadata, providers, scenario profiles,
  authoritative and pending record references, operation results, preserved conflicts, validation
  cases, delivery gates/exceptions, and analytics definitions plus their invariants and lifecycles.
- [contracts/frontend-quality-contract.md](contracts/frontend-quality-contract.md) defines ownership,
  compatibility, replay, conflict, scenario reset, sync, error, analytics, evidence, release-gate,
  performance, accessibility, and platform-acceptance contracts.
- [quickstart.md](quickstart.md) provides runnable architecture, focused/full automation, scenario,
  persistence, offline/conflict, localization/accessibility, privacy, performance, native Android,
  native iOS, participant-study, and closure validation procedures.

## Post-Design Constitution Re-check

The design keeps every financial calculation and record with its existing owner, adds no silent
mutation path, and strengthens replay/conflict evidence. Android/iOS differences remain explicit
with manual alternatives and real native proof. Arabic/English, privacy, hidden values,
accessibility, semantic design components, all async states, offline recovery, typed boundaries,
and release evidence are mandatory gates. The design adds no production provider, secret, direct
database UI access, duplicate server state, unsupported feature, or unnecessary framework. All
constitution gates remain passed; no complexity exception is required.

## Complexity Tracking

No constitution violation requires justification. The only planned cross-feature additions are a
thin fixture manifest, an aggregate boundary checker, and delivery evidence; each directly proves
SPEC-010 requirements and reuses existing implementations.
