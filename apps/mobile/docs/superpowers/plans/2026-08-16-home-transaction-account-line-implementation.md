# Home Transaction Account Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the real source-account name beneath the category in every resolved Home recent-transaction card.

**Architecture:** Reuse `useAccounts(true)` in the queried Home composition and pass existing `Account[]` records through `HomeScreen` into `HomeSummary`. Resolve the source `accountId` locally and render the name without changing domain or service contracts.

**Tech Stack:** React Native, Expo Router, TanStack Query, Jest, Testing Library.

## Global Constraints

- Preserve existing Home data, privacy masking, navigation, RTL/LTR layout, category icons, and financial calculations.
- Do not add routes, dependencies, localization keys, API contracts, domain fields, persistence, or raw account-ID presentation.
- Keep recent transactions as independent cards.
- Do not commit or push.

---

### Task 1: Source-account metadata on Home transaction cards

**Files:**
- Modify: `apps/mobile/src/features/home/HomeScreen.test.tsx`
- Modify: `apps/mobile/src/features/home/HomeScreen.tsx`
- Modify: `apps/mobile/src/features/home/HomeSummary.tsx`

**Interfaces:**
- Consumes: `useAccounts(includeArchived?: boolean, enabled?: boolean)` and existing `Account`/`Transaction` types.
- Produces: optional `accounts?: Account[]` on `HomeScreen` and `HomeSummary`; `HomeTransactionRow` receives `accountName?: string`.

- [ ] **Step 1: Write the failing behavior tests**

Use `fixtureAccounts` with the existing summary and assert that `Daily account` appears, `account-bank` does not, and the card accessibility label includes `Daily account`. Render once without accounts and assert neither the name nor raw ID appears. Include a transfer whose `destinationAccountId` differs and verify the displayed name still comes from `accountId`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
node .\node_modules\jest\bin\jest.js HomeScreen.test.tsx --runInBand
```

Expected: failure because Home cards do not yet render account names.

- [ ] **Step 3: Pass existing accounts through Home composition**

Import `Account` and `useAccounts`. Keep injected-summary rendering synchronous via optional `accounts`; in `QueriedHomeScreen`, call `useAccounts(true)` independently and pass `accounts.data` without making its loading or error state block Home.

- [ ] **Step 4: Render the resolved source-account line**

Resolve with:

```tsx
const accountName = accounts?.find(
  (account) => account.id === transaction.accountId
)?.name;
```

Pass `accountName` to `HomeTransactionRow`. When present, append it to the accessibility label and render a compact `row` containing the name plus a 6×6 semantic-link-color dot beneath the category. When absent, render nothing and never display `accountId`.

- [ ] **Step 5: Run focused and static verification**

Run Home tests, `npm run typecheck`, `npm run lint`, `npm run check:core-finance`, `git diff --check`, and the Impeccable layout detector for the changed UI files.

- [ ] **Step 6: Verify Arabic and English visually**

Reload `http://localhost:8082/home`; confirm account name and dot sit below the category beside the icon in Arabic, mirror correctly in English, and do not collide with the amount/date column.
