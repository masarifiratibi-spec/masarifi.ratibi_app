# Stashes 4–6 and residual source-history review

Reviewed candidate: `3bd0c5d3149259ad69fb6a5e86083a820052b7f4` (Tracking). Repository: `D:/MY Work/0Part_Time/MASREFY _Final`. This report compares immutable Git objects, not ongoing recovery worktree edits. All Git commands used `GIT_OPTIONAL_LOCKS=0`. No repository source/ref/index/stash/checkout changes, test runs, repository script execution, package installs, database/service calls or deployments occurred. Only these report artifacts were written, in the authorized visualization directory.

**One verified product delta needs integration:** Home transaction cards no longer reflow at large text. Everything else in stash 6 is already carried or behaviorally superseded. The residual source-history test setup is present. Stashes 4/5 contain no missing product runtime feature. Seventy-five absent historical developer-tooling files require an archival/modernization decision, separate from product recovery.

| Classification | Relevant paths |
|---|---:|
| ALREADY INCLUDED | 89 |
| SUPERSEDED | 93 |
| INTEGRATE | 2 |
| NEEDS DECISION | 75 |
| Total | 259 |

Counts are path classifications, not feature counts: the two INTEGRATE paths represent one feature and its acceptance test. Relevant paths comprise stash 6:171 tracked plus9 third-parent source/tests; stash 4:one active-feature configuration plus77 developer tools; residual source-history hunk:one test path. The JSON lists all259 rows with blob identities, proof groups and retained-line supporting evidence, plus all490 third-parent paths (including historical screenshots/logs/docs).

## Exact carry proof

Stash 6 is `7dd099290eced31f2664dd6c47ee9d2bd9793da4`. Its first parent and integration commit `0ca7c9c8e222d5e2bbbd89551df8ce90b6ed9eeb` first parent are both `cebf3b5f1f627b4ac968a13c07cd79e02547d48b`. For every171 tracked changed path, the stash-tip blob/deletion equals the0ca integration tree. All nine relevant third-parent blobs also equal0ca. Thus all180 original source/config/test states were carried exactly, before subsequent changes. `git merge-base --is-ancestor` confirms0ca is an ancestor of Tracking. This establishes provenance, not automatic present-day supersession; present code and test behavior were also compared.

Thirty tracked and four third-parent relevant blobs remain byte-identical in Tracking. The remaining146 paths were examined against the stash delta/current behavior; newer code is only classified superseded where an actual replacement is identified below. Significant-added-line containment is recorded as supporting evidence, not as proof of semantics or runtime correctness.

## Verified missing delta and test change

Stash 6 `apps/mobile/src/features/home/HomeSummary.tsx` removed single-line truncation of transaction title, category and account labels at `largeText` (`PixelRatio.getFontScale() >= 1.5`) and retained stacked cards. Its `HomeScreen.test.tsx` hunk adds an explicit undefined `numberOfLines` expectation to the existing Arabic/English200% reflow case. Both states are carried exactly at0ca.

Tracking `HomeSummary.tsx` now delegates to `apps/mobile/src/features/transactions/TransactionCard.tsx` without `groupedPosition`. There `fixedHomeCard = testIDPrefix === 'home' && !groupedPosition` disables the large-text stacking branch, keeps `height/minHeight:84`, and sets title/meta/account to one line. The current test at approximately `HomeScreen.test.tsx:823` is called **“keeps Home transaction cards fixed at 200%% text in %s”** and asserts fixed84 and title `numberOfLines:1`; the prior case asserted stacking and no line cap. The later carried change is `3d422e391140c568f9b246b940bbda6d6614a151`, source equivalent `4d1f0dd1373f87500c3a075823d74262683e0a52`. This is a test change that normalizes lost accessibility behavior, not proof of a replacement that preserves it.

**INTEGRATE narrowly:** let current shared TransactionCard reflow/wrap at font scale>=1.5 while preserving normal-scale layout and current Savings/UI. Restore/add long-title, long-category and long-account Arabic/English200% acceptance. Do not copy old HomeSummary wholesale. Parent confirmed its recovered contained Home cards still lack `groupedPosition`; recovery alone does not remove this failure. Parent owns implementation; this report does not claim the fix is complete.

No other missing product behavior or missing stash test delta was verified. Tests were inspected but not executed. Physical rendering on a device remains unverified.

