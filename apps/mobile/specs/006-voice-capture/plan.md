# Implementation Plan: Voice Transaction Capture and Smart Categorization UX

**Branch**: `006-voice-capture` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-voice-capture/spec.md`

## Summary

Add a voice mode to the existing Add transaction experience and Home quick actions. Record a
maximum of 60 seconds through a replaceable capture adapter, show a mock transcript and
deterministic smart-analysis result, require review of every proposal, and save selected items
atomically through the existing finance ledger. Keep audio and transcript temporary, persist
only confirmed transactions and merchant-category preferences, and reuse existing accounts,
categories, obligation previews, notifications, query ownership, design-system components, and
localization. No production speech, AI, backend, or assistant integration is introduced.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, Expo AV and Expo FileSystem for temporary
recording and deletion, Expo SQLite 14, TanStack Query 5, Zustand 4, Zod 3, i18next 23, and the
existing Masarifi design system

**Storage**: Existing SQLite schema advances from version 3 to 4 only for user-approved
merchant-category preferences. Voice sessions, audio references, transcripts, selections, and
proposals remain transient. Confirmed transactions use the existing finance tables.

**Testing**: Jest and React Native Testing Library for permission mapping, capture transitions,
60-second enforcement, confidence bands, required fields, date resolution, multiple-proposal
selection, atomic saving, category preference choices, privacy cleanup, route entry, RTL/LTR,
and accessibility; Android and iOS development builds for microphone permission and temporary
audio lifecycle checks

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51;
portrait phones down to 320 by 568 logical pixels and adaptive tablets

**Project Type**: Shared Expo and React Native mobile application with platform capture adapters

**Performance Goals**: Recording controls respond within 100 ms; stopping reaches transcript
or actionable error within 2 seconds for deterministic mocks; analysis reaches review within
1 second; a 10-proposal review remains responsive at 60 frames per second; save feedback appears
within 1 second for local fixtures

**Constraints**: Frontend-only mock transcription and analysis; 60-second recording maximum;
90% clear, 60-89% explicit confirmation, below 60% missing; no silent financial mutation;
selected proposals save all-or-none; audio deleted after transcription or cancellation;
transcript deleted after save or cancellation; no production keys or provider calls; manual
entry always available; Arabic RTL and English LTR parity; 200% text; 44 by 44 minimum targets

**Scale/Scope**: Five user journeys; one capture/review state machine; eleven deterministic mock
scenarios; up to 10 proposals per recording; existing realistic account and category fixtures;
Arabic, English, and supported mixed-language examples

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: Every transcript and proposal is reviewed before save. Material
  uncertainty follows fixed confidence bands, recurring and obligation effects require explicit
  confirmation, selected proposals commit atomically, and failed saves preserve the review.
  Temporary audio and transcript data have explicit deletion points.
- **Platform honesty - PASS**: Android and iOS receive platform-appropriate microphone permission
  handling through one capture boundary. Denial, interruption, unsupported speech, analysis
  failure, and offline state always expose manual entry. No SMS or platform-exclusive claim is
  introduced.
- **Language and access - PASS**: Arabic and English catalogs cover all content. Logical layout,
  English numerals, mixed-direction financial values, screen-reader status, 200% text, reduced
  motion, contrast-safe confidence states, and 44 by 44 controls are required.
- **Design system - PASS**: Existing buttons, fields, selection controls, cards, state views,
  banners, dialogs, pickers, typography, themes, and semantic tokens are reused. Recording,
  processing, review, permission, offline, error, save, and interruption states are explicit.
- **Architecture and proof - PASS**: Capture and analyzer boundaries are typed and replaceable.
  Core Finance remains the only ledger owner, SQLite owns durable preferences, TanStack Query
  owns server-shaped reads, and Zustand holds only the temporary session. No provider call,
  secret, duplicate ledger, or business rule is placed in presentation components.

## Project Structure

### Documentation (this feature)

```text
specs/006-voice-capture/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- voice-capture-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app.json
package.json

app/
`-- (tabs)/
    |-- add.tsx
    `-- home.tsx

src/
|-- domain/
|   `-- voice-capture.ts
|-- features/
|   |-- home/
|   |   `-- HomeQuickActions.tsx
|   `-- voice/
|       |-- VoiceCaptureScreen.tsx
|       |-- VoiceRecorder.tsx
|       |-- VoiceReview.tsx
|       `-- useVoiceCapture.ts
|-- services/
|   |-- contracts/
|   |   `-- voice-capture-service.ts
|   |-- mocks/
|   |   |-- voice-analyzer-service.ts
|   |   `-- voice-fixtures.ts
|   `-- platform/
|       `-- voice-recorder-service.ts
|-- state/
|   `-- voice-capture.ts
|-- storage/
|   |-- database.ts
|   |-- core-finance-repository.ts
|   `-- voice-category-preference-repository.ts
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
`-- test-utils/
    `-- voice-capture-fixtures.ts
