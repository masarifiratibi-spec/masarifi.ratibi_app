# Quickstart: Validate Users, Devices, Sessions, and Controlled Access

**Phase / Spec**: Phase 2 / Spec 003  
**Purpose**: Runnable implementation verification guide  
**Current status**: Planning artifact; results must be recorded only after the
implementation commands and reviews are actually completed

## Prerequisites

- Work from `apps/admin-web`.
- Spec 001 and Spec 002 implementation remains present and passing.
- Dependencies are already installed; this phase requires no package change.
- Use sanitized fictional mock data only.
- Do not start a backend, database, authentication provider, payment provider,
  AI provider, queue, or infrastructure service.

## Reference Environment

- Node.js compatible with the current lockfile
- Next.js 16.2.11
- React 19.2.8
- TypeScript 5.9.3 strict mode
- Zod 4.4.3
- TanStack Query 5.101.4
- TanStack Table 8.21.3
- React Hook Form 7.83.0
- Mock Service Worker 2.15.0
- Vitest 4.1.10
- Playwright 1.62.0

Contract and model references:

- [Feature specification](./spec.md)
- [Implementation plan](./plan.md)
- [Frontend data model](./data-model.md)
- [OpenAPI contract](./contracts/admin-users-access.openapi.yaml)

## Automated Verification

Run each command separately and retain its actual exit result:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Expected completion result:

- TypeScript reports no errors.
- ESLint reports no errors.
- All Vitest files pass.
- All applicable Playwright projects pass; viewport-specific skips are
  intentional and documented.
- The production build completes and lists every Spec 003 route.

Do not run build and Playwright concurrently because the Playwright web server
also performs a production build.

## Run the Development Application

```powershell
$env:NEXT_PUBLIC_ENABLE_MOCKS='true'
npm run dev
```

Open:

- `http://localhost:3000/admin/users`
- `http://localhost:3000/admin/users/USR-10482`
- `http://localhost:3000/admin/access-requests`
- A seeded request detail under `/admin/access-requests/[requestId]`
- Its seeded workspace under
  `/admin/access-requests/[requestId]/workspace`

The role and scenario switchers are development-only simulation controls.

## Route and Architecture Check

Verify:

1. `/admin/users` keeps the approved visual hierarchy and quick-summary drawer.
2. The drawer links to the dedicated user detail route.
3. The new access-request navigation appears only for permitted roles.
4. Direct denied routes show the shared access-denied state and no protected
   heading, count, label, or value.
5. Route/page and presentation files do not import from `src/mocks/fixtures`.
6. Users and access data flow through typed hooks and repositories to the shared
   API client.
7. MSW owns all Phase 2 frontend endpoints; no Next.js route handler or backend
   runtime was added.

Run the architecture guards:

```powershell
npm run test -- src/tests/no-direct-fixtures.test.ts
rg -n "@/mocks/fixtures|@/data|data/admin" src/app src/components src/features
rg -n "\bany\b" src --glob "*.ts" --glob "*.tsx"
```

Expected:

- Architecture test passes.
- Production pages/components/features have no raw fixture import.
- Application source contains no `any`.

## Users List and Platform Membership

On `/admin/users`:

1. Confirm masked email, customer ID, country, language, primary platform, all
   registered platforms, plan, status, verification, registration, last
   activity, risk, and action are available at the appropriate viewport.
2. Select All Platforms and verify each fixture user appears once.
3. Select iOS and verify iOS-only and multi-platform customers appear.
4. Select Android and verify Android-only and multi-platform customers appear.
5. Select Multi-platform and verify only customers with both registered
   platforms appear.
6. Verify the seeded multi-platform customer appears once in All and appears in
   iOS, Android, and Multi-platform.
7. Confirm `totalDeviceCount = iosDeviceCount + androidDeviceCount`.
8. Confirm no code or display derives unique customer total by adding iOS and
   Android customer audiences.
9. Exercise search, every filter, allowed sort, page size, pagination, clear
   filters, row selection, and selection reset after query change.
10. Verify empty, large, slow, invalid, forbidden, partial, rate-limited, and
    internal-error scenarios.

Focused checks:

```powershell
npm run test -- src/features/users/contracts.test.ts src/features/users/repository.test.ts
```

## Customer Profile, Devices, and Sessions

On `/admin/users/USR-10482`:

1. Confirm profile content is masked/aggregated and contains no financial
   amount or item-level financial record.
2. Fail the Devices mock region and confirm the profile and Sessions remain.
3. Fail the Sessions region and confirm the profile and Devices remain.
4. Verify an iOS device shows push, Shortcut, and Share Extension states and
   labels Android capabilities not applicable.
5. Verify an Android device shows push, SMS tracking, Notification Listener,
   and background states and labels iOS capabilities not applicable.
6. Confirm device totals are additive and match the displayed records.
7. Confirm sessions show safe device label, coarse region, timestamps, state,
   and risk only.
