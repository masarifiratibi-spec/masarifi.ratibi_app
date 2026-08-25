# Phase 1 Data Model: R03 — Categories

R03 introduces no new persisted category entity. It documents current entities and ephemeral presentation/decision state.

## 1. Category

Existing fields:

- identity: `id`, `kind` (`system` or `custom`), Arabic label, English label;
- hierarchy: optional `parentId`;
- recognition: optional `iconKey`, `colorKey`, `isFavorite`;
- lifecycle: `status` (`active`, `archived`, `merged`), optional `mergedIntoId`;
- audit timestamps.

Duplicate labels remain allowed. Parent/cycle rules, archive/restore, merge, reclassification, and persistence remain core-finance-owned.

## 2. Category Identity Projection

Presentation-only fields:

- localized authoritative label and alternate-language context only where needed;
- supplied icon/color cue;
- parent label/hierarchy depth currently available;
- favorite and system/custom labels;
- active/archive/merged status and merge target where supplied;
- current action/selection availability.

The projection is not persisted and does not infer usage, recency, restrictions, or sync.

## 3. Category Form Draft

Component-local fields remain Arabic label, English label, parent, favorite, existing icon/color values, initial snapshot, errors, dirty flag, and saving state.

Rules:

- both labels remain required under current validation;
- parent cannot be self and repository owns cycle rejection;
- duplicate labels are accepted;
- hidden existing icon/color values are preserved on edit;
- dirty cancel requires deliberate discard;
- flow: `ready → invalid | saving → success | failure`.

## 4. Category Merge Decision

| Field | Rule |
|---|---|
| `source` | Existing active category to merge |
| `eligibleTargets` | Other active categories from current query |
| `selectedTarget` | Required before confirmation |
| `consequence` | Existing reclassification + source archive copy |
| `operationState` | idle, confirming, working, failure, success |

The UI never enumerates/reclassifies transactions itself. `mergeCategory` and its affected scopes remain authoritative.

## 5. Category Selection

| Field | Owner/Rule |
|---|---|
| `selectedId` | Caller-owned current selection |
| `eligibleCategories` | Active category query only |
| `favorites` | Existing `isFavorite`; current fallback priority |
| `recent` | Used only if an existing caller supplies it |
| `search` | Normalized current bilingual labels |
| `onSelect` / `onCancel` | Controlled caller boundary |

## State Transitions

```text
new → active custom category
active ↔ archived
active source → merged into active target
picker open → select/cancel/create handoff → caller applies result
```

No category sync-state transition exists in the current contract and none is added.

## Relationships

- Parent references another eligible category.
- Merge target receives current transaction assignments through existing core-finance behavior.
- R04/R05/R06/R09/R12/R13 consume category identity/selection but retain their calculations, drafts, and commands.
- R01 owns semantic/icon/form/modal/confirmation behavior.

