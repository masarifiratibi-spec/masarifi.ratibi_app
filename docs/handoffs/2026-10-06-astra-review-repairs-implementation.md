# Astra review repairs — local implementation

2026-10-06. Base HEAD remains `cb2dd3724e498985e148b3b97af4bdc7c7260706`. The human requested “implementation” after the independent review. Four confirmed findings are repaired locally; no commit, deployment, installation, host activation or financial write was performed.

## Resulting behavior

- **D1, failed Manual draft read:** the form becomes ready only after a successful read. A failed read offers Retry and cannot expose editing, Save or discard of an unread operation. Retry restores the frozen input/UUID. The repository also rejects replacing an existing submitted operation with a different UUID. A conflicting form enters reconciliation without clearing the other journal.
- **D2, failed local preparation:** a new submission that fails to persist before transport gets localized device-save feedback and remains editable/retryable. It cannot claim a possible financial outcome. An operation already marked unknown retains its frozen input/UUID and uncertainty through a later local failure.
- **D3, rejected owner hydration:** failed readiness is cleared so the same owner-bound repository can hydrate again. Concurrent callers share the next attempt. Successful hydration remains cached and owner switching preserves separate drafts.
- **D4, canary cleanup pin drift:** cleanup reaches independently attempted API shutdown, scoped shutdown, general-worker shutdown and policy OFF before mutable restoration pin checks. Each container receives its own fixed Staging project/service/network validation. A missing or foreign target does not suppress other trusted closure attempts. Aggregate closure failures or drift block restoration. Policy OFF still requires the independently pinned migration credentials; drifted credentials are never used to write to an unidentified database.

## Source and provenance

Mobile production delta: `apps/mobile/src/features/transactions/TransactionForm.tsx`, `apps/mobile/src/storage/core-finance-repository.ts`, `apps/mobile/src/services/live/core-finance-service.ts`, and the EN/AR message files. Regression tests are in the existing form, live ledger service and Manual submission durability suites.

The operational delta is **ignored local tooling**, not part of a normal Git patch:

- `.superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-host.cjs`
- `.superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-controls.test.cjs`
- `.superpowers/sdd/2026-10-06-astra-review-repairs/canary-closure.test.cjs`

Final SHA256 receipt: [controls-source-hashes.json](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/.superpowers/sdd/2026-10-06-astra-review-repairs/controls-source-hashes.json>). Host source SHA256 is `2447f6d8b57ace22d2e36f1d858308dafa675cea11f1ce876f1b39cc918e2e20`. This source remains pinned to the existing cb2 candidate and must be retained explicitly for any later operational handoff. Do not silently copy it to a new release or reuse old approval/provenance.

Original probes and controls are preserved in `.superpowers/sdd/2026-10-06-astra-independent-review/original-probes/` and `original-controls/`. Historical logs and the independent review remain intact; their observations concern cb2/installed APK source 64405e4. The report's probe links now resolve to the preserved originals. Pre-existing handoff edits were retained.

## Verification evidence

All logs below are in [.superpowers/sdd/2026-10-06-astra-review-repairs](<C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/.superpowers/sdd/2026-10-06-astra-review-repairs/>).

| Check | Result | Receipt |
| --- | --- | --- |
| D1 form/identity regressions | Red reproduced readiness/replacement failures; green 61 tests / 2 suites | `d1-red-corrected.log`, `d1-green.log` |
| D3 hydration/owner recovery | Red reproduced cached rejection; green 37 tests / 2 suites | `d3-red.log`, `d3-green-complete-fixture.log` |
| D2 new/prior uncertainty and conflict | Red reproduced locked editing and clearing another operation; green 84 tests / 3 suites | `d2-red-state.log`, `d1-conflict-red.log`, `d2-green.log` |
| D4 closure and deadline entry | Initial green 18 tests; final green 19 tests after fresh review | `d4-red.log`, `d4-green.log`, `final-review-d4-red-effects.log`, `final-review-d4-green.log` |
| Full Mobile serial Jest run | PASS, exit 0; 463 suites / 2,631 tests, 649.371 seconds | `mobile-full-serial.log` |
| TypeScript | PASS, exit 0 | `typecheck.log` |
| ESLint | PASS, exit 0; 0 errors, 105 warnings | `lint.log` |
| Core Finance boundary check | PASS, 1,012 files | `core-finance-boundary.log` |
| Voice boundary check | PASS, 36 files | `voice-boundary.log` |
| Host controls syntax | PASS locally, exit 0 | `controls-syntax.log` |

