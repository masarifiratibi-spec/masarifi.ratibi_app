# Research: Daily Money Control

## Decision 1: Deliver one ledger-centered feature in vertical slices

**Decision**: Use the transaction ledger as the shared source for Home, accounts, entry, automatic review, and voice proposals. Deliver the feature in independently testable slices: domain/repository foundation, manual ledger and entry, accounts/categories, automatic tracking/review, then native voice capture and proposal review.

**Rationale**: Every surface depends on the same financial facts. One ledger prevents Home, balances, filters, review, and capture paths from inventing competing record models, while vertical slices keep each user journey demonstrable.

**Alternatives considered**: Building each screen against unrelated fixtures would be faster initially but create inconsistent balances and duplicate state; implementing every backend-shaped capability before any screen would delay user-visible proof.

## Decision 2: Represent money as integer minor units

**Decision**: Persist and calculate monetary amounts as signed safe integers in currency minor units, paired with an ISO currency code and currency scale. Formatting converts minor units only at the display boundary. Estimated reporting values retain the original amount/currency plus conversion value and timestamp.

**Rationale**: Integer arithmetic avoids binary floating-point drift in balance, transfer, refund, and undo calculations. Retaining original and converted values satisfies the financial-trust requirement for estimated aggregates.

**Alternatives considered**: JavaScript decimal numbers are already used by foundation demos but are unsafe as the authoritative ledger representation; a decimal-arithmetic package is unnecessary for Core V1 because supported currency scales and safe-integer validation cover the mock dataset.

## Decision 3: Extend SQLite as the durable local ledger

**Decision**: Extend the existing versioned SQLite boundary with accounts, categories, transactions, drafts, detected items, review items, and voice proposals. Repositories own reads, writes, transactions, and migrations; feature UI never accesses the database directly. Existing preferences remain in their current preference storage, and native credentials remain in secure storage.

**Rationale**: SQLite is already installed and is the current offline-record owner. A relational local store supports atomic transfer/refund/review updates, dense filtering, foreign keys, and offline durability without another dependency.

**Alternatives considered**: AsyncStorage is unsuitable for relational filtering and atomic multi-record changes; a new client database library adds abstraction and migration risk without solving a current gap; memory-only fixtures cannot prove offline drafts or synchronization states.

## Decision 4: Keep one owner for server-shaped financial state

**Decision**: Repository-backed financial records are exposed through typed services and coordinated through TanStack Query. Query keys own server-shaped lists, details, and summaries. Zustand remains limited to preferences and truly transient view state such as uncommitted filter presentation; durable drafts live in the repository.

**Rationale**: This follows the existing architecture and constitution rule against duplicating server-shaped state. Mutations can update or invalidate ledger, Home, account, and review queries together.

**Alternatives considered**: Mirroring the ledger in Zustand creates two owners; storing durable drafts only in component state loses data after interruption; direct repository calls scattered through routes make invalidation and error mapping inconsistent.

## Decision 5: Use atomic financial-change commands

**Decision**: All ledger mutations pass through a daily-money service that validates the command, performs related writes atomically, records the associated financial-change state, and returns affected query scopes. Automatic clear items may apply with immediate undo; uncertain items cannot apply until review; voice items require explicit confirmation.

**Rationale**: Transfers affect two accounts, refunds relate to originals, and undo must restore all derived summaries. A single mutation boundary prevents partial financial updates and extends the existing guarded `FinancialChange` state machine.

**Alternatives considered**: Screen-local mutations can leave balances and summaries inconsistent; a generic event-sourcing system is disproportionate for a frontend mock and would add speculative infrastructure.

## Decision 6: Preserve record history with status and relationships

**Decision**: Corrections update the current record through a validated mutation while retaining a financial-change snapshot sufficient for undo/correction. Delete is a user-visible lifecycle state rather than immediate physical removal. Refunds, reversals, duplicates, and transfers use explicit relationships instead of category or sign heuristics.

**Rationale**: Financial meaning remains explainable and reversible without introducing a full accounting engine. Explicit relations prevent refunds from appearing as salary and transfers from inflating income/expense.

**Alternatives considered**: Hard deletion destroys recovery evidence; encoding semantics only through positive/negative amount or category makes reporting and accessibility ambiguous; full double-entry accounting exceeds the approved frontend scope.

## Decision 7: Use indexed repository queries and native list virtualization

**Decision**: Filter and search in the repository using indexed transaction date, account, category, type, source, status, review, and normalized merchant/title fields. Render date-grouped results with React Native's virtualized list primitives and cursor-like page boundaries exposed by the service.

**Rationale**: The specification requires realistic 500-record discovery and dense lists. Existing platform primitives and database indexes are sufficient; loading only visible groups avoids a new list/search dependency.

**Alternatives considered**: Filtering the entire ledger inside components scales poorly and duplicates logic; adding a search engine or third-party list package is unnecessary for the stated scale.

## Decision 8: Compose existing design-system primitives and harden shared gaps centrally

