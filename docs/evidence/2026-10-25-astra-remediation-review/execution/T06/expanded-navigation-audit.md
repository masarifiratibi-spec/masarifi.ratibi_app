# Expanded T06 active navigation audit — 28 October 2026

Status: PARTIAL AUDIT; four navigation defects repaired in the approved slice. Full T06 BLOCKED.
Author/model: GPT-6.1 Sol Extra High (gpt-6.1-sol/xhigh). Review is self-review; automated and actual device results are separate evidence.
Authority: user approved proposal SHA-25651224a79dc271a35ede4b1e81f35e1e15eb48ed599c8d86a8c535f4ec20f8d81. Historical two-entry exception remains preserved.

## Inventory and inspection scope

[Full route inventory](navigation-audit-inventory.md) lists all114 route files:97screen wrappers and17layout/control files. JSON retains initial/current hashes, wrapper components, guard markers, literal destinations and per-route coverage. This is a complete file inventory, not proof that all97 screens are reachable or tested.

Manually inspected root/tab layouts, AppPrivacyGate and ProtectedRouteGate integration, entry/return sanitization, native-intent callback decoding, custom tabs, visible More entries and gates; inspected the affected transaction/account wrappers, shared transaction card, account-scope store, assistant/report return controls and the tested settings/category/form/draft components. Other wrapper extraction is source scanning; transitive screen review is not exhaustive.27 route-file entries have current or explicitly attributed historical device observations; their scope varies and none represents all assertions for that route.

## Confirmed defects and fixes

| Finding | Reproduction / cause | Fix | Verification |
|---|---|---|---|
| Account activity bypassed Details | AR QA20 row under Account Details opened Edit; shared TransactionCard hardcoded /edit, unlike repaired main list | Shared card opens existing transaction Details; explicit Edit action retained | Before/after QA20 AR/EN device, account/Home/card tests; Home has no today row to tap so Home reuse is automated/source evidence only |
| Lock lost active root destination | EN Categories → background/reopen → private PIN unlock returned Home; root /categories absent from sanitizer | Add exactly currently visible /categories, /salary, /obligations to existing allowlist; sensitive/query rejection preserved | Three unit variants failed before/pass after; same actual Categories lock journey returned Categories after fix. Salary/Obligations lock return not separately device-tested because their data is unavailable offline |
| Account View all ignored ID | QA Account Details View all opened All Accounts with unrelated-account rows; link supplied accountId, wrapper discarded it | Validate scalar accountId and apply existing account selection through layout effect; existing owner-scoped services/reconciliation remain | Failing UI regression then pass; actual EN/AR View all shows QA label and only its displayed activity |
| Contextual Transactions Back lost caller | View all then Android Back returned Home | Pass sanitized account return context; focused hardware Back and toolbar Back use supported router.dismissTo | Actual contextual return works. Intermediate navigate-based repair created history cycles; first dismissTo test inherited that old history and remained inconclusive. Clean restart AR journey proved View all→Back Account Details→Back Accounts list without cycle. Contextual route tests cover platform action and toolbar |

No financial services, sync executor, database schema, worker, policy or auth enforcement changed. Adding return roots does not expose a feature or bypass access gates. Existing inherited T02 Security Back fallback and prior T06 menu/Details changes remain preserved.

## Actual Xiaomi journey coverage

Existing device f66a40694eca, installed DEV com.masarifi.mobile.dev. Two owned local Metro lifecycles used unchanged public projection, explicit App Lock=true, loopback8081 and own USB reverse. Each online-to-offline transition verified no default network before opening app. Private PIN entry was performed by the user. DEV/Metro is not standalone-release qualification.

