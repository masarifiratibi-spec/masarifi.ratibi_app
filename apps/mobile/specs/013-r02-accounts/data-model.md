# Phase 1 Data Model: R02 — Accounts

R02 adds no persisted account entity. It documents existing account ownership and presentation projections required by the redesigned screens.

## 1. Account

Existing fields remain:

- identity: `id`, `name`, `type`;
- money: `currencyCode`, `openingBalanceMinor`, optional `creditLimitMinor`;
- institution/identity: optional `institution`, `lastFour`, `iconKey`, `colorKey`, `notes`;
- control: `isDefault`, `status` (`active` or `archived`);
- audit: creation/update timestamps.

Validation, default reassignment, archive/restore, and currency editability remain in current core-finance ownership.

## 2. Account Balance Projection

| Field | Meaning | Rule |
|---|---|---|
| `accountId` | Account identity | References an existing account |
| `balanceMinor` | Authoritative derived balance | Existing opening-balance + complete qualifying-ledger rule |
| `currencyCode` | Display currency | From account |
| `displayState` | confirmed, estimated, unknown, hidden | Supplied/derived by existing projection and privacy owner |
| `inclusionState` | included, excluded, unavailable | Present only when current aggregate projection supplies it |

This is a read-only projection, not a new balance field. Presentation cannot mutate it or derive it from a partial page.

## 3. Account List Item

Presentation-only composition:

- account identity and localized type;
- masked identifier or currency context;
- Account Balance Projection;
- default/archive/inclusion status where supplied;
- current action availability.

It is not persisted and contains no financial calculation.

## 4. Account Form Draft

Component-local fields remain name, type, currency, opening balance, default choice, initial account snapshot, validation error, dirty state, and saving state.

Rules:

- create uses current required validation;
- edit keeps currency read-only under current behavior;
- current derived balance is never editable;
- optional stored fields not exposed by the form are copied from the initial account on update;
- dirty cancel transitions to discard confirmation;
- state flow: `ready → invalid | saving → success | failure`; no durable draft storage is added.

## 5. Account Selection

| Field | Owner | Rule |
|---|---|---|
| `selectedId` | Caller | May be absent |
| `eligibleAccounts` | Core finance/R02 query | Active selectable accounts only |
| `search` | Picker presentation | Current name/currency/masked-digit semantics |
| `originDraft` | Caller | R02 never copies or mutates it |
| `onSelect` / `onCancel` | Caller/route boundary | Existing controlled return semantics |

## 6. Archive/Restore Operation

Presentation states: idle → confirming → working → success/navigation or failure/retry. The repository remains authority for account status and replacement default. No optimistic state or new undo is added.

## Relationships

- Balance projection consumes the complete feature-owned ledger rule.
- R04 owns recent transaction row identity/action.
- R05, R06, R08, and R12 consume account selection but retain their drafts/calculations.
- R07/Home supplies aggregate inclusion/exclusion where available.
- Shared privacy state owns visible/hidden financial values.

