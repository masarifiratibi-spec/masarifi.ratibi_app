# Tasks: Product Foundation, Scope, and UX Principles

**Input**: Design documents from `specs/001-mobile-foundation/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and
`quickstart.md`

**Tests**: Jest and React Native Testing Library tests are required for changed behavior.
Native privacy, permission, RTL, and accessibility behavior also requires development-build
validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested
as an independent foundation-harness route.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no incomplete task
  dependency.
- **[Story]**: Maps the task to its user story.
- Every task includes its exact project path.

## Phase 1: Mobile Project Setup

**Purpose**: Initialize the currently empty mobile runtime without altering Spec Kit artifacts.

- [x] T001 Initialize the Expo Router TypeScript application in `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/tsconfig.json`, and `apps/mobile/expo-env.d.ts`
- [x] T002 Install Expo-compatible runtime dependencies and scripts from the plan in `apps/mobile/package.json`
- [x] T003 [P] Configure Jest and React Native Testing Library in `apps/mobile/jest.config.js` and `apps/mobile/src/test-utils/setup.ts`
- [x] T004 [P] Configure linting and formatting in `apps/mobile/eslint.config.js` and `apps/mobile/.prettierrc.json`
- [x] T005 [P] Protect local secrets and generated native output in `apps/mobile/.gitignore` and document public configuration keys in `apps/mobile/.env.example`

**Checkpoint**: The application installs, type-checks, and starts with the default Expo Router
entry while preserving `.specify/` and `specs/`.

---

## Phase 2: Shared Foundation

**Purpose**: Create the blocking contracts and providers used by every user story.

**CRITICAL**: No user-story implementation begins until this phase is complete.

- [x] T006 Define ProductCapability, CaptureMethod, FinancialChange, PlatformCapability, PermissionState, FrontendState, ReportingCurrency, UserPreferences, and OfflineEntry types in `apps/mobile/src/domain/foundation.ts`
- [x] T007 [P] Create the single mobile semantic-token adapter and light/dark theme mapping in `apps/mobile/src/design-system/tokens.ts` and `apps/mobile/src/design-system/theme.ts`
- [x] T008 [P] Create complete Arabic and English message catalogs in `apps/mobile/src/localization/messages/ar.ts` and `apps/mobile/src/localization/messages/en.ts`
- [x] T009 Configure locale selection, RTL direction, and message resolution in `apps/mobile/src/localization/i18n.ts`
- [x] T010 [P] Define typed capability, permission, financial-change, and summary interfaces in `apps/mobile/src/services/contracts/foundation-service.ts`
- [x] T011 Create the SQLite schema and migration entry for offline records and sync state in `apps/mobile/src/storage/database.ts`
- [x] T012 [P] Implement protected locale, theme, base-currency, and hide-balance persistence in `apps/mobile/src/storage/secure-preferences.ts`
- [x] T013 Implement the Zustand preference store over secure persistence in `apps/mobile/src/state/preferences.ts`
- [x] T014 Compose theme, localization, query, and storage providers in `apps/mobile/app/_layout.tsx` and create the four-route validation menu in `apps/mobile/app/index.tsx`

**Checkpoint**: Shared types, tokens, localization, persistence, and providers are available;
the validation menu loads without implementing later product screens.

---

## Phase 3: User Story 1 - Understand My Financial Position Quickly (Priority: P1) MVP

**Goal**: Demonstrate a clear current-position summary for populated, empty, and partial data.

**Independent Test**: Open `/foundation/position` with each mock scenario and identify balance,
spending, next obligation, review status, data completeness, and one next action.

### Tests for User Story 1

- [x] T015 [P] [US1] Write failing English-numeral and estimated-currency formatting tests in `apps/mobile/src/utils/format-financial-value.test.ts`
- [x] T016 [P] [US1] Write failing populated, empty, and partial summary component tests in `apps/mobile/src/features/foundation/FinancialPositionPanel.test.tsx`

### Implementation for User Story 1

- [x] T017 [US1] Implement locale-aware English-numeral amount and date formatting in `apps/mobile/src/utils/format-financial-value.ts`
- [x] T018 [P] [US1] Implement deterministic populated, empty, and partial summary fixtures in `apps/mobile/src/services/mocks/financial-summary.ts`
- [x] T019 [US1] Implement the accessible financial position panel using semantic tokens in `apps/mobile/src/features/foundation/FinancialPositionPanel.tsx`
- [x] T020 [US1] Expose the independently runnable position harness in `apps/mobile/app/foundation/position.tsx`

**Checkpoint**: User Story 1 tests pass and the MVP route communicates financial position
without feature screens from later specifications.

---

## Phase 4: User Story 2 - Capture Activity With Minimal Effort (Priority: P1)

**Goal**: Demonstrate honest Android/iOS capability states, optional permissions, fallback
capture, and durable offline manual entry.

**Independent Test**: Open `/foundation/capture`, switch platform and permission states, decline
automation, save an offline entry, restart, edit it, and exercise retry and conflict states.

### Tests for User Story 2

- [x] T021 [P] [US2] Write failing platform capability, permission-transition, and fallback visibility tests in `apps/mobile/src/services/mocks/platform-capabilities.test.ts`
- [x] T022 [P] [US2] Write failing pending, retry, conflict, edit, delete, and confirmed-sync repository tests in `apps/mobile/src/storage/local-records.test.ts`
- [x] T023 [P] [US2] Write failing Android/iOS capture panel tests in `apps/mobile/src/features/foundation/CaptureFallbackPanel.test.tsx`

### Implementation for User Story 2

- [x] T024 [US2] Implement deterministic Android/iOS capability and permission adapters in `apps/mobile/src/services/mocks/platform-capabilities.ts`
- [x] T025 [US2] Implement validated SQLite offline-entry persistence and sync transitions in `apps/mobile/src/storage/local-records.ts`
- [x] T026 [US2] Implement permission education, skip/recovery actions, platform alternatives, and offline status UI in `apps/mobile/src/features/foundation/CaptureFallbackPanel.tsx`
- [x] T027 [US2] Expose the independently runnable capture harness in `apps/mobile/app/foundation/capture.tsx`

**Checkpoint**: User Story 2 tests pass; Android and iOS remain usable after permission denial,
and offline entries are never falsely labeled synchronized.

---

## Phase 5: User Story 3 - Trust and Correct Financial Changes (Priority: P1)

**Goal**: Demonstrate source visibility, review routing, assistant confirmation, correction,
privacy masking, and actionable errors.

**Independent Test**: Open `/foundation/trust` and trigger clear, ambiguous, duplicate, failed,
and assistant-proposed changes; verify each allowed transition and sensitive-display rule.

### Tests for User Story 3

- [x] T028 [P] [US3] Write failing financial-change transition and invalid-transition tests in `apps/mobile/src/domain/financial-change.test.ts`
- [x] T029 [P] [US3] Write failing authenticated, hidden-balance, lock-screen, and app-switcher masking tests in `apps/mobile/src/utils/mask-financial-value.test.ts`
- [x] T030 [P] [US3] Write failing clear, review, duplicate, assistant-confirmation, and error panel tests in `apps/mobile/src/features/foundation/FinancialTrustPanel.test.tsx`

### Implementation for User Story 3

- [x] T031 [US3] Implement the guarded FinancialChange transition reducer in `apps/mobile/src/domain/financial-change.ts`
- [x] T032 [P] [US3] Implement context-aware sensitive-value masking in `apps/mobile/src/utils/mask-financial-value.ts`
- [x] T033 [P] [US3] Implement deterministic financial-change scenarios and recovery actions in `apps/mobile/src/services/mocks/financial-changes.ts`
- [x] T034 [US3] Implement source, undo/edit, review, comparison, confirmation, and error UI in `apps/mobile/src/features/foundation/FinancialTrustPanel.tsx`
- [x] T035 [US3] Expose the independently runnable trust harness in `apps/mobile/app/foundation/trust.tsx`

**Checkpoint**: User Story 3 tests pass; no uncertain or assistant-originated change can apply
silently, and external surfaces never reveal sensitive amounts.

---

## Phase 6: User Story 4 - Use Masarifi in My Language and Ability Context (Priority: P2)

**Goal**: Demonstrate Arabic RTL and English LTR parity, theme behavior, large text, screen-reader
semantics, reduced motion, and non-color state cues.

**Independent Test**: Open `/foundation/accessibility`, repeat the state gallery in both
languages and themes with large text, a screen reader, and reduced motion enabled.

### Tests for User Story 4

- [x] T036 [P] [US4] Write failing Arabic/English catalog parity, direction, and mixed-direction formatting tests in `apps/mobile/src/localization/i18n.test.ts`
- [x] T037 [P] [US4] Write failing accessible-name, role, state, touch-target, and non-color cue tests in `apps/mobile/src/features/foundation/AccessibilityStateGallery.test.tsx`

### Implementation for User Story 4

- [x] T038 [P] [US4] Implement accessible locale, theme, reduced-motion, and hide-balance controls in `apps/mobile/src/features/foundation/FoundationControls.tsx`
- [x] T039 [US4] Implement loading, success, empty, error, offline, permission, and sync examples with semantic cues in `apps/mobile/src/features/foundation/AccessibilityStateGallery.tsx`
- [x] T040 [US4] Expose the independently runnable language and accessibility harness in `apps/mobile/app/foundation/accessibility.tsx`
- [x] T041 [US4] Add route-level Arabic RTL and English LTR parity coverage in `apps/mobile/src/features/foundation/FoundationRoutes.test.tsx`

**Checkpoint**: User Story 4 tests pass with complete language parity and no outcome dependent
on color, motion, illustration, or haptics alone.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Verify the complete foundation contract without expanding into later feature specs.

- [x] T042 [P] Add a 10,000-record virtualized-list performance fixture and assertion in `apps/mobile/src/features/foundation/FoundationPerformance.test.tsx`
- [x] T043 [P] Add static checks for raw colors, hard-coded user strings, sensitive analytics values, production secrets, and excluded feature terms in `apps/mobile/scripts/check-foundation-boundaries.mjs`
- [x] T044 Run all automated checks and record commands and outcomes in `apps/mobile/specs/001-mobile-foundation/quickstart.md`
- [x] T045 Validate Android permission denial/recovery and iOS SMS absence in development builds and record results in `apps/mobile/specs/001-mobile-foundation/quickstart.md`
- [x] T046 Validate Arabic RTL, English LTR, light/dark themes, large text, screen readers, reduced motion, safe areas, and small/large phones and record results in `apps/mobile/specs/001-mobile-foundation/quickstart.md`
- [x] T047 Validate lock-screen and app-switcher masking on physical or simulated devices and record results in `apps/mobile/specs/001-mobile-foundation/quickstart.md`
- [x] T048 Confirm no camera, receipt, investment, production-provider, or later-spec screen implementation exists and record the scope review in `apps/mobile/specs/001-mobile-foundation/quickstart.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1** has no dependencies.
- **Phase 2** depends on Phase 1 and blocks every user story.
- **Phases 3-6** depend on Phase 2. Their story-specific files allow parallel work.
- **Phase 7** depends on all user stories selected for delivery.

