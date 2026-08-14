# T043-T044 Review

## Verdict

- Spec: **PASS**
- Quality: **APPROVED**

## Blocking findings

None.

## Verified

- Notification payload interpolation contains only outcome/count metadata, not transcript text.
- Obsolete helper and test are removed, with no caller under `src`.
- Focused voice hook tests pass: 2/2.
- Current workspace typecheck is blocked only by an unrelated in-progress `NavigationJourney.test.tsx:126` localization-key error outside this slice; the submitted fresh run passed.

## Round 1 fix evidence

- Duplicate outcome now comes from validated proposal state (`voice.duplicate` assessment reason), not fabricated cache scopes.
- Unconfirmed existing-obligation suggestions emit ordinary `saved`; `obligation-link` requires a confirmed existing-obligation proposal with a concrete obligation id/candidate.
- Notification creation is best-effort with an in-flight guard; success marks emitted, failure evicts for retry and does not change owner save truth.
- Tests now cover duplicate from proposal state, unconfirmed obligation negative, confirmed obligation positive, committed save with notification failure staying `saved`, and retrying a failed review notification.

## Round 1 verification

- `npx jest --runInBand src/features/voice/useVoiceCapture.test.tsx`: 3/3 tests passed.
- `npm run typecheck`: passed.

## Round 2 fix evidence

- Duplicate outcome is now typed as `VoiceTransactionProposal.duplicateOfTransactionId`, seeded by real proposal state instead of unconstrained assessment reason text.
- Saved notification creation retries once from the retained source event without invoking the finance owner again; the regression test proves one finance call and eventual one saved notification.

## Round 2 verification

- `npx jest --runInBand src/features/voice/useVoiceCapture.test.tsx`: 3/3 tests passed.
- `npm run typecheck`: passed.
