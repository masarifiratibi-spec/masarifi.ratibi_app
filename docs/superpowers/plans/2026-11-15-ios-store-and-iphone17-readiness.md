# iOS Store and iPhone 17 Readiness Implementation Plan

> Execute inline in the existing iOS worktree using superpowers:executing-plans. Preserve evidence and the execution ledger outside Git. Do not dispatch implementation agents.

**Goal:** Produce matching App Store Distribution and Ad Hoc IPAs from the final production source, test the Ad Hoc release on the owner's connected iPhone 17, and prepare review materials without uploading to Apple.

**Architecture:** Expo 55 / React Native 0.83, retained Clerk production identity and VPS API, native Apple sign-in beside Google on iOS, separate EAS iOS profiles. Android behavior, signing, version codes and profiles remain unchanged.

**Spec:** User's attached continuation request and approved plan in this chat; source handoff `docs/handoffs/2026-11-15-ios-android153-status-ar.md`. The two Apple store reports dated 2026-11-15 take precedence for privacy, content rights, price and availability.

## Global constraints

- Work only in E:/Masarifi-iOS on branch iOS; push only to ratibi. Baseline 1538bec2 includes published Android source 3fd103c7 / Android 153.
- iOS marketing version 1.0.0 is approved for both new profiles; keep existing Apple version 1.0 and Android versioning. Retain com.masarifi.mobile, masarifi and the existing EAS project, Clerk instance and production API.
- EAS source upload and builds, signing and Ad Hoc installation are authorized. No App Store Connect/TestFlight build upload, privacy Publish, Review/Submit, store release, agreements, price/availability changes, server/schema/role changes or OTA.
- Apple connection in the existing Clerk instance is authorized only if free: observed Hobby capacity 1 of 3 social connections. Do not upgrade or add paid features. Any additional external auth change outside this scope requires a concrete review.
- Use the existing Apple distribution certificate if suitable. Never revoke certificates/keys automatically. Verify actual device inclusion in the final Ad Hoc profile.
- No live account deletion or unsolicited report/push. Use fictional data; establish account, recipient and scope before real sends.
- Store IPAs, credentials, UDIDs, raw logs and account/device evidence in E:/Masarifi-ios-artifacts/ios-store-20261115, outside Git. Do not copy D worktree WIP or apply/delete the historical stash.

## Review focus

- Store profile must resolve production bindings before NODE_ENV is set and must reject Android/profile-marker mixing.
- Apple cancellation or stale SDK/session completion must not bootstrap the wrong owner; restored sessions keep a correct identity.
- iOS deletion Retry/Continue must not swap two presenting native Modal hosts.
- Screen mirroring can interfere with microphone use; verify voice without the mirroring session and keep physical Face ID/user confirmations genuine.
- Local tests, cloud builds, real-device acceptance and Apple processing are separate evidence levels; unavailable checks remain Not Tested.

### Task 1: Qualify matching iOS build profiles

**Interfaces:** Existing production bindings -> ios-ad-hoc/internal and ios-app-store/store with version 1.0.0, explicit compatible EAS image, production providers, unchanged Android settings.

- [x] Add failing profile/config/runtime/entrypoint tests for App Store, marker isolation, equal production bindings and retained Android configuration.
- [x] Add ios-app-store, update ios-ad-hoc's approved version/image, and extend config/runtime/production entrypoints without changing Android profiles or submit configuration.
- [x] Run Node configuration suites, scoped lint and diff checks; commit the qualified profiles.

### Task 2: Add native Apple authentication

**Interfaces:** AuthService.signInWithApple(): Promise<AuthResult>; session method adds apple; native Clerk bridge authenticates and explicitly activates the returned session before admission.

- [x] Add failing SDK-boundary/auth-service/UI/session-restoration tests for Apple success, cancellation, incomplete/error, owner isolation, availability and unchanged Android Google UI.
- [x] Install Expo 55-compatible expo-apple-authentication with the existing lockfile; add iOS-only native config and Apple button using the installed Clerk Apple hook.
- [x] Extend real/unavailable/demo auth providers consistently, preserve existing sessions and owner fences, and avoid Google-only labels for Apple identities.
- [x] Activate the free Apple social connection in the retained production Clerk instance after verifying the target and price; validate native registration. Request only genuinely missing credentials or out-of-scope Apple configuration.
- [x] Run relevant auth, routing, storage, privacy/recent-auth tests, typecheck and scoped lint; commit.

