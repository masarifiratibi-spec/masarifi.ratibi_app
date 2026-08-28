# Clerk and Supabase Provider Configuration Contract

**Spec**: SPEC-BE-002
**Environment**: Development first
**Evidence status**: Partially verified on 2026-08-28; unresolved items remain
release blockers and stay unchecked below.

This is the redaction-safe configuration contract and implementation checklist.
Do not paste keys, OTPs, JWTs, test credentials, provider responses, or screenshots
containing personal data into this file, Git, logs, tasks, or chat.

## Clerk Application

| Setting | Required value | Verification |
|---|---|---|
| Application count | One application for Mobile and Admin | Dashboard application inventory shows one Masarifi application |
| Name | `Masarifi Development` | Development instance header |
| Instance | Development | Instance/environment badge; production keys are absent |
| Password sign-in | Disabled | Sign-in options inspection and negative test |
| Phone OTP | Enabled for sign-up and sign-in; verification required | Two controlled Phone users authenticate |
| Google | Enabled | One controlled Google user authenticates |
| Apple/Facebook/others | Disabled | Provider inventory and negative route inspection |
| Strict enumeration protection | Enabled where offered | Provider setting inspection and unknown-account behavior test |

No second application is created for Admin.

## SMS Country Allowlist

Provider-side SMS delivery must allow exactly:

| Country | Calling code |
|---|---|
| Egypt | `+20` |
| Saudi Arabia | `+966` |
| United Arab Emirates | `+971` |

Client validation is UX only and cannot substitute for provider enforcement.
Record the following safe evidence:

- settings path and review timestamp;
- allowed calling codes only;
- one successful controlled test per available approved route without OTP output;
- one rejected disallowed-country attempt without phone number output;
- Clerk tier/support ticket reference if the setting is unavailable.

The currently known Clerk tier/support restriction for enabling all required SMS
countries is a **production release blocker**. It is not permission to widen the
allowlist or claim AC-001 complete. Development test usage remains controlled until
the provider restriction is resolved.

Dashboard review on 2026-08-28 confirmed that Saudi Arabia is provider-locked in
Tier C and Egypt and the United Arab Emirates are provider-locked in Tier D. Clerk
requires support activation for these tiers. The default Canada and United States
destinations were removed, leaving the allowlist empty rather than wider than the
approved policy. No phone number or OTP was used or recorded. Support activation of
exactly `+20`, `+966`, and `+971` remains required.

## Native Applications

| Platform | Required identity | Additional provider evidence |
|---|---|---|
| Android | Package/application ID `com.masarifi.mobile` | Native API enabled; release/development SHA evidence recorded only in protected operational evidence when required |
| iOS | Bundle ID `com.masarifi.mobile` | Apple Team ID supplied in the provider dashboard when required; not invented in source |

The Mobile custom scheme is `masarifi`. Add exactly this Mobile SSO redirect to
Clerk's redirect allowlist:

```text
masarifi://oauth-callback
```

Reject an unapproved scheme/host/path in the redirect test. The callback is not an
HTTP Origin, JWT audience, or `azp` value and must not be placed in
`CLERK_AUTHORIZED_PARTIES`.

SPEC-BE-002 configures the provider records. SPEC-BE-014 owns Expo hook selection,
secure session-token storage, manifest/config-plugin changes, and live Mobile/Admin
adapter cutover. If SPEC-BE-014 selects native Google rather than browser SSO, it
must supply the provider-specific Google client IDs, iOS reversed-client scheme,
Android SHA-1, Clerk SHA-256, and development-build/EAS configuration at that time.

Dashboard review on 2026-08-28 confirmed Native API is enabled and
`masarifi://oauth-callback` is the sole Mobile SSO redirect. The Android application
is registered as namespace/package `com.masarifi.mobile` with the EAS Development
signing fingerprint; the dashboard's masked fingerprint evidence was verified and
the full value was not committed. The iOS record remains blocked on the missing
Apple Team ID.

## Google Connection

- Enable Google only under the approved Clerk Development instance.
- Use provider development credentials/settings according to Clerk's current
  dashboard guidance; never commit the Google client secret.
- Confirm successful Google sign-in creates/resolves a Clerk user subject through
  the same backend boundary as Phone OTP.
- Confirm the backend does not branch authorization by provider and does not store
  Google access/refresh tokens.
- Do not use deprecated Expo `useOAuth()` in future cutover work; current browser
  SSO guidance uses `useSSO()`.

## Clerk Native Supabase Integration

### Clerk side

1. Open the Development instance integration settings.
2. Enable the native Supabase integration.
3. Confirm Clerk session tokens expose `role: authenticated` as required by
   Supabase Third-Party Auth.
4. Do **not** create a Supabase JWT Template.
5. Copy the Clerk instance domain through a private local channel. The domain is
   configuration, not a secret key, but is still validated against the approved
   instance.

The Development instance domain observed in Clerk on 2026-08-28 is
`popular-chipmunk-2273.clerk.accounts.dev`. Clerk's integration setup now reports
**Enabled** and states that the integration adds the required claim to Clerk session
tokens. Its copy field exposes the same domain with an `https://` scheme. The JWT
Templates page reports `0-0 of 0`, so no legacy Supabase JWT Template exists. Token
claim and hosted-project verification remain unchecked until a controlled Clerk
session token can be tested through Supabase Third-Party Auth.

