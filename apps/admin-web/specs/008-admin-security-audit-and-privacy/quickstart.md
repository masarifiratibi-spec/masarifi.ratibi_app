# Quickstart: Validate Spec 008

This guide defines the final reconciled implementation verification for Spec
008. The task ledger uses consolidated tests where the final architecture does
not include the originally planned micro test files.

## Prerequisites

- Work from `apps/admin-web`.
- Use the existing installed dependencies and approved project configuration.
- Confirm `.specify/feature.json` points to
  `specs/008-admin-security-audit-and-privacy`.
- Keep `NEXT_PUBLIC_ENABLE_MOCKS=true` only for the local mock runtime.
- Do not configure real authentication, risk, audit, storage, export, deletion,
  cleanup, queue, job, database, or provider infrastructure.

## Contract and model references

- [Specification](./spec.md)
- [Implementation plan](./plan.md)
- [Research decisions](./research.md)
- [Frontend data model](./data-model.md)
- [OpenAPI mock contract](./contracts/admin-security-audit-privacy.openapi.yaml)

## Focused commands

Run after changing Phase 7 code:

```powershell
npm run test -- src/core/permissions/role-map.phase7.test.ts src/components/admin/AdminShell.test.tsx src/components/admin/shell-state.test.ts src/app/QueryProvider.test.tsx src/features/security/contracts.test.ts src/mocks/phase7-security-state.test.ts src/features/security/repository.test.ts src/features/security/hooks.test.ts src/tests/no-direct-fixtures.test.ts
npm run test -- src/features/access/access-workspace.test.tsx
npm run test:e2e -- tests/e2e/security-audit-privacy.spec.ts
```

Expected result: exit code 0 with no failed focused tests. Record actual
file/test/pass/skip/fail counts; do not infer them. The final Playwright file is
tagged in test titles for US1, US2, US3, US4, US5, responsive, direction, role
change cache, deletion, retention, and billing/support denial evidence.

## Route matrix

Verify these 14 routes:

```text
/admin/security
/admin/security/authentication-events
/admin/security/suspicious-activity
/admin/security/admins
/admin/security/permission-changes
/admin/security/support-access
/admin/security/incidents/INC-1001
/admin/audit
/admin/audit/AUD-1001
/admin/data-requests/exports
/admin/data-requests/exports/EXP-1001
/admin/data-requests/deletions
/admin/data-requests/deletions/DEL-1001
/admin/data-requests/retention
```

For every route, capture page/console errors and verify default plus relevant
loading, empty, partial, error, forbidden, not-found, conflict, expiry, and
success states.

## Primary journey checks

### Security investigation

1. Filter Security Overview and Authentication Events by period, platform,
   actor class, event, risk, result, and region.
2. Confirm metrics state whether they count events, sessions, accounts, grants,
   or permission changes.
3. Open suspicious activity and verify bounded signal labels, masked actor/
   device/session context, and no raw telemetry, IP, token, credential, or
   private payload.
4. Assign a reviewer, move New to Investigating, and reject escalation without
   an existing incident reference.
5. Link an existing incident, escalate, resolve, and verify terminal behavior.
6. Exercise the incident Open → Contained → Monitoring → Resolved → Closed
   lifecycle and Resolved → Monitoring regression.
7. Reject invalid, stale, duplicate, terminal, and unauthorized transitions.

### Admin security and support access

1. Verify Admin Security returns role, two-factor state, last login,
   active-session count, and risk only.
2. Verify Permission Changes are read-only and contain bounded before/new
   permission summaries, reason, result, and correlation ID.
3. Review active support access and verify agent, masked customer, ticket,
   approved scope, start, expiry, remaining-time state, and status.
4. Revoke Active access with reason and confirmation.
5. Reject expired, already revoked, stale, duplicate, and unauthorized
   revocation.

### Immutable audit

1. Search/filter/sort/paginate by actor, action, resource, masked target,
   result, severity, date, and correlation ID.
2. Open one event and verify allowlisted scalar metadata and before/after rows.
3. Confirm no create, edit, delete, replace, retry, rollback, or mutation
   endpoint/control exists.
4. Reject or omit unknown/prohibited keys, nested values, oversized metadata,
   unsafe Unicode, URLs, raw payloads, and sensitive values.
5. Verify a missing related ticket/incident does not change immutable evidence.

### Export requests

1. Verify the eight metadata-only export scope categories and no category
   contents.
