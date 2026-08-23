# Shared Presentation Contract: Gulf Premium v2.2

This is a UI boundary, not a service API. Names describe required typed behavior; implementation signatures may stay compatible with existing components when they preserve the same contract.

## 1. Consumer Rules

1. Consumers provide localized content, feature-owned values, statuses, source, consequences, recovery actions, and navigation callbacks.
2. Shared components provide hierarchy, formatting, direction, theme, interaction state, accessibility, privacy, and motion behavior.
3. Shared components do not calculate balances, infer ledger effects, choose permission policy, resolve conflicts, or invoke commands without a supplied callback.
4. Consumers use semantic roles and public design-system exports; raw brand colors and local token maps are prohibited.
5. Existing components are extended first. New conceptual families are limited to grouped navigation rows, Source Mark, Financial Pulse, and Attention items/rail for R01.

## 2. Theme and Layout Roles

### Surface Roles

| Role | Use | Must not be used for |
|---|---|---|
| `page` | Screen background | Floating overlay separation |
| `grouped` | Grouped-list/section background | Every repeated row |
| `card` | Bounded object or summary | Generic spacing wrapper |
| `inset` | Secondary nested content | Primary action |
| `brandStrong` | High-priority branded summary/action | Large repeated areas |
| `brandSubtle` | Selected/lightly branded context | Operational errors |
| `attention` | Bounded issue requiring notice/action | Premium decoration |
| `overlay` | Sheet/dialog/menu separation | Ordinary page hierarchy |

Content roles are primary, secondary, muted, inverse, link, disabled, and sensitive. Border roles are default, subtle, strong, focus, selected, error, and disabled. Operational statuses and financial tones remain separate. Bronze cannot communicate functional status or financial direction.

### Metrics

- Spacing: 4, 8, 12, 16, 24, 32.
- Outer screen spacing: normally 16 or 24; section separation: normally 24; rows: 12–16.
- Radius: 8 controls, 12 cards/status, 16 prominent summary/sheet, pill only for chips/compact status.
- Touch target: 44 minimum, 48 preferred for primary controls.
- Elevation: overlays/transient lift only; border/grouping first.

## 3. Typography and Financial Values

| Role | Target metrics | Use |
|---|---|---|
| Caption | 12/16 regular | Metadata |
| Support | 14/20 regular | Secondary descriptions |
| Label | 14/20 semibold | Controls/compact labels |
| Body | 16/24 regular | Primary reading text |
| Subtitle | 18/26 semibold | Section/bounded titles |
| Title | 24/32 bold | Screen title |
| Summary amount | 32/40 bold, tabular | Primary financial value |
| Row amount | 17/24 semibold/bold, tabular | Repeated row value |

- Existing IBM Plex locale families remain behind the font gate.
- Required text reflows rather than shrinking for screenshots.
- Amounts use the shared formatter and English numerals.
- Sign, tone, display state, and feature meaning are independent.
- Number/currency/sign render as one isolated LTR run.
- Hidden, unknown, absent, estimated, pending, zero, positive, and negative remain distinct.

## 4. Component Contracts

### Buttons

- Variants: primary, secondary, quiet/tertiary, destructive, restrained premium.
- States: default, pressed, focused, disabled, loading.
- Loading retains its accessible name and blocks duplicate invocation.
- Icon-only controls require a localized label.
- One visually dominant primary action per viewport unless an approved feature spec says otherwise.

### Surface, Grouped List, and Navigation Row

- Surface variant expresses a semantic purpose, not an arbitrary color.
- Repeated content defaults to grouped rows, not nested cards.
- Navigation row supports label, optional description/value/status, optional leading visual, direction-aware disclosure, pressed/focused/disabled states, and 200% reflow.
- One actionable row is one accessible target; decorative descendants do not duplicate announcements.

### Fields and Selection

- Fields support default, focused, filled, invalid, disabled, read-only, and applicable loading states.
- Persistent label is mandatory; placeholder is never the only label.
- Helper/error are distinct; an error names the correction and is announced once.
- Existing amount, phone, OTP, search, and text keyboard semantics remain.
- Segments are for small visible mutually exclusive sets; larger sets use picker/list.
- Pickers communicate current/empty value, required/optional and disabled state, and disclosure direction.
- Switch is for immediate reversible settings; checkbox/radio semantics remain explicit.

### Sheet, Picker, and Dialog

- Uses native modal semantics and remains reachable above safe areas/keyboard.
- Focus enters, is contained, and returns to the invoker.
- Dismissal preserves draft and never invokes a feature command.
- Consequential confirmation names object, consequence, and caller-supplied recovery.
- Waiting, failure, local acceptance, pending sync, and confirmed completion remain distinct.

### State, Status, and Feedback

- Shared state kinds follow `data-model.md`; caller supplies content and valid recovery.
- Unknown/loading cannot appear as confirmed zero.
- Offline/partial/stale/local/pending remains distinct from confirmed current success.
- Status uses text/structure plus color/icon.
- Transient feedback is not the sole record of a consequential outcome.
- Polite announcements are default; assertive is reserved for urgent errors.

### Financial Summary and Amount

- Summary presents caller-supplied value, scope, context, and visibility action.
- Amount never derives sign or ledger effect from tone.
- Feature owner decides contextual sign for transfer/refund/savings/debt.
- Hidden amount uses stable masking without revealing length or magnitude.

### Source Mark

- Displays a concise caller-supplied source and optional safe explanation.
- Supports current feature-supplied origins.
- Raw SMS/sender/message/account/assistant evidence is hidden unless owner and privacy state allow it.
- Press opens context only; it cannot confirm a financial change.

