# Baseline: Platform Overview and Cross-Platform Customer Analytics

**Phase / Spec**: Phase 1 / Spec 002
**Recorded**: 2026-07-27
**Purpose**: Capture the approved pre-Spec 002 `/admin` baseline before editing code.

## T001 — Reusable hierarchy and no-redesign constraints

Approved page composition in `src/app/admin/page.tsx` (preserve order, classes, and
tokens):

1. `PageHeader` with eyebrow / title / description and `page-actions` containing
   `PlatformFilter` (segmented control), an ad hoc period `<select className="select">`
   (`7d | 30d | 90d`), and a `RefreshCw` refresh button.
2. Two `metrics-grid` rows driven by `MetricCard` (first four `primary`, remainder
   default).
3. `section-grid` with `ChartCard` "نمو المستخدمين" (`TrendChart compare`) plus the
   `attention-card` ("يتطلب انتباهك") rendering `attentionItems` with `SeverityBadge`.
4. `section-grid equal` with import `VolumeChart stacked`, subscription `DonutChart`,
   and platform `DonutChart`; legends use `--chart-series-*` tokens only.
5. `section-grid` with operational health card (`StatusBadge`, `health-list`) and
   "النشاط الأخير" raw activity array.

Reusable components (preserve structure/styles):

- `src/components/admin/ui.tsx` — `PageHeader`, `MetricCard`, `Trend`,
  `SeverityBadge`, `StatusBadge`, `Drawer`, `ConfirmDialog`, `EmptyState`,
  `ErrorState`, `LoadingState`, `SuccessState`, `WarningState`, `ConflictState`,
  `UnavailableState`, `AccessDeniedState`, `TableSkeleton`.
- `src/components/admin/Charts.tsx` — `ChartCard` (renders `summary` as `sr-only`),
  `TrendChart`, `VolumeChart`, `DonutChart`, `CHART_SERIES` token array.
- `src/components/admin/PlatformFilter.tsx` — accessible segmented control.
- `src/components/admin/DateRangeControl.tsx` — preset (`7d|30d|90d|custom`) + custom
  RHF date inputs.
- `src/components/admin/AttentionPanel.tsx` — shell notification drawer bound to
  `useAttention(role)`.

Constraints: Arabic RTL default, deep-teal primary, bronze ~2–3%, semantic tokens only,
no new route, no redesign, no `any`, no dependency change.

## T002 — Current single-response limitations and four target contracts

Current Overview data flow uses ONE combined response
(`useOverview` → `overviewRepository.getOverview` →
`/api/v1/admin/overview`):

- `overviewResponseSchema` merges `metrics`, `attentionItems`, `importVolume`,
  `services`, `activity`, `userGrowth`, `subscriptionBreakdown`, `platformBreakdown`,
  plus optional `partial`/`warning`/`empty`.
- The page has a single top-level loading/error return
  (`overview.isPending → LoadingState`, `overview.isError → ErrorState`) that blanks the
  entire page on any failure — this cannot satisfy regional failure isolation.
- Foundation attention lives separately (`useAttention` → `/api/v1/admin/attention`)
  but returns only `{ items, partial?, warning? }` (no pagination, period, platform, or
  ordering metadata).

Four target contracts for Spec 002 (per OpenAPI
`contracts/admin-overview.openapi.yaml`):

1. `/api/v1/admin/overview` → `OverviewSummaryResponse`
2. `/api/v1/admin/overview/platform-analytics` → `PlatformAnalyticsResponse`
3. `/api/v1/admin/overview/activity` → paginated `OverviewActivityItem`
4. `/api/v1/admin/attention` → paginated `AttentionItem` (extend foundation contract)

## T003 — Pre-implementation command results (no code changes)

| Command | Result | Exit code |
|---|---|---|
| `npm run typecheck` | Pass — strict, no error | 0 |
| `npm run lint` (`eslint .`) | Pass (zero warning/error) | 0 |
| `npm run test` (`vitest run`) | 12 files / 45 tests passed | 0 |
| `npm run build` (`next build`) | Compiled; 7 static routes prerendered | 0 |

Note: the first `npm run lint` invocation crashed with Windows status
`0xC0000409` (a native memory/access violation unrelated to lint output); the
immediate retry exited 0 with no diagnostics. No pre-existing lint failure.

## T004 — Fixed stack confirmed

`npm list --depth=0` confirms the approved fixed stack is installed and Spec 002
requires **no package or lockfile change**:

Next.js 16.2.11, React 19.2.8, TypeScript 5.9.3, Tailwind 4.3.3,
@tanstack/react-query 5.101.4, @tanstack/react-table 8.21.3,
react-hook-form 7.83.0, zod 4.4.3, recharts 3.10.0, lucide-react 1.26.0,
msw 2.15.0, vitest 4.1.10, @playwright/test 1.62.0, eslint 9.39.5.

## T005 — Visual baseline observations (Arabic RTL + English LTR, light + dark)

Approved rendered behavior preserved across 1440 / 1280 / 1024 / 768 / 390px:

- Page context and filters first, then priority metrics (two `metrics-grid` rows),
  then customer-trend/attention section, then analytical comparisons
  (import volume + subscription/platform donuts), then operational health and recent
  activity.
- Charts render inside `ChartCard` with an `sr-only` textual summary.
- Health list shows status/uptime/latency/error cells using `StatusBadge` and
  `numbers ltr` alignment.
- Segmented platform control and the period `<select>` drive the single combined
  query; activity currently renders a raw title/meta array (no pagination/labeling).
- Deep-teal accents, bronze limited to premium metric tone, neutral data-dense surface.
- No page-level horizontal overflow at the documented breakpoints; RTL is the default
  (`<html lang="ar" dir="rtl">`).

No screenshots were captured (no code was changed); these observable notes establish
the approved baseline for later design-preservation comparison.
