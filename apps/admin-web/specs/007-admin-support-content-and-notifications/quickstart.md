# Quickstart: Validate Spec 007

This guide defines future implementation verification. It does not claim the
feature or any command currently passes.

## Prerequisites

- Work from `apps/admin-web`.
- Use the existing installed dependencies and approved project configuration.
- Confirm `.specify/feature.json` points to
  `specs/007-admin-support-content-and-notifications`.
- Keep `NEXT_PUBLIC_ENABLE_MOCKS=true` only for the local mock runtime.
- Do not configure a real support, email, push, storage, database, queue, or
  authentication provider.

## Contract and model references

- [Specification](./spec.md)
- [Implementation plan](./plan.md)
- [Research decisions](./research.md)
- [Frontend data model](./data-model.md)
- [OpenAPI mock contract](./contracts/admin-support-content-notifications.openapi.yaml)

## Focused commands

Run after the corresponding implementation exists:

```powershell
npx vitest run src/features/communications src/mocks/phase6-communications-state.test.ts
npx playwright test tests/e2e/support-content-notifications.spec.ts
```

Expected final result: exit code 0 with no failed focused tests. Record actual
file/test/pass/skip/fail counts; do not infer them.

## Route matrix

Verify these 22 routes:

```text
/admin/support
/admin/support/tickets
/admin/support/tickets/TKT-1001
/admin/support/categories
/admin/feedback
/admin/feedback/FDB-1001
/admin/feedback/abuse
/admin/content/categories
/admin/content/categories/CAT-1001
/admin/content/tips
/admin/content/faqs
/admin/content/onboarding
/admin/content/help-center
/admin/content/announcements
/admin/content/email-templates
/admin/content/push-templates
/admin/notifications
/admin/notifications/campaigns
/admin/notifications/campaigns/new
/admin/notifications/campaigns/CMP-1001
/admin/notifications/transactional
/admin/notifications/delivery-logs
```

For every route, capture page/console errors and verify default plus relevant
loading, empty, partial, error, forbidden, not-found, conflict, and success
states.

## Primary journey checks

### Support

1. Filter the dashboard/list by period, platform, state, priority, and search.
2. Open an urgent SLA-risk ticket and verify masked context and safe linked
   references.
3. Assign one team/optional agent; confirm a stale reassignment fails.
4. Add an internal note and a customer-visible reply; verify visibility labels.
5. Reply to Resolved and verify it becomes Open atomically.
6. Verify Closed rejects reply until a separate confirmed reopen.
7. Create controlled access through the existing Spec 003 access-request
   operation and verify the ticket stores only the returned safe reference.

### Feedback and abuse

1. Review feedback metrics/list/detail and link one item once.
2. Reject duplicate links, stale versions, unsafe content, and malformed
   attachment metadata.
3. Verify Support Agent cannot retrieve abuse evidence.
4. As Security Administrator, review the restricted projection and complete a
   confirmed escalation/disposition.

### Content and templates

1. Create/edit each approved collection using Arabic and English variants.
2. Reject duplicate keys/order, cyclic categories, missing translations,
   invalid platform scope, unsafe text, unknown placeholders, and stale writes.
3. Preview Arabic RTL and English LTR.
4. Publish/retire with active-use and replacement checks.
5. Verify email/push/transactional templates use allowlisted structured fields
   and contain no raw HTML, Markdown, arbitrary payload, or unsafe URL.

### Campaigns and delivery

1. Complete audience, channel, content, schedule, and review steps.
2. Verify audience preview returns only a safe preview ID/version and aggregate
   targeted, eligible, excluded, opt-out, invalid-token, iOS, Android,
   multi-platform, and Unknown counts.
3. Verify exactly one channel and Send Now or one future time.
4. Reject zero/stale audience, inactive/stale template, missing variant,
   opt-out conflict, past schedule, duplicate submit, and stale revision.
