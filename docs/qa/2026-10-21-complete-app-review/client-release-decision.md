# Client release decision

Updated 2026-10-21T20:15:13+00:00; baseline `9b380dfc8e42c3a484df3ac838e3ff91d9b14a48` on `codex/voice-promoted-operating-2026-10-13`, `D:/Masarifi-integration-2026-10-10`.

**NOT READY for client delivery. Review is in progress. No client APK build or distribution has occurred.** DEV and exact standalone gates remain independent.

The source-derived inventory covers **98 mobile route/intent sources, 16 layouts, 105 Admin pages, 1151 callable UI bindings, 231 functional cases, 15 notification targets, 376 API/dispatch entries and 144 SQL migrations**. The 145th tracked migration-directory file is `.gitkeep`. Joined traces connect 218 client adapter operations and 15 delegated integration bridges to actual route/controller/database dependencies. Coverage counts are not acceptance passes. Source repairs/configuration/test maintenance are committed at `61117eaf07323ffa63c00f867d5d65e6f3142ece` and posting-direction/localization repair `058385f83e6ed5ab46be21de41dea74bc786449f`. Latest installed DEV is ENV-DEV-03; standalone remains NOT RUN.

The user completed current-owner SAR setup and confirmed the account is disposable. Two synthetic accounts saved correctly. One manual expense and three fresh provider-backed voice expenses posted exactly once: EGP wallet **1000 → 975 → 965 → 962 EGP**; SAR bank/debit fixture was 2000 SAR; the verified fresh English 7 SAR voice test now leaves **1993 SAR**, non-default. Fresh English visible-result/provider/event acceptance PASS for U-A DEV only. The initial voice-analysis error report and failed financial refresh are retained as failed attempts. After repair, original read/recovery retests and fresh Arabic/English provider-backed recordings show correct visible results on U-A DEV; second-owner/new-registration/standalone coverage remains open.

## Release-critical work still open

- **DEF-015 / DEF-014: real provider advice inflated verified amounts by 100, and deterministic answers silently ignored explicit EGP wallet/currency scope.** Original physical cases FAIL; repair and original-case retests NOT RUN.

- Genuine unused Google registration and the second independent normal owner remain **NOT RUN**; the user is preparing an unused identity. Current-owner success does not establish ordinary-new-user eligibility.
- DEF-010: opening-balance source broke client ledger reads. Source repair, regression checks and RT-010-01/02/03 DEV read/recovery retests PASS; original failures retained. Fresh capture and standalone remain separate. DEF-011: original reported analysis error is retained; latest fresh Arabic and English visible-result retests PASS on DEV. Exact earlier literal error state remains unconfirmed.
- DEF-006: 144 source/deployed migration counts conceal two missing-by-name corrections and five version differences. New payment/reminder helpers are absent. SQL equivalence and isolated integration/recovery proof remain required; no migration was applied.
- DEF-001: ordinary immediate-deletion path differs from DEV and remains unproven. Disposable deletion is last and requires deliberate user confirmation.
- DEF-002/003/007: live support routes, security-event mapping, revoke-all sessions and support rating contain unavailable paths. They remain intended-feature defects, not exclusions.
- Real OS SMS/notification capture, pause/revoke/restart/dedup/owner isolation, opt-in delivery and every target/action, assistant amount/scope correctness (DEF-014/015), history/confirmed actions, planning/reversal/report correctness and authenticated customer-impacting Admin acceptance remain **NOT RUN** or **BLOCKED** as recorded.
- DEF-009: repeated Back from Accounts did not return; root cause and retest remain open. DEF-008 budget-notification route fixed locally, physical retest pending.
- Per-ingress API versions, ordinary-package provider/worker durability and independent-device coverage remain unproven. Voice policy currently permits authenticated users with no owner policy restriction and an active worker heartbeat; three U-A recordings completed, not a complete eligibility gate.

## Agreed scope and protections

Payment gateway/checkout/subscription activation is excluded and nonblocking; preserve code and verify honest unavailable messaging. Standalone app lock is disabled in the local staging-client configuration with code retained; PIN/biometric/unlock acceptance is excluded. Authentication, session security and ownership remain required. No Production change, shared-database reset, historical audio/queue replay, external campaign or account deletion occurred. Private evidence and cleanup records remain outside Git.

## Review records and order