### Task 3: Resolve deletion presentation and audit compliance

**Interfaces:** Existing deletion service/receipt contracts unchanged; iOS presentation stays stable. Produce evidence-based login/encryption/privacy audit and draft review materials.

- [x] Reproduce error -> Retry/Continue -> progress -> error using iOS/Android fixtures; fix only an evidenced defect, keeping Android behavior and no live deletion.
- [x] Audit Info.plist, entitlements, SDK privacy manifests/reasons, SQLCipher/crypto and consent/data providers; add necessary iOS config with tests.
- [x] Record proposed export-compliance answers and metadata/privacy differences without making declarations or publishing.
- [x] Run changed suites, the project's mobile suite, typecheck, lint and secret checks; commit local fixes/audit.

### Task 4: Connect iPhone 17, sign, build and test

**Interfaces:** Fixed source commit + valid signing + actual iPhone enrollment -> matching Ad Hoc and App Store IPAs with private artifact manifests.

- [x] Verify current membership/team/Expo credentials/APNs and valid certificate/profile; owner enters secrets in their own UI.
- [x] Connect iPhone 17 over data USB; owner unlocks and trusts the computer. Read actual model/iOS; prepare isolated Windows device tooling and official Apple connection prerequisites as needed.
- [x] Prove control using live display, tap/swipe/type/open before calling it available. Use pymobiledevice3 local browser control when supported (documented iOS 27+); otherwise document the limitation and execute phone steps with owner assistance. No automatic OS update or paid tool purchase.
- [x] Register only missing devices and confirm inclusion in the final embedded Ad Hoc profile. Build Ad Hoc first, monitor to terminal state, inspect/download/hash, install via supported USB tooling or EAS Safari link, and launch without Metro.
- [ ] Test every user-requested acceptance path with fictional data and Pass/Fail/Not Tested, tied to build/source/device/iOS. Stop mirroring for microphone tests where it interferes; user performs Face ID and protected prompts.
- [ ] Fix evidenced failures and requalify; build App Store Distribution from the same final source. No auto-submit. Record separate build numbers/signing differences and Windows verification limits.

### Task 5: Prepare review assets and handoff

**Interfaces:** Accepted real-device release -> actual iOS screenshots, dedicated reviewer instructions and final source/artifact/compliance status.

- [ ] Capture actual iPhone 17 screenshots with fictional data and accepted dimensions; document any additional required size not available.
- [ ] Prepare a dedicated in-app review account and tested normal login instructions; request missing account authorization/credentials when needed, never use the owner's personal account or add an auth bypass.
- [ ] Review the whole change, run applicable final checks and complete candidate secret scan, commit and push iOS to ratibi. Preserve Android and D WIP.
- [ ] Update the source handoff and superseded readiness plan. Deliver artifact hashes, signing/source versions, direct-vs-assisted device evidence, review assets, compliance proposals and exact remaining pre-upload gates.

## Execution status

See private ledger E:/Masarifi-ios-artifacts/ios-store-20261115/progress.md. Pending owner/device/account steps never count as completed or accepted.

Current application candidate: `08e197d63f1e99f5041a0c0f461746208bea6c5f`, iOS 1.0.0. Ad Hoc build 5 failed physical Home acceptance; build 6 contains the reproduced Hermes fixes and opens Home/More stably. Logout, Google cancellation and owner-assisted dedicated Google login have been observed; broader fictional-data checks are in progress. Matching Store build 7 finished, was downloaded and inspected; both IPAs have byte-identical JavaScript bundles, assets and privacy manifests, and their Info.plist differs only in build number. CI is successful; final mobile suite 630 suites / 5,283 tests passes. Export/privacy/revocation/security gates remain explicit in the compliance audit. No Apple upload has occurred.

Further Task 4 finding: the iOS amount editor clips a leading digit because of its estimated character width. The ar/en regression was RED, and 121/121 form tests passed after an iOS-only native-sizing fix. Replacement builds and physical acceptance are required; builds 6/7 remain retained historical artifacts. No ambiguous income was saved. The next complete suite is running, without test skips or timeout changes.
