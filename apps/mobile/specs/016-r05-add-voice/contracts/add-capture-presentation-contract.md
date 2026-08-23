# UI Contract: R05 Add and Voice Capture

This is a typed presentation boundary. Existing domain, service, adapter, and repository contracts remain unchanged.

## 1. Add Route Contract

- Route remains `/(tabs)/add` with current supported mode/type/account/origin context.
- Exactly one of Manual or Voice is active.
- Mode selection is localized, non-color-only, keyboard/screen-reader reachable, and resilient at 200% text.
- Mode switch asks the owning manual/voice guard to resolve meaningful work; the route does not discard state itself.
- Confirmed results use existing R04 navigation and affected-scope behavior.

## 2. Manual Form Contract

The screen receives existing queries/draft state and callbacks for type, fields, picker opening, save, and deliberate cancel. It presents:

1. mode;
2. supported transaction type;
3. amount/currency;
4. title/purpose;
5. source account;
6. category or transfer destination;
7. occurrence date/time and contextual relationships when currently supported;
8. one primary Save action and one low-emphasis cancel path.

The UI never parses financial meaning beyond the existing form/domain contract. It preserves errors per field, valid input, selection return context, loading, local/pending, success, and failure.

## 3. Voice Permission Contract

Input states: not requested, granted, denied, permanently denied, unavailable.

Presentation supplies localized benefit, data used, denial consequence, temporary-data statement, and Manual fallback. Callbacks remain request permission, open settings where valid, retry where valid, cancel, and switch to Manual. Recording cannot start from this contract.

## 4. Recorder Contract

Inputs: ready/recording/stopping state, elapsed duration, maximum-duration warning, reduced-motion preference, and callbacks.

- State text and elapsed time are authoritative.
- Waveform/activity is decorative and hidden from accessibility.
- Start, Stop, and Cancel use existing commands and prevent duplicate activation.
- No financial record exists in recorder states.

## 5. Transcript and Processing Contract

- Transcript text is visible and editable before analysis.
- Analyze, re-record, cancel, and Manual are feature-supplied callbacks.
- Transcribing/analyzing states preserve geometry and announce concise progress.
- Failure states expose only mapped recovery and never raw provider errors.
- Re-record/cancel invokes existing temporary-content cleanup.

## 6. Proposal Contract

Each proposal presents selection, current structured values, field-specific assessments/reasons, relationships, remove, and correction callbacks.

- Type/payment choices remain compact and accessible.
- Account/category selection uses R02/R03 picker contracts.
- Required unresolved or conflict state exposes `saveEligible=false` and the first actionable field.
- Confidence percentage is never the sole explanation.
- Category preference and recurring/obligation effects require explicit current choices.

## 7. Proposal Group Contract

- Group exposes total, visible, selected, invalid, and unresolved counts as derived presentation values.
- Confirm selected and Confirm all state exact scope and invoke the existing atomic save command.
- One proposal's edit/remove does not mutate siblings.
- Failure preserves the reviewed group; success yields confirmed R04 records.

## 8. Result and Recovery Contract

Every result states:

1. what happened;
2. what financial data changed or did not change;
3. whether the result is local/pending or synchronized;
4. the valid next action.

Canceled, permission, recording, transcription, analysis, validation, and failed atomic-save outcomes create no transaction.

## 9. Direction, Accessibility, Motion, and Privacy

- Arabic RTL and English LTR expose identical content and actions.
- Amount/currency/date/reference runs use shared formatters and English numerals.
- Focus order follows mode → active state → content/fields → recovery → primary action.
- Controls meet 44×44 minimum; content reflows at 200%; keyboard and safe areas keep the active field/action reachable.
- Reduced motion removes nonessential waveform/transition movement.
- Audio/transcript/hidden financial values are excluded from accessibility leaks, errors, analytics, screenshots/evidence, notifications, and app-switcher presentation.

## 10. Ownership Matrix

| Concern | Owner |
|---|---|
| Shared component behavior | R01 |
| Account/category selection data and eligibility | R02/R03 |
| Manual draft and transaction creation command | Existing core-finance feature / R05 presentation |
| Voice permission/session/proposal/save/cleanup | Existing voice feature / R05 presentation |
| Confirmed ledger record | R04 |
| Automatic SMS capture/review | R06, not R05 |
| Obligation management and progress | R10 |