1. [Complete feature/action/integration inventory](feature-inventory.md) and [route matrix](route-matrix.md).
2. [Executable checklist, physical results and cleanup ledger](acceptance-checklist.md): complete current manual/voice defect retests; prove unused U-NEW and independent U-B initialization; continue accounts/categories/correction, SAR and second-owner voice, actual tracking, notification targets/actions, assistant, planning/reports, settings/Admin, then disposable deletion.
3. [Defects and original failure/retest provenance](defects.md).
4. [DEV versus standalone acceptance](dev-apk-parity.md).

For each user step, give one concrete action and expected observation, capture the result, then continue. User handles identity choice, secrets, microphone speech, OS permission decisions and destructive confirmation. Never request passwords or OTPs.

DEF-012/013 opening signs and system localization now pass the positive/negative DEV retests on ENV-DEV-03; original failures remain recorded. Assistant DEF-014/015 remain release-critical failures. DEV gate cannot pass while critical visible-result failures and intended capabilities remain unresolved. A later user build request is required before preparing a standalone artifact. Standalone gate must identify exact package/signature/hash/embedded settings and repeat critical cases with Metro stopped, USB/reverse/local proxies absent and ordinary internet; preferably on a second independent Android device. No READY claim from DEV or automated results alone.

## Verification provenance

- Mobile latest complete per-file aggregation: **551 files, 3896 passed, 0 failed, 0 skipped** including the opening-source and signed-direction regressions. This combines completed bounded batches with later complete per-file retests, not one monolithic run. Private `mobile-final-results.json` lists every attempt/file.
- API: **50 files, 234 passed, 0 failed, 8 skipped**; `api-final-results.json`. Skipped database integration/recovery scenarios are **BLOCKED** until an isolated disposable database is prepared. Docker daemon was unavailable and local 54322 absent; unrelated PostgreSQL on 5432 was left untouched. Shared Staging was not reset.
- Admin: **89 files, 946 passed**, bounded single-worker Vitest; typecheck and lint passed. Authenticated Admin browser acceptance **BLOCKED** at Clerk sign-in; no credentials entered by reviewer.
- Mobile final typecheck, API typecheck, scoped lint, 18 Node configuration cases and frontend/runtime boundary checks passed at the recorded attempts. A 768 MB mobile typecheck exhausted its heap; 1536 MB rerun passed. Original infrastructure failures remain preserved.
- Budget routing: original view failed; exact view/edit tests RED → GREEN, 26/26 in the affected two suites. View now targets `/budgets/transactions/:budgetId`; edit remains `/budgets/edit/:budgetId`; no financial action runs on view/edit.
- Navigation test maintenance: stale Clerk mock initially caused 27 failures; adding the already-required session-key mock exposed four outdated signed-out notification expectations. Tests now assert auth-pending and no remote resolution before authentication; no production auth guard changed. Three-suite retest 47/47 passed.
- API ownership maintenance: exact two existing authenticated automation aliases were missing from endpoint inventory. Added exact register/sign-out entries without wildcard/guard changes; ownership retest 6/6 passed after initial one failure.
- Opening-source regression: first RED had two real failures and an incorrect negative-error expectation. Corrected RED: two failures, one negative PASS. The first implementation passed runtime tests but failed type inference; final schema keeps a typed object, permits `account_opening` only for opening rows and normalizes its local projection to adjustment. Final relevant regression run 205/205 across five suites passed; final typecheck passed. Original logs and intermediate attempt remain private.
- Fresh independent reviewer found three material record defects: mutation callbacks mislabeled draft-only, vague budget destination, and disconnected integration inventory. Resolved by mutation-first expected effects, exact budget routes plus regression repair, and 218 joined adapter operation traces with 15 delegated integration bridges. Source/route/link verification ran after corrections. Clean-code/test-guard review retained boundary-based regression tests and strict money/owner/source validation.

<!-- dev-retest -->
## DEV repair retest — ENV-DEV-02

Replacement installed at 2026-10-21T19:40:22.775Z using `adb install -r`; no clear/uninstall. Same DEV signing certificate and Clerk public configuration as the preserved original. Source repairs at `61117eaf07323ffa63c00f867d5d65e6f3142ece`. Package `com.masarifi.mobile.dev`; APK SHA256 `e4c22b165d00504da129d88698c424801584221e6efb99600e4211e6b3a36a4c`; certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; embedded JS SHA256 `9780afe892a4f8134088385f4b13b7588c5b015bc898018b0408cf27b92b2107`. Private artifact/config/signature/install proof: `dev-review-artifact.json`, `dev-review-config.json`, `dev-review-install.json`. Native build passed after two retained Windows path-length failures; final short isolated root `D:/mq21/native`, CMake object-path limit 220, 853 tasks, 10m11s. No client package was built or installed. Metro is stopped and the temporary 8081 reverse mapping was removed; this still does not establish standalone acceptance.

