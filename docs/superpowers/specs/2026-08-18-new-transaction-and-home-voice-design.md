# New Transaction and Home Voice Design

## Scope

This change has two connected outcomes:

1. Replace the Add tab's dense manual/voice form with the approved mobile-style manual New Transaction flow on web and native.
2. Make the Home voice shortcut the only production entry into voice capture, then return a saved voice transaction to Home so it appears in recent activity and updates the correct income or expense total.

The work preserves existing financial services, validation, formatting, persistence, voice permissions, transcription, analysis, review, and save logic. It does not redesign transaction editing, delete supported transaction types, or introduce a second design system.

## Selected approach

Use the existing transaction form, draft repository, pickers, date controls, voice state machine, and Masarifi tokens. Separate route ownership instead of creating a new global form store:

- `/(tabs)/add` becomes manual-only.
- A dedicated voice route owns recording, processing, review, and completion.
- Existing full-route account and category pickers are adapted for New Transaction and use the existing manual draft as the handoff contract.
- Existing non-Add obligation and refund capabilities remain intact.

This is preferred over retaining a hidden voice mode in Add, which would preserve the current coupling, and over introducing a new global transaction store, which would duplicate the existing draft mechanism.

## Manual New Transaction

### Structure

The Add screen follows the approved reference while using the current Masarifi theme:

- A safe-area header with mirrored close/cancel and confirm actions and a centered localized title.
- One equal-width segmented row containing only Expense, Income, and Transfer.
- A large centered amount editor with the selected source account's real currency code. Existing amount parsing, financial typography, precision, and validation remain authoritative.
- Rounded selection cards for Category and Account using existing category and account visuals, names, currencies, and disclosure affordances.
- Rounded fields for Description, optional Note, and Date.
- The existing platform-specific `TransactionDateField` remains the date implementation: native picker on native platforms and native HTML date input on web.

The existing Edit Transaction experience keeps its behavior. Shared presentation may be reused where that reduces duplication, but the task must not change edit semantics.

### Transaction types

The Add selector and manual Add route expose only Expense, Income, and Transfer. Refund and Obligation Payment remain supported by their domain schemas, services, voice review, edit behavior, and dedicated non-Add flows. The More obligation entry must lead to the existing obligations flow rather than reopening Add with a hidden type. Unsupported Add query parameters fall back safely to Expense.

### Form state and saving

The existing `manual-entry` draft remains the single persistence mechanism. It must store and restore the complete manual form: type, amount, source account, destination account, category, description, note, and occurred-at date.

Before opening a picker, the current form is persisted immediately. On picker selection, the relevant draft field is updated and the picker returns to Add. Add refreshes from the draft on focus, so state survives picker navigation on web and native without passing callbacks through routes.

Manual save continues through the current core finance service, query invalidation, error mapping, duplicate-save guard, and draft discard behavior. Transfer continues to require a destination account and carries no category. Successful manual save retains the current Transactions destination unless an existing product rule already chooses another destination.

## Full-screen pickers

### Category picker

The Category picker is a full-screen route with a safe-area header, close/back action, localized title, search, and two data-backed sections:

- **Most Used**: the user's currently favorite active categories (`isFavorite === true`).
- **Other**: all remaining active categories.

Search filters both sections using the existing localized category projection and search matcher. The picker uses real category icons, colors, hierarchy labels, loading, empty, and error states. If there are no favorites, the Most Used section is omitted rather than filled with synthetic content.

### Account picker

The Account picker is a full-screen route with a safe-area header, search, and the existing real active-account rows. Each row keeps the account visual, localized name, currency, masked/revealed balance behavior, selected state, and disclosure affordance. Loading, empty, search-empty, and retry states remain available.

Both pickers mirror correctly in Arabic RTL and English LTR and retain minimum native touch targets.

## Voice entry and completion

### Entry ownership

All Voice UI and the Manual/Voice toggle are removed from Add. The Home voice shortcut becomes the only production entry. The duplicate More voice entry is removed. Onboarding demonstrations and the assistant remain outside this change unless they directly invoke the production voice capture route.

### Recording and processing

Tapping Home Voice opens the dedicated route and starts recording immediately when microphone permission is available. Permission-required, denied, permanently denied, unavailable, and retry/settings states continue to use existing permission services and localized error handling.

During recording, the screen shows a compact focused state with elapsed time and a large accessible stop control. Stopping transitions through the existing transcription and analysis services automatically. While those operations run, a centered processing modal/overlay is shown over a dimmed recording surface. Duplicate taps cannot start, stop, analyze, or save twice.

After analysis, the existing voice review and confirmation UI is shown. The normal path does not stop at a separate transcript-review screen; the transcript and parsing services remain unchanged and the review continues to expose the existing editable proposal fields and validation.

### Save and Home update

After the user confirms and the existing save operation succeeds:

- Core finance queries are invalidated through the current mechanism.
- The voice route replaces itself with `/(tabs)/home`.
- Home displays the new transaction in recent activity.
- Home income or expense totals update from the saved transaction type selected by voice analysis. Transfer and obligation results retain their existing domain behavior.

Save failures remain on the review screen with the current recoverable error path. No navigation occurs until persistence succeeds.

## Visual and interaction direction

The supplied New Transaction reference controls hierarchy and composition; the existing Masarifi design tokens control palette, typography, radii, financial colors, focus states, and contrast. The memorable focal point is the large amount and currency, followed by full-width rounded picker cards. The implementation must not import the reference's cyan palette or recreate separate web styling.

The surface is Operate mode: one-handed scanning, clear primary action, progressive disclosure, no decorative filler, no fabricated account/category content, and no Unicode glyphs used as icons. Web and native render the same information architecture with platform-honest date, safe-area, keyboard, back, focus, and permission behavior.

## Error handling and accessibility

- Preserve the existing unsaved-draft close guard.
- Keep semantic button, radio/segment, textbox, search, and list-row roles and localized accessibility labels.
- Maintain at least 48 dp Android and 44 pt iOS touch targets.
- Financial meaning is conveyed by labels and transaction type, not color alone.
- Amount and currency never truncate or separate at supported text scales.
- Picker loading, empty, no-results, and retry states remain explicit.
- Processing blocks duplicate actions while still exposing an accessible progress label.

## Verification

Focused automated coverage must verify:

- Add is manual-only and exposes exactly Expense, Income, and Transfer.
- Initial supported type/account prefills still work and unsupported Add types fall back safely.
- Draft restoration includes note and date and survives round trips through both picker routes.
- Category favorites appear under Most Used and remaining categories under Other in Arabic and English.
- Account/category selection returns to the populated form.
- Home Voice targets the dedicated route; More and Add do not expose Voice.
- Voice autostarts when permission is granted, shows recording and processing states, reaches existing review, guards duplicate actions, and returns Home only after a successful save.
- The saved voice type affects the correct Home income or expense aggregation.
- Web and native date controls, RTL/LTR layout, accessible labels, and minimum touch targets continue to pass focused tests.

Run the focused transaction, picker, Home, voice screen, voice hook, route, date, localization, and accessibility tests, followed by the mobile TypeScript check. Perform one bounded visual inspection on web and representative mobile dimensions when the available browser/test surface permits it.

## Explicit non-goals

- No rewrite of transcription, parsing, AI analysis, proposal validation, persistence, notification, or obligation logic.
- No new global transaction state library or dependency.
- No redesign of Home, Transactions, Edit Transaction, assistant, onboarding, or obligation detail/payment screens.
- No deletion of Refund or Obligation Payment domain support.
- No commit, push, server restart, or unrelated cleanup as part of this task.
