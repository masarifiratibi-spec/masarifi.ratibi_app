# Mobile and Admin UI refinement

The human requests an autonomous UI audit and repair of the current mobile app and dashboard, starting with the still-visible Reports bottom obstruction. Preserve the Masarifi identity, original financial data and 2026-13 draft, current account/device/APK, and current Metro launch. Continue independently eligible outstanding tasks. ZIP remains cancelled.

This is Operate-mode refinement of the existing Gulf Premium system. Teal/bronze, approved fonts, radii, financial semantics, native SymbolView icons and web Lucide icons remain the visual authority. A new visual world, new dependencies, invented financial content and a generic architecture rewrite are outside this design.

## Evidence and chosen approach

The phone shows a large empty PDF dock below the Reports scroller. Its normal-flow reservation duplicates a bottom inset while the action is absolutely positioned. The earlier check proved reachability of the bottom content, but missed this visual obstruction. Dark Reports mixes white cards with dark-theme labels and a nearly invisible header. Accounts similarly forces a light list canvas. Existing dark financial foreground roles have contrast below 2.5:1 on their card surface.

The authenticated dashboard at 390px shows unnamed Refresh/Export buttons because responsive CSS hides their entire text spans. Its toolbar breaks related actions across rows, the sign-out label wraps in the compact header, and navigation reuses Activity for unrelated meanings. The existing feedback destination is absent from the live menu despite having a protected working route.

Three export arrangements were considered: retaining the reserved footer, making it a transparent overlay with compensating padding, and placing a labelled secondary export action in the normal document flow. Choose the last: it removes the blank footer and overlap risk, scales naturally with text, and leaves the existing one-tap PDF state machine unchanged. Its feedback remains inline and scrollable.

Use the established semantic theme roles for page/card/text/financial foregrounds, drawing any contrast correction from the existing palette. Use a 48dp shared native target floor and wrapping controls. Mirror only directional icons. On web, retain visible action labels where possible, always provide accessible button names, group related toolbar commands, and use distinct existing-family navigation symbols. The feedback link retains its existing read permission; no role or access policy changes.

## Acceptance

- Reports has no permanent bottom export reservation or absolute PDF control; data and feedback remain reachable at normal/200% text, AR/EN and both themes.
- The same input/operation identity, owner/scope cancellation, save-before-success and retry guards remain covered by the existing PDF tests. No new hosted PDF/provider request is needed for visual qualification.
- Header, account canvas, report cards, financial values and muted text have readable semantic foreground/background pairs. Amounts and their currency remain intact.
- Compact dashboard commands have names, keyboard focus and practical touch targets; header and filters fit 390/768/desktop layouts without hiding meaning.
- Existing route guards and denied navigation remain enforced, including feedback. Hidden Savings, deferred routes and protected operations remain gated.
- Actual-device evidence is private. Public evidence records findings, changes, commands and limitations without customer or financial content.

The human explicitly delegated routine design and implementation decisions and opted out of a design-question round. These implementation choices are the agent's decisions under that instruction, not claims of separate visual approval. Reversible local checks and GitHub publication retain the existing authorization; hosted deployment must preserve its established configuration/security boundaries.
