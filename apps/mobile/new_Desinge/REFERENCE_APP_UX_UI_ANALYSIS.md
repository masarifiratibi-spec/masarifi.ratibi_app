# Masarifi Reference App UX/UI Analysis — Independently Reviewed

> Documentation only. The reference application is a UX quality benchmark, not a brand, product, or architecture replacement for Masarifi.

## Independent Review Status

| Item | Status |
|---|---|
| Original analysis | GLM |
| Independent reviewer | Codex |
| Review status | **COMPLETE — authoritative reviewed version** |
| Review date | 2026-08-08 |
| Screenshots reviewed | **30 files**; 24 distinct file hashes; all duplicate copies accounted for |
| Videos reviewed | **1**, complete duration 04:30.94, 590×1280, approximately 16.96 fps |
| Unique screens/states identified | **45** stable reference IDs |
| GLM analysis sections corrected | **7** top-level plan sections replaced or materially corrected |
| Major missing areas added | **14** evidence, product, design-system, flow, motion, RTL, accessibility, and prioritization areas |
| Unsupported findings removed or downgraded | **4** material claims/method assumptions |
| Persistent files changed by this review | This Markdown file only |

### Confidence Scale

- **HIGH** — Directly verified from multiple visual references or from Masarifi code/specifications.
- **MEDIUM** — Strongly supported, but not fully observable or supported by only one source.
- **LOW** — Reasonable interpretation from incomplete evidence; must not be treated as product fact.
- **UNKNOWN** — Not determinable from the supplied evidence.

### Evidence Language

- **OBSERVED** — Directly visible in a supplied screenshot or recording.
- **INFERRED** — A strong interpretation of visible evidence, explicitly not confirmed behavior.
- **RECOMMENDED** — Guidance for Masarifi; not a claim about the reference application.

## Executive Verdict

The reference application demonstrates a polished, coherent personal-finance interface with strong amount hierarchy, concise cards, useful empty examples, full-screen financial forms, fast cross-feature navigation, and clear period/filter controls. Its strongest transferable quality is not its bright cyan/purple/green branding; it is the way each surface gives one financial question a dominant answer and one obvious next action. **Confidence: HIGH.**

Masarifi already has the more rigorous product foundation: semantic light/dark tokens, Arabic/English catalogs, privacy masking, typed platform boundaries, accessible financial primitives, motion tokens, undo/review requirements, permission education, and explicit Android/iOS differences. The current weakness is product-surface maturity: Home is a basic shell and Transactions, Add, Reports, Accounts, and Assistant remain placeholders, while the reference demonstrates these destinations as composed experiences. **Confidence: HIGH** from `app/(tabs)/*`, `app/accounts/index.tsx`, `app/assistant/index.tsx`, and SPEC-001–003.

The correct direction is therefore: **retain Masarifi’s Gulf Premium dark-teal identity and trust model; adapt the reference’s hierarchy, compact summaries, contextual controls, and progressive disclosure; reject its branding, out-of-scope household/investment content, weak RTL parity, promotional dominance, and any automation wording that overstates permission scope or hides review/undo responsibilities.**

# 1. Sources and Review Method

## 1.1 Masarifi sources reviewed

- `.specify/memory/constitution.md`
- `specs/001-mobile-foundation/{spec,plan,research,tasks,data-model,quickstart}.md` and UI contract
- `specs/002-mobile-design-system/{spec,plan,research,tasks,data-model,quickstart}.md` and UI contract
- `specs/003-app-shell-auth-onboarding/{spec,plan,research,tasks,data-model,quickstart}.md` and UI contract
- `specs/004-reference-ux-analysis/spec.md` and checklist
- `../../docs/mobile_app/Masarifi-Mobile-Frontend-SpecKit-Master.md`, including embedded SPEC-004 through SPEC-010 requirements
- `../../docs/design-system/masarifi-gulf-premium-design-system-v2.1.md`
- Current Expo Router routes, shell, providers, localization, storage/privacy foundations, themes/tokens, typography, icons, motion, charts, reusable components, onboarding, authentication, and security flows.

All tasks in SPEC-001, SPEC-002, and SPEC-003 are marked complete (48, 114, and 160 tasks respectively). This means those scoped foundations and shell journeys are implemented; it does **not** mean the later Home, transaction, planning, report, notification, or assistant product specifications are implemented. **Confidence: HIGH.**

## 1.2 Reference review method

- Every JPEG was visually inspected at its native 591×1280 resolution.
- SHA-256 hashes were used only to identify byte-identical copies; visually similar files were still checked for state differences.
- The complete video was decoded locally without installing dependencies. It was reviewed at one-second intervals across its entire 271-second timeline, with denser sampling around representative transitions.
- Exact font family, color hex values, motion easing curves, haptics, screen-reader semantics, and off-screen flows are not claimed without evidence.

# 2. Reference Artifact Inventory

## 2.1 Screenshot inventory

