# Voice Automatic Persistence and Manual Add Repair — Revised Implementation Plan

This replaces the previous plan. The original planning-phase instruction below was superseded by the user's later execution handoff authorizing implementation, nonfinancial Staging rollout, and a compatible Samsung APK update. Financial canaries still require explicit scope approval; Production and merge remain excluded.

## 1. Executive Summary

The final Voice product contract is:

**Record → extract independent events → apply existing safety rules → automatically persist each safe, valid event exactly once → return real transaction IDs → refresh authoritative financial queries → render normal saved transactions.**

Saved voice transactions must participate in account balances, totals, reports, editing and other normal transaction behavior. There is no Review or Confirm step.

**“Analyzed — not saved” is not an intermediate product state.** It is an existing temporary Staging diagnostic mechanism. It must not become a permanent transaction presentation system or substitute for financial acceptance.

Unsafe, ambiguous, incomplete or rejected events remain unpersisted under the existing safety rules. They must not produce fabricated transaction cards. Individual unsafe events retain existing silent-skip behavior; actual processing failures retain appropriate failure feedback.

This changes the implementation emphasis:

- **Remove the previous proposal to build styled unsaved voice cards or extract a second card presentation system.**
- Reuse existing normal transaction rendering after authoritative persistence.
- Verify persistence, receipt handling and financial query propagation together.
- Keep analysis-only verification as a preliminary safety gate.
- Require explicitly approved Staging financial canaries for final acceptance.

Manual Add remains a separate repair track. Confirmed defects include incompatible category selection, misleading error handling, optional-description enforcement, amount parsing and conditional date/note mismatches. The reported Income rejection has a reproducible category explanation; the exact historical Expense rejection remains unproven.

The review baseline remains **71 passing tests across five focused mobile suites**. Those tests do not establish final Samsung financial correctness.

## 2. Current Architecture

### Voice

1. Native recording completes and transfers audio ownership to the durable local journal.
2. The batch service creates a server session, uploads audio and starts processing.
3. The worker/provider extracts events.
4. Existing safety and validation logic determines which events may become transactions.
5. The immutable session mode selects:
   - **Normal financial execution:** persist eligible events and return transaction IDs.
   - **Staging analysis-only diagnostic execution:** return extracted results without financial persistence.
6. The mobile batch hook receives the receipt.
7. Saved transaction IDs trigger authoritative financial query invalidation.
8. Home and Transactions render normal ledger records through existing components.

Analysis-only sessions must never be silently promoted into financial sessions. An approved financial test uses a fresh normal recording.

### Financial persistence

The ledger path enforces ownership, account status, currency, category compatibility, amounts, dates and idempotency. Persistence and related financial records must remain atomic.

Extraction success, HTTP 200 and a completed provider request are insufficient evidence. Acceptance requires the actual financial record and its visible, financially reflected result.

### Manual Add

`Form → local validation → production finance facade → live API adapter → ledger validation/database command → response → authoritative refresh → draft cleanup → navigation`

The current form combines write and post-write work in one error boundary, creating a conditional risk that a successful save followed by cleanup failure looks like an unsuccessful write.

### Shared rendering and state

- Home uses `TransactionCard`.
- Transactions uses `TransactionRow`.
- Finance queries supply ledger data, balances and reports.
- Owner-scoped storage holds drafts and recovery state.
- The existing cache race repair and locale-preservation behavior must be retained.

## 3. Issue 1 — Voice UI Findings

### Confirmed findings

The current separate voice text block is produced by the **Staging analysis-only path**. It must not define the normal product UX.

The correct normal saved components already exist. A second transaction presentation system is unnecessary.

The receipt schema already distinguishes analysis-only results from financial results. Preserve that distinction; do not manufacture a `Transaction` object from extracted events.

### Revised implementation direction

