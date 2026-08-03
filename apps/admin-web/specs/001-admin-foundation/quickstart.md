# Quickstart: Validate Admin Foundation

**Phase / Spec**: Phase 0 / Spec 001  
**Working directory**:
`D:\MY Work\0Part_Time\MASREFY _Final\apps\admin-web`

This guide describes the commands and observable evidence required after Spec
001 implementation. Its presence does not claim those commands currently pass.

## Prerequisites

- Supported Node.js version for the existing Next.js project
- Dependencies installed from the committed lockfile
- No real backend, database, provider, or credential configuration
- Sanitized fictional fixtures only

Install exactly the locked dependencies:

```powershell
npm install
```

## Resolved reference environment

- Windows reference host
- Node.js 24.16.0
- npm 11.17.0
- Next.js 16.2.11
- React 19.2.8
- TypeScript 5.9.3
- TanStack Query 5.101.4
- TanStack Table 8.21.3
- React Hook Form 7.83.0
- Zod 4.4.3
- Recharts 3.10.0
- Lucide React 1.26.0
- MSW 2.15.0
- Vitest 4.1.10
- Playwright 1.62.0 with Chromium 151

`NEXT_PUBLIC_ENABLE_MOCKS=true` is set only by the Playwright local production
server. Development starts mocks through `NODE_ENV=development`. A normal
production build does not start MSW.

## Automated Verification

Run each command separately and record its exit code:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Expected results:

- TypeScript strict checking reports no error and application code uses no
  `any`.
- ESLint reports no error.
- Vitest passes schema, repository, permission, utility, state, and component
  tests.
- Playwright passes the route, direction, theme, viewport, permission, search,
  accessibility, security, and performance scenarios.
- The production build completes without starting MSW as a production data
  source.

Do not report a command as passing unless it was actually run successfully.

## Run the Development Application

```powershell
npm run dev
```

Open `http://localhost:3000/admin`. The development-only role/scenario controls
must be visibly labeled and must not imply production authentication.

## Route and Data-Boundary Check

Verify:

1. `/admin`
2. `/admin/users`
3. `/admin/imports`
4. `/admin/system-health`

For each route:

- approved content and interactions remain visually equivalent;
- the route loads through a feature hook and typed repository;
- no page or presentation component imports `src/data/admin/*`;
- success, loading, empty, error, and permission states are reachable where
  relevant;
- sensitive values remain masked or omitted.

Static guard:

```powershell
rg -n "@/data|data/admin" src/app src/components
```

Expected result after implementation: no matches.

## Contract Scenarios

Use deterministic MSW overrides to cover:

- default success;
- empty;
- large paginated result;
- slow response;
- partial response;
- unauthorized;
- forbidden;
- not found;
- validation error;
- conflict;
- rate limited;
- provider unavailable;
- internal server error.

Confirm the UI displays only the corresponding safe state and never exposes a
raw exception or private payload.

## Permission Matrix

Test every role against the four routes:

| Role | Overview | Users | Imports | System Health |
|------|----------|-------|---------|---------------|
| Super Admin | Allow | Allow | Allow | Allow |
| Support Agent | Allow | Allow | Deny | Deny |
| Billing Operator | Allow | Deny | Deny | Deny |
| Parser and Import Operator | Allow | Deny | Allow | Deny |
| AI Operator | Allow | Deny | Deny | Deny |
| Content Manager | Allow | Deny | Deny | Deny |
| Security Administrator | Allow | Allow | Deny | Allow |

Confirm denied results are excluded from navigation, attention, and global
search. Direct denied navigation must show the accessible access-denied state.

## Search Scope

Search must return only:

- Navigation
- Users
- Imports
- System Health

Future module groups must not appear as active results.

## Viewport, Direction, and Theme Matrix

Review every route in both Arabic RTL and English LTR, in light and dark themes,
at:

- 1440px
- 1280px
- 1024px
- 768px
- 390px

Confirm:

- logical sidebar and drawer placement;
- no page-level horizontal clipping;
- approved density, typography, teal, and limited bronze usage;
- readable status, financial, and severity semantics in both themes;
- mobile monitoring remains usable while complex configuration stays out of
  scope.

## Accessibility Review

Using keyboard and screen-reader inspection, verify:

- visible focus and logical order;
- drawer/dialog focus containment and restoration;
- accessible names and state announcements;
- 44px touch targets where applicable;
- table headers and chart summaries;
- no state conveyed by color alone;
- reduced-motion behavior;
- accessible masking, warnings, confirmation, and denial states.

## Security and Privacy Review

Verify:

- URL, search, filter, identifier, mock response, and mutation values are
  validated;
- no undocumented `dangerouslySetInnerHTML`;
- no token, credential, private configuration, financial data, or temporary
  access data in source, browser storage, fixtures, logs, or screenshots;
- new-tab links prevent opener access and redirects are validated;
- errors and logs exclude raw exceptions and private payloads;
- sensitive actions explain scope/consequence, identify the future audit event,
  and lock duplicate submission while pending;
- dependencies are limited to the approved missing stack and have no known
  unresolved risk accepted silently;
- deferred NestJS, Supabase, infrastructure, and provider protections remain
  documented rather than simulated as production security.

## Performance Review

Record in the test evidence:

- reference device and operating system;
- browser version;
- production build identifier;
- viewport;
- default mock latency.

Under those conditions:

- primary shell content becomes visible within 2.5 seconds;
- local interactions show visible acknowledgement within 200 milliseconds.

Run deliberate slow-response mocks separately; they test loading behavior and
are excluded from these gates.

## Completion Evidence

Phase 0 is ready for review only when:

- all automated commands have recorded successful output;
- all four direct fixture imports are removed;
- the route/theme/direction/viewport matrix passes;
- the permission and search scope pass;
- accessibility, security, privacy, and performance reviews pass;
- no later-phase route or real backend integration was added.

Record final command evidence and requirement mappings in
`specs/001-admin-foundation/verification-report.md`. Targeted red/green and
story-level evidence remains in `specs/001-admin-foundation/baseline.md`.
