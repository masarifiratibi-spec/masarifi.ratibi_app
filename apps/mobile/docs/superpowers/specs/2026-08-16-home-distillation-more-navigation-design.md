# Home Distillation and More Navigation Design

## Goal

Keep Home focused on the user's current financial position while preserving every existing feature and moving its primary discovery path to More.

The resulting information architecture is:

`Balance and accounts -> first-use tracking invitation -> recent transactions -> basic period analytics`

All planning, setup, and secondary feature routes remain available from More. No business logic, data model, permission flow, route, or reusable feature component is deleted.

## Current Implementation Findings

- `app/(tabs)/home.tsx` currently composes `PlanningHomeCard`, `TrackingHomeCard`, and `ProfileCompletionCard` below the core Home summary.
- `HomeScreen` always renders `HomeQuickActions` after its main content.
- `HomeSummary` already owns the approved financial pulse, All Accounts card, and independent recent-transaction cards. It also renders `AttentionRail`.
- `app/(tabs)/more.tsx` already links to accounts, tracking, salary, budgets, obligations, savings, assistant, notifications, profile, security, privacy, subscription, and support. Categories is the only requested existing route missing from this list.
- Automatic tracking already has a persisted permission status and an existing `/tracking` setup/recovery screen. The Home layer does not need permission or tracking logic of its own.
- The five-tab contract is already `Home`, `Transactions`, `Add`, `Reports`, `More` and stays unchanged.

## Selected Approach: Render-Only Recomposition

Use the existing data owners, feature components, and routes. Change only where they render and how More groups its existing links.

### Home order

1. Existing period scope header, without restoring the removed greeting.
2. Existing `FinancialPulse` with total balance, period income, period expense, and active-account count.
3. Existing premium All Accounts card linked to `/accounts`.
4. Conditional automatic-tracking invitation, only while the current Android permission status is `not_requested`.
5. Existing Recent Transactions section with independent transaction cards and category-specific icons.

The income and expense metrics already inside `FinancialPulse` satisfy the requested basic analytics. A second analytics query or duplicated financial calculation is intentionally not added. Full insights remain in Reports.

### Removed from Home render only

- Attention rail / Needs attention.
- Planning progress and its budget, savings, salary, and obligation cards.
- Profile/setup completion card.
- Quick Actions and every shortcut inside it.

Their files, tests, routes, queries, commands, and business logic remain intact. The Home-specific composition is removed, not the capabilities.

### More organization

More becomes the organized directory for secondary capabilities while retaining the existing `MenuLink` behavior.

#### Finance and planning

- Accounts -> `/accounts`
- Categories -> `/categories`
- Budgets -> `/budgets`
- Savings goals -> `/savings`
- Salary cycle -> `/salary`
- Obligations -> `/obligations`
- Automatic tracking -> `/tracking`

#### Add and capture

- Manual entry -> `/(tabs)/add`
- Expense -> `/(tabs)/add?type=expense`
- Income -> `/(tabs)/add?type=income`
- Transfer -> `/(tabs)/add?type=transfer`
- Voice entry -> `/(tabs)/add?mode=voice`
- Obligation payment -> `/(tabs)/add?type=obligation_payment`

These are the exact destinations already owned by `HomeQuickActions`. More only provides menu access to them; the Add tab and its existing draft, validation, permission, and navigation logic remain unchanged.

#### Services

- Assistant -> `/assistant`
- Notifications -> `/notifications`
- Subscription -> `/subscriptions`
- Support -> `/support`

#### Account and settings

- Profile -> `/profile`
- Security -> `/security/settings`
- Privacy -> `/profile/privacy`
- Existing profile-completion card when it has not been dismissed.
- Existing "show setup progress" action when the card has been dismissed. Reopening shows the card in More, not Home.

#### Session

- Keep both existing sign-out actions and behavior unchanged.

## Automatic Tracking Invitation Lifecycle

The Home invitation is a presentation of existing state, not a new feature state.

| Existing state | Home result |
| --- | --- |
| Android + `permissionStatus === 'not_requested'` | Show the localized enable-tracking card and CTA. |
| `granted` | Hide it. |
| `denied`, `permanently_denied`, `revoked`, or `unavailable` | Hide it; recovery remains owned by `/tracking`. |
| iOS, null/unknown platform | Hide it because the Android tracking permission flow does not apply. |
| Query loading or error | Hide it so Home remains calm and financial data remains primary. |

Pressing the CTA navigates to `/tracking`. That screen continues to own permission requests, settings recovery, service controls, review queues, and tracking status.

"First use" is therefore defined by the already-persisted `not_requested` state. After the existing flow records any permission outcome, the invitation disappears. No new seen/dismissed flag or storage key is introduced.

## State and Data Ownership

- `useHomeSummary` continues to own Home loading, error, empty, partial, offline, hidden-balance, account, and transaction data.
- `useTrackingStatus` continues to own tracking eligibility.
- `useAppShellStore` continues to own setup-card dismissal and reopening.
- Each More item continues to open its existing route; More does not load or duplicate that feature's data.
- Balance privacy continues to use `SensitiveVisibilityProvider`; moving content must not bypass masking.

## RTL, LTR, Accessibility, and Responsive Behavior

- Arabic remains RTL and English remains LTR through the current direction store and bidi-safe components.
- Group headings and menu rows follow logical start/end alignment; chevrons use the existing directional icon behavior.
- All Home cards and More rows keep at least the existing minimum touch target and accessible button/link roles.
- Tracking CTA accessibility text states both the action and destination without exposing sensitive values.
- Home and More must remain scrollable at 200% text without clipped actions.
- Light, dark, hidden-balance, reduced-motion, and screen-reader behavior reuse R01 primitives.

## Alternatives Considered

1. **Reuse full Reports insights on Home.** Rejected because it adds a second query, duplicates Reports ownership, and makes Home heavier than requested.
2. **Create new More sub-screens for planning features.** Rejected because every requested feature already has a real route; wrappers would duplicate navigation and presentation.
3. **Persist a new one-time Home-banner flag.** Rejected because existing permission status already proves first-use eligibility and a new flag would add product state the user explicitly did not request.

## Non-Goals

- No redesign of destination screens.
- No new route or bottom-navigation tab.
- No changes to transaction, account, planning, tracking, assistant, permission, or onboarding business behavior.
- No deletion of `HomeQuickActions`, `PlanningHomeCard`, `AttentionRail`, `ProfileCompletionCard`, or their tests.
- No new dependency, data model, API contract, or persisted preference.

## Acceptance Criteria

- Home renders only the financial pulse, All Accounts, the eligible first-use tracking invitation, Recent Transactions, and the period metrics already contained in the pulse.
- Needs attention, planning progress, setup completion, and quick actions are absent from Home.
- More exposes every requested existing feature, including Categories and the removed transaction-entry shortcuts, under clear groups.
- Reopened setup progress appears in More and never restores the card on Home.
- Tracking invitation appears only for Android `not_requested` status and opens `/tracking`.
- All existing Home query states, hidden balances, transaction navigation, All Accounts navigation, and five bottom tabs continue to work.
- Arabic RTL and English LTR pass automated checks and connected-Android visual validation.
