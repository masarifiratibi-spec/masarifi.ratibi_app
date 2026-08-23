# New Transaction and Home Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved manual-only New Transaction flow and make Home the sole production entry for voice capture, returning successfully saved voice transactions to Home with updated totals.

**Architecture:** Keep `TransactionForm`, the existing `manual-entry` draft, picker components, and voice state machine as the authoritative implementation. Separate manual and voice route ownership, use the persisted draft to hand picker selections back to Add, and reuse existing core-finance invalidation so Home refreshes after save.

**Tech Stack:** Expo Router 3, React Native 0.74, React Native Web, TypeScript 5.3, TanStack Query, Jest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-18-new-transaction-and-home-voice-design.md`

## Global Constraints

- Work only in `.worktrees/r01-shared-ui-foundation` on `codex/r01-shared-ui-foundation`.
- Preserve all existing dirty-worktree changes; do not reset, restore, clean, commit, push, restart the running Expo server, or delete evidence.
- Add exposes exactly Expense, Income, and Transfer; Refund and Obligation Payment domain support remains intact.
- Use the existing Masarifi theme and the same information architecture on web and native with Arabic RTL and English LTR.
- Add no dependency and no new global state store.
- Preserve voice permissions, transcription, analysis, proposal validation, persistence, notifications, and obligation logic.
- Use the current platform-specific `TransactionDateField` implementations.

---

### Task 1: Manual-only Add route and complete manual draft

**Files:**
- Modify: `apps/mobile/app/(tabs)/add.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionForm.tsx`
- Create: `apps/mobile/src/features/transactions/manual-transaction-draft.ts`
- Modify: `apps/mobile/src/features/transactions/AddRoute.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionForm.test.tsx`

**Interfaces:**
- Produces: `MANUAL_TRANSACTION_DRAFT_ID = 'manual-entry'` and `patchManualTransactionDraft(patch: Partial<TransactionDraft>): Promise<TransactionDraft | null>` for picker routes.
- Produces: manual `TransactionForm` picker navigation using `/modals/account-picker?draft=manual&field=accountId`, `/modals/account-picker?draft=manual&field=destinationAccountId`, and `/modals/category-picker?draft=manual`.
- Preserves: edit-mode AppSheet pickers and edit save/close behavior.

- [ ] **Step 1: Make Add route tests require a manual-only route**

Replace the mode-toggle assertion with exact prefill and unsupported-type fallback coverage:

```tsx
it('renders only the manual transaction form and preserves supported prefills', () => {
  renderWithProviders(<AddRoute />);
  expect(screen.queryByText(translate('voice.mode.voice'))).toBeNull();
  expect(mockTransactionForm).toHaveBeenCalledWith({
    initialAccountId: 'account-1',
    initialType: 'transfer'
  });
});

it('falls back to expense for transaction types hidden from Add', () => {
  Object.assign(mockParams, { type: 'obligation_payment' });
  renderWithProviders(<AddRoute />);
  expect(mockTransactionForm).toHaveBeenCalledWith({
    initialAccountId: 'account-1',
    initialType: 'expense'
  });
});
```

- [ ] **Step 2: Run the Add route test and confirm the old mode UI fails**

Run: `npm test -- --runInBand src/features/transactions/AddRoute.test.tsx`

Expected: FAIL because Voice is still rendered and `obligation_payment` is still accepted.

- [ ] **Step 3: Make `add.tsx` manual-only**

Remove `ChipSelector`, `VoiceCaptureScreen`, `mode`, and `router.setParams`. Resolve the query type through the fixed manual set:

```tsx
const manualTypes: TransactionType[] = ['expense', 'income', 'transfer'];
const initialType = manualTypes.includes(type as TransactionType)
  ? (type as TransactionType)
  : 'expense';

