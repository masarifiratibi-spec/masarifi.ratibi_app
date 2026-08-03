# Quickstart: Validate Platform Overview and Cross-Platform Customer Analytics

**Phase / Spec**: Phase 1 / Spec 002  
**Working directory**:
`D:\MY Work\0Part_Time\MASREFY _Final\apps\admin-web`

This guide defines the evidence required after Spec 002 implementation. Its
presence does not claim that implementation exists or that any command passes.

## Prerequisites

- Phase 0 / Spec 001 remains implemented and verified.
- Dependencies are installed from the existing lockfile.
- No real backend, database, provider, credential, or production
  authentication is configured.
- Only sanitized fictional Overview fixtures are enabled.
- The contract in
  `specs/002-admin-overview-and-platform-analytics/contracts/admin-overview.openapi.yaml`
  and model in
  `specs/002-admin-overview-and-platform-analytics/data-model.md` are current.

No dependency installation or upgrade is expected for Spec 002.

## Reference Environment

- Windows reference host
- Node.js 24.16.0
- npm 11.17.0
- Next.js 16.2.11
- React 19.2.8
- TypeScript 5.9.3
- Tailwind CSS 4.3.3
- TanStack Query 5.101.4
- TanStack Table 8.21.3
- React Hook Form 7.83.0
- Zod 4.4.3
- Recharts 3.10.0
- Lucide React 1.26.0
- MSW 2.15.0
- Vitest 4.1.10
- Playwright 1.62.0

`NEXT_PUBLIC_ENABLE_MOCKS=true` may be used only by the local Playwright
production server. A normal production build must not start MSW as its data
source.

## Automated Verification

Run each command separately and record its actual exit code:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Expected outcomes:

- TypeScript strict checking reports no error and no application `any`.
- ESLint reports zero warning and zero error.
- Vitest passes Overview schema, invariant, repository, ordering, permission,
  state, chart-summary, and safe-rendering tests.
- Playwright passes Overview filter, role, state, accessibility, viewport,
  direction, theme, security, visual-preservation, and performance journeys.
- The production build completes without a real backend or production MSW
  dependency.

Do not report any command as passing unless it was executed successfully.

## Run the Development Application

```powershell
npm run dev
```

Open `http://localhost:3000/admin`. If port 3000 is already occupied, use the
actual port printed by Next.js.

The development-only role and scenario behavior must remain visibly labeled
and must not imply real authentication or backend authorization.

## Route and Architecture Check

Verify only the existing `/admin` route was extended.

```powershell
rg -n "@/mocks/fixtures|@/data|data/admin" src/app src/components
```

Expected result: no page or presentation-component fixture import.

Verify typed Overview flow:

```text
src/app/admin/page.tsx
  → src/features/overview/hooks.ts
  → src/features/overview/repository.ts
  → src/core/api/client.ts
  → src/mocks/handlers/overview.ts or attention.ts
  → src/mocks/fixtures/overview.ts
```

Confirm no Next.js route handler, backend module, database client, provider
client, real authentication, or new route was added.

## Default Combined Overview

With platform `all` and period `30d`, verify:

1. All Platforms is selected by default.
2. Unique, active, new, paid, and free customer values are visible.
3. Revenue, subscription, import, AI, support, incident, failed-job, and global
   service-health summaries are visible.
4. Every metric exposes kind, platform scope, period, and freshness.
5. Customer and financial values are aggregated.
6. Global health is labeled Global.
7. The existing page hierarchy, density, teal, bronze restraint, typography,
   spacing, and components remain visually equivalent.

## Customer Counting Invariants

Run focused fixtures for:

- combined multi-platform customers;
- iOS-only customers;
- Android-only customers;
- one customer with multiple devices;
- overlapping active audiences;
- qualifying and excluded activity;
- new-customer registration origin;
- impossible breakdown.

For every valid fixture verify:

```text
iOS-only + Android-only + multi-platform = unique total
iOS customers = iOS-only + multi-platform
Android customers = Android-only + multi-platform
active total ≤ active iOS + active Android
new total = new iOS + new Android
```

Confirm:

- background jobs, push delivery, provider callbacks, and Admin actions do not
  increase active-customer counts;
- incomplete registration, onboarding completion, and first activity do not
  increase new-customer counts;
- a completed registration increments new customers at most once;
- new customers appear in exactly one registration-origin platform count;
- an impossible response fails the customer region safely and does not
  fabricate a total.

## Platform and Period Matrix

Exercise:

```text
all × 7d, 30d, 90d
ios × 7d, 30d, 90d
android × 7d, 30d, 90d
```

For every combination verify:

- the active platform and period are announced and visibly selected;
- attributable KPIs, customer analytics, adoption, imports, support, trends,
  attention, and activity use the same selection;
- no stale label or response overwrites the latest selection;
- user growth, DAU, MAU, platform comparison, revenue, and error-rate series
  use consistent windows, units, and aggregation semantics;
- global health stays unchanged and labeled Global;
- the local interaction acknowledges selection within 200 milliseconds.

## Platform Adoption

For iOS verify:

