# Root/Entry Android Validation

Date: 2026-08-15

Status: PARTIAL. App installs and loads from Metro on the connected Android device; the full Root/Entry device matrix remains open.

Device detected: Samsung `SM-A165F`, Android `16`, `1080x2340`, font scale `1.0`.

Evidence:

- Built and installed from short Windows drive alias `M:` to avoid the earlier native path/CMake issue:
  - `android\gradlew.bat app:installDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8081`
  - Result: `BUILD SUCCESSFUL`, `Installed on 1 device`.
- Started Metro with `npm start`, set `adb reverse tcp:8081 tcp:8081`, and opened the dev client with:
  - `masarifi://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`
- Captured screenshots:
  - `masarifi-r01-screen-2.png`: dev client loading from `127.0.0.1:8081`.
  - `masarifi-r01-screen-3.png`: language entry screen rendered on device.
  - `masarifi-r01-screen-4.png`: English public entry screen rendered on device.

Open before T061 can be checked:

- Arabic and English Root/Entry matrix beyond initial language/English public entry.
- Light/dark.
- 200% text.
- TalkBack.
- Reduced motion.
- Locked/unhydrated startup states.
