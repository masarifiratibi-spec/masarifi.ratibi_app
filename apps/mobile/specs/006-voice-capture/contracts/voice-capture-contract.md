# Contract: Voice Transaction Capture and Smart Categorization UX

This contract defines user-visible route behavior and typed boundaries between the voice UI,
platform recording, deterministic mock analysis, category preferences, obligations,
notifications, and the existing Core Finance ledger. It does not define production speech
recognition, production AI, backend processing, or assistant conversations.

## 1. Route Contract

| Entry | Responsibility |
|---|---|
| `/(tabs)/add` | Show manual and voice capture modes; manual remains the default |
| `/(tabs)/add?mode=voice` | Open the same Add route directly in voice mode |
| Home voice quick action | Navigate to the direct voice-mode Add entry |

The full permission, recording, transcript, analysis, proposal review, and save sequence remains
inside the Add flow. Switching to manual entry clears temporary voice content only after the user
confirms when recorded or reviewed work would be lost.

## 2. Platform Recording Boundary

The implementation provides a replaceable contract equivalent to:

```ts
interface VoiceRecorderService {
  getPermission(): Promise<VoicePermissionState>;
  requestPermission(): Promise<VoicePermissionState>;
  openSettings(): Promise<void>;
  start(input: { maxDurationMs: 60000 }): Promise<VoiceRecording>;
  stop(recordingId: string): Promise<VoiceAudioReference>;
  cancel(recordingId: string): Promise<void>;
  remove(audioReference: string): Promise<void>;
}
```

- Android and iOS use platform-appropriate permission prompts and settings recovery.
- Recording cannot start before `granted`.
- A second start while active is rejected safely.
- The adapter warns before and stops at 60 seconds.
- Cancellation, re-recording, failed transcription, and successful transcription remove any
  temporary audio reference.
- Audio paths and platform errors never leave the adapter as user-visible text.

## 3. Mock Analyzer Boundary

```ts
interface VoiceAnalyzerService {
  transcribe(audioReference: string): Promise<VoiceTranscript>;
  analyze(input: {
    transcript: VoiceTranscript;
    recordedAt: number;
    timezoneOffsetMinutes: number;
  }): Promise<ProposalGroup>;
}
```

The mock implementation provides named deterministic scenarios for clear single transaction,
missing account, unknown merchant, multiple transactions, income, transfer, obligation payment,
failed analysis, low confidence, unsupported language, and no speech. It makes no network or
provider call and exposes no production-AI claim.

## 4. Capture Lifecycle Contract

1. Voice mode explains microphone use and shows manual fallback.
2. The app requests permission only after user action.
3. Start creates one session and captures local date and timezone.
4. Stop closes recording and requests transcription.
5. Successful transcription deletes audio before transcript review is considered complete.
6. The user may edit the transcript, analyze it, re-record, switch to manual, or cancel.
7. Analysis creates one Proposal Group with one or more proposals.
8. No financial change occurs until the selected proposals validate and the user saves.
9. Save or cancellation clears transcript, proposals, and all other temporary session data.

Backgrounding, calls, permission revocation, audio errors, and maximum duration transition to an
explicit recoverable state and cannot create a proposal or transaction silently.

## 5. Confidence and Required-Field Contract

- Material fields at 90-100% appear clear.
- Material fields at 60-89% are highlighted with a localized reason and require explicit field
  confirmation.
- Material fields below 60% are treated as missing and require user entry when necessary.
- Conflicting candidates require correction regardless of score.
- Amount, currency, type, and resolved date are required for every save.
- Existing Core Finance validation remains authoritative for account, category, transfer, note,
  and obligation fields.
- A missing analyzed account may be suggested or selected. Save without an account is shown only
  when the existing ledger contract permits it; SPEC-006 does not create a hidden account or make
  shared account references nullable.
- Missing optional values do not block save.

Confidence meaning never relies on color, percentage, icon, waveform, or motion alone.

## 6. Date Contract

- Relative dates resolve against `recordedAt` and `timezoneOffsetMinutes`, never the later save
  time.
- Review always displays the resolved date.
- Ambiguous, future, or out-of-range dates require explicit confirmation or correction.
- Changing the device timezone after recording does not silently recalculate the proposal.
- Date and time use existing locale-aware formatters with English numerals.

## 7. Review Contract