| Retest / original | Steps and expected result | Actual / status | Timestamp / private evidence |
|---|---|---|---|
| RT-010-01 / PHY-005, DEF-010 | 1. Reopen preserved U-A. 2. Select EGP wallet. 3. Read Home and scroll to original expenses. Expected 965 EGP and both persisted rows without financial-load error. | **PASS** on ENV-DEV-02. Feed shows coffee -10 EGP, labeled manual expense -25 EGP and 965 EGP balance. Original failed attempt remains FAIL in history. | 19:40:46–19:41:31Z `qa-dev-fixed-settled`, `qa-retest-egp-home`, `qa-retest-egp-feed` |
| RT-010-02 / PHY-008 read subcase | 1. Tap original coffee. 2. Inspect saved editor. 3. Android Back without Save. Expected same owned 10 EGP expense, Restaurants, correct wallet and no write. | **PASS** original saved-result read/back. UI shows 10 EGP, Restaurants, EGP wallet and title coffee; returns to Home. This is not a fresh recording success claim. | 19:41:47–19:41:51Z `qa-retest-voice-detail`, `qa-retest-back-from-voice-detail` |
| RT-010-03 / PHY-005 saved-draft recovery | 1. Open Add. 2. Observe original saved/refresh warning for the original 25 EGP operation. 3. Tap Save once. 4. Reconcile ledger. Expected clean navigation to Transactions, same operation, no duplicate. | **PASS** recovery/refresh. Warning clears and Transactions opens with expense total -35 EGP. Database still one manual and one voice expense; EGP 96500, SAR 200000, pending zero. | 19:42:07–19:42:31Z `qa-retest-original-manual-draft`, `qa-retest-manual-retry-settled`, `ledger-after-fixed-dev-retry.json` |

DEF-010 read-contract/refresh repair is accepted for these DEV retests only. Full manual creation on the new artifact and full first-to-last voice recording still require their own executions; original full visible-result failure is retained. DEF-011's reported earlier analysis message is not retroactively rewritten as a provider failure or a pass. No audio replay or duplicate recording was used for these retests.

## DEF-012 — Opening-balance row displays a negative sign

- Severity/state: P2 material financial-display defect, physically reproduced on ENV-DEV-02; persisted balance remains correct. Historical reproduction before repair; current source repair and DEV retests are below.
- Entry/steps: Open Transactions for A-EGP after RT-010-03 and inspect the opening row.
- Expected: the opening entry's direction matches its positive 100000-minor posting; opening does not inflate expense totals.
- Actual: row displays `-1,000.00 EGP` and English `Opening balance` in the Arabic UI, while owned balance and opening posting are positive. The expense summary correctly excludes opening and shows -35 EGP. Evidence `qa-retest-manual-retry-settled` at 19:42:31Z.
- Cause under investigation: opening projects to local adjustment; `financialMeaning` defaults a positive absolute amount to expense and Transactions does not pass an explicit direction. A safe repair must derive actual posting direction for negative credit openings/reversals too; do not infer every opening is positive or alter persisted data.
- Current repair: 058385f8; RT-012-01/02 positive/negative opening physical DEV PASS below. Signed reversal/adjustment regressions PASS; physical reversal and standalone remain NOT RUN. Original failure retained.

## Next user-dependent execution

At 19:43:38Z the non-default SAR card is selected at 2000 SAR on ENV-DEV-02 (`qa-sar-user-recording-ready`). User is asked for one new English recording, “I spent seven on coffee”, with account/currency omitted. Expected one 7 SAR expense, balance 1993 SAR, EGP unchanged 965. This request was completed and verified below as PHY-010 / RT-VOICE-007-01 **PASS** on U-A DEV only. Do not operate the phone while awaiting the recording.

## PHY-010 / RT-VOICE-007-01 — English, non-default SAR account

