# Quickstart: Validate Spec 009

Use this guide after implementing Phase 8. It defines the required contract,
route, workflow, permission, privacy, accessibility, performance, and final
verification evidence. Planning alone does not satisfy these checks.

## Prerequisites

- Work from `apps/admin-web`.
- Use the existing installed dependencies and approved project configuration.
- Confirm `.specify/feature.json` points to
  `specs/009-admin-system-health-and-jobs`.
- Keep `NEXT_PUBLIC_ENABLE_MOCKS=true` only for the local mock runtime.
- Do not configure real monitoring, providers, Supabase, Redis, BullMQ,
  workers, schedules, Sentry, storage, authentication, database, or backend services.

## Contract and model references

- [Specification](./spec.md)
- [Implementation plan](./plan.md)
- [Research decisions](./research.md)
- [Frontend data model](./data-model.md)
- [OpenAPI mock contract](./contracts/admin-system-health-jobs.openapi.yaml)

## Focused commands

Run after changing Phase 8 code:

```powershell
npm run test -- src/core/permissions/role-map.phase8.test.ts src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts src/features/system-health/contracts.test.ts src/mocks/phase8-system-health-state.test.ts src/features/system-health/repository.test.ts src/features/system-health/hooks.test.ts src/features/system-health/OperationsViews.test.tsx src/tests/no-direct-fixtures.test.ts
npm run test:e2e -- tests/e2e/system-health-jobs.spec.ts
```

Expected result: exit code 0 with no failed focused tests. Record actual
file/test/pass/skip/fail counts; never infer them.

## Route matrix

Verify these nine routes:

```text
/admin/system-health
/admin/system-health/api
/admin/system-health/database
/admin/system-health/storage
/admin/system-health/providers
/admin/jobs/queues
/admin/jobs/runs
/admin/jobs/runs/JOB-DEMO-FAILED-01
/admin/jobs/scheduled
```

For every route, capture page and console errors and verify default plus
relevant loading, empty, partial, stale, offline, error, forbidden, not-found,
conflict, and success states.

## Primary journey checks

### Assess platform health

1. Open Health Overview at the default 24-hour range.
2. Verify all 12 approved services show status, uptime, latency, error rate,
   last incident, last check, freshness, units, text, and icon or explicit unavailable state.
3. Switch through 1h, 24h, 7d, and 30d and verify URL state and chart summaries.
4. Verify outage/degraded/stale services appear before healthy services without
   the frontend calculating a replacement overall status.
5. Open an authorized incident reference and return with filters preserved.
6. Provide missing, reversed, and expired `observedAt`/`staleAt` values and
   verify Unknown, Unknown, and stale respectively.

### Diagnose API, database, and storage

1. On API Monitoring, verify request volume, error rate, latency, normalized
   endpoint groups, status-code distribution, units, range, and freshness.
2. Confirm endpoint labels contain no query strings, IDs, hosts, headers,
   request/response bodies, tokens, or customer values.
3. On Database Monitoring, verify connection usage, query latency, safe
   slow-query groups, storage, backup, and recovery state.
4. Confirm no raw SQL, parameters, table contents, connection values, or plans.
5. On Storage Monitoring, verify usage, uploads, failures, temporary-file
   counts, and cleanup state without names, keys, buckets, URLs, checksums, or contents.

### Review external providers

1. Filter Stripe, AI, Email, Push, and Exchange Rates by category and status.
2. Verify status, latency, error rate, last success, last check, freshness,
   capabilities, safe errors, impact, and fallback state.
3. Apply All/iOS/Android to attributable impact and confirm provider
   availability remains global.
4. Verify Billing, AI, and Content operators receive only their assigned
   providers and no hidden full-provider fields.
5. Confirm no edit, credential, endpoint, webhook, model, fallback-priority, or
   provider-operation control exists.

### Find a queue backlog and job

1. Verify Imports, AI Processing, Notifications, Reports, Data Exports,
   Account Deletion, and Subscription Reconciliation queues.
2. Verify Waiting/Active/Delayed are labeled snapshot counts and
   Completed/Failed/Retried are selected-range counts.
3. Verify oldest waiting age, throughput, failure rate, last processed time,
   backlog state, freshness, and unavailable behavior.
4. Filter Job Runs by range, platform, queue, state, app version, and search.
5. Find `JOB-DEMO-FAILED-01` by correlation ID and open its safe detail in under two minutes.
6. Confirm queue summaries match current run state after every mutation and reset.

### Retry and cancel safely

1. As Super Admin or an assigned domain operator, open an eligible Failed job.
2. Enter fewer than 10, more than 500, whitespace-only, control-containing,
   HTML-like, and valid reasons; only the valid plain-text reason proceeds.
3. Confirm retry names the source, queue, consequence, and duplication risk.
4. While pending, verify the button locks and 60-second refetch pauses.
5. Verify the Failed source remains unchanged and exactly one linked Waiting
   run appears with attempt +1, `retryOfJobRunId`, and planned audit reference.
