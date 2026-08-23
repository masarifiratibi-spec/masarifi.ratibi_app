# Implementation Plan: R01 — Design System, App Shell, and Shared Components

**Branch**: `012-shared-ui-foundation` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: R01 feature specification in `specs/012-shared-ui-foundation/spec.md`, grounded in `new_Desinge/REDESIGN_ANALYSIS.md` and the implemented Masarifi mobile application.

## Summary

Evolve the existing Masarifi mobile design system in place into the Gulf Premium v2.2 shared presentation contract, then apply that contract to the six R01-owned shell surfaces without changing route resolution, gates, commands, feature data, or financial rules. The implementation will extend the existing semantic token/theme adapter, typography, shared primitives, financial/state/chart presentation, localization, privacy, and gallery; reuse React Native/Expo capabilities already installed; keep `AppTabs` as the single production tab implementation; and add only the four genuinely missing reusable concepts identified by the approved analysis: grouped navigation rows, source marks, Financial Pulse, and Attention items/rail.

Implementation proceeds from low-level shared contracts to high-blast-radius components, then through each owned screen/container independently. Existing consumers receive only compatibility updates required by changed shared contracts; their feature-owned screen hierarchy remains outside R01.

## Technical Context

**Language/Version**: TypeScript 5.3.3 in strict mode; React 18.2; React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, React Native Safe Area Context 4.10, React Native Screens 3.31, React Native SVG 15.2, i18next 23.12, Zustand 4.5, existing Expo Vector Icons

**Storage**: No new storage. Existing Zustand preference and app-shell state plus current secure preference storage remain unchanged.

**Testing**: Jest 29 with `jest-expo`, React Native Testing Library 12.5, existing boundary scripts, TypeScript typecheck, ESLint, gallery inspection, and Android/iOS device validation

**Target Platform**: Existing Expo development-build application for supported Android and iOS phones; current tablet support and diagnostic Expo rendering must not regress

**Project Type**: React Native/Expo mobile application with file-based routing and feature-oriented source modules

**Performance Goals**: No added blocking work before entry-route resolution; tab and control feedback remains immediate; standard motion completes in 100–240 ms; reduced-motion state is immediate; shared components remain smooth at normal 60 Hz interaction

**Constraints**: Preserve all current route and business behavior; no new dependencies or providers; portrait-first layout; 320×568 minimum validation viewport; 44×44 minimum targets; 200% text; Arabic RTL/English LTR parity; English numerals; light/dark/system themes; privacy masking; keyboard and safe-area support; offline and provisional states remain truthful

**Scale/Scope**: Six owned route surfaces, the existing `src/design-system` and design-system gallery, shared localization keys, shell presentation, and compatibility validation for all current consumers across R02–R20

## Constitution Check

*GATE: Passed before Phase 0 research; re-checked after Phase 1 design.*

- **Financial trust — PASS**: Shared financial components receive feature-owned display meaning and actions. The plan removes sign/ledger inference from amount presentation, keeps unknown/zero/hidden/provisional values distinct, and retains source, confirmation, correction, and recovery contracts.
- **Platform honesty — PASS**: R01 introduces no platform capability. Permission and state primitives represent feature-supplied Android/iOS behavior without requesting permissions or claiming unsupported SMS access. Existing manual and voice fallbacks remain feature-owned.
- **Language and access — PASS**: Shared contracts require Arabic RTL and English LTR parity, localized strings, English numerals, bidi isolation, 200% text, 44×44 targets, screen-reader order, non-color meaning, contrast, keyboard handling, and reduced motion.
- **Design system — PASS**: Raw palette ownership remains in `src/design-system/tokens.ts` until `packages/ui-tokens` provides runtime exports. Consumers use semantic roles. Teal remains primary, bronze restrained, borders precede elevation, and real state coverage is explicit.
- **Architecture and proof — PASS**: The plan retains Expo/React Native/TypeScript, adds no provider or secret, keeps business rules out of presentation, defines typed UI contracts, preserves existing adapters/stores, and names focused tests, boundary checks, gallery validation, and device QA.

### Post-Design Re-check