return <TransactionForm initialAccountId={accountId} initialType={initialType} />;
```

- [ ] **Step 4: Add failing form tests for the approved manual anatomy and complete persistence**

Add assertions that manual Add renders the three types, large amount currency, Category, Account, Description, Note, and Date; omits Refund/Obligation; persists `notes` and `occurredAt`; and passes those values to `createTransaction`.

```tsx
expect(screen.getByText(translate('coreFinance.type.expense'))).toBeTruthy();
expect(screen.getByText(translate('coreFinance.type.income'))).toBeTruthy();
expect(screen.getByText(translate('coreFinance.type.transfer'))).toBeTruthy();
expect(screen.queryByText(translate('coreFinance.type.refund'))).toBeNull();
expect(screen.getByLabelText(translate('coreFinance.transaction.noteOptional'))).toBeTruthy();
```

Run: `npm test -- --runInBand src/features/transactions/TransactionForm.test.tsx`

Expected: FAIL because the current Add branch is dense and saves `notes: null` with `occurredAt: Date.now()`.

- [ ] **Step 5: Add the minimal shared draft contract**

Create `manual-transaction-draft.ts` using `coreFinanceService.loadDraft/saveDraft` and the existing domain type:

```ts
export const MANUAL_TRANSACTION_DRAFT_ID = 'manual-entry';

export async function patchManualTransactionDraft(
  patch: Partial<TransactionDraft>
) {
  const current = await coreFinanceService.loadDraft(MANUAL_TRANSACTION_DRAFT_ID);
  if (!current) return null;
  return coreFinanceService.saveDraft({ ...current, ...patch, updatedAt: Date.now() });
}
```

- [ ] **Step 6: Reuse the Edit composition for manual Add**

Render the same safe-area header, three-type segmented row, centered amount/currency, `TransactionPickerCard`s, Description, Note, and `TransactionDateField` for manual Add. Keep edit-only actions and dirty tracking conditional on `transaction`. Remove the old Add-only `ChipSelector`, boxed amount `FormField`, `PickerField`, and inline AppSheets.

Persist and restore all draft fields:

```ts
setNotes(draft.notes ?? '');
setOccurredAt(draft.occurredAt ?? Date.now());

