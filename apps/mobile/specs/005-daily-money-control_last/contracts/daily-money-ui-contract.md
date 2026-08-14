# Daily Money UI Contract

## Route Ownership

```text
app/(tabs)/home.tsx                 Home dashboard
app/(tabs)/transactions.tsx         Date-grouped ledger, search, filters
app/(tabs)/add.tsx                  Entry hub and amount-first manual entry
app/transactions/[id].tsx           Transaction detail and correction actions
app/transactions/review/index.tsx   Review queue
app/transactions/review/[id].tsx    Review/duplicate resolution
app/accounts/index.tsx              Account list
app/accounts/new.tsx                Add account
app/accounts/[id]/index.tsx         Account detail
app/accounts/[id]/edit.tsx          Edit/archive/adjust account
app/categories/index.tsx            Category catalogue
app/categories/new.tsx              Add custom category
app/categories/[id].tsx             Edit/archive/merge category
app/tracking/index.tsx              Platform-aware tracking status
app/voice/index.tsx                 Record/process voice input
app/voice/review.tsx                Transcript and proposal confirmation
```

Routes remain thin composition owners. Financial rules, storage, native permissions, audio, and analysis remain behind the service contracts.

## Global Navigation Contract

- Primary destinations remain Home, Transactions, Add, Reports, More.
- The selected tab derives from the active route and MUST NOT be hard-coded.
- Accounts, categories, tracking, review, transaction detail, and voice are secondary flows with deterministic back behavior.
- Complex financial forms use full screens. Short, low-risk selection uses the shared sheet only when focus, back, safe-area, keyboard, and draft behavior pass its contract.
- Leaving a meaningful unsaved form invokes keep-editing/discard confirmation.

## Home Contract

### Required hierarchy

1. Header with privacy visibility action and secondary assistant entry.
2. Total balance with currency/estimate context and Accounts link.
3. Salary-cycle preview from the companion feature when available.
4. Quick actions: expense, income, transfer, voice, obligation payment.
5. Tracking recovery or review-required card when actionable.
6. Recent transactions with view-all.
7. Contextual budget, obligation, goal, and insight previews.
8. Profile completion only when incomplete and not dismissed.

### States

- Loading uses structure-matched skeletons without announcing false amounts.
- First-use empty presents one primary setup action and manual/voice alternatives.
- Partial/stale identifies incomplete data and preserves available values.
- Error retains safe navigation and retry.
- Offline identifies last known data and pending local work.
- Hidden balance masks visual and accessibility values.

## Transaction Ledger Contract

- Use a virtualized, date-grouped list with stable row identity.
- Each accessible row announcement combines title, amount/currency, meaning, account, date, source, review/sync status, and available primary action.
- Search and active filters precede results; filter controls support text plus selected state, horizontal scrolling where necessary, clear-one, and clear-all.
- Filter order follows logical reading order in RTL without reversing chronology.
- First-use empty and filtered-empty are distinct.
- Refund, reversal, transfer, failed, pending, review-required, and deleted states cannot rely on amount sign or color alone.
- Long titles and amounts wrap or reflow without overlapping controls.

## Transaction Entry Contract

- Transaction type is explicit and changes only relevant fields.
- Amount receives first visual priority and numeric LTR treatment inside either locale.
- Required inputs: type, amount, source account/payment source, category except transfer, date.
- Merchant is optional; recent account/category suggestions reduce effort but never make an invisible choice.
- One sticky primary save action remains reachable with the keyboard open.
- Validation preserves every field, associates error text with the field, moves focus to the first invalid field, and announces a summary when multiple errors exist.
- Offline-eligible manual records save with visible pending-sync status.
- Save disables duplicate submission while pending and reports success once.

## Transfer and Refund Contract

- Transfer displays source and destination as distinct labeled rows with a directional cue that mirrors only when semantically directional.
- The preview states effects on both balances, fee, original currencies, and any estimated conversion.
- Same-account transfer and unavailable conversion block confirmation without clearing data.
- Refund/reversal displays the original transaction and remaining refundable amount.
- Refund/reversal language never calls the value salary or ordinary income.

## Account Contract

- Account list communicates total context, name, type, masked identifier, currency, balance/available credit, default, and archived status.
- Archived accounts remain discoverable through an explicit filter but unavailable for new selections.
- Account detail provides current values, period income/expense, recent records, report link, edit, archive, adjustment, and transfer.
- Adjust balance uses before/after preview and confirmation because it changes financial totals.
- Duplicate account names remain distinguishable through type, institution, identifier, and currency.