- Entry/parameters: ENV-DEV-02 Home, U-A, A-SAR non-default bank account selected, 2000 SAR starting balance; EGP wallet 965 EGP. No spoken account or currency.
- Steps: 1. User starts Voice. 2. Says “I spent seven on coffee”. 3. User stops and leaves result visible. 4. Reviewer captures UI and owned provider/event/ledger chain.
- Expected: one 700-minor SAR expense on the captured card, correct visible result, card 199300 minor, EGP unchanged 96500; no extra postings.
- Actual: **PASS** for this U-A / installed DEV execution. User confirmed correct result; 19:46:30Z UI shows coffee -7 SAR and card 1993 SAR. Session created 19:45:58Z, 5390 ms recording; completed Google Vertex attempt (`google/gemini-3.5-flash-lite`) with generation receipt; completed batch/event 0 committed at 19:46:06Z, ledger version 5, captured SAR account true; one confirmed 700-minor voice expense and one posting. Both fixtures remain non-default; EGP unchanged 96500, SAR 199300, pending zero. This does not pass second-owner/new-registration/standalone eligibility.
- Evidence: `qa-sar-english-user-result.{png,xml,json}`, `voice-sar-english-chain.json`, `voice-sar-english-balances.json`; timestamps above UTC.
- Defect/retest: fresh visible-result recovery after DEF-010 repair; original Arabic failed attempt retained under DEF-011. Arabic original-language retest is separately requested with a new 3 EGP recording; **NOT RUN** until evidence arrives.
- Cleanup: T-VOICE-02 retained; no replay. A-SAR current 199300 minor; A-EGP 96500 minor.

## PHY-011 / RT-VOICE-AR-01 — Fresh Arabic EGP retest

- Entry/parameters: ENV-DEV-02, U-A, A-EGP selected at 965 EGP. The utterance explicitly names pounds; it omits the account, **not the currency**. Exact EGP currency-omission coverage remains NOT RUN.
- Steps: 1. User taps Voice. 2. Says “صرفت تلاتة جنيه على قهوة”. 3. Stops once and reports correct result. 4. Reviewer reconciles UI and owned provider/event/ledger chain.
- Expected: one new 300-minor EGP expense, wallet 96200 minor, unchanged SAR 199300; correct visible result, no duplicate/replay of the old 10 EGP capture.
- Actual: **PASS** for this fresh Arabic selected-account/explicit-currency execution. Session created 19:48:25Z, 7609 ms recording; Google Vertex `google/gemini-3.5-flash-lite` attempt completed with generation receipt; batch completed and one event committed at 19:48:33Z, ledger version 6, captured EGP account true; one posting/expense 300 EGP minor. UI at 19:49:14Z shows 962 EGP and feed at 19:49:33Z shows -3 EGP. Server EGP 96200, SAR 199300, pending zero; EGP voice count two (old 10 plus new 3), manual test count one; SAR voice count one. No account switch/second-owner test is implied.
- Evidence: `qa-egp-arabic-user-retest-result`, `qa-egp-arabic-retest-feed`, `voice-egp-arabic-retest-chain.json`, `voice-egp-arabic-retest-balances.json`. All timestamps UTC; raw IDs/audio private.
- Defect/retest: fresh Arabic and English visible-result retests now PASS after DEF-010 repair; original reported analysis message and failed UI remain in history. Exact cause of that earlier literal message is not invented. The original audio was never replayed.
- Cleanup: T-VOICE-03 retained; latest wallet 96200 minor. Do not delete fixtures until their remaining correction/reversal/ownership cases are complete.

## DEF-013 — Generic system title remains English in Arabic UI

P3, observed at 19:49:33Z: the new valid Arabic 3 EGP event uses the generic server fallback “Voice transaction”; the opening row also uses “Opening balance”. Amount/account/category/posting remain correct. Expected Arabic system labels, while preserving stored titles and ordinary user titles. Existing `voice.title` and account-opening localization keys can supply presentation labels. Source repair at 058385f8, final139/139 regressions PASS; RT-013-01 physical DEV label retest PASS below. Standalone NOT RUN.

Unused Google identity remains **BLOCKED** pending user preparation (user reconfirmed “Still preparing the unused account”). No logout or new-owner registration was attempted. Continue safe current-owner review; ordinary-new-user eligibility remains unproven.

Latest critical finding: **DEF-015 — real provider-backed assistant advice inflated money by 100; acceptance FAIL. DEF-014 also ignores requested wallet/currency scope.** The application remains **NOT READY** for client delivery.


