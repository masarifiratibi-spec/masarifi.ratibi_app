# Quickstart: Validate the Mobile Product Foundation

Use this guide after the `001-mobile-foundation` implementation tasks are complete.

## Prerequisites

- A supported Node.js version for the selected Expo SDK.
- Android Studio emulator or Android device for Android checks.
- Xcode simulator or iOS device on macOS for iOS checks.
- Expo development builds installed for native capability validation.

## Install and Check

From `apps/mobile`:

```powershell
npm install
npm test
npx tsc --noEmit
```

Expected outcome: focused formatting, state-transition, permission, privacy, offline-storage,
and foundation-screen tests pass with no type errors.

## Start the Validation Harness

```powershell
npx expo start --dev-client
```

Open the app in an Android and iOS development build. The initial route is a temporary
foundation validation screen, not a production dashboard.

## Scenario 1: Platform Honesty and Fallback

1. Open the harness on Android.
2. Confirm the mocked SMS capability explains permission, supports skip, and lists manual and
   voice fallback actions.
3. Switch permission states through denied, permanently denied, granted, revoked, and paused.
4. Confirm each state has a plain-language action and never blocks the fallback.
5. Open the harness on iOS.
6. Confirm direct SMS tracking is absent and approved alternatives remain visible.

Expected outcome: behavior matches the [platform and permission contract](contracts/foundation-ui-contract.md).

## Scenario 2: Financial Trust

1. Trigger clear, ambiguous, duplicate, failed, and assistant-proposed mock changes.
2. Verify a clear automatic addition shows source and undo/edit.
3. Verify ambiguous and duplicate changes enter review without silently applying.
4. Verify an assistant proposal cannot apply before explicit confirmation.
5. Verify errors show a recovery action and no raw provider details.

Expected outcome: all transitions follow [FinancialChange](data-model.md#financialchange).

## Scenario 3: Offline Entry

1. Put the harness into offline mode.
2. Create a valid manual entry.
3. Restart the app and confirm the entry remains with `pending sync` status.
4. Edit the entry, then exercise failed retry and conflict states.
5. Resolve or retry and confirm `synced` appears only after simulated confirmation.

Expected outcome: the entry follows the [OfflineEntry](data-model.md#offlineentry) lifecycle and
is never falsely presented as synchronized.

## Scenario 4: Privacy

1. Enter an authenticated mock session and verify balances may be shown.
2. Enable hide balances and restart; verify the preference persists.
3. Trigger a notification and inspect its lock-screen representation.
4. Background the app and inspect its app-switcher preview.

Expected outcome: sensitive amounts remain masked on external surfaces and whenever the global
preference is enabled.

## Scenario 5: Language and Accessibility

1. Run every harness state in Arabic RTL and English LTR.
2. Verify English numerals for financial numbers and dates in both languages.
3. Increase system text size and confirm no amount, status, or action is hidden.
4. Navigate with a screen reader and verify names, roles, states, errors, and reading order.
5. Enable reduced motion and verify information remains complete.
6. Confirm all controls meet the 44 by 44 pixel minimum target.

Expected outcome: both languages and accessibility modes expose the same complete behavior.

## Scenario 6: Theme and Token Compliance

1. Run the harness in light and dark modes.
2. Inspect loading, success, empty, error, offline, permission, and sync states.
3. Search production component files for raw hexadecimal colors.

```powershell
rg -n '#[0-9A-Fa-f]{3,8}' app src -g '*.ts' -g '*.tsx'
```

Expected outcome: the search returns only the designated token adapter, and status meaning is
clear without color alone in both themes.

## Scope Guard

Confirm the implementation contains no camera or receipt entry, investment navigation,
production provider calls, production secrets, or feature screens assigned to later specs.

## Validation Record — 2026-08-05

### Automated checks

| Command | Outcome |
|---|---|
| `npm install` | PASS — dependency tree installed and Expo configuration dependency mismatch resolved |
| `npx expo config --type public` | PASS — SDK 51 configuration resolves with all referenced assets present |
| `npm test -- --runInBand` | PASS — 14 suites and 106 tests |
| `npm run typecheck` | PASS — no TypeScript errors |
| `npm run lint` | PASS — no errors or warnings |
| `npm run check:foundation` | PASS — 50 production files checked |

The performance suite mounts fewer than 100 rows from a 10,000-record fixture. Financial
change, offline transition, protected-preference, masking, locale-direction, accessible-state,
and interactive action regressions are covered by the automated suite.

### Browser development harness

- PASS: Expo web starts at `http://localhost:8081` and renders the four validation routes.
- PASS: Arabic renders RTL and switching to English updates the same route to LTR.
- PASS: the assistant proposal remains pending until explicit confirmation and then renders
  `Applied`.
- PASS: the accessibility gallery exposes named roles, 44-point controls, non-color state
  cues, and an actionable retry state at a 390 by 844 viewport.
- NOTE: Expo SQLite persistence is a native Android/iOS validation target; the web harness
  does not substitute for the development-build offline check.

### Android Studio AVD validation

- PASS: Pixel 7 AVD (`emulator-5554`, API 35, 1080 by 2400 at 420 dpi) booted and
  installed `com.masarifi.mobile` with `gradlew installDebug`.
- PASS: Android capture route rendered denied SMS permission, kept manual entry available,
  and recovered to `Permission granted` after the continue action.
- PASS: iOS platform-honesty path in the development-build harness rendered direct SMS
  tracking as unavailable and exposed manual/voice alternatives. Native iOS runtime validation
  still requires macOS/iOS Simulator.
- PASS: Arabic RTL and English LTR labels, light/dark theme controls, reduced-motion switch,
  hide-balances switch, retry/error/offline/permission/sync states, and accessible names/roles
  were present in `uiautomator` dumps.
- PASS: TalkBack was present on the AVD and enabled through
  `com.google.android.marvin.talkback/.TalkBackService` for screen-reader service validation,
  then disabled after the check.
- PASS: large text was simulated with `font_scale=1.3`; small-phone layout was simulated with
  `wm size 720x1280` and `wm density 320`; the route remained scrollable with core controls
  available. Defaults were restored afterward.
- PASS: app-switcher masking was manually reproduced as failing before native protection, then
  fixed with Android `FLAG_SECURE`; foreground screenshots and app-switcher previews now render
  black instead of financial balances.

### Scope review

PASS: `npm run check:foundation` found no prohibited camera, receipt, investment,
production-provider, secret, sensitive-analytics, raw feature color, or literal
accessibility-copy boundary violations. Navigation remains limited to the four foundation
validation routes.

### Dependency audit note

`npm audit --omit=dev` reports advisories in the Expo SDK 51 toolchain. The available npm fix
requires a major Expo/React Native upgrade to Expo 57, which is not safe to apply as an
incidental foundation patch. Track the SDK upgrade separately before production release.