- aggregated customer and device counts;
- current, supported older, unsupported, and unknown version states;
- Shortcut and Share Extension adoption;
- import volume/success and support summaries;
- no claim of unrestricted SMS or notification access.

For Android verify:

- aggregated customer and device counts;
- version states;
- SMS tracking and Notification Listener adoption;
- import volume/success and support summaries.

Unknown platform or version data must remain a visible data-quality category.
No customer or device identifier may appear.

## Independent Region States

Demonstrate each applicable state independently:

- loading;
- success;
- empty;
- partial;
- stale;
- invalid request or response;
- rate limited;
- unavailable;
- internal error;
- warning;
- forbidden;
- session expired.

Confirm:

- one regional failure does not blank successful sibling regions;
- retry updates only its region;
- stale content retains its last-updated context and warning;
- empty content names the active platform and period;
- errors use stable safe messages and expose no raw exception, stack,
  infrastructure path, provider payload, or private data.

## Attention Ordering and Permissions

Create an intentionally unordered attention fixture. Verify the visible result
uses:

```text
critical → high → medium → low → info
then newest timestamp first
then stable identifier
```

For all seven simulated roles verify:

- `/admin` requires `admin.overview.read`;
- the attention region requires `attention.read`;
- destinations also require their own permission;
- inactive later-phase or unauthorized routes are not links;
- severity uses label, text, icon, and color;
- a direct denied Overview removes protected metrics and shows the shared
  access-denied state.

Document that this is development-only UX simulation and not production
authorization.

## Activity Pagination

Verify:

- the initial activity page is bounded;
- loading more uses the shared pagination envelope;
- changing platform or period resets pagination safely;
- empty results explain the active filters;
- summaries and identifiers are fictional and sanitized;
- the feed is labeled operational activity, not immutable audit history;
- unauthorized or inactive destinations are omitted.

## Accessibility Review

Using keyboard and screen-reader inspection, verify:

- logical focus order and visible focus;
- accessible names and selected states for platform and period controls;
- refresh, retry, activity pagination, attention, and any reused drawer/dialog
  are keyboard operable;
- focus is trapped and restored where a drawer or dialog is used;
- status changes use suitable busy, status, or alert semantics without
  excessive announcements;
- each chart has an accessible title, unit, scope, period, and non-empty text
  summary;
- legends, severity, status, and trends remain understandable without color;
- touch targets are at least 44px at touch viewports;
- 200% text scaling remains usable;
- reduced motion removes nonessential transitions without hiding values.

## Viewport, Direction, and Theme Matrix

Review `/admin` in Arabic RTL and English LTR, light and dark themes, at:

- 1440px
- 1280px
- 1024px
- 768px
- 390px

Confirm:

- zero page-level horizontal overflow;
- approved desktop density remains intact;
- tablet layouts preserve useful analytical order;
- the 390px view prioritizes urgent attention, combined customer state,
  platform switch, adoption warnings, health, and recent urgent activity;
- dense comparisons become readable stacked summaries;
- no unapproved color, type, spacing, shell, asset, or interaction-language
  change appears.

## Security and Privacy Review

Verify:

- platform, period, locale, pagination, scenario, response values, rates,
  versions, timestamps, labels, identifiers, and destinations are validated;
- impossible count, invalid rate, malformed pagination, unsafe summary, and
  unapproved destination fixtures fail safely;
- response strings render as escaped text;
- `dangerouslySetInnerHTML` is not introduced;
- no Overview result or sensitive value enters `localStorage` or
  `sessionStorage`;
- no secret or private configuration uses a browser-public environment value;
- no full email, phone, account identifier, transaction content, imported
  message, provider payload, AI conversation, IP address, or device identifier
  appears in UI, fixtures, logs, screenshots, or errors;
- no upload, preview, external link, or redirect behavior was added;
- no dependency was added or upgraded;
- future NestJS authorization, Supabase policies, server aggregation,
  financial normalization, rate limiting, audit persistence, monitoring, and
  provider protections remain explicitly deferred.

Useful scans:

```powershell
rg -n "\bany\b" src --glob "*.ts" --glob "*.tsx"
rg -n "dangerouslySetInnerHTML|localStorage|sessionStorage" src
rg -n "NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD)" .
```

Review matches in context; existing safe or test-only occurrences are not
automatically failures.

## Performance Review

Record:

- device and operating system;
- browser version;
- production build identifier;
- viewport, direction, and theme;
- default mock latency.

Under those reference conditions verify:

- primary Overview content becomes visible within 2.5 seconds;
- each platform, period, refresh, retry, activity pagination, and attention
  interaction acknowledges input within 200 milliseconds.

Run deliberate slow scenarios separately; they validate loading behavior and
are excluded from the timing gate.

## Completion Evidence

Spec 002 is ready for implementation review only when:

- every automated command has recorded successful output;
- all four contracts and required mock scenarios are covered;
- customer and metric invariants pass;
- all independent region states are demonstrated;
- the role and destination matrix passes;
- the viewport, direction, theme, accessibility, security, privacy,
  performance, and design-preservation reviews pass;
- no backend, new route, dependency change, later-phase workflow, or visual
  redesign was introduced.

Record final evidence in a Spec 002 verification report during implementation.
