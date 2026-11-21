# Admin Dashboard Recovery Implementation Plan

**Goal:** Deliver the user-approved Arabic plan from the 2026-10-23 chat: truthful Admin data, functioning filters/actions, essential customer and permission management, a complete mobile/Admin support workflow, and a coherent responsive UI.

**Architecture:** Preserve Next.js, NestJS, Clerk and Supabase. Repair the existing repository/service/SQL boundaries and add missing essential APIs. New migrations are additive; the installed mobile client remains compatible. No paid billing or advanced marketing launch.

**Authority:** The user's complete approved plan in this chat is the specification. This file decomposes its five phases into independently reviewed implementation tasks; it does not narrow the requested scope.

## Global constraints

- Work only in `D:/Masarifi-integration-2026-10-10`, branch `codex/voice-promoted-operating-2026-10-13`.
- Never change financial posting or Voice behavior. No shared-environment deployment, hosted migrations, provider mutations, phone installation, or real customer write tests in this implementation run.
- Keep the existing recent-primary-login policy; do not reintroduce the superseded MFA requirement.
- Never replace missing measurements with zero, invented freshness, fixture values, or a different measurement under the original label.
- Private customer financial data remains behind the separately approved, expiring, audited support-access scope. Do not widen general table access to make an Admin page work.
- Use installed dependencies and existing patterns. Read `apps/admin-web/AGENTS.md` and relevant bundled Next.js docs before UI edits.
- Every confirmed regression gets a failing behavior test before the implementation. Database behavior must be verified with real migrations on an isolated database where infrastructure is available.
- Agent reports record RED/GREEN commands, coverage limits, files and commits. Only one implementation subagent runs at a time; the controller owns independent task/final reviews.
- Admin tests run with one worker (`node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism`); default parallel workers previously exhausted memory. Do not run several heavy suites together.

## Review focus

- Actual zero versus unknown data, stale providers, historical periods before collection starts.
- Customers without devices, unknown country/platform/risk, deleted lifecycle states, and multi-platform deduplication.
- Permission denial, ownership, retry after timeout, changed payload with reused idempotency key, and revision conflict.
- Server filters plus cursor/cache isolation, exact date boundaries and currency scale.
- Mobile support round trip, private notes/attachments, responsive navigation and keyboard focus.

### Task 1: Truthful overview, activity measurement and correct reports

**Own:** `apps/api/src/reports/**`, related report unit/contract/integration/security tests, `apps/admin-web/src/features/overview/**`, `apps/admin-web/src/app/admin/page.tsx` and overview tests, report-specific additive migrations and SQL tests; minimal authenticated mobile activity integration (coordinate any identity hook through a separate focused helper).

**Requirements:**
- Remove `metricValue` constants for mrr/imports and fixed paid ratio. Derive available values from responses; translate plans by their actual keys, not array index.
- Extend Admin metric/analytics types and Zod schemas for null/unavailable values with scope, period and actual observation metadata; render missing regions coherently, without blank full-height chart cards or invented trends.
- Replace `ReportsService.getAdminPlatformAnalytics` lifetime device counts masquerading as DAU/MAU, hardcoded new-user/error zeroes and synthetic freshness. Return authoritative registered/new customer counts, device/platform/version distributions and available imports/AI/support counts.
- There is no complete historical activity source: profiles.last_seen_at only updates on profile fetch and devices.last_seen_at on registration. Add minimal coarse authenticated MOBILE-only activity collection with retention, no content/bodies, multi-device/platform deduplication, collection-start metadata, UTC timestamps and reporting timezone from system settings. Do not backfill invented activity; Admin/web traffic must not count. Define daily users by the reporting day and monthly users by a rolling 30-reporting-day window.
- Reuse the canonical transaction source for exact start-inclusive/end-exclusive support-report ranges rather than full monthly boundary buckets. Preserve grant enforcement.
- Export each requested dataset (overview, analytics, activity) with meaningful type-specific CSV columns and rows; normalize currency/currency_code and minor-unit scale for supported financial PDF exports, never force SAR for USD/AED/etc.
- Map the actual emitted audit action names; distinguish deletion requested/cancelled/completed and include role/support decisions.
- Keep public/mobile existing report responses backward compatible. New SQL goes into fresh CLI-created migrations; update checksum manifest using the existing command.

**Acceptance:** Values 0/12/1234 remain correct; unknown is visibly different from zero; platform totals deduplicate; no activity before collection start; seeded active events yield correct daily/monthly membership; CSV includes actual rows; USD stays USD; seven-day ranges exclude outside transactions; permission/grant denials remain intact.

**Verify:** Focused report API and Admin overview tests first, TypeScript for both apps, isolated SQL integration if available. Record all unverified infrastructure gates.

