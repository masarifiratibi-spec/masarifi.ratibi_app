# Phase 0 Research: Mobile Product Foundation

## Decision 1: Runtime Baseline

**Decision**: Use one React Native TypeScript application created with Expo Development Builds
and Expo Router. Let Expo resolve compatible package versions at initialization.

**Rationale**: This is the approved architecture, supports one shared codebase, and still
allows Android-specific native capability where required. Avoiding hard-coded version numbers
keeps the plan compatible with the Expo SDK selected during implementation.

**Alternatives considered**:

- Expo Go: rejected because Android SMS behavior requires development-build/native boundaries.
- Separate native iOS and Android applications: rejected because it duplicates the shared UX.
- Bare React Native from day one: rejected because the current scope does not justify the
  additional native project maintenance.

## Decision 2: State Ownership

**Decision**: TanStack Query owns service-shaped asynchronous data. Zustand owns session-shell,
locale, theme, privacy preference, onboarding, draft, and temporary undo state. The same data
MUST NOT be copied into both stores.

**Rationale**: Explicit ownership prevents stale financial state and matches the approved
master architecture.

**Alternatives considered**:

- Zustand for all state: rejected because it would duplicate query lifecycle behavior.
- Query cache for all state: rejected because transient UI and local preferences are not
  server-shaped data.

## Decision 3: Local Persistence

**Decision**: Use SecureStore only for small sensitive session values and protected
preferences. Use SQLite for mock financial records, offline manual entries, and pending-sync
state. Access both through narrow typed storage modules.

**Rationale**: Financial records are structured and can outgrow key-value storage. SecureStore
is appropriate for secrets but not a ledger. SQLite supports atomic updates and explicit
pending-sync transitions without introducing a custom persistence framework.

**Alternatives considered**:

- SecureStore for all local data: rejected because it is not designed for structured datasets.
- In-memory mocks only: rejected because offline-entry and restart preservation are required.
- A state-persistence plugin: rejected because direct storage modules are sufficient initially.

## Decision 4: Localization and Financial Formatting

**Decision**: Use Expo Localization for locale discovery, i18next with typed Arabic and English
message catalogs for user-facing text, and the platform `Intl` implementation for numbers,
dates, currencies, and English numeral output. Direction is derived from the selected locale.

**Rationale**: Message catalogs prevent hard-coded strings, while `Intl` avoids hand-built
financial strings and handles currency rules reliably.

**Alternatives considered**:

- Custom translation lookup and formatting: rejected because it recreates mature behavior.
- Device locale only: rejected because the product requires an explicit language selection.
- Separate Arabic and English screens: rejected because it would create behavioral drift.

## Decision 5: Design-System Boundary

**Decision**: Create a mobile semantic-token adapter that can consume `packages/ui-tokens`
once that package exports runtime tokens. Until then, the adapter owns the single approved
mapping; feature components may reference only semantic names. Typography details beyond the
foundation are finalized by `SPEC-002` using the design-system source of truth.

**Rationale**: The shared package currently contains only a README. A narrow adapter allows
the app to start without scattering raw values or inventing a second token system.

**Alternatives considered**:

- Hard-code values in components: rejected by the constitution.
- Build a complete token package in this feature: rejected because that is `SPEC-002` scope.
- Import Admin components: rejected because mobile must not copy the Admin Dashboard layout.

## Decision 6: Platform Capability Boundary

**Decision**: Represent platform features through typed capability and permission adapters.
The foundation uses deterministic mocks; Android SMS access is added only in its dedicated
spec and must never be imported by iOS code.

**Rationale**: The boundary makes platform differences visible and testable while preventing
unsupported iOS claims.

**Alternatives considered**:

- Platform checks scattered through components: rejected because they are easy to miss.
- A shared fake SMS capability on both platforms: rejected because it misrepresents iOS.

## Decision 7: Verification Strategy

**Decision**: Use focused unit and component tests for formatting, state transitions,
permission mapping, masking, and fallback visibility. Use a small foundation screen as a
manual harness for RTL/LTR, themes, large text, reduced motion, offline state, and platform
differences. Native privacy and permission surfaces require development-build checks.

**Rationale**: Automated tests cover deterministic behavior; device checks cover operating
system behavior that a JavaScript test environment cannot prove.

**Alternatives considered**:

- Snapshot-heavy coverage: rejected because snapshots do not prove user outcomes.
- End-to-end automation in this foundation: deferred until real journeys exist.
- Manual-only validation: rejected because financial-state rules need repeatable checks.

## Decision 8: Foundation Scope

**Decision**: Implement primitives and one validation harness only. Do not implement auth,
dashboard, transaction, tracking, voice, planning, report, assistant, subscription, or support
screens in this feature.

**Rationale**: Those behaviors are independently specified by `SPEC-002` through `SPEC-010`.
Building them here would duplicate planning and weaken traceability.

**Alternatives considered**:

- Implement all Core V1 screens now: rejected as an untestable multi-feature batch.
- Documentation only: rejected because later specs need an executable foundation.
