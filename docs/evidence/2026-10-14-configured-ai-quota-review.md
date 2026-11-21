# Configured AI quota contract and dashboard verification

Reviewed 14 October 2026 (Riyadh) on codex/voice-promoted-operating-2026-10-13 in D:/Masarifi-integration-2026-10-10. Parent is Tracking repair commit 1db14f1d902bc38aa57c64361d3b500049e5003c.

The preserved exception-filter patch exposes only valid quota limit, used count and reset time, including a configured limit of 50. It does not increase any quota, change provider configuration or enable financial posting. Limits remain integers from 1 through 1000, matching the governed daily-limit validator. Private provider/owner fields remain excluded.

## Repaired contract mismatch

The approved QuotaError schema previously fixed limit to 5 and used to at least 5. Actual safeError responses for limits 1,15,30,50 and1000 failed schema validation. Failing contract regressions reproduced the defect before the schema change. The schema now documents limit1..1000 and a positive safe-integer used count. Tests exercise both AI_QUOTA_EXCEEDED and AI_BUDGET_EXHAUSTED, preserve legacy5, and reject invalid/out-of-range limits and extra private metadata.

## Dashboard behavior verified locally

Page: /admin/system-health/ai-usage-limits (AI Usage Limits).

- Global Chat and Voice rolling limits can be edited independently. Consecutive UI edits30→50→1000→1 submit the current version, refresh effective values, preserve the other feature and survive component reload.
- A selected user's Voice override can be changed30→50. Clearing it restores the global default without changing the global setting or Chat.
- Existing per-user overrides take precedence: changing a global limit alone does not replace a user's explicit override. Edit that override or clear it to inherit the default.
- Daily limits are1..1000. Existing monthly limits allow1..1000000 or blank for no global cap; a blank user override inherits the global setting.
- Editing requires operations.settings.read, operations.settings.manage and ai.routes.manage, recent authentication where required by the API, and a reason of10..500 characters. Version conflicts refresh values without blind retries. Existing idempotency, audit and permission safeguards remain.

The actual dashboard components and HTTP client were exercised against a stateful mock HTTP boundary. A separate fresh, financially disposable PostgreSQL database applied the complete111-migration chain and verified the real governed settings command, dashboard readback and quota admission. Stored values15,30,50,1000 and1 reached the actual quota check for both features; decreasing a limit retained usage and correctly blocked additional admission. Audit count matched the five setting writes. Existing coverage includes monthly caps, independent counters, overrides, permissions, stale versions and idempotent retries.

## Results

- API checks:74 tests passed across the exception filter, real-output AI contract instances, OpenAPI drift and operations read contracts.
- Dashboard quota tests:20 passed, including consecutive edits, reload, independent features, user overrides, inheritance, validation and read-only permissions.
- Real database quota/governance tests:26 passed. Each setting scenario rolled back its synthetic changes; the disposable server was stopped cleanly.
- API and dashboard type checks passed. Scoped API/dashboard lint passed. Git whitespace checks passed.

## Preserved historical documentation and limits

The three pre-existing profile/recovery/Redmi reports are retained as dated historical evidence. Their STOP/OFF, source, installation and acceptance statements describe their stated11–12October checkpoints, not current live service state and not authority to repeat those operations. Original documents and the pre-existing source/test patch were preserved; only the companion contract/tests and this review record were added. The bounded credential-signature scan found no JWT, private-key, GitHub-token, provider-key or literal-bearer signatures in those reports. Raw receipts, recordings, backups, credentials and private logs remain outside Git.

No hosted dashboard session, Staging change, provider call, device operation, deployment, new quota value on a real owner or posting activation occurred. Code/test verification is local; the new API error-envelope behavior still needs a separately authorized deployment before it can be claimed for the hosted runtime. No automatic rollout or deployment is triggered by this commit's branch/path changes.