notes: notes.trim() || null,
occurredAt,
```

Use `useFocusEffect` to reload the draft after returning from a picker, and save the full draft immediately before `router.push()`.

- [ ] **Step 7: Save manual note/date and verify Task 1**

For create and update inputs use:

```ts
occurredAt,
notes: notes.trim() || null,
```

Run:

```bash
npm test -- --runInBand src/features/transactions/AddRoute.test.tsx src/features/transactions/TransactionForm.test.tsx src/features/transactions/TransactionDateField.test.tsx src/features/transactions/TransactionDateField.web.test.tsx
```

Expected: PASS.

---

### Task 2: Full-screen account and favorite-category pickers

**Files:**
- Modify: `apps/mobile/app/modals/account-picker.tsx`
- Modify: `apps/mobile/app/modals/category-picker.tsx`
- Modify: `apps/mobile/src/design-system/components/overlays/RouteModalContainer.tsx`
- Modify: `apps/mobile/src/features/transactions/AccountPicker.tsx`
- Modify: `apps/mobile/src/features/transactions/CategoryPicker.tsx`
- Modify: `apps/mobile/src/features/transactions/AccountPicker.test.tsx`
- Modify: `apps/mobile/src/features/transactions/CategoryPicker.test.tsx`

**Interfaces:**
- Consumes: `patchManualTransactionDraft()` and `MANUAL_TRANSACTION_DRAFT_ID` from Task 1.
- Produces: `CategoryPicker` prop `groupFavorites?: boolean`.
- Produces: `RouteModalContainer` prop `fullScreen?: boolean`.
- Picker query contract: `draft=manual`; account additionally uses `field=accountId|destinationAccountId`.

- [ ] **Step 1: Add failing category grouping tests**

Render `CategoryPicker groupFavorites` with favorite and non-favorite fixtures and assert localized headings and membership:

```tsx
expect(screen.getByText(translate('coreFinance.categories.mostUsed'))).toBeTruthy();
expect(screen.getByText(translate('coreFinance.categories.other'))).toBeTruthy();
expect(screen.getByText(favorite.labelEn)).toBeTruthy();
expect(screen.getByText(other.labelEn)).toBeTruthy();
```

Also assert the Most Used heading is omitted when no active favorites exist.

- [ ] **Step 2: Run picker tests and confirm the section test fails**

Run: `npm test -- --runInBand src/features/transactions/CategoryPicker.test.tsx src/features/transactions/AccountPicker.test.tsx`

Expected: FAIL because CategoryPicker currently renders one FlatList.

- [ ] **Step 3: Implement favorite and other sections without changing default consumers**

Keep the current FlatList when `groupFavorites` is false. When true, render a SectionList with:

```ts
const sections = [
  { key: 'favorites', title: translate('coreFinance.categories.mostUsed'), data: filtered.filter(item => item.category.isFavorite) },
  { key: 'other', title: translate('coreFinance.categories.other'), data: filtered.filter(item => !item.category.isFavorite) }
].filter(section => section.data.length > 0);
```

Reuse `CategoryRow`, current projection/search, loading/error states, selected state, and grouped positions within each section.

- [ ] **Step 4: Make route picker chrome full-screen**

Add `fullScreen?: boolean` to `RouteModalContainer`. In full-screen mode remove the outer card margin/border/radius while preserving safe area, keyboard avoidance, centered title, mirrored close/back control, and touch target.

Pass `fullScreen` from both picker routes and `groupFavorites` from the category route.

- [ ] **Step 5: Persist picker selections and return**

Read route params with `useLocalSearchParams`. For manual draft routes:

```ts
await patchManualTransactionDraft({ categoryId: category.id });
router.back();
```

For accounts validate `field` and patch either `accountId` or `destinationAccountId`. Load the current draft to pass `selectedId`, and exclude the source account for a destination picker.

- [ ] **Step 6: Add route-level picker selection tests and verify Task 2**

Assert selection patches the expected draft key, calls `router.back()`, and current/default AccountPicker and CategoryPicker tests remain unchanged.

Run:

```bash
npm test -- --runInBand src/features/transactions/CategoryPicker.test.tsx src/features/transactions/AccountPicker.test.tsx src/features/transactions/TransactionForm.test.tsx
```

Expected: PASS.

---

### Task 3: Dedicated Home voice route and automatic processing flow

**Files:**
- Create: `apps/mobile/app/(tabs)/voice.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/more.tsx`
- Modify: `apps/mobile/src/features/home/HomeSummary.tsx`
- Modify: `apps/mobile/src/features/home/HomeQuickActions.tsx`
- Modify: `apps/mobile/src/features/home/HomeScreen.test.tsx`
- Modify: `apps/mobile/src/features/voice/VoiceCaptureScreen.tsx`
- Modify: `apps/mobile/src/features/voice/VoiceRecorder.tsx`
- Modify: `apps/mobile/src/features/voice/useVoiceCapture.ts`
- Modify: `apps/mobile/src/features/voice/VoiceCaptureRoute.test.tsx`
- Modify: `apps/mobile/src/features/voice/VoiceCaptureScreen.test.tsx`
- Modify: `apps/mobile/src/features/voice/VoiceRecorder.test.tsx`
- Modify: `apps/mobile/src/features/voice/useVoiceCapture.test.tsx`

**Interfaces:**
- Produces: hidden protected route `/(tabs)/voice` with no tab-bar destination.
- Produces: `VoiceCaptureScreen` prop `autoStart?: boolean` defaulting to false for existing isolated tests.
- Preserves: `useVoiceCapture.analyze()` for recovery/tests while the normal `stop()` path analyzes the returned transcript automatically.

- [ ] **Step 1: Add failing route ownership tests**

Update Home expectations:

```tsx
fireEvent.press(screen.getByTestId('home-quick-action-voice'));
expect(router.push).toHaveBeenCalledWith('/(tabs)/voice');
```

Update `VoiceCaptureRoute.test.tsx` to import the new Voice route and assert Add contains no Voice UI. Add a More assertion that the voice menu row is absent and the obligation row targets `/obligations`.

- [ ] **Step 2: Run route tests and confirm old Add voice ownership fails**

Run:

```bash
npm test -- --runInBand src/features/home/HomeScreen.test.tsx src/features/voice/VoiceCaptureRoute.test.tsx src/features/transactions/AddRoute.test.tsx
```

Expected: FAIL because Home and More still target `add?mode=voice`.

- [ ] **Step 3: Add the hidden protected voice tab route**

Create:

```tsx
export default function VoiceRoute() {
  return <VoiceCaptureScreen autoStart />;
}
```

Register `<Tabs.Screen name="voice" options={{ href: null }} />` and hide `AppTabs` while `currentName === 'voice'`. Change both Home voice actions to `/(tabs)/voice`. Remove the More voice row and route the More obligation row to `/obligations`.

- [ ] **Step 4: Add failing autostart, processing-overlay, and Home-completion tests**

Cover:

```tsx
it('starts once when autoStart reaches ready', async () => {
  (voiceRecorderService.getPermission as jest.Mock).mockResolvedValue('granted');
  (voiceRecorderService.start as jest.Mock).mockResolvedValue('recording-1');
  renderWithProviders(<VoiceCaptureScreen autoStart />);
  await waitFor(() => expect(voiceRecorderService.start).toHaveBeenCalledTimes(1));
});