### Financial Pulse

- Contains a short caller-supplied position statement, scope/time, optional supporting value/status, and optional evidence route.
- Does not calculate a score, prediction, recommendation, or new status.
- Remains useful with hidden values.

### Attention Item and Rail

- Item contains title, reason, consequence, status, optional source, and one route to the owning screen.
- Rail is compact ordered composition, not another notification center.
- Priority/order is caller-supplied; R01 does not rank risk.
- Empty attention normally removes the rail rather than showing a decorative success card.

### Progress and Insight

- Progress receives target/current/remaining/over-target values and caller-supplied status text; it owns no threshold rule.
- Progress has numeric/text meaning in addition to fill/color.
- Insight explains observation, scope, and evidence; it does not imply unsupported advice or automation.

### Charts

- Frame requires question/title, scope, summary, state, and optional caller-supplied drill-down.
- Donut shows at most top four plus Other and preserves supplied membership.
- Line shows at most four series with labels/patterns plus color.
- One-value, equal-value, dense, empty, error, partial, and hidden cases remain interpretable.
- Geometry is decorative to screen readers when the frame supplies equivalent meaning.

## 5. Shell Contract

### Root and Entry

- Provider order, font gate, shell provider, privacy gate, notification runtime, and stack-header behavior remain unchanged.
- Entry stays on a non-revealing loading state until shell/preferences hydrate.
- `resolveEntryRoute` remains the only `app/index.tsx` destination decision.

### Five Tabs

| Route | Meaning | Emphasis |
|---|---|---|
| `/(tabs)/home` | Home | Standard |
| `/(tabs)/transactions` | Transactions | Standard |
| `/(tabs)/add` | Add | Stronger, integrated |
| `/(tabs)/reports` | Reports | Standard |
| `/(tabs)/more` | More | Standard |

- All five remain visible with labels/icons.
- Existing direction helper determines visual/focus order.
- Selected state uses icon treatment, weight, and tonal cue, not color alone.
- Bottom safe area is respected.
- Routes, presses, and protected gate behavior remain unchanged.

### Auth Required

- Uses shared state/overlay hierarchy with existing sign-in/back actions.
- Pending destination remains sanitized and shell-owned.
- Cancellation cannot reach an unsafe destination.

### Planning Conflict Container

- R01 owns modal surface, header/action layout, focus, keyboard/safe-area, and dismissal only.
- Planning owns lookup, versions, content, consequences, selection, and commands.

## 6. Direction, Accessibility, Motion, and Privacy

- Arabic and English have equivalent visible and accessible coverage; no shared hard-coded user-facing strings.
- Layout uses logical start/end. Back/disclosure icons mirror; universal icons and chronology do not.
- Every control exposes correct role, name, state, value, focus order, and at least 44×44 target.
- Required content/actions remain reachable at 200% text and 320×568.
- Meaning never relies on color, motion, icon, sound, illustration, or haptics alone.
- Standard motion uses the existing 120/160/200/220 ms buckets within the 100–240 ms contract, without decorative bounce.
- Reduced motion immediately applies final state without suppressing meaning.
- Hidden content is absent from accessibility, external display, errors, analytics, screenshots, and app-switcher previews.
- Visibility changes do not alter route, draft, selection, financial state, or command result.

## 7. Compatibility Rules

- List current consumers before changing a public prop/export and add focused regression coverage.
- Mechanical prop migration is allowed; downstream feature-screen redesign is not.
- Route gates, formatter, preferences, privacy, notifications, and commands stay with current owners.
- No new dependency is required.
- Downstream reusable variants return to R01 ownership rather than becoming local tokens or duplicate patterns.

## 8. Acceptance Evidence

- Focused tests and boundary checks in `quickstart.md` pass.
- Gallery demonstrates applicable variants/stress states in both languages/themes.
- Each of the six owned route surfaces is reviewed independently.
- Android and iOS validation covers direction, theme, visibility, scaling, keyboard, screen reader, safe area, and reduced motion.
- Existing route and command outcomes remain unchanged.

## 9. R01 Consumer Inventory

Recorded before public contract replacement on 2026-08-15. R01 made additive semantic/token exports and additive component exports; it did not replace an existing public prop contract.

- Additive semantic token consumers: `src/design-system/tokens.ts`, `src/design-system/theme.ts`, `app/_layout.tsx`, `src/features/shell/AppTabs.tsx`, `src/design-system/components/navigation/GroupedList.tsx`, `src/design-system/components/financial/SourceMark.tsx`, `src/design-system/components/financial/FinancialPulse.tsx`, `src/design-system/components/feedback/AttentionRail.tsx`, `src/design-system/components/overlays/RouteModalContainer.tsx`.
- Existing high-blast-radius shared consumers preserved by focused regression: `src/features/shell/NavigationJourney.test.tsx`, `ProtectedNavigation.test.tsx`, `RootLayoutOptions.test.tsx`, `AppTabs.test.tsx`, `ValidationRoutesRegression.test.tsx`, `src/features/design-system/DesignSystemIntegration.test.tsx`, and all `src/design-system/**` suites.
- New public component consumers in this slice: `app/modals/auth-required.tsx`, `app/modal/planning-conflict.tsx`, `src/features/design-system/gallery/FinancialGallery.tsx`, and `src/design-system/index.ts`.
- Downstream R02-R20 importer scan was run with `rg "@/design-system|from './tokens'|from './theme'|from './typography'|from './motion'|from './icons'" app src -g "*.ts" -g "*.tsx" -n`; because no existing public prop was replaced, no mechanical downstream migration was required.