- `research.md` resolves every technical choice without a constitution exception.
- `data-model.md` contains presentation-only entities and explicitly excludes persisted financial data and feature commands.
- `contracts/shared-presentation-contract.md` separates display tone, source, status, and recovery from feature-owned financial meaning.
- `quickstart.md` verifies route preservation, themes, both directions, accessibility, privacy, reduced motion, and real-device behavior.
- No complexity violation requires justification.

## Project Structure

### Documentation (this feature)

```text
specs/012-shared-ui-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── shared-presentation-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md                              # Created later by /speckit-tasks
```

### Existing Source Code in Scope

```text
app/
├── _layout.tsx                           # Root presentation only
├── index.tsx                             # Entry loading presentation only
├── (tabs)/_layout.tsx                    # Five-tab shell
├── design-system/index.tsx               # Diagnostic gallery route
├── modals/auth-required.tsx              # Protected-entry presentation
└── modal/planning-conflict.tsx            # Shared container only

src/
├── components/StyledText.tsx             # Typography consumer
├── design-system/
│   ├── tokens.ts
│   ├── theme.ts
│   ├── typography.ts
│   ├── motion.ts
│   ├── icons.tsx
│   ├── privacy.ts
│   ├── external-sensitive-display.ts
│   ├── index.ts
│   ├── charts/
│   └── components/
│       ├── feedback/
│       ├── financial/
│       ├── forms/
│       ├── navigation/
│       └── overlays/
├── features/
│   ├── design-system/
│   │   ├── DesignSystemGallery.tsx
│   │   └── gallery/
│   └── shell/
│       ├── AppTabs.tsx
│       ├── PlaceholderRoute.tsx
│       ├── ProtectedRouteGate.tsx        # Regression validation only
│       ├── resolve-entry-route.ts        # Regression validation only
│       └── navigation-context.ts         # Regression validation only
├── localization/messages/
├── state/
│   ├── preferences.ts                    # Behavior preserved
│   └── SensitiveVisibilityProvider.tsx   # Behavior preserved
└── utils/format-financial-value.ts

scripts/
├── check-design-system-boundaries.mjs
└── check-app-shell-boundaries.mjs
```

**Structure Decision**: Keep the current feature-oriented Expo application and `src/design-system` public surface. Extend files where a current primitive already owns the responsibility. Add a new file only for one of the four missing reusable concepts or when an existing file would combine unrelated responsibilities. `packages/ui-tokens` currently contains documentation only, so the mobile token adapter remains the runtime source of truth and is ready to consume that package later without moving R01 scope across packages.

## Implementation Design

### 1. Semantic Foundation

- Expand `ThemeColors` and resolved theme metrics with semantic surface, content, border, interaction, and state aliases while retaining current names as migration aliases until all existing consumers compile.
- Keep every raw color in `tokens.ts`; reuse the approved teal, bronze, warm-neutral, status, and financial families rather than adding a second palette.
- Update type roles to caption, support, body, label, subtitle, title, summary, and row amount; route all shared text through locale-aware IBM Plex families.
- Add the 16-radius overlay/hero role and retain the current spacing rhythm, minimum targets, border-first hierarchy, and overlay-only elevation.
- Preserve current motion buckets, aligning them to the 100–240 ms contract and making reduced motion immediately apply the final state.
- Centralize bidi-safe financial display through the existing financial formatter; amount components receive display sign/tone/state rather than inferring ledger meaning.

### 2. Existing Primitive Evolution

- Evolve `SurfaceCard` into explicit semantic surfaces without making every repeated item a card.
- Differentiate current button variants, add stable pressed/focused/loading behavior, and retain `usePendingAction` for duplicate-submit blocking.
- Extend fields and selection controls with explicit invalid, disabled, read-only, selected, focus, required/optional, and direction behavior.
- Replace inline sheet/dialog presentation with React Native-native modal semantics, keyboard/safe-area containment, focus containment/return, and localized dismissal; add no overlay dependency.
- Expand state and status presentation to cover the specification vocabulary while keeping copy, recovery actions, and financial consequences caller-supplied.
- Keep `AppTabs` as the sole product tab component. The unused `BottomTabBar` will be removed or reduced to a compatibility re-export after confirming no external consumer; no second tab abstraction will remain.