### User Story Dependencies

- **US1 (P1)**: No dependency on another story after Phase 2; this is the MVP.
- **US2 (P1)**: No dependency on another story after Phase 2.
- **US3 (P1)**: No dependency on another story after Phase 2.
- **US4 (P2)**: No dependency on another story after Phase 2; final route parity test runs after
  the selected story routes exist.

### Within Each User Story

1. Write the listed tests and confirm they fail for the intended missing behavior.
2. Implement domain or utility behavior.
3. Implement typed mock or storage behavior.
4. Implement the panel.
5. Expose the independent route and make its tests pass.

## Parallel Opportunities

- T003-T005 can run in parallel after T001-T002 establish package metadata.
- T007, T008, T010, and T012 can run in parallel after T006.
- T015 and T016 can run in parallel; T018 can run while T017 is implemented.
- T021-T023 can run in parallel before US2 implementation.
- T028-T030 can run in parallel; T032 and T033 can run in parallel after their tests fail.
- T036 and T037 can run in parallel; T038 can proceed independently of T039.
- T042 and T043 can run in parallel after story implementation.
- US1, US2, and US3 may be assigned in parallel after Phase 2 because they use separate routes,
  components, and tests.

## Parallel Examples

### User Story 1

```text
T015: format-financial-value.test.ts
T016: FinancialPositionPanel.test.tsx
T018: financial-summary.ts
```

