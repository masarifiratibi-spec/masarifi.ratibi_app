# Spec 001 Approved Baseline

Recorded before implementation on 2026-07-27.

## Approved routes

- `/admin`
- `/admin/users`
- `/admin/imports`
- `/admin/system-health`

## Existing presentation surface

- `src/components/admin/AdminShell.tsx`
- `src/components/admin/Charts.tsx`
- `src/components/admin/ui.tsx`
- `src/app/globals.css`

The implementation must preserve the existing route structure, component
markup, spacing, typography, density, and responsive behavior unless a Spec
001 requirement explicitly adds an accessible operational state.

## Design-token groups

- Neutral surfaces: `--page`, `--surface`, `--surface-muted`,
  `--surface-strong`
- Text: `--text`, `--text-secondary`, `--text-muted`
- Borders and elevation: `--border`, `--border-strong`, `--shadow`
- Primary interaction: `--teal`, `--teal-hover`, `--teal-soft`
- Premium accent: `--bronze`, `--bronze-soft`
- System status: `--success`, `--warning`, `--danger`, `--info` and their
  soft variants

Both light defaults and the existing `[data-theme="dark"]` overrides are
approved. Bronze remains a limited accent and must not become a general
interaction color.

## Existing assets

- `public/download.png`
- `public/og.png`

## Existing scripts

- `npm run dev`
- `npm run build`
- `npm run build:sites`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Direct fixture imports to remove

1. `src/app/admin/page.tsx` imports `@/data/admin/overview`.
2. `src/app/admin/users/page.tsx` imports `@/data/admin/users`.
3. `src/app/admin/imports/page.tsx` imports `@/data/admin/imports`.
4. `src/app/admin/system-health/page.tsx` imports
   `@/data/admin/system-health`.

The fixture values must be moved, not copied, and pages must consume typed
repository hooks.

## Preservation checklist

- [ ] Arabic remains the default locale and RTL document direction.
- [ ] English switches the same approved interface to LTR.
- [ ] Light mode preserves the approved visual baseline.
- [ ] Dark mode remains complete and legible.
- [ ] The four routes are verified at 1440px.
- [ ] The four routes are verified at 1280px.
- [ ] The four routes are verified at 1024px.
- [ ] The four routes are verified at 768px.
- [ ] The four routes are verified at 390px.
- [ ] Financial semantic colors remain distinct from system-status colors.
- [ ] Sensitive customer data remains masked or aggregated by default.
- [ ] New controls use semantic tokens and preserve the approved density.

## Baseline command evidence

| Command | Result |
|---|---|
| `npm test` | PASS — 3 tests, 0 failures |
| `npm run typecheck` | PASS — exit code 0 |
| `npm run lint` | PASS — exit code 0 |
| `npm run build` | PASS — 6 application routes generated |

These results establish the pre-implementation baseline only. Targeted and
final verification results are recorded later in this file and in
`verification-report.md`.

## Route, theme, direction, and viewport expectations

| Route | Required invariant |
|---|---|
| `/admin` | Operational metrics, charts, attention, health, and activity remain data-dense and neutral. |
| `/admin/users` | Filters, responsive table/cards, pagination, bulk bar, and masked detail drawer retain their approved hierarchy. |
| `/admin/imports` | Metrics, charts, filters, table/cards, detail drawer, and retry confirmation retain their approved hierarchy. |
| `/admin/system-health` | Summary, service rows, charts, incident list, and incident drawer retain their approved hierarchy. |

Each route is checked in light and dark themes, Arabic RTL and English LTR,
and at 1440, 1280, 1024, 768, and 390 pixels.

Approved responsive exceptions are limited to the existing behavior:

- The fixed desktop sidebar becomes a mobile drawer below 900 pixels.
- Desktop tables become mobile data cards below 900 pixels.
- Dense metric and summary grids reduce columns at existing breakpoints.
- Nonessential profile text and secondary controls may collapse at narrow
  widths, but primary route content and actions remain reachable.
- Logical CSS properties mirror layout in LTR without redesigning it.

## User Story 1 targeted evidence

| Command | Result |
|---|---|
| `npm test -- src/components/admin/Charts.test.tsx` | PASS — 2 tests, 0 failures |
| `npx playwright test tests/e2e/visual-preservation.spec.ts --project=desktop-1440` | PASS — 4 routes, 0 failures |
| `rg -n '#[0-9A-Fa-f]{3,8}' src/components/admin/Charts.tsx src/components/admin/ui.tsx` | PASS — no presentation-component matches |

The first Playwright attempt failed because the newly selected Playwright
version had no local browser binary. Chromium was installed, all viewport
projects were pinned to Chromium, and the targeted rerun passed.

## User Story 2 targeted evidence

| Command | Result |
|---|---|
| `npm test -- src/components/admin/AdminShell.test.tsx src/components/admin/Charts.test.tsx` | PASS — 5 tests, 0 failures |
| `npx playwright test tests/e2e/foundation.spec.ts --project=desktop-1440 --project=mobile-390` | PASS — 4 journeys, 2 intentional project skips, 0 failures |

The shell evidence covers active and planned navigation, all seven role
labels, development environment labeling, light/dark switching, RTL/LTR
switching, and mobile drawer focus restoration.

## User Story 3 targeted evidence

| Command | Result |
|---|---|
| `npm test -- src/features/overview/repository.test.ts src/features/users/repository.test.ts src/features/imports/repository.test.ts src/features/system-health/repository.test.ts src/tests/no-direct-fixtures.test.ts` | PASS — 10 tests, 0 failures |
| `npx playwright test tests/e2e/visual-preservation.spec.ts --project=desktop-1440` | PASS — 4 migrated routes, 0 failures |
| `rg -n "@/data|data/admin" src/app src/components` | PASS — 0 matches |

All four fixture modules were moved into `src/mocks/fixtures`; the original
`src/data/admin` files no longer exist. Page components consume typed hooks,
and the users page derives rendered rows through TanStack Table.

## User Story 4 targeted evidence

| Command | Result |
|---|---|
| `npm test -- src/components/admin/security.test.tsx src/core/permissions/role-map.test.ts` | PASS — 21 tests, 0 failures |
| `npx playwright test tests/e2e/permissions.spec.ts --project=desktop-1440` | PASS — 7 journeys, 0 failures |

Evidence covers all seven simulated roles, direct-route denial, development
disclaimer, unsafe input, masked values, session expiry, required
confirmation metadata, and duplicate-submission locking.

## User Story 5 targeted evidence

| Command | Result |
|---|---|
| `npx playwright test tests/e2e/visual-preservation.spec.ts --project=<each approved viewport> --workers=2` | PASS — 20 route/viewport tests, covering 80 route/theme/direction states, 0 failures |
| `npx playwright test tests/e2e/accessibility.spec.ts --project=desktop-1440 --project=mobile-390 --workers=2` | PASS — 3 applicable journeys, 3 intentional project skips, 0 failures |
| `npx playwright test tests/e2e/performance.spec.ts --project=desktop-1440` | PASS — shell and interaction timing gates, 0 failures |

The viewport matrix covers 1440, 1280, 1024, 768, and 390 pixels. Each
route was exercised in Arabic RTL and English LTR, in light and dark themes,
with horizontal-overflow and unexpected-console-error assertions.
