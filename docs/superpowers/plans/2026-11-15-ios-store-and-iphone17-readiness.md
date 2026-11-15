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

Latest built application source: `5b5d3c7976c0d6351ae895012bbf43b847260aff`, iOS1.0.0, Ad Hoc10 and Store11. Both finished, were downloaded and inspected. Their JavaScript bundles, assets and privacy manifests are byte-identical; Info.plist differs only in build number. Windows CMS verification does not prove certificate-chain trust, Mac codesign or Apple processing. The full local suite passed631 suites /5308 tests with natural exit and no force-exit, skips or timeout changes; CI43759318384 completed successfully. Doctor remains19/20. See `docs/handoffs/2026-11-16-ios-signed-candidate-10-11-ar.md` for hashes and current limits.

Build 8 physically passed the leading-digit fix: all 50000 draft digits are visible, then a reviewed fictional salary 5000 saved once. A 100 transfer preserved the total 7672.43 and produced balances A5865/B100. Google session and QA data survived the USB upgrade. No ambiguous 50000 income was saved.

Owner steering required collecting and fixing the text/UI issues as one batch before further builds; all known fixes were committed and fully qualified before requesting10/11. The batch resolves Arabic paragraph/heading alignment, voice disclosure width, currency/date/picker labels, the outgoing-transfer sign within iOS account details, and the Arabic PDF action covering expense digits. It also uses a neutral iOS Budgets link when the live report omits budget data, preserving authoritative metrics and Android behavior. Final local qualification passed631 suites /5308 tests in589.118 seconds with natural exit0 after an open-handles warning. TypeScript and scoped lint pass, retaining four pre-existing warnings. Source publication and the matching replacement artifacts are complete. Native retest remains pending: USB update10 completed00:27:15 without uninstall/reset, device lookup confirms1.0.0/10, and cold launch reached a protected Face ID prompt requiring the owner. Do not transfer build8 acceptance to10 without verification.

Additional build 8 checks passed: a fictional budget of 300 with Shopping allocation showed spending 35 and remaining 265. An offline expense draft of 10 survived an uncertain-result response; restoring cellular data and retrying the same operation produced one expense, with A5855/B100. Automatic offline completion is not established. Export/privacy/revocation/security gates remain explicit in the compliance audit. No Apple upload has occurred.

Later build8 owner-assisted checks passed: voice saved expenses5 and25 and income500, givingA6325/B100/total8132.43. One explicitly authorized QA A November2026 PDF arrived and its scope/values were confirmed by the owner. Device authentication shielded data on background return; owner Face ID restored the app. Native Apple login and cold-session persistence passed, followed by Google QA data restoration without cross-owner records. Apple cancellation overlapped owner approval, so it remains unverified, as does Hide My Email. One approved assistant question remains unsent while build10 awaits protected authentication. Final images, independent reviewer access and comprehensive accessibility remain open.
