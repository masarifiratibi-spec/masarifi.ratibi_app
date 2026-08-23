# Masarifi Mobile — Engineering Audit & Remediation Plan

**Date:** 2026-08-21
**Scope:** `apps/mobile` in worktree `.worktrees/r01-shared-ui-foundation`, branch `codex/r01-shared-ui-foundation`
**Stack (verified):** Expo SDK ~55 / RN 0.83 / React 19.2, expo-router ~55, zustand ^4.5 (5 stores), @tanstack/react-query ^5, expo-sqlite + AsyncStorage + SecureStore, i18next (ar/en, default `ar`), Jest 29 + jest-expo + RNTL 13. **370 test files / ~1,022 cases.**
**Network layer:** none — no `fetch`/`axios`/`XMLHttpRequest` anywhere in `app/` or `src/`; every service is an in-process mock.

All P0 findings and the highest-impact P1 findings were verified by direct file reads (file:line references below). Severity scale: **P0** crash / data corruption / privacy / broken core financial logic · **P1** broken flow, incorrect calculation, navigation failure, major RTL problem · **P2** maintainability, inconsistency, duplication, performance concern · **P3** polish, minor cleanup.

**Decision recorded with product owner (2026-08-21):** fixture/demo data is **removed from production** — no seeding into the real DB; planning/budget/salary read the real ledger; fixtures live only in tests; first launch shows proper empty states.

---

## 1. Executive Summary

This is a **meticulously tested, well-layered prototype that is not production-ready**. The domain core (`src/domain/core-finance.ts`) is genuinely good: integer minor units, exact string-based money parsing, derived balances (no stored aggregates to corrupt), transfers applied exactly once to both accounts, atomic voice batches with rollback. Tests are mostly behavior-driven and deep.

But the app currently **lies to its users in four ways**:

1. **Demo fixture data is seeded into the user's real SQLite ledger** on first launch and is indistinguishable from real data (`core-finance-service.ts:335-346`).
2. **The Salary and Budget screens compute from fixture arrays, not the user's ledger** (`financial-planning-service.ts:69-72`, `717`) — budget detail is structurally always 0% spent.
3. **"Delete my data" (privacy flow) wipes 4 of ~35 tables** — accounts, budgets, obligations, savings, tracking history, and assistant responses all survive (`local-data-reset.ts:10-15`).
4. **The "migration" system cannot migrate** — one `CREATE TABLE IF NOT EXISTS` block that stamps version 7 unconditionally; the first real schema change will corrupt or silently drop data (`database.ts:49-526`).

On top of that: three conflicting refund treatments across screens, a dead `monthStartDay` setting, hardcoded `'SAR'` on Home, mixed UTC/local month boundaries, hardcoded `'2026-01-15'` as "today" in planning, a More tab that doesn't mirror in Arabic (with a test that enshrines the bug), and an Assistant feature with zero RTL handling in an Arabic-first app.

**What's working well** (must be preserved during fixes): the pure domain layer and its test suite; scope-based query invalidation; the SQLite draft system that preserves form input across kills; Latin-digit + FSI-isolate money formatting (`format-financial-value.ts`); the boundary-enforcement scripts (`scripts/check-*-boundaries.mjs`); `StateView` loading/error/empty consistency; delete/undo with correction log; a11y baseline (roles, 44px targets in most places, large-text layouts).

**Counts:** 5 × P0, 19 × P1, ~35 × P2, ~12 × P3.

---

## 2. Critical Findings (P0/P1 only)

### P0 — Critical

| ID | Finding | Evidence (verified) | Root cause | User impact | Fix |
|----|---------|---------------------|-----------|-------------|-----|
| **P0-1** | Privacy "delete my data" resets only 4 of ~35 tables. `finance_accounts`, `finance_categories`, `finance_drafts`, `finance_corrections`, all `planning_*`, `tracking_*`, `assistant_responses`, `assistant_action_previews`, `voice_category_preferences`, `subscription_state`, `support_tickets` survive | `src/storage/local-data-reset.ts:10-15` | Hand-maintained table list drifted from schema growth | **Privacy violation**: user believes data is erased; sensitive financial data persists | Derive table list from schema; also clear in-memory repositories, react-query cache, and relevant SecureStore/AsyncStorage keys. Test against real SQLite |
| **P0-2** | Migrations cannot migrate: one `IF NOT EXISTS` mega-block, then stamps v7 unconditionally; no v1→v7 steps, no ALTERs | `src/storage/database.ts:12, 49-526` (version stamp at 513-524) | Migration framework never built, only version theater | First schema-divergent release corrupts/drops data on upgrade | Baseline v7 = current block for fresh installs; add incremental migration runner (v8+) + upgrade integration test |
| **P0-3** | Salary/planning screens compute from fixture transactions, not the user's ledger: `readTransactions = () => [fixtureSalaryTransaction, ...fixtureTransactions]` feeds `getPlanningOverview`, `getSalaryOverview`, `salaryOutcome` | `src/services/mocks/financial-planning-service.ts:69-72, 100, 700` | Mock service built against fixtures; never rewired to repository | Salary cycle income/expense/remaining/suggested-daily are demo numbers regardless of what the user recorded | Read real transactions (via core-finance repository/service); inject a clock; replace fixtures everywhere in this service |
| **P0-4** | Budget detail always reports 0% spent — `progress: calculateBudgetProgress({ budget, transactions: [], today })`. Worse, `getBudget` hardcodes `today: '2026-01-15'` while `getBudgetById` uses real today — two screens disagree about the same budget | `src/services/mocks/financial-planning-service.ts:717, 254 vs 258` | Helper never wired to data; frozen dev date | Budget screens show full remaining / 0% spent always | Pass real ledger transactions and injected `today` into `budgetDetail` |
| **P0-5** | Fixture ledger seeded into the **user's real DB**: singleton `coreFinanceService = createSeededCoreFinanceService()` seeds repo with `fixtureAccounts/Categories/Transactions` and enables persistence on native; `hydrate()` on empty DB → `persistAll()` (which `DELETE`s all finance tables and rewrites in-memory state) | `core-finance-service.ts:335-346`; `core-finance-repository.ts:103-108` + hydrate guard | Demo seeding kept in production singleton | Real user's ledger starts polluted with ~500 demo rows that look identical to real data → **remove** (owner decision) | Unseeded singleton; fixtures live only in `src/test-utils`; production must not import `@/test-utils` (also fixes bundle size + boundary-script bypass) |

