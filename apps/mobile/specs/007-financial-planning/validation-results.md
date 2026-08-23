# Validation Results: SPEC-007 Financial Planning

Date: 2026-08-10

## Automated Checks

- `npm run typecheck` - PASS
- `npm run lint` - PASS with no warnings
- `npm run check:foundation` - PASS (`596 files checked`)
- `npm run check:financial-planning` - PASS (`596 files checked`)
- Focused salary, budget, obligation, payment, savings, conflict, domain, service, and persistence Jest suite - PASS (`26` suites, `37` tests), without `--forceExit`
- Complete mobile Jest suite - PASS (`262` suites, `595` tests), without `--forceExit`

The convergence pass replaced placeholder forms, connected route identifiers, added category allocation and related-transaction views, localized and masked planning values, restored durable form drafts, enabled conflict resolution, and replaced title-only journeys with behavior checks. The React Query mutation-GC timer in the shared test provider was corrected, eliminating the planning-suite open-handle warning.

## Native Quickstart Evidence

- Android native scenarios (airplane-mode draft recovery, injected atomic-write failure, masking, Arabic RTL, large text): BLOCKED. A physical device (`RK8XB00N33K`) and `com.masarifi.mobile` development build are attached, but Android reports `deviceLocked=1`; the app launched behind the lock screen and UI automation could not access it. T082 remains open. Next executable step: unlock the attached device, relaunch the development build, and execute the SPEC-007 quickstart matrix.
- iOS native scenarios: BLOCKED on Windows because macOS/Xcode is required. T083 records this accepted blocker. Next executable step: run `npm run ios` on macOS/Xcode and capture VoiceOver, RTL/LTR, and large-text evidence.
- The complete native quickstart matrix is therefore NOT COMPLETE; T084 remains open.

## Release Recommendation

Automated frontend, domain, storage, service, route, localization, privacy, and repository-wide regression checks pass. Do not mark native accessibility/platform behavior as released until Android and iOS device evidence is captured.

## Unresolved Risks

- Native device behavior remains unverified.
- Production provider, sync, reminder, email, and bank integrations remain outside Core V1 scope; the validated implementation uses deterministic frontend services.

## R08 Salary UI Re-baseline - 2026-08-16

- PASS: salary overview now uses the shared financial hero and grouped detail rows with privacy masking.
- PASS: unavailable calculation reasons are localized instead of exposing domain codes.
- PASS: salary setup uses the shared account picker sheet and preserves drafts, validation, automatic detection, and save behavior.
- PASS: receipt review uses the existing linked receipt/transaction information without inventing financial values.
- PASS: `6` focused salary/planning suites (`8` tests), typecheck, scoped ESLint, and the financial-planning boundary check.
- PASS: Arabic RTL and English LTR dark-theme Android captures on Samsung `SM-A165F`; hidden values remained masked.
- INTENTIONAL DEVIATION: planned-savings progress is omitted because the Salary contract has no authoritative salary-level savings percentage.
- INTENTIONAL DEVIATION: confirmed receipt amount/source fall back to confirmed status and linked transaction ID when the linked transaction is unavailable from the core-finance provider; no cross-provider fixture or new API was introduced.
- BLOCKED: physical iOS/VoiceOver evidence requires a supported macOS/Xcode host.

## R09 Budgets UI Re-baseline - 2026-08-16

- PASS: current-month overview uses the shared financial hero, grouped details/navigation, masking, and a destructive delete treatment.
- PASS: create/edit forms replace the full category-field wall with the existing category picker and one active category-limit field; every configured category remains in the saved model.
- PASS: create, edit, allocation preview/confirm, transaction filtering, lifecycle actions, drafts, and validation remain on existing services and routes.
- PASS: `6` focused budget/planning suites (`8` tests), typecheck, scoped ESLint, and the financial-planning boundary check.
- PASS: populated English LTR dark-theme Android overview plus compact create-form capture; values remained masked.
- INTENTIONAL DEVIATION: the mockups model one category budget per screen, while the approved production contract models one monthly budget with multiple category allocations; the UI preserves the production model.
- NOTE: one pre-existing asynchronous `PlanningHomeCard` act warning appears when the broader planning suite exits; all assertions pass and the warning is outside the changed Budget composition.

## R10 Obligations UI Re-baseline - 2026-08-16

- PASS: obligation overview uses the shared financial hero and grouped navigation rows while preserving real totals, lifecycle status, detail navigation, and hidden-value masking.
- PASS: create/edit replaces radio-card walls with existing chip selectors and the shared account picker sheet; drafts, validation, automatic matching, and save behavior remain unchanged.
- PASS: detail uses the shared financial hero and grouped status/schedule rows while preserving payment history, reversal, edit, pause/resume, and completion actions.
- PASS: payment entry uses the shared account picker and preserves preview, allocation, confirmation, matching, and recovery behavior.
- PASS: `7` focused obligation/planning suites (`9` tests), typecheck, scoped ESLint, and the financial-planning boundary check.
- PASS: populated English LTR dark-theme Android captures for overview, form, detail, and payment entry; values remained masked and UI-tree accessibility labels matched the visible controls.
- INTENTIONAL DEVIATION: the production obligation model supports multiple schedule kinds, lifecycle actions, reversals, and detected-payment matching beyond the static mockup examples; these existing capabilities remain visible rather than being removed.
- BLOCKED: physical iOS/VoiceOver evidence requires a supported macOS/Xcode host.

## R11 Savings UI Re-baseline - 2026-08-16

- PASS: savings overview uses the shared financial hero and grouped goal rows, preserving real goal targets, status, navigation, and hidden-value masking.
- PASS: create/edit uses the shared account picker sheet while preserving optional account linking, draft recovery, validation, emergency-fund metadata, and save behavior.
- PASS: goal detail uses authoritative progress calculations in the shared financial hero and grouped target/date/status rows; lifecycle and movement history remain intact.
- PASS: movement entry uses compact existing chips and preserves preview/confirm behavior and the explicit tracking-only disclosure.
- PASS: `6` focused savings/planning suites (`8` tests), typecheck, scoped ESLint, and the financial-planning boundary check.
- PASS: populated English LTR dark-theme Android captures for overview, form, detail, and movement; values remained masked and UI-tree accessibility labels matched visible controls.
- INTENTIONAL DEVIATION: overview shows the authoritative active-goal count instead of a summed saved amount because the list contract does not expose current progress for each goal; no duplicate financial calculation was added.
- INTENTIONAL DEVIATION: movement entry does not show mockup-only account or note fields because the existing movement contract is explicitly tracking-only and does not move money between accounts.
- BLOCKED: physical iOS/VoiceOver evidence requires a supported macOS/Xcode host.