Two full-suite attempts failed and are preserved, not counted as passes. `mobile-full.log`: 462/463 suites, 2,629/2,631 tests passed, with two PaymentJourney failures following a 5-second timeout; isolated PaymentJourney passed both tests (`payment-isolated.log`). `mobile-full-rerun.log`: 456/463 suites, 2,615/2,623 executed tests passed, with timeouts, a dependent assertion and an `UNKNOWN: unknown error, fstat` suite-load failure. Their headers show PowerShell's npm wrapper consumed `--runInBand`/`--forceExit`, so Jest ran parallel workers. The final run invoked `node node_modules/jest/bin/jest.js --runInBand --forceExit` directly, with the original test deadlines and no exclusions; all 463 suites and 2,631 tests passed. Console warnings and the forced-exit notice remain in that log; this pass does not establish absence of open handles.

The repair's Mobile diff passes `git diff --check`. The whole-worktree check reports one inherited trailing blank line at the end of the prior engineering handoff; that document was preserved. HEAD is unchanged, and no backend/migration file changed. Existing CI success belongs to cb2 and has not been rerun remotely for this local delta.

A separate fresh Astra reviewer found one Important residual D4 defect: grouped API/general-worker validation could suppress all closure after a missing worker. The implementation received one fix pass: per-step validation plus real Docker-command-boundary regressions for missing API, missing worker and foreign worker. Those tests reproduced the missing closure attempts before the fix and passed afterward. Reviewer found no Critical or Minor findings and considered D1/D2/D3 coherent. Full review receipt: `fresh-review.md`; no second reviewer was dispatched.

Test guard/clean-code review checked observable form behavior, frozen repository state, concurrent owner recovery, and closure/restoration boundaries. Form tests reuse the existing service-mock harness to inject read/preparation/transport failures; the identity scenarios also run the real repository. This is not a full UI-to-live-SQLite integration proof. Existing real in-memory SQLite restart/late-save tests remain in the suite. Hydration tests use the real repository with an injected database-open boundary; controls use inert command adapters, including the actual cleanup-adapter factory. No tests dispatched live HTTP, speech or financial operations. Rejected harness attempts are retained alongside the corrected red/green receipts.

## Rulings and remaining boundary

Implementation proceeded inline within the user's local repair authorization. Documentation and evidence were preserved; nothing was committed. Identity conflict requires reconciliation instead of clearing another operation. Independently trusted cleanup targets may close despite mutable drift, while failed closure or drift prevents restoration. These rulings favor preserved operations and blocked restoration; their live effects remain unaccepted.

The installed Samsung still has the old candidate APK. Existing English/Arabic human evidence proves only that candidate's nonposting capture/extraction/rendering; it does not validate these changed sources. Fresh device fault/recovery, bilingual new-error UX and build/signing provenance are outstanding. The controls repair is not installed on Staging, and actual OFF/stop/restore/health/deadline proof is outstanding. Arabic empty-ledger fallback remains a separate product/requirement question, unchanged by these four fixes. No backend runtime or migration source changed.

The next operational step needs a separately authorized, precisely scoped nonfinancial controls rehearsal and candidate build/install workflow, preserving login/data/journals/draft. **No valid Manual Save, financial Voice finalize, Posting enablement, ordinary worker, global backlog drain or real financial canary is authorized.** The exact financial canary remains unapproved; it needs explicit human approval naming the candidate/provenance, exact sessions/input, bounded window, target scope, expected ledger effects and closure controls. Posting OFF does not authorize Manual Save.