```

Focused tests remain beside the domain, service, state, repository, feature, and route behavior
they prove.

**Structure Decision**: Keep the existing Add tab and switch it between manual and voice modes;
the existing Home voice action opens the same route in voice mode. Use one voice feature state
machine for permission, recording, transcription, analysis, review, and save. Extend Core
Finance with one atomic batch-create operation and add only one durable voice-owned table for
confirmed merchant-category preferences.

## Implementation Strategy

### Slice 1: Capture boundary and deterministic domain

- Add the two Expo modules required for temporary audio capture and deletion, including Android
  microphone permission and iOS usage text through project configuration.
- Define permission, session, transcript, field-confidence, proposal, group, recurring suggestion,
  category preference, and safe error contracts.
- Implement the 60-second lifecycle and cleanup rules in the capture adapter; keep file paths and
  transcripts out of logs, analytics, notifications, and persistence.
- Add deterministic mock transcription and analysis fixtures for every required scenario. Keep
  confidence policy and relative-date resolution as pure domain functions.

### Slice 2: Voice entry and review experience

- Add a manual/voice mode selector to the Add tab and reuse the existing Home deep link.
- Build recording, permission education/recovery, duration warning, waveform/status alternative,
  cancel, stop, and re-record states with existing design primitives.
- Show an editable transcript before analysis and separate review cards for each proposal.
- Reuse existing account/category data and selectors; distinguish payment method from funding
  account; enforce existing ledger account/payment-source rules, required values, and field-level
  confidence confirmation. Do not broaden the ledger to nullable accounts in this feature.
- Support independent edit, remove, select, confirm all, re-record, recurring choices, and
  obligation suggestions without changing financial records during review.

### Slice 3: Atomic save and smart category preference

- Extend the existing Core Finance service/repository with one validated batch-create operation
  that commits all selected `source: voice` transactions in a single SQLite transaction and
  returns existing affected query scopes.
- Prevalidate every selected proposal and confirmed obligation effect before starting the write.
  On any failure, commit nothing and preserve the transient review group.
- Advance SQLite to schema version 4 for normalized merchant-category preferences. Apply the
  established precedence: user preference, known merchant fixture, keyword fixture, smart mock.
- Reuse the current obligation-effect and mock notification boundaries; do not create duplicate
  obligation or notification ownership inside the voice feature.

### Slice 4: Recovery, privacy, localization, and proof

- Map permission denial, permanent denial, silence, noise, interruption, maximum duration,
  unsupported language, failed analysis, offline, save failure, and restored states to localized
  actions. Manual entry remains reachable from every blocking state.
- Delete temporary audio after transcription or cancellation and clear transcript/session data
  after save or cancellation. Verify backgrounding and re-recording cannot retain stale audio.
- Complete Arabic RTL, English LTR, mixed-direction values, keyboard handling, screen-reader
  summaries, focus order, 200% text, reduced motion, light/dark themes, and phone/tablet layouts.
- Verify financial consistency, all-or-none saves, query invalidation, category preference scope,
  native permission behavior, and absence of production AI claims or sensitive telemetry.

## Phase 0: Research Outcome

[research.md](research.md) resolves recording ownership, dependency choice, temporary-data
privacy, confidence handling, relative dates, category precedence, atomic ledger mutation,
session/query ownership, obligation integration, and proof. No planning question remains open.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines fields, relationships, validation, persistence, privacy,
  and state transitions for every SPEC-006 entity.
- [contracts/voice-capture-contract.md](contracts/voice-capture-contract.md) defines route,
  capture, analyzer, review, financial save, category, obligation, privacy, localization,
  accessibility, and error behavior.
- [quickstart.md](quickstart.md) provides runnable automated and native validation scenarios for
  all five user stories and clarified decisions.

## Post-Design Constitution Re-check

The design keeps Core Finance as the only financial owner, requires explicit review and
confirmation, commits selected transactions atomically, and deletes temporary voice content at
the clarified boundaries. Both platforms retain manual entry and receive honest microphone
behavior. Arabic/English parity, semantic design-system reuse, typed replaceable adapters, and
focused automated/native proof are explicit. No gate failed and no exception is required.

## Complexity Tracking

No constitution violation requires justification. Expo AV and Expo FileSystem are the minimum
platform modules needed to record temporary audio and prove its deletion without custom native
code.