### User Story 2

```text
T021: platform-capabilities.test.ts
T022: local-records.test.ts
T023: CaptureFallbackPanel.test.tsx
```

### User Story 3

```text
T028: financial-change.test.ts
T029: mask-financial-value.test.ts
T030: FinancialTrustPanel.test.tsx
```

### User Story 4

```text
T036: i18n.test.ts
T037: AccessibilityStateGallery.test.tsx
T038: FoundationControls.tsx
```

## Implementation Strategy

### MVP First

1. Complete Phases 1 and 2.
2. Complete US1 in Phase 3.
3. Run the US1 automated tests and the financial-position quickstart check.
4. Stop with a demonstrable financial-clarity foundation before adding other stories.

### Incremental Delivery

1. Add US2 to prove platform honesty and offline fallback.
2. Add US3 to prove financial trust and privacy.
3. Add US4 to prove language and accessibility parity.
4. Complete Phase 7 only for the delivered stories, then run the full gate before closing
   `SPEC-001`.

## Notes

- The routes are validation harnesses, not final product screens.
- Use Expo-compatible dependency versions; do not pin incompatible package versions manually.
- Keep server-shaped data in TanStack Query and local UI/session state in Zustand without
  duplication.
- Do not implement behavior owned by `SPEC-002` through `SPEC-010`.
