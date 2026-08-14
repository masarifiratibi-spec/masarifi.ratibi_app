# Implementation Plan: Daily Money Control

**Branch**: `005-daily-money-control` | **Date**: 2026-08-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-daily-money-control/spec.md`

## Summary

Replace the current Home, Transactions, Add, and Accounts shell placeholders with one ledger-centered daily money experience. Build account/category management, a virtualized and filterable transaction ledger, amount-first manual entry, transfers/refunds/corrections, Android automatic tracking and review, honest iOS alternatives, and foreground voice capture whose transcript and structured proposals require explicit confirmation. Extend the existing typed service, SQLite, TanStack Query, localization, privacy, platform-adapter, and design-system boundaries; add only the Expo SDK-compatible audio recording package needed for native microphone capture. Preserve integer-safe money calculations, atomic financial changes, offline drafts/sync states, Gulf Premium visuals, bilingual accessibility, and every undo/review/privacy guarantee.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, React Native Safe Area Context, TanStack Query 5, Zustand 4, React Hook Form 7, Zod 3, i18next 23, Expo SQLite 14, AsyncStorage, SecureStore, React Native SVG, existing Masarifi design system, and one SDK-compatible `expo-av` addition behind an audio adapter

**Storage**: Existing versioned Expo SQLite database extended as the durable local ledger and offline source for accounts, categories, transactions, drafts, detections, reviews, and voice proposals; existing preference/SecureStore boundaries remain unchanged; audio is ephemeral cache data deleted on terminal capture paths

**Testing**: Jest 29 and React Native Testing Library for money arithmetic, domain transitions, repositories/migrations, service contracts, filters, idempotency, forms, query invalidation, RTL/LTR, privacy, and critical journeys; Android development build for SMS/microphone permissions, keyboard, lifecycle, TalkBack, and masking; iOS native validation on macOS/Xcode for microphone, VoiceOver, and SMS-absence proof

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51; web remains a non-production preview with SMS and native audio behavior unavailable or mocked; portrait phones down to 320 by 568 logical pixels plus adaptive tablets

**Project Type**: Shared Expo/React Native mobile application with feature-oriented source modules and platform-aware adapters

**Performance Goals**: Render locally available Home data within 1 second after hydration; return ordinary 500-record search/filter interactions within 1 second; maintain smooth 60 fps list scrolling and feedback transitions on supported devices; show mutation/analysis progress immediately; prevent duplicate submission regardless of latency

**Constraints**: Frontend-only deterministic mocks for parsing, transcription, analysis, synchronization, and remote data; no production secrets/provider calls/direct route-to-database access; integer minor-unit money; atomic multi-entity writes; Arabic RTL and English LTR parity; English numerals with locale formatting; 200% text; 44 by 44 minimum targets; reduced motion; manual fallback after every permission/automation failure; no iOS SMS claim; raw SMS/audio/transcript/financial content excluded from analytics, notifications, errors, and unsafe previews

**Scale/Scope**: Five daily-money journeys; approximately 15 route surfaces; seven primary persisted entities plus derived summaries; at least 500 dense transaction fixtures; all account/category/transaction/source/status meanings; nine tracking states; deterministic clear, ambiguous, duplicate, failed, and voice-analysis scenarios

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust — PASS**: Money uses integer minor units and atomic commands. Clear automatic additions expose source/view/edit/undo, ambiguity and duplicates enter review, voice proposals require transcript review and confirmation, refunds/transfers have explicit semantics, drafts survive failure, and sensitive content is masked across visible and accessible surfaces.
- **Platform honesty — PASS**: Android extends the established education/permission/status adapter and retains manual/voice fallback for every outcome. iOS exposes direct SMS tracking as unavailable and never renders an SMS request or claim. Microphone permission and recording use one foreground-only adapter on both native platforms.
- **Language and access — PASS**: Contracts require Arabic RTL and English LTR, English numerals, mixed-direction financial runs, logical focus, coherent screen-reader announcements, 200% text, theme contrast, reduced motion, and 44 by 44 minimum targets across all states.
- **Design system — PASS**: Existing semantic tokens and financial, navigation, form, feedback, overlay, privacy, skeleton, chip, and state primitives are reused. Shared gaps are hardened centrally. Loading, first-use empty, filtered-empty, error, offline, disabled, permission, review, undo, conflict, and sync states are specified.
- **Architecture and proof — PASS**: SQLite is accessed only through repositories; typed services/adapters own business, platform, and mock behavior; TanStack Query is the single server-shaped coordinator; Zustand remains preference/transient state only; no client secret or production provider is introduced. Quickstart names automated and native proof.

## Project Structure

### Documentation (this feature)

```text
specs/005-daily-money-control/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   |-- daily-money-service-contract.md
|   `-- daily-money-ui-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- (tabs)/
|   |-- _layout.tsx                 # derive selected tab from active route
|   |-- home.tsx                    # daily summary composition
|   |-- transactions.tsx            # ledger/search/filter composition
|   `-- add.tsx                     # entry hub and amount-first form
|-- transactions/
|   |-- [id].tsx
|   `-- review/
|       |-- index.tsx
|       `-- [id].tsx
|-- accounts/
|   |-- index.tsx
|   |-- new.tsx
|   `-- [id]/
|       |-- index.tsx
|       `-- edit.tsx
|-- categories/
|   |-- index.tsx
|   |-- new.tsx
|   `-- [id].tsx
|-- tracking/
|   `-- index.tsx
`-- voice/
    |-- index.tsx
    `-- review.tsx

