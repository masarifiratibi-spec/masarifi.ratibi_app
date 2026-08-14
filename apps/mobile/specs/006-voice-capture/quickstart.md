# Quickstart: Validate Voice Transaction Capture and Smart Categorization UX

This guide validates the implemented SPEC-006 feature. It assumes implementation tasks have
installed project dependencies and configured development builds. The expected domain and
service behavior is defined in [data-model.md](data-model.md) and
[contracts/voice-capture-contract.md](contracts/voice-capture-contract.md).

## 1. Prerequisites

- Node.js and the repository's installed dependencies.
- An Android development build for Android permission and interruption checks.
- A macOS/Xcode environment and iOS development build for native iOS checks.
- No production speech, AI, backend, notification, or obligation provider credentials.

## 2. Automated Gate

From `apps/mobile` run:

```powershell
npm run typecheck
npm run lint
npx expo install --check
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm run check:core-finance
npx jest --runInBand --forceExit
```

Expected:

- Every command exits successfully.
- Tests prove permission mapping, capture cleanup, the 60-second limit, confidence policy,
  relative dates, proposal validation, selection, all-or-none save, idempotent retry, category
  preference behavior, query invalidation, localization keys, and critical screen states.
- No test or log output contains audio references, transcripts, or financial values from the
  voice fixtures.

## 3. Start the Development Build

```powershell
npm run start -- --localhost
```

Open the existing Android or iOS development build and authenticate through the project mock
flow. Confirm Home and the Add tab both expose Voice entry and reach the same voice mode.

## 4. Scenario A: Clear Single Transaction

Use the clear Arabic fixture equivalent to “I paid 80 riyals for fuel in cash.”

Expected:

- Permission education appears before the native prompt.
- Recording status, duration, Stop, and Cancel are understandable without waveform animation.
- Stopping produces a visible transcript before analysis.
- Review separates amount, currency, merchant, category, payment method, funding account, and
  resolved date.
- Nothing changes financially until Save.
- Save creates exactly one `source: voice` transaction and updates transaction and Home queries.
- Temporary audio is absent after transcription and transcript/session state is absent after
  save.

Repeat in English and verify English LTR parity.

## 5. Scenario B: Confidence and Missing Fields

Run the low-confidence and missing-account fixtures.

Expected:

- Fields at 90% or above appear clear.
- Fields from 60% through 89% show a textual reason and require explicit confirmation.
- Fields below 60% behave as missing.
- Missing required amount, currency, type, or date blocks Save with a field-level correction.
- An optional missing value does not block Save.
- Payment method and funding account remain separately labeled and editable.

## 6. Scenario C: Multiple Transactions and Atomic Failure

Use the fixture equivalent to “Yesterday I paid 40 riyals for coffee and 120 riyals for
groceries.”

Expected:

- Two separate proposal cards appear.
- Editing, removing, selecting, or deselecting one does not change the other.
- Confirm selected saves only selected proposals.
- Confirm all saves both proposals with one stable operation ID.
- In the forced-failure fixture, neither proposal appears in the ledger and the complete review
  group remains available.
- Retrying a previously successful operation creates no duplicates.

## 7. Scenario D: Relative Date and Timezone

Use a fixture containing “yesterday” near a simulated midnight boundary.

Expected:

- Resolution uses the recording start date and timezone, not save time.
- The resolved date is visible before save.
- Changing timezone after recording does not silently change the proposal.
- Ambiguous, future, and out-of-range fixtures require confirmation or correction.

## 8. Scenario E: Category Correction

Change the category of a known merchant and exercise each option.

Expected:

- `Only this time` corrects the current proposal and creates no preference.
- `Always for this merchant` writes the preference only after the transaction save succeeds.
- A later fixture for the normalized merchant uses the approved category before known-merchant,
  keyword, or smart-mock suggestions.
- `Not now` preserves the current correction without a future preference.
- An archived category is not returned by the preference.

## 9. Scenario F: Recurring and Obligation Intent

Use monthly, installment, subscription, rent, and loan-payment fixtures.

Expected:

- One-time, recurring, existing-obligation, and new-obligation choices appear only when relevant.
- No recurring item, obligation, or link exists before explicit preview and confirmation.
- Multiple obligation candidates require user selection.
- A confirmed existing-obligation payment updates the transaction and mock obligation effect in
  the same successful outcome.
- Canceling or forcing failure changes neither ledger nor obligation state.

## 10. Permission and Failure Matrix

Verify on both Android and iOS where available:

| State | Expected recovery |
|---|---|
| Not requested | Education, Request permission, Manual entry |
| Denied | Explain consequence, Retry where allowed, Manual entry |
| Permanently denied | Open settings, Manual entry |
| Unavailable | Manual entry without false capability claims |
| Interrupted/backgrounded | Stop safely, explain, Re-record or Manual entry |
| 60-second maximum | Advance warning, automatic stop, continue to transcript or retry |
| No speech/noise | Calm explanation, Re-record, Manual entry |
| Unsupported language | Explain supported languages, Edit transcript or Manual entry |
| Analysis failure | Retry, Edit transcript, Re-record, Manual entry |
| Offline | No queued audio; Manual entry remains available |
| Save failure | Save none; preserve review and offer Retry |

After each canceled or failed recording, inspect app-private temporary storage through the
development tooling and verify no stale audio file remains.

## 11. Accessibility and Visual Matrix

Check the full clear, uncertain, multi-proposal, permission-denied, and save-failed flows in:

- Arabic RTL and English LTR.
- Light and dark themes.
- 320 by 568 and a large phone/tablet viewport.
- 200% system text size.
- Screen reader enabled.
- Reduced motion and grayscale.
- Keyboard open while editing transcript and proposal fields.
- Hidden-sensitive-values mode.

Expected:

- Text, amounts, confidence reasons, states, and primary actions do not overlap or truncate.
- Focus order follows the task and returns to the changed field after validation errors.
- Recording state and uncertainty remain understandable without color, waveform, animation,
  sound, or haptics.
- All actionable controls meet the 44 by 44 minimum target.
- Audio paths and transcripts never appear in app previews, notifications, logs, or raw errors.

## 12. Final Acceptance

The feature passes when all automated commands succeed and native evidence confirms:

- Home and Add both reach voice capture.
- Arabic and English clear transactions reach review and save.
- Every financial change follows explicit confirmation.
- Confidence and required-field rules match the clarified thresholds.
- Multiple selected transactions save all-or-none.
- Category preferences apply only after explicit approval and successful save.
- Temporary audio and transcript content are deleted at the required lifecycle points.
- Every permission, recording, analysis, offline, and save failure retains a usable manual path.