it('shows a blocking processing overlay while transcribing', () => {
  useVoiceCaptureStore.getState().patch({ state: 'transcribing' });
  renderWithProviders(<VoiceCaptureScreen />);
  expect(screen.getByTestId('voice-processing-overlay')).toBeTruthy();
  expect(screen.getByText(translate('voice.state.processing'))).toBeTruthy();
});

it('replaces the voice route with Home after save succeeds', () => {
  useVoiceCaptureStore.getState().patch({ state: 'saved' });
  renderWithProviders(<VoiceCaptureScreen autoStart />);
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
});
```

Update hook tests so `stop()` expects `transcribing -> analyzing -> proposal_review`, with `voiceAnalyzerService.analyze` called using the transcript returned by `transcribe`.

- [ ] **Step 5: Run voice tests and confirm the new flow fails**

Run:

```bash
npm test -- --runInBand src/features/voice/VoiceCaptureScreen.test.tsx src/features/voice/VoiceRecorder.test.tsx src/features/voice/useVoiceCapture.test.tsx
```

Expected: FAIL because recording does not autostart, processing is inline, stop ends at transcript review, and saved routes to Transactions.

- [ ] **Step 6: Implement autostart and compact recording state**

In `VoiceCaptureScreen`, start once when `autoStart && session.state === 'ready'`. Keep permission error/retry/settings behavior. Remove the always-visible manual-mode switch; permission failures may retain a single localized fallback action that navigates to `/(tabs)/add`.

Use the existing `VoiceRecorder` timer, waveform, stop, and cancel actions, but remove surrounding demo/scenario chrome from the production autoStart path so recording is the focal state with one large accessible stop control.

- [ ] **Step 7: Make stop continue through existing analysis**

Extract the existing analysis body into a local helper accepting the concrete transcript:

```ts
const analyzeTranscript = async (transcript: VoiceTranscript) => {
  session.transition('analyzing');
  const group = await voiceAnalyzerService.analyze({
    transcript,
    scenario: session.scenario,
    sessionId: session.id,
    recordedAt: session.startedAt!,
    timezoneOffsetMinutes: session.timezoneOffsetMinutes!
  });
  session.setGroup(group);
  session.transition('proposal_review');
};
```

Call it from `stop()` immediately after transcription. Keep `analyze()` delegating to it for recovery paths.

- [ ] **Step 8: Add processing overlay and successful Home replacement**

Render an absolute, accessible dim layer for `stopping`, `transcribing`, `analyzing`, and `saving`; use the current localized processing/saving labels and `StateView`. On `saved`, call `router.replace('/(tabs)/home')` once. Do not navigate on save error.

- [ ] **Step 9: Verify Task 3**

Run:

```bash
npm test -- --runInBand src/features/home/HomeScreen.test.tsx src/features/voice/VoiceCaptureRoute.test.tsx src/features/voice/VoiceCaptureScreen.test.tsx src/features/voice/VoiceRecorder.test.tsx src/features/voice/useVoiceCapture.test.tsx src/features/voice/useVoiceCaptureReview.test.tsx src/features/voice/VoiceCaptureRecovery.test.tsx src/features/voice/VoiceCaptureAccessibility.test.tsx
```

Expected: PASS.

---

### Task 4: Localization, accessibility, boundaries, and final verification

**Files:**
- Modify: `apps/mobile/src/localization/messages/ar.ts`
- Modify: `apps/mobile/src/localization/messages/en.ts`
- Modify only if required by focused failures: transaction, picker, Home, or voice test files named in Tasks 1-3.

**Interfaces:**
- Produces localization keys `coreFinance.categories.mostUsed` and `coreFinance.categories.other` in Arabic and English.
- Produces no new runtime dependency or design token.

- [ ] **Step 1: Add exact Arabic and English picker copy**

```ts
'coreFinance.categories.mostUsed': 'Most Used',
'coreFinance.categories.other': 'Other',
```

```ts
'coreFinance.categories.mostUsed': 'الأكثر استخدامًا',
'coreFinance.categories.other': 'أخرى',
```

- [ ] **Step 2: Run focused localization and accessibility coverage**

Run:

```bash
npm test -- --runInBand src/features/transactions/AddRoute.test.tsx src/features/transactions/TransactionForm.test.tsx src/features/transactions/CategoryPicker.test.tsx src/features/transactions/AccountPicker.test.tsx src/features/transactions/TransactionDateField.test.tsx src/features/transactions/TransactionDateField.web.test.tsx src/features/home/HomeScreen.test.tsx src/features/home/HomeAccessibility.test.tsx src/features/voice/VoiceCaptureRoute.test.tsx src/features/voice/VoiceCaptureScreen.test.tsx src/features/voice/VoiceRecorder.test.tsx src/features/voice/useVoiceCapture.test.tsx src/features/voice/useVoiceCaptureReview.test.tsx src/features/voice/VoiceCaptureRecovery.test.tsx src/features/voice/VoiceCaptureAccessibility.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript and architecture boundaries**

