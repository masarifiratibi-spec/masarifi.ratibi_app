# Quickstart: Validate Spec 010 Admin Governance and Final Integration

This guide is a verification plan. Do not report a command or scenario as
passing until it has been executed successfully against the implementation.

## Prerequisites

- Work from `apps/admin-web`.
- Active feature directory is `specs/010-admin-governance-and-settings`.
- Specs 001–009 and their existing tests remain present.
- Use only sanitized fictional data and the development-only role simulation.
- Do not configure a real backend, Supabase project, email provider, feature
  service, mobile store, maintenance system, or secret.

Reference artifacts:

- [Specification](./spec.md)
- [Implementation plan](./plan.md)
- [Research decisions](./research.md)
- [Data model](./data-model.md)
- [OpenAPI contract](./contracts/admin-governance-settings.openapi.yaml)

## Install and Baseline

Use the existing lockfile and dependencies. Do not add or upgrade packages.

```powershell
npm install
npm run typecheck
npm run lint
```

Expected planning outcome: these are the required commands. Their pass/fail
results belong in implementation evidence, not this plan.

## Focused Automated Verification

Run the Phase 9 foundation and feature suites:

```powershell
npm run test -- src/core/permissions/role-map.phase9.test.ts src/components/admin/shell-state.test.ts src/components/admin/AdminShell.test.tsx src/features/governance/contracts.test.ts src/mocks/phase9-governance-state.test.ts src/features/governance/repository.test.ts src/features/governance/hooks.test.ts src/features/governance/GovernanceViews.test.tsx src/features/governance/SettingsViews.test.tsx src/features/foundation/schemas.test.ts src/features/foundation/repository.test.ts src/components/admin/AttentionPanel.test.tsx src/tests/no-direct-fixtures.test.ts
```

Run the focused browser journeys:

```powershell
npm run test:e2e -- tests/e2e/governance-settings.spec.ts
```

Run shared integration suites after focused tests pass:

```powershell
npm run test:e2e -- tests/e2e/permissions.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/performance.spec.ts tests/e2e/visual-preservation.spec.ts
```

## Route Inventory

Verify the exact new routes:

```text
/admin/admin-team
/admin/admin-team/invite
/admin/admin-team/ADM-DEMO-SECURITY-02
/admin/roles
/admin/roles/new
/admin/roles/permissions
/admin/roles/ROLE-DEMO-SUPPORT
/admin/roles/ROLE-DEMO-CUSTOM-01/edit
/admin/settings
/admin/settings/mobile
/admin/settings/feature-flags
/admin/settings/imports
/admin/settings/ai
/admin/settings/subscriptions
/admin/settings/security
/admin/settings/maintenance
```

For each route verify:

- authorized default data;
- loading behavior;
- empty behavior where relevant;
- partial/stale behavior where relevant;
- safe failure and retry;
- direct access denial with a role lacking permission;
- session-expired behavior;
- no protected data in denied HTML, API response, cache, or console;
- no runtime or console error.

## Permission Matrix

Verify the role outcomes below.

| Capability | Super Admin | Security Administrator | Other five roles |
|------------|-------------|------------------------|------------------|
| Admin list/profile | Full | Structural read-only | Denied |
| Invitation list/create | Full | Denied | Denied |
| Disable/session/role assignment | Full | Denied | Denied |
| Role list/detail/matrix | Full | Read-only | Denied |
| Custom role create/edit | Full | Denied | Denied |
| General/mobile/flag/import/AI/subscription settings | Full | Denied | Denied |
| Security settings | Full | Manage | Denied |
| Maintenance | Manage | Read-only | Denied |
| Global search and attention | Owning-permission filtered | Owning-permission filtered | Owning-permission filtered |

Required checks:

1. Every active permission key appears once in metadata and once in the matrix.
2. Static `/new`, `/invite`, `/permissions`, and settings subroutes resolve
   before dynamic/broad route rules.
3. Direct mock requests enforce the same permission as navigation and pages.
4. Custom roles never appear in the development role switcher.
5. Role change or session expiry clears protected cached query data.

## US1 — Admin Team Governance

