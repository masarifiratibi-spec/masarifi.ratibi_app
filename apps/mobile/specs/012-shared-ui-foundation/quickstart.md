# Quickstart Validation: R01 Shared UI Foundation

This guide validates the future R01 implementation. It does not authorize implementation during planning.

## Prerequisites

- Work from `apps/mobile` with repository-supported Node.js and dependencies installed.
- Use an Expo development build for native validation.
- Have a supported Android device/emulator and supported iOS device or approved iOS environment for the final matrix.
- Preserve existing user working-tree changes.

## 1. Static and Boundary Checks

```powershell
npm run typecheck
npm run lint
npm run check:design-system
npm run check:app-shell
```

Expected:

- TypeScript and ESLint report no errors.
- Design-system boundaries report no raw color outside tokens, local token map, admin import, or hard-coded shared/gallery content covered by the updated checker.
- Shell boundaries report no provider SDK, secret, sensitive logging, shell-local raw color, or misplaced Android SMS behavior.

## 2. Focused Automated Tests

```powershell
npm test -- --runInBand src/design-system src/features/design-system src/features/shell
```

Required coverage:

- Theme, contrast, typography, English numerals, icons, motion, privacy, and external masking.
- Buttons, surfaces, status, forms, selection, overlays, feedback, financial display, progress, source, attention, pulse, rows, and charts.
- Gallery locale/theme/visibility/motion switching, fixtures, and stress states.
- Five tabs, direction, selection, targets, shell accessibility/localization, root options, route resolution, protected navigation, and diagnostic-route reachability.
- Existing cross-feature journeys remain green because R01 does not change feature outcomes.

A changed file's adjacent test may run first during iteration, but R01 cannot close until the full command passes.

## 3. Start the Application

```powershell
npm start
```

Open the development build and navigate to `/design-system`. For locally available Android:

```powershell
npm run android
```

Run `npm run ios` only from a supported macOS/iOS build environment.

## 4. Gallery Review Matrix

Review every applicable family against [the shared presentation contract](./contracts/shared-presentation-contract.md).

| Axis | Required values |
|---|---|
| Locale/direction | Arabic RTL, English LTR |
| Theme | Light, dark, system resolution |
| Viewport | 320×568 minimum, representative large phone |
| Text | Standard, 200% |
| Privacy | Visible, hidden |
| Motion | Standard, reduced |
| Input | Touch, keyboard where applicable, screen reader |
| Content | Typical, long, mixed direction, dense, large amount |
| States | Applicable interaction, data, and recovery states |

Verify zero clipping, overlap, inaccessible horizontal scrolling, or sub-44 targets; one clear dominant action; rows for repeated content; restrained bronze; distinct unknown/zero/hidden/provisional values; localized copy; correct screen-reader semantics; and immediate reduced-motion alternatives.

## 5. Owned Screen Validation

### Screen: Root Layout and Entry

Exercise unhydrated, signed-out, onboarding-incomplete, privacy-locked, ready, and valid/invalid pending-destination states.

Pass when the same destination resolves, loading is non-revealing, root headers stay suppressed, provider order is unchanged, and protected content never flashes.

### Screen: Five-Tab Shell

Exercise all tabs in both languages with bottom safe area, 200% text, screen reader, and repeated selection.

Pass when labels remain visible, Add is stronger but integrated, selection is non-color, focus order follows direction, routes remain unchanged, and current feature context is preserved.

### Screen: Auth Required

Open a protected destination while signed out, then test sign-in and cancellation/back.

Pass when shared hierarchy is used, pending destination remains sanitized, and outcomes use only existing safe destinations.

### Screen: Planning Conflict Shared Container

Open representative short/long conflict content with screen reader and dismissal/confirmation paths.

Pass when modal/focus/safe-area behavior follows R01 while conflict values, consequences, choices, and commands remain unchanged and feature-owned.

### Screen: Design-System Gallery

Navigate every section and change locale, theme, visibility, and motion.

Pass when every family/state is reviewable, preferences behave normally, fixtures leak no protected data, and the gallery remains diagnostic rather than a tab.

## 6. Financial and Recovery Probes

Verify:

- Zero, unknown, absent, positive, negative, unusually large, estimated, pending, and hidden amounts.
- Transfer/refund/savings/debt with caller-supplied sign/tone, proving no ledger inference.
- Loading skeleton versus confirmed zero.
- Offline, partial, stale, local-success, pending-sync, error, permission, review, conflict, read-only, limit, success, and hidden states.
- Safe source mark, caller-owned progress status, and empty/single/dense/equal/hidden chart cases.

Pass when each state has truthful text/structure, only supported recovery, non-color meaning, and safe accessibility output.

## 7. Native Device Gate

On both required platform environments, record device/OS/build and validate:

- Arabic RTL and English LTR.
- Light/dark and active system-theme change.
- Visible/hidden balances, background remasking, and app-switcher privacy.
- 200% text and smallest supported phone.
- Screen-reader traversal and modal focus return.
- Keyboard in fields, picker sheets, and confirmation.
- Reduced motion, safe areas, tab bar, and 100–240 ms standard transitions.

Fix defects in the owning shared component or R01 screen/container and revalidate affected consumers. A downstream local workaround fails the gate.

## 8. Completion Gate

R01 is ready for downstream adoption only when:

- Sections 1 and 2 pass.
- Every gallery family and owned screen passes its matrix.
- Android and iOS evidence is recorded.
- No route, store/provider ownership, permission, feature command, calculation, or capability changed.
- No unlocalized shared string, local token, raw brand color, protected-value leak, or presentation-owned financial meaning remains.

