# Native App Lock product decision — 29 October 2026

Authority: the user's attached permanent App Lock decision and overnight execution instruction. The user selected removal of the separate Masarifi PIN, optional Android-native authentication in release builds, and no optional App Lock prompts in explicitly identified DEV builds. This is distinct authority for this local product change; protected Staging/Production/schema/worker/financial actions remain unapproved. Routine design/implementation decisions are delegated to Sol; no design-review pause or other model is used.

## Selected design and alternatives

Reuse installed Expo55 LocalAuthentication with OS-managed biometric and device credential fallback. Keep Clerk/session/server/financial authorization independent. A custom PIN fallback contradicts the decision; a universal bypass would weaken release protection and is rejected. No new authentication library or fake system prompt is needed.

DEV prompt suppression requires the conjunction of __DEV__, NODE_ENV=development, native package com.masarifi.mobile.dev, live client mode and exact approved Staging variant/API pair. It applies by build identity rather than a permissive public flag. Release/unknown identity always retains its optional native gate; user preference is distinct from build capability. Existing release environment validation stays fail-closed. Cached-owner local access must still come from protected prior-owner/session storage with logout/deletion fences; no new Clerk identity or remote/financial admission is created.

Replace active PIN metadata/state/services/screens with native lock enabled, duration and lock status. Preserve native screen privacy shielding. Remove custom PIN creation, verification, reset, KDF/native module and unused UI/tests. Retain shared Clerk OTP, SecureStore, database encryption, financial reauthentication and shared cryptographic dependencies.

## Compatibility and preservation

Source audit: database.ts owns a random32-byte owner key, separate from the custom PIN PBKDF2 credential. Do not read/export/decrypt device secrets, clear keys, reset application data or re-encrypt the database. Read legacy lock preference/presence only for compatibility; preserve old credential bytes, including malformed values, without validation or deletion. Write changed native lock preferences to a new owner-scoped nativePrivacyLock.v1 key. Existing legacy values remain for rollback; explicit existing owner-deletion cleanup retains its legacy-key purge responsibility. No implicit migration of secrets on startup.

Map enabled legacy PIN/biometric lock preferences to native authentication in release. Legacy temporary PIN lockout becomes ordinary native lock; the OS owns native lockout. Owner-scoped native preference wins over legacy, including explicit disabled. Device credential-only enrollment is supported; unavailable/cancel/failure cannot unlock. Async success and persistence are fenced to the current owner/mounted attempt. PIN routes are removed; return-route sanitization already rejects them. Historical route counts/results remain historical.

## Verification and honest limits

Use red→green runtime identity, legacy-compatibility/no-secret-mutation, native fallback, cancellation/stale success and owner/session admission regressions. Run affected security/state/storage/routing suites, typecheck/lint and existing relevant boundary gates. Reuse unrelated completed tests. On the current offline Xiaomi verify loaded code, startup/reload, ordinary navigation and background/foreground without custom PIN/biometric prompts, accessible encrypted original draft, unchanged12applied operations and settings restoration.

Actual successful fingerprint/device credential authentication needs the absent user's private interaction and a suitable matching release-like artifact. Do not bypass or synthesize it. Actual logout may erase preserved owner data; use existing automated lifecycle evidence and keep destructive real-owner/device cases NOT_RUN. A pending release/native hardware criterion prevents claiming complete App Lock acceptance; it does not stop safe implementation or DEV verification.

## Dependency overlay

Original plan69references/88units/62client IDs/29tasks stay unchanged. T02's historical PIN acceleration/lifecycle is retained as historical, superseded by this product design plus new native/DEV criteria. T04/T05 accepted sync/key/financial/database work is preserved; rerun only directly affected owner/session regressions. T06 includes new native-only UI/DEV navigation checks; full T06 remains blocked by the separately retained Security Events gate and unperformed conditional criteria. No change to T07+ dependency order. T20–T22 must qualify final matching native artifact without the obsolete module and verify native prompts/release anti-bypass before release acceptance.

Primary API evidence: https://docs.expo.dev/versions/v55.0.0/sdk/local-authentication/ and installed55.0.18 types/Android source. Expo allows device fallback and reports enrolled security level; no extra package install.