- Each proposal appears independently with type, amount, currency, merchant or beneficiary,
  category, payment method, funding account, date/time, recurring or obligation intent,
  confidence reasons, and missing fields where applicable.
- Payment method and funding account use separate labels and controls.
- Users may edit, remove, select, or deselect each proposal.
- Group actions support Confirm selected, Confirm all, Re-record, Manual entry, and Cancel.
- Removed and unselected proposals never enter the ledger.
- A failed validation or save preserves transcript corrections, proposals, selections, and
  confirmations for recovery.

## 8. Atomic Financial Save Contract

The existing Core Finance boundary gains an operation equivalent to:

```ts
createTransactionsAtomically(
  inputs: readonly TransactionInput[],
  operationId: string,
  source: 'voice'
): Promise<MutationResult<Transaction[]>>;
```

- Every selected input is validated before a write starts.
- All selected transactions and confirmed linked effects commit in one SQLite transaction or
  none persist.
- The Proposal Group ID is the operation ID. A successful retry returns the original result and
  does not duplicate records.
- Every created transaction has `source: voice` and uses existing integer minor-unit money,
  account, category, status, sync, and ledger-effect rules.
- Success invalidates only affected existing query scopes. Failure invalidates nothing and does
  not claim a balance, budget, report, notification, or obligation update.
- Raw database and internal errors map to safe localized recovery codes.

## 9. Smart Category Contract

Suggestion resolution order is deterministic:

1. User-approved merchant-category preference.
2. Known merchant fixture.
3. Keyword fixture.
4. Smart mock suggestion.
5. User selection when unresolved.

When a user changes a category, `only_this_time` updates only the proposal,
`always_for_merchant` writes or updates the normalized preference after save succeeds, and
`not_now` preserves the corrected proposal without a future preference. Archived or missing
categories cannot be suggested from a preference.

## 10. Recurring and Obligation Contract

- Monthly, weekly, installment, subscription, rent, and loan language may produce one-time,
  recurring, existing-obligation, or new-obligation suggestions.
- No recurring record, obligation, or link is created without preview and explicit confirmation.
- Multiple obligation candidates require selection.
- A confirmed existing-obligation payment uses the existing obligation-effect boundary and
  commits with the related transaction.
- New-obligation creation is handed to SPEC-007's review flow and is not duplicated here.

## 11. Permission, Offline, and Error Contract

Safe states cover not requested, granted, denied, permanently denied, unavailable, interrupted,
maximum duration, no speech, background noise, unsupported language, transcription failure,
analysis failure, offline, invalid proposal, save failure, and unknown failure.

Each state maps to the applicable Request, Retry, Open settings, Re-record, Edit transcript,
Manual entry, or Cancel action. Voice analysis does not queue audio while offline. Manual entry,
Home, accounts, tracking, and transactions remain usable.

## 12. Privacy Contract

- Audio exists only in app-private temporary storage until transcription completes or the user
  cancels.
- Transcript and proposal content exist only until save or cancellation.
- Only confirmed financial values, `source: voice`, and an explicitly approved category
  preference persist.
- Audio, transcript, file paths, confidence payloads, and financial values are excluded from
  analytics, logs, notifications, app previews, and raw errors.
- Accessibility announces reviewable on-screen content only while the user is intentionally in
  the voice flow and respects global sensitive-value settings.

## 13. Query and State Ownership

TanStack Query continues to own accounts, categories, Home summaries, transactions, and future
obligation records. Zustand owns only the active unsaved Voice Capture Session and clears it at
the required lifecycle boundaries. SQLite owns confirmed transactions and category preferences.
No financial record is mirrored in the voice store.

## 14. Localization and Accessibility Contract

- Every visible and accessible string exists in Arabic and English catalogs.
- Arabic uses RTL and English uses LTR; merchant, beneficiary, account, currency, amount, and date
  combinations receive intentional mixed-direction handling.
- Recording status is announced through text and accessibility state, not waveform, color,
  sound, motion, or haptics alone.
- Controls expose name, role, state, error, and action and measure at least 44 by 44.
- Focus follows permission, recording, transcript, uncertainty, proposal, and save feedback in
  logical order.
- The flow remains usable at 200% text, reduced motion, open keyboard, grayscale, small phones,
  large phones, tablets, and light/dark themes.
