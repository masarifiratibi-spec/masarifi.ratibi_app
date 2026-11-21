# Native App Lock continuation — 29 October 2026

The permanent App Lock source change is implemented and the identified DEV slice is verified on Xiaomi. **Native release acceptance remains pending; full T06 remains BLOCKED.** T04 and T05 retain their accepted historical scopes, and the prior refund cancellation repair remains accepted. T07 and its dependency chain have not started.

## Implemented product decision

The user's explicit attachment (SHA-256 9f734842b32247434626f8aaef3eb1fdf19db357c8ebcea432f981b52bb2d355) supersedes the custom Masarifi PIN requirement. The existing simplified strategy now records that decision and separates historical T02 evidence from the new native requirements. The immutable original plan and its 62/69/88/29 denominators remain unchanged.

Custom PIN creation/change/reset/unlock UI, validation/KDF APIs and the PIN-only native module source are removed: 16 obsolete source/test/module files retired, 14 obsolete named test cases and two deleted-route table entries removed with preserved before-images. Existing Clerk OTP/sign-in code and shared encryption/crypto dependencies remain. The previously installed DEV APK still contains its old unused native bytes; no replacement APK was installed.

Optional release App Lock uses the existing Expo LocalAuthentication service with Android device-credential fallback enabled and strong biometric policy. Native unlock, enable/disable settings, foreground masking and duration behavior reuse existing UI and owner/session guards. A native result cannot unlock another owner or apply a stale preference callback. Cancellation/failure remains retryable and locked. A legacy-enabled lock with unavailable OS credentials remains protected; normal private Android security setup is a human prerequisite, never an automatic opt-out.

Prompt suppression requires every DEV condition: actual DEV execution, development NODE_ENV, live mode and the exact native package/API/variant pair. Release or mismatched identities keep enforcement regardless of copied public opt-out values. DEV derives an unlocked in-memory optional-lock state without persisting it; Clerk and financial authentication are unchanged.

Owner-scoped native preferences use a new versioned key. Compatibility reads legacy metadata/secret presence without validating, rewriting or deleting those secrets. Malformed settings fail closed. Existing database keys/encryption and explicit account-erasure semantics remain. No device data migration, purge or credential reset occurred.

## Verification and corrections

| Evidence | Result and scope |
|---|---|
| Affected automated checks | 22 suites / 372 cases PASS; final discovery/security follow-up 2 suites / 11 cases PASS. Nine are reruns: 374 cases across 23 suites, zero failed/skipped in the final applicable results. Parameterized cases are counted separately even where their names match. |
| Release/runtime gates | 12 existing Node checks PASS; copied DEV flags cannot disable release enforcement. |
| Typecheck and lint | Final TypeScript exit0; lint exit0, zero errors. Initial 35 changed files have20 warnings in inherited test require/import layouts; the final two-file follow-up has0 warnings. Matching statements are preserved in before-images. |
| Existing app-shell boundary | PASS,1204 files. Final Git whitespace check exit0. |
| Native release compilation | Existing guard-permitted Kotlin/Java compilation, release manifest and Hermes bundle PASS. Generated DEBUG=false. Current source map matches all14 changed production TypeScript sources after LF normalization. LocalAuthentication is registered; the retired PIN module and retired PIN JS sources are absent from generated registrations/bundle sources. |
| Signed standalone APK | NOT_PRODUCED. The existing upload-signing guard rejected packaging because approved signing credentials were unavailable. No bypass, new signer, native install or app-data reset. Original debug APK SHA stays5aa443428e94789d870b3d9514459091a6c94071529bd00c61da5dbfbfd011bf. |

Real regressions found and corrected during this work: a DEV cache still marked locked blocked the unchanged local financial owner guard; late lock/settings callbacks could affect a replacement session; pending-notification admission required a verified unlock; exact DEV package/variant pairing needed enforcement; the rewritten unlock route initially broke optional-screen lazy discovery. Relevant RED failures preceded corrections. Obsolete fixtures were adapted without weakening financial or owner assertions. Failed build attempts, intermediate phone reload failures and diagnosis remain preserved.