## Current equivalents that must be preserved

- **Google/auth:** old phone/OTP/chooser routes and synthetic production flow are removed. Current Clerk Google entry, auth-pending/native callback, dynamic registered-live auth provider and session controller handle real identity and recovery. Commits `4ef25688c737d33227a4c3dca5bc853e792f25e6`, `17a70ff2ec2a7091f78e1a750a5b7a651ff11713`, `150dfd6bc08a599ec90df37b4369db94ac2e252d`. Relevant current tests: GoogleAuthScreen, AuthPendingRoute, NativeSSOCallback, session-controller, ProtectedNavigation. Restore none of the deleted old phone/OTP/chooser files.
- **App PIN/lock:** current validated PinCredential, salted PBKDF2-SHA256120000 iterations,16-byte salt/32-byte verifier and constant-time comparison preserve the one-way PIN intent. Old plaintext `pin:` verification/migration is deliberately rejected. Biometric lock/PIN fallback and current PinSetup/Unlock recovery replace the old hash-property/confirm flow. Commit `2451e90b5580d034d4c5484322baed844c213092`. Current privacy-lock/PinSetup/domain schema tests cover credentials, differing salts, invalid/legacy/tampered payloads. Do not reintroduce legacy acceptance.
- **Navigation/sign-out:** current gate sanitizes return destinations, legal-only bypass, first-launch/profile hydration and verified lock recovery. The old broad public/unlock allowlist would regress it. Sign-out now releases encrypted owner-bound database/import queue, clears identity/transient cache and leaves user finance under owner isolation; old broad deletion and redirect to removed language page would regress current behavior. More and NavigationJourney retain Savings `/savings` and current relocated notification preferences.
- **Financial dates/data:** cycle range containing the reference date, minute/second-aware timezone conversion with formatter cache, deleted-transaction default exclusion, runtime/repository resets, contract live-provider allowances and financial-planning injected clock/readTransactions are carried. Settlement preview stores expectedVersion and amount; invalid installment inputs reject. Current schema advances9->15 while retaining the per-version transaction loop; profile persistence is owner-scoped/keyed. Do not downgrade schema or reset semantics.
- **Drafts/accounts:** shared usePreventRemove discard/gesture guard now returns requestClose/leaveAfterSave and awaits discard; current tests invoke the gesture callback explicitly. Configured baseCurrencyCode default remains. Credit due day is now an actual persisted field validated1..28, superseding the old test that a fake field must be absent. Currency mismatch validation retains an explicit unchanged-legacy-boundary edit exception; new changes still enforce source/destination currency. Preserve current credit/refund/payoff/durable manual submission behavior.
- **Live services:** production core-finance, exchange-rate and identity/settings providers now use live owner-aware endpoints; demo fixture factories remain gated. Missing exchange endpoint cross-currency stays unavailable. The old empty-profile/no-sessions/privacy-unavailable wrapper is superseded by server identity functionality, rather than restored as production. Mock/profile resets remain available to demo tests.
- **SMS/native privacy:** stash disabled READ_SMS until ingestion existed. Current native Android inbox module implements that ingestion and requests READ_SMS after consent, does not request RECEIVE_SMS, and keeps backup disabled. Platform privacy/permission tests assert those exact conditions. Commit `b084d20a06948aa2c93f9cac76120698876c7a1b`. Old all-platform-unavailable tests must not replace implemented consent-gated ingestion.
- **Voice:** old hook cleanup moved to persistent VoiceCaptureRuntime; failed cleanup references retained for retry, recorder releases ownership, retains discarded audio for retry and bounds native preparation/completion/file checks. Current useVoiceCapture test still asserts private cleanup retry/removal twice. The thin adapter file is not evidence of missing cleanup. Keep current queue/runtime/typed captured-audio behavior.
- **RTL/large font:** native/web-safe layoutDirectionStyle replaces raw direction (commit `d7438e5aa8f5b3662945bd4d2bb0595402f74d5e`). MenuLink explicitly mirrors RTL once. Account/CurrencyRow/Assistant title/question/Home empty state/transaction list use undefined line cap at>=1.5; category rows wrap at all sizes. DateRangeSheet option labels retain no line caps. Locale/200% tests remain. Home fixed cards are the exception identified above.
- **Reports/support/mock resets:** original route availability handling, large-text report drill-down/journey coverage, profile storage and cache/repository reset callbacks remain (some exact blobs). No absent report behavior from these stashes was found. Parent separately audits dirty Voice worktree reports; that broader work is not claimed here.

