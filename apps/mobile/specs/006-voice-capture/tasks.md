# Tasks: Voice Transaction Capture and Smart Categorization UX

**Input**: Design documents from `specs/006-voice-capture/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include the smallest tests required for financial validation, permission mapping,
state transitions, temporary-data cleanup, atomic saving, localization, accessibility, and each
critical user journey.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified
as an incremental slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no unfinished dependency
- **[Story]**: Maps the task to a user story from spec.md
- Every task names its target file or evidence directory

## Phase 1: Setup

**Purpose**: Add only the native modules and platform declarations required for temporary audio.

- [X] T001 Install Expo AV and Expo FileSystem with Expo-compatible versions and configure Android microphone permission plus iOS microphone usage text in package.json and app.json

---

## Phase 2: Foundational

**Purpose**: Create the shared domain, adapters, transient state, persistence, atomic ledger path,
notification mock, and bilingual content required by every user story.

**CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T002 [P] Add failing schemas, confidence classification, session-transition, and relative-date unit tests in src/domain/voice-capture.test.ts
- [X] T003 Implement voice permission, session, transcript, field assessment, proposal, group, category preference, recurring suggestion, error, confidence, and relative-date contracts in src/domain/voice-capture.ts
- [X] T004 [P] Define replaceable recorder and analyzer interfaces plus safe result/error types in src/services/contracts/voice-capture-service.ts
- [X] T005 Create deterministic Arabic, English, mixed-language, multiple, income, transfer, obligation, missing-account, low-confidence, failed-analysis, unsupported-language, and no-speech fixtures in src/services/mocks/voice-fixtures.ts and src/test-utils/voice-capture-fixtures.ts
- [X] T006 [P] Add failing transient-session lifecycle and cleanup tests in src/state/voice-capture.test.ts
- [X] T007 Implement the transient Zustand voice session with guarded transitions, proposal selection, retry preservation, re-record cleanup, and terminal reset in src/state/voice-capture.ts
- [X] T008 [P] Add failing permission, 60-second limit, interruption, idempotent stop, and file-removal adapter tests in src/services/platform/voice-recorder-service.test.ts
- [X] T009 Implement the Expo recording adapter, permission recovery, maximum-duration stop, interruption handling, settings handoff, and temporary-file deletion in src/services/platform/voice-recorder-service.ts
- [X] T010 [P] Add failing schema-version-4 migration and normalized merchant-category preference repository tests in src/storage/voice-category-preference-repository.test.ts
- [X] T011 Advance the SQLite migration and implement category preference load, upsert, category validity, and removal behavior in src/storage/database.ts and src/storage/voice-category-preference-repository.ts
- [X] T012 [P] Add failing all-or-none batch creation, prevalidation, rollback, affected-scope, source, and retry-idempotency tests in src/services/mocks/core-finance-voice-batch.test.ts
- [X] T013 Extend the existing ledger contract, repository, and mock service with atomic voice batch creation in src/services/contracts/core-finance-service.ts, src/storage/core-finance-repository.ts, and src/services/mocks/core-finance-service.ts
- [X] T014 [P] Add failing voice-notification privacy and preference outcome tests in src/services/mocks/voice-notification-service.test.ts
- [X] T015 Implement mock voice transaction notification outcomes without audio or transcript content in src/services/mocks/voice-notification-service.ts
- [X] T016 [P] Add failing Arabic/English voice key parity and no-hard-coded-content tests in src/localization/voice-capture-messages.test.ts
- [X] T017 Add complete Arabic RTL and English LTR voice capture, review, confidence, permission, error, recurring, obligation, and save strings in src/localization/messages/ar.ts and src/localization/messages/en.ts

**Checkpoint**: Typed boundaries, deterministic fixtures, temporary state, audio cleanup, atomic
ledger saving, preference storage, notifications, and localization are ready.

---

## Phase 3: User Story 1 - Record and Review a Transaction by Voice (Priority: P1) MVP

**Goal**: Record a supported statement, review its transcript and one structured proposal, edit
it, and explicitly save exactly one voice transaction.

**Independent Test**: Open voice mode from Home and Add, grant permission, record a clear Arabic
or English fixture, review and edit the transcript/proposal, save it, and verify one ledger item
plus temporary-data cleanup.

### Tests for User Story 1

- [X] T018 [P] [US1] Add failing clear Arabic/English transcription and single expense, income, and transfer analysis contract tests in src/services/mocks/voice-analyzer-service.test.ts
- [X] T019 [P] [US1] Add failing permission-to-record-to-transcript-to-review-to-save lifecycle tests in src/features/voice/useVoiceCapture.test.tsx
- [X] T020 [P] [US1] Add failing recorder controls, duration, status text, cancel, stop, and re-record component tests in src/features/voice/VoiceRecorder.test.tsx
- [X] T021 [P] [US1] Add failing clear single-proposal review, edit, explicit save, and no-pre-save-mutation screen tests in src/features/voice/VoiceCaptureScreen.test.tsx
- [X] T022 [P] [US1] Add failing Add-mode and Home voice-entry route tests in src/features/voice/VoiceCaptureRoute.test.tsx and src/features/home/HomeQuickActions.test.tsx

### Implementation for User Story 1

- [X] T023 [US1] Implement deterministic clear Arabic/English transcription and single expense, income, and transfer analysis in src/services/mocks/voice-analyzer-service.ts
- [X] T024 [US1] Implement capture, transcription, editable transcript, analysis, single-proposal validation, save, query invalidation, and terminal cleanup orchestration in src/features/voice/useVoiceCapture.ts
- [X] T025 [US1] Build accessible recording controls and text-based recording status with existing semantic components in src/features/voice/VoiceRecorder.tsx
- [X] T026 [US1] Build the voice capture/transcript/single-review screen with explicit confirmation and manual fallback in src/features/voice/VoiceCaptureScreen.tsx
- [X] T027 [US1] Add the manual/voice selector and mode query handling to app/(tabs)/add.tsx and point the existing Home voice action to the same mode in src/features/home/HomeQuickActions.tsx

**Checkpoint**: User Story 1 is independently usable as the voice-capture MVP.

---

## Phase 4: User Story 2 - Resolve Missing or Uncertain Information (Priority: P1)

**Goal**: Explain and resolve missing, uncertain, conflicting, account/payment-method, date, and
category values without blocking optional omissions.

**Independent Test**: Run missing-account, unknown-merchant, low-confidence, conflicting, and
relative-date fixtures; verify threshold behavior, field confirmation, correction, optional save,
and one-time versus future category preference choices.

### Tests for User Story 2

- [X] T028 [P] [US2] Add failing field-level 90/60 confidence boundaries, conflict, required-value, optional-value, and recorded-timezone date tests in src/domain/voice-capture-review.test.ts
- [X] T029 [P] [US2] Add failing suggestion-precedence, one-time correction, persistent merchant preference, and archived-category tests in src/services/mocks/voice-category-service.test.ts
- [X] T030 [P] [US2] Add failing payment-method versus funding-account, missing-field, confidence confirmation, date review, and category-choice component tests in src/features/voice/VoiceReview.test.tsx
- [X] T031 [US2] Add failing uncertain-review orchestration, retry preservation, and successful correction integration tests in src/features/voice/useVoiceCaptureReview.test.tsx

### Implementation for User Story 2

- [X] T032 [US2] Implement required/material field validation, confidence confirmation, conflict correction, and recorded-timezone date resolution in src/domain/voice-capture.ts
- [X] T033 [US2] Implement category suggestion precedence and post-save preference decisions in src/services/mocks/voice-category-service.ts
- [X] T034 [US2] Build reusable proposal fields with separate payment method and funding account controls, confidence reasons, missing-value actions, and category preference choices in src/features/voice/VoiceReview.tsx
- [X] T035 [US2] Integrate uncertain-field confirmation, existing account/category queries, category preferences, and preserved retry state in src/features/voice/useVoiceCapture.ts and src/features/voice/VoiceCaptureScreen.tsx

**Checkpoint**: Clear and uncertain single transactions both complete safely and independently.

---

## Phase 5: User Story 3 - Capture Multiple Transactions in One Recording (Priority: P1)

**Goal**: Review several separate proposals, edit and select them independently, then save the
selected group atomically.

**Independent Test**: Analyze a two-transaction fixture, edit/remove/select proposals separately,
confirm selected or all, force a save failure, retry, and verify all-or-none and no duplicates.

### Tests for User Story 3

- [X] T036 [P] [US3] Add failing proposal-group selection, independent edit/remove, maximum-count, and retry-preservation tests in src/state/voice-proposal-group.test.ts
- [X] T037 [US3] Add failing multiple-transaction transcript and proposal separation tests in src/services/mocks/voice-analyzer-service.test.ts
- [X] T038 [P] [US3] Add failing multiple-card, confirm-selected, confirm-all, remove, and re-record UI tests in src/features/voice/VoiceReviewGroup.test.tsx
- [X] T039 [P] [US3] Add failing selected-group all-or-none save, failed-save preservation, query invalidation, and successful retry integration tests in src/features/voice/voice-group-save.test.ts

### Implementation for User Story 3

- [X] T040 [US3] Extend the transient voice store with independent group edit, remove, select, select-all, and maximum-ten proposal behavior in src/state/voice-capture.ts
- [X] T041 [US3] Implement deterministic multiple-transaction analysis and stable proposal-group IDs in src/services/mocks/voice-analyzer-service.ts and src/services/mocks/voice-fixtures.ts
- [X] T042 [US3] Build the multiple-proposal review list and group actions without nested card layouts in src/features/voice/VoiceReviewGroup.tsx
- [X] T043 [US3] Integrate atomic selected-group save, stable operation IDs, failed-save preservation, retry, and terminal cleanup in src/features/voice/useVoiceCapture.ts

**Checkpoint**: Multiple transactions remain independently editable and commit as one outcome.

---

## Phase 6: User Story 5 - Recover from Permission, Recording, and Analysis Problems (Priority: P1)

**Goal**: Recover safely from permission, recording, speech, analysis, offline, and save failures
while preserving manual entry and deleting temporary audio.

**Independent Test**: Exercise every permission and failure state in quickstart.md; verify the
correct localized action, no financial mutation, no stale audio, and a reachable manual path.

### Tests for User Story 5

- [X] T044 [P] [US5] Add failing denied, permanently-denied, unavailable, interrupted, backgrounded, maximum-duration, and stale-file cleanup tests in src/services/platform/voice-recorder-service.test.ts
- [X] T045 [P] [US5] Add failing no-speech, noise, unsupported-language, failed-analysis, offline, and safe-error mapping tests in src/services/mocks/voice-analyzer-service.test.ts
- [X] T046 [P] [US5] Add failing retry, open-settings, re-record, edit-transcript, manual-entry, cancel, and save-failure screen tests in src/features/voice/VoiceCaptureRecovery.test.tsx

### Implementation for User Story 5

- [X] T047 [US5] Complete platform interruption, permission recovery, 60-second warning/stop, idempotent cleanup, and safe error mapping in src/services/platform/voice-recorder-service.ts
- [X] T048 [US5] Implement no-speech, noise, unsupported-language, failed-analysis, and offline mock outcomes in src/services/mocks/voice-analyzer-service.ts
- [X] T049 [US5] Integrate localized retry, settings, re-record, transcript edit, manual fallback, cancellation, and save-failure recovery without data loss in src/features/voice/useVoiceCapture.ts and src/features/voice/VoiceCaptureScreen.tsx

**Checkpoint**: Voice failure never blocks the application or leaves financial or temporary-data
side effects.

---

## Phase 7: User Story 4 - Record Recurring and Obligation Payments Safely (Priority: P2)

**Goal**: Detect recurring or obligation intent and require an explicit one-time, recurring,
existing-obligation, or new-obligation decision before any related effect.

**Independent Test**: Run monthly, weekly, installment, subscription, rent, and loan fixtures;
verify preview, zero/one/multiple obligation candidates, confirmation, atomic linked payment,
new-obligation handoff, cancellation, and failure.

### Tests for User Story 4

- [X] T050 [P] [US4] Add failing recurring-intent, cadence, one-time, zero/one/multiple obligation candidate, and confirmation tests in src/domain/voice-recurring.test.ts
- [X] T051 [P] [US4] Add failing recurring/obligation fixture analysis and existing obligation-preview contract tests in src/services/mocks/voice-obligation-service.test.ts
- [X] T052 [P] [US4] Add failing recurring choices, obligation selection, preview, and no-silent-effect component tests in src/features/voice/VoiceRecurringReview.test.tsx
- [X] T053 [US4] Add failing atomic transaction-plus-obligation-effect and notification outcome integration tests in src/features/voice/voice-obligation-save.test.ts

### Implementation for User Story 4

- [X] T054 [US4] Implement recurring and obligation suggestion derivation plus deterministic fixtures in src/domain/voice-capture.ts and src/services/mocks/voice-fixtures.ts
- [X] T055 [US4] Adapt the existing mock obligation preview boundary for voice proposals in src/services/mocks/voice-obligation-service.ts
- [X] T056 [US4] Build one-time, recurring, existing-obligation, and new-obligation review choices with explicit confirmation in src/features/voice/VoiceRecurringReview.tsx
- [X] T057 [US4] Integrate confirmed obligation effects, SPEC-007 new-obligation handoff, mock notification outcomes, and all-or-none save behavior in src/features/voice/useVoiceCapture.ts

**Checkpoint**: Recurring and obligation suggestions are useful but never create hidden changes.

---

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Prove privacy, localization, accessibility, design-system compliance, performance,
and native behavior across the completed feature.

- [X] T058 [P] Add focused privacy regression tests proving audio references, transcripts, confidence payloads, and sensitive values never reach persistence, notifications, analytics, logs, or raw errors in src/features/voice/voice-privacy.test.ts
- [X] T059 [P] Add Arabic RTL, English LTR, mixed-direction, 200-percent text, screen-reader status, reduced-motion, and 44-by-44 target tests in src/features/voice/VoiceCaptureAccessibility.test.tsx
- [X] T060 Add a voice boundary checker for forbidden provider calls, hard-coded user strings, raw brand colors, and direct database access in scripts/check-voice-capture-boundaries.mjs and package.json
- [X] T061 Run typecheck, lint, Expo dependency validation, all existing boundary checks, the new voice boundary check, and the complete Jest suite from specs/006-voice-capture/quickstart.md
- [X] T062 Execute the Android native permission, recording, interruption, 60-second, temporary-file deletion, Arabic/English, theme, device-size, and accessibility matrix and record evidence in specs/006-voice-capture/native-evidence/android/
- [X] T063 Execute the iOS native permission, recording, interruption, temporary-file deletion, Arabic/English, theme, device-size, and accessibility matrix where macOS/Xcode is available and record evidence or the environment limitation in specs/006-voice-capture/native-evidence/ios/
- [X] T064 Verify all quickstart user journeys, performance goals, manual fallbacks, absence of production AI claims/secrets, and final constitution compliance and record the result in specs/006-voice-capture/native-evidence/validation-summary.md

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup**: Starts immediately.
- **Foundational**: Depends on T001 and blocks every user story.
- **US1**: Starts after Foundational and provides the MVP recording/review shell.
- **US2**: Domain and service work can start after Foundational; screen integration uses the US1 shell.
- **US3**: Store, analyzer, and test work can start after Foundational; UI integration uses the US1 review shell.
- **US5**: Adapter and failure tests can start after Foundational; recovery UI integrates with US1.
- **US4**: Starts after the US1 review shell and US2 field/category controls are available.
- **Polish**: Starts after all selected user stories are complete.

### User Story Completion Order

```text
Setup -> Foundational -> US1 MVP
                         |-> US2
                         |-> US3
                         |-> US5