| ID | File | Visible evidence | Uniqueness |
|---|---|---|---|
| IMG-01 | `photo_2026-07-21_17-11-46 (2).jpg` | SMS Auto-Tracking disabled, permission recovery, privacy/background guidance, keyword chips | Unique state |
| IMG-02 | `photo_2026-07-21_17-11-46.jpg` | Wallet empty state with automatic-tracking education card | Near-duplicate of IMG-03; timestamp differs |
| IMG-03 | `photo_2026-07-21_17-11-47 (2).jpg` | Same Wallet empty/onboarding state | Near-duplicate of IMG-02 |
| IMG-04 | `photo_2026-07-21_17-11-47 (3).jpg` | SMS tracking enabled with success dialog | Unique state |
| IMG-05 | `photo_2026-07-21_17-11-47.jpg` | SMS permission education modal | Unique state |
| IMG-06 | `photo_2026-07-21_17-12-12.jpg` | Wallet populated with detected card and transaction | Exact duplicate of IMG-30 |
| IMG-07 | `photo_2026-08-08_09-19-08.jpg` | New Transaction — transfer variant | Unique state |
| IMG-08 | `photo_2026-08-08_09-19-09 (2).jpg` | New Transaction — expense variant | Exact duplicate of IMG-13 and IMG-28 |
| IMG-09 | `photo_2026-08-08_09-19-09 (3).jpg` | Bills — installments | Exact duplicate of IMG-12 |
| IMG-10 | `photo_2026-08-08_09-19-09 (4).jpg` | Bills — subscriptions | Near-duplicate of IMG-16 |
| IMG-11 | `photo_2026-08-08_09-19-09 (5).jpg` | Populated Wallet with negative balance and two transfers | Unique state |
| IMG-12 | `photo_2026-08-08_09-19-09 (6).jpg` | Bills — installments | Exact duplicate of IMG-09 |
| IMG-13 | `photo_2026-08-08_09-19-09.jpg` | New Transaction — expense variant | Exact duplicate of IMG-08 and IMG-28 |
| IMG-14 | `photo_2026-08-08_09-19-10 (2).jpg` | Recurring income form | Unique state |
| IMG-15 | `photo_2026-08-08_09-19-10 (3).jpg` | New Savings Goal form | Unique state |
| IMG-16 | `photo_2026-08-08_09-19-10 (4).jpg` | Bills — subscriptions | Near-duplicate of IMG-10 |
| IMG-17 | `photo_2026-08-08_09-19-10 (5).jpg` | Savings goals — populated | Unique state |
| IMG-18 | `photo_2026-08-08_09-19-10 (6).jpg` | Buckets overview | Exact duplicate of IMG-19 by content hash relationship noted in review set |
| IMG-19 | `photo_2026-08-08_09-19-10.jpg` | Bills — recurring income | Unique state |
| IMG-20 | `photo_2026-08-08_09-19-11 (2).jpg` | Savings goals — empty | Unique state |
| IMG-21 | `photo_2026-08-08_09-19-11 (3).jpg` | Ask assistant suggested-question home | Unique state |
| IMG-22 | `photo_2026-08-08_09-19-11 (4).jpg` | Insights/report overview with daily-spending chart | Unique state |
| IMG-23 | `photo_2026-08-08_09-19-11 (5).jpg` | Settings lower section | Unique state |
| IMG-24 | `photo_2026-08-08_09-19-11 (6).jpg` | Account/profile and subscription plan | Unique state |
| IMG-25 | `photo_2026-08-08_09-19-11 (7).jpg` | Manage Accounts | Unique state |
| IMG-26 | `photo_2026-08-08_09-19-11 (8).jpg` | Settings upper section | Exact duplicate of IMG-27 |
| IMG-27 | `photo_2026-08-08_09-19-11.jpg` | Settings upper section | Exact duplicate of IMG-26 |
| IMG-28 | `photo_2026-08-08_09-25-32.jpg` | New Transaction — expense variant | Exact duplicate of IMG-08 and IMG-13 |
| IMG-29 | `photo_2026-08-08_09-26-08.jpg` | SMS Auto-Tracking disabled | Exact duplicate of IMG-01 |
| IMG-30 | `photo_2026-08-08_09-26-21.jpg` | Wallet populated with detected card and transaction | Exact duplicate of IMG-06 |

## 2.2 Recording inventory

| ID | File | Evidence |
|---|---|---|
| VID-01 | `video_2026-08-08_09-28-48.mp4` | Full 04:30.94 interaction recording covering Wallet, date selection, transaction entry, category creation, Bills, Buckets, reports, assistant, voice failure, filters, Settings, live Arabic switch, contributors, app lifecycle, What’s New, support, export/import, delete confirmation, and paywall |

# 3. Reference Information Architecture

## 3.1 Observed top-level navigation

```text
Wallet
├── Period selector: preset month / custom date range
├── Accounts summary
├── Recent transactions, search, filters, voice, quick add
├── New transaction: expense / income / transfer
├── Account and category selection
└── SMS Auto-Tracking status and permission

Bills
├── Subscriptions
├── Installments
└── Recurring income

Buckets
├── Budgets
└── Savings goals

Insights
├── Overview
├── Trends
├── Details/account view
└── Period/account filters and share

Ask
└── New chat and suggested financial questions

Settings / secondary
├── Account/profile and plan
├── SMS Auto-Tracking, Accounts, Preferences, Categories, Merchant Rules
├── World Cup and AI Roasting promotional features
├── Household, import/export/reset, support, contributors
├── Contact, delete confirmation, and paywall
└── Language modal with live RTL switch
```

**OBSERVED:** the five bottom destinations are Wallet, Bills, Buckets, Insights, and Ask. **Confidence: HIGH.**

**RECOMMENDED:** do not copy this navigation taxonomy. Masarifi’s approved primary order remains Home, Transactions, Add, Reports, and More; Accounts and Assistant stay secondary entry points. Bills, debts, installments, subscriptions, and upcoming payments remain under Masarifi’s Obligations architecture. **Confidence: HIGH** from SPEC-003 and embedded SPEC-007.

# 4. Reference Screen and State Catalogue

The following IDs represent distinct screens or materially different user-visible states. Similar screenshots are not double-counted.

