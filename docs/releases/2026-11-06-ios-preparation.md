# iPhone Ad Hoc preparation — 2026-11-06

Status: signed Ad Hoc IPA built and inspected for the registered owner iPhone.
Installation/login and physical-device feature acceptance remain pending.
Repository source `48791e6d` is synchronized through published review `f61d5160`.
The mobile tree remains `ab154ebc`; existing IPA2 still contains `2dd23b5b`.
Android122 execution documents are synchronized; their physical results do not
establish iPhone acceptance.

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
  update. That earlier combined implementation checkpoint was `513ebac3`.
- The Android owner retains ownership of subsequent UI/loading improvements and
  the original branch. Fetch/review/merge those committed changes before choosing
  a signed iOS release candidate; do not move or edit their worktree.

## Latest shared UI synchronization

- Published application source `10ad1d74c7dcd1f0f980a870ca1d0fc0007ad615` was
  verified and fast-forwarded into `iOS`. It includes `ad08cca6` for early page
  rendering in 15 production components, `21f6836` merging the reviewed iOS
  preparation, and the corrected Home test expectations in `10ad1d74`.
- Published `526221f24ac41d2aa11bd779675eb6606c3ec0a9` was then incorporated.
  Everything after `10ad1d74` in this incoming range is documentation/receipts;
  no application code changed and those documents did not trigger repeated code
  tests. Android115's package is reviewed separately by its owning chat.
- The Android source qualification is **composite**: the first full run retained
  611 successful complete suites / 4,943 cases, with six obsolete assertions in
  two other suites. Both corrected suites were rerun in full: 25 passing cases.
  Together this covers 4,968 cases / 613 suites. The original failure and runner
  open-handle evidence remain retained; this is not one green full-run command.
  See [the source audit](2026-11-06-first-read-ui-audit.md).
- Local E-worktree compatibility verification after integration passed:
  16 affected UI/iOS suites / 227 cases, 34 configuration cases, typecheck and
  lint (0 errors / 94 existing warnings). The selected test run warned about
  asynchronous teardown but exited zero without forcing exit, extending
  timeouts or skipping cases. These overlapping runs are not extra unique cases
  to add to the source's 4,968.
- iOS configuration introspection and the production JS/assets export/audit
  passed on this application source: 2,099 sources, 13 production entry points,
  no development/fixture routes and no explicit Android tracking entry point.
  No original D-worktree files, services, data, session or phone were changed.
