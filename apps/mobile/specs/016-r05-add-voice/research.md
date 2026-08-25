# Phase 0 Research: R05 — Add Transaction and Voice Entry

## Decision 1: Keep one Add route and one active mode

**Decision**: Preserve `app/(tabs)/add.tsx` as the only capture route. Manual and Voice remain mutually exclusive presentations selected by route state; switching or leaving delegates to the existing manual-draft and voice-session guards.

**Rationale**: This preserves the five-tab shell, all current entry points, and one mental model for capture without parallel routes or duplicated state.

**Alternatives considered**: Separate Manual and Voice routes were rejected because they would change route meaning and complicate origin/draft recovery. Showing both workflows together was rejected because it increases cognitive load and keyboard pressure.

## Decision 2: Reuse R01 controls and installed platform capabilities

**Decision**: Build the redesign from the current focused form, segmented choice, picker row, state feedback, overlay, amount/date, privacy, and motion contracts. Keep the current recording and permission adapters; add no UI, animation, sheet, or audio dependency.

**Rationale**: R01 now supplies the needed presentation roles and the current Expo/React Native stack already covers recording, settings recovery, animation, safe areas, and accessibility.

**Alternatives considered**: A third-party form wizard, waveform, or bottom-sheet package was rejected because it adds lifecycle and accessibility risk without a missing capability.

## Decision 3: Preserve feature-owned state machines

**Decision**: `TransactionForm` remains the manual draft/save owner and `useVoiceCapture` plus the current voice store/services remain the voice-session owner. Presentation components receive state and callbacks; they do not recreate validation, confidence, permission, save, or cleanup rules.

**Rationale**: One owner prevents presentation drift, duplicate server-shaped state, and accidental financial changes.

**Alternatives considered**: Moving capture state into the route or a second UI store was rejected because it duplicates existing tested ownership.

## Decision 4: Use one shared field hierarchy for manual and proposal review

**Decision**: Manual entry and voice proposals share the visual order type → amount/currency → title/merchant → account → category/destination → date → contextual relationships. They reuse R02/R03 pickers, but manual and voice retain their separate commands and validation.

**Rationale**: Users correct voice proposals faster when the field grammar matches manual entry, while ownership remains clear.

**Alternatives considered**: Keeping long inline radio-card lists was rejected for density and 200% text. A generic dynamic form engine was rejected as unnecessary abstraction.

## Decision 5: Make the existing voice lifecycle visible, not longer

**Decision**: Present the current sequence as explicit screen states: permission → ready/recording → transcript → analyzing → proposal review → save result. Processing replaces the active content rather than stacking every prior step; valid transcript/proposal state remains preserved by the existing owner.

**Rationale**: The state machine already exists. Clear progression improves trust without adding steps.

**Alternatives considered**: A new multi-page wizard was rejected because it changes navigation and back behavior. A single continuously expanding page was rejected because it creates focus and large-text problems.

## Decision 6: Explain uncertainty by field and reason

**Decision**: Keep current confidence thresholds and render field status/reason adjacent to the relevant control. Percentages may be supporting metadata but never the only explanation. Save focuses or announces the first unresolved required field.

**Rationale**: This preserves tested validation while making uncertainty actionable and accessible.

**Alternatives considered**: One overall confidence meter was rejected because it hides which value needs correction. Danger styling for every uncertain field was rejected because review is not system failure.

## Decision 7: Keep group save atomic and scope actions explicitly

**Decision**: Multi-proposal review keeps independent proposal selection/edit/removal and existing all-or-none save. Confirm actions include selected count/scope; failed save preserves the complete reviewed group.

**Rationale**: This is the smallest presentation change that protects the current financial guarantee.

**Alternatives considered**: Saving proposals one at a time was rejected because it changes atomicity and recovery. Nested cards for every field were rejected because they obscure group scope.

## Decision 8: Keep recurring and obligation effects behind owner handoffs

**Decision**: R05 shows the current one-time/recurring/existing/new-obligation decision and invokes existing R10 handoff/commands only after confirmation. R05 never creates its own obligation model or calculates progress.

**Rationale**: The user sees the consequence while the feature owner remains authoritative.

**Alternatives considered**: Inline obligation management was rejected because it duplicates R10. Automatic linking without confirmation was rejected by the constitution and current rules.

## Decision 9: Keep demo scenarios out of normal capture presentation

**Decision**: Retain representative scenario selection only in the existing development/validation context, guarded with the project's built-in development flag. The normal Add screen starts from real permission/recording state.

**Rationale**: Test coverage remains available without presenting internal fixtures as product UI.

**Alternatives considered**: Deleting scenario support was rejected because it would reduce validation. Leaving it permanently prominent was rejected because it conflicts with the approved redesign and real user task.

## Decision 10: Validate privacy at lifecycle boundaries

**Decision**: Keep current audio/transcript deletion points and add focused assertions and device checks for cancel, re-record, successful save, failed analysis, failed save, backgrounding, screen-reader output, hidden values, and app-switcher privacy.

**Rationale**: Voice content is more sensitive than ordinary presentation and privacy failures can occur outside the happy path.

**Alternatives considered**: Relying only on service unit tests was rejected because visual/accessibility/app lifecycle outputs also need proof.

## Resolved Technical Context

- No unresolved clarification remains.
- No new persistence entity, service contract, permission, route, provider, or dependency is required.
- Current manual draft, voice session, proposal, and category-preference repositories remain authoritative.
- Existing Android/iOS microphone behavior remains behind the current platform adapter; Android SMS remains outside R05.