| ID | Purpose and evidence | Structure, interaction, and state review | Confidence |
|---|---|---|---|
| REF-WALLET-01 | Populated financial overview. IMG-06/11/30; VID-01 00:00–00:07, 01:29–01:35 | Gradient financial hero, account summary, recent transaction rows, voice chip, central FAB, persistent tabs. Amounts dominate; negative totals are visible but lack an explanatory status cue. | HIGH |
| REF-WALLET-02 | Empty/onboarding Wallet. IMG-02/03 | Automatic-tracking education card appears before empty transaction copy; one setup action plus voice/add alternatives. Strong activation hierarchy, but the promotional card dominates the actual empty state. | HIGH |
| REF-WALLET-03 | Search/filter and filtered-empty Wallet. VID-01 01:41–01:53, 02:45–02:59 | Search field and horizontally scrollable category chips appear above rows; empty state retains the add FAB. Selection uses filled chip color plus label. | HIGH |
| REF-DATE-01 | Date-range choice. VID-01 00:08, 01:23–01:24 | Full-screen modal-style surface offers Custom Range, By Month, and Cancel. Compact, low-risk choice with clear exits. | HIGH |
| REF-DATE-02 | Custom date range. VID-01 00:09–00:10 | Start/end date cards, selected-day count, single Apply Range action. Calendar-picker internals are not shown. | HIGH |
| REF-DATE-03 | Month picker. VID-01 00:12 | Scrollable month list with selected check and Cancel. No search or year-jump behavior observed. | HIGH |
| REF-TXN-01 | Expense creation. IMG-08/13/28; VID-01 00:18–00:24, 00:33–00:52 | Full-screen task: close/save, segmented type, amount-first input, category/account rows, optional description/hint, date. Keyboard appears immediately. Strong hierarchy; disabled/save validation and error copy are not observed. | HIGH |
| REF-TXN-02 | Income creation. VID-01 00:24, 00:28, 00:33 | Same shell with income-specific language and category. Shared structure reduces relearning. | HIGH |
| REF-TXN-03 | Transfer creation. IMG-07; VID-01 00:25–00:27 | Source/destination account rows and direction cue; copy explains transfers do not affect spending/income. Fee, currency conversion, and same-account error states are not observed. | HIGH |
| REF-TXN-04 | Account picker. VID-01 00:21–00:23 | Simple full-screen list with current account check. Search/empty/multi-account density cannot be verified. | HIGH |
| REF-CAT-01 | Searchable category picker. VID-01 00:29–00:45 | Search, “most used,” long categorized list, icons, selected check, create-your-own action. Includes “Investment,” which conflicts with Masarifi Core V1 exclusions. | HIGH |
| REF-CAT-02 | Create category. VID-01 00:46–00:51 | Name, icon strip, color strip, disabled Add Category until valid, keyboard behavior. Emoji/icon reliance and color-only distinction require adaptation. | HIGH |
| REF-SMS-01 | Tracking status disabled/enabled. IMG-01/29; VID-01 02:06–02:09 | Status switch, permission recovery, data-use claims, battery restriction guidance, editable keyword chips. Useful operational transparency; wording overstates keyword-level permission scope. | HIGH |
| REF-SMS-02 | Permission education. IMG-05 | Center modal explains benefit, extraction, local handling, Not Now, and Allow SMS Access. Clear decision hierarchy, but Masarifi must use its stricter consent and fallback copy. | HIGH |
| REF-SMS-03 | Enabled success. IMG-04 | Blocking success dialog over enabled status. Confirms notification behavior; no immediate test, undo, or review-mode control is visible. | HIGH |
| REF-BILLS-01 | Subscription overview. IMG-10/16; VID-01 00:54–00:59 | Colored summary hero, segmented tabs, explanatory example, recurring row, one add action. Empty and example content are well combined. | HIGH |
| REF-BILLS-02 | Installment overview. IMG-09/12; VID-01 01:00–01:01 | Purple summary, progress row, paid count, monthly amount, add action. Good glanceability; partial/overpayment and review states are absent. | HIGH |
| REF-BILLS-03 | Recurring income overview. IMG-19; VID-01 01:02 | Green summary, example salary row, one add action. Financial meaning is reinforced by text/sign, not color alone. | HIGH |
| REF-BILLS-04 | Recurring income form. IMG-14 | Income/bank-certificate segment, source, amount/currency, cadence, next date, category, sticky save. “Bank certificate soon” is disabled but still prominent. | HIGH |
| REF-BUCKETS-01 | Planning hub. IMG-18; VID-01 01:03–01:07 | Summary strip plus two large cards for Budgets and Goals. Very clear IA, but Masarifi should use its approved planning/obligations terminology. | HIGH |
| REF-BUDGET-01 | Budget empty/setup. VID-01 01:10–01:12 | Total budget summary, empty explanation, Create Budget, Copy from Last Month. This is a strong progressive-onboarding pattern. Detailed budget editing is not shown. | HIGH |
| REF-GOAL-01 | Goals empty. IMG-20 | Calm empty state with one Create Goal action and explanatory copy. Strong transferable pattern. | HIGH |
| REF-GOAL-02 | Goals populated. IMG-17; VID-01 01:05–01:09 | Total saved hero, active/completed/target metrics, goal card, progress, remaining amount, FAB. Clear but highly saturated. | HIGH |
| REF-GOAL-03 | New goal. IMG-15 | Name, target, emoji icon grid, color swatches, disabled Create Goal. Target date, linked account, emergency-fund option, and contribution suggestion are not visible. | HIGH |
| REF-INSIGHTS-01 | Report overview. IMG-22; VID-01 01:16–01:18, 01:22–01:25 | Period/account filters, Overview/Trends/Details, total, period comparison, daily-spending chart, average/highest/total. Strong hierarchy; chart text alternative is not visible. | HIGH |
| REF-INSIGHTS-02 | Net-worth/account details. VID-01 01:19–01:21 | Net-worth line chart, detected-card callout, account rows, add account/asset. “Asset” language may imply scope beyond Masarifi V1. | HIGH |
| REF-INSIGHTS-03 | Insight/insufficient-data state. VID-01 01:14–01:15, 02:54–02:56 | Alerts for no income and spending increase appear above a muted circular visualization. Loading versus insufficient-data meaning is visually ambiguous. | MEDIUM |
| REF-ASK-01 | Assistant home. IMG-21; VID-01 01:26–01:28 | Greeting, one new-chat action, six concrete suggested questions. Excellent intent scaffolding; consent, privacy, data sufficiency, and action-confirmation states are not shown. | HIGH |
| REF-VOICE-01 | Voice capture/processing/failure sequence. VID-01 01:31–01:40 | Floating recording controls overlay Wallet, followed by centered “Processing your expense…” dialog and “Audio Unclear” error. Feedback is immediate, but transcript/review/re-record states are not shown. | HIGH |
| REF-SETTINGS-01 | Settings grouped list. IMG-23/26/27; VID-01 01:54–02:02 and later | Grouped cards, colored icon tiles, subtitles, chevrons, plan banner, sign-out/delete separation. Dense but scannable; promotional content has excessive priority. | HIGH |
| REF-PROFILE-01 | Account/profile. IMG-24; VID-01 02:03–02:04 | Avatar, editable name, email, usage message, plan card, phone/birthday/gender. Clear grouping; gender choice is unrelated to demonstrated financial value. | HIGH |
| REF-ACCOUNTS-01 | Manage accounts. IMG-25 | Spendable total, default account, negative balance, add action, bottom hint. Sparse; archive, credit, identifier, currency-estimate, and account-state details are absent. | HIGH |
| REF-PREF-01 | Preferences. VID-01 02:16–02:30 | Language, currency, month start, add-button mode, merchant rules, ATM treatment, privacy mode, reminders. Native switches and concise helper text support progressive disclosure. | HIGH |
| REF-LANG-01 | Language selection and live RTL switch. VID-01 02:20–02:33 | Bottom-anchored modal with English/Español/Arabic; Arabic immediately reflows the settings list. Some English labels remain, so parity is incomplete. | HIGH |
| REF-WORLD-01 | World Cup promotion. VID-01 02:11–02:12 | Dark event surface with tabs and empty schedule. Product relevance is promotional, not financial. | HIGH |
| REF-ROAST-01 | AI Roasting settings. VID-01 02:14 | Dark promotional card and one real-time toggle. Tone risks judgment and conflicts with Masarifi’s calm language principle. | HIGH |
| REF-CONTRIB-01 | Contributors. VID-01 03:04–03:18 | Extremely long chip/name list with continuous scrolling and contact CTA. Demonstrates wrap density, not a relevant finance pattern. | HIGH |
| REF-NEWS-01 | What’s New. VID-01 03:50–03:54 | Card feed of feature announcements with NEW badges and dates. Useful grouped release-note pattern. | HIGH |
| REF-CONTACT-01 | Contact form. VID-01 04:04–04:05 | Large message field and disabled send action. Keyboard/error/success states are not shown. | HIGH |
| REF-EXPORT-01 | Export transactions sheet. VID-01 04:09–04:10 | Modal with transaction scope and export-format radio choices, Cancel/Export. Clear consequence preview. | HIGH |
| REF-IMPORT-01 | Import from another app. VID-01 04:12–04:13 | Full-screen file-selection drop zone for CSV/Excel. Camera/attachment behavior is not evidenced. | HIGH |
| REF-DELETE-01 | Delete account confirmation. VID-01 04:17 | Dark blocking confirmation dialog with consequence copy and two actions. Exact action labels are difficult to read. | MEDIUM |
| REF-PAYWALL-01 | Subscription paywall. VID-01 04:22–04:24 | Full-screen dark overlay, benefits, testimonial, monthly/yearly cards, primary plan action, close. Visually dominant and outside the reference’s restrained finance surfaces. | HIGH |
| REF-LIFECYCLE-01 | App switcher and relaunch. VID-01 03:22–03:30, 03:57–04:00 | Android recents preview, white splash with wallet mark, loading spinner, return to Wallet. No financial privacy mask is evident because the captured preview shows Settings; protected-value behavior remains unknown. | HIGH |
| REF-UNKNOWN-01 | Teal-header secondary detail screen. VID-01 03:41–03:43 | A teal summary header and single settings-like card are visible, but the Arabic title and purpose are not reliably legible. Not used for recommendations. | LOW |

