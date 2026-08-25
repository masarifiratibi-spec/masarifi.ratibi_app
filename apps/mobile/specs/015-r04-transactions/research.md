# Phase 0 Research: R04 — Transactions, Details, Editing, and Sync Conflicts

## Decision 1: Preserve routes and ledger ownership

**Decision**: Keep all six routes, transaction/domain/service/repository contracts, affected-scope invalidation, and sanitized navigation. R04 owns presentation, query composition, and route state only.

**Rationale**: Existing ledger rules, validation, delete/undo, conflict resolution, persistence, and downstream updates already have typed owners.

**Alternatives considered**: New routes, transaction models, endpoints, or feature-local repository were rejected.

## Decision 2: Use existing cursor pagination with native virtualization

**Decision**: Adapt the ledger query to consume existing `listTransactions(filters, cursor, pageSize)` pages and render one native virtualized chronological list/section model.

**Rationale**: The repository already supplies stable cursor pages and performance coverage for 1,000 records; the current screen displays only the first page.

**Alternatives considered**: Loading all records, a new pagination service, or a third-party list package were rejected.

## Decision 3: Create one typed transaction display projection

**Decision**: Map confirmed `Transaction` plus R02/R03 identity to localized row/detail presentation in one small R04 projector using existing financial-effect helpers and shared formatters.

**Rationale**: Current per-screen mapping collapses several types into expense and risks inconsistent sign/source/status wording. One projector fixes the shared root without moving rules into UI.

**Alternatives considered**: Per-screen mappings or new ledger calculations were rejected.

## Decision 4: Surface the complete existing filter set

**Decision**: Present every current `TransactionFilterSet` field: period, accounts, categories, types, sources, record status, sync status, review requirement, amount range, and sort. Keep applied/draft ownership in the current view store and add only begin/cancel/reset operations required for true cancellation.

**Rationale**: Domain/repository already support these filters; UI currently exposes only search and amount range.

**Alternatives considered**: New semantics, URL-owned filters, or permanent inactive chips were rejected.

## Decision 5: Preserve ledger context without new global state

**Decision**: Reuse mounted tab/stack state, current filter store, route origin, and a local virtual-list offset/ref where necessary. Do not persist scroll or selected record in another store.

**Rationale**: Existing navigation retains the ledger screen and a second context owner is unnecessary.

**Alternatives considered**: SQLite/Zustand scroll persistence or new route parameters were rejected.

## Decision 6: Recompose detail as a record

**Decision**: Order detail amount/type/status → identity/core fields → Source Mark/explanation → supplied relationships → eligible actions using R01 grouped and privacy primitives.

**Rationale**: It matches the approved analysis and requires no data/command change.

**Alternatives considered**: One generic `SurfaceCard`, form-like detail, or inferred relationships were rejected.

## Decision 7: Share form anatomy with R05, not command ownership

**Decision**: R05 defines reusable Add/edit form presentation. R04 retains edit loading/missing/error, current-value adapter, update command, result, conflict, and return behavior.

**Rationale**: The current `TransactionForm` is shared; two redesign implementations would conflict and drift.

**Alternatives considered**: Separate duplicate edit form or moving confirmed-record ownership to R05 were rejected.

## Decision 8: Use the persisted undo deadline

**Decision**: Add delete consequence confirmation, working/error state, and a textual countdown derived from current `undoExpiresAt`; restore it on reopen and block duplicate delete/undo commands.

**Rationale**: The repository already persists the exact 30-second deadline and prior state.

**Alternatives considered**: New undo duration/rule or screen-local-only timer were rejected.

## Decision 9: Use one conflict comparison body in two containers

**Decision**: Full-screen and modal routes share one R04 comparison body. It compares only supplied changed fields and uses existing domain helpers for financial effects. Expose only repository-supported `keep_local` and `keep_later`, then one explicit resolving action.

**Rationale**: `keep_both` exists in the broad type but current repository rejects it; the UI must not advertise unsupported behavior.

**Alternatives considered**: Silent merge, immediate two-button resolution, `keep_both`, or duplicate route content were rejected.

## Decision 10: Fix shared defects at R01 ownership

**Decision**: Correct any raw English financial/source label in R01 `TransactionRow`/`SourceMark` through the shared contract, then consume it from R04. Local R04 workarounds are prohibited.

**Rationale**: Shared defects otherwise recur in every downstream transaction consumer.

**Alternatives considered**: Screen-local text hiding or duplicate Source Mark were rejected.

## Decision 11: Map only truthful transport/freshness states

**Decision**: Derive initial/loading/refetch/error/partial-cached presentation only from current query/error evidence. TransactionPage has no explicit freshness/offline field, so R04 does not fabricate one or label local outcomes synchronized.

**Rationale**: Financial status must reflect the actual contract.

**Alternatives considered**: Heuristics from connectivity or unrelated record status were rejected.

## Resolved Technical Context

- Current TypeScript/Expo stack, native list/modal, React Query, Zustand, Zod, SQLite, and R01 components cover all work.
- No new route, database schema, provider, permission, business state, or dependency is required.
- R02/R03 picker return contracts and R05 form anatomy are implementation gates for their shared integration points.