### List and profile

1. Use Super Admin.
2. Open `/admin/admin-team`.
3. Filter by status, role, department, and two-factor state.
4. Open `ADM-DEMO-SECURITY-02`.
5. Confirm safe profile, role, ticket count, safe actions, sessions, security
   state, and audit references are independently represented.
6. Switch to Security Administrator and repeat.

Expected:

- Emails remain masked in list/detail.
- Broad region replaces IP or precise location.
- Security Administrator receives no invitation data, assignable-role inputs,
  disable/revoke controls, restricted session identifiers, or full identity data.

### Invitation

1. As Super Admin, open `/admin/admin-team/invite`.
2. Submit a unique normalized fictional email, safe name, Active role,
   department, seven-day expiry, and optional safe message.
3. Confirm the pending state and audit reference.
4. Repeat with the same email using different case/whitespace.
5. Retry the first submission key with the same and then a different payload.

Expected:

- First valid submission creates one Pending invitation.
- API/list response contains masked email and no message.
- UI states no email or account was created.
- Duplicate or key/payload conflict creates no second record.
- No accept, expire, resend, or revoke control exists.

### Disable and sessions

1. Attempt self-disable.
2. Attempt current-session revocation.
3. Attempt to disable the last Active Super Admin fixture.
4. Attempt to disable an Admin with open tickets and no replacement.
5. Provide an eligible replacement, reason, explicit session choice, current
   version, confirmation, and unique submission key.

Expected:

- First four cases preserve state and return safe conflicts.
- Eligible disablement occurs once, updates dependent counts, and returns a
  safe mock-only result and audit reference.

## US2 — Roles and Permission Matrix

1. Open `/admin/roles/permissions` as Super Admin.
2. Filter by group, action, role, assigned, and unassigned.
3. Compare the matrix permission count with `PERMISSION_KEYS`.
4. Open a system role and verify all mutation controls are absent.
5. Create an Active custom role with a valid key, localized name, description,
   nonempty permission set, descriptive policy metadata, reason, and confirmation.
6. Edit permissions and metadata using the current version.
7. Disable and re-enable the unassigned custom role through edit.
8. Assign the role to an Active Admin and attempt disablement again.

Expected:

- Every permission key appears exactly once with owning spec, group, action,
  sensitivity, and assignability.
- System roles and their assignments never change.
- Invalid, duplicate, unknown, or out-of-scope permissions are rejected.
- Assigned custom role disablement is rejected until Admins are reassigned.
- No delete or approval-queue operation exists.

## US3 — Settings Groups

For each General, Mobile, Imports, AI, Subscriptions, and Security group:

1. Open the route with an authorized role.
2. Change one allowlisted field.
3. Review changed fields, reason, impact acknowledgement where required, and consequence.
4. Save against the current group version.
5. Repeat from a stale version.
6. Submit an unknown field, wrong group shape, unsafe text, and boundary values.

Expected:

- Only changed fields are sent.
- The whole group update succeeds once or fails atomically.
- Stale version reloads current authorized values; no partial field success.
- Zero and false remain distinct from omitted/inherited/unavailable.
- Unknown, secret-like, or wrong-group fields are rejected.

### Mobile separation

Verify:

- iOS minimum/latest version ordering and `apps.apple.com` HTTPS link;
- Android minimum/latest ordering and `play.google.com` HTTPS link;
- exact update modes;
- iOS-only flags cannot move to Android;
- Android-only flags cannot move to iOS;
- Shared flags remain Shared;
- store links opened in a new tab prevent opener access.

## US4 — Feature Flags and Maintenance

### Feature flags

1. Filter flags by platform, audience, and status.
2. Update a compatible flag with each fixed audience.
3. Verify rollout values 0 and 100 are accepted.
4. Verify -1, 101, unknown audience, customer list, custom query, incompatible
   platform, reversed schedule, and stale version are rejected.
5. Verify an Ended seeded flag is read-only.

Expected:

- Editable statuses are Disabled, Scheduled, and Active.
- Ended is read-only.
- No create, delete, experiment, or customer-targeting surface exists.

### Maintenance

Verify these transitions:

```text
Off → Scheduled
Off → Active
Scheduled → Scheduled
Scheduled → Active
Scheduled → Off
Active → Off
```

Reject Active → Scheduled and Off → Off.

For every eligible transition verify current version, Arabic and English
message when required, affected platforms, valid time window, allowed roles
including Super Admin, reason, consequence, confirmation, and pending lock.
Immediate activation also requires the second mock-only acknowledgement.

Expected:

- State changes exactly once.
- No client timer changes state.
- Ending remains available to Super Admin.
- UI and result state that no real route, client, service, or environment changed.

## US5 — Completed Global Search

Search one known fictional result in each group:

```text
Navigation
Users
Subscriptions
Payment Events
Imports
Support Tickets
Audit Events
Jobs
Parser Rules
Banks
Admin Users
```

Verify:

- query is 2–120 normalized characters;
- results are grouped and deterministically ordered;
- same owning record appears once per group;
- masked email never expands;
- denied entities are absent before counts;
- partial group failure preserves allowed successful groups;
- destination is a validated internal route the role may open;
- arrow keys, Enter, Escape, focus movement, and direction isolation work.

## US6 — Completed Attention

Verify all event types:

```text
Critical Incident
Failed Payment Spike
AI Provider Outage
Queue Backlog
Import Failure Spike
Security Alert
Urgent Support Ticket
Account Deletion Failure
Backup Issue
Parser Regression
```

Verify all severities: Critical, High, Medium, Low, Info.

Expected:

- Severity uses label, icon, text, and color.
- Order is severity, recency, stable ID.
- Denied destinations/items are omitted before counts.
- Global infrastructure is not attributed to mobile.
- Empty and unavailable states remain different.
- Panel is read-only; no acknowledge or dismiss control exists.

## US7 — Final Integration

### Viewports and direction

Run every new route and a representative route from Specs 001–009 at:

```text
1440×1000
1280×900
1024×900
768×1024
390×844
```

Check Arabic RTL and representative English LTR in light and dark themes.

Expected:

- No unintended page-level horizontal overflow.
- Tables/matrix use labeled scroll regions or card alternatives.
- Complex edit routes at 390px show the approved desktop-required state.
- Mixed Arabic/Latin IDs, emails, versions, permission keys, and URLs remain readable.

### Accessibility

Verify:

- landmarks, heading order, labels, table headers, matrix semantics;
- keyboard-only completion and logical tab order;
- visible focus and dialog focus restoration;
- live loading/success/conflict/error announcements without duplication;
- validation association and summary;
- 44px touch targets;
- reduced motion;
- state never communicated by color alone.

### Privacy and security scan

Review changed production paths for:

```powershell
rg -n "\bany\b|dangerouslySetInnerHTML|localStorage|sessionStorage|IndexedDB|Date\.now\(|Math\.random\(|console\.|process\.env|api[_-]?key|secret|token|password|createObjectURL|Blob" src/features/governance src/mocks/fixtures/governance.ts src/mocks/phase9-governance-state.ts src/mocks/handlers/governance.ts src/features/foundation src/components/admin src/app/admin/admin-team src/app/admin/roles src/app/admin/settings
```

Explain test-only development role simulation or schema field-name matches;
production matches that violate the specification must be fixed.

Confirm presentation code imports no fixtures:

```powershell
rg -n "@/mocks/fixtures|mocks/fixtures" src/features/governance src/app/admin/admin-team src/app/admin/roles src/app/admin/settings
```

Expected: no production direct fixture import.

## Complete Verification

After focused verification succeeds, run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Record exact exit codes, test totals, skips, warnings, failures, route output,
viewport evidence, accessibility evidence, console results, and known
limitations. A failed or skipped command must not be reported as passing.

## Deferred Production Verification

Do not claim this frontend validates production authentication, MFA, CSRF,
authorization, invitation delivery, session revocation, database constraints,
idempotency storage, rate limits, audit immutability, secrets, flag evaluation,
mobile release enforcement, maintenance recovery, monitoring, backup, incident
response, deployment, or infrastructure. Record these as future backend and
operations responsibilities.
