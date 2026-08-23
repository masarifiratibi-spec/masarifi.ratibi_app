# Home Distillation and More Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for each behavior change and `superpowers:verification-before-completion` before claiming completion.

**Goal:** Simplify Home to balance/accounts, eligible first-use tracking CTA, recent transactions, and basic period metrics; relocate discovery of all secondary features to More without changing business logic.

**Architecture:** Preserve the current Home, tracking, app-shell, and feature data owners. Remove only Home render composition, make the existing tracking card conditional from `TrackingStatusSnapshot`, and group existing `MenuLink` destinations in More. Reuse existing routes and the existing `ProfileCompletionCard`; add no new storage, query, route, or financial calculation.

**Tech Stack:** React Native 0.74, Expo Router 3.5, TypeScript 5.3 strict, TanStack Query 5, Zustand, Jest 29, Testing Library, existing R01 design-system primitives.

**Global Constraints:** Work in the current `codex/r01-shared-ui-foundation` worktree. Preserve all unrelated dirty changes. Do not delete feature components, routes, tests, business logic, or data contracts. Do not restore the removed greeting. Do not add dependencies.

---

## Task 1: Lock the Home and More navigation contract in tests

**Files:**

- Modify: `src/features/home/HomeScreen.test.tsx`
- Modify: `src/features/shell/NavigationJourney.test.tsx`
- Modify if its existing coverage requires alignment: `src/features/shell/AppTabs.test.tsx`

### Step 1: Add failing Home composition expectations

For a populated `HomeSummary`, keep the assertions for the total balance, All Accounts, and Recent Transactions. Add negative assertions that the Home render does not contain the section headings for attention, planning progress, setup completion, or quick actions.

Use localized labels in the test rather than raw English-only strings:

```tsx
expect(screen.getByText(translate('coreFinance.home.total'))).toBeTruthy();
expect(screen.getByText(translate('coreFinance.home.allAccounts'))).toBeTruthy();
expect(screen.queryByText(translate('coreFinance.home.attention'))).toBeNull();
expect(screen.queryByText(translate('coreFinance.home.quickActions'))).toBeNull();
```

Do not remove the existing loading, error/retry, empty, partial/offline, hidden-balance, All Accounts press, or transaction press assertions.

### Step 2: Add failing More route-matrix expectations

Update `NavigationJourney.test.tsx` so Home no longer owns the Accounts/Assistant quick-action journey. Render More and assert each requested row navigates to its existing destination:

```ts
const expectedMoreRoutes = [
  ['/accounts', 'appShell.shell.accounts'],
  ['/categories', 'coreFinance.categories.title'],
  ['/budgets', 'planning.budgets.title'],
  ['/savings', 'planning.savings.title'],
  ['/salary', 'planning.salary.title'],
  ['/obligations', 'planning.obligations.title'],
  ['/tracking', 'tracking.action.openTracking'],
  ['/(tabs)/add', 'capture.manual'],
  ['/(tabs)/add?type=expense', 'coreFinance.action.expense'],
  ['/(tabs)/add?type=income', 'coreFinance.action.income'],
  ['/(tabs)/add?type=transfer', 'coreFinance.action.transfer'],
  ['/(tabs)/add?mode=voice', 'coreFinance.action.voice'],
  ['/(tabs)/add?type=obligation_payment', 'coreFinance.action.obligation']
] as const;
```

Keep the existing tests for assistant state, notification badge, profile/security/privacy, subscription/support, and sign-out behavior.

### Step 3: Protect the five-tab contract

Confirm the AppTabs test still asserts exactly:

```ts
['home', 'transactions', 'add', 'reports', 'more']
```

No tab implementation change is expected.

### Step 4: Run the red tests

Run:

```powershell
npx jest --runInBand src/features/home/HomeScreen.test.tsx src/features/shell/NavigationJourney.test.tsx src/features/shell/AppTabs.test.tsx
```

Expected before implementation: new absence/More-category assertions fail for the intended reasons.

---

## Screen: Home

## Task 2: Make the existing tracking card a first-use invitation