- Normal processing shows progress until the server reaches an authoritative outcome.
- Persisted results appear exclusively through normal financial queries.
- A saved receipt may produce a brief existing success notification, but never a parallel voice transaction card.
- Unsafe events produce no financial record and no transaction card.
- Diagnostic results remain explicitly restricted to the existing Staging diagnostic mechanism.
- Do not refactor `TransactionCard` merely to accommodate unsaved diagnostic events.

### Files to inspect and change only where required

| File | Responsibility |
|---|---|
| [useVoiceBatches.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/voice/useVoiceBatches.ts>) | Receipt publication, terminal ordering and saved-ID invalidation. |
| [voice-batch-api-service.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/services/live/voice-batch-api-service.ts>) | Upload, processing, recovery and strict final receipt contracts. |
| [VoiceAnalysisResults.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/voice/VoiceAnalysisResults.tsx>) | Existing diagnostic-only presentation; never normal financial rendering. |
| [HomeSummary.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/home/HomeSummary.tsx>) | Existing processing, feedback and normal transaction sections. |
| [TransactionListScreen.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/transactions/TransactionListScreen.tsx>) | Authoritative saved rows and existing filtering/grouping. |
| [TransactionCard.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/transactions/TransactionCard.tsx>) | Reuse unchanged unless a saved-record rendering test proves a defect. |
| [TransactionRow.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/design-system/components/financial/TransactionRow.tsx>) | Reuse normal saved-row behavior. |
| [ai.repository.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/api/src/ai/ai.repository.ts>) | Verify admission mode, event decisions, persisted IDs and final receipts. |

No new voice endpoint or receipt format is assumed necessary. Existing financial safety rules must not be weakened to obtain a successful UI demonstration.

## 4. Issue 2 — Manual Add Findings

### Required and optional fields

For Expense/Income:

- **Required:** positive amount, compatible active account, compatible category and valid date.
- **Optional Description:** derive the internal nonempty title from the selected category when blank.
- **Optional Note:** normalize blank/whitespace-only input to `null`.
- Other optional metadata remains optional.
- Preserve transfer, refund and reversal-specific requirements.

### Confirmed defects

1. **Category mismatch:** Food is an Expense category, but the picker offers it for Income and retains it after switching types. The backend correctly rejects that combination.
2. **Error collapse:** validation, account conflicts, authentication and transport failures can all appear as “Review transaction details.”
3. **Description:** empty description is currently blocked despite the clarified optional-field requirement.
4. **Amount parsing:** Arabic digits are rejected; commas are stripped indiscriminately. `25,50` becomes 2,550 SAR, and `1,2,3` is accepted as 123 SAR.
5. **Date handling:** selecting Today preserves an old draft’s time. A reproduced yesterday-evening draft produced a timestamp 11.5 hours in the future when selected the following morning.
6. **Note contract:** multiline input is accepted locally but rejected by API/database validation.
7. **Title length:** a 161-character title passes client validation but fails the API’s 160-character limit.
8. **Submission lifecycle:** synchronous double-submit protection and durable operation recovery are incomplete.
9. **Post-write errors:** cleanup failure can be caught as though creation failed.

Your recorded inputs—50 SAR, “food,” Cash, Today, Food for both types—support the Income category explanation. They do not prove the Expense failure’s exact boundary.

### Principal files

- [TransactionForm.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/transactions/TransactionForm.tsx>)
- [category-selection-session.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/categories/category-selection-session.ts>)
- [CategorySelectionScreen.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/categories/CategorySelectionScreen.tsx>)
- [category-picker.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/app/category-picker.tsx>)
- [TransactionDateField.native.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/transactions/TransactionDateField.native.tsx>) and [web counterpart](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/transactions/TransactionDateField.web.tsx>)
- [manual-transaction-draft.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/transactions/manual-transaction-draft.ts>)
- [domain/core-finance.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/domain/core-finance.ts>)
- [live/core-finance-service.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/services/live/core-finance-service.ts>)
- [http-client.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/services/live/http-client.ts>)
- [contracts/core-finance-service.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/services/contracts/core-finance-service.ts>) and [production facade](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/services/mocks/core-finance-service.ts>)
- [core-finance-repository.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/storage/core-finance-repository.ts>)
- [core-finance-queries.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/core-finance/core-finance-queries.ts>)
- [ledger.dto.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/api/src/ledger/ledger.dto.ts>) and [ledger.repository.ts](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/api/src/ledger/ledger.repository.ts>)

