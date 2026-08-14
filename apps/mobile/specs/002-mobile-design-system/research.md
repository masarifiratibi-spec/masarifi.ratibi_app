# Phase 0 Research: Mobile Design System and Interaction Language

## Decision 1: Build on the Existing Mobile Boundary

**Decision**: Extend `src/design-system/tokens.ts`, `theme.ts`, and the existing ThemeContext.
Do not introduce a second theme provider, styling framework, component registry, or UI kit.

**Rationale**: SPEC-001 already established the single semantic boundary. Reusing it produces
the smallest coherent change and prevents feature components from choosing between systems.

**Alternatives considered**:

- New mobile UI framework: rejected because the required behavior is covered by React Native
  primitives and the existing theme boundary.
- Separate SPEC-002 theme provider: rejected because it would split token ownership.
- Import Admin components: rejected because mobile has different density and navigation rules.

## Decision 2: Keep Central Token Ownership in the Mobile Adapter

**Decision**: Treat `src/design-system/tokens.ts` as the central runtime source for this app
until `packages/ui-tokens` exports actual values. Add missing values there before component use,
and keep feature-local raw colors or token aliases prohibited.

**Rationale**: `packages/ui-tokens` currently contains only a README. Moving ownership now
would create package scaffolding without a runtime consumer contract. The adapter already
documents the migration boundary.

**Alternatives considered**:

- Build the workspace package now: deferred until it has at least two runtime consumers and a
  repository package build contract.
- Duplicate missing values in components: rejected by the constitution and clarification.

## Decision 3: Use Thin Typed Components and React Native StyleSheet

**Decision**: Implement components as typed wrappers and compositions over `Pressable`, `View`,
`Text`, `TextInput`, `Switch`, `Modal`, safe-area, and keyboard primitives. Keep styling in
`StyleSheet` with semantic values supplied by the active theme.

**Rationale**: The component inventory needs consistent state and accessibility behavior, not
a custom rendering engine. Small primitives can compose the required financial components.

**Alternatives considered**:

- Schema-driven component factory: rejected because it adds indirection without multiple
  rendering targets.
- Runtime style utility framework: rejected because no installed dependency or requirement
  justifies it.

## Decision 4: Load the Approved Fonts and Reuse Expo Icons

**Decision**: Declare Expo Font and Expo Vector Icons as direct dependencies, package approved
IBM Plex Sans Arabic and IBM Plex Sans font assets locally, and load them before the gallery or
app shell renders text. Centralize icon name, size, mirroring, and accessible-label behavior.

**Rationale**: Both packages are already present transitively in the Expo installation, but
direct declarations make application imports explicit. Local font assets avoid runtime network
dependency and satisfy the approved typography decision.

**Alternatives considered**:

- System fonts only: rejected because SPEC-002 resolves the product family explicitly.
- Custom SVG icons: rejected because the installed icon set covers standard product actions.
- Remote font loading: rejected because startup and offline behavior must not depend on network.

## Decision 5: Use Native Motion and Modal Primitives

**Decision**: Use React Native Animated for the approved fades, short slides, progress, and
expansion. Use `Modal`, `KeyboardAvoidingView`, and safe-area insets for sheets and dialogs.
Reduced-motion preference bypasses non-essential animation and applies final state immediately.

**Rationale**: The required timing and transitions do not require a gesture or animation
framework. Native primitives reduce dependency and configuration cost.

**Alternatives considered**:

- Reanimated and a bottom-sheet library: deferred until a later feature requires gesture-driven
  sheets that native Modal cannot satisfy.
- No transition handling: rejected because state continuity and reduced-motion parity are
  explicit requirements.

## Decision 6: Keep Charts Small and Accessible

**Decision**: Add React Native SVG as the only new rendering dependency for static donut and
line presentations. Keep data limiting, Other grouping, series limits, labels, text summaries,
and drill-down callbacks in typed helpers. Do not add a chart framework in SPEC-002.

**Rationale**: The design system needs predictable visual and accessibility contracts, while
advanced scales, gestures, and report analytics belong to SPEC-008. SVG primitives can prove
the required donut and line behavior without a large chart stack.

**Alternatives considered**:

- Full chart framework: rejected because current requirements need two constrained chart forms.
- Canvas or custom native rendering: rejected as unnecessary complexity.
- Color-only decorative charts: rejected by accessibility requirements.

## Decision 7: Make Sensitive Reveal Session-Transient

**Decision**: Keep the persistent `hideBalances` preference, but model any authorized reveal as
transient state that resets when the app locks or transitions away from active foreground.
External notification and app-switcher surfaces remain masked regardless of in-app state.

**Rationale**: This preserves user control while meeting the clarification and constitution's
privacy-by-default rule. It also reuses the existing masking and app-state boundaries.

**Alternatives considered**:

- Persist reveal indefinitely: rejected because background previews and shared-device use can
  expose financial data.
- Require authorization for every individual amount: rejected because it adds unnecessary
  friction after the user has authorized the active session.

## Decision 8: Verify Behavior, Not Snapshots

**Decision**: Use focused tests for token completeness, theme mapping, variants, interaction
states, duplicate-submit guards, RTL icon direction, 200% text behavior, chart limits and
summaries, and masking lifecycle. Use one gallery route for visual and native checks.

**Rationale**: Behavioral assertions catch contract regressions more reliably than broad
snapshots, while a gallery makes the cross-product matrix practical to inspect.

**Alternatives considered**:

- Snapshot-only tests: rejected because visual diffs do not prove accessible names or actions.
- One test per cosmetic token: rejected as high-maintenance with little user-value coverage.
- Manual-only QA: rejected because deterministic contract rules need repeatable proof.
