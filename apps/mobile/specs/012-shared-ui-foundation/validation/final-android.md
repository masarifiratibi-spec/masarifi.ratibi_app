# Final Android Validation

Date: 2026-08-15

Status: PARTIAL. Android build/install and Metro app launch now pass; the complete R01 Android validation matrix remains open.

Device detected:

- Model: Samsung `SM-A165F`
- Android: `16`
- Screen: `1080x2340`
- Font scale: `1.0`

Successful retry:

- Root cause of the earlier native build blocker was the long/spaced worktree path interacting with native CMake/Ninja generation.
- Workaround used for validation only: `subst M: "D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation\apps\mobile"`.
- Build/install command from `M:\android`:
  - `android\gradlew.bat app:installDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8081`
- Result: `BUILD SUCCESSFUL in 2m 13s`; `Installed on 1 device`.
- Metro/dev-client connection:
  - `npm start`
  - `adb reverse tcp:8081 tcp:8081`
  - `adb shell am start -a android.intent.action.VIEW -d "masarifi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" com.masarifi.mobile`
- Result: app loaded on device and rendered the language screen and English public entry screen.

Captured evidence:

- `masarifi-r01-screen-2.png`: dev client loading from Metro.
- `masarifi-r01-screen-3.png`: language screen on Android.
- `masarifi-r01-screen-4.png`: English public entry screen on Android.

Still open:

- Five-tab shell, Auth Required, Planning Conflict, and Design-System Gallery Android journeys were not fully reached/validated in this retry.
- TalkBack, 200% text, dark/light, reduced motion, keyboard, lock/background-remask, smallest/large phone, and native modal checks remain incomplete.
