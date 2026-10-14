# Redmi profile setup save failure

The user manually opened the installed preservation client and reported the Arabic save error on the first screen. Authorized read-only screenshot evidence identifies ProfileSetupScreen, before Home. No device mutation, launch, installation, logout, data reset, Voice replay or financial operation was performed for this investigation.

## Confirmed cause

The identity service requests `Accept: application/json; currency-onboarding=1`. The shared real HTTP transport overwrote that value with `application/json`. The API deliberately omits `currencySelectionRequired` without negotiation to preserve older strict clients. Profile setup requires that field to confirm the currency save and throws `contract_mismatch` when absent.

Staging access evidence shows authenticated PATCH `/api/v1/me` and PUT `/api/v1/me/preferences` returning 200 for the reported attempts, followed by refresh GET requests. There is no corresponding PUT onboarding request for those attempts. A read-only Staging database query confirms SAR and `currency_selected=true`; welcome was already completed historically. This is a client response-contract failure after successful server writes, before the current operation's onboarding and local-profile save. It is not evidence of a local database write failure or expired authentication.

The fix defaults Accept only when no case-insensitive Accept key exists. Forced bearer replacement, JSON body handling, backend legacy response compatibility, UI and financial safeguards are unchanged.

## Verification

- Three HTTP transport cases and a real identity-service plus real HTTP-transport regression fail before the fix with the expected missing negotiation/contract error.
- Targeted profile/entry/HTTP/authentication tests: 4 suites, 92 tests pass. The first cold run had one existing screen-test timeout; the unchanged test passes on the second run with the original timeout.
- All live service tests: 20 suites, 454 tests pass, including Voice, Tracking, finance, reports, authentication and engagement.
- Final HTTP suite: 33 tests pass, including negotiated Accept, default JSON Accept and existing authorization replacement safeguards.
- Mobile TypeScript check passes. Targeted lint has zero errors and 13 existing import-style warnings in the authentication test file.
- Independent source review found no correctness or security blocker. Private evidence and review remain outside Git at `E:/Masarifi-staging-acceptance-2026-10-12/manual-home-save-investigation`.

## Signed candidate

Source `38d9f9c7cbfe68cc07221d602fa9f9da2a314b9f` was pushed to the canonical recovery branch. [CI run 38267755942](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38267755942) passed both jobs: 481 mobile suites / 3,013 tests with zero failures or pending tests; all 17 native tests; TypeScript, lint, dependency-security and frontend checks; signed release assembly.

The downloaded APK SHA-256 is `03b7e13ec3a7c145b81b86792d3554f25808f7bc9300d3e3e61f8c2eccfdaeaf`. Local verification confirms the existing single signing certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, package `com.masarifi.mobile`, non-debuggable release, all four ABIs, Staging API/auth configuration and expected runtime components. All 92 native libraries pass ELF checks, including 16KB load alignment for both 64-bit ABIs. Secret/Production-endpoint pattern checks pass; these checks are not a complete security audit.

Candidate and receipts are preserved at `E:/Masarifi-local-readiness-2026-10-12/client-38d9f9c7`. The only production mobile difference from installed source `eea4bca2` is the HTTP Accept default; two test files also changed. Native Voice/Tracking preservation code is unchanged. Packaging checks do not establish real-device UI acceptance.

Independent artifact qualification PASS is retained in that directory's `INDEPENDENT-QUALIFICATION.md` (SHA-256 `bd11060e03396e0e89cf6c7a7b50108e6d18eaedbd4e018bd18c6d53179a915a`). The reviewer independently checked actual test records, signature, package/configuration, ZIP integrity, alignment and all ELF records. All six DEX files, 92 native libraries and the binary manifest are byte-identical to the previously qualified installed candidate. The existing diagnostic admits the old `41100c38` APK, not this new APK; it must not be treated as admission authority for an unapproved update.

## Acceptance limit

The installed Redmi application is unchanged. Fixed-build Home acceptance is pending a separately approved delivery/device step. No fresh private Voice journal or Tracking database inspection was attempted while the user was actively testing. Earlier preservation snapshots must not be presented as current post-manual-test verification. Screenshots and raw device/server logs are private and excluded from Git.

The user's manual launch supersedes historical stopped-package snapshots. Do not rerun an older consumed guarded scope or stop/disable the active client to restore that historical state. Initial authorized read-only capture is complete; the user requires approval before further device operations and explicitly prohibited reinstall/reset/logout/data clearing. No update, launch or financial authorization is implied by the successful candidate build.

## Preservation-safe update/Home scope preparation

The follow-up preparation is retained privately at `E:/Masarifi-staging-acceptance-2026-10-12/profile-save-update-home-preparation`. Canonical one-shot scope digest: `b63efc94a71b46e50a47c221ebae22a7e32592a843578046252e374a30e092c2`. No device approval or operation is implied by this preparation. Consult REVIEW.md and the final independent packet report before requesting or recording approval.

Diagnostic-only source `5b346e3fdead9d0179533c61e85bd3497ed183fa` passed CI38272663846 including nine disposable Android15 encrypted phases. Signed diagnostic `236585cc6e03bef6068311b555bf5dabc37feb1440a01df7163310ab42c5e812` admits only corrected client03b7e13e for launch admission. The existing0dd diagnostic is reused solely for the existing411 client's initial observation. Independent offline artifact qualification passes; no physical runtime claim is made.