| Journey | Actual observation | Coverage limit |
|---|---|---|
| Home, More, primary tabs | AR/EN expected screens, cached financial summaries and normal More links | No online freshness/owner equivalence claim |
| Accounts picker/list/QA details | AR/EN record identity and displayed amounts match selected QA account; picker Manage leads Accounts | No transfer/archive/default-account change |
| QA account activity→Details | Matching QA20 expense details AR/EN; correct amount/account; existing Edit action | No Save/refund/delete |
| QA account View all→Back | QA scope correct; clean AR restart unwinds to details then Accounts list | Broad arbitrary deep-link history not exhaustively exercised |
| Categories/system category | Lists AR/EN; Food identity/system designation; Categories lock return verified EN | No system category editing or data mutation |
| New category/group | Empty AR form/sheet opened and closed without Save | Field focus attempted; rendered keyboard behavior not established by XML |
| New account/card type | AR type selector and currently visible credit-card form inspected; visible Back→type selector→Close returns Accounts | No terms entered, account created or payment action; first Android Back left form visible, keyboard/transition cause unproven so not a confirmed defect |
| Existing QA account edit | Existing AR fields matched; closed without edits | Save excluded |
| Transactions/Add/category picker | EN Add displayed0 and blank description; picker Back preserved form; Cancel offered draft disposition, Keep Editing chosen; Home tab left draft intact | No transaction submission, no draft purge |
| Transaction options/date/account pickers | AR open/dismiss, unchanged values; all-account scope restored | No filter/calendar exhaustive matrix |
| App settings, currency and month-start | AR/EN locale switch via ordinary UI restored Arabic; currency picker EN and month-start AR opened/Back unchanged | No preference changes beyond temporary locale; all settings not exhaustively toggled |
| Profile, Salary, Obligations, Tracking, Sessions | Feature-specific unavailable states offline and Back | Their online success, retries, child records/actions remain BLOCKED |
| Reports/Assistant | Analytics unavailable offline; Assistant landing/unavailable view; no messages/consent | A rapid Back+tap sequence selected Explain report and populated an unsent report question; subsequent Assistant Back went Home. This sequence has transition ambiguity; clean Reports→Assistant contextual return remains UNVERIFIED, not declared a confirmed defect |
| Support | EN support form correct category/subject/description controls; normal return | No text/submission/ticket creation |
| Security Events | Prior approved menu/route observation retained | Existing live-content fixture restriction is deliberately preserved; unavailable gate is not classified a new defect |
| Voice | Home Voice shortcut was tapped once while treated as a screen entry; source later confirmed direct capture action and UI showed Recording interrupted | This was outside the planned no-recording slice. No retry/clear/upload was performed. Phone was offline throughout; retained local audio/journal state not enumerated or erased. No successful capture or no-local-side-effect claim. Banner absent after normal clean restart; that does not prove storage cleanup |

All raw XML remains private in the existing T04 evidence directory (expanded-*.xml and final-*.xml); source/evidence hashes are in expanded-navigation-source-manifest.json. Snapshot filenames are labels, not outcome claims. For example expanded-voice-en.xml actually contains report-seeded Assistant, not Voice. Earlier coordinate/timing misses are preserved rather than counted as route defects.

## Visibility and deferred behavior

Foundation/Design System fixture redirects, billing/subscription restrictions, disabled More notification-preferences entry, tracking capability/consent gates and Security Events live-content fixture condition remain unchanged. No new menu item was added during this expanded slice. Cards were inspected only through the existing visible account-type form. No budget/savings entry was manufactured; where the current UI supplies no confirmed normal entry, visibility remains UNCONFIRMED and navigation unchanged. Public/onboarding/recovery/logout/PIN-change paths were not forced by changing existing authentication or account state.

## Automated results

- Four focused pre-fix expectations failed for the shared-card destination and three missing return roots.
- View all account-label regression failed before accountId consumption and passed after.
- Contextual hardware Back regression failed before handler and passed after.
- Final candidate:12 existing suites /241 tests PASS (navigation context/entry/protected navigation/journeys/tabs, Accounts detail, shared card, Home, Transactions wrapper/list and runtime config).
- Mobile tsc --noEmit exit0.
- Changed-file ESLint exit0:0errors/2 preexisting require-style warnings in NavigationJourney and ProtectedNavigation tests.
- Earlier run referenced nonexistent ProtectedRouteGate.test.tsx:failed to load, not a product defect. Corrected to existing ProtectedNavigation.
- Broad run exposed two stale tests expecting incomplete App Lock override to disable protection. Existing runtime requires actual DEV/development/package/variant identity. Updated tests to assert retained enforcement and no notification action without unlock; runtime security code unchanged. A first fixture correction retained a contradictory old assertion; corrected before the final241-test pass.
- Last affected return-path refinement also passed its two suites/23 tests before final12-suite pass. No independent reviewer or effective CI run is claimed.

## Files changed in expanded product/test slice

- apps/mobile/app/(tabs)/transactions.tsx
- apps/mobile/src/features/accounts/AccountDetailScreen.tsx
- apps/mobile/src/features/transactions/TransactionCard.tsx
- apps/mobile/src/features/shell/navigation-context.ts
- apps/mobile/src/features/accounts/AccountDetailScreen.test.tsx
- apps/mobile/src/features/transactions/TransactionsRoute.test.tsx
- apps/mobile/src/features/home/HomeScreen.test.tsx
- apps/mobile/src/features/shell/navigation-context.test.ts
- apps/mobile/src/features/shell/NavigationJourney.test.tsx
- apps/mobile/src/features/shell/ProtectedNavigation.test.tsx

