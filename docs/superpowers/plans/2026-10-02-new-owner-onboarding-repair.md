# New-user onboarding repair — 2026-10-02

Scope: generic first-login/bootstrap defect. Voice model, gateway/schema, M4A, privacy policy, quotas, credentials and Production are unchanged. Voice canaries and financial confirmation are paused until Samsung onboarding acceptance.

## Diagnosis

Authentication creates a Clerk subject, not a synchronous Masarifi profile. The signed webhook is durably received and provisioned asynchronously by `ClerkWebhookWorker`. `IdentityRepository.withCustomerTransaction` requires an active profile even for the initial `/me` read. An absent profile therefore becomes `PROFILE_INACTIVE` (403), indistinguishable from a blocked existing profile at the Mobile boundary. `getProfileSetup` started `/me`, preferences and onboarding in parallel, so provisioning solely at `/me` would still race dependent reads. The session controller correctly retains authentication but selects its generic profile-error gate after the failure.

The physical new-owner incident occurred while the entire Staging Worker was intentionally stopped for one-dispatch Voice validation. Three signed Clerk events waited in `received`, attempt zero. This operational condition made the product's reliance on webhook timing deterministic; the same race is possible during delayed delivery or Worker outage for any new user.

The earlier explicitly approved operator synchronization used the existing provider-verified reconciliation code, and created the profile/preferences/onboarding defaults. It did not complete the user's `welcome` step. That intervention is historical setup evidence, **not** proof of a product fix. It is not repeated as the solution. One separately approved SAR/cash account was created by the owner-authenticated API (201), with zero opening balance and `openingTransactionId: null`; a subsequent read found exactly one matching account. No Voice session/inference/confirmation was performed.

## Shared repair

- Existing active owners retain the normal `/me` fast path without a Clerk user lookup.
- When `/me` encounters `PROFILE_INACTIVE`, a narrow private API-only database function distinguishes absent identity from suspended/deleting/deleted identity. The latter still returns 403 without contacting Clerk or changing lifecycle state.
- For an absent owner, the server fetches the authenticated subject from Clerk through the existing bounded client. Missing/mismatched/banned/locked/unverified identity fails closed. No request-body identity or client-supplied profile state is trusted.
- The private function binds owner/session claims, shares the existing per-subject advisory lock with webhook reconciliation and atomically creates profile/preferences/initial onboarding plus one content-free `profile.created` event. It cannot update or reactivate an existing profile, has empty search path, and is not executable by public/anonymous/customer Data API/Worker roles. No broad table-write grant is added.
- Mobile awaits `/me` and checks the owner fence before requesting preferences/onboarding. Strict schemas and encrypted owner-scoped persistence remain unchanged.
- Provisioned `profiles.status='active'` retains its existing lifecycle meaning. Registration completion remains `onboarding.completedSteps` containing `welcome`; it is not set by bootstrap. The user must save Profile Setup before advancing. No finance is created by signup.

Forward migration: `20261002134352_authenticated_profile_bootstrap.sql`. Existing applied migrations are preserved; checksum manifest gains one entry.

## Verification evidence

RED: the real local database/service rejected the first `/me` for a genuinely absent random subject and rejected concurrent first reads. Mobile rejected dependent setup reads while `/me` provisioning was pending. Initial test-fixture type/import/unique-email issues were corrected separately; those setup errors are not counted as behavioral RED evidence.

GREEN so far:

- Fresh disposable PostgreSQL 18.6 database, all migrations applied: new-owner/bootstrap, existing profile/preferences and webhook suites — 24 tests passed. Expanded bootstrap suite — 12 tests passed, including no public execute/foreign-owner/absent-session, six provider failure variants and three blocked lifecycle states.
- Actual Mobile identity adapter, session controller, Profile Setup, root bootstrap navigation and protected routing — 93 tests passed.
- API identity/Clerk/security/OpenAPI/gateway suites — 194 tests passed, 9 intentionally skipped.
- API build/typecheck, changed API lint, checksum verification passed. Mobile typecheck and lint passed (102 existing warnings, no errors).
- Broad local API/Mobile commands were attempted. Initial npm argument forwarding caused excessive parallel workers and memory failure; sequential API still exhausted native allocation after missing-Docker failures in `ledger-release.container-spec.ts` and `image-commands.spec.ts`. These are retained limitations, not a passing full local run. Sequential full Mobile passed 453 suites / 2,504 tests; it reported lingering asynchronous handles after assertions completed. Full API lint passed on the sequential retry.

## Release and physical acceptance

Initial candidate: `08fda461c653605b3f921001b7bc588fe90dd50a`. CI run `37021161126` passed application/Mobile/admin/security checks but its migration-inventory assertion rejected the newly registered `ensure_authenticated_profile` function. The exact one-entry inventory update is required; the assertion remains strict. Local migration application/checksum/concurrency checks then passed (3 tests). A new exact-SHA CI/image is required before deployment. Historical `8434640` CI cannot substitute for the onboarding candidate.

The user subsequently confirmed personally retrying/completing Profile Setup on the existing Samsung build and trying Voice once. Read-only server evidence now shows `welcome` completed, tracking-intro pending, one SAR/cash account and zero transactions. Do not reset this owner's onboarding to manufacture a fresh signup. After the repaired candidate is installed, this owner can verify completed-profile routing and restart persistence. Physical first-login acceptance needs a genuinely unused Google identity signed in by the human; fresh database tests already cover absent-profile provisioning but are not physical proof.

Existing-owner acceptance: completed setup continues to Home and remains intact across restart/owner changes; inactive/deleted identities stay blocked. Voice synthetic English remains pending, Arabic depends on full English success, and Samsung Voice remains pending.