## Category Contract

- Catalogue supports search, favorites/recent, hierarchy, system/custom distinction, and selected state.
- Icon/color is secondary to localized text.
- Create/edit uses named accessible icon/color choices and bilingual label requirements.
- Archive/merge presents impact count and target before confirmation.
- System-category restrictions are explained rather than silently disabling actions.

## Tracking and Review Contract

- Android tracking status covers not requested, granted/enabled, denied, permanently denied, revoked, paused, interrupted, battery restricted, and sync failure with one state-specific primary action.
- iOS never renders an SMS enable action; it presents manual, voice, and approved platform-assisted alternatives.
- Tracking copy distinguishes operating-system permission scope from Masarifi's later local matching/filtering.
- Review queue groups pending items and exposes reason text, not confidence color alone.
- Review detail shows safe evidence preview, proposed record, candidates, exact effect, and only valid resolution actions.
- Applying or merging requires explicit confirmation; clear automatic application exposes view/edit/undo feedback.

## Voice Contract

- Permission education precedes the microphone prompt; denial and permanent denial lead to different recovery actions plus manual fallback.
- Recording shows state, duration, stop, cancel, and accessible status announcements. Decorative waveform is optional.
- Processing blocks duplicate submission but offers safe cancellation only before irreversible work.
- Failure distinguishes no speech, unclear audio, unsupported language, interruption, and generic analysis failure with re-record/manual actions.
- Review shows transcript before structured proposals. Each proposal can be edited, removed, or selected.
- Confirm all/selected is disabled until each selected proposal satisfies required fields.
- No proposal enters the ledger until explicit confirmation.

## Shared State Matrix

| State | Required presentation |
|---|---|
| Loading | Structural skeleton or labeled progress; no false data |
| Empty | Explain why and one primary next action |
| Filtered empty | Preserve filters; clear/filter and add actions |
| Error | Safe localized cause, retry, and unaffected navigation |
| Offline | Last-known/pending distinction and eligible local action |
| Disabled | Reason plus recovery where available |
| Permission | Exact status, value/data-use explanation, fallback |
| Review required | Reason, proposed effect, explicit resolution |
| Sync pending/failed/conflict | Text status and retry/resolution path |
| Success | Confirm outcome once; no blocking celebration |
| Destructive | Consequence, target identity, cancel, explicit destructive action |

## RTL and Mixed-Direction Contract

- Arabic is RTL and English is LTR; direction is derived from locale.
- Start/end layout properties replace hard-coded left/right assumptions.
- Back/forward and transfer-direction icons mirror when meaning requires; close, search, privacy, account, category, microphone, and brand icons do not.
- Amount/currency, phone, OTP, account identifiers, and reference ids are readable LTR runs inside RTL content.
- Dates use English numerals and locale-aware order.
- Chronological data and chart time meaning are not mechanically reversed.
- Screen-reader order matches logical task order after visual reflow.

## Accessibility Contract

- Minimum 44 by 44 logical-pixel targets; prefer 48 dp on Android where layout permits.
- Normal text meets 4.5:1 contrast and large text 3:1 in both themes.
- All critical content works at 200% text scaling; above that, reflow and scrolling preserve actions.
- Focus moves intentionally after opening sheets/dialogs, validation, saved feedback, and review resolution.
- Amounts are announced with currency and financial meaning, not as disconnected symbols.
- Color, icon, motion, illustration, haptic, and position never carry sole meaning.
- Reduced motion applies outcomes immediately or with non-spatial fades.

## Privacy and Analytics Contract

- Hide-balances state applies to Home, account, ledger, detail, picker summaries, review, and voice proposals.
- App-switcher previews and notifications mask sensitive values according to privacy settings.
- Analytics may record route, action, result class, filter count, and duration bucket; it MUST NOT include amount, currency value, merchant, account, identifier, message, transcript, audio URI, notes, or error payload.
- Accessibility labels follow the same masking policy as visible text.

## Responsive Contract

- Validate portrait phones from 320 by 568 logical pixels through large phones and adaptive tablets.
- Safe areas protect headers, tab bar, sticky actions, recording controls, and sheets.
- Keyboard never covers the focused field, validation message, or primary action.
- Multi-column tablet composition is optional; content width remains readable and the task order remains identical.
- Landscape is not a primary layout target but MUST not lose data or trap navigation if the platform rotates unexpectedly.
