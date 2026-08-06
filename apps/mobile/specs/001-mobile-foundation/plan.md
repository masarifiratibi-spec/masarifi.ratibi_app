# Implementation Plan: Product Foundation, Scope, and UX Principles

**Branch**: `001-mobile-foundation` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-mobile-foundation/spec.md`

## Summary

Establish the smallest shared mobile foundation that makes the product rules enforceable
before feature screens are built. Initialize a shared Expo and React Native TypeScript app,
define semantic design and localization primitives, model platform and financial-change
states, provide typed mock boundaries, persist offline entries safely, and create a compact
foundation validation screen and test harness. Detailed product screens remain owned by
`SPEC-002` through `SPEC-010`.

## Technical Context

**Language/Version**: TypeScript 5.x with the version supported by the selected Expo SDK

**Primary Dependencies**: React Native, Expo Development Builds, Expo Router, TanStack Query,
Zustand, React Hook Form, Zod, Expo SecureStore, Expo SQLite, Expo Localization, i18next,
React Native Testing Library, and Jest; versions MUST follow Expo compatibility resolution

**Storage**: Expo SecureStore for session secrets and protected preferences; Expo SQLite for
structured mock financial records, offline entries, and the pending-sync queue

**Testing**: Jest and React Native Testing Library, plus manual development-build validation
for platform permissions, RTL, accessibility, app-switcher privacy, and notifications

**Target Platform**: Current supported iOS and Android versions covered by the selected Expo
SDK, with Android-specific SMS capability isolated behind a development-build adapter

**Project Type**: Shared mobile application with platform-aware adapters

**Performance Goals**: Warm launch presents a usable shell within 2 seconds on a representative
mid-range device; primary interactions maintain 60 frames per second; 10,000 mock transactions
remain browsable through virtualized lists without rendering the full collection

**Constraints**: Frontend-only; Arabic RTL and English LTR parity; light and dark modes;
offline-capable manual entry; no production secrets or direct provider/database access; no
camera, receipt scanning, investments, production SMS parsing, AI, email, payment, or auth

**Scale/Scope**: One personal-finance user per session, one base reporting currency, two
platforms, two languages, and foundational contracts for the ten planned mobile specs

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: `FinancialChange` requires source, certainty, confirmation,
  correction, and review state. Sensitive-display rules mask external surfaces and preserve a
  global hide preference. Errors map to user recovery actions.
- **Platform honesty - PASS**: `PlatformCapability` and `CaptureMethod` expose availability and
  fallback explicitly. Android SMS behavior stays behind an Android adapter; iOS contracts
  prohibit a direct SMS claim.
- **Language and access - PASS**: Locale, direction, English-numeral formatting, 44 by 44 touch
  targets, screen-reader labels, font scaling, reduced motion, and non-color status cues are
  required by the UI contract and quickstart scenarios.
- **Design system - PASS**: Components consume shared semantic tokens, support light/dark modes,
  and declare responsive, RTL, accessibility, and relevant async states. Raw brand values are
  prohibited in feature components.
- **Architecture and proof - PASS**: Typed contracts separate platform, mock service, storage,
  and UI concerns. SecureStore and SQLite have distinct ownership. Focused tests and manual
  visual/platform checks are listed in `quickstart.md`.

## Project Structure

### Documentation (this feature)

```text
specs/001-mobile-foundation/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- foundation-ui-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- _layout.tsx
`-- index.tsx

src/
|-- design-system/
|   |-- theme.ts
|   `-- tokens.ts
|-- features/
|   `-- foundation/
|       |-- FoundationScreen.tsx
|       `-- FoundationScreen.test.tsx
|-- localization/
|   |-- i18n.ts
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
|-- domain/
|   `-- foundation.ts
|-- services/
|   |-- contracts/
|   `-- mocks/
|-- state/
|   `-- preferences.ts
|-- storage/
|   |-- local-records.ts
|   `-- secure-preferences.ts
`-- utils/
    |-- format-financial-value.ts
    `-- format-financial-value.test.ts

assets/
package.json
app.json
tsconfig.json
```

**Structure Decision**: Use the master specification's feature-based shared mobile layout,
but create only files required to prove the foundation contract. Expo Router owns entry and
navigation; domain types remain independent of UI; platform/service/storage behavior is
accessed through typed boundaries; tests stay beside the small units they verify.

## Phase 0: Research Outcome

Research decisions are recorded in [research.md](research.md). All technical-context choices
are resolved; no `NEEDS CLARIFICATION` items remain.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines capability, capture, financial-change, permission,
  frontend-state, reporting-currency, preference, and offline-entry models and transitions.
- [foundation-ui-contract.md](contracts/foundation-ui-contract.md) defines observable UI and
  adapter behavior without committing later feature specs to screen implementations.
- [quickstart.md](quickstart.md) defines runnable automated and manual validation scenarios.

## Complexity Tracking

No constitution violations or justified complexity exceptions are required.
