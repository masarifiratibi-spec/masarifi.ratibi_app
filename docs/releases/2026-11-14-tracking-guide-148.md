# Tracking guide B — Android device release 148

The user requested a new build and installation on the connected phone on 14 November 2026. Final installed artifact: **1.0.1 / 148**, package `com.masarifi.mobile`, source `bf57509f683aae84b92607822e71a49ae8213971`.

APK: `E:/Masarifi-tracking-guide-148-20261114/Masarifi-1.0.1-148-arm64.apk`, 50,867,397 bytes. SHA-256: `0c409d166931b9e737b997c7b3cbd3a15f485fa7c4d45cfef7d3d40f2657d544`.

## Build and installation

The approved guide source previously passed 629 Jest suites / 5,213 tests, typecheck, scoped lint and design boundaries. Production APK147 built and qualified first. Device testing then reproduced an existing Android navigation problem: the notification listener settings intent, with `NEW_TASK` alone, brought an existing Settings task forward while its notification-display page remained on top. The actual app's intent resolved to notification access but returned `START_TASK_TO_FRONT`, displaying the wrong page.

Commit `bf57509f` adds `CLEAR_TOP` to that native intent. A direct device probe first demonstrated that the combined flags reveal the required page. Release148 recompiled the native module and passed `assembleRelease`; no dependency, permission, package or backend changes were required. Its guide Hermes bundle is byte-identical to147.

The existing C: build workspace retained its historical Git base; exact current inputs were materialized from the recorded source snapshot and verified with per-file hashes before qualification. Generated release configuration and versionCode were pinned separately. Private receipts are under `E:/Masarifi-tracking-guide-148-20261114/` (`prepared148.json`, `qualified148.json`, `installed148.json`, `device-acceptance148.json`). Signing credentials and phone dumps remain outside Git.

Qualification verified the retained signer on API24/28/32/33/35/36, non-debuggable production identity, manifest restrictions, ZIP/ELF16KB alignment, native library inventory, production API/auth bindings, Hermes guide markers, retained Record reflection and notification-consumer constructor. Gradle emitted Kotlin metadata/R8 and deprecation warnings; the build exited0, qualification passed and the sampled current app process had no fatal crash entries.

Ordinary `adb install -r` updates146→147→148 succeeded. Installed APK hashes were independently pulled and matched. Both profiles retained their UIDs, credential/device data directory inodes and first-install times. No uninstall, data clear or automated permission grant occurred. This is installation-identity preservation evidence, not a comparison of every financial database row.

## Physical acceptance on Redmi / Android15

- Collapsed guide B and permanent notification-settings shortcut rendered in the existing tracking page.
- Expanded guide displayed all three entries; SMS restricted-settings help opened with the approved copy.
- SMS step sheet opened the app information page.
- Bank step sheet opened notification access. For the regression check, an existing notification-access task was deliberately covered by notification-display settings; the **app's own button on148** correctly revealed `NotificationAccessSettingsActivity`.
- Transaction-alert step sheet opened the app's notification-display settings, including Show notifications, popups and sound. The permanent shortcut was also verified on147; its guide JavaScript is unchanged on148.
- Returning to the app retained the sheet; Android Back dismissed it. The final screen was left with the guide expanded and both existing tracking sources enabled.
- READ_SMS, POST_NOTIFICATIONS and notification-listener access remained enabled. No permission toggles were changed and no financial test message/notification was injected.

A transient sync-error banner was observed during147 navigation, then was absent from the final148 screen. Public API readiness returned200 with database and queue up. This UI release does not establish a new end-to-end financial-capture pass. Other Android manufacturers, fresh permission-grant flows, iOS, physical dark/English presentation and device screen-reader/large-font behavior were not requalified here. No Play publication or remote source push was performed.