6. Repeat with the same submission key, a stale version, and a second operator;
   verify current state or safe conflict and no second linked run.
7. Cancel eligible Waiting and Delayed jobs with the same confirmation/lock rules.
8. Reject cancellation for Active, Completed, Failed, Cancelled, Unknown,
   unauthorized, or stale jobs.

### Review scheduled processing

1. Search/filter/sort schedules by queue, enabled state, and last state.
2. Verify job name, human-readable schedule, last run, next run, last state,
   enabled state, freshness, and clear absent values.
3. Verify domain operators receive only assigned schedules.
4. Confirm no create, edit, enable, disable, delete, run-now, or mutation endpoint exists.

## Refresh and freshness checks

- Use fake timers in Vitest to verify one read refetch every 60 seconds.
- Verify no automatic refresh while the document is hidden, browser is offline,
  or a retry/cancel dialog is pending.
- Verify manual refresh remains available when online and never calls the
  removed legacy refresh POST.
- Resume from hidden/offline/pending state and verify one announced refresh,
  not a burst of accumulated timers.
- Verify zero remains zero while missing and partial metrics remain unavailable.

## Permission and cache matrix

- **Super Admin**: all nine routes and eligible retry/cancel actions.
- **Security Administrator**: all nine read routes; no retry/cancel action.
- **Billing Operator**: Stripe and subscription-reconciliation projection;
  eligible reconciliation retry only.
- **Import Operator**: import service/queue/run/schedule projection; eligible
  import retry/cancel only.
- **AI Operator**: AI provider/queue/run/schedule projection; eligible AI retry/cancel only.
- **Content Manager**: email/push/notification projection; eligible
  notification retry/cancel only.
- **Support Agent**: linked safe status inside a prior authorized ticket only;
  no direct Phase 8 route.

For every role, verify navigation, direct route denial, structural response
projection, hidden/disabled actions, and direct mock mutation returning safe
403. Switch from Super Admin to every lower-privilege role and verify protected
Phase 8 query data is removed immediately.

## Platform and counting checks

- Verify All, iOS, Android, Unknown, and global/not-applicable observations.
- Confirm global services, providers, queue existence, and schedules do not
  change when mobile platform changes.
- Confirm only attributable jobs, failures, imports, notifications, and impact
  respond to the platform filter.
- Confirm job/event/request counts are additive only when one record has one origin.
- Confirm unique affected-customer totals are authoritative and deduplicated.
- Confirm missing platform series is unavailable, not zero, and does not create
  a calculated combined total.

## Privacy and security checks

- Search changed production source for `dangerouslySetInnerHTML`, raw HTML or
  Markdown rendering, recursive JSON, debug logging, browser persistence,
  public environment leaks, `any`, unsafe links, real provider/queue clients,
  `Date.now()`, `Math.random()`, and dependency changes.
- Verify strict parsing of route IDs, range, platform, filters, pagination,
  search, sort, expected version, reason, submission key, mock response,
  freshness, metadata, and linked references.
- Verify structural role projections are built from allowlisted fields and not
  by cloning a full protected record and deleting keys.
- Confirm no raw query, SQL, log, stack, path, host, port, IP, file, object key,
  payload, message, AI content, payment data, provider response, token,
  credential, secret, customer content, or unauthorized record existence.
- Verify external links are allowlisted HTTPS and prevent opener access.
- Confirm no upload, download, Blob, object URL, filesystem, database, provider,
  worker, schedule, or real queue operation occurs.

## Responsive, direction, and accessibility checks

Run the route and primary-journey matrix at:

```text
1440 × 1000
1280 × 900
1024 × 900
768 × 1024
390 × 844
```

- Arabic is RTL by default; switch to representative English and verify LTR readiness.
- At 390px preserve incidents, service/provider state, queue backlog, failed
  job lookup, correlation ID, and permitted retry/cancel confirmation.
- Complex endpoint/query/metadata detail may show the approved desktop-required
  notice while preserving urgent summaries and actions.
- Verify landmarks, headings, tables/cards, chart summaries, labels, units,
  freshness, 44px targets, focus trap/restoration, live feedback, non-color
  state, identifier direction isolation, and reduced motion.
- Verify polling and refreshed content never move focus or force a screen-reader
  announcement unless freshness or user-visible data actually changes.

## Performance checks

- Measure 20 standard route samples; at least 95% show usable content within 2 seconds.
- Measure 20 standard filter/sort/pagination/range samples; at least 95% complete within 1 second.
- Verify page size never exceeds 100 and long lists remain responsive.
- Report labeled slow scenarios separately.

## Required final verification

Run from `apps/admin-web`:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Record exact exit codes, Vitest file/test counts, Playwright pass/skip/fail
counts, generated route output, and warnings. Completion requires every command
to succeed and all nine Phase 8 routes to appear in the production build.
