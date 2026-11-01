# Governed Admin AI Usage Limits

Approved scope: add controls within the existing Admin dashboard/settings design; independently govern Chat and Voice provider admission. No Mobile changes, financial writes, provider-route activation, worker configuration, Posting change, or Production deployment.

## Settings and enforcement

| Key | New-install default | Staging before deployment |
| --- | --- | --- |
| ai.user.rolling_limit | 5 | 15 (v2) |
| ai.chat.rolling_limit | existing legacy limit, otherwise 5 | pending migration; inherits 15 |
| ai.voice.rolling_limit | existing legacy limit, otherwise 5 | pending migration; inherits 15 |
| ai.chat.monthly_limit | null (no monthly cap) | pending migration |
| ai.voice.monthly_limit | null (no monthly cap) | pending migration |
| ai.chat.enabled | true (quota admission only) | pending migration |
| ai.voice.enabled | true (quota admission only) | pending migration |
| ai.chat.user_override | {} (governed command; selected user policy in private table) | pending migration |
| ai.voice.user_override | {} | pending migration; carry over existing authorized Voice owner limit 30 |
| ai.global.monthly_budget | existing 200 USD default | preserve 2 USD (v2) |

Daily windows are rolling 24 hours. Monthly user windows use UTC calendar months. Null override fields inherit feature defaults; both null remove an override. Changing the legacy fallback no longer changes Chat or Voice defaults. Accepted operations retain replay/recovery access when new admission is disabled. Reservations, failed/unknown holds, price checks and project budget locks remain enforced. Deterministic Assistant answers bypass provider reservation.

Read: GET /api/v1/admin/ai/usage-limits with optional bounded userId. Requires operations.settings.read; audit history requires audit.read. Returns only quota keys, separate effective usage, estimated/reserved costs and the latest 20 relevant changes. No secrets or provider configuration.

Write: existing PATCH /api/v1/admin/settings/:key. Requires operations.settings.manage and ai.routes.manage, recent Clerk authentication, expectedVersion, reason and idempotency key. Override changes and setting versions/audits commit in the same transaction. Application roles cannot directly mutate overrides.

## Delivery sequence

- [x] Generate forward migration with Supabase CLI.
- [x] Reproduce missing governance/read contracts in failing tests.
- [x] Add independent counters, monthly limits, enable switches, owner-bound overrides and accurate before/after auditing.
- [x] Add Admin editors using existing classes/navigation and real session permissions.
- [x] Prove duplicate form submits issue one governed write; surface conflict/recent-auth errors.
- [x] Apply the complete migration against a fresh disposable local database.
- [x] Validate focused database, API contract/security and Admin test suites.
- [ ] Finish build and deployment gates; publish scanned candidate image.
- [ ] Record current Staging schema/API/Admin/Posting/worker/monitor identities.
- [ ] Apply only the new schema migration through the release migration runner.
- [ ] Produce hash-bound cross-feature compatibility receipt; deploy API in preserve mode.
- [ ] Build/deploy Admin with existing Staging environment; preserve auth configuration.
- [ ] Verify source/build/version correspondence before browser testing.
- [ ] Use real Admin UI to change only Chat daily limit, verify Voice unchanged, then restore the original Chat value.
- [ ] Bound one selected-user Chat quota at existing usage, prove a real Samsung advice request is denied without a provider call, and prove a deterministic read succeeds without quota consumption; restore override through UI.
- [ ] Verify audit history, unchanged project cap, financial counts, Posting and all worker/monitor states.
- [ ] Save screenshots and final exact source/default/Staging values with remaining acceptance gaps.

Local validation is not Staging acceptance. Do not label deployment or runtime enforcement complete until the real UI and Samsung steps above are observed.
