# iPhone Ad Hoc preparation — 2026-11-06

Status: source preparation verified; Apple signing/device registration still
requires completion. No signed IPA or iPhone device acceptance yet.

## Source and coordination

- iOS worktree: `E:\Masarifi-iOS`, branch `iOS`.
- Initial Android source: `12ee32ed129d9ff6695860ddf59e8b002bfea71b` on
  `codex/voice-promoted-operating-2026-10-13`.
- Android chat confirmed that baseline and owns the ongoing report performance
  change. Its worktree, source edits, evidence, phone, sessions and services remain
  under its control. No files or installed Android application were changed here.
- Changes from Android are incorporated only after their owner commits them;
  integration is explicit, not an automatic chat or Git synchronization.
- Integrated the report loading improvement `7ee42065` by fast-forward merge.
  It preserves controls/cards while financial reads are loading.
- Integrated `88d7c5cf81a52874c6efd5a3f1bb93b61e1f0639`: the Android owner's
  SMS preparation/observation improvement and authoritative-permission test
  update. Current combined implementation checkpoint is `513ebac3`.
- The Android owner retains ownership of subsequent UI/loading improvements and
  the original branch. Fetch/review/merge those committed changes before choosing
  a signed iOS release candidate; do not move or edit their worktree.

## Apple and Expo access

Membership was verified in the user's signed-in Chrome session on 2026-11-06:
Apple Developer Program, Individual, renewal November 6, 2027. Certificates,
identifiers, profiles and device management are accessible. No devices were
registered at inspection. No App Store app record is needed for this Ad Hoc flow.

The existing EAS CLI session has owner access to the `masarifiratibi` Expo account.
Apple login in Chrome does not authenticate the separate EAS Apple session.
`eas device:create` reached the Apple password prompt and was cancelled without
entering credentials. An interactive local registration console was opened for
the user; no password or verification-code entry is recorded by this task.
The working registration console uses the installed CLI by absolute path and a
metadata-only helper project in `E:\Masarifi-ios-artifacts\device-registration`,
so it does not depend on partially installed mobile plugins. Interactive stdin
was verified. The user must report its final message/link, not credentials.

The E volume is exFAT and rejects local dependency symlinks. Use
`npm ci --install-links --cache E:\Masarifi-ios-artifacts\npm-cache` in the mobile
directory to install local file dependencies as packed copies. The tracked lockfile
and Android dependency versions stay unchanged. Reinstall after changing a local
package if the installed packed copy must be refreshed.

## Build and runtime decisions

`ios-ad-hoc` extends production, uses internal distribution, no development client
and no simulator. The application keeps `com.masarifi.mobile`, `masarifi` scheme,
the existing EAS project, production API and retained Clerk identity. The iOS
profile pins the approved version `1.0.0` through `MASARIFI_RELEASE_VERSION_NAME`;
update that profile value when a later release version is approved. EAS maintains
and increments iOS build numbers independently.

EAS production project/account variable inspection found no required bindings.
Only the iOS profile therefore supplies the existing public API origin, retained
Clerk publishable key/domain and approved release version. The publishable key is
client configuration, not a server credential. No shared EAS environment or
Android build profile was modified. `MASARIFI_IOS_AD_HOC=true` lets local EAS
configuration resolve version `1.0.0` before the worker-only profile variable
exists; conflicting Android or other-profile markers are rejected.

The profile is rejected for Android. Existing production safeguards remain:
approved origin and Clerk binding, correct identities, app lock enabled, demo and
diagnostics disabled. Production provider selection recognizes the iOS profile.

Shared tracking imports resolve by platform. Android keeps its existing wrapper.
The generic implementation uses the same optional native lookup: on iOS, where
the SMS module is not registered, it yields null. Manual/voice capture remains the
supported iPhone path; this is not SMS or other-app notification access.

Existing Google callback is `masarifi://sso-callback`. Existing secure storage,
SQLCipher, microphone/Face ID usage descriptions and Expo push registration are
retained. Native credentials, Google callback success, audio input, biometrics,
database encryption behavior and push delivery still require device verification.
The active PDF flow sends reports by email; the unused Android file-export helper
is not a reason to introduce new iPhone UI or storage behavior.

## Verification evidence

- Configuration tests: 34 passing, including iOS acceptance, wrong platform,
  bundle/project rejection, production safeguards, approved version, unchanged
  Android configuration and staging/benchmark regressions. The actual EAS CLI
  resolves internal distribution, no development client, physical devices,
  production environment, version `1.0.0` and bundle `com.masarifi.mobile`.