### P1 — High

**Money math & data correctness**

- **P1-1 Cross-currency mixing unvalidated.** `assertSelectable` (`core-finance-repository.ts:651-662`) checks status, never `transaction.currency === account.currency`; `deriveAccountBalance` adds minor units regardless of currency. A SAR→USD transfer moves SAR minor units into a USD balance. Voice path stamps `'SAR'` always (`services/mocks/voice-fixtures.ts`). → Block cross-currency transfers until conversion exists; validate currency on save.
- **P1-2 Home hardcodes `'SAR'`** (`HomeScreen.tsx:72`) while the transactions list uses `baseCurrencyCode` (`TransactionListScreen.tsx:646-651`). Accounts without a fixture rate are **silently excluded** from the total (`core-finance-service.ts:105-109` — `excludedAccountIds` exists but the UI doesn't surface it). Compounded by `AccountForm.tsx:86` defaulting currency to `locale === 'ar' ? 'EGP' : 'USD'` — an Arabic user's first account (EGP) has no SAR rate, so it's excluded from Home. → Use `baseCurrencyCode`; surface `excludedAccountIds`/`isEstimated` in UI; sane default currency.
- **P1-3 Refunds treated three different ways**: Home counts gross expense (ignores refunds, `core-finance-service.ts:131-140`); salary cycle counts refunds as income (`financial-planning.ts:389-391`); budget + reports subtract refunds from expense (`financial-planning.ts:453-455`, `reports.ts:546-547`). Same event, three screens, three numbers. → One domain classifier with one documented refund policy.
- **P1-4 Soft-deleted transactions never leave lists.** `deleteTransaction` sets `status:'deleted'` (`core-finance-repository.ts:560-575`); `matchesFilters` has no default status exclusion (`core-finance.ts:374-425`, `emptyTransactionFilters.statuses = []`) → deleted rows render forever in transactions/home-recent while totals exclude them. No test covers it.
- **P1-5 Archived accounts' transactions stay in period totals**: balances use active accounts, but period transactions come from `allTransactions()` unfiltered (`core-finance-service.ts:94-99 vs 121`).
- **P1-6 Timezone convention mixed**: month boundaries UTC (`date-period.ts:12-21`) vs local day grouping (`transaction-sections.ts:69-76`, planning `localDateFromTimestamp`); `reports.ts:915-917` `toLocalDate` is actually UTC (`toISOString().slice(0,10)`). For UTC+3 users, a 00:30 transaction on the 1st lands in the wrong month. Stored `timeZone` preference is read by nothing.
- **P1-7 Cycle range anchors to the current calendar month** (`cycle-start.ts:54-76`, verified): today Aug 21 + start day 25 → shows "Aug 25 – Sep 24" as the *current* cycle. Must back-anchor to the cycle containing today.
- **P1-8 `previousCycleComparison` compares income to `profile.expectedAmountMinor`**, not the previous cycle (`financial-planning.ts:419-422`) — mislabeled metric, wrong number.
- **P1-9 Hardcoded `'2026-01-15'` as today** in 6 planning call sites (`financial-planning-service.ts:254, 340, 370, 496, 522, 566`) → overdue obligations unflagged, goal monthly-required wrong. Inject a clock.
- **P1-10 Early settlement books the full contracted total** (`financial-planning-service.ts:507-538`: `amountMinor: obligation.contractedTotalMinor ?? 1`) ignoring `openingPaidMinor`/prior payments → inflated "paid"; `?? 1` books a phantom 0.01 payment.
- **P1-11 `monthStartDay` setting is dead**: stored + persisted + its own picker screen (`preferences.ts:86-89`, `secure-preferences.ts`), but no aggregation (`monthPeriod`, Home, reports, salary) reads it. Users configure a cycle that changes nothing.

**Flows, navigation, i18n**

- **P1-12 Android hardware/gesture back bypasses draft & edit-dirty guards** (guards fire only on the X button, `useTransactionDraftGuard.ts:14-31`, `TransactionForm.tsx:156-173`; zero `BackHandler` in repo) and leaks the closure-session Maps. Edit-form dirty state is silently dropped.
- **P1-13 Profile exists twice, never persisted** — a derived view over preferences (`settings-storage.ts:16-47`, name/phone/email always hardcoded defaults) plus a separate closure object in `subscription-settings-service.ts:284, 303-313`; profile edits vanish on restart.
- **P1-14 Assistant classifier matches English keywords only** (`assistant-service.ts:331+`: `'obligation'`, `'investment'`, `'subscription'`…), so Arabic — the default locale (`i18n.ts:22`) — always falls through to a canned generic answer.
- **P1-15 More tab doesn't mirror in Arabic**: `MenuLink.tsx:68` hardcodes `flexDirection:'row'` (verified; also dead ternary at `:99` — both branches `'flex-start'`), `more.tsx:98,117` profile rows hardcode `'row'`. **`MenuLink.test.tsx:19` asserts the buggy behavior under the name "mirrors the row order in Arabic"** — a test that must change with the fix.
- **P1-16 Assistant screens have zero RTL handling** (no direction usage at all in `AssistantHomeScreen`/`AssistantConversationScreen:94-129`) — an Arabic-first app renders its assistant LTR.
- **P1-17 Dead "Due Day" field discards user input**: `AccountForm.tsx:68` state is rendered (≈:353-359) for credit cards but never in the save payload (130-140) and never hydrated from `account` (91-104) — verified.
- **P1-18 Two currency registries**: `CurrencyPickerSheet.tsx:18-49` redefines the 11-code list + `getCurrencyDetails` duplicating `domain/currencies.ts:19-150`; Add-Account uses the copy, Settings uses the domain one. Lists will drift.
- **P1-19 3-decimal currencies (KWD/BHD/OMR/JOD) broken**: `parseAmountToMinor(text, scale=2)` (`core-finance.ts:317-325`) rejects `2.500`; `money()` hardcodes `scale:2` (`financial-planning.ts:302`, `reports.ts:263`); ~40 sites hardcode `/100`. `MoneyValue.scale` exists but nothing reads it.

---

## 3. Architecture Findings

Boundaries are mostly right — `domain/` is pure, design-system contains no finance math (verified by grep), boundary scripts police import directions and raw colors. The real issues:

- **Over-abstraction (P2):** the capability-contract apparatus (`capability-contract.ts:20-44`) wraps 20+ providers, all `kind:'mock'`; `assertCompatibleProvider` is called only from tests. Production persistence (`AppShellStorage`) is mislabeled `'mock'`. Recommendation: keep the *contract interfaces* as the future-backend seam, delete the ceremony that pretends swapping already happens.
- **Production imports test fixtures** (P0-5's enabler): 5 services import `@/test-utils/core-finance-fixtures` (`core-finance-service.ts:26-30`, `exchange-rate-service.ts:7`, `financial-planning-service.ts:52`, `reports-service.ts:27`, `assistant-service.ts:20`) — demo data compiled into the shipping bundle.
- **Screen-local logic that belongs in domain/services:** HomeSummary (583 lines) runs the entire voice-capture state machine with 3 navigation refs inside a summary card (`HomeSummary.tsx:44-90`); TransactionForm (855 lines) owns amount parsing, currency fallback `'SAR'` (line 226), and scope invalidation (245); TransactionListScreen is 1,327 lines with 13 internal components (lines 636-1118); `more.tsx:54-58` derives identity from `session.userId.split('@')[0]`.
- **Navigation (P2s):**
  - Three parallel cross-screen param mechanisms for the same "pick a value" job: query-param + persisted draft (`TransactionForm.tsx:337-341` → `account-picker.tsx:52-54`), `category-selection-session.ts:14-25` closure Map, and a *second* closure Map inside the design system (`selection/selection-session.ts:17-35`) which makes the presentation layer import `expo-router`. Both Maps leak entries on hardware back.
  - Route allowlists maintained in 3 places (`navigation-context.ts:1-27`, `ProtectedRouteGate.tsx:123-137`, `deep-link-controller.ts:4-13`); `app/index.tsx:36-37` and `(public)/_layout.tsx:35-36` regex-strip route groups with `as any`.
  - Dead/demo routes ship in the production navigator: `more-demo.tsx` (1,002 lines), `preview.tsx` (316, re-renders the More tab), `profile-demo.tsx`, `design-system/index.tsx`, `foundation/*` (6) — zero in-app links, deep-link reachable. Duplicate route `/settings/application` vs `/profile/application` (`settings/application.tsx:4-6`, `profile/application.tsx:5-7`). Budgets/savings routes alive but menu items commented out (`more.tsx:251-272`).
  - "Modals" are plain stack pushes — no `presentation:'modal'` anywhere (`app/_layout.tsx:55-59`); on Android they're full pages.
  - Tabs `reports|more|voice` hide the tab bar and behave like pushed screens with manual `returnTo` params (`(tabs)/_layout.tsx:12-22`).
- **Error handling (P2):** platform services standardize on catch-all swallowing (`phone-notification-service.ts` — every method `catch { return 'unavailable' }`, zero logging); assistant collapses all failures to `representative_failure` (`assistant-service.ts:233-236`); TransactionForm shows one generic error string (`:215-218`) while AccountForm does field-level errors (`:109-127`) — pick one model. No retries by design (`retry: false`); no offline queue (nothing to sync yet).

---

## 4. Business Logic Findings

Beyond the P0/P1s:

- **Four copies of income/expense classification with different membership** (root of P1-3): `core-finance-service.ts:125-140` (no refund effect), `financial-planning.ts:389-396` (refund as income), `:448-457` (refund/reversal as negative expense), `reports.ts:541-549` (negative expense + the only one counting transfer fees).
- **No refund creation UI exists** (`manualTypes = ['expense','income','transfer']`, `app/(tabs)/add.tsx:7`, `TransactionForm.tsx:58`) and no refund ≤ original / same-account / same-currency validation — a 1,000,000 refund against a 10 purchase is accepted. After fixture removal (P0-5), refunds nearly vanish from real data — the inconsistent math becomes latent, which is exactly when to unify it safely.
- **Category totals vs period totals inconsistent for refunds:** `buildCategoryBreakdown` (`reports.ts:635-655`) groups refunds under their *own* category with negative value (skipped by `value <= 0`), so the original category keeps full gross while the period total is net.
- **`salaryState:'overdue'` unreachable** (`deriveSalaryState` ignores its `_today` param, `financial-planning.ts:668-676`); cycle-scoped obligation reservation uses a never-rolled-forward `profile.nextExpectedDate` that drifts from the real cycle end (`financial-planning-service.ts:171-185 vs 206-210`).
- **Assistant goal creation bypasses validation** (`assistant-service.ts:223-228`, `amountMinor: value?.minor ?? 0`) → 0-target goals → `NaN%` on the goals screen (`financial-planning.ts:625`, division `0/0`).
- **Account currency change blocked only by `'posted'` transactions** (`core-finance-repository.ts:228-235`) — refund/reversal-status rows silently re-denominate.
- **Ad-hoc float money parsers** bypassing `parseAmountToMinor`: `VoiceReview.tsx:184-191` (`'1.005'` → 100), `AssistantActionPreviewScreen.tsx:118-120` (accepts `'1e3'`), `TransactionFilters.tsx:231-239`. Hidden-balance not respected in `AssistantActionPreviewScreen.tsx:44-50` (raw `minor/100`).
- **Conversion rounding drift:** per-account `Math.round(minor * rate)` then sum (`core-finance-service.ts:110`, `reports.ts:563-565`) — up to ±accounts×0.5 minor per total. Rate fixture semantics inverted vs label (`base/quote` vs actual meaning, `core-finance-fixtures.ts:169-175`) — currently consistent only because all consumers multiply the same wrong way.
- **Hidden balances are otherwise well done**: global pref + session reveal + auto-rehide on background (`SensitiveVisibilityProvider.tsx:18-50`), respected on home/transactions/accounts/reports/planning screens.
- **Voice flow is the most rigorous path in the app** (validation → atomic batch → rollback → idempotency, Arabic spoken-date parsing with noon tz anchoring, `voice-capture.ts:189-249`) — use as the reference pattern for other mutation flows.
- **Edit/delete integrity is sound by construction** (derived aggregates; update path spreads only schema fields, bumps `version`; scope-based invalidation covers home/accounts/transactions + derived `reports.live`/`assistant.context`; category merge re-points transactions; delete/undo restores prior status from `finance_corrections`).

---

## 5. State Management Findings

- **Dual sources of truth:** in-memory repository arrays mirrored to SQLite per mutation (`core-finance-repository.ts:42-108` — `persistAll` delete-all-and-rewrites; same pattern in `financial-planning-repository.ts`, 861 lines, `persistAll` at 127-171). Reconciled only at `hydrate()`. Assistant keeps conversations in closure Maps *despite* existing SQLite tables (`database.ts:425-455`) — chat history dies on restart while assistant notifications persist: inconsistent durability within one feature.
- **`pendingDestination` is persisted route state** (`app-shell.ts:157-160`, AsyncStorage key `masarifi.appShell.pendingDestination`, written on every gate focus `ProtectedRouteGate.tsx:33-41`) — a stale value silently redirects post-login to home.
- **Query cache is immortal:** module-scope `QueryClient` with `staleTime: Infinity, retry: false` (`FoundationProviders.tsx:30-38`). Correctness rests entirely on every mutation listing complete `affectedScopes` (`core-finance-service.ts:33-54`). One missed scope = permanently stale UI. Deliberate offline-first choice — keep, but add a safety net (Phase 2).
- **Theme is fake:** preferences force `theme:'light'` on hydrate (`preferences.ts:57,72`) and `FoundationProviders.tsx:66` hardcodes `resolveTheme('light')`, while 100+ lines of dark tokens (`tokens.ts:401-503`) and the `'light'|'dark'|'system'` schema remain — dead config actively rewritten into SecureStore.
- **The transaction-draft state machine works but is 4 mechanisms** (local state + SQLite draft + `skipNextDraftReload` ref + focus effect, `TransactionForm.tsx:97-209`); its `meaningful` predicate (99-101) ignores `occurredAt`, so a date-only edit is never drafted.
- **Good:** atomic zustand selectors throughout (no whole-store subscriptions); stores appropriately scoped; draft persistence (`finance_drafts`, `planning_drafts`) prevents add-form data loss on kill; every SecureStore read zod-validated (`app-shell-storage.ts:108-116`).

---

## 6. UI/UX & Design System Findings

- **221 raw hex values under `src/features`** despite `tokens.ts:5-9` explicitly forbidding them. Worst offenders:
  - `ApplicationSettingsScreen.tsx` — 35 hex incl. off-palette **purple** `#68469C`/`#F3EEF9` (232, 237), teal duplicates `#103F37`, ink duplicates `#10231F`
  - `ObligationForm.tsx` — 52 hex, 14 raw fontSize (1,239-line form)
  - `CategoryRow.tsx:16-24` — badge pastels **cycled by row index** (a category's color changes when sorting changes); Tailwind colors `#EF4444` (244), `#94A3B8` (218), `#FEE2E2` (235)
  - `GroupFormModal.tsx:27-34` — an entire Material Design palette (`#E91E63`, `#5C6BC0`, `#FFA726`…)
  - `more.tsx:161-370` — 34 hex icon pairs duplicating `lightCategoryIconPalette` (`tokens.ts:138-164`) as literal props
  - `HomeSummary.tsx` — 0 hex but **16 raw fontSize** (44 at :538); `TransactionForm.tsx:812` fontSize 46; `CycleStartDaySelectionScreen.tsx:241` fractional `10.5`
- **Duplicated implementations:** bottom sheet ×4 (`AppSheet` vs `CurrencyPickerSheet.tsx:80-102`, `CategoryIconPickerSheet.tsx:112-134`, `MoveToGroupSheet.tsx:110-135` — radii 24/28 vs token `radius.bottomSheet=28`, rgba scrims instead of `horizon.scrim`); switch ×3 (live `Toggle`/`SwitchRow`, RN `Switch` in `AccountSettingCard.tsx:85-94`, dead styles in `ApplicationSettingsScreen.tsx:630-659`); search field ×5 (`TransactionListScreen:384-440`, `AccountListScreen:103-116`, `CategoryListScreen:221-253`, `CategorySelectionScreen:114-146`, shared `SelectionScreen:133-180`); grouped-row radius pattern ×3 (`TransactionRow.tsx:216-249`, `AccountRow.tsx:186-206`, `CategoryRow.tsx:285-307`); selected-check widget ×2 (DesignIcon `CurrencySelectionScreen.tsx:171-181` vs text `'✓'` `CurrencyPickerSheet.tsx:246-256`); icon-badge ×4 (36-38px badges in MenuLink, SwitchRow, AccountSettingCard, ApplicationSettingsScreen).
- **Four icon rendering paths in the Categories feature alone**: DesignIcon (expo-symbols), emoji tiles (`CategoryIconPickerSheet.tsx:38-92`, fallback `'📁'`), OpenMoji `<Image>` (`CategoryRow.tsx:129-135`), text-glyph chevrons `'‹'/'›'` (`CategoryRow.tsx:256-258`).
- **Chip selection matched by translated label → index** (`ApplicationSettingsScreen.tsx:108-110`, `VoiceReview.tsx:170-177`, `VoiceCaptureScreen.tsx:93-99`) — breaks when two options share a label or translations collide.
- **A11y:** 22 hardcoded English labels on icon-only controls (`SelectionScreen.tsx:137,160,170`, `ApplicationSettingsScreen.tsx` ×9, `AccountForm.tsx:236`, …); money formatter announces `'Value hidden'`/`'Not available'` in English on Arabic devices (`format-financial-value.ts:68,76`); touch targets below 44px at `AccountForm.tsx:461-467` (36×36), `CurrencyPickerSheet.tsx:301-307` (32×32), `SelectionScreen.tsx:226-233` (28×28); contrast stragglers (`#94A3B8` ≈ 2.9:1, `fontSize 10.5-12` grays ≈ 4.5:1 edge).
- Theme-fallback escape hatch `theme.colors.x ?? '#E8EFEC'` at ~15 sites (`CategoryListScreen.tsx:226`, `CategoryRow.tsx:111`, `CurrencyPickerSheet.tsx:99,148,207`, `CategoryIconPickerSheet.tsx:131,178-182`, `AccountSettingCard.tsx:37,90`) although the theme type guarantees the field.
- **Empty/loading/error states are a strength:** consistent `StateView` + retry across screens; skeletons only on Transactions summary (P3 to extend). Voice capture per-state blocks are exemplary.

---

## 7. RTL/LTR Findings

- No `I18nManager`; direction is manual: **101 hand-written `direction === 'rtl' ? 'row-reverse' : 'row'` ternaries** + ~12 local re-declarations of `physicalLtr` + ~60 physical `textAlign: 'left'/'right'` values. Mirroring is opt-in per line, and dozens of lines opted out — this is the root cause of P1-15/P1-16.
- **P1-15 / P1-16 above** (More tab rows, Assistant screens), plus:
  - `CheckboxRow` fixed `flexDirection:'row'` (`SelectionControls.tsx:338-344`) — checkbox never mirrors (used in voice review)
  - Home hero orbits absolutely anchored `right:-110/-36` (`HomeSummary.tsx:534-535`) — lopsided in RTL
  - RTL rail scroll-to-end hack (`TransactionListScreen.tsx:119-125,470-474`) — symptom of no native RTL
  - `CategoryRow` manually flips text `'‹'/'›'` instead of directional `DesignIcon`
- **The good parts are genuinely good and tested:** Latin digits forced via `ar-u-nu-latn` (`format-financial-value.ts:13-16,45-50`, `transaction-presentation.ts:8-9`), currency code as suffix (never locale symbol), FSI isolates `\u2066…\u2069` around amounts, `writingDirection:'ltr'` on amount styles, directional icon flipping in `DesignIcon` (`icons.tsx:17-22`), `ShellDirection.test.tsx` covers tab mirroring. Two deviations: `NotificationCenterScreen.tsx:90` raw `toLocaleString('en-US')`, hand-built `m:ss` in `HomeSummary.tsx:414-417`.
- **Localization bypasses:** hardcoded ar/en ternaries (`CategoryListScreen.tsx:217,292,300,328`), inline Arabic/English placeholders in `AccountForm.tsx:306-314,358`, raw template-key rendering `assistant.label.${block.label}` (`AssistantHomeScreen.tsx:137`), section titles as `titleAr`/`titleEn` fields (`CategoryIconPickerSheet.tsx:34-93`), per-site hand-rolled Arabic plural rules (`CategoryRow.tsx:30-48` — correct rules, but per-site) while i18next plurals sit unused.

---

## 8. Performance Findings

- **Zero `React.memo` in the entire app** (grep-verified); TransactionListScreen's inline `renderItem` (`:608-631`) runs `projectTransaction` per row per render — every keystroke in the search field re-renders all visible rows on the 1,000+-row ledger screen (fixtures make this concrete today).
- `CategoryListScreen.tsx:57-69` fetches **the entire transaction list** to compute per-category counts — should be an aggregate query.
- `AssistantHomeScreen.tsx:17,61` does `require()` **inside the component body** (breaks Fast Refresh, eslint-disabled).
- Unmemoized `categoryScopes`/`quickScopes`/`quickSelection` filter+flatMap+find on every render (`TransactionListScreen.tsx:158-193`).
- **No leaks found**: timers/subscriptions cleaned (`useVoiceCapture.ts:50,296`), debounce cleanups present, zustand selectors atomic, theme context memoized. `getItemLayout` only in `DateRangeSheet.tsx:232` (fine — fixed heights).
- Per the audit instruction, no micro-optimizations without evidence — Phase 4 starts with measurement (React DevTools profiler / why-did-you-render on a 1k-row dataset).

---

## 9. Testing Gaps

Strong coverage: domain math (29 files — money parsing, ledger effects, salary cycle incl. day-31 clamping, budgets, obligations, savings, reports ×9), service behavior (33 — transfers/refunds, conflicts, voice batch), design system (30), screens (transactions 20 cases, home 23, form 17), voice suite (10 files incl. a11y/recovery/privacy), shell RTL (18 files). The suite is mostly behavior-driven; fixtures are real objects; persistence tested through repositories.

**Gaps that map 1:1 to findings — every fix lands with its regression test:**

1. **`MenuLink.test.tsx:19` asserts the RTL bug** (`flexDirection:'row'` under a test named "mirrors the row order in Arabic") — an inverse regression test; fix together with P1-15.
2. No test that planning/salary reads the real ledger (P0-3) or that budget progress > 0 (P0-4).
3. No test that `resetLocalUserData` empties the DB (P0-1) — must run against **real SQLite** (test-guard Rule 9), table list derived from schema, not hardcoded.
4. Money math: deleted-transaction visibility (P1-4); cross-currency rejection (P1-1); base-currency home totals + excluded-account surfacing (P1-2); refund math consistency across home/budget/reports (P1-3); archived-account totals (P1-5); timezone month boundaries (P1-6); cycle back-anchoring — `cycle-start.test.ts` only tests start days already past (P1-7); settlement math (P1-10); `monthStartDay` effect (P1-11); `previousCycleComparison` semantics (P1-8).
5. Screen-level zeros: `more.tsx` (490 lines untested), ApplicationSettings dropdown + chip mapping, `CurrencyPickerSheet` (the duplicate), salary cycle-progress widget (`SalaryOverviewScreen.tsx:242-244`), assistant pagination/`require` pattern, back-button guards (P1-12).
6. Parser/formatting: ad-hoc parsers (KWD rejection, `'1e3'` acceptance, `1.005` truncation) and 3-decimal display (P1-19).

---

## 10. Technical Debt

- **Dead code:** ~60 lines unused switch styles (`ApplicationSettingsScreen.tsx:607-659`), unused `Divider({isRtl})` prop (`more.tsx:401-413`), unused `flagBadge/flagText` styles (`CurrencySelectionScreen.tsx:231-241`), unused `colorTokens` import (`AccountForm.tsx:19`), unused `react-hook-form` dependency (forms are hand-rolled), unreachable statuses `'refunded'/'reversed'` never assigned in production code, commented-out menu/profile blocks (`more.tsx:199-215, 251-272`).
- **God files:** `TransactionListScreen` 1,327 · `ObligationForm` 1,239 · `more-demo.tsx` 1,002 · `TransactionForm` 855 · `ApplicationSettingsScreen` 700 · `HomeSummary` 583 · `ProfileScreen` 568 · `useVoiceCapture` 510 · `AccountForm` 508 · `SalaryOverviewScreen` 504 · `more.tsx` 490.
- **Duplication:** `money()` ×2 (`financial-planning.ts:297-303`, `reports.ts:261-264`), `daysBetween` ×2, income/expense classifier ×4, `minor/100` ×~40 sites, ad-hoc amount parsers ×3.
- **Misc:** row-by-row DELETE loop in reset; hydration trusts `JSON.parse` without re-validation; `firstDayOfWeek` param ignored in `transactionPeriodKey`; `jest-native` dependency (unmaintained) alongside RNTL 13.

---

## 11. Recommended Fix Order

Constraints honored throughout: no commits/pushes, no repo reset, no API changes, business logic rewritten only for correctness (never style), fixtures never replace real data, unrelated worktree work preserved.

### Phase 1 — Critical correctness (P0-1…5, P1-1…11)

- **Goal:** the only data in the app is the user's; every money number is consistent; privacy reset actually resets; DB upgrades safely.
- **Modules:** `services/mocks/{core-finance,financial-planning,exchange-rate,reports,assistant}-service.ts`, `storage/{core-finance-repository,local-data-reset,database}.ts`, `domain/{core-finance,financial-planning,cycle-start}.ts`, `features/home/HomeScreen.tsx`, `features/filters/date-period.ts`.
- **Workstreams:**
  1. **Fixture removal:** unseeded `coreFinanceService` singleton; delete all `@/test-utils` imports from production (5 services); `readTransactions` → real ledger; `budgetDetail` gets real transactions + injected `today` (kills `'2026-01-15'` at 6 call sites); back-anchor `calculateCycleDateRange` to the cycle containing today.
  2. **Privacy reset:** schema-derived table list (all user tables), clear in-memory repositories + query cache + relevant SecureStore/AsyncStorage keys; real-SQLite integration test.
  3. **Migrations:** baseline v7 = current block for fresh installs; incremental migration runner for v8+; upgrade integration test.
  4. **Money-math unification** in `domain/`: single income/expense/refund classifier (one documented policy); default status exclusion so soft-deleted rows leave lists; block cross-currency transfers; archived accounts excluded from period totals; `baseCurrencyCode` on Home + surface `excludedAccountIds`/`isEstimated`; settlement math (no full-total booking, no `?? 1`); `previousCycleComparison` vs real previous cycle; decide `monthStartDay`: wire into `monthPeriod` or remove the setting.
- **Dependencies:** none — everything else builds on this.
- **Risk:** medium-high (behavior changes across screens); mitigated by the existing 1,022-case suite; tests asserting fixture behavior are updated to real-ledger expectations — the behavior change is the point.
- **Tests:** real-SQLite reset test; migration upgrade test; ledger-backed planning/budget tests; one regression test per P1 fix (list in §9.4).
- **Success criteria:** fresh install → zero demo rows in `masarifi.db` + real empty states; all screens agree on refund math; delete-data leaves 0 rows across all user tables; salary/budget numbers move when the user records transactions.

### Phase 2 — Architecture & state (P1-12/13 + duplication)

- **Goal:** one source of truth per datum; one cross-screen param mechanism; back button never drops a dirty form.
- **Modules:** `features/categories/category-selection-session.ts`, `design-system/components/selection/selection-session.ts`, `features/shell/{navigation-context,ProtectedRouteGate}.tsx`, `deep-link-controller.ts`, `state/app-shell.ts`, `services/mocks/subscription-settings-service.ts`, `storage/settings-storage.ts`, assistant service storage, demo route files.
- **Work:** unify the two closure Maps into one typed selection-session outside the design system (design-system must not import `expo-router`); single route allowlist others derive from; `BackHandler` wiring for draft/dirty guards + session cleanup; one persisted profile model (kill the dual-shape profile); persist assistant conversations to their existing tables; remove demo routes from the production navigator (keep as dev-only preview harness if wanted); dedupe `/settings/application`; resolve budgets/savings menu (restore or delete); scope-coverage safety test for `affectedScopes`.
- **Dependencies:** after Phase 1. **Risk:** medium — touches many screens' navigation calls; write navigation tests first.
- **Tests:** param round-trip tests; back-guard tests; route-registry consistency test; profile persistence test.
- **Success criteria:** no `expo-router` import in `design-system/`; hardware back on a dirty edit form triggers the confirm guard; release navigator contains zero demo routes.

### Phase 3 — UI/UX consistency & RTL (P1-14…19 + §6/§7 P2s)

- **Goal:** mirrored Arabic everywhere; one of each shared component; tokens are the only color source; KWD works.
- **Modules:** `components/MenuLink.tsx`, `app/(tabs)/more.tsx`, assistant screens, `features/accounts/{CurrencyPickerSheet,AccountForm}.tsx`, `features/categories/*`, shared `SearchField`, one money formatter in `utils/`.
- **Work:** fix RTL mirroring (+ correct the MenuLink test); central direction-style helper replacing the 101 ternaries; single money formatter honoring `MoneyValue.scale` (kills ~40 `/100` sites + ad-hoc parsers; KWD/BHD/OMR/JOD work); single currency registry; dedupe sheets ×4, switches ×3, search ×5, check-widget, icon paths (DesignIcon only); replace 221 hex with tokens (worst files first: ApplicationSettingsScreen, CategoryRow, GroupFormModal, more.tsx); value-based chip matching; localized a11y labels; 44px targets; delete dead dark-mode config (YAGNI — re-add when dark mode is scheduled).
- **Dependencies:** after Phase 2 (picker unification removes duplicated UI first). **Risk:** low-medium, mostly visual; extend the existing boundary script to enforce hex-free `features/`.
- **Tests:** corrected MenuLink RTL test; formatter suite incl. 3-decimal currencies; SearchField/sheet component tests; token boundary CI pass.
- **Success criteria:** zero raw hex outside `tokens.ts` in shipped screens; Arabic assistant mirrors; `2.500 KWD` enters and displays correctly.

### Phase 4 — Performance (measured only)

- **Goal:** eliminate the ledger re-render storm with evidence.
- **Modules:** `features/transactions/TransactionListScreen.tsx` (split along its 13 internal components), `features/categories/CategoryListScreen.tsx`, `features/assistant/AssistantHomeScreen.tsx`.
- **Work:** memoized rows + stable renderItem; category counts as aggregate query; static import replacing runtime `require`; profile before/after (React DevTools / why-did-you-render) on a 1k-row dataset — keep only proven wins.
- **Dependencies:** after Phase 3. **Risk:** low. **Tests:** render-count tests for the search-keystroke path.
- **Success criteria:** typing in search doesn't re-render untouched rows; smooth scroll on 1k transactions on mid-tier Android.

### Phase 5 — Cleanup (P3s)

- **Goal:** shrink surface area, zero dead code.
- **Work:** delete dead styles/props/imports/unreachable statuses/unused deps (`react-hook-form`, `jest-native`); behavior-preserving splits of `ObligationForm` and `TransactionForm` (clean-code rule: refactor and bug-fix never bundled); move hardcoded locale ternaries into catalogs; centralize plural rules; skeletons beyond transactions; delete `more-demo/preview/profile-demo` files once routes are gone.
- **Dependencies:** anytime after Phase 1. **Risk:** low. **Tests:** existing suite green unchanged — that is the point.
- **Success criteria:** no unused exports (lint pass), no commented-out route blocks, forms under ~400 lines.

---

## Appendix — Verification notes

- Verified by direct read (not agent-reported): P0-1 (`local-data-reset.ts` full file), P0-2 (`database.ts:1-120, 495-526`), P0-3 (`financial-planning-service.ts:55-109`), P0-4 (`:690-719, 245-264`), P0-5 (`core-finance-service.ts:20-64, 325-357`; `core-finance-repository.ts:80-110`), P1-2 (`HomeScreen.tsx:60-89`; `core-finance-service.ts:90-164`), P1-7 (`cycle-start.ts` full file), P1-15 (`MenuLink.tsx:55-104`), P1-17 (`AccountForm.tsx:60-144`).
- All other findings carry file:line references from systematic exploration passes (2026-08-21) and should be spot-checked when scheduled into a phase.
- Review standards applied: clean-code-guard review checklist (naming/SOLID/DRY-KISS-YAGNI/AI failure modes) and test-guard nine rules (behavior-focused tests, mock only at boundaries, real persistence for persistence-under-test).