US1 + US2 --------------> US4
US1 + US2 + US3 + US4 + US5 -> Polish
```

### Parallel Opportunities

- Foundational test tasks T008, T010, T012, T014, and T016 touch separate files and can run in parallel after domain/contracts are understood.
- US1 test tasks T018 through T022 can be authored in parallel before their implementations.
- US2 domain, category-service, and component tests T028 through T030 can run in parallel.
- US3 state, UI, and save tests T036, T038, and T039 can run in parallel.
- US5 adapter, analyzer, and recovery tests T044 through T046 can run in parallel.
- US4 domain, service, and component tests T050 through T052 can run in parallel.
- Privacy and accessibility tests T058 and T059 can run in parallel.

## Parallel Examples

### User Story 1

```text
T018: Mock analyzer contract tests
T020: Recorder component tests
T022: Add and Home route tests
```

### User Story 2

```text
T028: Confidence and date domain tests
T029: Category suggestion tests
T030: Voice review component tests
```

### User Story 3

```text
T036: Proposal group state tests
T038: Multiple review UI tests
T039: Atomic save integration tests
```

### User Story 5

```text
T044: Native recorder failure tests
T045: Analyzer failure tests
T046: Recovery UI tests
```

### User Story 4

```text
T050: Recurring domain tests
T051: Obligation service tests
T052: Recurring review UI tests
```

## Implementation Strategy

### MVP First

1. Complete T001 through T017.
2. Complete US1 tasks T018 through T027.
3. Run the US1 independent test and verify one confirmed voice transaction plus cleanup.
4. Demo the clear Arabic and English flow before adding uncertainty or multiple proposals.

### Incremental Delivery

1. Add US2 for trustworthy uncertainty and smart category correction.
2. Add US3 for multiple proposals and atomic group save.
3. Add US5 for the full recovery matrix.
4. Add US4 for recurring and obligation value.
5. Complete T058 through T064 as the release gate.

## Notes

- Tests are written before the implementation they prove and must fail for the intended reason.
- `[P]` tasks touch different files and have no unfinished dependency at their stated phase.
- Core Finance remains the only transaction and balance owner.
- No task adds a production speech/AI provider, direct database access from UI, or a second ledger.
- Stop at any checkpoint for an independently demonstrable increment.

