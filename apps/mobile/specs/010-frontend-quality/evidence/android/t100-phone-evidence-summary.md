# SPEC-010 Android T100 Evidence Summary

Date: 2026-08-13

Device: Samsung SM-A165F, USB `RK8XB00N33K`, restored to 1080x2340, density 450, font scale 1.0, dark mode.

Runtime: Expo dev client package `com.masarifi.mobile`, Metro `http://127.0.0.1:8083`.

## Passed Or Partially Passed Checks

| Area | Evidence | Result |
|---|---|---|
| Cold app/dev-client recovery | `t100-clean-start.xml`, `t100-after-warning.xml`, `t100-after-server.xml`, `t100-language3.xml` | Clean app reset cold-started through Android's 16 KB compatibility warning, Expo dev launcher, and app language screen. |
| OS SMS permission states | `t100-permission-education.xml`, terminal package-state output | App showed local-only SMS education and `Permission not requested`; Android `pm revoke` changed `READ_SMS` to `granted=false`; Android `pm grant` restored `READ_SMS` to `granted=true`. |
| SMS permission grant path | `t100-permission-dialog2.xml`, terminal package-state output | Tapping Enable tracking advanced to keyword review and Android package state showed `READ_SMS: granted=true`. No system dialog appeared on this installer-exempt development build. |
| SMS permission recovery/fallback UI | `t100-capture-route.xml`, `t100-capture-offline-start.xml` | `/foundation/capture` showed Android tracking denied/manual fallback, Continue/Skip, Add manually, and Add by voice while `READ_SMS` had been revoked. |
| Notification permission deny/grant | `t100-notification-denied.xml`, terminal package-state output | With `POST_NOTIFICATIONS` denied, route remained stable; after `pm grant`, package state showed `POST_NOTIFICATIONS: granted=true`. |
| Native notification presentation | `t100-notification-validation-route.xml`, `t100-notification-presented.xml` | Validation route presented a Masarifi local notification. Package-filtered notification inspection showed channel `financial-change` and native View/Edit/Undo actions. Raw shade dumps were not retained. |
| Foreground notification body/View response | `t100-notification-view-app.xml` | Tapping the live Android notification body opened transaction detail for `Merchant 1` with Edit, Report, and Delete actions. |
| Native Edit action response | `t100-notification-edit-app.xml` | Expanding the Android notification and tapping Edit opened the Edit transaction screen with amount `5.37`. |
| Hidden values | `t100-home-final2.xml` | Home retained masked financial values and safe accessibility text (`Value hidden`, hidden income/expense). |
| Light and dark theme | `t100-light-theme.xml`, `t100-dark-theme.xml` | Same capture route remained reachable after `cmd uimode night no` and `cmd uimode night yes`; device restored to dark mode. |
| 200% font size | `t100-font-200.xml` | Capture route remained reachable at Android `font_scale=2.0`; device restored to `1.0`. |
| Required small-screen validation | `t100-small-screen-720x1280-density320.xml` | Capture route remained reachable under `wm size 720x1280` and density 320; device restored to 1080x2340 and density 450. |
| Evidence privacy | terminal output | `node scripts/check-frontend-quality-secrets.mjs specs/010-frontend-quality/evidence/android` exited 0 after unsafe shade XML files were deleted. |

## Failed Or Blocked Checks

| Area | Status | Evidence | Reason |
|---|---|---|---|
| Native OS READ_SMS dialog deny/permanent-deny | blocked | `t100-permission-dialog2.xml` | On this development build, Enable tracking advanced to keyword review and Android package state became granted; the native READ_SMS prompt did not appear, so deny/permanent-deny could not be tapped. Manual `pm revoke`/`pm grant` state changes were proven instead. |
| Background notification response | blocked | `t100-notification-view-app.xml`, `t100-notification-edit-app.xml` | Foreground body/View and Edit action were proven, but background response was not separately completed. |
| Cold-start notification response | blocked | `t100-clean-start.xml`, `t100-notification-view-app.xml` | Cold app/dev-client recovery and foreground notification response were proven separately; a notification tap from a force-stopped app was not completed. |
| Undo, duplicate, expired, changed/deleted target, locked action | blocked | `t100-after-detail-back.xml`, `t100-after-edit-back.xml` | View and Edit worked; returning from Edit left the navigation stack brittle and remaining native action variants were not completed. |
| Offline local save/retry/reconnect | blocked | `t100-capture-offline-start.xml`, `t100-offline-entry-longtap.xml` | The denied/fallback offline harness rendered Add manually/Add by voice, but repeated ADB taps on Add manually did not create the local offline entry on this device. |
| Conflict preservation/recovery | blocked | `t100-capture-offline-start.xml` | Conflict controls require a created offline entry; blocked by Add manually not firing from ADB. |
| TalkBack | skipped by user | none | User explicitly requested skipping TalkBack for now. |

## Unsafe Evidence Handling

Two temporary notification-shade XML captures exposed unrelated personal notification text from the physical phone. Both retained repo files were deleted immediately. Subsequent shade inspection used temporary on-device XML plus exact Masarifi-only extraction, and no full shade captures were retained.
