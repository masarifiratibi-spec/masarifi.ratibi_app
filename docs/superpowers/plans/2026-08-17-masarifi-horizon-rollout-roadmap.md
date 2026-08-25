# Masarifi Horizon App-Wide Rollout Roadmap

**Design authority:** `docs/superpowers/specs/2026-08-17-masarifi-horizon-app-unification-design.md`

**Purpose:** Move the whole mobile application to the approved Masarifi Horizon identity through independently reviewable releases. This roadmap fixes sequence, ownership, and release gates; each stage receives its own executable TDD plan only after its Arabic and English visual proposal is approved.

## Program rules

- Work only in `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation`.
- Preserve all existing uncommitted changes. Do not reset, clean, commit, push, or overwrite unrelated files.
- Keep domain schemas, service contracts, stored financial data, privacy behavior, routes, deep links, and task flows unchanged.
- Keep light mode as the only active visual target. Dark-mode source remains present but is outside this program.
- Reserve the strong Horizon gradient for Home and Transactions.
- Reuse the existing design system, category mapping, OpenMoji assets, app sheets, privacy owner, query owners, and route owners.
- Do not start production edits for a stage until its Arabic RTL and English LTR proposal is explicitly approved.
- At 200% text, stack or reflow; never reduce semantic typography to preserve a horizontal layout.
- Android and TalkBack pass claims require evidence from an authorized attached device.

## Fixed visual language

- Arabic UI: Noto Sans Arabic UI, semantic weights 400/500/600/700/800.
- English UI and financial numerals: Roboto, semantic weights 400/500/600/700/900.
- Roboto financial values use LTR isolation and tabular numerals in both locales.
- OpenMoji remains limited to categories, merchants, and financial meaning.
- Masarifi line icons remain responsible for navigation, actions, settings, security, and states.
- Financial entities use independent rounded cards.
- Settings and compact choices use grouped rows with internal dividers.
- Forms keep calm surfaces and clear sections instead of wrapping each field in a card.
- Bottom sheets handle quick decisions; long forms retain full-screen routes; dates retain native pickers.

## Stage sequence

### Stage 0 — Shared Horizon foundation

**Scope**

- Vendor and license the approved font weights.
- Replace the IBM Plex resolver with semantic Noto/Roboto font resolution.
- Complete shared Horizon typography, surfaces, cards, fields, chips, segmented controls, headers, rows, states, and menu-sheet treatment.
- Add design-system gallery and boundary coverage.

**Exit gate**

- Shared primitives render correctly in Arabic RTL, English LTR, normal text, and 200% text.
- Focused design-system tests, full Jest, typecheck, lint, foundation/design-system/app-shell/core-finance boundaries, and Impeccable pass.

### Stage 1 — Transactions

**Scope**

- Branded Horizon header and hero.
- Equal income and expense summary cards.
- Month control, search, compact filters, shortcut rail, and existing advanced filters.
- Today, Yesterday, Last week, and Earlier sections.
- Independent transaction cards with category visuals and direct Edit navigation.

**Preserved behavior**

- Search, filters, summary query ownership, hidden balances, pagination, deduplication, virtualization, empty/loading/error states, contextual Back, deep links, and `/transactions/[id]/edit` navigation.

**Exit gate**

- Approved Arabic and English 390×844 screenshots match the stage proposal.
- Search, month/filter entry, quick scopes, scrolling, pagination, privacy masking, and row navigation work on web and on an authorized Android device when available.

### Stage 2 — Accounts and Categories

**Visual approval package**

- Accounts list, detail, create/edit, and picker in Arabic and English.
- Categories list, detail, create/edit, and picker in Arabic and English.

**Production scope after approval**

- Collection headers, account entity cards, CategoryIcon visuals, grouped pickers, detail states, and task-form styling.
- Preserve balances, account calculation, merge rules, category mapping, validation, and routes.

**Exit gate**

- Account and category journeys, privacy states, large text, RTL/LTR, core-finance boundaries, and visual checks pass.

### Stage 3 — Planning and Reports

**Visual approval package**

- Budgets, salary, obligations, savings, Reports overview, drill-down, preview, and schedule representatives.

**Production scope after approval**

- Light Horizon collection/task headers, financial cards, semantic charts, progress states, and form controls.
- Preserve planning calculations, chart data, scheduled delivery, reporting filters, and financial links.

**Exit gate**

- Financial-planning and Reports journeys, chart accessibility, privacy, RTL/LTR, 200% text, boundaries, and visual checks pass.

### Stage 4 — Automation and Assistance

**Visual approval package**

- Tracking status/review, voice capture/review, Assistant home/action preview, and Notifications center/preferences.

**Production scope after approval**

- Apply Horizon task states, grouped review rows, recording surfaces, evidence cards, and notification hierarchy.
- Preserve permissions, recording, automatic tracking, confidence/review logic, personalization privacy, and notification behavior.

**Exit gate**

- Voice, tracking, Assistant, and notification journeys and boundaries pass with reduced motion, accessibility, RTL/LTR, and 200% text.

### Stage 5 — Utility Surfaces

**Visual approval package**

- More, Profile, App Settings, Privacy, Security, Sessions, Support, and Subscriptions representatives.

**Production scope after approval**

- Grouped navigation rows, collection/task headers, Horizon menu sheets, destructive-action treatments, and support/subscription cards.
- Preserve security ownership, stored preferences, account deletion/export flows, support persistence, and subscription rules.

**Exit gate**

- Settings, privacy, security, support, and subscription journeys pass with explicit destructive confirmations and retained user data.

### Stage 6 — Entry Experience

**Visual approval package**

- Welcome, sign-in, sign-up, language, phone, OTP, Google, legal, onboarding permissions/preferences, and completion.

**Production scope after approval**

- Light Horizon entry surfaces, task headers, forms, permission explanation, and completion hierarchy.
- Preserve authentication, OTP, legal acceptance, platform-specific onboarding, and recovery routes.

**Exit gate**

- Auth/onboarding route tests, platform variants, accessibility, RTL/LTR, 200% text, and visual checks pass.

### Future program — Dark mode

- Start only after Stage 6 is accepted.
- Produce a separate dark token/specimen proposal and accessibility audit before enabling theme selection again.
- Do not infer dark surfaces by mechanically inverting the approved light system.

## Stage handoff template

Each stage produces the following before the next stage starts:

1. Approved Arabic RTL and English LTR proposal at 390×844.
2. Stage-specific executable TDD plan with exact files and commands.
3. Focused red/green evidence.
4. Full automated verification evidence.
5. Web normal-text and 200%-text captures.
6. Android evidence when an authorized device exists, or an explicit device/build blocker.
7. A short list of preserved domain and navigation contracts.

## First executable release

The companion plan `docs/superpowers/plans/2026-08-17-masarifi-horizon-foundation-transactions.md` covers Stage 0 and Stage 1 only. Later executable plans are intentionally deferred until their visual proposals are approved.