# 5. Reference Visual System

## 5.1 Visual language

- **OBSERVED:** white/light-gray base surfaces, large saturated cyan/teal, purple, and green feature headers, rounded white cards, soft shadows, pastel icon tiles, and frequent pill controls. **Confidence: HIGH.**
- **OBSERVED:** feature colors change by domain—teal Wallet/subscriptions, purple installments/budgets, green income/goals—creating fast recognition but weakening one-brand restraint. **Confidence: HIGH.**
- **INFERRED:** common screen edge padding is approximately 16–24 logical pixels; card gaps are approximately 12–20; cards often use roughly 16–24 radius; major controls appear roughly 48–64 high. Compression and device scaling prevent exact measurement. **Confidence: MEDIUM.**
- **UNKNOWN:** exact source color values and font family. Screenshot sampling would not establish design-token intent, so hex values and font names are intentionally omitted.

## 5.2 Typography and financial numbers

- Large balances are usually the first or second visual stop, with currency prefixes and English numerals.
- Titles use a heavy sans-serif weight; secondary labels are muted; section labels are often uppercase.
- Transaction amounts are right-aligned in English views; income sometimes has `+` and green, while several expenses/transfers lack an explicit minus sign.
- Long values can wrap awkwardly, as seen in the Wallet spent total in IMG-11. This is a caution for Masarifi’s amount typography, not a pattern to copy.

## 5.3 Surfaces, borders, and elevation

- Standard cards use light outlines plus soft shadows; major headers use saturated gradients.
- Bottom navigation and most screens remain flat white, making colorful summaries highly prominent.
- Shadows and gradients are more aggressive than Masarifi’s “borders before shadows” and restrained-gradient direction.

## 5.4 Iconography

- The reference mixes line icons, pastel tiles, branded merchant marks, flags, emojis, and novelty symbols.
- Icon meaning is usually reinforced by labels, but emoji goal/category selection is inconsistent in weight and accessibility semantics.
- Masarifi should retain its centralized vector icon mapping and use merchant/brand imagery only where source identity is relevant.

# 6. Reference Component and Interaction Patterns