- Full mobile suite on the combined `88d7c5cf` source: 613 suites / 4,952 tests
  passed at the unchanged default timeout. An earlier concurrent run timed out
  one TransactionForm case; that file then passed all 117 tests unchanged and the
  full rerun passed. Jest emitted a worker teardown warning; all assertions passed
  and the command exited zero. This does not qualify device performance.
- Focused runtime regressions: 5 suites / 166 tests passed, including unavailable
  native capture on iOS and existing Android ownership/background behavior.
- Expo introspection and production iOS JS/assets export passed. Source-map audit:
  2,099 sources, 13 production entry points, no fixture/development routes or
  explicit Android tracking entry point. This is not a native IPA build.
- Typecheck passed. Lint passed with zero errors and 94 existing warnings; the
  changed build/configuration files also passed targeted lint.
- The fresh-worktree validation environment required locked API dependencies for
  the offline-creation contract test (`@nestjs/common`); they were installed with
  lifecycle scripts disabled. The unchanged canonical Android manifest was copied
  into the ignored native directory for its existing privacy-config regression,
  with matching SHA256. No new Android native build or backend was run.
- The old offline tracking snapshot test failed identically in both worktrees;
  its Android owner updated it in `88d7c5cf`. No Android UI repair was made here.
- Independent review found one inherited pre-install entry-point bug: manually
  assembling a file URL skipped validation on POSIX and URL-sensitive paths.
  `pathToFileURL` now makes the actual CLI execute the validator. A real CLI test
  from a `#` path reproduced the bypass before the fix and rejection afterward.
- Full private logs/artifacts live in `E:\Masarifi-ios-artifacts`, not in Git.

## Before building the signed IPA

1. Membership activation was confirmed. Complete Apple signing authentication
   and select the same intended team; a Chrome session is not an EAS Apple login.
2. Confirm the final Android source checkpoint with its chat; integrate it into
   `iOS` and run the tests for affected behavior before selecting the iOS candidate.
3. From `E:\Masarifi-iOS\apps\mobile`, authenticate to the existing Expo account.
   Keep production environment bindings unchanged; do not create another Clerk
   instance or substitute a staging API. The iOS profile already supplies the
   approved public bindings/version; do not change the shared Android environment.
   No signing credentials belong in Git or public variables.
4. Register owner/client phones using `eas device:create`; check the correct team
   and that both UDIDs are included in the provisioning profile. Provision the
   distribution certificate/profile and the existing app's APNs credential.
5. Run `eas build --platform ios --profile ios-ad-hoc`. This is a cloud build from
   Windows; do not use `expo run:ios` or a simulator as proof of device readiness.
   Newly added devices require updated provisioning and a rebuilt/re-signed app.
6. Install on the owner's iPhone first. Verify Google sign-in/cancel/return,
   session after restart, account and transaction operations, voice and microphone
   denial/recovery, report email, lock/unlock, notifications and permission denial,
   offline/reconnect and Arabic/English layouts. Use synthetic test entries and
   restore any test preferences; preserve original customer data.
7. Only after acceptance, share the internal installation link with the client
   whose device is included. No App Store publication is part of this preparation.

## Decisions and remaining limits

- The user explicitly selected branch `iOS` and the E path. A manual Git worktree
  was used because the managed creator could not choose that path; the desktop
  app could not attach it as managed. Continue using the explicit E working
  directory. Its common Git storage remains in the original D repository.
- E's filesystem requires packed local dependencies. Reinstall after changing a
  local package; no dependency version, native-script approval or Android runtime
  implementation was changed to accommodate the filesystem.
- Validation artifacts and the manual progress ledger are outside Git on E;
  Windows-native bookkeeping was used instead of the skill's shell helpers.
- Independent review ran on the stable implementation while environment checks
  finished. Its material finding was fixed and tested. Subsequent EAS operational
  preflight fixes have explicit failing/passing regressions and CLI evidence.
- Generated configuration is insufficient evidence for final Release APNs/ATS
  settings, provisioning, SQLCipher, biometrics, voice or Google callback behavior.
  Inspect the signed artifact and test these on iPhone before client acceptance.
- Android source remains independently developed; synchronization and merge-back
  require explicit review. The physical speed of Android candidate 114 was not
  established by this work, and no original phone/session/data was touched.

References: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/),
[Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment/).
