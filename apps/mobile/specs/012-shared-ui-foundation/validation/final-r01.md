# Final R01 Automated Evidence

Date: 2026-08-15

Final quickstart commands:

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:design-system`: PASS, 756 files checked.
- `npm run check:app-shell`: PASS, 756 files checked.
- `.\\node_modules\\.bin\\jest.cmd --runInBand src/design-system src/features/design-system src/features/shell`: PASS, 65 suites / 150 tests.
- `.\\node_modules\\.bin\\jest.cmd --runInBand src/features/financial-planning`: PASS, 4 suites / 6 tests.

Route behavior evidence:

- `RootLayoutOptions.test.tsx`: root and nested headers remain hidden.
- `resolve-entry-route.test.ts`: entry destination rules unchanged.
- `NavigationJourney.test.tsx`: primary and representative secondary destinations remain reachable.
- `ProtectedNavigation.test.tsx`: pending destination, lock, session, notification response, and protected execution behavior pass.
- `AuthRequiredRoute.test.tsx`: valid and unsafe pending destinations, duplicate submit, and write failure are covered.
- `PlanningConflictRoute.test.tsx`: route modal title/close behavior and conflictId pass-through are covered.
- `ValidationRoutesRegression.test.tsx`: diagnostic routes remain reachable.

Known device validation status:

- Connected Android phone: `SM-A165F`, Android `16`, physical size `1080x2340`, font scale `1.0`.
- `npm run android` initially required explicit `JAVA_HOME` and `ANDROID_HOME`, then failed from the long/spaced worktree path in native CMake/Ninja:
  - `expo-modules-core:buildCMakeDebug[armeabi-v7a]`: `ninja: error: manifest 'build.ninja' still dirty after 100 tries`.
  - arm64-only retry `android\\gradlew.bat app:installDebug ... -PreactNativeArchitectures=arm64-v8a` then fails in `react-native-screens:buildCMakeDebug[arm64-v8a]` with the same Ninja dirty-manifest error.
- Retried from short drive alias `M:` with `android\gradlew.bat app:installDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8081`.
- Result: Android dev build installed successfully: `BUILD SUCCESSFUL in 2m 13s`; `Installed on 1 device`.
- Metro/dev-client loaded after `adb reverse tcp:8081 tcp:8081` and `masarifi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`.
- Captured Android smoke evidence in `root-entry-android.md` and `final-android.md`.
- Android full visual/TalkBack validation remains open; only build/install/Metro launch and initial public entry screens were validated.
- iOS/VoiceOver validation remains blocked because no supported iOS/macOS environment is available in this Windows/Android session.

One broad convenience run, `.\\node_modules\\.bin\\jest.cmd --runInBand src/design-system src/features/design-system src/features/shell src/features/financial-planning`, timed out only in the existing long `NavigationJourney.test.tsx` when combined with all planning suites. The documented focused suites above pass.