## 5. Root Cause Matrix

| Finding | Layer | Severity | Confidence/evidence | Regression risk |
|---|---|---:|---|---|
| Diagnostic result mistaken for final Voice UX | Product/presentation | High | Confirmed distinction between analysis-only and financial receipts | Building a permanent duplicate card system |
| Full saved voice path lacks final financial Samsung acceptance | Cross-layer verification | High | Prior diagnostics intentionally created no financial records | Claiming success from extraction alone |
| Food selectable for Income | Form/picker | High | Confirmed source and reported selection | Filtering unrelated picker consumers |
| Errors reduced to generic validation feedback | HTTP/facade/form | High | Confirmed transformations | Losing compatibility with existing error consumers |
| Optional Description treated as required | Form | Medium | Confirmed guard and clarified requirement | Weakening the internal title contract |
| Unsafe numeric interpretation | Amount parsing | High | Production-function probes | Changing unrelated financial input flows |
| Today can retain a future draft time | Date/draft | High | Reproduced conditional defect | Breaking legitimate future dates in planning screens |
| Multiline note contract mismatch | Client/API/database | Medium | Confirmed validation mismatch | Broad text-validation relaxation |
| Cleanup failure may obscure successful creation | Submission lifecycle | High | Confirmed control flow; incident occurrence unproven | Duplicate creation on retry |
| Operation recovery is not durable | Client mutation | High | Confirmed conditional exposure | Collapsing legitimate identical purchases |
| Exact historical Expense rejection | Undetermined | High | Original request/error evidence unavailable | Incorrectly attributing it to the Income defect |

## 6. Proposed Final UX

### Normal Voice product behavior

| State/outcome | Required behavior |
|---|---|
| **Processing** | Existing progress UI covers upload, analysis, decisions and finalization. Another recording remains possible after durable handoff. |
| **Safe event** | Automatically persist under existing rules. Return its real transaction ID. Refresh authoritative queries and show the normal saved transaction immediately after those reads complete. |
| **Unsafe/rejected event** | Do not persist or fabricate a card. Preserve existing silent-skip behavior and distinguish event rejection from operational failure. |
| **Mixed recording** | Save eligible independent events; skip unsafe events. Do not reject valid independent events merely because another event is unsafe, except where the existing whole-response safety rules require rejection. |
| **Failure before known persistence** | Show the appropriate failure or uncertain-outcome state. Do not claim a transaction exists. |
| **Persistence succeeded, read failed** | Explain that the transaction was saved but the list could not refresh. Retry the read, not financial creation. |

There is **no normal “Analyzed — not saved” state** and no voice-specific saved transaction card.

### Staging diagnostic exception

The existing analysis-only mechanism may remain available solely under its Staging/owner restrictions. It is excluded from normal financial behavior and final acceptance.

Do not build styled transaction cards for it as part of this repair. Diagnostic results remain unpersisted and expire under the existing policy.

### Manual Add

- Valid input: one submission, visible busy state.
- Missing required field: actionable field error; no request.
- Optional fields empty: generate title and normalize note; save normally.
- Definitive rejection: retain input and explain the actual reason.
- Uncertain response: retain operation identity; no automatic financial retry.
- Success: preserve returned ID, refresh financial queries and navigate once.
- Post-save read/cleanup failure: retain known success and retry only the failed nonfinancial work.

## 7. Implementation Plan

