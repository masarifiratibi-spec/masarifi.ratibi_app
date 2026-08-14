# Implementation Plan: Automatic Transaction Capture and Platform-Specific Tracking

**Branch**: `005-automatic-tracking` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-automatic-tracking/spec.md`

## Summary

Extend the existing Android permission and onboarding work into a complete frontend tracking
experience: status and recovery, deterministic mock detections, confidence decisions, review and
duplicate resolution, sender and keyword controls, obligation-match previews, automatic ledger
effects, 30-second undo, and privacy-limited source history. Reuse the existing SQLite ledger,
permission adapter, app-shell preferences, TanStack Query owner, design system, and localization.
iOS receives only honest manual, voice, and supported platform-assisted alternatives. No new
dependency, production SMS parser, background reader, provider integration, or production push
delivery is introduced.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, Expo SQLite 14, TanStack Query 5,
Zustand 4, Zod 3, i18next 23, AsyncStorage, React Native platform permission APIs, and the
existing Masarifi design system

**Storage**: Existing versioned SQLite database advances from schema version 2 to 3 for detected
events, reviews, duplicate candidates, sender rules, obligation-match projections, history, and
feedback. Existing AppShellStorage remains the owner of onboarding keywords and tracking mode;
full source text stays app-local and expires within 30 days.

**Testing**: Jest and React Native Testing Library for confidence policy, eligibility rejection,
permission and service-state mapping, lifecycle linking, duplicate merge, review resolution,
atomic ledger effects, 30-second undo, retention cleanup, keyword/sender validation, masking,
RTL/LTR, and route separation; Android development build for real permission/settings/lifecycle
checks; iOS native checks require macOS/Xcode

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51;
portrait phones down to 320 by 568 logical pixels and adaptive tablets

**Project Type**: Shared Expo and React Native mobile application with platform-specific adapters

**Performance Goals**: Show the first useful local tracking status within 1 second after
hydration; classify and display a deterministic mock event within 500 ms; return the first review
or history page within 300 ms for a 1,000-event fixture; preserve 60 frames per second during
ordinary list scrolling

**Constraints**: Frontend-only typed mocks; integer minor-unit money; one durable SQLite owner;
90% auto-add, 60-89% review, below-60% ignore; full source text local for at most 30 days; no
silent financial mutation; 30-second undo; no production secrets, parser, notification provider,
bank connection, or iOS SMS claim; manual capture remains available; Arabic RTL and English LTR
parity; 200% text scaling; 44 by 44 minimum targets

**Scale/Scope**: Five user journeys; Android status, history, review, duplicate, keyword, sender,
and demo routes plus iOS alternatives; at least 1,000 deterministic detections, 200 review items,
all 13 supported event types, all permission/service states, and Arabic/English rule packs

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: Confidence gates are deterministic. Review-required events cannot
  mutate finances. Automatic additions use the existing ledger owner, expose source and edit,
  provide exactly 30 seconds for undo, and update all affected projections atomically. Duplicate
  merges preserve the existing financial record. Full source text is masked, local-only,
  purgeable, and retained no longer than 30 days.
- **Platform honesty - PASS**: Android reuses the education-first permission adapter and exposes
  status, pause, recovery, and simulated tracking. iOS routes cannot expose SMS permission,
  sender rules, keywords, or Android service claims and retain manual, voice, and accurately
  supported platform-assisted capture. Permission denial and failure never block the app.
- **Language and access - PASS**: Every new string is added to Arabic and English catalogs.
  Layout uses logical direction, English numerals, locale-aware money/date formatting, combined
  screen-reader labels, 200% text support, reduced motion, contrast-safe statuses, and 44 by 44
  touch targets.
- **Design system - PASS**: Existing app bars, rows, cards, forms, chips, selectors, banners,
  dialogs, state views, skeletons, and undo feedback are reused. Loading, empty, error, offline,
  permission, paused, interrupted, battery-restricted, review, duplicate, disabled, and pending
  states use shared semantic tokens.
- **Architecture and proof - PASS**: Typed tracking contracts and one replaceable mock service
  sit above the existing SQLite boundary. TanStack Query owns persisted tracking reads; Zustand
  is limited to transient filters or selections. No provider call, production secret, parser, or
  duplicate financial store is introduced. Focused automated and native validation is defined in
  [quickstart.md](quickstart.md).

## Project Structure

### Documentation (this feature)

```text
specs/005-automatic-tracking/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- automatic-tracking-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- tracking/
|   |-- _layout.tsx
|   |-- index.tsx
|   |-- history.tsx
|   |-- keywords.tsx
|   |-- senders.tsx
|   |-- demo.tsx
|   |-- review/
|   |   |-- index.tsx
|   |   `-- [id].tsx
|   `-- duplicates/
|       `-- [id].tsx
|-- (onboarding)/
|   |-- android-sms-permission.tsx
|   |-- tracking-keywords.tsx
|   |-- tracking-preferences.tsx
|   |-- tracking-demo.tsx
|   |-- ios-capture-options.tsx
|   `-- ios-automation.tsx
|-- transactions/
|   `-- [id].tsx
`-- (tabs)/
    |-- home.tsx
    `-- more.tsx

src/
|-- domain/
|   `-- automatic-tracking.ts
|-- features/
|   `-- tracking/
|       |-- TrackingStatusScreen.tsx
|       |-- TrackingHistoryList.tsx
|       |-- ReviewQueue.tsx
|       |-- ReviewDetail.tsx
|       |-- DuplicateComparison.tsx
|       |-- SenderRuleList.tsx
|       `-- AutomaticFeedback.tsx
|-- services/
|   |-- contracts/
|   |   `-- automatic-tracking-service.ts
|   `-- mocks/
|       |-- automatic-tracking-service.ts
|       `-- automatic-tracking-fixtures.ts
|-- storage/
|   |-- database.ts
|   `-- automatic-tracking-repository.ts
|-- state/
|   `-- automatic-tracking-view-state.ts
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
`-- test-utils/
    `-- automatic-tracking-fixtures.ts
```