**Files:**

- Create: `src/features/tracking/TrackingHomeCard.test.tsx`
- Modify: `src/features/tracking/TrackingHomeCard.tsx`
- Modify: `src/localization/messages/ar.ts`
- Modify: `src/localization/messages/en.ts`

### Step 1: Add the smallest state-matrix test

Mock `useTrackingStatus` and verify:

```tsx
it.each([
  'granted',
  'denied',
  'permanently_denied',
  'revoked',
  'unavailable'
])('does not render after permission is %s', (permissionStatus) => {
  mockTrackingStatus({ platform: 'android', permissionStatus });
  const { queryByRole } = renderWithProviders(<TrackingHomeCard />);
  expect(queryByRole('button')).toBeNull();
});
```

Add one positive case for Android `not_requested` and one non-Android case. In the positive case, pressing the CTA must call `router.push('/tracking')`.

### Step 2: Gate presentation only

In `TrackingHomeCard`, preserve `useTrackingStatus()` as the state owner and return `null` unless all conditions are true:

```tsx
const query = useTrackingStatus();
const status = query.data;

if (
  query.isLoading ||
  query.isError ||
  status?.platform !== 'android' ||
  status.permissionStatus !== 'not_requested'
) {
  return null;
}
```

Render a compact R01 `SurfaceCard` with a tracking icon, a short localized title/body, and one secondary CTA to `/tracking`. Do not request permission from Home and do not add dismiss or seen state.

### Step 3: Add paired localization keys

Add only the copy needed by this eligibility state, with matching Arabic and English keys:

```ts
'tracking.home.enableTitle': 'Enable automatic tracking',
'tracking.home.enableBody': 'Allow tracking access so Masarifi can detect transactions automatically.',
'tracking.home.enableAction': 'Enable tracking',
```

Arabic should express the same meaning naturally and avoid claiming that tracking is already active.

### Step 4: Run the focused test

```powershell
npx jest --runInBand src/features/tracking/TrackingHomeCard.test.tsx
```

Expected: Android `not_requested` renders and routes correctly; every handled/non-applicable state renders nothing.

## Task 3: Distill the Home render hierarchy

**Files:**

- Modify: `app/(tabs)/home.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/HomeSummary.tsx`
- Verify unchanged: `src/features/home/HomeQuickActions.tsx`
- Verify unchanged: `src/features/financial-planning/PlanningHomeCard.tsx`
- Verify unchanged: `src/features/onboarding/ProfileCompletionCard.tsx`
- Verify unchanged: `src/design-system/components/feedback/AttentionRail.tsx`

### Step 1: Narrow the route composition

Replace the current multi-card `footer` composition with one optional `notice`:

```tsx
export default function HomeRoute() {
  return <HomeScreen notice={<TrackingHomeCard />} />;
}
```

Remove only the unused Home-route imports and app-shell selectors. Do not edit or delete the imported feature files.

### Step 2: Remove quick actions from Home layout

Rename the `footer` prop to `notice` in `HomeScreen` and `HomeLayout`, pass it through loading/error/empty/ready states, and remove these two render lines:

```tsx
<StyledText variant="subtitle">...</StyledText>
<HomeQuickActions />
```

Remove the now-unused `HomeQuickActions` import only. Its component and route tests remain.

### Step 3: Place the tracking invitation at the correct hierarchy point

Pass `notice` into `HomeSummary` and render it immediately after `AllAccountsCard`, before Recent Transactions. For loading/error/empty Home states, do not render the invitation because the financial state remains the primary recovery surface.

The ready composition becomes:

```tsx
<FinancialPulse ... />
<AllAccountsCard ... />
{notice}
<SectionHeading ... />
<RecentTransactionCards ... />
```

### Step 4: Remove only the Home attention composition

Stop building and rendering the Home `AttentionRail`. Remove the now-dead Home-local `buildAttentionItems` helper and its type import. Do not modify or delete the shared `AttentionRail`, its gallery/tests, tracking review, accounts, transactions, or offline/recovery routes.

