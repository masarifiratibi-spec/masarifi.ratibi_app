# SPEC-004 Validation Results

## Functional Repair Verification - 2026-08-09

- Serialized the two SQLite initialization writers; Home no longer fails with `database is locked`.
- Account, category, and transaction mutations now invalidate the affected list/detail/Home queries.
- Account/category edit forms load existing values and preserve errors/drafts; account rename was saved and immediately propagated to transaction views.
- Category names follow the active locale; user-facing details no longer expose record IDs, raw JSON, or internal reason codes.
- Transaction edit uses the correct title and loads the saved amount, type, account, and category.
- A real voice-created Fuel expense for 80 SAR and the renamed account survived force-stop and cold relaunch.
- Android log review after cold launch found no fatal exception, ANR, React Native error, or database lock.
- Evidence: `native-evidence/full-review-2026-08-09/`.

Date: 2026-08-08

## Environment

- Host: Windows, PowerShell
- Node.js: v24.16.0
- npm: 11.17.0
- Android device: Samsung SM-A165F, Android 16 / API 36, serial `RK8XB00N33K`
- Android package: `com.masarifi.mobile` installed

## Static And Automated Checks

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run check:foundation` | Pass, 367 files checked |
| `npm run check:design-system` | Pass, 367 files checked |
| `npm run check:app-shell` | Pass, 367 files checked |
| `npm run check:core-finance` | Pass, 367 files checked |
| `node scripts/check-core-finance-boundaries.test.mjs` | Pass |
| `cmd /c npm test -- --runInBand --forceExit` | Pass, 157 suites and 441 tests |

The direct PowerShell form of the npm test command did not forward Jest flags under npm 11 and attempted parallel workers, which failed with `spawn EPERM`. Running the same npm script through `cmd /c` forwarded the flags and passed. Non-failing React `act(...)` warnings remain in route-level navigation journey renders around asynchronous query/draft hydration.

## Android Device Review

ADB detects the device and confirms the development package is installed.

- Device: Samsung SM-A165F, Android 16 / API 36, serial `RK8XB00N33K`
- App package: `com.masarifi.mobile`, `versionName=0.0.1`, `versionCode=1`, `minSdk=23`, `targetSdk=34`
- App startup blocker found and resolved for this session: the development build initially showed a Metro connection warning; `adb reverse tcp:8081 tcp:8081` restored the local dev-client connection.
- Evidence folder: `specs/004-core-finance/android-evidence/`

Captured Android evidence:

| Scenario | Evidence | Result |
|---|---|---|
| Home financial summary | `03-home-ready.png`, `03-home-ready.xml` | Partial pass: summary, masked values, estimates, review count, pending sync, and quick actions rendered. |
| Transactions list | `04-transactions.png`, `04-transactions.xml` | Partial pass: search, filters, rows, masked values, direction/status/source labels rendered. |
| Manual Add form | `05-add.png`, `05-add.xml` | Partial pass: entry type tabs and amount field rendered. |
| Categories | `09-categories-route.png`, `09-categories-route.xml` | Partial pass: category search, add action, and category hierarchy rendered. |
| Accounts | `12-accounts-tap.png`, `12-accounts-tap.xml` | Partial pass: account search, add action, masked balances/identifiers, default account, and multi-currency accounts rendered. |
| Keyboard | `13-add-keyboard.png`, `13-add-keyboard.xml` | Partial pass: amount input focused while the keyboard was open. |
| Offline startup | `19-offline-home.png`, `19-offline-home.xml` | Partial pass: app launched with Wi-Fi/data disabled; `monkey` reported `not connected`; Wi-Fi/data were restored after capture. |
| App switcher | `14-app-switcher.png`, `20-app-switcher-privacy.png`, `20-app-switcher-privacy.xml` | Pass for Android external-preview protection: Recents evidence was captured from the physical phone, and runtime `dumpsys window` reported the focused Masarifi window under `secure=true`. Native `MainActivity` also sets `WindowManager.LayoutParams.FLAG_SECURE`. |
| Light/dark | `15-light-home.png`, `15-light-home.xml`, `16-dark-home.png`, `16-dark-home.xml` | Evidence captured after `cmd uimode night no/yes`; full content-state parity remains inconclusive because these captures landed on the loading/splash state. |
| 200% text | `17-font-200-add.png`, `17-font-200-add.xml` | Evidence captured with `font_scale=2.0`; full visual overlap pass remains inconclusive. Font scale was restored to `1.0`. |
| Reduced motion | `18-reduced-motion-home.png` | Evidence captured with animation scales set to `0`; animation scales were restored to `1.0`. |
| RTL/LTR | Previous failure: `26-ltr-home-current-preference.png`, `26-ltr-home-current-preference.xml`, `27-rtl-home-default-ar.png`, `27-rtl-home-default-ar.xml`, `28-ltr-home-restored-preference.png`, `28-ltr-home-restored-preference.xml`. Fixed validation: `44-fix-ltr-home-authenticated.png`, `44-fix-ltr-home-authenticated.xml`, `45-fix-rtl-home-authenticated.png`, `45-fix-rtl-home-authenticated.xml`, `46-fix-ltr-home-authenticated-restored.png`, `46-fix-ltr-home-authenticated-restored.xml` | Pass after fix: English Home shows English bottom tabs with `Home` at `[0,2152][212,2298]` and `More` at `[868,2152][1080,2298]`; Arabic Home shows Arabic bottom tabs with `المزيد` at `[0,2174][212,2298]` and `الرئيسية` at `[868,2174][1080,2298]`. Preferences were restored after the temporary locale reset. |
| Restart during undo | Previous failure: `31-undo-detail-open.png`, `31-undo-detail-open.xml`, `32-undo-after-delete-window.png`, `32-undo-after-delete-window.xml`, `33-undo-after-force-stop-relaunch-home.png`, `33-undo-after-force-stop-relaunch-home.xml`, `34-undo-after-restart-transactions.png`, `34-undo-after-restart-transactions.xml`, `35-undo-after-restart-detail.png`, `35-undo-after-restart-detail.xml`. Fixed validation: `47-fix-undo-transactions-before-open.png`, `47-fix-undo-transactions-before-open.xml`, `48-fix-undo-detail-before-delete.png`, `48-fix-undo-detail-before-delete.xml`, `49-fix-undo-after-delete-window.png`, `49-fix-undo-after-delete-window.xml`, `50-fix-undo-after-force-stop-home.png`, `50-fix-undo-after-force-stop-home.xml`, `51-fix-undo-after-restart-transactions.png`, `51-fix-undo-after-restart-transactions.xml`, `52-fix-undo-after-restart-detail.png`, `52-fix-undo-after-restart-detail.xml` | Pass after fix: deleting `Merchant 1` opened `Transaction deleted`, `Undo`, and `29906 ms`; after `adb shell am force-stop com.masarifi.mobile` and relaunch during that window, reopening the detail showed `Transaction deleted`, `Undo`, and `2951 ms`. The persisted deadline was restored and not extended. |

Android settings restored after review: `font_scale=1.0`, `window_animation_scale=1.0`, `transition_animation_scale=1.0`, `animator_duration_scale=1.0`, `Night mode: yes`.

Focused Android follow-up on 2026-08-08 covered only app-switcher privacy, RTL/LTR validation, and restart during undo on the physical Samsung SM-A165F. TalkBack and iOS were intentionally not executed in this pass.

T108 remains unchecked because TalkBack remains unexecuted by explicit request, and the earlier full visual pass for light/dark plus 200% text remains incomplete. The latest focused physical-device pass now confirms app-switcher privacy, RTL/LTR bottom-tab parity, and restart-during-undo persistence pass on Android.

## iOS Review

Blocked because this host is Windows and has no macOS/Xcode iOS runtime. No iOS simulator/device, Xcode build, VoiceOver, safe-area, lifecycle, keyboard, RTL/LTR, theme, or 200% text evidence can be produced from this environment. T109 remains unchecked.

## Stop-Condition Review

SPEC-004 is not ready to mark complete. Automated checks pass for the implemented surface, and the latest focused Android fixes resolved app-switcher privacy, RTL/LTR bottom-tab parity, and restart-during-undo persistence. T110 remains unchecked because TalkBack and iOS were intentionally not executed in this pass and the full Android visual matrix is still incomplete.