### Task 2: Safe governance, idempotent security and truthful operations

**Own:** `apps/api/src/security/**` for replay and existing live security route wiring needs, `apps/api/src/operations/**`, `apps/admin-web/src/features/governance/**`, `apps/admin-web/src/features/system-health/**`, `apps/admin-web/src/features/security/**`, operations/security/governance tests and additive migrations. Do not implement customer user APIs here (Task 4).

**Requirements:**
- FeatureFlagCard rollout-only edits must preserve current audience/platform rules; remove hardcoded all_customers submission. Restricted audiences never get defaultEnabled:true. Support existing representable combinations faithfully and explicitly reject unsupported combinations; do not silently widen them.
- Use existing durable claim/complete idempotency helpers for security mutations that accept a key, within the relevant transaction. Scope by principal+operation; equal replay returns original result, changed payload conflicts. Cover incidents and support-access requests plus the other accepting mutation branches.
- Correct unknown/stale provider aggregate status and completeness. API monitoring must use HTTP telemetry or say unavailable; job P95 remains job P95. Serialize provider-status enums correctly.
- Query current maintenance directly or with a bounded explicit server current filter, not only first100 historical windows. Add working bounded server pagination to job runs/schedules and remove fetch-all/slice behavior in touched operations/governance lists.
- Wire existing support-access, audit, security/privacy APIs into live repositories where they currently return unavailable, preserving exact permissions, recent login, customer consent, separate approver, scope, expiry and revocation. Do not expose unsupported controls as successful actions.
- Existing Admin team/role APIs stay authoritative. Preserve last-super-admin and protected-system-role rules.

**Acceptance:** Internal-only flags stay off externally at0/100%; retry creates one record and mismatch conflicts; unknown/stale never appears fully operational; current maintenance is found beyond100 historical rows; job rows beyond25 are reachable; denied/expired/revoked access cannot expose data.

### Task 3: AI and import filters, pagination and revision workflows

**Own:** `apps/api/src/ai/**`, `apps/api/src/tracking/**`, `apps/admin-web/src/features/ai/**`, `apps/admin-web/src/features/imports/**`, import route pages as needed, related tests and fresh SQL migrations. Do not change Voice extraction/posting or financial transaction behavior.

**Requirements:**
- Implement real supported AI list filters and AI overview platform/7d/30d/90d scope end-to-end: UI -> repository serialization -> DTO/service -> SQL. Cursor and cache scopes include normalized filters; don't fetch fixed30d globals under different labels.
- Return actual attempts/fallback counts and observation time only if measured; otherwise null/unavailable with compatible schema/UI changes.
- Forward import landing query/source/status/severity supported semantics through the adapter; map query/search intentionally. Implement real platform aggregation or disable unsupported options explicitly rather than a guaranteed live503 selection.
- Use server bounded filtering/pagination rather than fetching every cursor before displaying a page. Wire failure lists where backend capability exists; deployment-only parser settings must be explicit/read-only rather than pretend saves.
- Expose parentRuleVersion separately from parser versionNo and use the parent revision for publish/retire/rollback.
- New AI prompt drafts must have a governed path to valid test cases, evaluation and publish. Clone approved workload test cases to each draft, preserving immutable evaluation provenance and gates.

**Acceptance:** iOS7d and Android90d issue distinct requests and yield seeded scoped results; all enabled filters affect result set; stale cursor reset; no fake fallback0; source/search filter reaches result; publish v1 then retire/rollback uses current parent revision; a newly created prompt can evaluate and publish only after passing tests.

### Task 4: Essential live customer users, devices and sessions

**Own:** New customer Admin controller/service/repository under identity (or focused customer-admin files), `apps/api/src/identity/**`, API module registration as necessary, `apps/admin-web/src/features/users/**`, user/access route pages, related tests and new SQL migrations. Coordinate any already-changed identity telemetry code from Task1.

**Interfaces:** Existing frontend `/api/v1/admin/users` list/detail, `/users/:userId/devices`, `/users/:userId/sessions`, `/suspend`, `/reactivate`, `/devices/:deviceId/revoke`, `/sessions/revoke`; preserve existing names where possible. Permissions: users.read, devices.read/revoke, sessions.read/revoke, users.status.manage mapped to existing canonical permissions.

