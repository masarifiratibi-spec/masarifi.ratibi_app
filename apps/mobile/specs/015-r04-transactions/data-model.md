# Phase 1 Data Model: R04 — Transactions

R04 adds no persisted transaction entity. It documents existing ledger models and ephemeral presentation/query state.

## 1. Confirmed Transaction

Existing fields remain: identifier, type, amount/currency, source/destination accounts, fee, category, title/merchant/payment method, occurrence time, source, record/review/sync status, original transaction, obligation, notes, version/adjustment sign, delete/undo metadata, and audit timestamps.

All financial effects, validation, eligibility, correction, and persistence remain current domain/service ownership.

## 2. Transaction Display Projection

Presentation-only fields:

- localized title/merchant and R02/R03 identity;
- shared formatted date and amount run;
- feature-owned financial sign/tone from existing effect/type rules;
- localized type, source, record/review/sync labels;
- supplied transfer/original/obligation/duplicate context;
- hidden/unknown state and eligible action list.

It is not persisted and cannot infer missing relationships or mutate a transaction.

## 3. Transaction Page and Ledger Section

Existing page: `items`, `nextCursor`, `total`.

Ephemeral ledger projection:

- accumulated pages for current applied filters;
- stable flattened items without duplicates;
- chronological date section key/label;
- next-page loading/error state;
- current virtual-list offset/ref;
- origin/return context.

Changing applied filters resets pages and scroll according to current list behavior; opening detail retains the mounted ledger context.

## 4. Transaction Filter Session

Existing filter fields remain search, period, account IDs, category IDs, types, sources, record statuses, sync statuses, review requirement, min/max amount, and sort.

Presentation phases:

```text
applied → begin edit (copy to draft)
draft → apply → applied
draft → cancel → prior applied
draft/applied → clear/reset → empty filter set
```

Active-filter descriptors/count are derived, localized UI values only.

## 5. Ledger Context

Ephemeral state: applied filters/sort, pages, scroll position, origin/return route, hidden-value state, and last selected transaction. No new durable store is introduced.

## 6. Correction Operation

Runtime states for edit/report/delete/undo:

- idle;
- confirmation where required;
- working;
- saved local/pending only when supplied;
- success;
- failure/retry;
- expired for undo.

Delete uses current `undoExpiresAt`; no new duration or audit rule.

## 7. Sync Conflict Comparison

Existing conflict contains local and later transaction snapshots, status, supported resolution, and timestamps.

Presentation derives:

- labelled snapshot identities;
- only fields whose supplied values differ;
- existing-domain financial effect for each version;
- hidden-value behavior;
- selected supported resolution (`keep_local` or `keep_later`);
- resolving/failure/resolved state.

`keep_both` is not exposed because the current repository rejects it.

## Relationships

- R02 supplies account identity/picker; R03 supplies category identity/picker.
- R05 supplies shared form anatomy; R04 owns update orchestration.
- R06 owns unconfirmed automatic candidates; R04 receives only confirmed records.
- Home/planning/reports/notifications/Assistant consume the confirmed transaction presentation while retaining their own calculations/routes.

