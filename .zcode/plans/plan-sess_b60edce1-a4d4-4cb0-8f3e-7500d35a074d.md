# Plan: Finish SPEC-003 — T156 & T157 (Android native validation)

## Goal & honest framing
T156/T157 are the only two incomplete tasks. Both require the **real RN UI** rendering on the Android emulator — not the Dev Launcher, not a black/splash screen. The entire app is built (317 Jest tests green, APK installs on `emulator-5554`). The single gating blocker is **Metro cannot serve the JS bundle** (jest-worker `spawn EPERM`/crash). I will repair Metro first; only if the real UI loads do I run the matrices. If Metro is genuinely unrepairable I will prove it with logs and leave T156/T157 `[ ]` — I will not fabricate completion.

## Phase A — Repair Metro & load real RN UI (the gate)
1. **Env/state cleanup** (read state already done): set `ANDROID_HOME` (adb resolves via PATH but gradle/SDK need it); kill the stale `node.exe` squatting on **8082** (PID 19248) and any leftover Metro processes.
2. **Clear caches**: `npx expo start --clear` resets Metro + Expo cache; remove stale `.expo` runtime artifacts.
3. **Start Metro serial** to dodge the jest-worker spawn crash: `npx expo start --dev-client --clear --max-workers 1 --localhost` (run in background). `--max-workers 1` does transforms in-process and is the standard fix for `spawn EPERM`/worker-exit on Windows.
4. **Bridge emulator ↔ host**: `adb -s emulator-5554 reverse tcp:8081 tcp:8081`.
5. **Launch fresh**: `adb shell am force-stop com.masarifi.mobile` then `adb shell monkey -p com.masarifi.mobile -c android.intent.category.LAUNCHER 1`.
6. **Verify real UI**: wait for Metro "Bundling … done", then capture screenshot + `adb shell uiautomator dump` + logcat. Acceptance = UI hierarchy shows Masarifi screens/controls (e.g. language/welcome/tabs), **NOT** `DevLauncherMainScreen` and **NOT** a black `MainActivity`.
7. **Fallback ladder if A3–A6 fail**: (a) `--lan` host mode; (b) port 8083 + rebuild dev-client APK with that port; (c) `npx expo run:android` (full rebuild+bundle, bypasses dev-launcher entirely); (d) delete `node_modules/.cache` + reinstall if a corrupt transform is the cause. Each tried with fresh logs.
8. **Decision gate**: real UI loads → Phase B. Still black/DevLauncher after ladder exhausted → STOP, record exact blocker + logcat + screenshots, leave tasks `[ ]`, report honestly.

## Phase B — T156 functional matrix (live emulator)
For each row: perform on device → screenshot + logcat extract + UI dump → record pass/fail + device/API in `quickstart.md`. Permission/biometric states are driven by the app's **mock adapters** (per research Decision 5/6), so grant/deny/permanent-deny/revoke/skip are exercised via in-app toggles (plus real `adb` biometric enrollment for the biometric row).
- Cold start → correct initial route (public language/welcome gate).
- Phone auth: OTP states (valid/invalid/expired/rate-limited/resend).
- Google auth + identity-conflict reverification path.
- Onboarding: tracking-intro → **android-sms-permission** with all 6 states (grant/deny/permanent-deny/revoke/skip/unavailable) + fallback remains usable.
- Keywords editor + 3 tracking modes (auto-clear/review-all/paused).
- Deep link `masarifi://…` entry gate.
- PIN create + unlock (valid/lockout-after-5).
- Biometric: enroll fake fingerprint via `adb`, unlock, PIN fallback.
- Background → app-switcher: background app → screenshot must be masked/black (`FLAG_SECURE` is wired in MainActivity).
- Tab navigation order (Home/Transactions/Add/Reports/More) + back-nav.

## Phase C — T157 accessibility & layout matrix
- **320×568**: `adb shell wm size 320x568` (reset after).
- **200% font**: `adb shell settings put system font_scale 2.0`.
- **Arabic RTL / English LTR**: via app language control; verify direction in UI dump + mirrored nav icons.
- **Light/dark**: `adb shell cmd uimode night yes/no`.
- **Keyboard open**: focus an input, assert layout adapts.
- **TalkBack**: enable via `adb shell settings put secure enabled_accessibility_services com.google.android.marvin.talkback/.TalkBackService`; verify labels/focus order.
- **Reduced motion**: app control.
- Verify per task: no critical clipping at 200%/320px, logical focus order, accessible names present, touch targets ≥44px, status meaning not color-only, sensitive masking, navigation direction mirrors RTL. Record each result + evidence path.

## Phase D — Defect triage (only if defects surface)
Fix each genuine defect in code; add a Jest regression test where the behavior is deterministic (TDD, test-guard compliant: behavior not implementation). Note every fix in the evidence record. Re-run after each.

## Phase E — Final automated verification
`jest --runInBand`, `typecheck`, `lint`, `check:foundation`, `check:design-system`, `check:app-shell`, `expo config --type public`, and a Gradle `app:assembleDebug` **only if any native file changed**. All must be green before sign-off.

## Phase F — Record evidence & honest sign-off
- Update `specs/003-app-shell-auth-onboarding/quickstart.md` "Native QA" section: Metro command, device/API (emulator-5554, API 36), every T156 row + every T157 condition with pass/fail + screenshot path + logcat extract.
- Fresh evidence files (overwrite stale ones): load, Arabic-RTL, English-LTR, light, dark, large-text, permission-denied, permission-recovery, key-a11y, plus UI dumps.
- Mark T156/T157 `[X]` **only** after the matrices genuinely pass. Preserve SpecKit task format exactly; do not touch completed tasks.
- Final report covers all 10 required items (UI load? emulator model/API, Metro command, scenarios tested, defects found/fixed, evidence paths, automation results, task count, genuine sign-off y/n).
- Do **not** start SPEC-004; do **not** claim iOS validation.

## Realistic risk (stated up front)
The Metro jest-worker crash is the known killer of every prior attempt. `--max-workers 1` + clean ports + `--clear` is the highest-probability fix; if Metro still cannot serve the bundle after the fallback ladder, the correct outcome is a fully-evidenced blocker (not false completion). The plan is built so that a real UI load is the sole trigger for marking the tasks done.