Documentation: inventory MD/JSON, this audit, expanded source manifest, simplified strategy approval note and latest continuation/progress. No native/APK/server/deployment changes.

## Remaining blockers and next work

Full audit/acceptance is incomplete. Online device/API, reconnect/retry/session restoration, complete queue state, forced auth/onboarding/logged-out cases, mutations, dynamic records unavailable through ordinary UI, and unclear/hidden route reachability remain explicit BLOCKED/NOT_RUN. English/Arabic coverage varies by route; see inventory. No form Save/payments/refunds, provider dispatch, consent activation or actual logout was executed as a test.

T04 hosted same-operation reauth/exactly-once and T05 remain BLOCKED. Full T06 cannot PASS; T07+ remains NOT_STARTED. Current T06 repairs are implemented with the stated offline evidence only. Next eligible work is clean normal Reports→Assistant return reproduction and further enabled safe navigation cases with available records, or live API recovery once the existing queue/worker safeguards permit online testing. Do not reopen the global policy test without a separately approved execution-ready packet.

Final cleanup: app stopped offline without clearing data, PID absent; owned reverse/Metro removed/stopped; Arabic and All Accounts restored, Wi-Fi1/data0/airplane0 restored. Last session inspected only empty category/group/account forms and closed them via normal controls without submission. Unknown retained transaction/voice work remains preserved, never declared empty. Production and billing untouched; original branch/HEAD and handoff guidance retained.


## Subsequent clean Reports/Assistant verification — 28 October 2026

Sol personally completed clean offline Xiaomi journeys on the unchanged candidate (all ten source/test hashes match expanded-navigation-source-manifest.json). This supersedes the earlier UNVERIFIED clean Reports→Assistant return item; earlier rapid-input ambiguity remains historical evidence, not a product defect.

- Arabic/RTL: Home→Analytics→Explain opens the matching Arabic unsent question for All Accounts; toolbar Back and Android Back each return to Analytics. Selecting the existing QA account updates the account context, Assistant question preserves the exact displayed account/date/SAR scope, and Android Back returns to that same scoped Analytics view.
- English/LTR: Explain works for both QA and All Accounts contexts; toolbar Back returns correctly. Compare this period, Why spending increased, Where can I save and Create a saving plan each prepare the expected unsent analysis question. Android Back returns to Analytics. No question was sent, consent enabled or savings/financial operation executed.
- Report/Assistant data-unavailable states stay within their expected screens offline; this does not establish successful API retrieval or recovery. Report/action/back parameters were observed through normal taps, no diagnostic deep links or route overrides.
- Staging /health/live read from the computer returned HTTP200 at10:26:06Z, versiona488f4adbf8f291ea49b09940baf5cdb4fe5f0e7. This is endpoint reachability only, not phone API/session/readiness recovery. No authenticated content or keys were fetched.

No new navigation defect reproduced; no product fix, test change or 241-test rerun was necessary. Existing passing checks retain their exact candidate scope. Only current evidence/inventory/handoff records changed. New receipt reports-assistant-device-continuation.json binds28private report-*.xml observations in the existing T04 evidence directory.

Online device recovery remains BLOCKED: enabling Wi-Fi with Masarifi running can transmit unknown pending local operations, including potential retained interrupted-Voice work. That specific action is excluded by the approved exception and would need a separately scoped safe plan/authorization accounting for the affected operations. An unrestricted reconnect is not approval-ready. Complete supported local queue visibility and current producer/worker safeguards have not been established by this continuation. Do not infer absence of work from the stopped app or cached UI. No new policy, diagnostic access, logout, storage decryption or queue purge is authorized.

Conditional auth/onboarding/PIN/reset, unavailable dynamic record/report detail journeys and intentionally hidden/deferred routes remain NOT_RUN/BLOCKED or excluded according to the inventory. No forced state was used. Interrupted Voice was not retried. Prior four repairs remain implemented; no additional defect is relabeled fixed. T04/T05/fullT06 remain BLOCKED; T07+ not started.

Final cleanup verified app stopped offline/PIDabsent, owned Metro488/parent13788 stopped, own reverse removed,8081listener absent; Arabic/AllAccounts restored and Wi-Fi1/data0/airplane0 baseline restored with app stopped. All drafts/unknown local work preserved. Source/branch/HEAD unchanged, no staged paths; Production/billing untouched. Next actual prerequisite for online journeys is a safe supported whole-owner local-work assessment plus current operational preconditions, not another replay of the now-passed clean report-return cases. Three-hour handoff guidance retained.
