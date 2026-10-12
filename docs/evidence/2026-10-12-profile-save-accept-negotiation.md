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