| Step | Goal and change targets | Logic / must not change | Dependency | Result and test gate |
|---|---|---|---|---|
| 1 | Add integrated financial Voice regressions around the batch service/hook and Home/Transactions | Exercise safe persisted IDs, unsafe skips and repeated receipts. Do not insert extracted events into transaction caches. | Baseline | Tests distinguish financial success from diagnostic success. |
| 2 | Correct normal Voice rendering boundaries in the existing result mounts | Normal financial sessions never render analysis-only cards. Preserve restricted diagnostics and existing saved components. | 1 | No diagnostic block in normal financial mode. |
| 3 | Verify and repair only demonstrated persistence/receipt gaps | Trace existing safety decisions through DB write and returned IDs. Preserve atomicity, idempotency and all safety rules. | 1 | Isolated integration proves eligible events persist once; unsafe events do not. |
| 4 | Verify authoritative refresh and duplicate prevention | Preserve cache race repair; saved IDs drive normal reads. Do not add optimistic voice transactions. | 2–3 | One normal representation per saved ID on each screen; correct financial reads. |
| 5 | Add and fix Manual Add category regressions | Optional picker type filter, incompatible-selection reset, restored-selection validation. Preserve backend rejection rules. | Baseline | Reported Income scenario is prevented locally. |
| 6 | Repair manual input normalization | Optional description, localized numeric validation, title bounds and Today handling. Preserve linked transaction rules. | 5 | Required-only and input-edge tests pass. |
| 7 | Align note/API/database contracts | Note-specific LF support through an additive migration. Do not relax generic text validators. | 6 | DTO and disposable-database checks pass. |
| 8 | Repair error propagation and submission lifecycle | Safe error metadata, synchronous lock, durable operation identity, known-success retention. No automatic financial retries. | 5–7 | Double-tap, uncertainty, restart and cleanup-failure tests pass. |
| 9 | Run full relevant verification and CI | Use disposable integration infrastructure. No hosted financial writes. | 1–8 | All required checks pass. |
| 10 | Deploy Staging changes and update Samsung APK | Preserve login/data; record provenance. Posting stays OFF. | 9 | Nonposting device checks pass. |
| 11 | Obtain explicit approval and run bounded financial canaries | Fresh normal voice sessions; approve manual writes separately. No general worker/backlog drain. | 10 + approval | Real persistence, financial effects and normal UI verified on Samsung. |

For every behavioral fix: add the failing regression, demonstrate the failure, apply the minimum change, and pass the relevant gate before continuing.

## 8. Voice UI Implementation Steps

1. **Remove the previous unsaved-card work from scope.** Do not extract a card body or add a permanent voice event view model merely to display analysis-only events.
2. **Keep the financial receipt authoritative.** Successful analysis alone cannot set “saved,” create a card or alter balances.
3. **Verify the server decision boundary.** Each eligible independent event follows the existing financial persistence path. Unsafe events remain excluded.
4. **Return only real persisted IDs as saved results.** Never fabricate IDs or treat extracted ordinals as transaction IDs.
5. **Preserve event identity and idempotency.** Recovery and repeated requests must resolve to the same financial result, without collapsing distinct legitimate events.
6. **Publish receipts through the existing batch hook.** Preserve owner fencing, terminal-state ordering and ledger-version protections.
7. **Refresh the existing authoritative scopes.** Home, Transactions, Accounts and Reports must reflect the saved result. Preserve cancellation of stale in-flight reads.
8. **Render saved records through existing components.**
   - Home: normal `TransactionCard`.
   - Transactions: normal `TransactionRow`.
   - Existing account/category/date/filter behavior remains authoritative.
9. **Prevent dual representation by construction.** Financial sessions have no separate event-card collection. Only ledger records render as transactions.
10. **Do not deduplicate by content.** Two legitimate identical purchases remain separate when the backend returns two distinct transaction IDs.
11. **Keep unsafe events absent from transaction UI.** Do not show rejected events as disabled or provisional normal transaction cards.
12. **Separate financial success from read failure.** A failed refresh cannot cause redispatch of upload, extraction or financial persistence.
13. **Restrict diagnostic rendering.** Require the existing Staging configuration and explicit analysis-only receipt. Diagnostic data never enters financial caches.
14. **Preserve lifecycle behavior.** Locale changes, background/resume and cold reopening must recover saved records from authoritative data without redispatching financial work.
15. **Verify on Samsung after approval.** Screenshots alone are insufficient: correlate visible cards with actual returned and stored transaction IDs and financial totals.

