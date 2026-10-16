# Immediate deletion acceptance — DEV/Staging

The separate native DEV Privacy variant now starts account deletion immediately after the irreversible confirmation. There is no artificial cooling period. This qualification changes neither the ordinary application nor Production; existing positive cooling policies keep their behavior. Work stayed on `codex/voice-promoted-operating-2026-10-13` in `D:/Masarifi-integration-2026-10-10`.

## Actual native result

At 19:32 UTC on 16 October, a newly created, marked, disposable Clerk Development identity signed in through the real native SDK and completed profile setup through the normal UI. Native Delete account opened its confirmation dialog; Confirm request submitted exactly one operation.

| Observation | Actual result |
| --- | --- |
| Confirmed POST | HTTP202, actual status completed; 2,385ms |
| Deliberately lost completed response | Exactly one response discarded by the private test probe |
| Recovery | Capability GET HTTP200/completed; no second POST |
| Completion including local cleanup | 5,931ms from POST dispatch |
| Provider | User404; zero active sessions |
| Database | Profile deleted, identifying fields cleared, all catalog-discovered owner payload counts zero |
| Native storage | Exact owner database/WAL/SHM, encryption key, session/PIN/capability and pending recovery index absent |
| Other native owner | Database/WAL/SHM hashes unchanged |

These are functional samples on this device and Staging, not a universal latency guarantee. The lost-response probe intentionally adds recovery time; normal completion does not need to lose its response. All temporary fetch wrappers/subscriptions were restored afterward.

## Representative payload and failure repair

A separate disposable Development identity contained financial transactions, postings/revisions, accounts/categories, budgets, obligations/payments, savings goals, tracking/preferences, terminal Voice data, report output and a resolved Support attachment. Three synthetic real Storage objects were uploaded and verified before deletion.

Its first attempt exposed two previously corrected native/provider issues and a remaining hosted SQL performance issue. Clerk reconstructed the same active session resource during recent authentication; stable session identity replaced object-reference equality. Missing Storage objects returned HTTP400 with `NoSuchKey`/semantic404; Reports and Support now recognize that precise absence without accepting unrelated failures. Finally, the erasure query scanned approximately 494,000 unrelated outbox rows and timed out. The new append-only migration adds three partial expression indexes and indexed UNION candidate lookup while preserving request/owner guards, permissions and all other erasure statements.

The exact indexes were built CONCURRENTLY on Staging before atomic function/history installation. The existing 121 history rows and external role memberships remained unchanged; temporary self-grants were removed. All three indexes were checked for exact definition, table, owner, valid/ready/live state. Actual hosted erasure SQL passed in 275ms within a rollback-only probe. The original populated request subsequently completed through its ordinary retry at 19:27:34 UTC, without backdating its processing lease or submitting a new operation. Its earlier delay is not represented as successful immediate completion; the separate fresh native test above proves the repaired inline path.

All representative owner payload was erased, the provider user/session were absent, and all three objects returned precise absence. Native status refresh recovered completion after provider revocation, signed out and erased this owner's local storage. The protected owner's 22 transactions and financial/Voice fingerprints remained unchanged.

## Technical retention and late uploads

Minimal deletion requests, hashed completion receipts, redacted profile tombstones and bounded upload-erasure records remain for recovery and resurrection prevention. Shared reference data, anonymous aggregates and other owners' data are preserved. This is complete owner payload erasure, not a claim that every technical trace is immediately removed.

An already-issued Support signed upload capability remained usable after deletion. A single synthetic late upload succeeded, and a subsequent read-only inspection confirmed the persistent owner-scoped worker removed it. The worker pulse was checked after completion and remained healthy; its upload fence continues through the conservative capability expiry. The test proves periodic removal, not immediate capability revocation or a measured 30-second bound. The worker stays running with its existing restart policy; no global bucket, credential or Production changes were made.

## Verification and boundaries

Backend source `577defc5`: 296 suites / 2,076 tests passed; eight existing environment-gated ledger tests skipped. Mobile source `c4f976a2`: 493 suites / 3,314 tests passed, zero failures/skips; typecheck, scoped lint and app-shell boundaries passed. The unchanged native binary passed 34 tests across six Android classes. The new SQL regression and associated owner/role suites were independently rerun by root: three suites / 19 tests passed with zero skips, including 500,000 foreign outbox events. Historical migration baseline verification passed.

SQL source `7be253f8` uses migration `20261016201500_owner_outbox_erasure_lookup.sql`, LF SHA256 `f5b8995bb380bf00d829eb91430bd6d18f42f2d6b174580e88db7d40ed9fcbe9`. API image source and native JavaScript did not require rebuilding for this SQL-only repair. Hosted runtime remained the guarded 150-container inventory and existing DEV Privacy route; all unrelated containers/routes were preserved. Voice stayed ON Posting. The main DEV activity was returned to the foreground; its existing protected session was authenticated, automatic posting enabled, Voice ready, and no pending audio. Neither ordinary nor main DEV was reinstalled, reset, reloaded or signed out.

Private evidence is outside Git under `D:/Masarifi-preservation-2026-10-16/reliability/`: `immediate-outbox-erasure-indexes/`, `immediate-deletion-native/qualification/`, `immediate-final-inline-native/`, and `device-final-v6/`. These include actual HTTP timing/recovery, provider404, zero-payload SQL, native local/foreign hash, Storage absence/late-upload and exact runtime/role/history proofs. Never publish credential files or replay consumed creation, deployment or deletion dispatches.
