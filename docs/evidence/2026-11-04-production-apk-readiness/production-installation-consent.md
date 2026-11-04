# Production Tracking installation consent — 4 November 2026

Status: source implementation qualified locally. Production acceptance remains open. The installed Redmi APK and delivery file have not been updated by this task. Source checkpoints are `70160b1d`, `d80c5420` and `711ca1cb` on the existing branch.

## Contract and authority

`PUT /api/v1/tracking/installations/:deviceId` is an authenticated explicit consent command. The server derives the owner and SDK session from the principal, registers the Android device through the existing identity path, and validates its current owner/session binding and Tracking preferences. Requests carry an expected version and explicit source activation boundaries. Caller-selected owners, generations and sessions are rejected.

The additive migration gives production installations separate forced-RLS storage. Identical uncertain requests return the original receipt; distinct stale commands conflict. Disable and re-enable rotate versions and generations. Device rebinding/revocation, preference pause and profile suspension revoke authority durably. A later unpause or restored session does not restore consent. GET and screen mount never enroll a device. DEV enrollment/cohort records remain unchanged.

Capture intake and workers validate the current capability and source boundary under locks. Queued old requests retain their original IDs and bodies. Already accepted immutable session/financial receipts remain reconcilable after revocation. A stale unsubmitted or claimed capture cannot create a new financial posting. Existing canonical SMS identity prevents a second posting when the same native message appears after a generation change. Review-required mode creates an owner-bound review item.

## Mobile persistence and recovery

An owner-scoped journal persists the explicit command before HTTP, persists its verified receipt before local enablement, and acknowledges only after source preferences are saved. An ambiguous response retries the same command after restart. Pending commands disable effective capture and have an explicit localized retry action. Offline source disable first stops local capture; a later sync reconciles the persisted server command. Local metadata requires the admitted owner and actual SDK session; HTTP additionally requires fresh verified bearer identity.

Android notifications persist their capture generation. Current reads filter before pagination and acknowledgment removes only matching generation/key pairs. Appends and acknowledgments preserve unattributed or older retained JSON values and unknown fields without model reserialization. Dormant work cannot starve new work or schedule the current worker. Scoped retained-work counts include every retained JSON value, including unknown values. Missing/corrupt retained state fails closed rather than appearing empty. Pending lifecycle assessment includes retained native work and pending consent commands.

## Completed local evidence

- Complete Mobile: 610 suites / 4,845 tests, runner exit 0. TypeScript, full ESLint and complete frontend/Firebase/runtime boundaries exit 0. Existing lint warnings remain warnings and are not described as corrected.
- Complete native module: 10 classes / 85 tests, no failures, errors or skips. Matching XML and source hashes are archived privately. These tests do not prove physical Android Keystore, SQLCipher or installed-APK preservation.
- Real production-consent SQL integration: 31 passing cases, including foreign/revoked/session-mismatched devices, retries/conflicts, worker leases, cross-generation deduplication, receipt continuity, concurrent revocation and UUID case aliases. Focused mobile journal tests: 18 passing cases. Earlier failing results and fixture corrections remain separate evidence.
- Complete affected API Tracking gates: 35 suites / 377 tests across unit, contract, integration, security and E2E, exit 0, on a fresh named isolated fixture target.
- Complete active API gates: 475 suites / 3,630 tests passed, exit 0, after the final changes. Another 10 opt-in suites / 132 cases remain skipped and unverified. They cover additional assistant data/queue, owner erasure, deletion, activity, restricted-role and migration-role cases; they are not passes or production exceptions. API TypeScript, full/scoped ESLint and API/worker/migration builds pass.
- A distinct new owned PostgreSQL 17.6 target applied all 182 unchanged canonical migrations, then the exact candidate once as migration 183 through the application MigrationRunner. The old iterated target remains preserved. No hosted migration or history repair ran.
- Candidate catalog checks verify forced RLS, migration-role ownership, runtime table denials, all 13 definer functions with an empty search path, and unchanged grantor-specific memberships. The pinned Supabase CLI 2.116.0 database lint passed public/private/audit schemas. No CLI upgrade ran.
- Migration executor regression: three real transaction cases verify restoration of the original execution role and exact existing/absent membership options. The defect was observed failing before correction. PostgreSQL membership-option semantics were checked against the [PostgreSQL 17 GRANT documentation](https://www.postgresql.org/docs/17/sql-grant.html).
- Broad test qualification required complete public snapshots, the correct disposable database declaration and local fixture administrator. The RLS test now asserts restoration of its actual initial executor, keeping null-claims/API-role/one-owner checks. The concurrency fixture opens its 25 real clients before the same 25 business transactions; report fixture seeding precedes the tested concurrent insert. Runtime connection/query deadlines are unchanged. Earlier failures remain archived.
- Each whole API run receives fresh global AI state. Previous synthetic databases, including failed attempts, are retained under recorded names/OIDs. A synthetic restore attempt exposed orphan cursors from fixture teardown and rolled back; it is not customer restore proof. The final fresh run passed. Only the owned loopback relay CPU allowance changed; its isolation, identity, memory/PID limits and all application/server policy remained intact.

## Remaining gates

Qualify the 132 opt-in API cases on separately admitted targets. Complete the functional acceptance ledger and owned cleanup review, including consent-journal cleanup, in-flight source mutations, fixture teardown integrity and foreign/unattributed legacy records inside an owner database. Voice001 remains unresolved and must not be replayed.

Hosted current-restore/compatibility, backup/rollback and deployment approval, signer-transition qualification, exact final APK, actual Redmi capture-to-Ledger acceptance and independent fresh Google OAuth remain required. Production readiness, unrestricted customer workflows and final installed/delivery/source equality have not been established by these local checks. Benchmark, development automation and the closed comparisons were not resumed; no hosted or primary-phone state was changed.