No normal review, confirmation, save button or unsaved intermediate card is introduced.

## 9. Manual Add Implementation Steps

### Validation and optional fields

1. Add an optional `financialType` filter to category selection options, route forwarding and screen filtering.
2. Expense/Income supplies its type; other consumers retain existing behavior.
3. Clear incompatible categories on type change and validate restored selections.
4. Validate the selected account’s presence, status and currency without silently replacing an explicit selection.
5. Use trimmed description or the selected category’s localized label as the internal title.
6. Freeze the generated title in the submitted payload; locale changes cannot alter a retry.
7. Keep API title nonempty and enforce its existing length/control-character rules.
8. Preserve transfer/refund/reversal constraints.
9. Keep blank notes `null`.

### Amount and date handling

Add a manual-only normalizer:

`C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\apps\mobile\src\features\transactions\manual-transaction-input.ts`

It must:

- Accept ASCII, Arabic-Indic and Persian digits.
- Normalize Arabic decimal separators.
- Validate grouping instead of stripping every comma.
- Reject ambiguous `25,50` and malformed `1,2,3` with useful feedback.
- Preserve positive amount, currency precision and safe integer checks.
- Avoid floating-point rounding and unrelated global parser changes.

For dates:

- Add optional maximum-date support to the date fields and shared declaration.
- Manual Add supplies Today; unrelated callers retain current behavior.
- When selecting Today, prevent a preserved draft time from exceeding now.
- Validate restored dates before submission.
- Preserve the API future-time safety rule.

### Note contract

Use a dedicated optional-note normalizer in the ledger DTO:

- Omitted, null or whitespace-only → `null`.
- Normalize CRLF/CR to LF.
- Permit ordinary line breaks.
- Preserve the 500-character limit and rejection of other prohibited controls.
- Do not change title/reason validators.

Add the planned append-only migration:

`C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\supabase\migrations\20261006090000_ledger_multiline_notes.sql`

Update only relevant note constraints/checks in transaction creation, transfer and revision. Preserve financial logic, security properties and historical migrations.

### Errors and submission lifecycle

1. Preserve allowlisted server code, HTTP status and request ID through `HttpError`, `CoreFinanceError` and the production facade.
2. Map category, account, authentication, rate-limit and connectivity failures distinctly.
3. Show field-specific feedback near the save action and focus the relevant field.
4. Acquire a synchronous submission lock before asynchronous work.
5. Freeze normalized input and generate one UUID per logical submission.
6. Persist versioned operation metadata in the existing owner-scoped draft JSON before HTTP.
7. Prevent autosave or late hydration from overwriting that state.
8. Reuse the same operation and payload for an explicit uncertain-outcome retry.
9. Establish service in-flight ownership before asynchronous preparation.
10. Distinct operation IDs remain distinct even when payloads match.
11. Persist known success and returned transaction ID before cleanup.
12. Read or cleanup failures must never trigger another create command.
13. Recover identity after restart; stale or inconsistent recovery records require reconciliation before further writes.
14. Retain existing authoritative query invalidation and navigate once after known success.

Log only bounded metadata: operation/request IDs, phase, safe code, status and duration. Exclude financial contents and credentials.

## 10. Regression Tests

### Normal Voice financial path

- Safe English Expense → exactly one persisted transaction and real returned ID.
- Safe Arabic Income → correct type, account, category, amount and financial direction.
- Mixed safe/unsafe extraction → safe events saved, unsafe events absent.
- Whole-response rejection continues to follow existing safety rules.
- Repeated process/status/recovery requests cannot duplicate financial persistence.
- Lost acknowledgement resolves to the same operation/result.
- Repeated receipts produce no duplicate Home or Transactions representation.
- Distinct identical purchases remain independent.
- No normal unsaved card or Review/Confirm controls.
- Saved transaction appears through the actual normal components.
- Home, Transactions, account balance, totals and reports refresh correctly.
- Failed reads after persistence remain distinguishable from failed creation.
- Old reads cannot overwrite refreshed data.
- Locale switching, RTL/LTR, background/resume and cold reopening preserve correctness.
- Owner changes prevent stale responses from affecting another user.