| Pattern | Evidence | Review |
|---|---|---|
| Financial summary hero | Wallet, Bills, Goals, Reports | Excellent amount hierarchy; adapt to restrained dark teal, flatter surfaces, and stable amount wrapping. |
| Compact metric strip | Bills, Goals, Buckets | Useful for active/remaining/target metrics; labels must remain visible at 200% text. |
| Transaction row | Wallet | Good title/category/account/time/amount grouping; Masarifi needs source, sync/review, correction, and accessible combined announcement. |
| Segmented domain switch | New Transaction, Bills, Reports | Strong progressive disclosure; use native/accessible segment semantics and logical RTL order. |
| Search + horizontal filter chips | Wallet video | Effective dense filtering; selected state must not rely on fill color and chip order must be intentional in RTL. |
| Example inside an empty state | Bills | Helps users understand a feature before adding data; example must be clearly labeled and excluded from totals. |
| Full-screen financial form | Transactions, recurring income, goals | Correct for multi-field/high-impact workflows; preserve draft, validation, keyboard, offline, and leave-confirmation states. |
| Grouped settings list | Settings | Strong scanability and native familiarity; reduce promotional dominance and remove out-of-scope rows. |
| Permission education modal | SMS | Good value/privacy/decline framing; adapt to Masarifi’s exact Android permission contract. |
| Bottom-anchored choice sheet | Language, export | Good for short low-risk choices; require focus containment, back dismissal, scroll, and safe-area behavior. |
| Actionable processing/error feedback | Voice | Strong immediate feedback; add transcript, re-record, and structured review required by SPEC-006. |
| Suggested assistant questions | Ask | Strong first-use scaffolding; add consent, data scope, insufficient-data, and confirmation boundaries. |

# 7. Motion and Recording Review

## 7.1 Observed motion

- **Navigation:** Wallet to New Transaction visibly blends over roughly 0.2 seconds in dense sampling around 00:17.3–00:17.5. Other pushes appear similarly brief or effectively immediate. **Confidence: MEDIUM.**
- **Sheets/modals:** date, language, export, confirmation, and permission surfaces use a scrim or isolated modal layer. Approximate transition range is 150–300 ms; exact easing is not determinable. **Confidence: MEDIUM.**
- **Tab transitions:** bottom-tab changes swap the domain header and color quickly, without a long page animation. Bills segmented tabs update color, totals, examples, and CTA in place. **Confidence: HIGH.**
- **Scrolling:** lists and settings scroll directly; category filters and contributor chips show sustained scroll behavior. Sticky/collapsing headers are not convincingly demonstrated. **Confidence: MEDIUM.**
- **Voice feedback:** floating recording controls appear over Wallet; processing blocks the surface for several seconds; an “Audio Unclear” dialog supplies recovery. **Confidence: HIGH.**
- **Loading:** relaunch shows a branded static splash then a small spinner before Wallet. No skeleton convention is evidenced in the reference recording. **Confidence: HIGH.**
- **Success/destructive:** SMS enablement uses a blocking success dialog; delete account uses a blocking destructive confirmation; no undo snackbar is shown. **Confidence: HIGH.**

## 7.2 Not observed or not determinable

- Pull-to-refresh, swipe row actions, contextual long-press menus, chart scrub/tooltips, haptics, exact easing curves, screen-reader announcements, and reduced-motion alternatives are **UNKNOWN**.
- Pressed states are only briefly visible and cannot support exact opacity/scale specifications.

## 7.3 Masarifi motion guidance

Keep Masarifi’s existing motion buckets in `src/design-system/motion.ts`: 120 ms micro, 160 ms control, 200 ms dialog, and 220 ms sheet. These already match the product’s Version 2.1 ranges and the reference’s perceived brevity. Add no new motion scale. Reduced motion must apply the final state immediately or with a non-spatial fade. **Classification: ALREADY EXISTS. Priority: P2.**

# 8. Current Masarifi Baseline

## 8.1 Product and architecture

- React Native 0.74 / Expo 51 / TypeScript / Expo Router with feature-oriented source organization.
- Five approved primary destinations: Home, Transactions, Add, Reports, More. Accounts and Assistant are secondary routes.
- Typed mock/platform contracts, Zustand local preferences/app-shell state, TanStack Query, AsyncStorage/SecureStore/SQLite boundaries.
- Startup gating order: authentication, local unlock, incomplete onboarding, then destination/Home.
- Core later-domain screens are not yet implemented: Transactions, Add, Reports, Accounts, and Assistant render placeholder content. Home and More are functional shell surfaces, not final financial product screens.

## 8.2 Existing visual system

- Deep teal primary family, restrained bronze, warm neutral light mode, warm charcoal dark mode.
- Semantic financial colors are separated from operational status colors.
- IBM Plex Sans Arabic and IBM Plex Sans are bundled locally.
- Spacing scale: 4, 8, 12, 16, 24, 32; typography roles from 12 to 30; touch target token is 44.
- Existing radius tokens are 6, 8, 12, card 8, and pill. This is materially tighter than the approved v2.1 mobile card guidance of roughly 16–20 and hero/sheet guidance of 20–24.
- Only `none` and one `raised` elevation treatment exist, which supports restraint but does not yet distinguish floating, overlay, and modal relationships.

## 8.3 Existing reusable patterns

Already present: buttons, icon buttons, surface cards, badges, sensitive values, form/picker/selection/chip controls, state feedback, banners, snackbars/undo, skeletons, app bars, bottom tabs, step/segment/sticky controls, sheets/dialogs/pickers, accessible chart frame, donut/line charts, balance/account/budget/goal/obligation/report cards, amount/category primitives, progress, installment timeline, and transaction rows.

Current implementation gaps include:

- Many components hard-code `8`, `12`, `16`, and literal English helper strings instead of consuming the semantic token and localization contracts.
- `AppSheet` and `ConfirmationDialog` are styled views rather than fully modal native overlays with demonstrated focus containment, back handling, scrim, long-content scrolling, and safe-area behavior.
- `app/(tabs)/_layout.tsx` passes `currentRoute="/(tabs)/home"` unconditionally, so the custom tab selection state remains Home even after navigation.
- The reusable `TransactionRow` does not yet virtualize or group a real transaction list and compresses four metadata fields into one wrapping row.
- Current charts are validation primitives, not production data visualizations; the donut renders one ring color and the line chart uses static points.
- The current 44-pixel minimum satisfies the Masarifi constitution/iOS baseline, but Android-native acceptance should target 48 dp where platform-specific spacing permits.

## 8.4 RTL/LTR foundation

