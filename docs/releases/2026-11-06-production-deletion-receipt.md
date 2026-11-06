# Production account-deletion receipt repair

Source qualified; candidate APK preparation and primary acceptance are separate gates. No original-account deletion has been performed.

## Observed failure and cause
Six real user POSTs to `/api/v1/me/deletion-requests` returned400 on6November19:05–19:07UTC. Production cooling-off is0hours. The ordinary Production client sent confirmation and an operation UUID but omitted the64hex completion token required by the existing zero-hour server. The original profile remains active and no deletion request was inserted. This is a client/server contract mismatch; the generic connection message obscured the actual refusal.

## Change
Explicit Production/live clients at `https://api.masarifiratibi.com` now use the existing persistent completion flow. The random capability is saved before the confirmed POST; the client reads the capability receipt even after identity-provider session revocation. It erases only the confirmed deleted owner's local data after a valid completed timestamp and preserves any other active owner/session. Existing pending/cancellable legacy requests retain their original UI. Recent identity verification remains enforced through the existing same-owner/same-SDK OTP helper; the deletion HTTP request opts out of generic global session-rebinding retries. Existing boot and foreground deletion fences now cover Production as well as the existing DEV flow. No server, schema, credentials, model, signing identity or DEV deployment flag changes.

## Verification
195 unique cases across7 affected existing suites pass using final runtime and recovery results plus the unchanged passing suites from the initial affected run. TypeScript and scoped ESLint pass. Coverage includes actual Production panel and POST body, durable token before dispatch, completed receipt and revoked SDK, signed-out cold recovery, lost response without replay, preservation of another owner, wrong OTP without erasure/resubmission, successful same-session OTP reusing the exact operation and capability, HTTPS/origin admission and manual HTTP step-up without generic replay. Initial failures and their corrections remain retained privately; no skipped tests, forced process exit or relaxed server guards.

The existing195 cases are not a real deletion on the original Redmi account. Physical acceptance may open and cancel the confirmation only. Destructive acceptance requires an explicitly selected disposable account or the user's own deliberate decision; never erase retained original data to prove a fix. Assistant requested-day worker remains the separately approved frozen package; reuse its existing image/source tests rather than build it again.