Tests remain beside the domain, repository, service, feature, and route behavior they prove.

**Structure Decision**: Keep route files thin and add one `tracking` feature boundary. Reuse the
existing permission service, onboarding keyword editor, tracking preference, SQLite ledger,
query provider, financial formatters, and design-system components. Add only the missing tracking
domain, repository, mock service, screens, routes, fixtures, and focused transient view state.

## Implementation Strategy

### Slice 1: Domain, persistence, and deterministic policy

- Define detected-event, tracking-status, review, duplicate, sender, obligation-match, history,
  and feedback contracts using existing account, category, transaction, permission, keyword, and
  tracking-preference types where they already fit.
- Advance SQLite to schema version 3 with forward-only tracking tables and indexes for status,
  review, source fingerprint, expiry, sender, and event time.
- Implement one pure decision policy for auto-add, review, reject, and ignore outcomes using the
  clarified confidence bands plus failure, authentication-code, marketing, duplicate, and
  conflict safeguards.
- Add deterministic Arabic and English fixtures for all supported event, confidence, duplicate,
  lifecycle, obligation, and error cases.

### Slice 2: Android status, recovery, rules, and platform separation

- Build tracking status from the existing permission adapter, persisted tracking mode, event
  counts, sender/keyword counts, background-service mock state, and latest activity.
- Add pause/resume, demo, clear-history confirmation, permission recovery, service interruption,
  battery restriction, offline, and restored states without blocking manual entry.
- Reuse and extend the onboarding keyword rules; add recent-use counts and deliberate confirmation
  before disabling the final active rule in a group. Add searchable sender management.
- Guard Android-only routes by platform capability. Keep iOS capture options and optional
  automation routes free of SMS permission, service, keyword, and sender controls.

### Slice 3: Automatic addition, review, duplicates, and lifecycle

- Process mock detections idempotently by source fingerprint and persist the decision before any
  user-visible result.
- Apply clear automatic transactions and associated tracking state in one SQLite transaction;
  expose source on the existing transaction detail and invalidate only affected queries.
- Build review queue/detail with explicit reasons, missing fields, account/category/obligation
  selection, confirm, edit, ignore, and report-wrong actions.
- Resolve duplicates by keeping existing, keeping new, keeping both, or enriching the existing
  record with confirmed missing details. Link clear completion, reversal, refund, and failure
  events to the original pending event; send uncertain relationships to review.
- Represent clear obligation effects through a replaceable mock obligation-effect boundary until
  SPEC-007 owns the full obligation ledger; never duplicate obligation state in Zustand.

### Slice 4: Feedback, privacy, accessibility, and acceptance

- Show in-app automatic-add feedback with view, edit, and a persisted 30-second undo deadline.
  Represent phone-notification outcomes through the typed mock boundary owned by this frontend
  phase; production delivery remains SPEC-009 work.
- Mask source text and amounts according to global privacy state, exclude them from logs and
  analytics, support immediate clear-history deletion, and purge full source text after 30 days.
- Complete Arabic/English content, mixed-direction values, screen-reader summaries, focus order,
  keyboard behavior, 200% text, reduced motion, light/dark themes, and small/large device layouts.
- Verify confidence, financial invariants, query invalidation, failure recovery, Android native
  permission behavior, and the absence of iOS SMS claims.

## Phase 0: Research Outcome

[research.md](research.md) resolves storage ownership, event identity, confidence policy,
financial atomicity, review lifecycle, duplicate merge, pending-event updates, permission and
service state, source retention, notifications, query ownership, iOS separation, and proof. No
planning question remains unresolved.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines fields, relationships, validation, retention, and state
  transitions for every SPEC-005 entity.
- [contracts/automatic-tracking-contract.md](contracts/automatic-tracking-contract.md) defines
  route, service, policy, persistence, financial mutation, permission, platform, privacy,
  localization, accessibility, and error behavior.
- [quickstart.md](quickstart.md) provides runnable automated checks and Android/iOS validation
  scenarios for every user story.

## Post-Design Constitution Re-check

The Phase 1 design keeps one financial ledger, reuses existing permission and preference owners,
requires explicit review for uncertainty, makes automatic changes reversible, limits source-text
retention, and keeps all iOS surfaces honest. Manual capture remains available in every failure
state. Arabic/English parity, semantic design-system reuse, typed replaceable boundaries, and
focused automated/native proof are explicit. No gate failed and no exception is required.

## Complexity Tracking

No constitution violation or additional dependency requires justification.