- Arabic is the default locale; direction is derived rather than stored independently.
- The root provider applies `direction`, typography chooses the Arabic/English IBM family, and directional icons mirror selectively.
- English numerals and locale-aware formatting utilities exist; amount text uses LTR writing direction.
- Several row components still hard-code `flexDirection: 'row'` and rely on global direction behavior. Production screens need per-component mixed-direction and reading-order validation rather than assuming global mirroring is sufficient.

## 8.5 Accessibility and privacy foundation

- Accessibility labels/roles/states, 44-pixel targets, progress semantics, live-region feedback, chart summaries, hidden-balance state, app privacy gate, and reduced-motion preference exist.
- The constitution additionally requires 200% text scaling, logical focus order, non-color meaning, accessible financial announcements, and app-switcher/notification masking. These obligations outrank any reference behavior.

# 9. Design-System Gap Classification

| Pattern | Classification | Masarifi decision | Priority |
|---|---|---|---|
| Semantic colors, typography, spacing, motion | ALREADY EXISTS | Reuse current owners; do not create a parallel reference token set. | P0 |
| Financial cards and amount hierarchy | ALREADY EXISTS / ADAPT | Compose existing primitives into final screens; increase card/hero radius only through central v2.1-aligned tokens. | P1 |
| Transaction row | ALREADY EXISTS / ADAPT | Add production density, grouped dates, source/sync/review semantics, amount wrapping, and one combined screen-reader label. | P1 |
| Financial amount entry/keypad | ADOPT | Add one reusable amount-entry pattern when SPEC-004 implementation begins; use platform keyboard and current formatters. | P1 |
| Period/date-range selector | ADAPT | Add preset periods plus custom range; preserve report periods and salary-cycle support. | P2 |
| Search/filter chip bar | ADAPT | Use existing chip controls with scroll, selected icon/text, clear-all, RTL order, and filtered-empty state. | P1 |
| Segmented controls | ALREADY EXISTS / ADAPT | Harden focus, touch targets, RTL order, and long-label reflow. | P2 |
| Bottom sheet/dialog primitives | ALREADY EXISTS / ADAPT | Harden current overlays instead of adding another abstraction. | P1 |
| Example-led empty states | ADOPT | Reuse StateView/SurfaceCard; visibly label examples and exclude them from totals/accessibility summaries. | P2 |
| Grouped settings rows | ADAPT | Add one reusable settings-row/list composition; keep Masarifi’s profile/security/privacy IA. | P2 |
| Financial summary metric strip | ADAPT | Extend existing financial cards only when three compact metrics materially aid a screen. | P2 |
| Skeleton convention | ALREADY EXISTS | Apply current Skeleton primitives to final structures; no new loader package. | P2 |
| Voice recording state surface | ADAPT | Build from existing overlay/state primitives when SPEC-006 starts; include transcript/review/re-record. | P1 |
| Bright feature-specific gradients | REJECT | Conflicts with restrained Gulf Premium surfaces and one-brand interaction language. | P0 |
| Household and investments | REJECT | Outside individual Core V1 and explicit investment exclusion. | P0 |
| World Cup / AI Roasting novelty features | REJECT | Distract from finance and conflict with calm, non-judgmental language. | P3 |
| Dominant paywall banners | DEFER / REJECT AS SHOWN | Subscription UX belongs to SPEC-009; keep financial tasks dominant. | P3 |

# 10. Screen-by-Screen Masarifi Gap Review

| Masarifi surface | Current Masarifi | Useful reference pattern | Correct recommendation | Priority |
|---|---|---|---|---|
| Home | Functional shell with buttons/profile completion; final finance hierarchy absent | REF-WALLET-01/02 | Compose balance, salary-cycle, quick actions, tracking/review, recent transactions, budget, obligation, goal, and insight in the approved order. Use dark teal and restrained borders; avoid the reference’s saturated gradient stack. | P1 |
| Transactions | Placeholder | REF-WALLET-03, REF-TXN-01–04 | Adopt search/filter/period controls and amount-first full-screen entry. Add date grouping, source/status, review-required, offline/sync, undo/correction, refund/reversal, and virtualization. | P1 |
| Accounts | Placeholder plus existing AccountCard primitive | REF-ACCOUNTS-01 | Adapt sparse list hierarchy, but include masked identifiers, currency, credit/available balance, archived/default states, estimates, and account-specific reports. | P1 |
| Android tracking | Strong education, keyword, mode, permission-state foundations | REF-SMS-01–03 | Retain Masarifi’s platform adapter, review preference, manual/voice fallback, and exact permission scope. Adapt only status density and recovery clarity. | P0 |
| iOS capture | Honest alternative routes exist | No iOS evidence in reference | Leave Masarifi behavior untouched; never infer reference SMS parity. | P0 |
| Add/voice | Add placeholder; voice fallback foundations only | REF-TXN, REF-VOICE | Use one entry hub leading to manual/voice flows. Voice must show transcript and structured confirmation, not jump from audio directly to mutation. | P1 |
| Budgets | Reusable card/progress primitives; screen not implemented | REF-BUDGET-01 | Adopt progressive empty state and copy-last-month action; add forecasts, thresholds, related transactions, over-limit text, and offline states. | P1 |
| Obligations | Reusable progress/timeline cards; screen not implemented | REF-BILLS-01/02 | Adapt segmented summaries under Masarifi Obligations, not a Bills primary tab. Include loans, debts, payments, matching review, partial/overpayment, and correction. | P1 |
| Savings goals | Reusable card exists; screen not implemented | REF-GOAL-01–03 | Adopt empty/populated hierarchy; replace emoji/color dependence with accessible icon labels and add linked account, dates, contribution/withdrawal, paused/completed states. | P2 |
| Reports | Placeholder; accessible chart primitives exist | REF-INSIGHTS-01–03 | Adopt filter and overview hierarchy; implement required periods, text summaries, previous-period comparisons, drill-down, skeleton/insufficient-data/error states, and email status. | P1 |
| Assistant | Placeholder | REF-ASK-01 | Adopt concrete suggested questions; add consent, data scope, fact/estimate/suggestion labels, insufficient data, preview/confirm for changes, privacy controls, and history states. | P1 |
| More/settings | Functional button stack | REF-SETTINGS-01, REF-PREF-01 | Adapt grouped rows and subtitles; keep Masarifi routes, privacy/security prominence, and restrained subscription placement. | P2 |
| Auth/onboarding/security | Implemented and spec-driven | No equivalent evidence | Preserve current architecture. The reference does not justify redesigning these flows. | P0 |