src/
|-- domain/
|   |-- daily-money.ts
|   `-- daily-money.test.ts
|-- features/
|   |-- home/
|   |-- transactions/
|   |-- accounts/
|   |-- categories/
|   |-- tracking/
|   `-- voice/
|-- services/
|   |-- contracts/
|   |   `-- daily-money-service.ts
|   |-- mocks/
|   |   |-- daily-money-service.ts
|   |   |-- detection-analyzer.ts
|   |   `-- voice-analyzer.ts
|   `-- platform/
|       |-- audio-recording-service.ts
|       `-- tracking-permission-service.ts  # extend current owner
|-- storage/
|   |-- database.ts                  # append versioned ledger migration
|   `-- daily-money-repository.ts
|-- state/
|   `-- daily-money-view-state.ts    # filters/transient UI only
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
|-- design-system/
|   `-- components/                  # harden/reuse existing shared primitives
`-- test-utils/
    `-- daily-money-fixtures.ts
```

Tests remain beside the domain, repository, service, feature, and route behavior they prove. No separate test architecture, feature-local token system, database layer, navigation library, or UI kit is added.

**Structure Decision**: Keep route modules thin and follow the existing feature-oriented `src` layout. Extend `src/domain`, `src/services`, `src/storage`, localization catalogs, platform adapters, and proven design-system owners rather than introducing parallel abstractions. SQLite owns durable ledger data, TanStack Query coordinates service-shaped state, and Zustand owns only preferences/transient view state.

## Implementation Strategy

### Slice 1: Ledger foundation and Home read model

- Define integer money, account, category, transaction, draft, detection, review, tracking, voice, and financial-change contracts.
- Add forward-only SQLite migration, indexes, repositories, deterministic fixtures, and atomic mutation tests.
- Create typed daily-money services and query-key ownership.
- Compose Home loading, empty, populated, partial, offline, stale, error, estimate, and hidden-value states.
- Fix selected-tab derivation in the shared shell as the root navigation defect.

### Slice 2: Transactions and manual entry

- Build repository-side query/filter/paging and a virtualized date-grouped ledger.
- Harden the shared transaction row for production density, mixed direction, combined announcements, amount reflow, source/review/sync semantics, and eligible actions.
- Add transaction detail, correction, delete lifecycle, duplicate-as-draft, and report-incorrect paths.
- Build amount-first expense/income/obligation-payment entry with durable drafts, keyboard-safe sticky save, validation focus, offline pending state, and duplicate-submit protection.
- Add atomic transfer and linked refund/reversal preview/confirmation flows.

### Slice 3: Accounts and categories

- Replace Accounts placeholder with list, empty, archived, detail, create/edit, adjustment-preview, and transfer entry points.
- Add searchable account/category selectors using existing picker/chip patterns.
- Add category catalogue, favorites/recent, bilingual custom category, archive-impact, and merge-impact flows.
- Invalidate Home, transaction filters, and account summaries through service mutation results.

### Slice 4: Automatic tracking and review

- Extend the established tracking status/permission owner; do not duplicate onboarding state.
- Add synthetic detection ingestion, deterministic classification, source idempotency, duplicate candidates, and exclusion fixtures.
- Build Android tracking status/recovery and review queue/detail surfaces.
- Apply clear items through the financial-change service with view/edit/undo; require preview/confirmation for review resolutions.
- Verify that iOS exposes only honest alternatives and that permission denial never blocks manual/voice capture.

### Slice 5: Voice recording and proposal review

- Add the SDK-compatible audio package and wrap foreground microphone permission/recording in one platform adapter.
- Build recording, duration, interruption, cancellation, processing, failure, and re-record states without a waveform dependency.
- Add deterministic mock transcription/analysis fixtures for all specified outcomes.
- Build transcript-first multi-proposal review with edit/remove/select/confirm and exact financial preview.
- Delete cached audio on every terminal path and prove no raw evidence enters analytics/errors.

### Slice 6: Cross-cutting hardening and acceptance

- Complete Arabic/English catalogs and mixed-direction validation.
- Harden shared sheets/dialogs for focus, back, keyboard, safe-area, and draft behavior only where used.
- Verify theme contrast, 200% text, screen readers, reduced motion, privacy masking, app-switcher/notification safety, dense lists, and all async state recovery.
- Run all automated checks and native matrix in [quickstart.md](quickstart.md).

## Phase 0: Research Outcome

[research.md](research.md) resolves money representation, durable storage, state ownership, atomic mutation and history behavior, indexed ledger search, component reuse, form validation, automatic-capture separation, SDK-compatible foreground audio, platform honesty, privacy, and verification strategy. No `NEEDS CLARIFICATION` item remains.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines exact money, account, category, transaction, draft, detection, review, voice, tracking, Home-summary, relationship, validation, transition, and privacy rules.
- [contracts/daily-money-service-contract.md](contracts/daily-money-service-contract.md) defines repository/service/native adapter operations, idempotency, atomicity, errors, and query invalidation.
- [contracts/daily-money-ui-contract.md](contracts/daily-money-ui-contract.md) defines route ownership, hierarchy, states, RTL, accessibility, privacy, responsive, and interaction behavior.
- [quickstart.md](quickstart.md) provides runnable static/automated commands and end-to-end Android/iOS validation scenarios.

## Post-Design Constitution Re-check

The Phase 1 artifacts preserve reversible and reviewable financial changes, one durable ledger owner, typed replaceable boundaries, integer-safe calculations, honest Android/iOS differences, manual fallback, ephemeral capture evidence, privacy masking, semantic design-system use, full Arabic/English access, and focused proof. No gate failed and no exception is required.

## Complexity Tracking

No constitution violation or additional project boundary requires justification. The one planned dependency addition is the pinned-SDK audio module required for actual microphone permission and foreground recording; no custom native module or extra state, database, list, form, animation, or UI library is introduced.