### Diagnostic-only path

- Available only through existing Staging restrictions.
- Explicitly unpersisted, with no financial IDs or financial effects.
- Never counted as final financial acceptance.
- Does not become a saved transaction after policy changes.
- Expiry and audio cleanup continue to work.

### Manual Add

- Required-only and optional-empty submissions.
- Filled optional fields, including multiline notes.
- Expense/Income category filtering and type switching.
- Reported 50 SAR/food/Cash/Today fixture.
- Arabic/Persian digits, decimal precision and malformed grouping.
- Old draft → Today date scenario.
- Client/API title and note boundaries.
- Definitive validation rejection, authentication failure, API failure and uncertain outcome.
- Immediate double tap.
- Lost acknowledgement and restart recovery.
- Success followed by cleanup failure.
- Two legitimate identical submissions with separate operation IDs.
- Correct Home/Transactions/account/report updates without refresh/restart.
- English/Arabic, RTL/LTR and large text.

Run mobile tests, typecheck, lint and relevant boundaries. Run API unit/contract checks, then ledger integration/security and migration tests against verified disposable infrastructure only.

Do not run write-capable test suites against hosted Staging or Production.

## 11. Staging Verification Plan

### Gate A — Analysis-only safety verification

With Posting OFF:

1. Record backend/APK provenance, owner scope and financial baseline.
2. Preserve Samsung login, app data and journals.
3. Verify controlled English and Arabic recording, upload, provider execution, terminal receipt and cleanup.
4. Confirm zero financial persistence.
5. Verify lifecycle recovery and absence of endless processing.

**Passing Gate A does not complete the task.**

### Gate B — Isolated saved-path verification

Use disposable integration data and inert mobile fixtures to prove:

- Safety decisions and atomic financial persistence.
- Idempotent replay.
- Correct returned IDs and financial effects.
- Existing normal card rendering.
- No duplicate voice representation.
- Authoritative refresh and failure handling.

**Passing Gate B does not replace the real Samsung financial canary.**

### Gate C — Explicit financial approval

Immediately before the first financial write, present the exact Staging owner, accounts, utterances, intended amounts, maximum record count, expected balance changes and execution controls.

Reverify the existing owner-pinned ingress and bounded worker protocol. Do not start the ordinary worker or drain unrelated backlog.

Approval must cover actual financial writes. Manual Add requires separate coverage because voice Posting OFF does not block its API.

### Gate D — Required Samsung financial acceptance

After approval:

1. Run a fresh single-event English voice recording.
2. Run a fresh single-event Arabic voice recording.
3. Run an approved bounded safe/unsafe case; keep the ten-event test paused.
4. For each safe event, prove:
   - Existing rules classified it as eligible.
   - It persisted exactly once.
   - A real transaction ID was returned.
   - The database record exists.
   - Account, category, type, amount and currency are correct.
   - Home displays the normal saved card.
   - Transactions displays the normal saved row.
   - Balances, totals and reports reflect it.
   - No refresh or restart was required.
   - No separate voice result card exists.
5. For unsafe events, prove no transaction or financial posting was created.
6. Verify terminal state, no duplicate dispatch, audio cleanup and lifecycle behavior.
7. Return posting OFF and record final counts and configuration.

For each case, retain correlated capture/operation/request/session IDs, financial IDs, API receipt, database evidence, mobile state and screenshots.

## 12. Rollout Order