# 11. Financial Trust and Product-Constraint Review

These Masarifi constraints must not be weakened by visual adaptation:

1. Automatic clear transactions expose source and immediate edit/undo; uncertain, duplicate, conflicting, or low-confidence results enter review.
2. Assistant-proposed record changes show an exact preview and require explicit confirmation.
3. Android SMS access follows education and explicit consent; denial never blocks manual or voice capture.
4. iOS never shows or implies direct SMS inbox access.
5. Sensitive values are maskable in-app and hidden in notifications, errors, analytics, and app-switcher previews.
6. Offline manual entries save locally, remain editable, and expose pending synchronization.
7. Original transaction amounts are retained; converted aggregates are labeled as estimates.
8. Refunds, reversals, transfers, debts, and operational errors remain semantically distinct.

The reference visibly supports some of these goals—permission education, transaction source/account cues, and explicit forms—but does not evidence Masarifi’s full review, undo, privacy, offline, multi-currency, or assistant-confirmation contract. **Confidence: HIGH.**

# 12. RTL and Bidirectional Review

## 12.1 Reference findings

- Live Arabic switching is observed in VID-01, and settings alignment/reordering changes immediately.
- Several English labels remain in Arabic views, including `Merchant Rules`; complete language parity is therefore not evidenced.
- Bottom-navigation mirroring, filter-chip semantic order, chart-axis direction, screen-reader order, and mixed-direction identifiers cannot be confirmed.
- English numerals remain visible, which is compatible with Masarifi, but correct locale-aware formatting cannot be verified.

## 12.2 Masarifi requirements by pattern

| Pattern | Required behavior |
|---|---|
| Headers/back | Mirror direction-dependent back/forward controls; keep close, search, settings, security, and brand icons unchanged. |
| Tabs/segments | Follow logical reading order while preserving product meaning; do not reverse time or financial semantics mechanically. |
| Rows/cards | Use logical start/end alignment; keep amount/currency units readable as one LTR financial run within RTL content. |
| Dates/identifiers | Use English numerals with locale-aware formatting and explicit mixed-direction handling for phone, account, transaction, and email values. |
| Charts | Review axes and labels deliberately; chronological time stays naturally readable and summaries carry essential meaning. |
| Progress bars | Preserve start-to-completion meaning; announce value/threshold in text and do not infer direction from color. |
| Forms/keyboard | Labels follow locale direction; amount/OTP/phone inputs preserve numeric order; keyboard-open primary action remains reachable. |
| Sheets/dialogs | Reading and focus order follow the active locale; swipe/back dismissal does not discard meaningful drafts silently. |
| Navigation | Masarifi’s approved destination meanings remain stable; visual placement may adapt by platform without changing route semantics. |

# 13. Accessibility Review

## 13.1 Reference risks

- Muted gray text, white text on bright gradients, and disabled controls may be low contrast; exact ratios require source colors and are **UNKNOWN**.
- Several icon-only controls and tiny top actions may fall below platform targets; dimensions cannot be confirmed from screenshots alone.
- Goals/categories rely heavily on emoji and color selection; selected color has a check, but accessible names are not observable.
- Some progress and comparison meanings are mainly color-based or graph-based; visible text summaries are incomplete.
- Dynamic text, TalkBack/VoiceOver labels, focus order, state announcements, and reduced motion are not observable.

## 13.2 Masarifi acceptance floor

- At least 44×44 logical pixels everywhere; prefer 48 dp for Android controls.
- 4.5:1 normal-text and 3:1 large-text contrast in light/dark modes.
- 200% text scaling without hidden amounts, statuses, or primary actions; reflow/scroll above that.
- Combined, human-readable financial announcements: merchant/title, amount/currency, meaning, account, date, source, and status—without reading decorative icons.
- Logical screen-reader and focus order in Arabic and English.
- No state conveyed only through color, animation, illustration, emoji, or haptic feedback.
- Reduced-motion paths for navigation, charts, loaders, dialogs, and sheets.
- Accessible summaries for every chart and explicit filtered-empty/insufficient-data text.

# 14. Prioritized Recommendation Matrix

| Priority | Recommendation | Rationale |
|---|---|---|
| P0 | Preserve source/review/undo/confirmation across every automatic or assistant-driven financial change | Core financial trust; reference visuals do not prove these safeguards. |
| P0 | Preserve Android permission education, optional denial, manual/voice fallback, and honest iOS divergence | Platform truth and core access cannot be traded for visual simplicity. |
| P0 | Preserve semantic tokens, privacy masking, localization, and accessibility contracts | Prevents a reference-inspired parallel system and sensitive-data regression. |
| P1 | Build the approved Home hierarchy using current financial primitives | Highest daily value; current Home is only a shell. |
| P1 | Build production transaction list and amount-first create/edit flows | Central daily task and strongest reference pattern. |
| P1 | Compose Accounts, Obligations, Budgets, Reports, and Assistant from existing primitives | Converts foundation work into usable product surfaces without new architecture. |
| P1 | Harden overlays, filters, transaction rows, tab selection, and RTL mixed-direction behavior | Reusable gaps affect multiple future screens. |
| P2 | Align central radius/elevation semantics with Gulf Premium v2.1 | Improves polish consistently without importing reference branding. |
| P2 | Add period selection, grouped settings rows, example-led empty states, and structure-matched skeletons | High reuse, moderate urgency. |
| P2 | Validate charts with dense data, summaries, grayscale, drill-down, and insufficient-data states | Required for Reports quality and accessibility. |
| P3 | Consider restrained delight for milestones and premium moments | Add only after core financial clarity and trust flows are complete. |