## Stashes 4 and 5: tooling and historical material

Stash4 `1f3f5d16596702b06ee128713f5cfb7dd0ccb5f3` has12 tracked changes: one feature pointer012 and11 historical documentation deletions. Tracking active feature is017 safe remediation (`4667b5b6a0b65012dbe77513fec43b44393cbc02`); both012/017 specs remain. Copying the old pointer would change development metadata, not recover product behavior. Third parent has457 files:51 vendored skills/helpers,24 root capture/inspection/demo scripts,2 mockup scripts and380 historical assets/docs/capture outputs.

The51 skill files and24 root scripts are absent from Tracking. All77 tool contents were read. Twenty-three root scripts use Playwright and hardcoded localhost8081; the remaining `make_demo.js` writes old `more-demo.tsx` in a hardcoded obsolete worktree. No equivalent is asserted for these75 paths: **NEEDS DECISION**, archive or deliberately modernize them separately. Missing developer tooling is not a missing mobile feature. Do not execute old scripts while recovering source, and do not install old vendored agent instructions automatically.

Current mockup generator retains screen inventory/fonts/bilingual output/back-arrow mirroring and updates transactions with seeded OpenMoji/category visuals, metrics/account labels/grouping. It supersedes the stash generator (`43f947cf5c64f2b74e75b5d7389232a845ebd19e`, `4d9d4e289dfa7061810cadba4647e296334cc126`). Bilingual verification script is byte-identical in Tracking. Historical screenshots and logs can remain in preservation archives; they do not prove tests currently pass.

Stash5 `97be511e0bfef1ea076383ffddfc3e9cceded126` has zero tracked changes and nine third-parent files, all device/Jest/Metro capture logs or screenshots. No source/config/test code exists there; no integration candidate. Historic log output is evidence of a past session only.

Stash6 third parent has24 files: nine relevant source/test files, four remediation/RTL documents, six app RTL screenshot files and five root device logs/screenshots. All relevant nine are exactly carried at0ca; four remain exact in Tracking, five have stronger/current equivalents.

## Residual source-history hunk

`4d1f0dd1373f87500c3a075823d74262683e0a52` adds useAssistantInsights mock/default in NavigationJourney. The carried parent `3d422e391140c568f9b246b940bbda6d6614a151^1` already had both; the carried patch accidentally added a duplicate mock property. Tracking contains exactly one mock property and beforeEach `{data:[]}` setup. Savings and notification preferences assertions remain. **ALREADY INCLUDED**; the patch difference needs no source/test recovery. This conclusion concerns the requested residual hunk, not a claim that the whole two branch trees are identical.

## Verification limits and reviewable recovery

No tests were run. Current draft guard tests exercise the mocked navigation callback but do not prove hardware gestures on a device. Migration tests now retain the six seeded migration records after rollback; their negative arrayContaining assertion establishes not-all-v7-tables-created, but is weaker than checking each new table absent. Actual exclusive transaction code remains; no missing stash regression is inferred from this assertion alone. Device PIN, SMS permission, encryption and visual text wrapping require later authorized runtime acceptance.

Safe implementation handoff is one conditional Home accessibility fix plus its acceptance. Preserve current Savings, Google/Clerk identity, secure PIN/biometric fallback, schema15/owner isolation, UI and actual consent-gated SMS. Any developer-tooling restoration needs a separate explicit decision based on its current compatibility. Every path below has an explicit classification/proof group; exact blob and original carry identities are in JSON.

## Path-by-path matrix

