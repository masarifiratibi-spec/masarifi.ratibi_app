# iOS store compliance evidence — 15 November 2026

This is a preparation record. It does not authorize Apple uploads, privacy publication, submission, agreements, or changes to the VPS. Build and physical-device results belong in the final artifact/acceptance handoff. Private evidence is under `E:/Masarifi-ios-artifacts/ios-store-20261115`, outside Git.

## Login and guideline 4.8

- The app uses Google for personal accounts; no applicable exception to the equivalent-login requirement was established. Native Sign in with Apple was added beside Google on iOS. Android retains its existing Google UI and profiles.
- Both iOS release profiles enable the Apple entitlement through the Expo 55 plugin and the installed Clerk Apple hook. A successful flow explicitly activates the returned session and records its method for that session/owner. Local cancellation, failure, availability, owner isolation and restoration tests pass.
- With the owner's explicit free-setup authorization, the existing App ID capability, a dedicated Services ID/key, the production Clerk connection and exact native iOS registration were configured. Clerk remains Hobby; no paid minimum-version control was enabled. Existing Google and APNs credentials were retained. The Clerk email source for Apple's relay was registered and its rendered SPF indicator verified.
- Dashboard activation is configuration evidence. Native authorization, Hide My Email, cancellation and session persistence still require the new IPA on the physical iPhone. No TestFlight or App Store processing has been tested.

Sources: [Apple review guidelines, 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services), [Clerk native Apple guide](https://clerk.com/docs/expo/guides/configure/auth-strategies/sign-in-with-apple), [Clerk Apple configuration](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/apple).

## Account deletion: a remaining Apple-specific gate

- The existing application deletion workflow and recovery receipts remain intact. An iOS presentation defect was reproduced and fixed using one native Modal host across error, Continue/Retry and progress; Android's two-host behavior is retained. Tests use fixtures, never deletion of the owner's account.
- Deleting the Clerk identity is not evidence that Apple's authorization was revoked. The installed Clerk Expo 4.6.5 native hook forwards the identity token and permitted name; its reviewed implementation does not forward Apple's authorization code. Automatic Apple token revocation by the deployed backend/Clerk has not been established.
- Before review submission, establish and test the provider's revocation behavior using a disposable dedicated account. If it is absent, prepare a separately approved VPS change to exchange/store the authorization code securely and revoke the resulting token during deletion, including retry/recovery. Do not store the Apple private key in the mobile app. Apple's documented manual-revocation fallback also needs an explicit user flow and credential-revocation handling; it has not been implemented or accepted here.

Sources: [Apple account-deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple).

## Encryption and export-compliance proposal

- Source config enables `expo-sqlite` SQLCipher; the database service verifies the cipher and stores owner database keys through secure storage. This is application-supplied cryptography in addition to platform TLS, Keychain and device authentication. The final IPA's linked libraries and settings must still be inspected.
- Do not answer "OS encryption only" or assume exemption merely because TLS is used. No `ITSAppUsesNonExemptEncryption=false` declaration was added. Keep the classification unresolved for owner review, with the actual SQLCipher version/algorithms, use and distribution countries documented from the build.
- EAS CLI 24.4.2 can build non-interactively without this flag and warns that App Store Connect requires a later encryption answer. Use that path without making an unreviewed exemption declaration. A signed IPA is separate from export-compliance clearance.

Source: [Apple encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations).

## Privacy, required-reason APIs and AI consent

- Source inventory found 15 SDK privacy manifests covering UserDefaults, file timestamps, disk space and system boot time. React Native/Expo/AsyncStorage include their own reasons. This is a source inventory, not proof of the final aggregated application manifest or all linked SDKs. Inspect every bundled `PrivacyInfo.xcprivacy` in the final IPA and reconcile actual required-reason API use; do not invent declarations for missing evidence.
- iOS voice consent now visibly states recording/financial-context processing by external AI, its purpose and optional nature, with a privacy link before microphone access. iOS uses a new acknowledgement version; Android keeps its prior copy/version. Refusal, withdrawal, persistence failure and owner changes are covered locally. Microphone acceptance must run without screen mirroring, which can interfere with recording.
- An iOS-only privacy appendix discloses Apple/Clerk identifiers, shared name/email, Hide My Email relay and Apple authorization management. Shared Android and public-web JSON documents are unchanged; corresponding public-policy changes are proposed for a separately authorized publishing step.
- The existing privacy text identifies Clerk, Google, Hostinger, OpenRouter/model providers and Expo. Local AI gateway code is not proof of deployed provider/model routing, retention, locations or logging. Runtime confirmation was requested from the Android/backend owner. Restricted-routing request parameters do not prove provider retention or training practices.
- The eight App Store privacy data types remain a saved, unpublished draft. Reconcile login/contact/user identifiers, financial content, audio/transcripts, assistant prompts/context, diagnostics, push/device identifiers, support and reports against actual accepted behavior and provider practices before publication. DSA and accessibility declarations remain unconfirmed. No advertising-tracking exemption, data-sale claim, retention duration or localization guarantee is inferred from app settings.

Sources: [Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files), [required-reason API declarations](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [App privacy details](https://developer.apple.com/app-store/app-privacy-details/), [review guidelines, privacy](https://developer.apple.com/app-store/review/guidelines/#privacy).

## Verified local scope

- Complete mobile Jest suite: 630/630 suites, 5258/5258 tests; no skips or timeout increases introduced.
- Focused auth regression: 266 tests; privacy/deletion/voice: 71 tests; legal: 10 tests; profile/runtime/production-entrypoint Node tests: 35 tests. Focused counts overlap the complete suite.
- TypeScript and scoped ESLint passed. Complete candidate secret scan, production bundle inspection, final signing/IPA inspection, physical acceptance and final source review are separate gates recorded in the release handoff when executed.
- App Store record/version, sixteen-country availability, free download, manual release, unpublished privacy draft and deferred subscriptions remain unchanged. No Apple build upload, server deployment, OTA or agreement acceptance occurred.