1. Preserve baseline and existing worktree changes.
2. Add failing Voice financial and Manual Add regressions.
3. Implement only demonstrated fixes, including normal/diagnostic rendering boundaries.
4. Complete input, error and submission repairs.
5. Pass focused tests, full relevant suites, isolated integration/security tests and CI.
6. Apply the compatible note migration to **Staging only**.
7. Deploy required Staging backend changes.
8. Verify policy and scoped worker configuration.
9. Build and hash the fresh Staging APK.
10. Install as an update without clearing data or login.
11. Complete nonposting Samsung checks.
12. Obtain explicit approval at the financial boundary.
13. Complete required controlled financial canaries.
14. Restore Posting OFF and publish the evidence report.

No Production deployment, Production posting or merge is included.

## 13. Risks

- **Diagnostic success mistaken for product completion:** final acceptance explicitly requires financial canaries.
- **Duplicate representation:** normal Voice financial mode renders only authoritative ledger records.
- **Duplicate financial writes:** preserve server idempotency and durable client operation identity.
- **Unsafe persistence:** never relax safety rules for a UI test.
- **Saved but not displayed:** verify receipts, reads, caches and both screens together.
- **Read failure mistaken for write failure:** retain known financial success and retry only reads.
- **Legitimate repeated purchases collapsed:** deduplicate by operation/event/transaction identity, not content.
- **Optional-field regression:** keep internal invariants while making the form fields optional.
- **Amount/date corruption:** use explicit normalization and targeted tests.
- **Accidental Manual Add writes:** Posting OFF is not a manual ledger safety gate.
- **RTL/locale regression:** test numeric input, layout and lifecycle.
- **Overstated incident diagnosis:** the historical Expense failure remains unproven until correlated evidence establishes its boundary.

## 14. Acceptance Criteria

Final completion requires all applicable criteria:

- [ ] A safe, valid voice event is automatically saved without Review or Confirm.
- [ ] Persistence occurs exactly once.
- [ ] The final API result contains the real saved transaction ID.
- [ ] That ID identifies a real database transaction.
- [ ] Correct account, category, type, amount and currency are preserved.
- [ ] Home shows the normal saved transaction automatically.
- [ ] Transactions shows the normal saved transaction automatically.
- [ ] Balances, totals and reports include the transaction correctly.
- [ ] No manual refresh or restart is required under matching screen filters.
- [ ] No successfully saved event appears simultaneously as a voice result card.
- [ ] Unsafe, ambiguous, incomplete or rejected events are not automatically persisted.
- [ ] Existing whole-response and individual-event safety rules remain intact.
- [ ] “Analyzed — not saved” is diagnostic-only and never the final product experience.
- [ ] English and Arabic financial canaries pass on Samsung.
- [ ] Duplicate request, stale-response, resume and cold-reopen tests pass.
- [ ] Audio cleanup and terminal failure behavior remain correct.
- [ ] Manual Add accepts valid required-only input and preserves optional fields.
- [ ] Manual Add errors are actionable and duplicate submission is prevented.
- [ ] Known financial success survives cache or draft-cleanup failure.
- [ ] Production remains unchanged and no branch is merged.
- [ ] Posting is OFF at the end.

If financial approval is not provided, report **“nonposting verification complete; final financial acceptance pending approval”**, not “resolved.”

## 15. Exact First Implementation Step

Start by extending:

[voice-transaction-visibility.test.tsx](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/apps/mobile/src/features/voice/voice-transaction-visibility.test.tsx>)

Create a controlled **normal financial-mode** scenario:

1. Begin with no displayed transaction.
2. Deliver a completed receipt containing a real-shaped saved transaction ID, with no analysis-only payload.
3. Make authoritative finance reads return that saved transaction and its updated financial values.
4. Assert:
   - Home renders its existing normal card.
   - Transactions renders its existing normal row.
   - No analysis-only result or voice-specific transaction card appears.
   - Replaying the receipt creates no duplicate.
   - No Review or Confirm control appears.
5. Add the counterpart unsafe-only receipt: no transaction IDs, no financial cache insertion and no transaction card.

Use inert test transport; perform no real financial write. Preserve already-passing assertions and introduce a failing regression only for an actual missing behavior.

This makes the corrected product contract executable before any UI or backend changes.

**Stop after this revised plan. Do not implement yet.**