Keep `FinancialPulse` income and expense metrics unchanged as the requested basic analytics. Keep All Accounts behavior, independent transaction cards, category icons, amount colors, hidden-balance behavior, and all navigation unchanged.

### Step 5: Run Home tests

```powershell
npx jest --runInBand src/features/home/HomeScreen.test.tsx src/features/home/HomeAccessibility.test.tsx src/features/accessibility/LargeTextLayout.test.tsx src/features/home/HomeRoute.test.tsx
```

Expected: core Home states and financial interactions pass; removed sections are absent only from Home.

---

## Screen: More

## Task 4: Organize all secondary features in More

**Files:**

- Modify: `app/(tabs)/more.tsx`
- Modify: `src/localization/messages/ar.ts`
- Modify: `src/localization/messages/en.ts`
- Modify: `src/features/shell/NavigationJourney.test.tsx`
- Reuse unchanged: `src/features/onboarding/ProfileCompletionCard.tsx`
- Reuse unchanged: `src/features/onboarding/profile-completion.ts`

### Step 1: Add semantic section labels

Add paired keys for the minimum four groups:

```ts
'appShell.more.financePlanning': 'Finance and planning',
'appShell.more.addCapture': 'Add and capture',
'appShell.more.services': 'Services',
'appShell.more.accountSettings': 'Account and settings',
```

Add natural Arabic equivalents. Do not introduce a new localization namespace or file.

### Step 2: Group the existing links

Keep the `ScrollView`, existing `MenuLink`, existing notification/assistant accessories, and existing routes. Render four labeled groups in this order:

```tsx
<MoreSection title={translate('appShell.more.financePlanning')}>
  {/* accounts, categories, budgets, savings, salary, obligations, tracking */}
</MoreSection>
<MoreSection title={translate('appShell.more.addCapture')}>
  {/* manual, expense, income, transfer, voice, obligation payment */}
</MoreSection>
<MoreSection title={translate('appShell.more.services')}>
  {/* assistant, notifications, subscriptions, support */}
</MoreSection>
<MoreSection title={translate('appShell.more.accountSettings')}>
  {/* profile, security, privacy, setup progress */}
</MoreSection>
```

Use an existing R01 grouping primitive if it accepts `MenuLink` content without changing row behavior; otherwise a local `View` plus `StyledText` section heading is the smaller safe change. Do not create a generic navigation registry or new screen.

Add the missing Categories row:

```tsx
<MenuLink
  label={translate('coreFinance.categories.title')}
  icon="categories"
  showChevron
  onPress={() => router.push('/categories')}
/>
```

If `categories` is not an existing `DesignIconName`, use the closest existing category-safe icon instead of expanding the icon system for this task.

Add the transaction-entry rows using the exact destinations already present in `HomeQuickActions.tsx`:

```tsx
<MenuLink label={translate('capture.manual')} onPress={() => router.push('/(tabs)/add')} />
<MenuLink label={translate('coreFinance.action.expense')} onPress={() => router.push('/(tabs)/add?type=expense')} />
<MenuLink label={translate('coreFinance.action.income')} onPress={() => router.push('/(tabs)/add?type=income')} />
<MenuLink label={translate('coreFinance.action.transfer')} onPress={() => router.push('/(tabs)/add?type=transfer')} />
<MenuLink label={translate('coreFinance.action.voice')} onPress={() => router.push('/(tabs)/add?mode=voice')} />
<MenuLink label={translate('coreFinance.action.obligation')} onPress={() => router.push('/(tabs)/add?type=obligation_payment')} />
```

Reuse existing icons and localization keys. Do not create new add modes or copy form logic into More.

### Step 3: Move setup progress presentation to More

Read `profilePromptDismissed`, `dismissProfilePrompt`, and `reopenProfilePrompt` from the existing app-shell store.

When not dismissed, reuse exactly:

```tsx
<ProfileCompletionCard
  onDismiss={dismissProfilePrompt}
  steps={deriveProfileCompletionSteps(emptyProfileSummary)}
/>
```