**Decision**: Reuse current financial cards, transaction row, amount text, chips, segments, forms, state views, skeletons, sheets, dialogs, snackbars, and navigation. Harden shared transaction-row semantics, overlays, active-tab derivation, mixed-direction layout, amount wrapping, and amount entry only where the feature proves a missing behavior.

**Rationale**: The reviewed analysis found a broad component foundation but several production gaps. Fixing shared behavior once maintains Gulf Premium consistency and avoids a reference-inspired parallel UI kit.

**Alternatives considered**: Route-local copies would drift in RTL, accessibility, and themes; importing the reference palette or a new component library violates the constitution and adds no required behavior.

## Decision 9: Use existing form and validation dependencies

**Decision**: Use React Hook Form for form lifecycle and Zod schemas for account, category, transaction, transfer, refund, review, and voice-proposal validation. Map validation issues to localization keys and focus the first invalid field while preserving all other values.

**Rationale**: Both dependencies are already installed and used by the project. Central schemas can be reused by services and forms without duplicating validation rules.

**Alternatives considered**: Hand-written route validation would spread rules across screens; adding another form or schema library is unnecessary.

## Decision 10: Separate capture evidence from financial application

**Decision**: Automatic capture produces a `DetectedItem`; deterministic mock analysis classifies it as clear, review-required, rejected, or failed. Only the financial-change service can apply a result. Duplicate identity is based on source reference plus normalized financial signals, and reprocessing the same detection is idempotent.

**Rationale**: Permission to receive candidate data is not permission to mutate the ledger. Separation makes ambiguity, duplicates, OTP/failure exclusions, and review behavior independently testable.

**Alternatives considered**: Having the detector create transactions directly hides trust decisions; keyword-only classification overstates operating-system permission scope and cannot handle duplicates or ambiguous amounts.

## Decision 11: Use one platform audio adapter and ephemeral recordings

**Decision**: Add the Expo SDK 51-compatible `expo-av` package during implementation for foreground microphone permission and recording behind an `AudioRecordingService`. Do not record in the background. Store audio only in the application cache and delete it after cancel, failed analysis, re-record, or confirmed proposal. Transcription and analysis remain deterministic mock adapters with no provider call or key.

**Rationale**: Expo's supported audio module supplies native recording and permission behavior for the pinned SDK without a custom native module. An adapter keeps future migration replaceable; ephemeral files minimize sensitive-data exposure. Official Expo documentation confirms `expo-av` recording and microphone permission support, while the SDK-specific installer resolves the compatible package version: <https://docs.expo.dev/versions/v54.0.0/sdk/audio-av/>.

**Alternatives considered**: A visual-only recorder cannot validate microphone permission or interruptions; a custom native module is unnecessary; current `expo-audio` documentation targets newer SDKs and should not be introduced without upgrading the pinned application; production speech providers are outside scope.

## Decision 12: Keep Android SMS and iOS alternatives behind current platform boundaries

**Decision**: Extend the existing tracking permission/capability services rather than creating route-local platform checks. Android exposes status, recovery, mock detections, and pause/resume. iOS returns direct SMS tracking as unavailable and routes to manual, voice, and approved platform-assisted alternatives.

**Rationale**: SPEC-003 already owns education and permission mapping. Reusing that boundary prevents unsupported iOS claims and preserves denial fallbacks.

**Alternatives considered**: Duplicated permission state in the new feature can disagree with onboarding; rendering the same tracking screen on iOS is misleading.

## Decision 13: Treat privacy as a data-flow constraint

**Decision**: Reuse global sensitive-visibility state and external-display masking. Raw detected text and voice transcripts are excluded from analytics and error payloads, hidden from app-switcher/notification surfaces, and accessible only from authorized detail/review contexts. Tests use synthetic financial content.

**Rationale**: Masking only the balance component would leave alternate surfaces exposed. Data-flow rules cover accessibility announcements, logs, navigation previews, and async failures.

**Alternatives considered**: Per-screen masking toggles are inconsistent; retaining raw capture content indefinitely creates unnecessary privacy risk.

## Decision 14: Verify pure financial rules before native boundaries

**Decision**: Unit-test money arithmetic, transfer/refund semantics, state transitions, validation, filtering, duplicate classification, and query invalidation. Component-test the five user journeys in Arabic and English. Validate real microphone/SMS permissions, keyboard behavior, background masking, screen readers, large text, and interruption handling in development builds.

**Rationale**: Deterministic tests provide fast proof for money and trust rules; native checks cover behavior that a JavaScript test environment cannot faithfully reproduce.

**Alternatives considered**: Native-only validation is slow and incomplete on Windows; unit-only validation cannot prove operating-system prompts, audio interruptions, app-switcher privacy, or assistive technology behavior.

## Resolved Technical Context

All planning questions are resolved. No `NEEDS CLARIFICATION` item remains. The only new runtime dependency is the SDK-compatible audio recording module required for real microphone permission and capture; no new state, form, database, list, animation, or UI library is required.
