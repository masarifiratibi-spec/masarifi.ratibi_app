# iPhone Ad Hoc preparation — 2026-11-06

Status: preparation in progress; no signed IPA or iPhone device acceptance yet.

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

The E volume is exFAT and rejects local dependency symlinks. Use
`npm ci --install-links --cache E:\Masarifi-ios-artifacts\npm-cache` in the mobile
directory to install local file dependencies as packed copies. The tracked lockfile
and Android dependency versions stay unchanged. Reinstall after changing a local
package if the installed packed copy must be refreshed.

## Build and runtime decisions

`ios-ad-hoc` extends production, uses internal distribution, no development client
and no simulator. The application keeps `com.masarifi.mobile`, `masarifi` scheme,
the existing EAS project, production API and retained Clerk identity. Supply the
approved release version using `MASARIFI_RELEASE_VERSION_NAME` (current customer
version is `1.0.0`); EAS maintains/increments iOS build numbers independently.

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

- Configuration tests: 30 passing, including iOS acceptance, wrong platform,
  bundle/project rejection, production safeguards, approved version, unchanged
  Android configuration and staging/benchmark regressions.
- Focused runtime regressions: 5 suites / 166 tests passed, including unavailable
  native capture on iOS and existing Android ownership/background behavior.
- Expo introspection and production iOS JS/assets export passed. Source-map audit:
  2,099 sources, 13 production entry points, no fixture/development routes or
  explicit Android tracking entry point. This is not a native IPA build.
- Lint passed with zero errors and 94 inherited warnings. Initial typecheck and
  one full-suite test exposed missing sibling API dependencies in the fresh
  worktree (`@nestjs/common` imported by the offline-creation contract test).
  Installing locked API dependencies locally with lifecycle scripts disabled;
  full-suite completion and typecheck rerun remain pending. No backend was run.
- Full private logs/artifacts live in `E:\Masarifi-ios-artifacts`, not in Git.

## Before building the signed IPA

1. Confirm membership activation and access to the intended Apple team.
2. Confirm the final Android source checkpoint with its chat; integrate it into
   `iOS` and run the tests for affected behavior before selecting the iOS candidate.
3. From `E:\Masarifi-iOS\apps\mobile`, authenticate to the existing Expo account.
   Keep production environment bindings unchanged; do not create another Clerk
   instance or substitute a staging API. Set the approved release version in the
   production EAS environment if not already configured; inspect names/visibility
   without printing private values. No credentials belong in Git or public vars.
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

References: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/),
[Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment/).