<!-- assistant-review -->
## PHY-012–016 — Assistant consent, scope and provider review

Environment: U-A, ENV-DEV-02, same Staging ingress; 2026-10-21 UTC. Preconditions: disposable owned EGP/SAR fixtures, EGP balance 96200 minor, SAR 199300 minor, six ledger transactions; no developer account entitlement was added. Owner role classification and second ordinary identity remain unverified.

| Execution / case | Entry, parameters and numbered steps | Expected visible / persisted effect | Actual and evidence | Result / retest |
|---|---|---|---|---|
| PHY-012 / AI-001 consent subcase | Assistant entry. 1. Observe personalization consent. 2. Tap enable personalization. 3. Observe confirmation. | Per-owner consent saved and assistant available. No financial write. | Enabled at 20:02:59Z; UI confirmation captured in `qa-assistant-consent-action`. This does not cover every entry, revoked consent or another owner. | Consent subcase **PASS**; full AI-001 **NOT RUN**. |
| PHY-013 / AI-004 explicit wallet/currency subcase | 1. Ask “How much did I spend today from QA21 EGP Wallet. Answer in English with EGP only.” 2. Observe supported-period clarification. 3. Ask monthly version. 4. Inspect saved context and reply. | Daily request honestly clarifies unsupported period. Monthly request returns 38 EGP for requested wallet/currency, or clearly requests account clarification; no silent widening. | Daily `period_required` clarification at 20:03:55Z. Monthly reply at 20:05:38Z returns “Spending: 38 EGP / 7 SAR (2026-10-01 – 2026-10-31).” Stored context contains both currency totals. No provider usage for these deterministic requests. UI `qa-assistant-provider-answer`, `qa-assistant-month-answer`; `assistant-provider-chain-final.json`. | Explicit scope subcase **FAIL**, DEF-014. Full selected-account switching matrix remains **NOT RUN**. Repair/retest **NOT RUN**. |
| PHY-014 / AI-003 general-finance provider subcase | 1. Ask “Explain inflation in two short sentences in English.” 2. Await reply. 3. Reconcile provider receipt and saved response. | Supported general-finance route gives a useful English explanation, or accurately states scope limits. | Real Azure `openai/gpt-6-luna` completed usage with generation receipt at 20:10:42Z; saved reply at 20:10:50Z asks for supplied evidence/source instead of explaining inflation. UI labels it a confirmed fact and calls it an old answer without verified period/currencies. `qa-assistant-english-provider-result`; private provider-chain evidence. Transport/provider subcase **PASS**, useful-answer acceptance **FAIL** pending route/prompt review. | DEF-016; no broad AI-003 PASS. Repair/retest **NOT RUN**. |
| PHY-015 / AI-002 Arabic suggestion shortcut | 1. Tap rendered “نصائح ذكية للتوفير”. 2. Await response. 3. Inspect stored route. | Built-in advice suggestion starts useful Arabic advice, or clearly asks a relevant clarification. | Routed to `savings_status`, returns `entity_required` clarification to identify a financial record; no provider call. `qa-assistant-arabic-provider-result` at 20:11:34Z, saved turn 20:11:28Z. | Shortcut **FAIL**, DEF-017. Arabic provider-answer case AI-002 remains **NOT RUN**. Repair/retest **NOT RUN**. |
| PHY-016 / AI-003 owned-ledger advice | 1. Ask “Give advice to reduce spending this month based on my confirmed records. Answer in English.” 2. Await reply. 3. Compare categories, provider receipt and saved context to owned ledger. | Correct amounts: Shopping 25 EGP; Restaurants 13 EGP and 7 SAR. Advice cannot inflate minor units or change ledger. | Real Azure `openai/gpt-6-luna` completed usage with generation receipt at 20:12:00Z; saved/UI reply at 20:12:09Z says EGP 2,500 shopping, EGP 1,300 restaurants and SAR 700 restaurants. Context holds `expenseMinor` 2500/1300/700, which equal 25/13/7 major units. `qa-assistant-context-advice-result`; `assistant-provider-chain-final.json`. | **FAIL**, release-critical DEF-015. Repair/retest **NOT RUN**. |