### 3. Financial, Attention, and Chart Presentation

- Refactor `AmountText` so formatting, sign, display state, financial tone, and accessibility value are explicit inputs. Update current shared-card and direct feature consumers mechanically without redesigning their screens.
- Evolve `FinancialProgress` to accept caller-supplied status/threshold text and values; remove hard-coded English and presentation-owned threshold meaning.
- Add only the missing shared concepts from the approved analysis: `GroupedList`/`NavigationRow`, `SourceMark`, `FinancialPulse`, and `AttentionItem`/`AttentionRail`.
- Compose summaries, progress, and insights from existing surfaces and primitives instead of adding separate speculative component families.
- Keep chart grouping/series limits and SVG rendering, while moving question, scope, summary, labels, empty/hidden/error meaning, and drill-down behavior into the accessible frame contract. Feature areas still own data and the question answered.

### 4. Owned Screen and Container Slices

1. **Root layout and entry**: Apply system-surface and startup-state presentation without changing provider order, privacy gating, notification response runtime, hydration, or redirect resolution.
2. **Five-tab shell**: Apply the premium integrated tab treatment to `AppTabs`, preserve all routes/order/direction rules, and validate safe areas, selection, focus, labels, and Add emphasis.
3. **Auth-required modal**: Replace placeholder hierarchy with the shared state/overlay presentation while preserving sanitized pending destination, sign-in, and back actions.
4. **Planning-conflict container**: Apply only shared modal/container structure; do not edit planning conflict content, decisions, or commands.
5. **Design-system gallery**: Organize foundation, navigation, interaction, financial, state, chart, accessibility, and privacy sections with localized realistic fixtures and toggles for locale/theme/visibility/motion and stress states.

### 5. Compatibility and Adoption

- Inventory every import before changing a public prop or export.
- Prefer additive or mechanical migrations in R01; do not redesign downstream feature layouts.
- Keep public exports in `src/design-system/index.ts` explicit and typed.
- Add consumer-regression tests for high-blast-radius primitives, especially surface, amount, state, field, confirmation, and tab contracts.
- Strengthen the existing boundary checker only where needed to catch local raw tokens and hard-coded gallery/shared strings that the current AST rules miss.

## Planned Verification

### Automated

- Unit and component tests for tokens/theme/type/motion/icons/privacy, primitives, forms, overlays, states, financial presentation, charts, gallery, and tabs.
- Entry resolver, protected navigation, root layout options, shell direction/localization/accessibility, and validation-route regression tests remain green.
- `npm run check:design-system` rejects raw colors, local token maps, and unlocalized shared/gallery copy.
- `npm run check:app-shell` continues to reject provider SDKs, secrets, sensitive logging, raw shell colors, and Android SMS behavior outside its boundary.
- Typecheck, lint, and the focused R01 Jest suite pass before device validation.

### Visual and Device

- Validate each owned route independently before moving to the next route group.
- Use Arabic RTL and English LTR, light/dark/system, visible/hidden values, standard/200% text, screen reader, reduced motion, keyboard, and offline/provisional fixtures.
- Validate the minimum 320×568 viewport and at least one larger phone.
- Validate on a supported Android device and supported iOS device or approved iOS device environment.
- Record and fix validation defects in the owning shared component, never as a local screen workaround.

## `/tasks` Handoff

Future `tasks.md` MUST follow the parent roadmap contract and be ordered as:

1. Shared Foundation.
2. Screen: Root Layout and Entry.
3. Screen: Five-Tab Shell.
4. Screen: Auth Required.
5. Screen: Planning Conflict Shared Container.
6. Screen: Design-System Gallery.
7. Cross-consumer regression and final R01 consistency.

Each screen group must include structure, shared dependencies, styling, interactions, applicable states, Arabic RTL, English LTR, accessibility, motion, tests, real-device validation, and fixes discovered during validation. Tasks must name exact files/components and completion evidence; downstream feature redesign must not be mixed into R01.

## Complexity Tracking

No constitution violations or exceptional complexity are planned.