### Supabase hosted project

1. Open **Authentication → Third-Party Auth → Clerk**.
2. Add the exact approved Clerk instance domain.
3. Save and verify a Clerk session token reaches a protected owner RLS read.
4. Verify a second Clerk subject receives zero rows for the first user.
5. Verify no matching `auth.users` row is created.

### Supabase local project

Set the documented native provider block in `supabase/config.toml` after the exact
Development domain is known:

```toml
[auth.third_party.clerk]
enabled = true
domain = "<approved-development-instance>.clerk.accounts.dev"
```

Restart local Supabase after the change. The domain is non-secret; no key or JWT is
written to `config.toml`. Local/CI verification must use injected test credentials,
never committed tokens.

Supabase may take up to the documented provider refresh interval (currently up to
30 minutes) to accept rotated Clerk signing keys. The rotation runbook waits and
tests fail closed; it does not fall back to a shared JWT secret.

Local clean-state validation on 2026-08-28 reapplied all migrations through 013,
then passed schema lint and all 308 pgTAP assertions with the Clerk third-party
block present in `supabase/config.toml`. Clerk OIDC discovery returned the exact
approved issuer and a JWKS containing only asymmetric keys with `kid`; local
`auth.users` contained zero rows. The hosted Supabase project was discovered and
healthy, but its Dashboard and connected-service session require reauthentication,
so the hosted Third-Party Auth record and real-token RLS proof remain blocked rather
than inferred.

## Authorized Parties

`CLERK_AUTHORIZED_PARTIES` is a comma-delimited, parsed, deduplicated allowlist of
trusted **web origins**, for example approved Admin production origin(s) and exact
local development origins. Each entry must be an absolute `http`/`https` origin
with no path, query, fragment, credentials, or wildcard. Production forbids `http`
except an explicitly isolated local test environment.

Rules:

- validate a present session-token `azp` against the list;
- allow an otherwise verified native Authorization-header request to omit `azp`;
- never put `masarifi://oauth-callback` in the list;
- never infer authorization from Origin/`azp`; it is an additional token check;
- never log the token or the rejected raw Origin as a metric label.

## Webhook Subscription

Create the endpoint only after the backend route is deployed and reachable:

```text
POST /webhooks/clerk
```

Subscribe to exactly:

```text
user.created
user.updated
user.deleted
```

Inject the resulting signing secret only into the API runtime secret store as
`CLERK_WEBHOOK_SIGNING_SECRET`. The worker does not need the signing secret because
it processes only already-verified inbox rows. Rotate it with overlapping provider
delivery validation according to Clerk's supported procedure. Never store or paste
the value in source, migration, Compose, Docker image, fixture, screenshot, test
output, log, or chat.

Verification covers valid delivery, invalid signature, stale/future timestamp,
identical signed duplicate, same delivery ID/different hash conflict, unsupported
signed type, raw-body preservation, body limit, provider retry, and redaction.

Clerk currently has zero webhook endpoints. No endpoint was created because the
repository contains no deployed public HTTPS API URL for `POST /webhooks/clerk`.
Creating a placeholder or localhost endpoint would not validate delivery and would
expose a signing secret without an approved runtime secret store.

## Required Test Identities

| Alias | Method | Purpose | Stored evidence |
|---|---|---|---|
| `phone-owner-a` | Phone OTP | owner profile/device/preferences | opaque test alias + hashed subject reference only |
| `phone-owner-b` | Phone OTP | non-owner isolation | opaque test alias + hashed subject reference only |
| `google-owner` | Google | provider-independent subject behavior | opaque test alias + hashed subject reference only |

Test phone numbers, emails, OTPs, browser sessions, access tokens, and raw Clerk
subjects remain in the approved test secret/account system. They are never written
to repository fixtures or CI output. Cleanup verifies no accidental Supabase Auth
identity was created.

## Release Evidence Checklist

- [x] One `Masarifi Development` Clerk application serves both clients.
- [x] Only Phone OTP and Google are enabled; password/Apple/Facebook/other are off.
- [ ] `+20`, `+966`, and `+971` are the only provider-side SMS destinations.
- [ ] Android/iOS identity `com.masarifi.mobile` exists under Native Applications.
- [ ] `masarifi://oauth-callback` is allowlisted and an unapproved redirect fails.
- [x] Native Supabase integration is enabled in Clerk.
- [ ] Supabase Third-Party Auth contains the exact approved Clerk instance domain.
- [ ] Valid Clerk token passes owner RLS; wrong subject/invalid token fails.
- [x] No Supabase JWT Template exists.
- [ ] No Masarifi identity exists in `auth.users`.
- [ ] Two Phone identities and one Google identity pass the redacted test matrix.
- [ ] Webhook events are exactly the three approved types and signature tests pass.
- [ ] No secret/OTP/JWT/PII appears in captured evidence.

Unchecked means unverified and blocks the corresponding acceptance criterion. This
planning artifact intentionally leaves every box unchecked.
