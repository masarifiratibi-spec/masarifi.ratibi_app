# Quickstart: Validate R05 Add and Voice Capture

## Prerequisites

- Work from the R01 shared-foundation worktree containing `specs/016-r05-add-voice`.
- R01 shared contracts and R02/R03 picker contracts are available before visual integration.
- Use existing representative core-finance and voice fixtures; do not connect a production provider.
- For microphone/device checks, use an Expo development build on a supported Android or iOS phone.

## Automated Baseline

Run from `apps/mobile`:

```powershell
npm run typecheck
npm run lint
npm run check:design-system
npm run check:core-finance
npm run check:voice-capture
npx jest --runInBand src/features/transactions/AddRoute.test.tsx src/features/transactions/TransactionForm.test.tsx src/features/transactions/useTransactionDraftGuard.test.tsx src/features/voice/VoiceCaptureRoute.test.tsx src/features/voice/VoiceCaptureScreen.test.tsx src/features/voice/VoiceRecorder.test.tsx src/features/voice/VoiceReview.test.tsx src/features/voice/VoiceReviewGroup.test.tsx src/features/voice/VoiceRecurringReview.test.tsx src/features/voice/VoiceCaptureRecovery.test.tsx src/features/voice/VoiceCaptureAccessibility.test.tsx src/features/voice/useVoiceCapture.test.tsx src/features/voice/useVoiceCaptureReview.test.tsx
```

Expected: all commands exit successfully; no route, validation, confidence, atomic-save, cleanup, or financial-effect regression.

## Screen-by-Screen Validation

### 1. Add Mode and Manual Form

- Open Add from the tab, Home type shortcuts, account transfer, onboarding, and tracking fallback.
- Verify Manual/Voice selection, current prefill behavior, type-dependent fields, amount-first hierarchy, R02/R03 picker return, keyboard reachability, and deliberate cancel.
- Exercise required-field errors, restored draft, discard, offline/local save, pending sync, success, failure, and duplicate-submit protection.
- Confirm the resulting R04 record and downstream balance/report/planning projections match the existing behavior.

### 2. Voice Permission

- Validate not requested, grant, deny, permanently deny, unavailable, settings return, and Manual fallback.
- Confirm education appears before the system prompt and no recording starts without explicit Start.
- Confirm Android and iOS wording makes no SMS claim.

### 3. Recording and Transcript

- Validate Ready, Start, elapsed time, near/max-duration warning, Stop, Cancel, interruption, no speech, noise, unsupported language, offline, and transcription failure.
- Confirm state remains understandable with waveform hidden and reduced motion enabled.
- Edit the transcript, analyze, re-record, cancel, and switch to Manual.

### 4. Single Proposal

- Validate clear, 60–89 confirmation, below-60 missing, conflict, missing account/category, transfer, income, obligation, date confirmation, category preference, and save failure.
- Verify payment method and funding account are distinct.
- Confirm no save is possible with unresolved required fields and only confirmed displayed values reach R04.

### 5. Multiple Proposals

- Validate 2 and 10 proposals, selection, edit, remove, none selected, mixed validity, Confirm selected, Confirm all, group failure, retry, and success.
- Verify sibling stability and all-or-none persistence.

### 6. Recurring and Obligation

- Validate one-time, recurring, zero/one/multiple obligation matches, existing link, new-obligation handoff, cancel, and failure.
- Verify no relationship or planning progress changes before explicit confirmation.

## Language, Theme, and Accessibility Matrix

For each screen/state group validate:

- Arabic RTL and English LTR;
- light and dark themes;
- normal and 200% text;
- smallest supported phone and one larger phone;
- screen reader focus/name/role/state/value/hint;
- keyboard open and safe-area reachability;
- normal and reduced motion;
- visible and hidden financial values;
- mixed Arabic/English merchant, account, currency, amount, and date content.

## Privacy and Lifecycle Checks

- After transcription, verify audio cleanup.
- After save or cancel, verify transcript cleanup.
- During failure/background/app-switcher states, verify no temporary voice content or hidden value leaks.
- Retained screenshots, logs, XML, and validation evidence must contain only approved safe fixtures.

## Device Evidence

Capture a bounded evidence note per screen group with device/OS/build, locale, theme, text scale, permission/connectivity state, expected result, actual result, and safe artifact path. Android and iOS must each cover their applicable microphone flows; unavailable iOS infrastructure is recorded as blocked and never marked complete.