When dismissed, show the existing reopen `MenuLink`. Pressing it sets the store state so the card appears in More on the same route. Do not navigate back to Home and do not add another completion-state store.

### Step 4: Preserve session actions

Keep the two existing sign-out buttons, async calls, destructive/secondary variants, and `router.replace('/(public)/language')` behavior unchanged below the groups.

### Step 5: Run More and navigation tests

```powershell
npx jest --runInBand src/features/shell/NavigationJourney.test.tsx src/features/onboarding/ProfileCompletionCard.test.tsx src/features/shell/AppTabs.test.tsx
```

Expected: every relocated item reaches its existing route, setup progress lives in More, and the tab contract remains unchanged.

---

## Cross-Screen Validation

## Task 5: Verify RTL/LTR, accessibility, privacy, and code quality

**Files:**

- Modify only if a real regression is found: `src/features/accessibility/LargeTextLayout.test.tsx`
- Modify only if a real regression is found: `src/features/home/HomeAccessibility.test.tsx`

### Step 1: Run the focused suite

```powershell
npx jest --runInBand src/features/home/HomeScreen.test.tsx src/features/tracking/TrackingHomeCard.test.tsx src/features/shell/NavigationJourney.test.tsx src/features/shell/AppTabs.test.tsx src/features/onboarding/ProfileCompletionCard.test.tsx src/features/home/HomeAccessibility.test.tsx src/features/accessibility/LargeTextLayout.test.tsx src/features/voice/VoiceCaptureRoute.test.tsx src/features/home/HomeQuickActions.test.tsx src/features/financial-planning/PlanningHomeCard.test.tsx
```

The final three suites prove the preserved components still work after removal from Home.

### Step 2: Run static and architectural checks

```powershell
npm run typecheck
npm run check:design-system
npm run check:app-shell
npm run check:core-finance
```

Run targeted ESLint on changed production and test files. Then run `npm run lint`; if the only full-lint failure remains the pre-existing `new_Desinge/final_visual_mockups/generate-final-visual-mockups.mjs` issue, record it without changing that generator in this scope.

### Step 3: Review the diff for scope

```powershell
git diff -- apps/mobile/app/(tabs)/home.tsx apps/mobile/app/(tabs)/more.tsx apps/mobile/src/features/home apps/mobile/src/features/tracking/TrackingHomeCard.tsx apps/mobile/src/localization/messages/ar.ts apps/mobile/src/localization/messages/en.ts apps/mobile/src/features/shell/NavigationJourney.test.tsx
```

Confirm there are no route, service, repository, permission, model, or API-contract changes and no deleted feature files.

## Task 6: Validate on the connected Android device and fix visual regressions

### Step 1: Validate Home in Arabic RTL

Verify on the connected Android device:

- Total balance, income, expense, active accounts, All Accounts, and independent Recent Transaction cards render in the approved order.
- No greeting, attention, planning, setup, or quick-actions sections appear.
- Hidden balance remains hidden through every Home amount.
- All Accounts and recent-transaction presses open the same routes as before.
- Android `not_requested` shows one compact tracking invitation and opens `/tracking`.
- After the existing permission flow records any outcome, returning to Home removes the invitation.

### Step 2: Validate More in Arabic RTL

Verify every group is readable and every requested row opens the existing route. Confirm setup progress dismisses/reopens inside More and long content scrolls at 200% text.

### Step 3: Repeat in English LTR and both themes

Repeat the Home and More checks in English LTR, light theme, dark theme, and 200% font scaling. Check logical start/end alignment, chevrons, category icons, focus order, touch targets, and TalkBack labels.

### Step 4: Fix only discovered presentation regressions

Keep fixes within Home/More presentation, localization, and their tests. If validation reveals a separate destination-screen or business-logic defect, record it rather than widening this implementation.

### Step 5: Final verification

Rerun Task 5 commands after device fixes. Mark work complete only when focused tests, typecheck, architectural checks, and Android Arabic/English visual validation pass, with any environment-only or pre-existing lint limitation documented explicitly.