Financial side-effect subcase **PASS** for these five informational attempts: at 20:12:30Z there are still exactly six transactions, newest at 19:48:32Z; EGP 96200 and SAR 199300 confirmed minor, pending zero. `assistant-after-report-ledger.json` and `assistant-provider-chain-final.json`. Full AI-010 intent/retry matrix remains **NOT RUN**. Ten persisted messages represent five user turns and five replies; no extra financial action was requested or confirmed. History/reopen/pagination acceptance remains **NOT RUN**.

## DEF-014 — Assistant silently broadens explicit EGP wallet request

- Severity: P1, incorrect financial context. Reproduced PHY-013. Expected requested EGP/account scope or explicit clarification; actual both EGP and SAR returned.
- Source investigation: `apps/api/src/ai/assistant-context.ts` currency expression omits EGP and Arabic pound names; account clarification expression recognizes the literal word account and limited Arabic forms, but not a supplied wallet name. `AssistantFinancialTools.resolve` passes the resulting unfiltered context to report summary. This establishes the local parsing gap; exact deployed source equivalence remains unverified.
- Smallest repair direction: recognize supported owner currencies and reject unresolved account scope honestly; do not silently broaden or guess an owner record. Public API redesign is not authorized/planned. Source repair and original physical retest **NOT RUN**.

## DEF-015 — Provider advice inflates verified amounts by one hundred

- Severity: P1, release-critical financial correctness. Reproduced PHY-016 with completed provider receipt and persisted incorrect response, not an HTTP-only observation.
- Expected Shopping 25 EGP, Restaurants 13 EGP / 7 SAR; actual 2500 EGP, 1300 EGP / 700 SAR. Persisted report context contains correct integer minor units. Ledger/balances are unchanged.
- Investigation: the observed path is `financial_advice` through the provider worker; local `ai.worker.ts` sends encoded financial context to `ASSISTANT_ADVICE_OUTPUT_SCHEMA`. Need validate actual deployed prompt/output validation and ensure money is rendered/checked server-side with currency precision. Do not assume newer agent fact rendering is the active ingress/worker implementation. No speculative provider or database configuration change made.
- Repair/regression/retest **NOT RUN**. Include non-two-decimal currencies and negative amounts in regression; repeat the original owned-ledger English and fresh Arabic questions after a verified repair.

## DEF-016 — Supported general-finance answer and evidence labels are misleading

P2, PHY-014: `general_finance` is an explicit source-supported route, yet its real provider answer declines a basic explanation for lack of owner financial evidence. UI marks the refusal as a confirmed fact and an old answer moments after generation. Scope/prompt and metadata classification need investigation; do not weaken verified-data protections for owner-specific numerical questions. Repair/retest **NOT RUN**.

## DEF-017 — Built-in Arabic advice suggestion selects savings-record status

P2, PHY-015: tapping “نصائح ذكية للتوفير” sends the displayed text and selects `savings_status`, asking for a specific record instead of advice. Source routing advice rule does not match this suggestion before the savings rule. Repair/regression/retest **NOT RUN**. Arabic provider delivery remains untested; this failed shortcut is not a provider failure.

Unused Google identity remains **BLOCKED** pending preparation; user reconfirmed this at the latest reply. No sign-out or second-owner data access attempted. Standalone acceptance remains **NOT RUN**; no client APK built or distributed.

<!-- direction-retest -->
## ENV-DEV-03 / RT-012–013 — Posting direction and localized system labels

Source commit `058385f83e6ed5ab46be21de41dea74bc786449f`. DEV-only package `com.masarifi.mobile.dev`; APK SHA256 `020ca2d2e69865becc325a53280c5293406df3bee2ea66a8791ef9d0ad087eb5`; signing certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; embedded bundle SHA256 `7ef55ef2ae760520e8cd50e8ddaf84655deb06dc829c070eb0b1c3f58ae3f7f6`. Isolated build completed in 1m57s, 853 tasks (14 executed). Same Staging development launcher and native DEV template; same verified signing identity. Installed 2026-10-21T20:14:43.306Z with `adb install -r`; existing owner and synthetic data preserved. Private `dev-direction-artifact.json`, `dev-direction-install.json`, `native-dev-review-direction.log`. No client package/build/distribution and no standalone acceptance.

The initial installer guard correctly refused to replace the app while the Home balance was scrolled offscreen; after scrolling to the observed 962 EGP Home, install succeeded. Initial post-launch UIAutomator idle failure provides no valid XML evidence; settled captures below are used. Screenshots precede XML, so the first Transactions screenshot shows loading; the later settled capture is the visual evidence.

