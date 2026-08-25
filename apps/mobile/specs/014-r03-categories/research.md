# Phase 0 Research: R03 — Categories

## Decision 1: Keep existing category ownership and routes

**Decision**: Preserve the category route group, list, create, combined detail/edit route, picker route, protected category layout, and current service/repository ownership.

**Rationale**: Category persistence, hierarchy, archive/restore, merge, and transaction reclassification already have typed tested owners.

**Alternatives considered**: New routes, category store, service, or permission gate were rejected.

## Decision 2: Use normalized bilingual search and virtualization

**Decision**: Use the existing search normalization helper for Arabic/English content and native virtualization for management and picker lists. Preserve favorites-first stable sorting and active-only picker eligibility.

**Rationale**: This handles 150+ records, Arabic variants, and long labels without a new search/list dependency.

**Alternatives considered**: Ad-hoc lowercase matching, a search library, or `ScrollView.map` were rejected.

## Decision 3: Define one category identity anatomy

**Decision**: Compose localized authoritative label, optional icon/color cue, hierarchy, favorite, system/custom kind, and explicit active/archive/merged state once within R03 and reuse it in management and selection contexts.

**Rationale**: Identity stays consistent while management and picker actions remain different.

**Alternatives considered**: Per-category elevated cards and icon-only grids were rejected.

## Decision 4: Render only category states the contract supplies

**Decision**: Management includes system/custom, favorite, hierarchy, active, archived, and merged data. Picker remains active-only. R03 does not invent recency, usage counts, sync/freshness, system restrictions, duplicate-label rejection, or new icon/color choices.

**Rationale**: None of those missing states/rules exist in the authoritative category contract.

**Alternatives considered**: UI inference or new repositories were rejected.

## Decision 5: Replace parent radio walls with an existing picker pattern

**Decision**: Use R01 `PickerField` and searchable modal/sheet presentation for current active parent candidates, no-parent, and self-exclusion. The repository retains cycle validation.

**Rationale**: It improves density without changing hierarchy rules.

**Alternatives considered**: A tree editor or hierarchy dependency was rejected.

## Decision 6: Make archive/restore/merge deliberate

**Decision**: Use R01 confirmation around existing `setCategoryStatus` and `mergeCategory` commands. Merge requires an explicit active target, visible source/target comparison, consequence copy, one confirmation, pending state, and failure recovery.

**Rationale**: Current immediate mutation and first-target shortcut do not provide a trustworthy decision surface.

**Alternatives considered**: New preview endpoints, optimistic merge, or presentation inspection of transactions were rejected.

## Decision 7: Preserve mutation and invalidation ownership

**Decision**: Continue calling existing typed commands and `affectedScopes` invalidation; add only local operation state to block duplicate submission and render working/failure/success.

**Rationale**: Downstream reclassification and refresh remain authoritative and atomic.

**Alternatives considered**: Optimistic local category/transaction updates were rejected.

## Decision 8: Use a local dirty guard, not durable category drafts

**Decision**: Protect meaningful create/edit input through existing native confirmation patterns. Add no draft table or repository.

**Rationale**: This is sufficient for accidental dismissal and avoids new product/storage scope.

**Alternatives considered**: Durable drafts or a generic form engine were rejected.

## Decision 9: Keep picker return controlled and caller-owned

**Decision**: R03 owns search, favorites, active eligibility, current selection, and modal presentation. R04/R05 and other callers retain their draft/filter and apply select/cancel/create-return outcomes.

**Rationale**: The current route has no global result transport and R03 must not duplicate caller state.

**Alternatives considered**: A global category selection store or route-owned transaction draft were rejected.

## Decision 10: Correct spec contradictions with implemented rules

**Decision**: Duplicate labels remain allowed and receive identity context; category sync/pending state is not shown because the contract has no such field. Query/storage failure uses current mapped error/retry.

**Rationale**: The redesign must fit the real product and cannot create a new validation or synchronization rule.

**Alternatives considered**: Adding duplicate rejection or synthetic sync status during UI redesign was rejected.

## Resolved Technical Context

- Existing Expo/React Native, R01 components, TanStack Query, Zod, and core-finance repository cover all work.
- No new route, provider, permission, dependency, database entity, category rule, or platform-specific behavior is required.
- The specification was aligned with the implemented duplicate-label and sync contracts before design completion.

