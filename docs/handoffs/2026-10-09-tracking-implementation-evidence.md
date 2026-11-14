# Automatic SMS/notification tracking implementation evidence

Local implementation on `codex/ratibi-staging-security`, based on `eae3ecbcf9bdfbdbf846df109f2e5319abe5d63e`. The user's later “implement” request authorized product changes after the original review-only request. No shared database, staging runtime, deployment or remote branch was changed.

## Implemented flow

Android reads SMS with a `(receivedAt, native ID)` cursor and records allowlisted bank notifications with physical post identity plus revision identity. Both sources receive a bounded processing window. The shared deterministic parser extracts direction, subtype, lifecycle, monetary roles, instruments, merchant and time provenance. Candidates and review cases are committed to the existing encrypted owner database before notification acknowledgement or cursor advancement.

Online configuration contains the governed release, currency/provider assets, user keyword overrides, source trust and account bindings. A hash validates the complete download; validated snapshots replace the last-known-good configuration atomically. Incompatible or unavailable configuration retains review behavior. Published releases are immutable, snapshot identities are unique, corpus validation precedes publication, and channel activation/rollback requires a version, recent authentication, permission and audit reason. The seeded channel starts in `review` mode.

The API reserves a durable identity before capture decisions. Transport proof uses device, channel and physical source ID; provider-reference proof is scoped by provider, direction and economic family. Equivalent purchase/payment wording shares an identity across channels; fees, refunds, reversals and transfers retain separate families. Lifecycle/account resolution does not mint a new reference identity. Changed amounts, currencies or explicit accounts produce conflict review. Similarity produces a review signal and retains distinct messages. Any accepted primary or secondary item binds the shared reservation to its ledger transaction. Automatic and manual replay both validate the actual saved effect, including reviewed account edits and exact transfer source/destination, before linking it.

Eligible expenses and salaries use the normal ledger operations and existing transaction cards. Generic credits/funding, unsupported SEK, transfers, withdrawals, refunds/reversals and ambiguous fields remain in review. Incoming transfers credit the identified account; withdrawals require an owned cash destination. Refunds/reversals require an original transaction. Explicit review can confirm an unknown or pending lifecycle, while failed, declined, cancelled and administrative messages remain blocked. Masked instrument bindings are saved only when the user explicitly selects the review toggle; provider/account eligibility is checked before a ledger mutation.

WorkManager supplies periodic recovery, SMS content triggers and notification-triggered work. Headless initialization verifies the secure owner context, authenticates the installed Clerk session and fences owner/consent changes. Source changes invalidate stale work and immediately resync scheduling. Disabling SMS preserves pending notifications when that source remains enabled; logout clears the native owner and queue. Native notifications and presentation checkpoints use owner-specific Keystore encryption.

After accepted item outcomes, finance data and queries refresh. Capture confirmation waits for the authoritative notification event and its delivery policy, then uses its server ID for durable native presentation. Creation events use an ID-only background push to avoid a second visible push; later transaction changes retain the normal push behavior. Notification taps use the existing notification detail route. Missing permission and quiet/suppressed delivery policy are honored.

## Verification

- Full mobile suite: **453 suites, 2,498 tests passed**.
- API unit suite: **124 suites, 990 tests passed**. After the final shared replay guard change, all **10 tracking unit suites / 71 tests** passed again.
- API contract suite: **79 suites, 233 tests passed**, including approved OpenAPI route/schema updates.
- Isolated PostgreSQL 18 with PGMQ 1.5.1 SQL functions: all migrations applied; **2 suites / 18 tracking integration tests passed**. Tests cover normal ledger postings, cross-channel replay, pending refunds, settlement progression after secondary review, incoming transfer direction, conflict rejection, explicit account bindings, swapped replay edits, provider binding preflight, reversal routing and unresolved pending-message progression. The final regressions verify equivalent channel wording produces one effect, a replay conflicting with a reviewed account stays unresolved, and a separately posted fee remains distinct despite sharing a purchase reference.
- Final mobile tracking regressions after platform adapter changes: **40 suites / 270 tests passed**.
- API and mobile TypeScript checks passed. API lint passed; mobile lint passed with existing warnings. Frontend runtime and architecture boundary checks passed.
- API, worker and migration builds passed. Native Android tracking module compiled and **2 JUnit tests passed**. Android Metro/Hermes export passed.
- Migration checksums verified; historical migrations and their recorded hashes remain unchanged. `git diff --check` passed.

Independent review identified replay/account agreement, equivalent wording identity and separate fee identity issues. Each received a failing real-database regression before its fix; the final scoped review reported no remaining blocker. The full suites ran before the last narrow replay/platform refinements; the affected suites, types and builds were rerun after those changes. This evidence describes local verification, not physical-device acceptance or a production rollout.

Database tests used an agent-created temporary cluster at `127.0.0.1:55449`, database `tracking_verification`. The local bootstrap installed the official PGMQ SQL functions and substituted only its historical extension declaration in the in-memory test copy. Repository historical migrations remain unchanged. No external connection string or customer records were used.

## Release gates

Automatic rollout remains disabled in the seed. Before activation, verify a native development/release build against an isolated test account: process death and restart; reboot; Doze/battery restrictions; denied/revoked SMS and notification permissions; logout/account switch; offline recovery and queue overflow; same notification ID reused for later transactions; notification revisions; both channels arriving together; one visible confirmation and correct tap route. Force-stop behavior depends on Android and must be documented from a physical test.

The local Docker daemon was unavailable, so the backend image was not executed. Physical-device background acceptance and Android Keystore behavior require the isolated device run. The implementation does not claim those gates passed. Keep `review` mode until they have evidence; use the governed channel pointer rollback to return to an earlier published release if needed. AI remains disabled.