**Requirements:**
- Implement bounded parameterized safe projections and actions with server permission checks. Return masked contacts, true lifecycle/locale/timestamps/device counts and available diagnostics; never fingerprint/push tokens/private Clerk session linkage or ordinary financial details.
- profiles.status is local Masarifi suspension authority. Atomically suspend, audit and queue durable session revocation; provider failure is pending/failed, never fake success. Reactivate only suspended -> active; protect Admin accounts through their existing Admin lifecycle.
- Reuse verified Clerk session adapter semantics and device+push revocation patterns, with durable retry for all-user commands. Add sanitized target-bound session listing; do not impersonate target principals or create a second session authority.
- Use permission-checked projection/command functions without unrestricted customer-table grants or public security-definer exposure.
- Correct fixture-bound frontend schemas: actual masked email domains; no-device customers; nullable activity/primary platform; unknown country/risk; actual deletion lifecycle states. Verification is read-only authoritative Clerk state.
- Disable unsupported manual verification, bulk actions and no-op export until an implemented safe contract exists. Fix touched localization and action feedback.

**Acceptance:** Real API responses render users without fixtures, no-device and Egypt/unknown country cases parse, exact permissions/ownership hold, suspension blocks usage immediately, provider failure is truthful/retryable, deleted account cannot reactivate, revoked device loses push/session access, Admin safeguard remains.

### Task 5: Complete Admin/mobile support workflow

**Own:** `apps/api/src/engagement/**`, `apps/admin-web/src/features/communications/**`, support/feedback/content/notification route fixes strictly needed for support, `apps/mobile/app/support/**` and existing support screens/services, relevant tests and fresh SQL migrations.

**Requirements:**
- Wire existing ticket list/detail/paginated messages/assignment/priority/reply/internal-notes/resolve/close/reopen APIs. Use a ticket-specific conversation UI, not the current generic body+resolve detail.
- Project assigned Admin and minimal safe customer reference; implement server search/status/priority/assignee/category/date filters and bounded pagination. Add actual support workload aggregate overview.
- Remove fixture-mode blocks from mobile ticket history/detail/reply/context-report routes in favor of actual service capability availability. Reuse existing live services and preserve drafts/conflicts/offline behavior.
- Add Admin attachment download route: ticket-detail permission, ownership linkage, clean scan state, audited access, short-lived signed URL. No private note leakage to owner API; unsafe attachments metadata-only.
- Mobile-width cards must link to the same safe detail; category links must resolve or become inline actions.
- Paid billing and advanced campaign creation remain deferred. No fixed CMP-1001 creation-success link or enabled fake action.
- Task6 exposes support navigation only after this task's end-to-end contract and local acceptance pass.

**Acceptance:** Customer creates -> Admin sees/assigns/replies -> customer reads/replies; internal note absent from owner response; conflict retains draft; filters find rows beyond25; clean authorized attachment downloads and cross-ticket/unsafe attachment is denied; mobile details reachable.

### Task 6: Coherent navigation, responsive shell and full integration verification

**Own:** `apps/admin-web/src/components/admin/**` shared shell/DateRangeControl (avoid overwriting task-specific components), foundation navigation/localization/config, globals.css, cross-app E2E tests, deployment environment examples, docs evidence. Reconcile and review all previous tasks.

**Requirements:**
- Organize live navigation into overview, customers/support, imports/AI, health/jobs, governance; only expose completed capability/permission-backed destinations. Deferred billing/marketing remain clearly unavailable.
- Remove disconnected duplicate Shell date filter. Fix controlled custom-date expansion; pages offer custom only where their real API accepts it. Preserve one working page-scoped period filter.
- Preserve current brand fonts/colors; reduce empty/full-height unavailable cards and prioritize real actionable metrics/tables. No image-generation dependency or replacement visual world.
- Fix mobile modal drawer initial focus, aria-modal, background inertness, Tab trapping, Escape and return focus; visible compact environment indicator reflects actual development/staging/production independently of mock/live mode.
- Localize touched English/Arabic labels and implement loading/empty/error/conflict states. Remove no-op controls and broken links across essential surfaces.
- Add meaningful live-contract browser journeys (HTTP boundaries backed by seeded isolated API where available), not only MSW fixture journeys. Test1440/1280/768/390, light/dark, Arabic/English, keyboard and text scaling.
- Run full Admin suite/typecheck/lint/build using temporary process env rather than storing credentials; API checks, migrations/checksums/RLS/upgrade and mobile compatibility checks. Do not fake unavailable DB/provider/live gates.
- Produce docs evidence: prioritized repaired findings, page->API->source capability matrix and verification receipts. Authenticated Staging inspection remains required before deployment acceptance; Cloudflare and failed CUA access are existing constraints, not permission to bypass.

**Acceptance:** Every shown metric has source/scope, every enabled filter affects requests/results, every visible action works or explains unavailability, essential users/security/support operate without fixture mode, no new financial/Voice behavior, and all available verification passes. Clearly report any remaining external acceptance gates.
