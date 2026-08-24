# Masarifi Mobile RTL/LTR Audit Design

## Objective

Audit the complete Masarifi Mobile application after the current remediation work and correct only verified Arabic RTL or English LTR defects. The approved visual design, navigation model, information architecture, and feature behavior remain unchanged.

The audit covers every route, shared component, state, overlay, picker, form, chart, list, and navigation flow under `apps/mobile`, including the internal foundation and design-system routes because they exercise production primitives.

## Constraints

- Work only on `codex/r01-shared-ui-foundation` in the designated worktree.
- Preserve all existing uncommitted remediation changes.
- Do not redesign screens or introduce new visual patterns.
- Do not add dependencies, a second direction system, or broad replacement abstractions.
- Reuse the existing locale store, `FoundationProviders`, design-system components, and direction helpers.
- Fix shared root causes before applying a route-specific correction.
- Change a route only when review, a test, or device evidence confirms a defect.

## Direction Contract

The application derives direction from the active locale: Arabic is RTL and English is LTR. Locale changes must update the rendered hierarchy without leaving stale physical alignment or navigation state.

Layout uses logical reading order and alignment. Components must not compensate for RTL by blindly reversing every row; source order, visual order, accessibility order, and interaction semantics must remain consistent.

Only semantically directional icons mirror. Back, forward, disclosure, and directional transfer affordances may mirror. Search, close, privacy, status, category, and other non-directional symbols do not.

Text follows its content and context:

- Localized prose, labels, hints, validation, and titles use the active locale direction or automatic bidi behavior.
- Money, signed amounts, percentages, phone numbers, OTPs, account numbers, card fragments, transaction references, and technical identifiers remain coherent LTR runs inside RTL layouts.
- Mixed Arabic/English content must not reorder punctuation, signs, currency labels, or trailing actions.
- Long localized strings wrap without clipping, overlapping, or pushing required actions off screen.

Charts keep their domain order. Chronological and categorical data arrays are not reversed merely because the interface is RTL. Direction changes affect surrounding alignment, legends, labels, tooltips, and navigation affordances only where their semantics require it.

## Audit Method

The audit is layered so one shared fix can cover every caller:

1. Review the application shell and shared primitives: locale propagation, safe areas, typography, icons, buttons, inputs, rows, cards, lists, overlays, sheets, modals, pickers, charts, and navigation controls.
2. Inventory and review every route and feature component in both directions, tracing shared callers before editing.
3. Exercise all deterministic states available through tests or fixtures: loading, empty, populated, error, offline, disabled, permission, validation, confirmation, and destructive-action states.
4. Add the smallest paired Arabic/English regression test for each non-trivial correction.
5. Perform Android device checks across the main journeys and directly reachable routes after automated verification passes.

Static searches for physical direction assumptions are discovery aids, not automatic proof of a defect. Properties such as `left`, `right`, row reversal, absolute positioning, truncation, and fixed widths are reviewed in context before any change.

## Coverage Matrix

Every route receives a code and automated-test audit across these axes where applicable:

- Arabic RTL and English LTR.
- Narrow phone, the normal supported phone size, and wider layouts where the component is responsive.
- Normal font scaling and 200% text scaling for text-bearing interactive layouts.
- Keyboard hidden and visible for forms.
- Short and long localized content.
- Loading, empty, populated, error, disabled, and confirmation states.
- Back navigation, tabs, drawers or menus, deep links, route modals, pickers, and nested flows.

State-only variants that cannot be reached reliably on a physical device are covered with deterministic component or journey tests. Android device validation covers reachable customer journeys in both locales. iOS-specific layout behavior is validated through platform-aware React Native tests because no iOS device is available in the current environment.

## Remediation Rules

- Prefer a correction in an existing shared primitive when every affected caller has the same semantic requirement.
- Keep screen-specific behavior local when callers have different semantics.
- Do not perform bulk `row-reverse`, `textAlign`, margin, or icon substitutions.
- Preserve accessibility reading and focus order while correcting visual order.
- Preserve minimum touch targets and keyboard avoidance.
- Avoid fixed widths when content must wrap, but retain intentional fixed geometry such as icon buttons and chart plot bounds.
- Keep financial calculations, route behavior, and stored data unchanged.

## Verification

Each confirmed correction must leave a runnable regression check. Final verification includes:

- Paired Arabic RTL and English LTR tests for corrected behavior.
- Existing direction, shell, navigation, component, feature, and journey tests.
- Complete mobile Jest suite.
- TypeScript typecheck.
- Lint and repository boundary checks.
- Android device traversal of public entry, onboarding, tabs, transactions, reports, planning, tracking, assistant, notifications, settings, security, support, subscriptions, overlays, and representative state transitions in both locales.
- Screenshots or UI hierarchy evidence for visual issues that cannot be established through assertions alone.

The completion report separates verified passes, corrected defects, and environment-limited checks. It must not claim iOS device coverage without an iOS device.

## Self-Review

This design intentionally avoids a new direction abstraction or codemod. The existing application already has locale propagation, icon mirroring, bidi typography, and direction-aware shared components; the smallest safe approach is to audit and repair those paths in place. The matrix is exhaustive at the route and deterministic-state level while keeping physical-device validation focused on reachable journeys. No requirement changes the approved UI.

## Acceptance Criteria

The audit is complete when every mobile route and deterministic state has been reviewed in Arabic RTL and English LTR, all verified direction defects have minimal regression-tested fixes, the full automated verification remains green, reachable Android journeys have been exercised in both locales, and the final report clearly records any platform check that could not be performed.
