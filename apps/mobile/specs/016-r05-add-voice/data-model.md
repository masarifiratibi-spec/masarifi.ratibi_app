# Phase 1 Data Model: R05 — Add Transaction and Voice Entry

R05 introduces no new persisted financial entity. The models below document existing domain/state ownership and the presentation projections the redesigned screens consume.

## 1. Capture Mode

| Field | Values | Rule |
|---|---|---|
| `mode` | `manual`, `voice` | Exactly one active mode |
| `origin` | Existing Add entry context | Sanitized/current behavior only |
| `hasMeaningfulWork` | Boolean | Switching/leaving invokes the owning guard when true |

## 2. Manual Transaction Draft

Existing fields remain: identifier, transaction type, amount text, source account, destination account, category, merchant/title, notes, occurrence time, status, and update time.

Validation remains feature-owned:

- amount must parse to a currently valid positive minor-unit value;
- required account/title/category or destination rules remain type-dependent;
- transfer source and destination cannot be the same;
- archived/ineligible relationships cannot be silently saved;
- valid fields survive validation failure;
- draft transitions remain `editing → valid → saving → saved` or deliberate `discarded`.

Presentation adds no stored field. It derives field visibility, error focus, selected labels, and local/pending/success feedback from the existing draft and command result.

## 3. Voice Capture Session

Existing state fields remain: session identifier, permission, language, selected validation scenario where development-only, start/timezone, duration, recording reference, transcript, proposal group, and error code.

Allowed presentation transitions:

```text
permission_required → ready
ready → recording → stopping → transcribing → transcript_review
transcript_review → analyzing → proposal_review → saving → saved
any active recoverable state → failed → ready/transcript_review/proposal_review/manual
any non-saved state → canceled
```

Presentation cannot skip transcript/proposal review or trigger financial save from recording/analysis states.

## 4. Voice Transcript

| Field | Meaning | Privacy rule |
|---|---|---|
| `text` | Editable recognized content | Temporary; never included in retained evidence |
| `language` | Arabic, English, mixed, unsupported | Used for explanation, not route selection |
| `confidence` | Recognition signal | Supporting only; not sole user meaning |
| `capturedAt` | Capture time | Locale-aware display where needed |
| `editedByUser` | Correction state | Preserved until save/cancel cleanup |

Audio is deleted after transcription or cancellation. Transcript is deleted after confirmed save or cancellation according to the existing contract.

## 5. Voice Field Assessment

| Field | Values | Rule |
|---|---|---|
| `field` | Existing material/optional voice fields | Identifies the affected control |
| `confidence` | 0–100 | Supporting metadata |
| `status` | `clear`, `confirm`, `missing`, `conflict` | Derived by existing domain rules |
| `reasonCode` | Localized reason key | Required for actionable explanation |
| `confirmed` | Boolean | Required for `confirm` before save |

Thresholds remain: ≥90 clear, 60–89 explicit confirmation, <60 missing; conflict always blocks until resolved. Required unresolved fields block save, optional missing fields follow current rules.

## 6. Voice Transaction Proposal

Existing proposal fields remain: identifier, type, amount/currency, merchant/title, category, payment method, funding account, destination, date, beneficiary, obligation, duplicate relation, notes, assessments, recurring suggestion, selection, status, and category preference.

State transitions remain:

```text
proposed → edited/ready → saved
proposed/edited/ready → removed
```

The redesigned view derives a concise proposal title, unresolved-field count, selection summary, and save eligibility without persisting them.

## 7. Proposal Group

| Field | Meaning | Rule |
|---|---|---|
| `proposals` | One to current maximum proposals | Sibling edits remain independent |
| `status` | reviewing, validating, saving, saved, failed, canceled | One group owner |
| `selectedCount` | Derived | Used to label confirmation scope |
| `saveErrorCode` | Existing failure reason | Raw provider details never shown |

Selected proposals save atomically: all selected records save, or none save and the group remains reviewable.

## 8. Recurring or Obligation Suggestion

Existing choices remain one-time, recurring, existing obligation, and new-obligation handoff, with cadence, candidate identifiers, confidence, and confirmation. The suggestion has no financial effect until current confirmation and owner command succeed.

## 9. Capture Result

Presentation derives one of:

- validation failed — nothing changed;
- canceled — nothing changed and temporary content follows cleanup;
- saved locally/pending sync — confirmed records exist locally but are not yet synchronized;
- synchronized success — confirmed records and downstream projections updated;
- save failed — nothing from the selected atomic group changed and review remains;
- conflict/recovery — existing feature-owned resolution remains required.

## Relationships

- Manual draft and voice proposals reference R02 accounts and R03 categories.
- Confirmed records become R04 transactions.
- Confirmed obligation relationships delegate to R10.
- Home, planning, reports, and notifications consume resulting feature-owned projections; R05 does not update them directly.