| Retest / case | Preconditions, entry and steps | Expected | Actual / evidence / UTC | Result |
|---|---|---|---|---|
| RT-012-01 / DEF-012 positive direction | U-A, preserved A-EGP 962 EGP. 1. Select EGP wallet. 2. Open Transactions. 3. Inspect opening and summary. | Opening +1000 EGP; expenses 38 EGP; opening excluded from income/expense totals; balances unchanged. | 20:16:08Z `qa-direction-positive-opening-settled`: +1,000 EGP opening, -38 EGP expenses, +0 income. Owned DB later confirms +100000-minor opening posting, balance 96200. | **PASS** DEV subcase. |
| RT-013-01 / DEF-013 system localization | Same EGP feed. 1. Read opening and generic voice fallback. 2. Compare original user titles. | Arabic system labels; persisted/user titles preserved. | Same capture: “الرصيد الافتتاحي”, “معاملة صوتية”; original coffee and synthetic manual title remain unchanged. | **PASS** DEV subcase. |
| PHY-017 / ACC-008 credit opening subcase | Disposable U-A. Accounts → Manage → Add → Credit. 1. Enter `QA21 Credit Negative`. 2. Keep SAR, enter available 1500 and limit 2000. 3. Leave optional days blank. 4. Keep default off. 5. Save once. | One non-default credit account, one -50000-minor opening, no change to other accounts/default. | Saved 20:18:38Z; 20:18:48Z list -500 SAR, four active accounts, SAR total1493 with other-currency exclusion disclosure. `qa-credit-fixture-corrected-values`, `qa-credit-fixture-save-settled`, `credit-opening-db.json`. DB type credit_card, limit200000, balance-50000, pending0, defaultfalse. | **PASS** creation subcase; complete credit detail/payoff behavior **NOT RUN**. |
| RT-012-02 / DEF-012 negative direction | New credit fixture. 1. Recover Home using known DEV link after Back failure. 2. Select credit. 3. Open Transactions. | Opening -500 SAR, no invented positive income; zero ordinary expense/income; exact negative balance persists. | 20:19:55Z `qa-direction-negative-opening-settled`: -500 SAR opening, zero income/expense; `direction-retest-db.json` at20:20:18Z proves exactly one -50000 opening posting. A-EGP96200 and A-SAR199300 unchanged. | **PASS** DEV subcase. |
| RT-009-01 / DEF-009 navigation | After creating credit and reaching Accounts, press Android Back once. | Return to an accessible previous application destination. | 20:19:00Z `qa-credit-after-create-back`: stays on Accounts without an exit control. Source-resolved Home link at20:19:10Z recovers navigation; this is not a Back pass. | **FAIL**, DEF-009 remains open. |

Input automation temporarily put the available amount into the name field before Save; this was detected and corrected. No incorrect financial write occurred. Input tooling now re-verifies focused field after tapping and rejects clipped bounds. The final observed values were name `QA21 Credit Negative`, available1500, limit2000 before the one submission.

Repair details: special ledger kinds opening/adjustment/reversal derive their direction from validated confirmed account postings in selected and all-account projections. Existing version/identity/currency/amount consistency and owner checks remain. Presentation reads adjustmentSign; generic system titles use existing localization keys; positive opening no longer gets the salary fallback icon. No financial write or public API change. Physical reversal and negative-adjustment matrix **NOT RUN**; standalone retests **NOT RUN**.

Regression provenance: initial direction tests exposed ten failures; two UI test setup failures were corrected before the focused RED. A later icon assertion exposed an unwanted salary fallback. One intermediate repair broke the existing real-income icon contract, then was corrected. Final five-file run **139/139 PASS** (`opening-direction-green-accepted.json`), mobile typecheck PASS (`mobile-typecheck-direction-final.log`), scoped lint exit0 with one existing require-style warning. Interrupted/stalled and intermediate failed attempts retained privately. Latest complete per-file aggregate is551files/3896passed; no claim of a monolithic or physical pass.

Latest cleanup: A-CREDIT negativeSAR fixture retained with one opening; total owned ledger transactions now7 (previous6 plus this deliberate opening). A-EGP96200, A-SAR199300, A-CREDIT-50000 confirmed minor; pending0. No deletion/reversal/cleanup performed. The assistant no-ledger-effect evidence precedes this deliberate account creation and still applies to those informational turns.
