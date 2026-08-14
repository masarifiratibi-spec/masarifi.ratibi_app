# Research: Home, Accounts, Transactions, and Categories

## Decision 1: Use one ledger as the financial source of truth

**Decision**: Accounts store an opening balance, while current balances, Home totals, account
summaries, and transaction views derive from posted ledger effects. A balance correction creates
an adjustment transaction rather than overwriting the account.

**Rationale**: This implements the clarification directly and prevents Home, Accounts, and the
ledger from holding contradictory balances.

**Alternatives considered**: Storing an editable current balance duplicates financial state;
recalculating separately in each screen creates inconsistent rules.

## Decision 2: Represent money as integer minor units

**Decision**: Persist and calculate amounts as safe integers in currency minor units with an ISO
currency code and scale. Convert to localized display values only at the formatting boundary.

**Rationale**: Integer arithmetic avoids floating-point drift in balances, fees, transfers,
refunds, adjustments, undo, and category/account summaries.

**Alternatives considered**: JavaScript decimal numbers are unsafe as the ledger authority; a
new decimal package is unnecessary for the approved currencies and mock scale.

## Decision 3: Extend the existing SQLite database

**Decision**: Add a forward-only migration for accounts, categories, transactions, drafts,
deletion markers, exchange-rate fixtures, and sync conflicts. Repository methods own all direct
database access and multi-record transactions.

**Rationale**: Expo SQLite is already installed and owns offline records. It supports relational
constraints, indexed filtering, durable drafts, and atomic transfer/refund/merge operations.

**Alternatives considered**: AsyncStorage cannot safely coordinate relational financial writes;
memory-only fixtures cannot prove interruption or offline behavior; another database dependency
adds no needed capability.

## Decision 4: Keep service-shaped state in TanStack Query

**Decision**: Repository-backed Home, account, category, transaction, detail, and selector data
is exposed through typed services and coordinated through TanStack Query. Zustand stores only
transient filter presentation and existing user preferences; durable drafts stay in SQLite.

**Rationale**: This follows the constitution's one-owner rule and the current application pattern.
Mutations can invalidate precise read scopes without mirroring the ledger in global state.

**Alternatives considered**: Copying records into Zustand creates two owners; component-only
drafts are lost on interruption; direct database calls from routes scatter error mapping.

## Decision 5: Apply financial mutations atomically

**Decision**: One core-finance service validates and applies transaction creation, transfer,
refund, reversal, adjustment, correction, delete, undo, account archive, and category merge in a
single database transaction where more than one record is affected.

**Rationale**: Transfers affect two balances, refunds reference originals, merges reclassify many
records, and corrections must update every derived view together.

**Alternatives considered**: Screen-local writes permit partial financial changes; full event
sourcing is unnecessary for a frontend mock and exceeds the feature scope.

## Decision 6: Use lifecycle deletion with a 30-second undo

**Decision**: Eligible delete immediately marks the transaction deleted and removes its effects
from active views. A persisted undo deadline allows restoration for 30 seconds; after expiry the
transaction remains a deletion marker outside normal financial views.

**Rationale**: This preserves the clarified user experience, financial audit consistency, and
recovery without physically erasing relationship context.

**Alternatives considered**: Immediate hard deletion loses correction evidence; indefinite undo
makes lifecycle and synchronization ambiguous.

## Decision 7: Make multi-currency estimates explicit

**Decision**: A mock exchange-rate service converts supported account balances to the user's
profile currency. Estimated totals retain each original amount/currency and rate timestamp.
Balances without a usable rate are excluded and listed in the estimate warning.

**Rationale**: Users can understand what the aggregate includes and never mistake missing
conversion data for a complete total.

**Alternatives considered**: Treating currencies as equal is financially incorrect; hiding the
whole total removes useful information; introducing real rate infrastructure is outside scope.

## Decision 8: Resolve offline conflicts manually

**Decision**: When a pending local transaction conflicts with a later version, preserve both
snapshots and expose keep local, keep later, or keep both. No version is overwritten before the
user chooses, and the result returns to pending synchronization.

**Rationale**: Silent last-write-wins can lose a financial correction. Explicit comparison is
small, testable, and aligned with user control.

**Alternatives considered**: Last-write-wins risks data loss; automatic field merging can produce
a transaction the user never entered; blocking all offline edits violates the manual fallback.

## Decision 9: Query and virtualize the required ledger scale

**Decision**: Filter, sort, group, and page transactions in the repository using indexes on date,
account, category, type, source, status, sync status, review state, and normalized title. Render
results with React Native's native virtualized list primitives.

**Rationale**: The required 500-record fixture is well within SQLite and native list capability;
the approach avoids loading and filtering the full ledger in feature components.

**Alternatives considered**: In-component filtering duplicates query rules and scales poorly;
a third-party list or search engine is unnecessary at this scope.

## Decision 10: Reuse installed form and design-system primitives

**Decision**: Use React Hook Form and Zod for account, category, transaction, transfer, refund,
and conflict forms. Compose existing amount, balance, account, transaction, picker, sheet,
dialog, state, skeleton, and undo components, hardening shared behavior only where tests expose
a gap.

**Rationale**: The required dependencies and most UI primitives already exist. Central schemas
keep service and form validation aligned while avoiding route-local copies.

**Alternatives considered**: Hand-written form state spreads validation; a new UI or form library
duplicates existing capability and risks visual inconsistency.

## Decision 11: Merge categories transactionally

**Decision**: After an impact preview and explicit confirmation, update all source-category
transaction references to the selected target, mark the source category merged/archived, retain
its target relationship, and expose only the target in future selectors.

**Rationale**: This implements the clarification in one atomic operation and retains enough
context to explain historical reclassification.

**Alternatives considered**: Leaving historical records on the source contradicts the selected
merge semantics; deleting the source loses context; background partial migration is unnecessary.

## Decision 12: Prove financial rules before native presentation

**Decision**: Unit-test money and balance effects, state transitions, filters, deletion expiry,
currency exclusions, conflicts, and merge rules. Component-test each user journey in Arabic and
English. Validate keyboard, lifecycle, offline, TalkBack/VoiceOver, 200% text, themes, masking,
and real-device layout in development builds.

**Rationale**: Deterministic tests provide fast proof for money behavior; native checks cover
operating-system and assistive-technology behavior that the JavaScript environment cannot prove.

**Alternatives considered**: Native-only testing is slow and incomplete on Windows; unit-only
testing cannot prove keyboard, screen reader, safe-area, lifecycle, or device layout behavior.

## Resolved Technical Context

All planning questions are resolved. SPEC-004 needs no new runtime dependency and has no
unresolved technical decision.