8. Verify empty device/session states and region-specific retry.
9. Use long mixed Arabic/English labels and confirm direction isolation,
   wrapping, and accessible names remain correct.

Search the rendered application and fixtures for prohibited fields:

```powershell
rg -n "fingerprint|push[_-]?token|session[_-]?token|auth[_-]?token|raw[_-]?ip|salary|merchant|bank statement|raw sms|raw notification" src
```

Review every match. Only explicit prohibition tests/documentation are allowed;
no fixture or response may contain a prohibited value.

## Single-Customer Actions

For Suspend, Reactivate, Verification, Revoke Device, and Force Logout:

1. Open the action using keyboard only.
2. Confirm the form labels, validation messages, current state, scope,
   consequence, permission, and planned audit event are available to assistive
   technology.
3. Submit invalid/empty input and confirm no request is sent.
4. Cancel and confirm no state changes and focus returns to the trigger.
5. Confirm a valid action and verify the confirm button locks while pending.
6. Attempt duplicate submission during the slow scenario and verify one request
   plus a safe pending/conflict outcome.
7. Confirm success updates the relevant list/detail/device/session view.
8. Repeat against an already changed state and verify a safe conflict prompts
   refresh instead of false success.
9. Use a role without the granular action permission and confirm both hidden or
   disabled UI behavior and forbidden mock response.

Focused checks:

```powershell
npm run test -- src/features/users/user-actions.test.tsx
```

## Bulk Actions

1. Select a bounded set of visible rows.
2. Confirm selection count and clear-selection behavior.
3. Change a filter or page and confirm the previous selection is cleared.
4. Verify the request contains only explicit current-page IDs and never means
   all filtered results.
5. Exercise masked export, suspend, reactivate, force logout, and notification
   handoff.
6. Confirm sensitive actions require scope/consequence confirmation and
   pending lock.
7. Use mixed eligible/ineligible rows and verify partial result counts and safe
   failed IDs.
8. Confirm export fields are allowlisted and contain no full email, raw device
   or session identifier, IP, financial amount, or workspace data.
9. Confirm notification handoff reports a mock outcome only; no campaign,
   template, delivery, email, or push implementation exists.

## Access Request Lifecycle

Use a seeded support-agent request and a separate super-admin or
security-administrator approver:

1. Create a request with valid fictional user, existing fictional ticket,
   assignee, reason, one or more allowlisted scopes, mandatory masking, and a
   duration from 5 to 60 minutes.
2. Verify missing ticket, unknown ticket, short reason, empty scope, duplicate
   scope, duration below 5, and duration above 60 are rejected before or at the
   mock boundary.
3. Create the same overlapping pending/active request and verify safe 409
   conflict.
4. As the requester, open the request and confirm approval is unavailable with
   a separation-of-duty explanation.
5. Switch to a separate authorized approver.
6. Attempt to add scope or increase duration and verify validation/409.
7. Approve with an equal or reduced scope and duration.
8. Confirm timeline, approver, start, expiry, approved scope, masking rules,
   and fictional audit reference update.
9. Repeat with rejection and confirm Rejected is terminal.
10. Exercise authorized revocation from Approved and Active.
11. Attempt every invalid transition from Rejected, Expired, or Revoked and
    verify safe conflict.

Focused checks:

```powershell
npm run test -- src/features/access/contracts.test.ts src/features/access/repository.test.ts
```

## Temporary Access Workspace

For an approved request assigned to the current simulated operator:

1. Enter within the valid time window and confirm the request becomes Active.
2. Confirm the persistent banner shows ticket, assignee/access notice, approved
   scope, masking notice, absolute expiry, audit indicator, and End Access.
3. Confirm every displayed section maps exactly to one approved scope.
4. Confirm omitted scopes reveal no heading, count, placeholder, cached value,
   or hidden DOM content.
5. Confirm values are classified only as masked, aggregate, or status.
6. Attempt direct access as another role/assignee and verify denied content.
7. End access, confirm the consequence, and verify protected content and query
   cache are removed.
8. Open the seeded expiry scenario and verify protected content disappears
   within five seconds of expiry.
9. Refresh, navigate back, refocus, and restore page visibility after expiry;
   confirm protected content never returns.
10. Trigger session expiry or permission loss while open and verify the same
    removal behavior.
11. Confirm unsaved local input is discarded on expiry/end.

Focused checks:

```powershell
npm run test -- src/features/access/access-workspace.test.tsx
```

## Permission Matrix

Verify the exact simulated behavior:

- Super Admin: user read/actions; request read/create/approve/revoke/use when
  not self-approving and when assigned.
- Support Agent: user summary, devices, sessions, status/verification/session
  actions, own access requests, create request, use/end assigned active access;
  no approval.
- Security Administrator: user summary, devices, sessions, device/session
  actions, request read/approve/revoke/use when assigned and not self-approving.
- Billing, Import, AI, and Content roles: no Phase 2 routes by default.

Run:

```powershell
npm run test -- src/core/permissions/role-map.test.ts
npm run test:e2e -- tests/e2e/users-access.spec.ts --project=desktop-1440
```

Confirm the role switcher still states that future backend authorization is
required.

## Mock State and Scenario Isolation

1. Run repository/action test files repeatedly and confirm deterministic
   results.
2. Verify `resetPhase2MockState()` restores seeded records between Vitest tests.
3. Verify browser reload does not write customer or access data to
   `localStorage` or `sessionStorage`.
4. Confirm only existing development role/scenario keys use session storage.
5. Confirm errors contain safe codes/messages and optional correlation IDs only.

## Accessibility Review

Using keyboard and a screen reader or accessibility inspector:

- Navigate list filters, sort, pagination, selection, quick drawer, and detail.
- Operate Overview/Devices/Sessions regions without a keyboard trap.
- Complete and cancel every form/dialog; verify focus return.
- Review validation summary and field associations.
- Verify table headers, sort state, row labels, selection labels, and mobile
  card alternatives.
- Verify status/risk/platform/verification/access meaning is not color-only.
- Verify pending, success, partial, error, conflict, forbidden, and expiry
  announcements.
- Verify the absolute expiry is accessible without per-second live-region
  noise.
- Verify all touch controls are at least 44px at touch viewports.
- Verify reduced motion removes nonessential transitions.

Expected: zero blocking keyboard, focus, label, contrast, status, touch-target,
or reduced-motion defect.

## Viewport, Direction, and Theme Matrix

Verify these widths:

| Width | Required behavior |
|-------|-------------------|
| 1440px | Full users/access tables, detail regions, and dialogs |
| 1280px | Compact shell and preserved primary columns |
| 1024px | Scroll-safe tables, condensed filters, overflow actions |
| 768px | Drawer navigation, filter drawer, selective columns, full-width dialogs |
| 390px | Lookup, status, urgent actions, cards, approval summary, expiry, End Access |

At each width:

1. Verify Arabic RTL.
2. Switch to English LTR and verify logical order and isolated technical values.
3. Verify light and dark themes.
4. Confirm no blocking horizontal page overflow.
5. Confirm access expiry, masking, status, action scope, and confirmation remain
   visible and usable.

## Security and Privacy Review

Run:

```powershell
rg -n "dangerouslySetInnerHTML|localStorage|sessionStorage" src
rg -n "NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD)" .
rg -n "console\\.(log|error|warn)|JSON\\.stringify" src
rg -n "https?://|target=\"_blank\"" src
rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|hsl\\(" src --glob "*.css" --glob "*.tsx"
```

Review every match:

- No unsafe renderer was added.
- Browser storage contains no customer, selection, session, or access data.
- No secret/private environment value is browser exposed.
- Logs/errors contain no raw payload or customer data.
- New external links are absent or approved and opener-safe.
- New styles use existing semantic tokens.
- No dependency or lockfile changed.

Inspect the built/browser DOM and captured screenshots for:

- Unmasked email or private identifier
- Raw IP, device fingerprint, push/session/auth token, or credential
- Financial amount or transaction detail
- Raw SMS/notification/import/AI content
- Hidden unauthorized workspace section
- Stack trace, internal path, raw exception, or private payload

Expected: zero prohibited exposure.

## Complete End-to-End Matrix

`tests/e2e/users-access.spec.ts` must cover at least:

1. Unique and platform filter invariants
2. Profile/device/session independent regions
3. iOS and Android capability applicability
4. Single action validation, confirmation, pending lock, success, and conflict
5. Page-scoped bulk partial result
6. Route/action permission matrix
7. Request creation and duplicate conflict
8. Requester cannot approve
9. Approver can reduce but not widen
10. Active workspace scope projection
11. End Access removes content
12. Expiry removes content and blocks refresh/back
13. Keyboard/focus behavior
14. Arabic RTL, English LTR, light/dark, reduced motion
15. All five approved viewports
16. No unexpected browser console/page errors

## Completion Evidence

Record actual evidence after implementation:

| Check | Command/procedure | Result |
|-------|-------------------|--------|
| Typecheck | `npm run typecheck` | Record exit/result |
| Lint | `npm run lint` | Record exit/result |
| Vitest | `npm run test` | Record files/tests |
| Playwright | `npm run test:e2e` | Record passed/skipped/failed |
| Production build | `npm run build` | Record route/build result |
| Architecture | Static scans and no-direct-fixtures test | Record findings |
| Platform invariants | All/iOS/Android/Multi review | Record findings |
| Permissions/access | Role and lifecycle matrix | Record findings |
| Accessibility | Keyboard/screen-reader/touch/reduced-motion review | Record findings |
| Viewports/direction/theme | Five widths, RTL/LTR, light/dark | Record findings |
| Security/privacy | Source, DOM, storage, logs, screenshots | Record findings |

Do not replace any result with “pass” until that command or procedure actually
completes successfully.
