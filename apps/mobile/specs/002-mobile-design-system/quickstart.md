# Quickstart: Validate the Mobile Design System

Use this guide after the SPEC-002 implementation tasks are complete.

## Prerequisites

- A Node.js version supported by Expo SDK 51.
- Android Studio emulator or Android device for Android checks.
- Xcode simulator or iOS device on macOS for native iOS checks.
- Expo development builds installed for native font, screen-reader, and privacy validation.

## Install and Check

From `apps/mobile`:

```powershell
npm install
npm test -- --runInBand
npm run typecheck
npm run lint
```

Expected outcome: token, theme, component, interaction, chart, localization, accessibility,
and masking tests pass with no type or lint errors.

### Baseline Before SPEC-002 Component Implementation

Recorded on 2026-08-06 after setup dependency and font asset installation:

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --runInBand` | Existing-failure note | npm did not forward `--runInBand`; Jest attempted workers and failed with `spawn EPERM`. Control command `npx jest --runInBand` passed 14 suites and 106 tests. |
| `npm run typecheck` | PASS | `tsc --noEmit` exited 0. |
| `npm run lint` | PASS | `eslint .` exited 0. |
| `npm run check:foundation` | PASS | `Foundation boundaries passed (50 files checked).` |

## Start the Gallery

```powershell
npx expo start --dev-client
```

Open `/design-system` in the development build. The route is a validation gallery, not a
production product screen.

## Scenario 1: Token and Theme Integrity

1. Review reference, semantic, financial, status, chart, spacing, shape, typography, and motion
   examples in light and dark modes.
2. Verify teal remains the interaction family and bronze is not used as a general primary color.
3. Confirm financial meaning is distinguishable from operational status.
4. Search production TypeScript components for raw colors:

```powershell
rg -n '#[0-9A-Fa-f]{3,8}' app src -g '*.ts' -g '*.tsx'
```

Expected outcome: raw values occur only in the designated token adapter; both themes preserve
contrast and semantic distinctions described by the [UI contract](contracts/mobile-design-system-contract.md).

## Scenario 2: Typography, RTL, and Content

1. Switch between Arabic RTL and English LTR.
2. Confirm IBM Plex Sans Arabic and IBM Plex Sans load before product text appears.
3. Inspect long labels, financial amounts, currency codes, phone numbers, and identifiers.
4. Confirm directional navigation icons mirror and utility/brand icons do not.
5. Review action, validation, status, and comparison language in both languages.

Expected outcome: content parity is complete, financial numerals remain English and stable,
and mixed-direction values remain readable.

## Scenario 3: Component States and Actions

1. Exercise navigation, form, feedback, overlay, and financial component families.
2. Inspect default, pressed, focused, selected, disabled, loading, success, error, empty,
   offline, permission, review, and sync states where applicable.
3. Submit a gallery form twice quickly and confirm only one mutation begins.
4. Trigger validation failure and confirm entered data remains.
5. Trigger reversible success, undo, and destructive confirmation.

Expected outcome: controls expose the names, roles, states, feedback, separation, and recovery
defined by the [component and interaction contracts](contracts/mobile-design-system-contract.md#4-component-contract).

## Scenario 4: Responsive and Accessibility Matrix

1. Validate the gallery at 320 by 568 logical pixels and on a standard large phone.
2. Open the keyboard over forms and sheets; verify the focused field, error, and primary action
   remain reachable.
3. Set text scaling to 200% and complete all critical gallery actions.
4. At larger supported settings, confirm all content remains available by reflow or scrolling.
5. Navigate with TalkBack on Android and VoiceOver on iOS; verify reading order, labels, roles,
   states, errors, and announcements.
6. Confirm every measured interactive target is at least 44 by 44 logical pixels.

Expected outcome: no amount, status, label, or action is clipped, hidden, or dependent on color.

## Scenario 5: Motion and Reduced Motion

1. Observe control, dialog, sheet, progress, and expansion transitions.
2. Confirm durations remain inside the approved 100-240 millisecond ranges.
3. Enable reduced motion and repeat each transition.

Expected outcome: normal motion is brief and causes no loading layout shift; reduced motion
applies final states immediately without losing feedback.

## Scenario 6: Charts

1. Render empty, insufficient, normal, and dense donut and line fixtures.
2. Confirm donuts show at most five categories after Other grouping.
3. Confirm line charts show at most four series and remain distinguishable in grayscale.
4. Read each text summary with a screen reader and use the optional drill-down action.

Expected outcome: the question, values, conclusion, and destination remain understandable
without color or tooltips.

## Scenario 7: Sensitive Values

1. Start from a fresh preference state and confirm sensitive gallery values are masked.
2. Authorize reveal and confirm values appear only in the active app.
3. Background and reopen the app; confirm values return to masked.
4. Lock and unlock the app; confirm values remain masked until a new reveal.
5. Inspect lock-screen notification and app-switcher previews.

Expected outcome: transitions follow [SensitivePresentation](data-model.md#sensitivepresentation),
and no external surface, error, title, or analytics fixture exposes a sensitive value.

## Scope Guard

Confirm the work contains no Admin Dashboard components, feature-specific product screens,
production service calls, new design-system provider, second token source, camera/receipt flow,
investment entry, or unsupported platform claim.

## Final SPEC-002 Validation Record

Recorded on 2026-08-06 from `D:\MY Work\0Part_Time\MASREFY _Final\apps\mobile`.

### Automated Commands

| Command | Result | Evidence |
|---|---|---|
| `npx jest --runInBand` | PASS | 56 suites passed, 190 tests passed, 0 snapshots, 35.304 s. |
| `npm test -- --runInBand` | FAIL | npm did not forward `--runInBand`; Jest attempted workers and failed with `spawn EPERM` before the corrected direct Jest run. |
| `npm run typecheck` | PASS | `tsc --noEmit` exited 0. |
| `npm run lint` | PASS | `eslint .` exited 0. |
| `npm run check:foundation` | PASS | `Foundation boundaries passed (142 files checked).` |
| `npm run check:design-system` | PASS | `Design-system boundaries passed (142 files checked).` |
| `npx expo install --check` | PASS | Sandbox run failed with `ECONNREFUSED 127.0.0.1:9`; approved network rerun reported `Dependencies are up to date`. |
| `npm run build` | FAIL | `Missing script: "build"` in `package.json`. |

### Native Evidence

| Check | Result | Evidence |
|---|---|---|
| Android device detection | PASS | `C:\Users\DELL\AppData\Local\Android\Sdk\platform-tools\adb.exe devices` reported `emulator-5554 device`; AVD list reported `Pixel_7`. |
| Android API/device profile | PASS | API `36`, model `sdk_gphone64_x86_64`, size `1080x2400`, density `420`, font scale `1.0`. |
| Android `/design-system` manual validation | BLOCKED | Emulator is connected, but no Expo dev build/native gallery session was launched for visual TalkBack, keyboard overlay, chart summary, app-switcher, or background privacy inspection. |
| Android 320x568 and font scale 2.0 validation | BLOCKED | Not executed because the native gallery session was not available for visual clipping/scroll/target-size verification; emulator size, density, and font scale were not modified. |
| iOS simulator/device validation | BLOCKED | Windows host has no macOS/Xcode simulator access. |

### Contrast And Scope

| Check | Result | Evidence |
|---|---|---|
| Text and control contrast | PASS | Light primary/page 11.60:1, text/page 14.05:1, secondary/page 7.38:1, inverse/accent 4.99:1, teal-soft/primary 10.36:1; dark text/background 15.94:1, secondary/background 11.51:1. |
| Status contrast | PASS | Success 5.35:1, warning 4.92:1, danger 4.78:1, info 5.38:1 on light surface. |
| Financial contrast | PASS | Income 5.19:1, expense 5.29:1, transfer 5.54:1, refund 5.52:1, savings 4.98:1, debt 5.68:1 on light surface. |
| Chart contrast and grayscale support | PASS | Donut colors measured 12.30:1, 4.92:1, 5.54:1, 5.52:1, 5.68:1 on light surface; line/pattern tokens provide non-color cues. |
| Scope audit | PASS | `rg -n "admin-web|Admin Dashboard|@admin" app src -g "*.ts" -g "*.tsx"` returned no matches. |
| Feature/provider audit | PASS | `rg -n "camera|receipt|investment|openai|stripe|supabase" app src -g "*.ts" -g "*.tsx"` returned no matches. |
| Production service audit | PASS | `rg -n "fetch\(|axios|supabase|stripe|openai" app src -g "*.ts" -g "*.tsx"` returned no matches. |
| Second token source audit | PASS | `rg -n "#[0-9A-Fa-f]{3,8}|const .*tokens|palette|semanticColors" app src -g "*.ts" -g "*.tsx" -g "!src/design-system/tokens.ts" -g "!*.test.ts" -g "!*.test.tsx"` returned no matches. |

### Scenario Outcomes

| Scenario | Result |
|---|---|
| Scenario 1: Token and Theme Integrity | PASS automated; native visual review BLOCKED. |
| Scenario 2: Typography, RTL, and Content | PASS automated; native font rendering and screen-reader review BLOCKED. |
| Scenario 3: Component States and Actions | PASS automated; native keyboard overlay review BLOCKED. |
| Scenario 4: Responsive and Accessibility Matrix | PASS automated; Android 320x568/font-scale and TalkBack review BLOCKED. |
| Scenario 5: Motion and Reduced Motion | PASS automated; native reduced-motion animation review BLOCKED. |
| Scenario 6: Charts | PASS automated; native screen-reader chart summary review BLOCKED. |
| Scenario 7: Sensitive Values | PASS automated; native app-switcher/lock-screen privacy review BLOCKED. |
| Scope Guard | PASS. |