# 15. Adopt, Adapt, Reject, Already Exists, Defer

## ADOPT

- One dominant financial question and one dominant action per screen.
- Amount-first transaction entry with visible type switching.
- Searchable category selection with “most used” shortcuts.
- Example-led empty states for unfamiliar financial concepts.
- Period/account controls placed before report content.
- Concrete assistant question prompts.

## ADAPT

- Summary heroes → dark teal or neutral Gulf Premium surfaces, restrained gradient use, robust amount wrapping.
- Bills tabs → Masarifi Obligations segments with payment/review states.
- Filter chips → current chip primitives with text/icon selection and logical RTL order.
- Goal icon/color choice → accessible named icons with color as secondary personalization.
- Permission modal → exact platform scope, review logic, disable path, and manual fallback.
- Grouped Settings → Masarifi profile/privacy/security architecture with subscription promotion demoted.

## REJECT

- Reference brand name, logo, bright color families, novelty football/roasting motifs, and promotional copy.
- Household collaboration and investments in Core V1.
- Color-only financial/progress meaning or emoji-only category identity.
- Any SMS wording implying the operating-system permission itself reads only keyword-matching bank messages.
- Silent automatic changes, unconfirmed assistant mutations, or unmasked financial previews.
- A Bills/Buckets/Ask replacement for Masarifi’s approved primary navigation.

## ALREADY EXISTS

- Semantic themes, Arabic/English fonts, financial/status colors, spacing, motion, privacy state, sensitive-value components, cards, chips, segments, feedback, overlays, transaction row, planning cards, accessible charts, and onboarding/permission foundations.

## DEFER

- Paywall polish, release-note feeds, promotional event modes, decorative illustrations, celebratory motion, and advanced chart animation until core daily flows meet trust/accessibility acceptance.

# GLM Analysis Audit

## Correct Findings

- Correctly identified 30 screenshots and one video.
- Correctly recognized duplicate/near-duplicate evidence and the need not to double-count states.
- Correctly summarized much of the Masarifi token, typography, localization, route, and design-system foundation.
- Correctly noted that most core financial tab surfaces remain placeholders.
- Correctly identified the hard-coded Home selected state in `app/(tabs)/_layout.tsx` as a likely navigation defect.
- Correctly insisted on confidence labels, evidence discipline, no branding copy, and documentation-only scope.

## Corrected Findings

1. The previous document was an execution plan, not the requested analysis.
2. The statement that no analysis file existed contradicted the file itself and is removed.
3. Video feasibility was unresolved; this review verified local decoding and analyzed the complete 04:30.94 recording.
4. Sampling only 15–25 frames would have missed many flows; this review inspected the full timeline and dense transitions.
5. “Only Home and More are real” is narrowed: those are the only non-placeholder primary tab surfaces, while authentication, onboarding, security, foundation, and design-system flows are implemented.
6. Proposed tool/CDN methodology was environment-specific and not a UX finding; it has been removed.
7. The promised “36-section” structure was unsupported by the actual artifact; the document is now organized around verified evidence and Masarifi decisions.

## Missing Findings

- No actual screenshot-by-screenshot findings or stable screen IDs.
- No video flow, motion, filter, voice, language, lifecycle, modal, import/export, destructive, or paywall analysis.
- No reconstructed reference information architecture.
- No current-Masarifi versus reference screen review.
- No design-system ADOPT/ADAPT/REJECT/ALREADY EXISTS/DEFER classification.
- No financial-trust, Android/iOS, RTL, accessibility, responsive, or priority audit.
- No explicit unsupported/unknown findings section.

## Unsupported Findings Removed

- Assumption that a particular CDN/vision tool was required to inspect images.
- Assumption that FFmpeg availability was unknown.
- Assumption that 15–25 frames could adequately represent the recording.
- Unqualified implication that shell placeholders meant the broader authentication/onboarding/security implementation was absent.

## Spec Conflicts

GLM did not provide concrete redesign recommendations, so it introduced no direct visual recommendation conflict. Its planned analysis would nevertheless have been incomplete without explicit safeguards for automatic-change review/undo, Android/iOS honesty, privacy masking, obligations architecture, accessibility, and the approved five-destination navigation. These safeguards are now explicit.

## Remaining Unknowns

- Exact reference fonts, source colors, spacing tokens, easing curves, haptics, and internal component architecture.
- Screen-reader labels/order, dynamic-type behavior, reduced-motion behavior, and verified contrast ratios.
- Pull-to-refresh, swipe actions, chart tooltips/drill-down, offline/sync, duplicate review, transaction edit/delete/refund, and automatic undo behavior.
- Reference behavior on iOS, tablets, foldables, landscape, small screens, and dark mode.
- The precise purpose of REF-UNKNOWN-01.

# Final Masarifi Redesign Principles

1. **Financial clarity before decoration.** Amount, meaning, source, status, and next action dominate every screen.
2. **Gulf Premium, not reference-branded.** Dark teal remains primary; bronze remains rare; borders precede shadows; gradients are exceptional.
3. **Automatic first, never opaque.** Clear additions are traceable and reversible; uncertainty enters review.
4. **Arabic-first and English-complete.** Direction, reading order, mixed financial data, and accessibility are designed—not mechanically mirrored.
5. **Compose before creating.** Use the existing Masarifi primitives and add only proven missing behavior centrally.
6. **One task, one surface.** Use full screens for complex or high-risk financial work and sheets for short low-risk choices.
7. **Every state is a product state.** Loading, empty, filtered-empty, error, offline, permission, review, disabled, and sync states retain one clear recovery action.
8. **Motion confirms; it never delays.** Existing duration buckets are sufficient, and reduced motion preserves every outcome.
9. **Privacy is presentation architecture.** Sensitive information remains protected in overlays, notifications, previews, analytics, assistant content, and app lifecycle transitions.
10. **Reference quality, unmistakably Masarifi.** Adopt disciplined hierarchy and flow quality—not colors, naming, novelty, or information architecture.
