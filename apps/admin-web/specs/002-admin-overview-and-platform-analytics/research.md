# Research: Platform Overview and Cross-Platform Customer Analytics

**Phase / Spec**: Phase 1 / Spec 002  
**Date**: 2026-07-27

All technical-context decisions are resolved. These choices apply only to the
existing Admin Web frontend and do not authorize backend implementation.

## Decision 1: Extend the existing Overview feature in place

**Decision**: Keep `/admin`, `src/features/overview`, the approved Admin
components, and the existing semantic CSS tokens.

**Rationale**: Phase 0 already established the required route, repository,
TanStack Query, Zod, MSW, permission, and test foundations. Extending them is
the smallest change and best preserves the approved design.

**Alternatives considered**:

- New analytics route: rejected because Spec 002 approves only `/admin`.
- New application or dashboard package: rejected as duplicate configuration
  and premature workspace complexity.
- Separate generic analytics framework: rejected because there is one current
  consumer and no demonstrated abstraction need.

## Decision 2: Split network state by visible region

**Decision**: Use separate queries for overview summary, platform analytics,
activity, and attention.

**Rationale**: The specification requires regional failure isolation. The
current single Overview response and top-level loading return cannot satisfy
that requirement without blanking successful regions.

**Alternatives considered**:

- One expanded response: rejected because one failure still controls the whole
  page.
- One request per card: rejected because it adds excessive contracts and query
  churn without improving required isolation.

## Decision 3: Keep one feature repository

**Decision**: Add methods to the existing `OverviewRepository`; reuse the
foundation attention contract where its shared shell behavior remains
applicable.

**Rationale**: All data belongs to the `/admin` Overview and shares platform,
period, locale, validation, and error semantics.

**Alternatives considered**:

- One repository per region: rejected as unnecessary interface proliferation.
- Fetch directly from components: rejected by the constitution and Phase 0
  boundary.

## Decision 4: Use authoritative totals with validation-only invariants

**Decision**: Combined unique customers, active customers, subscriptions, and
revenue come from authoritative response fields. The frontend validates
declared invariants but does not reconstruct production totals.

**Rationale**: iOS and Android customer audiences can overlap, revenue can have
non-additive attribution, and the future backend owns deduplication and
financial normalization.

**Alternatives considered**:

- Sum platform counts in the browser: rejected because it double-counts
  multi-platform customers.
- Infer totals from mock records: rejected because it teaches the page a
  backend responsibility and requires customer-level data.

## Decision 5: Define active and new customer semantics in the contract

**Decision**:

- Active customer: at least one customer-initiated authenticated session or
  feature-use event in the selected period.
- Excluded activity: background jobs, push delivery, provider callbacks, and
  Admin actions.
- New customer: registration completed in the selected period, counted once
  and attributed to the registration-origin platform.

**Rationale**: These clarified definitions make fixtures and future backend
aggregations deterministic and prevent inflated counts.

**Alternatives considered**:

- Any customer-associated event: rejected because passive work inflates active
  audiences.
- First activity or onboarding completion for new customers: rejected because
  they can occur after registration and count the same customer again.

## Decision 6: Use bounded response shapes

**Decision**: Activity and attention use the shared paginated response model.
Chart series, version distributions, and category lists have documented
contract limits.

**Rationale**: The Overview needs summaries, not unbounded operational records.
Bounds protect rendering performance and future API compatibility.

**Alternatives considered**:

- Return all activity: rejected because the list can grow without limit.
- Add infinite scrolling: rejected because it is not required and complicates
  keyboard and state behavior.

## Decision 7: Keep reporting periods preset-only

**Decision**: Spec 002 uses the approved `7d`, `30d`, and `90d` values with
`30d` as default. The existing custom date capability remains available to
other foundation consumers but is not activated for this Overview scope.

**Rationale**: The feature specification approves only the three periods, and
fixed windows make cross-platform comparisons consistent.

**Alternatives considered**:

- Custom date range: rejected as unrequested scope.
- Local date arithmetic in the page: rejected because the future backend owns
  reporting-window semantics.

## Decision 8: Use platform origin according to metric semantics

**Decision**:

- Active audience attribution uses qualifying-event origin and may overlap.
- New customer attribution uses registration origin and is mutually exclusive.
- Devices use their exclusive mobile platform.
- Events are additive only when origin is exclusive and deduplicated.
- Global health remains unattributed.

**Rationale**: One generic additivity rule would be mathematically incorrect
for several required metrics.

**Alternatives considered**:

- Force every measure into iOS or Android: rejected because health and some
  backend aggregates are global.
- Let the page guess attribution: rejected because missing attribution is a
  visible data-quality state.

## Decision 9: Represent adoption as aggregated distributions

**Decision**: Version and capability adoption responses contain counts, shares,
support states, eligible populations, enabled populations, and safe caveats.

**Rationale**: Operators receive actionable adoption insight without exposing
customer or device identifiers.

**Alternatives considered**:

- Customer/device lists: rejected by privacy scope.
- Percentages without source counts: rejected because reviewers cannot
  validate the distribution.

## Decision 10: Sort attention predictably

**Decision**: Sort validated and permission-filtered items by severity
descending, timestamp descending, then stable identifier.

**Rationale**: The clarified specification requires severity then recency. The
identifier tie-break makes fixture and browser tests deterministic.

**Alternatives considered**:

- Preserve response order: rejected because malformed order would violate the
  specified behavior.
- Recency first: rejected by clarification.

## Decision 11: Preserve safe rendering and approved destinations

**Decision**: Render all response content as text. Optional activity and
attention destinations must match the Phase 0 route allowlist and the simulated
role permission; otherwise omit the link.

**Rationale**: Response strings and routes are untrusted. A visible safe summary
does not imply permission to navigate.

**Alternatives considered**:

- Render provider HTML/Markdown: rejected as unnecessary and unsafe.
- Accept arbitrary relative URLs: rejected because later-phase and open
  redirect destinations must not become active.

## Decision 12: Reuse installed dependencies only

**Decision**: Add no package and make no dependency upgrade.

**Rationale**: The installed fixed stack already covers validation, query
state, charts, forms, tables, icons, mocks, unit tests, and browser tests.

**Alternatives considered**:

- Date, chart, dashboard, or state packages: rejected because native values and
  installed libraries already cover the requirement.

## Decision 13: Test invariants below the browser and journeys in the browser

**Decision**: Vitest covers schemas, repositories, sorting, permission
filtering, count invariants, unsafe data rejection, and region components.
Playwright covers the platform/period journeys, independent states, keyboard,
direction, theme, viewports, accessibility, performance acknowledgement, and
visual preservation.

**Rationale**: This is the smallest split that keeps logic failures fast to
diagnose and verifies actual user behavior.

**Alternatives considered**:

- Put every permutation in Playwright: rejected as slow and duplicative.
- Unit tests only: rejected because responsive, focus, and route behavior
  require a browser.

## Resolved environment

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

No dependency change is part of Spec 002.
