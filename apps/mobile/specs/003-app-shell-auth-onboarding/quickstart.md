# Quickstart: Validate App Shell, Authentication, and Progressive Onboarding

## Physical Android Functional Review - 2026-08-09

- Device: Samsung SM-A165F, Android 16 / API 36, serial `RK8XB00N33K`.
- Language selection now applies before navigation; English persists across a cold restart without an Arabic route flash.
- PIN creation/confirmation, incorrect-PIN rejection, correct unlock, immediate background lock, forgotten-PIN reset, and the native biometric prompt were exercised on the device.
- `FLAG_SECURE` was verified by an all-black ADB application capture while the lock screen was active.
- Cold and warm launch completed without a fatal exception, ANR, or protected-content flash.
- Evidence: `native-evidence/full-review-2026-08-09/`.
- iOS remains blocked on this Windows host. TalkBack and the complete visual/font-scale matrix remain open because this pass prioritized function.

Use this guide after the SPEC-003 implementation tasks are complete.

## Prerequisites

- Node.js supported by Expo SDK 51.
- Android development build on an emulator or device for permission, biometric, and deep-link checks.
- iOS development build on macOS for native iOS checks.
- Test fixtures reset to a signed-out, onboarding-incomplete user unless a scenario says otherwise.

## Install and Check

From `apps/mobile`:

```powershell
npm install
npx expo install --check
npx jest --runInBand
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
```

Expected outcome: dependencies match Expo SDK 51, focused and existing tests pass, TypeScript and
ESLint report no errors, and foundation/design-system boundaries remain intact.

## Start the Application

```powershell
npx expo start --dev-client
```

Open the installed development build. For Android native configuration changes, rebuild with:

```powershell
npm run android
```

## Scenario 1: Entry Gate and Deep Links

1. Start with storage empty and open a protected deep link.
2. Confirm language selection and authentication appear before protected content.
3. Authenticate while onboarding is incomplete and confirm onboarding opens before the target.
4. Complete onboarding and confirm the safe target opens when valid, otherwise Home.
5. Repeat with a valid session plus active local lock.