5. Confirm one mock schedule/send transition and inspect updated detail.
6. Verify delivery/open/failure/token/opt-out rate denominators.
7. Verify logs expose no address, phone, token, message body, payload, provider
   response, or storage path.

## Permission matrix

- **Super Admin**: full Phase 6 routes/actions.
- **Support Agent**: tickets/categories/feedback; linked delivery context only;
  no abuse evidence, content publication, or campaign management.
- **Content Manager**: content/templates/campaigns and aggregate feedback/
  support context; no general ticket conversation or abuse evidence.
- **Security Administrator**: restricted abuse and severe linked context; no
  campaign/content or general conversation access.
- **Billing, Import, and AI operators**: no general Phase 6 routes; only
  minimum linked ticket summary from their authorized domain.

For each role verify navigation, direct route denial, structural projection,
hidden/disabled actions, and direct mock POST returning safe 403.

## Platform, counting, and rate checks

- Verify All, iOS, Android, and Unknown.
- Confirm unique customers/recipients are authoritative and deduplicated.
- Confirm event/delivery totals are additive only under one attribution.
- Confirm one customer with multiple devices is not duplicated as a recipient.
- Confirm delivery = delivered/attempted, failure = failed/attempted, open =
  opened/delivered, token failure = token failures/push attempts, and opt-out =
  opted-out unique customers/targeted unique audience.
- Unsupported or unavailable rates display as unavailable, never zero.

## Privacy and security checks

- Search changed production source for `dangerouslySetInnerHTML`, raw HTML/
  Markdown/JSON rendering, browser storage, debug logging, secrets, public
  environment leaks, `any`, unsafe links, real provider calls, and production
  fixture imports.
- Verify strict parsing of IDs, queries, forms, actions, attachment metadata,
  placeholders, schedules, audience/template revisions, and mock responses.
- Verify Unicode NFC comparison, code-point character limits, UTF-8 KiB limits,
  bidi/control rejection, and boundary cases containing surrogate pairs.
- Verify customer/message/evidence/template text is fictional, bounded, plain,
  sanitized, and safe under bidi/script-like inputs.
- Verify no financial/import/AI payload, recipient list/address, device token,
  provider payload, message body, file bytes/path, credential, or secret.
- Verify pending locks, duplicate prevention, expected state/revision,
  confirmation, safe errors, and planned audit references.
- Confirm no new dependency or package version change.
- Confirm Phase 6 state/handlers use the fixed injected mock clock and contain
  no `Date.now()` or `Math.random()`.

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
- At 390px preserve urgent support/abuse alerts, notification health, campaign
  status, and safe approval/cancel actions.
- Confirm complex editors/wizard configuration show the desktop-required notice
  without losing existing draft/status visibility.
- Verify headings, landmarks, tables/cards, chart summaries, labels, validation
  associations, wizard progress, 44px targets, focus trap/restoration, live
  feedback, status alternatives, logical order, bidi isolation, and reduced
  motion.

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
counts, generated route output, and any warnings. Completion requires every
command to succeed and all 22 Phase 6 routes to appear in the build.

## Phase 1 Baseline (2026-07-30)

Before implementation begins, the following baseline commands were executed:

```powershell
npm run typecheck
```
**Result**: ✅ Exit code 0 - Success
- No TypeScript errors detected

```powershell
npm run lint
```
**Result**: ✅ Exit code 0 - Success
- No ESLint errors or warnings

```powershell
npm run test
```
**Result**: ✅ Exit code 0 - Success
- Test Files: 45 passed (45)
- Tests: 497 passed (497)
- Duration: 12.49s (transform 18.61s, setup 75.25s, import 17.39s, tests 9.51s, environment 94.17s)

```powershell
npm run build
```
**Result**: ✅ Exit code 0 - Success
- Compiled successfully in 6.8s
- TypeScript finished in 10.6s
- Static pages generated: 34 routes (28 static, 6 dynamic)
- No warnings or errors

**Baseline Status**: All commands pass successfully. The existing codebase is in a clean state with no pre-existing failures.