Review is Sol's security/code/test **self-review**, supported separately by Jest/TypeScript/ESLint/Gradle outputs, source-map checks, Android UI and SELECT-only evidence. It is not an independent model review or effective CI run. Higher-risk native/release acceptance remains open.

## Actual Xiaomi results

On the existing Xiaomi23076RN8DY /Android15, com.masarifi.mobile.dev PID24113, normal development startup reached Home without custom PIN or OS App Lock prompts. Arabic and English Security Settings show the DEV notice with no custom PIN controls; ordinary Home/More/Transactions navigation and background return pass in both languages. Screenshots were personally inspected. No financial Save/refund/payment, capture, logout, deletion or consent operation was performed.

The intermediate development reload initially loaded inconsistent source and then a blank host. Recovery used the existing development launcher's recently opened loopback server, without clearing data, replacing the app or starting a new Metro process. The later DEV cache-state correction restored the original cached balance. The read-only Debugger channel remained unresponsive: the current loaded bundle byte hash is **UNVERIFIED**. DEV evidence uses the existing sole Metro/source identity, normal host navigation, new visible DEV labels and observed behavior. This does not qualify installed native or standalone bytes.

At2026-10-28T23:25:25.803Z the phone was restored to Arabic /Home /All Accounts /October2026, Wi-Fi0/mobileData0/airplane0. One exact original draft and the same12applied operations remain; pending mutations, Voice journal, unfinished/audio Voice work and SMS queue are0. Native capture/notification/SMS producers remain disabled and queues safe. All owned SQLite/Debugger observers are closed. Metro25284/32992 and USB reverse8081 remain.

- Original full draft SHA-256: cfcbf7b9a5564853400a2704d86a67f589edcde445ac54da54ef4d77d1600d20.
- Sorted sync operation IDs joined with commas SHA-256: e1800b313d30d84783a80abf6c298669d3a89d1d627730322a263ad4c126c6d5.

Fresh sign-in, actual logout, new online API verification and native fingerprint/device-PIN success/cancellation on a release artifact are NOT_RUN in this slice. Existing T04 online/API/integrity results retain their historical scope; they were not replayed. Automated Clerk/session/logout regressions pass, including refusal to supply remote credentials for cached-only access. No physical or release criterion is inferred from mocks.

## Remaining boundaries and exact next steps

1. Use the existing approved signing path to produce a suitable artifact. Before any install, bind its hash, package, environment and existing signer, and establish a compatible data-preserving install procedure. Do not debug-sign a release, uninstall the current DEV app, clear its data or invent a new environment/key. No reviewable installation approval packet exists until that compatible artifact is available.
2. With that artifact and the user present, verify actual Android fingerprint/device-credential fallback, cancellation/retry and background return using the normal private OS prompt. The agent must never enter/read device credentials or simulate success. Qualify fresh sign-in/logout only through a separately safe journey that preserves the current account/draft.
3. Keep the explicit Security Events KEEP_GATE decision. It blocks the live owner-events acceptance criterion; no request was repeated, hidden feature activated or criterion waived. Full T06 cannot pass, so T07 and all subsequent dependent tasks are ineligible. Remaining original conditional route coverage stays explicit. There is no further confirmed defect or independent task with satisfied prerequisites available in the current safe offline scope.

No Production, Staging deployment, server/database/worker configuration, financial record or unrelated service changed. No Git stage/commit/push/merge, new worktree/environment, delegation or automation was performed. Owned PostgreSQL fixtures remain stopped. The original217-entry inventory,282R18 artifacts and earlier72/66-file seals are checked with explicit authorized App Lock deltas and no unexpected change.

Current plan: [implementation and acceptance overlay](../../../../superpowers/plans/2026-10-29-native-app-lock.md). Current continuation: [native App Lock handoff](../../../../handoffs/T06-native-app-lock-checkpoint-2026-10-29.md). Private evidence: .superpowers/sdd/2026-10-29-native-app-lock, including FINAL.json, verification-summary.json, source-delta-manifest.json, native-current-artifacts.json and final-phone.json. Historical reports and seals remain preserved.

Android fallback API reference: [official Expo55 LocalAuthentication documentation](https://docs.expo.dev/versions/v55.0.0/sdk/local-authentication/). Native hardware conclusions remain pending regardless of documented capability.