- Signed IPA/device-registration results are recorded below; physical iPhone
  acceptance remains open. Android115
  was not installed by this task, and no new physical SMS speed result is claimed.

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
- Frontend-quality secrets scan passed. The Android owner's strict Gitleaks
  8.24.3 policy reported one raw `generic-api-key` finding in `eas.json`, introduced
  by `0389dff3`: the intentional `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Its SHA256
  matches the existing retained-identity guard. This is a publishable client key;
  [Clerk documents that it is safe to expose and commit](https://clerk.com/docs/guides/secure/rotate-api-keys).
  The raw strict scan is **not zero**; the public-configuration classification was
  sent to the Android owner for review before merge. No scanner policy, ignore
  list, credential or published history was changed to conceal the finding.
  Classification agreed with that owner: `rawExitCode=2`, `rawFindings=1`,
  `classifiedPublicClientConfig=1`, `unexpectedSecretFindings=0`. The single
  historical value and current value were independently checked locally against
  the existing retained frontend binding; the owner will also verify before merge.
  This classification does not apply automatically to any other finding.
  Metadata only:

  - Path: `apps/mobile/eas.json`
  - Rule: `generic-api-key`
  - Commit: `0389dff3936211b968c1128471cc313af3b2aef2`
  - SHA256: `b23652e5532792769747186f24295dadd41fcc330abe12da3186951e0f084475`

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
- Signed-artifact inspection below verifies APNs/ATS/provisioning metadata.
  SQLCipher, biometrics, voice, notification delivery and Google callbacks still
  require iPhone runtime testing before client acceptance.
- Android source remains independently developed; synchronization and merge-back
  require explicit review. The physical speed of Android candidate 114 was not
  established by this work, and no original phone/session/data was touched.

References: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/),
[Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment/).

## Native signing and first cloud build — 2026-11-06

- Apple authentication completed in the user's local console. The installed
  global EAS 21.5 hit `iTunes service key is empty`; isolated EAS 24.4.2 on E
  includes the [Expo maintainer's fix](https://github.com/expo/eas-cli/issues/4394).
  Global tooling and the Android worktree were unchanged. The observer records
  status and redacted error output only, never authentication input.
- One owner iPhone is registered. EAS created a distribution certificate, an
  active Ad Hoc provisioning profile including that device, and the app's APNs
  key. Credentials remain in Apple/EAS; none were exported into Git. A client's
  device still needs enrollment and inclusion before client installation.
- Source `c14bebbc` includes documentation-only Android delivery updates;
  shared application source remains `10ad1d74`. Build
  `7ac16c82-03eb-4ed8-9786-ad0ed93f303f` (1.0.0/build 1) uploaded successfully
  but failed during CocoaPods post-install, before native compilation.
- Root cause: the installed Clerk native pod requires iOS 17, while the missing
  Clerk config plugin left the lower React Native deployment target. Expo
  autolinking excludes the incompatible pod, but evaluating its podspec already
  registers its Swift package dependencies; RN's SPM hook then receives no target.
  The fix adds the installed official `@clerk/expo` plugin only to the isolated
  iPhone profile, with no new native Apple sign-in feature. It raises the native
  target to **iOS 17 or later**. No dependency, RN script, SQLCipher setting or
  Android build configuration was changed.
- A regression executed the real registered vendor iOS mod against Podfile
  properties: before the fix it retained 15.1; after the fix it writes 17.0 while
  retaining SQLCipher. It also compares the complete normal Android release
  configuration. All 27 selected configuration/provider/Firebase tests pass;
  changed-file lint and formatting pass. Actual Expo introspection confirms
  Clerk 4.6.5 native metadata and the retained bundle/version, without adding an
  Apple sign-in entitlement. Full local iOS prebuild is unavailable on Windows;
  the subsequent cloud build below verifies Pods and compilation. Physical-device
  acceptance remains required.
- The first cloud doctor's advisory reports four newer Expo patch versions.
  It did not cause the fatal SPM error. Versions and validation policy remain
  unchanged; the warning is retained, not suppressed.
- The existing encryption declaration remains unspecified. SQLCipher is embedded,
  so no unsupported exemption assertion was made. The noninteractive Ad Hoc build
  path retains current settings; Store export classification is outside this
  no-Store delivery. Physical iPhone acceptance remains pending.

Clerk's [native configuration guidance](https://clerk.com/articles/clerk-compatibility-in-expo-54-and-55-2)
documents the iOS 17 requirement and official plugin.

## Signed IPA result

- [EAS build e48bc3f4-220a-45db-a0ef-e9b405acdf7a](https://expo.dev/accounts/masarifiratibi/projects/masarifiratibi/builds/e48bc3f4-220a-45db-a0ef-e9b405acdf7a)
  finished successfully from `2dd23b5bee72a95a4a56431ec106d9682e539353`:
  **1.0.0 / build 2**, physical iPhone ARM64, internal Ad Hoc distribution.
  The official Clerk configuration fixed the first attempt's Pods failure;
  Pods, JS bundling, Xcode archive/export and artifact upload completed.
- Downloaded IPA: `E:\Masarifi-ios-artifacts\Masarifi-1.0.0-build2.ipa`,
  26,680,429 bytes. SHA256:
  `3ba88fdb01b89cb8c60d92401fc41d83638c66297f023a34a58303e9ea052319`.
- ZIP metadata, main ARM64 Mach-O and its signed XML entitlements were inspected.
  Bundle `com.masarifi.mobile`, retained team, version/build, iOS minimum 17.0,
  microphone/Face ID permission descriptions and owner-device inclusion match.
  `get-task-allow` is false in app/profile; APNs is `production` in both;
  arbitrary ATS transport loads are not enabled.
- The embedded provisioning profile's CMS signature was verified using Windows
  SignedCms. This did not independently validate the Apple certificate chain or
  perform full macOS `codesign --verify` over the application/resource graph.
  The artifact inspection is not a physical runtime acceptance test.
- Exactly one registered owner iPhone is included. The installation link was
  given to the user for Safari installation and first login/data verification.
  Client devices require enrollment and updated provisioning/re-signing before
  they can install this app. No App Store record/submission was created.
- Remaining acceptance: installation, existing-account sign-in and restart,
  account/transaction operations, reports by email, voice, lock, permissions,
  notifications, offline/reconnect and layout checks on the actual iPhone.
  Android bank-SMS tracking remains outside iOS scope. No customer-ready runtime
  acceptance is claimed until those checks complete.

## Subsequent source synchronization — IPA2 unchanged

- Verified the published Android branch at
  `351a647741a355773e9302dbc1fb4706dd64211f` and fast-forwarded the separate E
  checkout to that exact clean head. Application source is
  `a970978d2617d578dbee14a4562164790ae8b8d3`; `a970..351` contains only review,
  handoff and Android117 preparation documents. Original D files/phone were not
  changed, and uncommitted work was not copied.
- This includes the qualified Categories/Salary/Obligations responsiveness work
  and the earlier scoped Tracking actor preparation. The source owner's
  [UI qualification](2026-11-06-stable-finance-destinations.md) and
  [Tracking qualification](2026-11-06-tracking-command-preparation.md) remain their
  own evidence; Android117 preparation is not installation or physical acceptance.
- Local iOS compatibility: **93/93 cases across 15/15 selected suites passed**,
  including the affected screens/queries/routes, offline reads and the existing
  iOS tracking-availability regression. The first selected command had one
  five-second ObligationJourney timeout (14 suites / 92 cases passed). Its
  unchanged complete file then passed 24 cases; repeating the entire selected
  command passed 93 cases. Default timeouts, test contents and exit behavior were
  retained; original failure/retry/final logs are preserved. These runs overlap
  the source owner's qualification and earlier tests; do not sum their counts.
- Typecheck and lint over the 12 changed TS/TSX files passed. Actual production
  iOS configuration/JS export audit passed: 2,099 sources, 13 production entry
  points, no forbidden sources and no explicit Android tracking entry point.
  New artifacts live under `E:\Masarifi-ios-artifacts\source-a970`, separately
  from IPA2/native-build evidence. This JS export is diagnostic, not a signed IPA.
- The incoming history `a926..a970` passes the original strict secret policy with
  zero findings. The historical public Clerk-key classification remains
  raw1/public1/unexpected0; no policy or ignore list was changed.
- No iOS native configuration, dependency lock, signing profile or bundle identity
  changed in this incoming range. Rechecked the existing IPA2 SHA256: unchanged.
  Its actual source, device inclusion and pending runtime acceptance remain as
  recorded above. Including the new shared UI changes in an installable iPhone
  artifact requires a later build from the agreed checkpoint; no new IPA was
  produced for this source-only synchronization.

## Home source synchronization — IPA2 unchanged

- Verified published Home source
  `88df9c8a6f7237840652e386b76d58c06f14ffe6` and fast-forwarded E/iOS without
  conflict. After checks, integrated published review head
  `339e9c43e3f07ac4ce28b03ab907bc0d2fa72b44`; the range after `88df` changes
  documentation only. The Home source changes two components and two tests;
  queries, credentials, native configuration and dependency locks are unchanged.
- Additional local compatibility evidence is **98/98 cases in 7/7 Home suites**
  from one successful command: balance readiness, cached content, Voice progress,
  quick actions, accessibility, screen and route. Types and lint over the four
  changed files passed. No test content, timeout, skip or forced-exit change was
  made in this checkout, and no wider suite was repeated.
- The [source owner's Home qualification](2026-11-06-home-background-reads.md)
  is separate composite evidence: nine real suites / 115 cases passed in an
  overall exit1 command containing a nonexistent CLI path; four further correct
  suites / 17 cases passed separately. Its 132 cases / 13 executed passing
  suites are not described as one green command. The selected local 98 cases
  overlap that evidence and must not be added to it.
- Production iOS introspection/JS export audit passed: 2,099 sources, 13 live
  production entry points, zero forbidden sources and zero explicit Android
  tracking entry points. New diagnostics are isolated in
  `E:\Masarifi-ios-artifacts\source-88df9c8a`. Incoming `c0db..88df` history
  passes the unchanged strict secret policy with zero findings; historical
  raw1/public1/unexpected0 classification is retained.
- IPA2 SHA256 was rechecked and remains identical. No new IPA, Android device
  action or hosted change was performed here. The current installation link and
  physical acceptance boundary still refer to source `2dd23b5b`; the Home update
  is prepared for a later signed iPhone build. Android118 review documents are
  the Android owner's evidence, not iPhone or installation acceptance.

## Startup source synchronization — IPA2 unchanged

- Verified and fast-forwarded qualified source
  `77aa3d2602dc154931949c697e3a767aaa7636ef`, then published review head
  `2bc9dabf66e6d73ec56cd6938e83f519a190f13f`. The latter range changes only
  review/handoff documents. No iOS signing, native dependency, bundle identity,
  package lock or hosted configuration changed.
- The three production changes start the same local hydration flight alongside
  fonts, keep the original SDK/navigation admission below FontGate, retain the
  explicit encrypted-database recovery listener, and defer Home's period sheet
  until first use while retaining it afterward for iOS dismissal.
- Additional E-checkout evidence: **109/109 cases in 8/8 selected suites** passed
  in one command, covering AppShellProvider/store/live-owner admission, privacy,
  bootstrap/protected/root navigation and Home cached content/iOS period behavior.
  Types passed. Lint over the eight changed TSX files returned zero errors and
  the two inherited warnings documented by the source owner. No test content,
  timeout, skip or forced exit was changed here; no wider suite was repeated.
- The [source owner's startup report](2026-11-06-home-startup-path.md) retains
  its genuine RED cases, intermediate harness/path failures and final successful
  215-case / 16-suite command. Its review is self-review. The local 109 cases
  overlap that qualification and must not be summed with it.
- Production iOS introspection/JS export audit passed with 2,099 sources,
  13 production entry points, no forbidden sources and no explicit Android
  tracking entry point. Diagnostics are isolated in
  `E:\Masarifi-ios-artifacts\source-77aa3d26`. Incoming `1ca..77aa` history
  passes the unchanged strict secret policy with zero findings; the historical
  raw1/public1/unexpected0 classification remains intact.
- IPA2 SHA256 was rechecked unchanged. This synchronization produced no IPA and
  no Android-device/hosted action. Android119 review/physical work belongs to its
  owning chat. The millisecond contribution of these changes and overall iPhone
  startup speed are unmeasured. IPA2 remains source `2dd23b5b`; these startup
  changes require a later signed iPhone build and physical acceptance.

## Home cache and Assistant source synchronization — IPA2 unchanged

- Verified published source
  `5edca96223264bcf1063d09cf8b61e150833a7e5`. A normal merge into E/iOS
  preserved the owned iOS report instead of replacing it with the older incoming
  copy. Verified the complete merged `apps`/`packages` tree equals the qualified
  source. After checks, merged published review head
  `83f9c5635337bdc400674a2820af66f6b6f20ff6`; changes after `5ed` are documents
  only. Signing/native/dependency identities are unchanged.
- Seven production files retain saved Home display snapshots through ordinary
  invalidation and hydration races, prioritize them within the existing encrypted
  64-row/byte-limited cache below denial markers, and wait for the first local
  attempt rather than network success. The new disabled-lock cache admission
  requires an explicitly disabled lock and a restored, unexpired session;
  missing/expired/local-only/locked states and logout/owner/denial fences remain.
- Assistant next-draft editing is available during response waiting while the
  existing loading/send/revision guards remain. Formatter/turn memoization does
  not constitute a measured model-latency improvement or a new financial action.
- Additional E verification: **125/125 cases in 11/11 selected suites**, one
  successful command, covering cache races, real SQLite persistence, Home's first
  cover, privacy/protected navigation, Assistant view/composer/journey and draft
  retention. Types and actual lint over all 14 changed TS/TSX files passed.
  No test, timeout, skip or forced-exit change was made here.
- The [source owner's report](2026-11-06-home-cache-assistant-response.md)
  separately records the final 381-case / 25-suite command and its retained
  intermediate failures/updated obsolete editing expectation. This is self-review;
  local 125-case evidence overlaps it and is not an additive count.
- Production iOS config/JS export audit passed: **2,100 sources**, 13 production
  entry points, no forbidden sources and no explicit Android tracking entry point.
  New diagnostics are isolated in `E:\Masarifi-ios-artifacts\source-5edca962`.
  The incoming history passes the unchanged strict secret policy with zero
  findings; the historical raw1/public1/unexpected0 classification remains.
- Rechecked IPA2's SHA256 unchanged. No new IPA, D-worktree/device, hosted change,
  question replay or financial fixture was performed here. Android120 review
  evidence is separate. The current installation link still refers to source
  `2dd23b5b`; these cache/Assistant changes need a later signed iPhone build and
  actual-device acceptance, including cache reuse and real response behavior.

## Verified no-lock cache admission synchronization — IPA2 unchanged

- Verified published source `76b68aba08629ebe448bb0254c9b2ac1fd544996` and
  merged it normally into `iOS` as `db2a16b6`, preserving this report. The complete
  merged `apps`/`packages` tree equals the qualified incoming source. The range
  contains one production conditional, its existing integration test, and release
  evidence; no native, dependency, identity, server or database change was added.
- The new null-lock branch admits the current owner's saved reads only with
  hydration, authenticated/restored SDK state, future non-null expiry, complete
  profile setup and no logout fence. Existing enabled locks still require
  unlocked status. The native parser and its legacy/corrupt-setting behavior are
  unchanged. This resolves a demonstrated source-policy mismatch with protected
  Home admission; it does not establish the actual phone's private lock setting.
- Direct review and two independent, read-only standards/specification reviews
  found no functional defect in the narrow change. The spec review identified one
  documentation overstatement, reported to the source owner: an explicit native
  preference takes precedence over retained legacy credentials; credentials force
  the locked fallback when preference metadata is absent. This report uses that
  qualified contract rather than claiming every retained credential forces lock.
  The source owner corrected the wording in published review head `e540c699`.
- Fresh E verification passed **114/114 cases in 8/8 selected suites** in one
  unchanged confirmation command, covering provider/Home hydration, persistence,
  native lock compatibility, route admission, protected navigation and the first
  Home cover. Types and lint over the two changed TS/TSX files passed without
  changed-file lint warnings. No test, timeout, skip or forced exit was changed.
- Production iOS introspection/JavaScript export and graph audit passed with
  2,100 sources, 13 production entry points, zero forbidden sources and zero
  explicit Android tracking entry points. New diagnostics are isolated in
  `E:\Masarifi-ios-artifacts\source-76b68aba`; this is not a signed IPA.
- Diagnostic failures remain retained: one invocation used the wrong CLI path
  before Jest started; the first correct eight-suite run passed 113 cases and
  failed one 5-second testing-library cleanup hook. That navigation suite mocks
  the changed provider. The exact same command then passed all 114 cases in
  17.290 seconds without source changes; no conclusive cause of the transient
  timeout is claimed. Expo/act/open-handle warnings and the natural exit results
  remain in the private logs. These cases overlap the author's 120/8 source
  checks and earlier qualification and must not be added to those counts.
- Incoming history passes the unchanged strict secret policy with zero findings;
  the historical raw1/public1/unexpected0 classification remains intact.
- IPA2's SHA256 was rechecked unchanged. Its existing installation link still
  targets source `2dd23b5b`; no signed build, phone/server action or repeated
  question was performed by this iOS chat for this synchronization. The historical
  [120 cold-cache observation](2026-11-06-home-cache-assistant-device-check.md)
  remains a failed observation, followed by the source owner's qualified
  [121 cached reopening](2026-11-06-home-verified-cache-device-check.md): the first
  recorded Home frame after the startup cover contained the retained balance and
  activity after a valid real read had populated the cache. That Android check
  passed. Its approximately 4.6-second sampled useful-Home interval is not instant
  startup, zero-jank proof or an SLA. Private lock settings were not inspected.
- Merged published review/observation head
  `e540c6994e237b45989f4a601cefdf337815a1c0` as `1084b54e`. The entire incoming
  range after `76b68aba` changes only documentation and frozen review/runbook/
  manifest/execution evidence. Verified `apps`/`packages` are unchanged, so no
  repeated code tests, JS export or IPA were triggered by this document sync.
  Android121's approved install and later system WebView event belong to the
  Android owner's recorded execution. iPhone installation, cache behavior and
  end-to-end speed remain unconfirmed; broader production readiness remains false.

## Startup restoration and Assistant wait synchronization — IPA2 unchanged

- Verified published source `d1bff2c2921a49ee2b0221ba8ce0c520fd0158d4`, then its
  narrow correction `ab154ebc6436850f32c36bbd890533f15678bc6e`. Normal local
  merges retained this report; the corrected merge is `a36560ce`. The complete
  merged `apps`/`packages` tree equals the corrected source. No native identity,
  dependency, encryption namespace or database-schema change was added.
- Verified SDK restoration now overlaps font loading in the root hydration
  provider. The later shell consumes that shared completion, keeping navigation,
  push registration and foreground writers beneath FontGate. Restoration remains
  serialized, and SDK/retry changes cancel stale admission.
- The incoming shared source adds an optional `waitMs` result-read query bounded
  to 0–8,000 ms. Owner/reply checks, post-wait deletion checks and durable pending
  work are retained; disconnect ends waiting without cancelling the question.
  The old result controller ignores the query, so the mobile client can continue
  its existing polling path before server activation. API source was synchronized
  and locally checked here; service/image activation belongs to the source
  owner's separately reviewed execution. No API, worker or model was deployed by
  this iOS chat, and no measured phone/model speed gain is established.
- Direct and independent standards/specification review found P2 in the first
  source: after A completed, A→B→A behind held fonts could reuse the old A
  completion and launch foreground work early and twice. The source owner
  reproduced the reported case with a genuine RED, then tied completion to a
  distinct SDK/revision/mode generation and filtered it during render. Both
  follow-up reviews found that correction resolves P2 without a new finding.
  The actual new regression passed in this checkout's provider suite.
- Fresh local checks passed as separate commands: **112/112 cases in 7/7 startup,
  auth, route, store and cache suites** on the corrected source; **80/80 cases in
  1/1 Assistant client suite**; and **25/25 cases in 3/3 API wait/result/stream
  suites**. The API and Assistant client files are byte-identical between `d1b`
  and `ab1`, so their completed checks were reused after the provider-only fix.
  These selections overlap the author's qualifications and earlier evidence;
  they are not one full-suite command and must not be added to those counts.
- Mobile/API type checks and lint over all eight changed TS/TSX files passed,
  using the API/mobile configurations. All test processes exited naturally.
  Existing Expo/act warnings remain recorded; no test content, timeout, skip or
  forced exit was changed in this worktree.
- Corrected-source production iOS introspection/JavaScript export and graph audit
  passed: 2,100 sources, 13 production entry points, zero forbidden sources and
  zero explicit Android tracking entry points. Diagnostics are isolated in
  `E:\Masarifi-ios-artifacts\source-ab154ebc`; this is not a signed IPA.
- The first API attempt could not start any case because Jest wrote its transform
  cache to a full C drive: three suites failed to load, zero cases ran. The raw
  ENOSPC log is retained. Directing Jest's cache to dedicated E artifact folders
  allowed the unchanged selection to pass; no user/peer files were deleted or
  moved by this chat. This infrastructure failure is separate from assertions.
- Incoming source history passes the unchanged strict secret policy with zero
  findings; historical raw1/public1/unexpected0 classification remains intact.
  No phone/hosted action, repeated question or signed IPA build occurred here.
  IPA2's SHA256 was rechecked unchanged.
  The existing IPA2/installation link still contains `2dd23b5b`; this newer shared
  source needs a later signed build and physical iPhone acceptance. Android121's
  earlier cache proof does not accept these subsequent startup/wait changes.

## Requested-day worker and Android122 evidence synchronization

- Verified published repository source
  `48791e6d421bf43e6db17e221782c10e0cc0cdb0` and frozen review head
  `f61d5160ba806579618adfe72be5732831900258`. A normal merge `7bedc57c`
  retained this iOS report; the full merged `apps`/`packages` tree equals the
  qualified incoming source. All changes after `48791e6d` in the incoming range
  are operational/review documents, not application code.
- The worker prepares its first existing overview with owner-timezone day dates
  only for positively recognized whole spending-summary questions about today
  or yesterday. NFKC/whitespace normalization precedes the closed Arabic/English
  grammar. Other wording keeps the existing overview/model path. No answer,
  amount, extra data read, expense-kind/currency filter, model, schema or mobile
  configuration is selected or changed by this predicate.
- Direct and two independent read-only reviews identified the initial interval
  and normalization gaps. The source owner reproduced both sets as genuine RED
  controls and replaced the negative word list with positive eligibility.
  The final source/test blobs match those reviewed; both follow-up reviews
  closed the twelve specified interval/NFKC findings within that bounded scope.
  This is not a claim to parse arbitrary natural-language periods or guarantee
  one model round or a faster real reply.
- The [source owner's worker qualification](2026-11-06-assistant-requested-day.md)
  reports Agent 161 cases plus 84 unchanged context/data/worker cases, totaling
  245 unique cases across four suites, with types/compilation/lint/format passing.
  These are the author's execution evidence, not a new local iOS test command.
  Its twelve operator-proof rejections and isolated-container checks are separate
  operational evidence and are not added to that source count.
- Verified the complete mobile and shared-package trees are unchanged from the
  previously checked `ab154ebc` source. Existing mobile checks and the 2,100-source
  iOS production JS export remain the relevant evidence; no duplicate mobile/API
  test campaign, JS export, signing operation or IPA was triggered by this sync.
  The worker change is server-side and its deployment belongs to the owning
  chat's separate artifact-bound approval and execution. This iOS integration
  does not run the imported rollout scripts or activate any hosted component.
- Imported the [actual Android122 execution report](2026-11-06-startup-assistant-device-check.md).
  Its approved in-place APK/API update and measured Home/Assistant timings are
  the Android owner's physical evidence. They do not establish iPhone behavior,
  whole-production readiness, or acceptance of the subsequently prepared worker.
- Incoming history passes the unchanged strict secret policy with zero findings;
  historical raw1/public1/unexpected0 classification remains intact. IPA2 remains
  source `2dd23b5b`; iPhone installation/login/features and later signed-source
  parity remain unconfirmed. No phone/server action or repeated question was
  performed by this iOS chat for this integration.
