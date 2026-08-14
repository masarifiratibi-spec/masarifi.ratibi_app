# Research: Voice Transaction Capture and Smart Categorization UX

## Decision 1: Use a narrow platform recording adapter

**Decision**: Use Expo AV for microphone permission and temporary recording and Expo FileSystem
for explicit deletion. Hide both behind a `VoiceRecorderService` and cap recordings at 60
seconds.

**Rationale**: The app targets one Expo codebase on Android and iOS. Official Expo modules avoid
custom native code, provide development-build permission behavior, and allow the privacy rule to
be verified directly.

**Alternatives considered**: A fully simulated recorder would not prove native permission or
audio deletion. Custom native modules add unnecessary platform code. A production speech SDK is
outside the frontend phase and would introduce credentials and provider coupling.

## Decision 2: Keep transcription and analysis deterministic

**Decision**: Implement replaceable mock transcription and analysis services backed by named
Arabic, English, mixed-language, multiple-transaction, income, transfer, obligation,
low-confidence, failure, unsupported-language, and no-speech fixtures.

**Rationale**: The master specification explicitly limits this phase to mock speech and mock
analysis. Deterministic outcomes make every acceptance state demonstrable without production AI
keys or network behavior.

**Alternatives considered**: Calling an AI provider from the mobile client violates the
constitution. A handwritten natural-language parser would create false product behavior and a
large maintenance surface. Hard-coding results inside screens would prevent later replacement.

## Decision 3: Treat voice data as a temporary session

**Decision**: Keep recording URI, transcript, proposals, selections, and confirmations in one
transient Zustand session. Delete audio immediately after transcription or cancellation and
clear the transcript and session after save or cancellation.

**Rationale**: The session must survive component transitions within the Add flow but must not
become durable financial or server-shaped state. One transient owner also makes cleanup on
re-record, interruption, and unmount testable.

**Alternatives considered**: SQLite persistence would retain sensitive data unnecessarily.
Component-only state is smaller but risks losing a reviewed group during expected navigation.
TanStack Query is intended for asynchronous records, not an unsaved recording workflow.

## Decision 4: Apply one confidence policy to material fields

**Decision**: A material field at 90% or above is clear, 60-89% is highlighted and requires
explicit field confirmation, and below 60% is treated as missing. Conflicts always require
correction regardless of numeric confidence.

**Rationale**: This exactly implements the clarified policy and keeps confidence presentation,
validation, and tests consistent. Plain-language reason codes accompany every uncertain field.

**Alternatives considered**: One overall score can hide a dangerous weak field. Different
thresholds per field add policy not present in the specification. Showing percentages without
behavior does not protect financial trust.

## Decision 5: Resolve relative dates locally and visibly

**Decision**: Resolve relative words from the device local date and timezone captured when
recording starts, then show the resulting date in review. Ambiguous, future, or out-of-range
dates require correction or explicit confirmation.

**Rationale**: Capturing the time basis prevents midnight or timezone changes from altering the
proposal between analysis and save. Existing locale-aware date formatting can display the
resolved result.

**Alternatives considered**: Resolving at save time can change meaning. A fixed server timezone
is unavailable and inappropriate for local speech. Adding a date library is unnecessary for the
small supported relative-date fixture set.

## Decision 6: Reuse the ledger and add one atomic batch operation

**Decision**: Extend `CoreFinanceService` and `CoreFinanceRepository` with one batch-create
operation. Validate all selected inputs first, write them inside one SQLite transaction, and
only then expose the committed result. Use a stable group operation ID for retry idempotency.

**Rationale**: The clarified all-or-none rule cannot be guaranteed by repeated single creates.
The existing ledger already owns validation, transaction source, balances, and query scopes, so
the operation belongs there rather than in a voice repository.

**Alternatives considered**: Sequential creates can leave partial financial effects. A separate
voice ledger duplicates money state. Compensating deletes are more complex and can expose
temporary incorrect balances.

## Decision 7: Persist only confirmed category preferences

**Decision**: Add one schema-version-4 table for normalized user-approved merchant-to-category
preferences. Resolve suggestions in this order: user preference, known merchant fixture,
keyword fixture, smart mock suggestion. A one-time correction never writes a preference.

**Rationale**: The preference must survive future sessions, while analysis fixtures and review
state do not. A narrow table preserves the explicit precedence and avoids changing existing
category ownership.

**Alternatives considered**: AsyncStorage would create another durable data owner beside SQLite.
Embedding preferences in category records mixes unrelated ownership. Persisting every mock rule
adds speculative scope.

## Decision 8: Reuse obligation and notification boundaries

**Decision**: Voice review requests an obligation preview through the existing mock obligation
boundary and applies only the confirmed link during the atomic save. Saved items reuse the
existing mock notification preference/outcome pattern.

**Rationale**: SPEC-007 and SPEC-009 own full obligation and notification behavior. Reuse keeps
SPEC-006 demonstrable without inventing duplicate records or delivery services.

**Alternatives considered**: New voice-owned obligation or notification stores would conflict
with later specs. Omitting the boundaries would fail required user-visible effects.

## Decision 9: Keep route and query ownership small

**Decision**: Use the existing `/(tabs)/add` route with a manual/voice mode selector; Home opens
that route with `mode=voice`. Accounts and categories remain TanStack Query data. The temporary
voice session remains in Zustand, and confirmed transactions remain in Core Finance.

**Rationale**: One route preserves the established Add entry point and avoids duplicating form
navigation. Each data shape has one owner consistent with the current codebase.

**Alternatives considered**: A separate route tree adds navigation and draft handoff complexity.
Mirroring accounts or transactions in the voice store risks stale financial state.

## Decision 10: Prove the feature with focused automated and native checks

**Decision**: Automate pure policies, state transitions, service cleanup, persistence, atomic
save, route mode, and critical screens. Use Android and iOS development builds only for real
permission, interruption, audio cleanup, layout, and assistive-technology checks.

**Rationale**: Deterministic business behavior belongs in fast tests; operating-system behavior
requires a device. This matches the project's existing Jest and native evidence pattern.

**Alternatives considered**: Device-only testing is slow and incomplete. Snapshot-heavy tests
do not prove financial or privacy behavior. A broad new end-to-end framework is not needed.

## Decision 11: Preserve existing account and payment-source rules

**Decision**: Reuse Core Finance validation for the final funding account or payment source. A
missing voice-derived account may be suggested or selected; saving without one is offered only
if an existing transaction rule permits it. SPEC-006 does not make ledger account references
nullable.

**Rationale**: SPEC-004 treats account or payment source as required, and the current ledger and
balance calculations depend on that relationship. Voice capture should not redefine the shared
financial model for an optional suggestion.

**Alternatives considered**: Making every ledger account nullable has a large cross-feature
impact. A hidden synthetic account would misrepresent the user's financial position. Blocking
review until a valid existing funding source is chosen is the smallest trustworthy behavior.