The host controller admits either a freshly verified stopped app or the manually opened MainActivity, but requires explicit manual-testing pause with no recording or unsaved operation. It permits one in-place diagnostic update, one same-package client update, three read-only private observations, and at most one no-tap launch within45 seconds with one private PNG. Exact captured Voice fingerprint equality across installation precedes launch; semantic Voice preservation and unchanged posting-OFF Staging financial/historical state follow. Final DEFAULT/stopped state is intentional, not restoration of an initially running state. Incomplete acceptance after an install attempt keeps the client disabled pending separate recovery approval. No automatic retry, uninstall, data clearing, legacy replay, financial activation or deployment is included.

Source/host review passes with12 offline mocked tests both normally and under optimization. A stop-deadline gap was reproduced and corrected. Normal stop commands are bounded to60 seconds from launch; only final cleanup receives the independent90-second allowance. Ordinary authentication metadata and server-authoritative local-cache reconciliation can occur during startup; no byte-equality promise is made for these caches or SDK tokens. The script never declares authenticated Home automatically: private screenshot review and preservation checks remain mandatory. Full application acceptance and Voice Auto-Posting activation remain pending separate authorized work.

## Approved SSH recovery and exact five-profile-event check

The user approved one Staging source51.39.31.159/32 TCP22 rule and a verifier allowance for exactly five known profile events. The rule was applied once after fresh source/host/20-rule checks; all20 prior rules remain and21 rules were verified. Strict pinned-host/key SSH succeeds. No other security, service, database or financial change was made. Evidence: `E:/Masarifi-staging-acceptance-2026-10-12/ssh-51-approved-recovery`.

The original promotion snapshot differs solely by outboxUnpublished497071 ->497076. The five customer_api profile.updated events for display_name were pinned with timestamps and SHA256 of their complete database rows. The local verifier now reads those rows in the same repeatable-read READ ONLY transaction as the original snapshot, rejects missing/extra/edited/published/attempted events, and normalizes only this explicit5-count allowance on a copy before requiring equality of every other original field. Financial table fingerprints, Voice/assistant counts, migrations, postingOFF and zero active epochs/analysis jobs remain enforced; deployed scripts and the original baseline are preserved. The receipt truthfully reports originalSnapshotUnchanged=false.

Pure five-event tests and host-proof tests pass normally and under Python optimization (5 tests each, with multiple rejection subcases), after demonstrated RED failures. The revised live preflight PASS confirms exact5 events, unchanged financial/Voice checks, healthy promoted candidate and preserved service/configuration/routing/unit state. Existing APK/Android CI qualification is reused without another broad acceptance cycle.

The pending installation-only scope is `cd22f3ebe3bb5cd451c1a00c33803738f9e41a6b9e70c85ee39a932aeb5cbed6` in `E:/Masarifi-staging-acceptance-2026-10-12/profile-save-five-events-preparation`. Independent final review PASS:52 file pins, reportSHA `c6289b389f920d62a454bad3b90f145167a8214397dbc29a19d5e16830315f0f`. The existing device approval remains unconsumed; no ADB command or update has run. Fresh phone idle/no recording/no unsaved action confirmation and external preflight PASS are still required before dispatch. At most2 private observations, one diagnostic and one client in-place update, no automated launch/taps/screenshots. User manually tests profile/Home afterward. Older scopes must not be executed.

## Installation-only execution after fresh idle confirmation

On12 October2026 at17:05 UTC (20:05 Riyadh), the fresh external five-event Staging preflight passed and the user's fresh phone-idle/no-recording/no-unsaved-action confirmation was recorded. Scopecd22 was consumed once. The controller completed one diagnostic236585cc update and one same-package client03b7e13e update, with two private read-only observations and zero automated launches/taps/screenshots. Result: PASS_INSTALLATION_PRESERVATION_ONLY. No data clearing, uninstall, logout, deployment or financial action occurred.

Captured Voice fingerprint `c03f0d343db9ed0ef3d55d54dd130e8f8c9bad71042a432f5b60c159c11b52d7` and committed WAL frames123 matched exactly before/after installation. Nine rows, eight terminal, one pending, one audio ownership and zero confirmation ownership matched the retained semantic baseline; UID10304/certificate remained identical. Tracking sources/native intake remainedINACTIVE, zero Tracking/finance pending and prunable rows, current schema/no legacy cleanup. Owner contexts remainedPRESENT. This is captured journal preservation, not a full audio/payload or authenticated Home acceptance claim.

Final client DEFAULT/enabled and stopped/quiet was verified; original diagnostic enabled/stopped state was restored. The client was initially running, so exactPackageStateRestored=false is intentional and truthful; approvedFinalPackageStateVerified=true. Saved result.json/execution.log and local-outcome-audit.json retain proof outside Git. Parent installation authority is now used once bycd22; superseded older scopes must not execute. Any further agent device operation requires separate authorization. The user will manually open the corrected client and test profile saving/Home. Full functional acceptance remains pending that user-led test.