| Stash/origin | Path | Classification | Proof group |
|---|---|---|---|
| 4/third-parent | `.agents/skills/brainstorming/scripts/frame-template.html` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/brainstorming/scripts/helper.js` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/brainstorming/scripts/server.cjs` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/brainstorming/scripts/start-server.sh` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/brainstorming/scripts/stop-server.sh` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/brainstorming/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/brainstorming/spec-document-reviewer-prompt.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/brainstorming/visual-companion.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/dispatching-parallel-agents/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/executing-plans/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/finishing-a-development-branch/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/receiving-code-review/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/requesting-code-review/code-reviewer.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/requesting-code-review/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/subagent-driven-development/implementer-prompt.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/subagent-driven-development/re-review-prompt.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/subagent-driven-development/scripts/review-package` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/subagent-driven-development/scripts/sdd-workspace` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/subagent-driven-development/scripts/task-brief` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/subagent-driven-development/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/subagent-driven-development/task-reviewer-prompt.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/condition-based-waiting-example.ts` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/condition-based-waiting.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/CREATION-LOG.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/defense-in-depth.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/find-polluter.sh` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/root-cause-tracing.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/test-academic.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/test-pressure-1.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/test-pressure-2.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/systematic-debugging/test-pressure-3.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/test-driven-development/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/test-driven-development/writing-good-tests.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/using-git-worktrees/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/using-superpowers/references/antigravity-tools.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/using-superpowers/references/codex-tools.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/using-superpowers/references/gemini-tools.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/using-superpowers/references/hermes-tools.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/using-superpowers/references/pi-tools.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/using-superpowers/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/verification-before-completion/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-plans/plan-document-reviewer-prompt.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-plans/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-skills/anthropic-best-practices.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-skills/examples/CLAUDE_MD_TESTING.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-skills/graphviz-conventions.dot` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-skills/persuasion-principles.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-skills/render-graphs.js` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-skills/SKILL.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `.agents/skills/writing-skills/testing-skills-with-subagents.md` | NEEDS DECISION | skill_archive |
| 4/third-parent | `apps/mobile/new_Desinge/final_visual_mockups/generate-final-visual-mockups.mjs` | SUPERSEDED | mockup_generator |
| 4/third-parent | `apps/mobile/new_Desinge/final_visual_mockups/verify-bilingual-mockups.mjs` | ALREADY INCLUDED | exact |
| 4/third-parent | `capture_account_list.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_account_type_selection.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_app_settings.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_demo_options.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_demo_url.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_demos.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_en_test.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_final_working.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_more_final.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_phone.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_profile.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_toggle_audit.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_tx_chips_en.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `capture_tx_chips.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `check_hierarchy.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `check_pos.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `check_real_more.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `click_test.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `debug_entry.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `debug_login.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `debug_row.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `direct_lang_test.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `inspect_css.js` | NEEDS DECISION | tool_archive |
| 4/third-parent | `make_demo.js` | NEEDS DECISION | tool_archive |
| 4/tracked | `apps/mobile/.specify/feature.json` | SUPERSEDED | feature_pointer |
| 6/third-parent | `apps/mobile/app/design-system/_layout.tsx` | ALREADY INCLUDED | exact |
| 6/third-parent | `apps/mobile/app/foundation/_layout.tsx` | ALREADY INCLUDED | exact |
| 6/third-parent | `apps/mobile/src/features/accounts/CurrencyRow.test.tsx` | ALREADY INCLUDED | retained |
| 6/third-parent | `apps/mobile/src/features/auth/auth-flow.test.ts` | ALREADY INCLUDED | exact |
| 6/third-parent | `apps/mobile/src/features/categories/MoveToGroupSheet.test.tsx` | ALREADY INCLUDED | retained |
| 6/third-parent | `apps/mobile/src/features/shell/BackendUnavailableState.tsx` | ALREADY INCLUDED | exact |
| 6/third-parent | `apps/mobile/src/features/shell/useDraftNavigationGuard.ts` | SUPERSEDED | draft_guard |
| 6/third-parent | `apps/mobile/src/services/platform/platform-privacy-config.test.ts` | SUPERSEDED | sms_live |
| 6/third-parent | `apps/mobile/src/storage/runtime-user-data-reset.ts` | SUPERSEDED | runtime_reset |
| 6/tracked | `apps/mobile/.env.example` | SUPERSEDED | config |
| 6/tracked | `apps/mobile/app.json` | SUPERSEDED | sms_live |
| 6/tracked | `apps/mobile/app/_layout.tsx` | SUPERSEDED | route_gate |
| 6/tracked | `apps/mobile/app/(onboarding)/android-sms-permission.tsx` | SUPERSEDED | sms_live |
| 6/tracked | `apps/mobile/app/(tabs)/more.tsx` | SUPERSEDED | identity_reset |
| 6/tracked | `apps/mobile/app/assistant/_layout.tsx` | SUPERSEDED | assistant_arch |
| 6/tracked | `apps/mobile/app/reports/preview.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/app/reports/schedule.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/app/security/events.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/app/security/pin/change.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/app/security/pin/confirm.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/app/security/pin/forgot.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/app/security/sessions.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/app/security/unlock.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/app/subscriptions/_layout.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/app/support/new.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/app/support/tickets/[id].tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/app/support/tickets/index.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/package-lock.json` | SUPERSEDED | config |
| 6/tracked | `apps/mobile/package.json` | SUPERSEDED | config |
| 6/tracked | `apps/mobile/src/components/MenuLink.test.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/components/MenuLink.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/config/demo-mode.test.ts` | SUPERSEDED | config |
| 6/tracked | `apps/mobile/src/config/demo-mode.ts` | SUPERSEDED | config |
| 6/tracked | `apps/mobile/src/design-system/components/feedback/AttentionRail.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/design-system/components/financial/FinancialPulse.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/design-system/components/financial/TransactionRow.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/design-system/components/forms/ChipControls.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/design-system/components/forms/FormField.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/design-system/components/forms/FormField.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/design-system/components/forms/SelectionControls.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/design-system/components/navigation/GroupedList.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/design-system/components/navigation/NavigationControls.test.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/design-system/components/navigation/NavigationControls.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/design-system/components/overlays/RouteModalContainer.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/design-system/components/selection/SelectionGrid.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/design-system/components/selection/SelectionList.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/design-system/components/selection/SelectionScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/domain/core-finance.test.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/domain/core-finance.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/domain/cycle-start.test.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/domain/cycle-start.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/domain/financial-period.test.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/domain/financial-period.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/accounts/AccountForm.test.tsx` | SUPERSEDED | draft_guard |
| 6/tracked | `apps/mobile/src/features/accounts/AccountForm.tsx` | SUPERSEDED | draft_guard |
| 6/tracked | `apps/mobile/src/features/accounts/AccountRow.test.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/accounts/AccountRow.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/accounts/AccountSettingCard.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/accounts/AccountTypeHeroCard.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/accounts/AccountTypeSelectionScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/accounts/CardEducationCard.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/accounts/CurrencyPickerSheet.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/accounts/CurrencyRow.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/assistant/AssistantConversationView.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/assistant/AssistantLanding.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/assistant/components/AssistantCapabilityShortcuts.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/assistant/components/AssistantComposer.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/assistant/components/AssistantConsentCard.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/assistant/components/AssistantFollowUpSuggestions.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/assistant/components/AssistantHeaderBanner.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/assistant/components/AssistantMessageBubble.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/assistant/components/AssistantSuggestedQuestions.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/assistant/components/FinancialInsightCard.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/assistant/components/UserMessageBubble.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/auth/auth-flow.ts` | SUPERSEDED | secure_auth |
| 6/tracked | `apps/mobile/src/features/auth/AuthenticationJourney.test.tsx` | SUPERSEDED | secure_auth |
| 6/tracked | `apps/mobile/src/features/auth/AuthMethodChooser.tsx` | SUPERSEDED | secure_auth |
| 6/tracked | `apps/mobile/src/features/auth/AuthRoutes.test.tsx` | SUPERSEDED | secure_auth |
| 6/tracked | `apps/mobile/src/features/auth/OtpVerificationForm.test.tsx` | SUPERSEDED | secure_auth |
| 6/tracked | `apps/mobile/src/features/auth/OtpVerificationForm.tsx` | SUPERSEDED | secure_auth |
| 6/tracked | `apps/mobile/src/features/auth/session-controller.test.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/categories/CategoryForm.tsx` | SUPERSEDED | draft_guard |
| 6/tracked | `apps/mobile/src/features/categories/CategoryIconPickerSheet.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/categories/CategoryListScreen.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/categories/CategoryListScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/categories/CategoryRow.test.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/categories/CategoryRow.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/categories/CategorySelectionScreen.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/categories/GroupFormModal.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/categories/MoveToGroupSheet.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/filters/DateRangeSheet.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/filters/DateRangeSheet.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/financial-planning/PlanningHomeCard.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/home/HomeScreen.test.tsx` | INTEGRATE | home_missing |
| 6/tracked | `apps/mobile/src/features/home/HomeScreen.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/home/HomeSummary.tsx` | INTEGRATE | home_missing |
| 6/tracked | `apps/mobile/src/features/notifications/NotificationCenterScreen.test.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/notifications/NotificationCenterScreen.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/obligations/ObligationForm.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/obligations/PaymentJourney.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/onboarding/PlatformOnboardingRoutes.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/reports/ReportDrillDownJourney.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/reports/ReportDrillDownScreen.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/reports/ReportsJourney.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/reports/ReportsScreen.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/salary/SalaryOverviewScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/security/PinForm.test.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/src/features/security/privacy-lock.test.ts` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/src/features/security/privacy-lock.ts` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/src/features/security/SecurityJourney.test.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/src/features/security/UnlockScreen.test.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/src/features/security/UnlockScreen.tsx` | SUPERSEDED | secure_pin |
| 6/tracked | `apps/mobile/src/features/settings/ApplicationSettingsScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/settings/CurrencySelectionScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/settings/CycleStartDaySelectionScreen.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/settings/CycleStartDaySelectionScreen.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/settings/PrivacySettingsScreen.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/settings/ProfileScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/shell/AppShellLocalization.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/shell/AppTabs.test.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/shell/AppTabs.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/shell/navigation-context.test.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/shell/navigation-context.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/shell/NavigationJourney.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/shell/PrimaryShellHeader.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/shell/PrimaryShellHeader.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/shell/ProtectedNavigation.test.tsx` | SUPERSEDED | route_gate |
| 6/tracked | `apps/mobile/src/features/shell/ProtectedRouteGate.tsx` | SUPERSEDED | route_gate |
| 6/tracked | `apps/mobile/src/features/shell/RootLayoutOptions.test.tsx` | SUPERSEDED | route_gate |
| 6/tracked | `apps/mobile/src/features/shell/ShellDirection.test.tsx` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/support/SupportFormScreen.tsx` | SUPERSEDED | direction |
| 6/tracked | `apps/mobile/src/features/tracking/components/TrackingKeywordChips.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/tracking/TrackingStatusJourney.test.tsx` | SUPERSEDED | sms_live |
| 6/tracked | `apps/mobile/src/features/tracking/TrackingStatusScreen.test.tsx` | SUPERSEDED | sms_live |
| 6/tracked | `apps/mobile/src/features/tracking/TrackingStatusScreen.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/transactions/TransactionDateField.native.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/transactions/TransactionForm.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/transactions/TransactionListScreen.tsx` | SUPERSEDED | large_text |
| 6/tracked | `apps/mobile/src/features/transactions/useTransactionDraftGuard.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/transactions/useTransactionDraftGuard.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/features/voice/useVoiceCapture.test.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/features/voice/useVoiceCapture.ts` | SUPERSEDED | voice_runtime |
| 6/tracked | `apps/mobile/src/features/voice/VoiceReview.tsx` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/localization/messages/ar.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/localization/messages/en.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/contracts/assistant-notifications-service.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/contracts/core-finance-service.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/contracts/financial-planning-service.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/contracts/reports-service.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/services/mocks/assistant-service.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/mocks/automatic-tracking-service.test.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/mocks/automatic-tracking-service.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/mocks/core-finance-service.test.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/mocks/core-finance-service.ts` | SUPERSEDED | live_finance |
| 6/tracked | `apps/mobile/src/services/mocks/exchange-rate-service.test.ts` | SUPERSEDED | exchange |
| 6/tracked | `apps/mobile/src/services/mocks/exchange-rate-service.ts` | SUPERSEDED | exchange |
| 6/tracked | `apps/mobile/src/services/mocks/financial-planning-payment.test.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/services/mocks/financial-planning-service.test.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/mocks/financial-planning-service.ts` | ALREADY INCLUDED | planning |
| 6/tracked | `apps/mobile/src/services/mocks/reports-service.ts` | ALREADY INCLUDED | exact |
| 6/tracked | `apps/mobile/src/services/mocks/subscription-settings-service.test.ts` | SUPERSEDED | settings_live |
| 6/tracked | `apps/mobile/src/services/mocks/subscription-settings-service.ts` | SUPERSEDED | settings_live |
| 6/tracked | `apps/mobile/src/services/platform/tracking-permission-service.android.ts` | SUPERSEDED | sms_live |
| 6/tracked | `apps/mobile/src/services/platform/tracking-permission-service.test.ts` | SUPERSEDED | sms_live |
| 6/tracked | `apps/mobile/src/services/platform/voice-recorder-service.test.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/services/platform/voice-recorder-service.ts` | SUPERSEDED | voice_runtime |
| 6/tracked | `apps/mobile/src/state/app-shell.test.ts` | SUPERSEDED | identity_reset |
| 6/tracked | `apps/mobile/src/state/app-shell.ts` | SUPERSEDED | identity_reset |
| 6/tracked | `apps/mobile/src/storage/automatic-tracking-repository.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/storage/core-finance-repository.ts` | SUPERSEDED | live_finance |
| 6/tracked | `apps/mobile/src/storage/database.test.ts` | SUPERSEDED | database |
| 6/tracked | `apps/mobile/src/storage/database.ts` | SUPERSEDED | database |
| 6/tracked | `apps/mobile/src/storage/financial-planning-repository.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/storage/local-data-reset.test.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/storage/local-data-reset.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/storage/reports-repository.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/storage/settings-storage.ts` | SUPERSEDED | settings_live |
| 6/tracked | `apps/mobile/src/test-utils/setup.ts` | ALREADY INCLUDED | retained |
| 6/tracked | `apps/mobile/src/test-utils/stateful-sqlite.ts` | ALREADY INCLUDED | exact |
| source-history/residual-hunk | `apps/mobile/src/features/shell/NavigationJourney.test.tsx` | ALREADY INCLUDED | source_residual |

## Proof group definitions

- **exact**: Current blob equals original stash blob. Original content exactly carried at0ca7c9c8e222d5e2bbbd89551df8ce90b6ed9eeb, ancestor of Tracking.
- **home_missing**: INTEGRATE: original HomeSummary largeText wraps title/category/account and stacks cards; Tracking ActivitySection uses TransactionCard home without groupedPosition, fixedHomeCard bypasses largeText, caps all labels1 and fixes84. HomeScreen test changed reflow/uncapped expectation to fixed84/one-line in3d422e391140c568f9b246b940bbda6d6614a151. Preserve normal-scale UI, restore Arabic/English large-font acceptance.
- **secure_auth**: SUPERSEDED: old chooser/phone/OTP removed. Live Clerk GoogleAuthScreen, auth-pending, native callback and current session-controller tests provide actual identity flow; dynamic auth-flow proxy chooses registered live provider. Commits4ef25688c737d33227a4c3dca5bc853e792f25e6,17a70ff2ec2a7091f78e1a750a5b7a651ff11713. Do not restore old synthetic production auth.
- **secure_pin**: SUPERSEDED: schema-validated PinCredential PBKDF2-SHA256120000 salt16/hash32 and constant-time compare; legacy plaintext rejected. Biometric lock/PIN fallback and PinSetupScreen/current Unlock acceptance replace old hash-property/legacy-upgrade code. Commit2451e90b5580d034d4c5484322baed844c213092.
- **route_gate**: SUPERSEDED: legal-only bypass; sanitized return destination, first-launch/profile hydration, lock recovery, stale unlock redirect and mounted bootstrap navigator replace old broad public allowlist. Tests validate current gates. Commits150dfd6bc08a599ec90df37b4369db94ac2e252d,17a70ff2ec2a7091f78e1a750a5b7a651ff11713.
- **identity_reset**: SUPERSEDED: signOut clears session/transient identity and encrypted owner-bound database handle/import queue, uses identity-only reset, preserves owner financial data isolation. More keeps current UI/Savings and root Google entry. Stash broad resetLocalUserData and removed language route must not return; current app-shell-live/database-owner/owner storage tests inspect isolation.
- **sms_live**: SUPERSEDED: original no-SMS-until-ingestion policy replaced with actual native Android inbox module and consent-gated READ_SMS only, never RECEIVE_SMS; allowBackup=false retained; iOS/web unavailable. Platform privacy/permission tests target implemented ingestion. Commitb084d20a06948aa2c93f9cac76120698876c7a1b.
- **config**: SUPERSEDED: current client-runtime explicit live/demo mode and fixture gate(test or explicit demo) retains old demo separation; current SDK dependency versions supersede old lockfile/expo-crypto version. noble/expo-crypto retained. Environment sample is configuration-only; no credentials copied.
- **live_finance**: SUPERSEDED: actual owner-bound live core finance provider/cutover replaces local-only metadata-live factory. Mock/reset/cache/seed functionality retained behind fixture mode. Current core-finance repository validates currencies with legacy-edit boundary exception; durable operations/refund/payoff/ownership added.
- **exchange**: SUPERSEDED: live reference HTTP exchange-rate provider replaces local production-unavailable wrapper. Missing endpoint cross-currency remains unavailable; fixtures only demo/test, no invented rate. Current exchange-rate tests cover actual provider/fallback.
- **settings_live**: SUPERSEDED: real createLiveIdentityService with ownerId profile persistence, server sessions/security/privacy replaces empty fake production sessions/privacy wrapper. Original mock profile/reset support remains for demo. settings-storage preserves schema-validated settings_profile, now keyed owner transaction.
- **database**: SUPERSEDED: original per-version atomic migration loop retained; schema9->15 and tests enumerate all15/rollback retain6 old versions. Owner-encrypted SQLCipher/lifecycle serialization added; downgrading would lose subsequent tables.
- **runtime_reset**: SUPERSEDED: original registry now awaits Promise.allSettled callbacks, propagates failures and adds separate identity reset registry.
- **voice_runtime**: SUPERSEDED: cleanupCaptureAudio and failed reference retention moved to persistent VoiceCaptureRuntime; recorder bounded prepare/stop/file check and retains discardedAudio for retry. Original failed-cleanup retry test remains, expanded to hung cleanup and typed stop result. Hook now thin runtime adapter.
- **planning**: ALREADY INCLUDED: injected now/readTransactions, valid installment inputs, repository reset and early-settlement preview expectedVersion/amount retained. Demo seed now localizes relative to Date.now/timezone/locale. No fixture transaction leak reintroduced.
- **draft_guard**: SUPERSEDED: shared usePreventRemove keeps discard/gesture protection and awaits discard; newer requestClose/leaveAfterSave API bypasses guard after successful save. AccountForm uses configured baseCurrencyCode and real credit paymentDueDay1..28 instead of old nonexistent due-day field removal. Gesture callback explicitly tested.
- **large_text**: SUPERSEDED: current label caps are conditional with undefined lines when fontScale>=1.5; normal UI cap retained. CategoryRow wraps name/meta at all sizes; tests cover200% ar/en/default long-name/48px actions. Home fixed-card regression separately INTEGRATE.
- **direction**: SUPERSEDED: physical numeric/layout direction now uses layoutDirectionStyle(native direction, web writingDirection). RTL semantic rows mirror once; MenuLink explicitly row-reverse/aligns end. Corresponding locale/large-text tests retained. Commitd7438e5aa8f5b3662945bd4d2bb0595402f74d5e.
- **retained**: ALREADY INCLUDED: original significant additions/hunks retained with current test equivalent. Exact original whole blob carried in0ca; added-line normalization is supporting evidence, not sole supersession proof. Removal-of-truncation paths inspected for equivalent large-font behavior.
- **tool_archive**: NEEDS DECISION: historical developer tooling absent from Tracking; no equivalence established. Preserve archive; no product runtime deficit. Hardcoded local paths/ports and old demo route generation must be modernized before use.
- **skill_archive**: NEEDS DECISION:51 vendored Superpowers skills/instruction/helper files absent Tracking. Installed session plugins provide related tools but equivalence not established. Decide vendoring separately from product recovery; archive retained.
- **mockup_generator**: SUPERSEDED: current generator retains screens/fonts/bilingual rendering and RTL back arrow; adds OpenMoji seeded categories/transaction metrics/grouped rendering/account labels. Replaces old static transaction render path/unused common strings;43f947cf5c64f2b74e75b5d7389232a845ebd19e,4d9d4e289dfa7061810cadba4647e296334cc126.
- **feature_pointer**: SUPERSEDED: historical active feature012 changed to017 safe-phase remediation at4667b5b6a0b65012dbe77513fec43b44393cbc02; both specs remain. No runtime feature.
- **source_residual**: ALREADY INCLUDED: source4d1f0dd intended useAssistantInsights jest mock+data[] default; carried3d422e3 parent already had setup and carried patch added duplicate mock. Tracking has exactly one property and beforeEach data[] setup, Savings route/notifications preference assertions preserved. No missing setup.
- **assistant_arch**: SUPERSEDED: route now mounts live assistant/capability architecture; original fixture-only backend unavailable guard replaced by service-level live availability and explicit fixture-mode boundary. Commit722c4bacccaa3edf82aeb632dee4634a70df8bd6.
