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

## Acceptance limit

The installed Redmi application is unchanged. Fixed-build Home acceptance is pending a separately approved delivery/device step. No fresh private Voice journal or Tracking database inspection was attempted while the user was actively testing. Earlier preservation snapshots must not be presented as current post-manual-test verification. Screenshots and raw device/server logs are private and excluded from Git.