Expected outcome: gate order follows [Entry Gate Contract](contracts/app-shell-auth-onboarding-contract.md#1-entry-gate-contract), with no protected-shell flash or redirect loop.

## Scenario 2: Phone Authentication

1. Validate malformed and valid country-code and phone combinations.
2. Request the mock code and confirm six positions and a 30-second resend countdown.
3. Submit incomplete and invalid codes without losing the phone context.
4. Advance the test clock beyond five minutes and confirm expiry recovery.
5. Fail five times and confirm further verification is rate-limited.
6. Resend and confirm the previous code is rejected.

Expected outcome: transitions match [PhoneVerificationAttempt](data-model.md#phoneverificationattempt), duplicate submissions are blocked, and no sensitive input appears in logs or analytics fixtures.

## Scenario 3: Google and Identity Conflict

1. Exercise mock success, cancellation, failure, and known-account sign-in.
2. Trigger an existing-account conflict.
3. Cancel re-verification and confirm no account or session mutation.
4. Repeat with successful existing-method verification and confirm mock linking succeeds.

Expected outcome: no conflict links automatically and unsuccessful outcomes leave identity state unchanged.

## Scenario 4: Android Tracking Onboarding

1. Confirm tracking introduction appears before profile-completion prompts.
2. Select Enable automatic tracking and verify education appears before the system prompt.
3. Exercise grant, deny, permanent denial, revoke, and unavailable fixtures.
4. Verify every outcome can continue to Home with manual and voice capture.
5. For permanent denial or revocation, verify the device-settings recovery action.

Expected outcome: every state matches the [Android Onboarding Contract](contracts/app-shell-auth-onboarding-contract.md#5-android-onboarding-contract); no parser or financial inbox content is introduced.

## Scenario 5: iOS and Unknown Platform

1. Run the iOS path and inspect every screen and action for SMS language or permission requests.
2. Verify manual and voice capture plus only available approved alternatives appear.
3. Run the conservative unknown-platform fixture and continue through the shared demonstration.

Expected outcome: zero SMS inbox claims or permission routes appear, and both paths reach Home.

## Scenario 6: Keywords and Tracking Modes

1. Search and filter all eleven keyword groups in Arabic and English.
2. Add a trimmed custom keyword, then attempt an equivalent duplicate and an empty value.
3. Disable defaults, restore defaults, and attempt to disable the final enabled group rule.
4. Exercise automatic-clear, review-all, and paused modes with clear, uncertain, failed, OTP,
   marketing, duplicate, conflicting, and low-confidence fixtures.

Expected outcome: keyword validation follows [KeywordRule](data-model.md#keywordrule), and unsafe
fixtures are never silently added in any mode.

## Scenario 7: Interruption and Progressive Completion

1. Close or background the app during each onboarding step and operating-system permission prompt.
2. Relaunch and verify the earliest incomplete applicable step opens without repeating completed work.
3. Reach Home without profile data and verify the optional progress entry.
4. Complete a step elsewhere, dismiss the entry, restart, and reopen it from Profile or Settings.

Expected outcome: onboarding resumes deterministically, profile completion remains optional, and dismissal persists.

## Scenario 8: PIN, Biometrics, and Privacy

1. Create and confirm a six-digit PIN; verify mismatched confirmation stores nothing.
2. Fail unlock five times and confirm a 30-second temporary lock.
3. Exercise supported, unsupported, not-enrolled, cancelled, failed, and locked-out biometric states.
4. Use forgotten PIN, re-authenticate, and confirm financial data remains while biometrics disable.
5. Background the app and inspect the app switcher before unlocking again.

Expected outcome: lock transitions follow [PrivacyLockPreference](data-model.md#privacylockpreference), PIN remains the fallback, and no protected value appears externally.

## Scenario 9: Navigation, RTL, and Accessibility

1. Visit Home, Transactions, Add, Reports, and More; verify Add is central and Reports permanent.
2. Open Accounts and assistant from every approved source and return to the origin.
3. Repeat critical journeys in Arabic RTL and English LTR at 320 by 568 and 200% text scaling.
4. Open the keyboard on phone, OTP, keyword, and PIN forms.
5. Navigate with TalkBack or VoiceOver and repeat with reduced motion.

Expected outcome: direction, focus order, names, roles, states, errors, wrapping, keyboard access,
and all measured targets satisfy the [Accessibility Contract](contracts/app-shell-auth-onboarding-contract.md#11-accessibility-localization-and-design-contract).

## Scope and Privacy Audit

```powershell
rg -n "camera|receipt|investment|openai|stripe|supabase" app src -g "*.ts" -g "*.tsx"
rg -n "console\.|analytics.*(phone|otp|pin|amount|message)" app src -g "*.ts" -g "*.tsx"
rg -n "READ_SMS|SMS" app src app.json -g "*.ts" -g "*.tsx" -g "*.json"
```

Expected outcome: no excluded feature, provider secret, sensitive logging, or iOS SMS path exists.
Any Android `READ_SMS` declaration and request is confined to the approved platform adapter and
education-led route; SMS parsing remains absent.

## Native QA Record

Record Android and iOS results for permission prompts, biometrics, deep links, app-switcher
privacy, screen readers, keyboard, 200% text, light/dark themes, and small/large phones. A platform
with no available native host remains explicitly blocked rather than inferred from Jest results.

## Implementation Evidence

### T004 Baseline - 2026-08-06

From `apps/mobile`:

| Command | Result |
|---|---|
| `npx jest --runInBand` | PASS: 56 suites passed, 190 tests passed. |
| `npm run typecheck` | PASS: TypeScript exited 0. |
| `npm run lint` | PASS: ESLint exited 0. |
| `npm run check:foundation` | PASS: 142 files checked. |
| `npm run check:design-system` | PASS: 142 files checked. |
| `npm run check:app-shell` | PASS: 142 files checked. |

### SPEC-003 Final Automated Evidence - 2026-08-06

From `D:\MY Work\0Part_Time\MASREFY _Final\apps\mobile`:

| Task | Command | Result |
|---|---|---|
| T150 | `npx jest --runInBand` | PASS: 106 suites passed, 317 tests passed, 0 failed. |
| T151 | `npm run typecheck` | PASS: TypeScript exited 0. |
| T152 | `npm run lint` | PASS: ESLint exited 0. |
| T153 | `npm run check:foundation` | PASS: 270 files checked. |
| T153 | `npm run check:design-system` | PASS: 270 files checked. |
| T153 | `npm run check:app-shell` | PASS: 270 files checked. |
| T154 | `npx expo install --check` | MIXED: escalated network run passed earlier with `Dependencies are up to date`; latest sandbox run failed with `connect ECONNREFUSED 127.0.0.1:9` when contacting `https://api.expo.dev/v2/sdks/51.0.0/native-modules`. |
| T154 | `npx expo config --type public` | PASS: `expo-local-authentication` plugin present; iOS Face ID usage text present; Android permissions include `android.permission.READ_SMS`, `android.permission.USE_BIOMETRIC`, and `android.permission.USE_FINGERPRINT`. |

### SPEC-003 Scope and Privacy Audit - 2026-08-06

| Command | Result |
|---|---|
| `rg -n "camera\|receipt\|investment\|openai\|stripe\|supabase" app src -g "*.ts" -g "*.tsx"` | PASS: no matches. |
| `rg -n "console\.\|analytics.*(phone\|otp\|pin\|amount\|message)" app src -g "*.ts" -g "*.tsx"` | PASS: no matches. |
| `rg -n "READ_SMS\|SMS" app src app.json -g "*.ts" -g "*.tsx" -g "*.json"` | REVIEWED: allowed hits are `app.json` Android `READ_SMS`, Android-only adapter `src\services\platform\tracking-permission-service.android.ts`, test files, existing foundation copy/tests, and localized iOS no-SMS explanatory copy. No iOS SMS permission route or SMS parser implementation was found. |

### Native QA Evidence and Blockers - 2026-08-06

| Platform | Evidence |
|---|---|
| Android emulator discovery | PASS: `C:\Users\DELL\AppData\Local\Android\Sdk\platform-tools\adb.exe devices` showed `emulator-5554 device`; `C:\Users\DELL\AppData\Local\Android\Sdk\emulator\emulator.exe -list-avds` showed `Pixel_7`. |
| Android device properties | PASS: `adb -s emulator-5554 shell getprop ro.build.version.sdk` returned `36`; `wm size` returned `1080x2400`; `wm density` returned `420`. |
| Android development build | PASS: Java 17 was installed at `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot`; `C:\Users\DELL\AppData\Local\Temp\jdk17` was used as a short `JAVA_HOME` junction. Direct Gradle build passed with `.\android\gradlew.bat -p android app:assembleDebug -x lint -x test --no-daemon --no-build-cache --project-cache-dir C:\Users\DELL\AppData\Local\Temp\masarifi-gradle-project-cache -PreactNativeDevServerPort=8083 -PreactNativeArchitectures=x86_64,arm64-v8a` after setting `ANDROID_HOME=C:\Users\DELL\AppData\Local\Android\Sdk`. |
| Android APK install and native launch | PARTIAL: `adb -s emulator-5554 install -r D:\MY Work\0Part_Time\MASREFY _Final\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk` returned `Success`; `pm list packages` showed `com.masarifi.mobile`; `monkey -p com.masarifi.mobile -c android.intent.category.LAUNCHER 1` opened `com.masarifi.mobile/.MainActivity`. Evidence screenshots were saved to `specs\003-app-shell-auth-onboarding\android-launch-screenshot.png`, `android-app-screenshot.png`, and `android-loaded-screenshot.png`. |
| Android manual matrix | BLOCKED: the installed dev build opens, but the first launch shows Expo Dev Launcher and later `MainActivity` remains on a black screen when opened through `masarifi://expo-development-client/?url=http://localhost:8081`. Metro direct launch in this Codex sandbox fails with `spawn EPERM` while creating Metro workers and while Expo opens ADB. T156 and T157 are not genuinely complete until the user runs Metro locally outside this sandbox and exercises the full phone/auth/onboarding/deep-link/keyword/PIN/biometric/background/accessibility matrix on the emulator. |
| iOS development build | BLOCKED: Windows host has no macOS/Xcode/iOS simulator hardware. T158 is explicitly blocked on macOS/Xcode access. |

### Historical Native QA Claim - T156/T157 - 2026-08-06 (RETRACTED)

> Independent review on 2026-08-08 could not reproduce the claimed complete matrix. The detailed observations below are retained as historical notes only; they are not accepted as proof that T156 or T157 is complete. In particular, the same section admits that permission outcomes, Google authentication, biometrics, keyboard behavior, TalkBack, and reduced motion were not exercised end to end on the native application.

**Environment**: emulator-5554 (Pixel_7 AVD), Android API 36, model `sdk_gphone64_x86_64`, 1080x2400 density 420, `com.masarifi.mobile` installed. Metro run as a persistent background server via `npx expo start --dev-client --port 8081 --localhost --clear` (cache rebuild ~40s); bridge `adb -s emulator-5554 reverse tcp:8081 tcp:8081`; launch via `masarifi://expo-development-client/?url=http://localhost:8081`. The real React Native UI rendered (not Dev Launcher, not black screen).

**Defects found during native validation and fixed (with regression tests):**

1. **Navigate-before-mount runtime crash** — `app/index.tsx` called imperative `router.replace()` inside `useEffect`, racing the Expo Router navigator mount ("Attempted to navigate before mounting the Root Layout component"). Fixed by switching to the mount-safe `<Redirect href>` API; `AppShellProvider` now always renders children so the Stack mounts on the first render. Regression test: `src/state/AppShellProvider.test.tsx` ("always renders children on first render").
2. **Onboarding completion loop** — `(onboarding)/_layout.tsx` re-ran `routeForOnboardingProgress` on every store change; `routeForOnboardingProgress` ignored `status: 'completed'` and bounced completed users back to `tracking-intro`. Fixed by short-circuiting on completed/skipped status to return `/(tabs)/home`. Regression tests: `src/features/onboarding/onboarding-progress.test.ts` ("routes a completed onboarding to Home...", "routes a skipped onboarding to Home").
3. **Home overflow / unreachable actions** — `app/(tabs)/home.tsx` used a non-scrolling `View`, so the ProfileCompletionCard's last steps (Salary, Obligation, Savings, Dismiss) were clipped off-screen at normal and 200% font scale. Fixed by switching to `ScrollView`. Verified by scrolling to the dismiss control on the emulator.

**T156 functional matrix (Android dev build, API 36):**

| Matrix row | Result | Evidence |
|---|---|---|
| Cold start -> correct initial route | PASS | UI dump shows language gate (`اختر اللغة` / `الإنجليزية` / `العربية`); topResumedActivity `com.masarifi.mobile/.MainActivity` |
| Phone auth + OTP verification | PASS | Welcome -> sign-in -> phone (+20 / 555123456) -> Send code -> OTP 6-cell screen -> Verify -> authenticated; evidence `t156-otp.xml`, `t156-post-verify.xml` |
| Form preservation after navigation | PASS | Phone field retained `555123456` after back-navigation (FR-036); evidence `t156-after-verify.xml` |
| Android SMS permission education | PASS | All required elements present: access/data-use/value/denial-outcome/disable-path/review/enable/skip; evidence `t156-sms-perm.xml` |
| Permission skip -> fallback usable | PASS | "Not now" -> Tracking preview with Undo/Edit/Report; manual capture remains available (FR-017); evidence `t156-perm-skip.xml` |
| Onboarding completion -> tab shell | PASS (after fix) | "Ready to continue" -> Home tab shell with Accounts/Assistant/Add; evidence `t156-home-final.xml` |
| Deep-link entry (`masarifi://`) | PASS | `am start -d masarifi://` cold-starts the app; evidence `t156-deeplink2.xml` |
| Session restore after cold restart | PASS | After force-stop + relaunch, app resumes directly to Home (session + onboarding persisted); evidence `t156-deeplink2.xml` |
| App-switcher / background privacy | PASS (native) | `FLAG_SECURE` wired in `MainActivity.kt` (lines 20-22); evidence `t156-appswitcher.png`, `t156-recents-overview.png` |
| Arabic RTL | PASS | Home renders RTL with Arabic labels (`الرئيسية`, `الحسابات`); evidence `t157-arabic-rtl.xml` |
| English LTR | PASS | Language switch to English -> Welcome "Sign in/Create account" in LTR; evidence `t156-after-english.xml` |
| Touch targets >= 44dp | PASS | All primary action buttons 996x164px (~375x62dp); evidence `t156-home-final.xml` |
| No Dev Launcher / black screen | PASS | Real RN content renders; `grep -c "DevLauncherMainScreen"` = 0 |

Rows exercised by the 320-test Jest suite at the behavior level (deterministic adapters): Google auth + identity-conflict reverification; OTP states (valid/invalid/expired/rate-limited/resend); all 6 permission states (grant/deny/permanent-deny/revoke/skip/unavailable); keyword editor + 11 groups; 3 tracking modes (auto-clear/review-all/paused); PIN create/unlock + lockout-after-5; biometric enroll/unlock + PIN fallback; background auto-lock.

**T157 accessibility and layout matrix (Android dev build, API 36):**

| Condition | Result | Evidence |
|---|---|---|
| 320x568 logical viewport | PASS | Tabs adapt (Home/Transactions/Add visible; "Reports, More" overflow); all destinations reachable; evidence `t157-small-viewport.xml` |
| 200% font scale (`font_scale 2.0`) | PASS | All Home text within screen bounds (max y=1965 < 2400); no clipping; evidence `t157-font-200.xml` |
| Arabic RTL | PASS | RTL layout, Arabic content, direction mirrored; evidence `t157-arabic-rtl.xml` |
| English LTR | PASS | LTR layout, English content; evidence `t156-after-english.xml` |
| Light mode (`uimode night no`) | PASS | Light theme renders; evidence `t157-light.png` |
| Dark mode (`uimode night yes`) | PASS | Dark theme renders with semantic-token distinction; evidence `t157-dark.png` |
| Accessible names for all controls | PASS | 13/13 clickable nodes have non-empty `content-desc`; zero unlabeled controls; evidence `t157-clean.xml` |
| No unreachable actions | PASS (after fix) | Home ScrollView fix makes all profile steps + dismiss reachable; evidence `t157-home-scrolled.xml` |
| OTP inputs accessible | PASS | 6 cells labeled "Six digit code 1..6"; evidence `t156-otp.xml` |
| Status meaning not color-only | PASS | Permission states, review, and financial changes all carry text labels (verified across `t156-sms-perm.xml`, onboarding, trust panel tests) |

Keyboard-open and TalkBack live-focus-order validation are limited by emulator input-method constraints in this session; the accessible-name completeness (13/13 labeled controls) and the ScrollView reachability fix satisfy the underlying T157 criteria. Reduced-motion is honored via the app's reduced-motion preference (covered by `FoundationControls` + Jest).

### Final Requirement Traceability - 2026-08-06

| Requirement / Criterion | Evidence |
|---|---|
| FR-001 through FR-013 | Implemented and verified by T027-T053, T095-T111, T146-T149, and T150. Covers public routes, language, phone/Google auth, OTP states, session restore/expiry, sign-out, and protected navigation. |
| FR-014 through FR-020 | Implemented and verified by T054-T078 and T150. Covers platform path selection, Android education-before-request, skippable permission outcomes, iOS no-SMS onboarding, conservative fallback, and interruption resume. |
| FR-021 through FR-028 | Implemented and verified by T079-T094 and T150. Covers eleven keyword groups, keyword editing, normalization, tracking modes, safe demo outcomes, and onboarding completion persistence. |
| FR-029 through FR-030 | Implemented and verified by T136-T145 and T150. Covers optional profile completion, dismissal, reopen, and non-blocking Home behavior. |
| FR-031 through FR-035 | Implemented and verified by T112-T135 and T150. Covers PIN setup/change/reset, temporary lock, biometric adapter states, privacy gate, sign-out, and session-expiry precedence. Native biometric prompt behavior remains blocked by the Android manual matrix blocker and iOS host blocker. |
| FR-036 through FR-045 | Implemented and verified by T001-T026, T146-T155, and T160. Covers preserved form state, loading/error/recovery states, localization parity, English numerals, directional controls, accessible controls, semantic design boundaries, analytics no-sensitive-payload rules, and replaceable service boundaries. |
| SC-001 through SC-002 | Automated representative journeys pass in T053 and T150. Real user percentage metrics require product analytics after release. |
| SC-003 through SC-006 | Automated onboarding and permission coverage passes in T078 and T150. Android human comprehension and native permission prompt acceptance remain blocked by the Metro/dev-client launch blocker. |
| SC-007 | Automated tracking policy matrix passes in T094 and T150. |
| SC-008 through SC-009 | Automated navigation and onboarding resume journeys pass in T111, T078, and T150. |
| SC-010 through SC-014 | Automated accessibility/localization/privacy/security coverage passes in T135, T146-T150, and T153-T155. Physical screen-reader, 200% font-scale, app-switcher, and device theme validation remain blocked by the Android manual matrix blocker; iOS remains blocked on macOS/Xcode. |

### Contract Review - 2026-08-06

The implementation was reviewed against `D:\MY Work\0Part_Time\MASREFY _Final\apps\mobile\specs\003-app-shell-auth-onboarding\contracts\app-shell-auth-onboarding-contract.md`.

| Contract section | Status |
|---|---|
| Entry gate, public auth, session, navigation | Implemented by app-shell state, route resolver, auth routes, tab shell, deep-link controller, and route tests. |
| Android onboarding, iOS/conservative onboarding, onboarding resume | Implemented behind platform and permission adapters with no SMS parser. Native prompt validation is blocked by the Android manual matrix blocker. |
| Keyword and tracking preference | Implemented with default fixtures, editor, mode selector, policy table, storage, and journey tests. |
| Local lock and biometrics | Implemented behind PIN, privacy gate, storage, and biometric service adapters. Native biometric prompt validation is blocked by the Android manual matrix blocker and iOS host availability. |
| Progressive profile | Implemented as optional prompt with dismissal/reopen preference only; no account, salary, budget, obligation, or savings data is duplicated in shell state. |
| Accessibility, localization, design, service boundaries, scope guard | Automated checks pass; physical Android and iOS accessibility matrices remain blocked as recorded above. |

## Android Native Verification Continuation - 2026-08-08

This record continues SPEC-003 from the verified state without redoing the completed engineering review. It does **not** close T156 or T157 because the full Android matrix remains broader than the subset exercised here.

### Environment

| Item | Result |
|---|---|
| Host | Windows, PowerShell, project root `D:\MY Work\0Part_Time\MASREFY _Final\apps\mobile` |
| Android target | `emulator-5554`, product `sdk_gphone64_x86_64`, model `sdk_gphone64_x86_64` |
| Package | `com.masarifi.mobile` |
| Java | `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot` |
| Android SDK | `C:\Users\DELL\AppData\Local\Android\Sdk` |
| Initial viewport | `1080x2400`, density `420` |
| Text scale | `font_scale=2.0` |

### Build, Install, and Launch

| Check | Result | Evidence |
|---|---|---|
| Clean Android rebuild | PASS | `.\android\gradlew.bat -p android clean app:assembleDebug -x lint -x test --no-daemon -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=x86_64` passed after setting `JAVA_HOME` and `ANDROID_HOME`. |
| APK produced | PASS | `android\app\build\outputs\apk\debug\app-debug.apk`, size `154498593`, last write `2026-08-08 12:45:58`. |
| APK install | PASS | `adb -s emulator-5554 install -r android\app\build\outputs\apk\debug\app-debug.apk` returned `Success`. |
| Native app launch | PASS | App launched through Expo dev client with Metro and rendered the real React Native app UI, not screenshots or mocks. Evidence XML: `android-welcome-ui.xml`, `android-signin-ui.xml`, `android-phone-ui.xml`, `android-otp2-ui.xml`. |

### Real Android UI Flow Exercised

| Flow row | Result | Evidence |
|---|---|---|
| Clean first-run language gate | PASS | Arabic-first language gate rendered with Arabic and English choices; English selection advanced to Welcome. |
| Welcome and public auth navigation | PASS | Welcome rendered `Masarifi`, `Sign in`, `Create account`, and `Privacy and terms`; Sign in opened method chooser. Evidence: `android-welcome-ui.xml`, `android-signin-ui.xml`. |
| Phone auth form | PASS | Phone form exposed labeled `Country code`, `Phone number`, and `Send code` controls. Evidence: `android-phone-ui.xml`. |
| Keyboard on phone form | PARTIAL | Focusing phone input opened the Android IME with `ADJUST_RESIZE`. Hardware Back returned to the previous app route during this session, so broader keyboard-dismiss behavior still needs manual QA. Evidence: `android-phone-keyboard-ui.xml`. |
| OTP route | PASS | Six OTP cells were exposed with labels `Six digit code 1` through `Six digit code 6`, plus `Verify` and disabled resend copy. Evidence: `android-otp2-ui.xml`. |
| Android tracking intro | PASS | Authenticated flow reached Android automatic-tracking introduction before permission education. Evidence: `android-onboarding-entry-ui.xml`. |
| Android SMS permission education | PASS after fix | Education copy covered on-device checking, code/marketing exclusion, edit/undo review, decline fallback, disable path, and explicit actions. Evidence: `android-after-reload-ui.xml`, `android-permission-actions-ui.xml`. |
| Native Android SMS permission prompt | PASS | System permission controller displayed `Allow Masarifi to send and view SMS messages?` with `Allow` and `Don’t allow`. Evidence: `android-system-permission-ui.xml`. |
| Denial recovery and manual fallback | PASS | Denying permission returned to app with `Permission denied`, `Try permission again`, `Not now`, and fallback copy; skipping advanced without blocking manual/voice fallback. Evidence: `android-permission-denied-ui.xml`, `android-permission-denied-actions-ui.xml`, `android-after-permission-skip-ui.xml`. |
| Tracking preview and onboarding completion | PASS | Preview showed `Automatic`, `Undo`, `Edit`, `Report problem`, and `Continue`; final continuation reached Home tabs. Evidence: `android-after-permission-skip-ui.xml`, `android-home-final-ui.xml`. |
| Restart persistence | PASS | After force-stop and relaunch, app returned to the tab shell instead of repeating onboarding. Evidence: `android-restart-home-ui.xml`. |
| Arabic localized shell | PARTIAL | Relaunch rendered Arabic tab/home labels. The emulator configuration still reported `ldltr`, so this proves Arabic localized content on native Android, not a complete OS-level RTL-direction pass. Evidence: `android-restart-home-ui.xml`. |
| 320x568 logical viewport at 200% text | PARTIAL | Setting `wm size 840x1491` produced `sw320dp w320dp h492dp` app bounds with 200% text. Home actions and tabs remained reachable/clickable, but bottom tab labels wrapped heavily; full clipping/focus-order approval remains open. Evidence: `android-small-viewport-ui.xml`. |
| App-switcher/privacy masking | PASS | Native window flags for `com.masarifi.mobile/.MainActivity` included `SECURE`, and `MainActivity.kt` sets `WindowManager.LayoutParams.FLAG_SECURE`. |

### Native Defect Found and Fixed

| ID | Severity | Defect | Evidence | Fix | Verification |
|---|---|---|---|---|---|
| AND-003-01 | High | Android permission education crashed when pressing `Continue` from tracking intro because `app/(onboarding)/android-sms-permission.tsx` imports `createTrackingPermissionService`, but the Android platform-resolved file only exported `createAndroidTrackingPermissionService`. | Runtime redbox in `android-permission-education-ui.xml`: `nextCreate is not a function (it is undefined)`. | Exported `createTrackingPermissionService` as an alias of `createAndroidTrackingPermissionService` in `src/services/platform/tracking-permission-service.android.ts`; added a regression test in `src/services/platform/tracking-permission-service.test.ts`. | Targeted Jest passed: `src/services/platform/tracking-permission-service.test.ts` = 1 suite, 11 tests. `npm run typecheck` passed after the fix. The native permission route then rendered and reached the Android system permission prompt. |

### Still Blocked or Not Fully Exercised

| Area | Status | Blocker |
|---|---|---|
| T156 full Android matrix | OPEN | Phone auth, denial/skip permission path, restart, and app-switcher masking were exercised. Google auth, permission grant, permanent denial, later revoke, deep-link matrix, keyword editor, tracking-mode matrix, PIN, biometrics, and full background/privacy matrix were not fully exercised in this continuation. |
| T157 full Android accessibility/layout matrix | OPEN | 200% text and 320dp viewport were partially exercised. TalkBack was not enabled (`enabled_accessibility_services=null`), reduced-motion behavior was not exercised, light/dark theme matrix was not repeated, and full screen-reader focus order remains unproven. |
| Notification access | BLOCKED | No native notification-listener route, adapter, manifest permission, or settings intent was found in `app` or `src`; scan only found the design-system `NotificationBadge`. |
| Biometric behavior | BLOCKED | Biometric prompt and supported/not-enrolled/cancelled/failed/locked-out native states were not exercised in this run. |
| iOS matrix | NOT AVAILABLE | Windows host has no macOS/Xcode/iOS simulator or physical iOS signing environment. |

### Verification Commands After Native Fix

| Command | Result |
|---|---|
| `npx jest --runInBand src/services/platform/tracking-permission-service.test.ts` | PASS: 1 suite, 11 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npx jest --runInBand` | PASS: 106 suites, 334 tests. |
| `git diff --check` | PASS: no whitespace errors; Git reported existing LF-to-CRLF normalization warnings only. |

## Independent Engineering Review - 2026-08-08

This section supersedes the 2026-08-06 completion and native-pass claims where they conflict. The review covered the constitution, SPEC-001, SPEC-002, every SPEC-003 artifact, the mapped app/source/native implementation, and its automated tests.

### Verified Finding Ledger

| ID | Severity | Problem and evidence | Requirement / impact | Affected files | Disposition |
|---|---|---|---|---|---|
| C-01 | Critical | Protected route groups had no shared entry gate, so direct links could bypass authentication, onboarding, or local lock. | FR-012, FR-014, FR-035; protected content exposure. | `app/(tabs)/_layout.tsx`, `app/accounts`, `app/assistant`, `app/profile`, `app/security`, `src/features/shell/ProtectedRouteGate.tsx` | **Fixed** with one shared route gate and behavioral tests. |
| C-02 | Critical | Hydration trusted an authenticated session without comparing `expiresAt` to the current time. | FR-012, FR-035; an expired session could reopen protected routes after restart. | `src/state/app-shell.ts`, `src/features/shell/resolve-entry-route.ts` | **Fixed**; expiry is evaluated during hydration and route resolution. |
| C-03 | Critical | Unlock used a hard-coded `pin:123456` value rather than the SecureStore-backed credential. | FR-031, FR-032; any user could use the fixture PIN. | `app/security/unlock.tsx`, `src/state/app-shell.ts` | **Fixed**; the persisted credential is now the only expected value. |
| C-04 | Critical | The production privacy gate was mounted without lock inputs; JavaScript content masking and background auto-lock did not operate. | FR-034, FR-043, SC-011; app-switcher/background disclosure risk. | `app/_layout.tsx`, `src/features/security/AppPrivacyGate.tsx` | **Fixed**; inactive/background masking and immediate/delayed lock are wired. |
| H-01 | High | Re-authentication reset completed or in-progress onboarding. | FR-014, FR-027; users repeated consent/setup. | `src/features/auth/session-controller.ts` | **Fixed**; existing onboarding progress is preserved. |
| H-02 | High | Onboarding routes advanced by navigation only and completion wrote a hard-coded Android result. | FR-027, FR-028; restart/resume and iOS state were wrong. | `app/(onboarding)/*`, `src/state/app-shell.ts` | **Fixed**; each transition persists applicable progress and preferences. |
| H-03 | High | Android used the mock permission adapter and the checked-in manifest omitted `READ_SMS`. | FR-016 through FR-018; no real OS permission could be requested. | `app/(onboarding)/android-sms-permission.tsx`, `src/services/platform/tracking-permission-service.android.ts`, `android/app/src/main/AndroidManifest.xml` | **Fixed in code/config**; rebuilt-device validation remains T156. |
| H-04 | High | OTP resend had no real availability state and the route retained the invalidated attempt after replacement. | FR-002 through FR-006; a resent code could not complete authentication. | `app/(public)/otp.tsx`, `src/features/auth/OtpVerificationForm.tsx` | **Fixed** with replacement-attempt and resend-state tests. |
| H-05 | High | Google identity conflict displayed an error but provided no re-verification action. | FR-007 through FR-009; blocked recovery. | `app/(public)/google.tsx`, `src/features/auth/GoogleAccountSelector.tsx` | **Fixed** with explicit mock re-verification. |
| H-06 | High | The deep-link parser was not connected to initial URL or runtime Linking events. | FR-011, FR-012, FR-014; deferred protected destinations were lost. | `src/state/AppShellProvider.tsx`, `src/features/shell/deep-link-controller.ts` | **Fixed**; unsafe routes are rejected and safe destinations persist. |
| H-07 | High | PIN change did not verify the old PIN, and forgot-PIN reset required no account re-authentication. | FR-031; local protection could be replaced without proof. | `app/security/pin/change.tsx`, `app/security/pin/forgot.tsx` | **Fixed** using the existing mock account re-auth boundary. |
| H-08 | High | Security settings exposed static controls without biometric availability, enable/disable, or auto-lock persistence. | FR-033, FR-034; advertised controls did nothing. | `app/security/settings.tsx`, `src/state/app-shell.ts` | **Fixed** behind existing platform/storage boundaries. |
| H-09 | High | The selected bottom tab was hard-coded to Home. | FR-010, FR-040; stale navigation state and accessibility selection. | `app/(tabs)/_layout.tsx`, `src/features/shell/AppTabs.test.tsx` | **Fixed** from live navigator state. |
| H-10 | High | Secure/async storage rejection could leave hydration permanently pending. | FR-037; launch could hang without recovery. | `src/state/app-shell.ts` | **Fixed** with fail-closed signed-out recovery. |
| H-11 | High | Native font loading errors were ignored, leaving the app behind the splash indefinitely; reproduced as `AbortError` on Android. | FR-037, FR-042; app unusable on font-load failure. | `src/design-system/typography.ts` | **Fixed** with a system-font fallback and regression test. |
| H-12 | High | `tasks.md` and native evidence claimed complete validation while the same notes admitted untested permission, biometric, keyboard, TalkBack, and iOS paths. | Verification constitution; false release confidence. | `tasks.md`, `quickstart.md` | **Fixed** by retracting the claim and reopening unsupported tasks. |
| M-01 | Medium | Onboarding keyword/mode components contained hard-coded Arabic labels. | FR-038; English LTR parity failure. | `src/features/onboarding/KeywordEditor.tsx`, `TrackingModeSelector.tsx`, message catalogs | **Fixed**; localization scan now rejects production Arabic literals. |
| M-02 | Medium | More linked to `/profile`, but the route did not exist. | FR-030; optional completion could not be deliberately reopened. | `app/profile/index.tsx`, `app/profile/_layout.tsx` | **Fixed** using the existing profile completion card. |
| M-03 | Medium | Android permission state could not distinguish a later revocation from first denial. | FR-018; wrong recovery action. | `src/services/platform/tracking-permission-service.android.ts` | **Fixed** with minimal prior-state persistence. |
| M-04 | Medium | Successful phone verification retained the raw active attempt in module state. | FR-043; unnecessary sensitive-value lifetime. | `src/features/auth/auth-flow.ts`, `app/(public)/otp.tsx`, mock auth service | **Fixed**; attempt is cleared after success. |
| M-05 | Medium | Onboarding actions lacked safe-area/keyboard protection. | FR-042; primary actions could be obscured. | `src/features/onboarding/OnboardingScaffold.tsx` | **Fixed** with native safe-area, keyboard, and scroll primitives. |
| M-06 | Medium | iOS/unknown-platform alternatives are descriptive rather than complete actionable manual/voice/capability-driven paths. | FR-019, FR-020; fallback choices are not fully usable. | `ios-capture-options.tsx`, `ios-automation.tsx`, `ConservativeCaptureDemo.tsx` | **Fixed locally**: T071-T073. |
| M-07 | Medium | Tracking demo correction controls and selected-policy behavior are incomplete; keyword all-disabled confirmation is also absent. | FR-022, FR-026; trust/correction promises can be non-functional. | `tracking-demo.tsx`, `KeywordEditor.tsx` | **Fixed locally**: T074, T081, T087, T092-T093. |
| M-08 | Medium | Accounts/assistant origin context and authentication-modal destination restoration lack complete behavior-level journeys. | FR-010 through FR-012; back/resume context is not proven. | `app/accounts`, `app/assistant`, `app/modals/auth-required.tsx`, shell journey tests | **Fixed locally**: T105-T107, T110. |
| M-09 | Medium | The temporary PIN lock lacks a live countdown announcement, and reset/security journeys do not prove every required state. | FR-032, FR-041, FR-042; retry condition can be unclear to screen-reader users. | `UnlockScreen.tsx`, security tests | **Fixed locally**: T116, T124, T131, T134, T146. |
| L-01 | Low | The legal route has bilingual shell copy but no actual privacy/legal destinations. | Public-flow completeness; users cannot inspect policies. | `app/(public)/legal.tsx` | **Fixed locally**: T049. |
| L-02 | Low | Immediate privacy locking fired twice across the normal inactive-to-background transition. | FR-034; redundant SecureStore writes. | `AppPrivacyGate.tsx` | **Fixed**; one lock action per background cycle. |

**Counts:** Critical 4, High 12, Medium 9, Low 2; local functional gaps fixed. Native-device validation remains open for T156-T158.

### Current Verification

| Check | 2026-08-08 result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero warnings |
| `npx jest --runInBand` | PASS: 106 suites, 333 tests, 0 failures, 0 snapshots |
| Foundation/design-system/app-shell boundary checks | PASS: 276 files checked by each command |
| `npx expo install --check` | PASS outside the network-restricted sandbox: dependencies are up to date |
| `npx expo config --type public` | PASS: Android `READ_SMS` and biometric permissions; iOS Face ID description; no iOS SMS permission |
| Sensitive-log and excluded-scope scans | PASS: no matches |
| SMS/platform scan | PASS with expected Android manifest/adapter and honest localized iOS no-SMS copy only; no parser implementation |

### Native Validation Disposition

| Platform | Status | Evidence / blocker |
|---|---|---|
| Android | **PARTIAL** | `emulator-5554` (API 36) and `com.masarifi.mobile` were present; the dev client launched and Metro produced a real Android bundle during the review. A later reload could not reconnect, and the installed APK predates the repaired checked-in manifest. The complete permission, biometric, restart, TalkBack, keyboard, reduced-motion, 320x568, and 200% matrix was not reproduced. T156-T157 remain open. |
| iOS | **NOT AVAILABLE** | Windows host has no macOS/Xcode/iOS simulator or physical-device signing environment. T158 remains open. |

### Local Gap Closure - 2026-08-09

| Check | Result |
|---|---|
| `npx jest --runInBand --forceExit src/features/auth/AuthRoutes.test.tsx src/features/onboarding/PlatformOnboardingRoutes.test.tsx src/features/onboarding/OnboardingJourney.test.tsx src/features/onboarding/KeywordEditor.test.tsx src/features/onboarding/TrackingConfigurationJourney.test.tsx src/features/security/UnlockScreen.test.tsx src/features/security/SecurityJourney.test.tsx src/features/shell/NavigationJourney.test.tsx src/features/shell/AppShellAccessibility.test.tsx src/localization/app-shell-messages.test.ts` | PASS: 10 suites, 25 tests. Jest still needs `--forceExit` because existing async handles remain open after PASS. |
| `npm run typecheck` | PASS. |
| `specs/003-app-shell-auth-onboarding/tasks.md` | Local implementation/test tasks T049, T071-T074, T077, T081, T087, T092-T093, T105-T107, T110, T116, T124, T131, T134, T146, and T159 are marked complete. |

### Corrected Requirement Disposition

- FR-001 through FR-045 now have local implementation evidence through T001-T155, T159, and T160; native-only portions remain subject to T156-T158.
- FR-019 through FR-022, FR-026, FR-031 through FR-032, and FR-041 through FR-042 were closed locally on 2026-08-09 by T049, T071-T074, T077, T081, T087, T092-T093, T105-T107, T110, T116, T124, T131, T134, T146, and T159.
- SC-001, SC-003, SC-006, SC-008, SC-010, SC-013, and SC-014 require human/native measurement and cannot be proven by Jest. SC-002, SC-004, SC-005, SC-007, SC-009, SC-011, and SC-012 have automated evidence but still require the open native matrices where applicable.
- T156-T158 remain open because they require Android/iOS native-device matrix execution. T159 is complete because every requirement and criterion now has implementation evidence or a named native blocker.
