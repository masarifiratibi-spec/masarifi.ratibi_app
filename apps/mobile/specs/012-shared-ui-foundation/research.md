# Phase 0 Research: R01 Shared UI Foundation

## Sources Reviewed

- `new_Desinge/REDESIGN_ANALYSIS.md`
- `specs/011-mobile-redesign-roadmap/spec.md`
- `specs/012-shared-ui-foundation/spec.md`
- `.specify/memory/constitution.md`
- The six R01-owned route files
- Existing `src/design-system`, `src/features/design-system`, and `src/features/shell` implementation and tests
- Current localization, preference, privacy, formatting, boundary-check, Jest, TypeScript, and Expo configuration
- `packages/ui-tokens/README.md`

No unresolved clarification remains. All decisions below use the implemented application as the functional baseline.

## Decision 1: Evolve the Existing Design System In Place

**Decision**: Keep `src/design-system` as the mobile runtime design system and evolve its current tokens, components, tests, and public exports.

**Rationale**: The codebase already has theme resolution, typography, motion, icons, privacy, controls, forms, overlays, feedback, financial components, charts, a gallery, boundary checks, and broad consumers. Replacing it would enlarge the diff, duplicate tested behavior, and conflict with the compatibility requirement.

**Alternatives considered**: A parallel v2 component tree, a third-party UI kit, and moving runtime tokens to `packages/ui-tokens` now were rejected because they add a second system or runtime that the repository does not currently provide.

## Decision 2: Extend Semantic Aliases, Not the Raw Palette

**Decision**: Preserve the current approved raw palette in `tokens.ts` and add theme-resolved aliases for surface, content, border, interaction, state, and financial presentation roles.

**Rationale**: The approved analysis keeps the palette and changes hierarchy and usage. A semantic layer supports themes and downstream consistency while the existing boundary checker already enforces centralized raw colors.

**Alternatives considered**: New raw colors per surface, component-selected palette values, and immediate destructive renaming were rejected because they fragment ownership or increase migration risk.

## Decision 3: Keep `AppTabs` as the Product Tab Source of Truth

**Decision**: Evolve `src/features/shell/AppTabs.tsx` directly and retire or compatibility-wrap the unused `BottomTabBar` after confirming its current no-consumer status.

**Rationale**: `AppTabs` is the only real tab component and already owns routes, localization, direction, icons, and selection. A generic third layer adds no product value.

**Alternatives considered**: Promoting `BottomTabBar`, adding a third generic component, or retaining both implementations were rejected as larger or duplicative.

## Decision 4: Add Only Four Missing Conceptual Patterns

**Decision**: Add grouped navigation rows, Source Mark, Financial Pulse, and Attention item/rail. Compose summaries, progress, and insights from current surfaces and primitives.

**Rationale**: These are the explicit gaps in the analysis. Existing `SurfaceCard`, `BalanceCard`, `FinancialProgress`, state, and chart primitives cover the remaining needs when evolved.

**Alternatives considered**: A component per visual example and feature-local implementations were rejected as speculative or duplicative.

## Decision 5: Use Native Modal and Accessibility Capabilities

**Decision**: Implement sheet/dialog behavior with React Native's installed `Modal`, keyboard avoidance, safe-area layout, accessibility modal semantics, focus management, and platform dismissal callbacks.

**Rationale**: Current overlays are inline views. Native primitives satisfy the missing behavior without another dependency or route change.

**Alternatives considered**: Restyling inline views, adding a sheet library, and replacing route-based modals were rejected because they fail behavior requirements or add unnecessary complexity.

## Decision 6: Separate Financial Display From Financial Meaning

**Decision**: Amount presentation receives explicit value, currency, sign/display treatment, tone, display state, and safe accessibility text. Formatting uses the existing locale-aware formatter. Feature/domain code remains the source of ledger meaning.

**Rationale**: Current `AmountText` infers signs and maps several meanings to income. A shared component must format and style an explicit projection without calculating meaning.

**Alternatives considered**: Keeping inference, caller-assembled strings, and feature-local formatting were rejected as unsafe, noncompliant, or duplicative.

## Decision 7: Keep Status and Recovery Caller-Supplied

**Decision**: Expand the shared presentation-state taxonomy, but require callers to provide localized title, message, consequence, recovery action, and source.

**Rationale**: State presentation is shared; cause and valid next action belong to the feature.

**Alternatives considered**: Design-system-owned recovery policy and one generic error state were rejected because both obscure real consequences.

## Decision 8: Preserve Existing Stores and Route Gates

**Decision**: Theme, locale, direction, reduced motion, privacy visibility, hydration, session, onboarding, pending destination, and notification-response behavior remain with current stores/providers.

**Rationale**: These paths already have extensive security and journey tests. R01 consumes state only for presentation.

**Alternatives considered**: A design-system store and moving navigation policy into redesigned components were rejected as duplicated state and architecture drift.

## Decision 9: Treat the Gallery as the Contract Harness

**Decision**: Expand the existing gallery into localized, realistic, switchable fixtures for each shared family and stress state; keep it diagnostic and directly reachable.

**Rationale**: It is the smallest existing place to review themes, directions, hidden values, states, and component misuse before later feature redesigns.

**Alternatives considered**: Production-screen-only validation, a separate Storybook application, and screenshot-only review were rejected as incomplete or unnecessary.

## Decision 10: Strengthen Existing Boundary Checks

**Decision**: Extend the design-system boundary script only where required to detect hard-coded user-visible shared/gallery prop strings and competing tokens. Reuse the shell checker unless a concrete gap appears.

**Rationale**: Existing scripts already scan for raw colors, token maps, provider SDKs, secrets, sensitive logging, and misplaced SMS behavior. Known gallery strings currently evade the narrow AST check.

**Alternatives considered**: A new static-analysis dependency and manual-only review were rejected because installed TypeScript AST support is sufficient.

## Decision 11: Validate High-Blast-Radius Changes Before Route Styling

**Decision**: Stabilize and test semantic foundations and shared contracts, migrate their consumers mechanically, then redesign each owned route surface independently.

**Rationale**: Surface, field, state, amount, and confirmation primitives have broad consumers. Shared-first sequencing prevents local workarounds.

**Alternatives considered**: Screen-first styling, redesigning every downstream feature in R01, and one final-only validation pass were rejected as rework or scope violations.

## Decision 12: Use Focused Automated Proof Plus Real Devices

**Decision**: Retain Jest/React Native Testing Library, typecheck, lint, and boundary scripts; add focused contract/regression tests; validate owned screens/gallery on Android and iOS across the required matrix.

**Rationale**: Tests prove contracts and route invariants; native layout, safe area, keyboard, fonts, focus, and assistive behavior require device rendering.

**Alternatives considered**: Snapshot-primary proof, screenshots alone, and new end-to-end tooling were rejected as insufficient or outside the smallest adequate solution.

