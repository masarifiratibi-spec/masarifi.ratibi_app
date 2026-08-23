# Phase 0 Research: R02 — Accounts

## Decision 1: Preserve all six routes and shell ownership

**Decision**: Keep the account route group, list, create, detail, edit, picker, `ProtectedRouteGate`, sanitized `returnTo`, create/edit result, and transfer deep link unchanged.

**Rationale**: Existing route meaning and security ownership are correct and explicitly outside redesign scope.

**Alternatives considered**: A primary Accounts tab, renamed routes, or an R02-specific gate were rejected.

## Decision 2: Keep account rules in core finance

**Decision**: Existing account queries, validation, repository, service commands, default reassignment, archive/restore, and `affectedScopes` invalidation remain authoritative. Screens own presentation and invoke typed callbacks only.

**Rationale**: This prevents duplicate account state and UI-owned financial rules.

**Alternatives considered**: A feature-local account store, optimistic archive, or presentation-owned validation were rejected.

## Decision 3: Correct the balance read boundary, not the display symptom

**Decision**: Supply list/detail rows with an authoritative feature-owned account-balance projection derived by the existing core-finance rule over the complete relevant ledger. Do not let a UI component calculate balance from the first paginated transaction page.

**Rationale**: Current screens can derive from a default 50-record page, which may understate dense-history balances. The rule itself does not change; its read boundary becomes truthful.

**Alternatives considered**: Keeping first-page derivation was rejected for financial trust. Reimplementing the ledger reducer in account components was rejected as duplicate business logic.

## Decision 4: Use one compact account identity row

**Decision**: Compose management and picker items from one R02 account identity/amount/status projection using R01 `GroupedList`, financial amount, sensitive-value, and semantic state contracts. Reserve summary emphasis for account detail.

**Rationale**: It removes card repetition while preserving one account grammar across contexts.

**Alternatives considered**: Continuing a hero card per account or creating separate management/picker card systems were rejected.

## Decision 5: Virtualize management and picker lists

**Decision**: Keep native virtualized lists for account management and selection and separate zero-accounts from zero-search-result states.

**Rationale**: The specification requires dense 30–100+ catalogues, long content, and responsive accessibility.

**Alternatives considered**: `ScrollView.map`, loading everything into cards, or a new list dependency were rejected.

## Decision 6: Treat picker state as caller-owned

**Decision**: R02 owns account search, eligibility, current selection, and picker presentation. The caller continues to own its draft/filter and receives selection/cancel through the existing controlled callback boundary. The route uses R01 `RouteModalContainer` and keeps current dismissal semantics.

**Rationale**: There is no current cross-route result store; inventing one in R02 would duplicate caller state.

**Alternatives considered**: A global picker store or R02-owned transaction draft was rejected.

## Decision 7: Render only supplied account states

**Decision**: Account rows show active/archived/default from `Account`, inclusion/exclusion only from existing Home/account projections, privacy visibility from the shared owner, and loading/error from current queries. They do not infer account sync/freshness from transaction status.

**Rationale**: The account contract has no sync or freshness field and must not display fabricated certainty.

**Alternatives considered**: Deriving account status from any related transaction was rejected.

## Decision 8: Preserve hidden optional account data on edit

**Decision**: When the current focused form does not expose institution, last four, credit limit, icon, color, or notes, editing preserves their existing values instead of replacing them with null.

**Rationale**: The redesign cannot cause data loss while keeping the same account contract.

**Alternatives considered**: Adding every optional field to R02 UI was rejected as scope expansion; silently clearing values was rejected.

## Decision 9: Add local dirty-form protection without new storage

**Decision**: Use the existing native confirmation pattern to guard meaningful create/edit changes. Do not create a new durable account-draft repository.

**Rationale**: This satisfies accidental-dismissal recovery with the smallest presentation behavior and no schema.

**Alternatives considered**: Durable account drafts or a new navigation service were rejected.

## Decision 10: Confirm archive/restore and block duplicates

**Decision**: Use R01 confirmation and pending/error feedback around existing archive/restore commands, then keep current invalidation and destination.

**Rationale**: Consequential state changes need explicit object/consequence and truthful completion.

**Alternatives considered**: Immediate or optimistic archive and a new undo rule were rejected.

## Decision 11: Defer transaction-row ownership to R04

**Decision**: Account detail provides an activity integration slot and consumes R04 rows after approval. Before that, it does not create a second transaction-row contract.

**Rationale**: R02 owns account composition, not transaction identity or commands.

**Alternatives considered**: A local account transaction row was rejected.

## Resolved Technical Context

- TypeScript/Expo/React Native current stack and existing dependencies cover all work.
- No new route, provider, permission, persistence entity, or package is required.
- One bounded read-only balance projection may extend the existing core-finance query/service boundary without changing its calculation.
- Account synchronization/freshness is not represented and will not be invented.