2. Exercise Requested → Validating → Processing → Ready → Expired.
3. Exercise allowed failure, cancellation, and retry branches.
4. On an unexpired Ready request, activate simulated download and verify the
   response contains only allowed, expiry, and a mock-only message.
5. Confirm no URL, token, Blob, archive, bytes, file write, network download,
   or browser-stored customer data is created.

### Deletion and retention

1. Verify every approved deletion checklist category, state, blocker,
   responsibility, and updated time.
2. Exercise Requested → Review Required → Scheduled → In Progress → Completed.
3. Verify cancellation, Blocked → In Progress retry, legal-hold rejection,
   unresolved-checklist rejection, terminal states, stale revision, and
   duplicate lock.
4. Confirm `audit_records_preserved` counts as resolved and does not expose
   audit contents.
5. Edit a retention policy with positive integer days within its contract
   bounds, reason, impact acknowledgement, and confirmation.
6. Reject zero, negative, fractional, out-of-range, stale, and protected-audit
   reductions.
7. Verify active legal hold shows cleanup suspended regardless of period.
8. Confirm no cleanup, storage mutation, job schedule, deletion, or
   anonymization occurs.

## Permission and cache matrix

- **Super Admin**: all Phase 7 routes and allowed mock actions.
- **Security Administrator**: all Phase 7 routes and allowed mock actions.
- **Support Agent**: own active-access or linked privacy status only inside
  prior authorized routes; no direct Phase 7 route.
- **Billing Operator**: linked subscription-cancellation status only when
  separately authorized; no direct Phase 7 route.
- **Import Operator, AI Operator, Content Manager**: no direct Phase 7 route.

For each role verify navigation, direct route denial, structural response
projection, hidden/disabled actions, and direct mock mutation returning safe
403. Switch from Super Admin to every lower-privilege role and verify the
shared query cache removes previously authorized protected data immediately.

## Platform and counting checks

- Verify All, iOS, Android, Unknown, and global/not-applicable records.
- Confirm one-origin event/session/device totals are additive only when labeled.
- Confirm unique affected customers are authoritative and deduplicated.
- Confirm Admin, permission, audit, request, and retention records are not
  assigned a mobile platform when attribution does not apply.
- Confirm Unknown remains visible and is never silently classified as iOS or
  Android.
- Confirm iOS views imply no SMS/inbox access and Android views expose no raw
  SMS, notification, sender, or bank content.

## Privacy and security checks

- Search changed production source for `dangerouslySetInnerHTML`, raw HTML,
  Markdown or recursive JSON rendering, browser storage of feature data, debug
  logging, secrets, public environment leaks, `any`, unsafe links, URLs/tokens/
  blobs, real downloads, real data mutation, `Date.now()`, and `Math.random()`.
- Verify strict parsing of route IDs, queries, forms, action discriminators,
  expected state/revision, metadata, scope, filenames, checklist values,
  retention bounds, and mock responses.
- Verify Unicode NFC comparison, code-point search limit, UTF-8 reason/note
  limits, bidi/control rejection, and surrogate-pair boundaries.
- Verify structural projection is built from allowlisted fields and never by
  cloning a full sensitive object and deleting keys.
- Verify no raw email, phone, IP, precise location, device/session ID,
  credential, recovery code, token, secret, financial record, provider
  payload, archive content, deletion payload, or storage path.
- Verify confirmation, pending lock, exact transition, expected revision, safe
  conflict/error, deterministic time, deterministic audit reference, and reset.
- Confirm no new dependency or package version change.

## Responsive, direction, and accessibility checks

Run the route and primary-journey matrix at:

```text
1440 × 1000
1280 × 900
1024 × 900
768 × 1024
390 × 844
```

- Arabic is RTL by default; switch to English and verify LTR readiness.
- At 390px preserve critical incidents, active support access, privacy
  blockers, status, search, and safe revocation/approval actions.
- Confirm complex audit metadata and retention editing show the desktop-required
  notice while preserving read-only summaries and urgent actions.
- Verify headings, landmarks, tables/cards, chart summaries, labels,
  validation associations, 44px targets, focus trap/restoration, live
  feedback, non-color status, timeline order, identifier direction isolation,
  absolute expiry time, and reduced motion.

## Performance checks

- Measure 20 standard overview/detail samples; at least 95% show usable content
  within 2 seconds.
- Measure 20 standard filter/sort/pagination samples; at least 95% complete
  within 1 second.
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
to succeed, all task checkboxes to remain reconciled to evidence, and all 14
Phase 7 routes to appear in the build.
