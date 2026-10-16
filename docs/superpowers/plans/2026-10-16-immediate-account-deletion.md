# Immediate account deletion implementation plan

> For agentic workers: implement the assigned components in the same worktree and branch, with red/green tests and review before hosted qualification. The user's explicit autonomous-work instruction waives routine design approval gates.

**Goal:** In DEV/Staging, confirming deletion starts complete owner-payload erasure immediately, without an artificial cooling period; only actual durable completion permits success and local erasure.

**Architecture:** A zero-hour policy invokes the existing exact-request deletion executor after its request transaction commits. A dedicated worker-role pool keeps the API login's grants unchanged. A client-generated capability, persisted securely before submission and stored only as a server hash, recovers completion even when the deliberately revoked Clerk session or interrupted response is unavailable. Supplemental request-bound SQL and storage cleanup remove owner payload data before identity deletion; minimal technical tombstones and completion evidence prevent resurrection and late media reupload.

**Stack:** Existing NestJS/PostgreSQL/Clerk and Expo/React Native; no new dependencies.

## Constraints and acceptance

- Same `D:/Masarifi-integration-2026-10-10` / `codex/voice-promoted-operating-2026-10-13`.
- DEV/Staging only; ordinary application and Production remain untouched; original Voice stays ON Posting.
- Existing positive cooling policies retain their behavior. Zero policy and full payload cleanup are enabled only in the isolated DEV runtime for this qualification.
- No global role escalation, trigger disable, unrestricted deletion, timestamp backdating or fake completion.
- The protected owner's shared identity is not an isolated DEV identity: deleting it affects the ordinary app. Tests use verified disposable Development subjects until that impact is explicitly resolved with the user.
- Existing in-flight one-hour disposable test may finish under its original policy; it does not prove immediate deletion.

## Tasks and ownership

- [x] Root: permit explicit zero policy; require dedicated privacy database URL and handler manifest for zero-policy API; prove existing positive API configuration remains valid.
- [x] Execution implementer: committed owner/request/operation receipt binding, exact-request inline execution, request-specific processing lease, retryable failure and a dedicated capability status endpoint. POST remains202 and returns the actual existing deletion schema; recovery GET `/api/v1/privacy/deletion-completions/:operationId` returns only `{id,status,completedAt,errorCode,version}`. Capability is32 random bytes represented as64 lowercase hex; only its hash is stored server-side; invalid/unknown/expired capability is404. Expiry24h, bounded status rate.
- [x] Data implementer: freeze owner writes at claim, block in-flight writer races, supplemental report/export object cleanup and complete owner SQL payload erasure with request/owner/transaction-bound privileged functions. Preserve foreign owners and shared reference rows; handle immutable ledger/planning/tracking/AI evidence through narrow DELETE-only gates; verify residuals. Existing Clerk identity deletion remains last.
- [x] Local storage implementer: queued exact-owner encrypted SQLite/WAL/SHM and SecureStore key purge; no global reset and no other-owner file/key effects. Callable `eraseDeletedAccountLocalData(ownerId)`. Native tracking namespace/key cleanup is being completed in the mobile integration task.
- [x] Mobile implementer: persist operation+capability securely before dispatch, fresh authenticated mutation with actor fences, completion-only acceptance despite intentional session revocation, capability-only recovery after response loss/relaunch/logout, owner-safe local purge, explicit processing/failure UI and irreversible confirmation. Gate this behavior to the isolated DEV Privacy runtime so existing ordinary APIs remain compatible.
- [x] Root integration: focused tests/typechecks/lint/boundaries, real isolated SQL role/owner/race tests, independent review, final frozen API/mobile suites. Commit source before building isolated runtime.
- [ ] Root hosted qualification: review new migrations and container payloads against current pins, deploy only isolated DEV API/scoped worker and route, test newly marked disposable identity containing representative financial/planning/report/Voice data, native confirm=>immediate completion, response loss/status recovery, real provider absence, exact owner payload removal and unchanged protected owner/ordinary/Voice. Document any retained technical fences precisely.

## Review focus

Wrong token or another owner must never reveal status or delete data. A stale writer must not recreate erased rows. Failed object removal must retain references for retry. Provider timeout, lost response and Clerk logout must not fabricate success or resend a new operation. Switching owners while deletion completes must never sign out or erase the new owner. Local deletion must be retryable without reopening the erased file.

Backend source qualification at `577defc5`: 296 suites / 2,076 tests passed; eight existing environment-gated ledger security tests were skipped. This includes the real Staging regression where missing Storage objects return HTTP400 with `NoSuchKey` and semantic status404; Reports and Support now accept this precise absence response while unrelated failures remain failures. Voice storage was unchanged. Independently, all 29 tests across the three actual local PostgreSQL integration suites passed, including complete populated financial erasure, owner isolation, immutable-history protection, receipt recovery, provider failure and late retention-hold races. Typecheck and migration-manifest verification passed.

Mobile source qualification at `68b850a3`, unchanged by the storage repair: 493 suites / 3,311 tests passed, plus 34 native Android tests across six classes. The private DEV APK was installed separately, genuine Clerk Development authentication and profile setup completed, and the actual confirmation dialog was inspected and cancelled before deletion. Representative SQL payload and three real synthetic Storage objects were seeded and verified. Hosted and native immediate-deletion acceptance remains pending until the new runtime is published and the actual confirmation flow completes.

The repaired API and scoped worker were published to the existing DEV Privacy prefix. Native testing then reproduced a separate recent-auth regression: Clerk refreshed its session resource while preserving the session ID, owner and active status, but the client rejected the new object reference. The fix checks stable session identity and uses the current SDK resource at each verification step. The complete mobile suite now passes 493 suites / 3,314 tests with zero failures or skips; typecheck, scoped lint and app-shell boundaries pass. Native verification and final erasure acceptance remain pending on this latest JavaScript revision.