Run:

```bash
npm run typecheck
npm run check:core-finance
npm run check:voice-capture
npm run check:app-shell
npm run check:design-system
```

Expected: all exit 0.

- [ ] **Step 4: Run one bounded frontend detector pass**

Run from the repository root:

```bash
node C:/Users/DELL/.agents/skills/impeccable/scripts/detect.mjs --json apps/mobile/app/(tabs)/add.tsx apps/mobile/src/features/transactions/TransactionForm.tsx apps/mobile/src/features/transactions/CategoryPicker.tsx apps/mobile/src/features/voice/VoiceCaptureScreen.tsx apps/mobile/src/features/voice/VoiceRecorder.tsx
```

Fix only mechanical findings inside the approved scope, then do not rerun the detector.

- [ ] **Step 5: Inspect the existing web server without restarting it**

Use the available local browser surface only if policy permits localhost access. Check Add at phone and wider web dimensions, both picker routes, Arabic RTL, English LTR, and the voice recording/processing states. If localhost capture remains blocked, report that limitation and rely on focused render tests without opening another browser surface.

- [ ] **Step 6: Review the scoped diff and leave the worktree uncommitted**

Run:

```bash
git diff --check -- apps/mobile docs/superpowers
git status --short
```

Expected: no whitespace errors. Do not stage, commit, push, clean, restore, or restart the Expo process.
