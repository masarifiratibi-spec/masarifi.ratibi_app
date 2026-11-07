# Functional acceptance ledger

Status: **NOT READY FOR PRODUCTION**. This is an evolving evidence ledger, not a completion certificate.

The machine-readable [ledger](functional-acceptance-ledger.json) reconciles all 69 original references / 88 acceptance units, 62 separate client IDs and 29 historical task IDs with no missing or additional IDs. Historical evidence remains identified by its original commit and does not establish acceptance of the forthcoming APK. All final-APK rows are currently `NOT_RUN`; no QA write has been performed on the preserved user account.

The approved plan includes current budget and savings functions. It does not resume closed performance comparisons. Payments, subscriptions, iOS and Google Play publication remain deferred. Accepted PIN timing and cancelled TalkBack dispositions remain exceptions; generic export acceptance does not revive previously cancelled ZIP acceptance.

## Final APK cases to execute

Use the final installed artifact and record its hash, source commit, signer, version and build number with each run. The safe QA namespace is `PRDQA-20261105-<case>`; record exact operation IDs before any retry and reconcile uncertain outcomes first. Preserve all original records. Cleanup may affect only demonstrably tagged reversible QA records and may not delete an account or replay original operations.

| Area | Required current behavior | Current final APK status |
| --- | --- | --- |
| Google / session | Preserved Redmi SDK session restores Home after cold start; fresh Google OAuth on a separate clean authorized target | NOT_RUN |
| Accounts | Read existing accounts; reversible QA account/edit; balance and currency reconciliation; retained Accounts navigation improvement | NOT_RUN |
| Transactions | Expense/income/refund/edit with exact operation IDs, correct totals and validation | NOT_RUN |
| Transfers | Single transfer with linked debit/credit, correct same/cross-currency balances and duplicate retry behavior | NOT_RUN |
| Salary | Read schedule; tagged reversible plan/occurrence, timezone and correct totals | NOT_RUN |
| Budgets / savings | Create/edit tagged plan or goal, validation, progress, income/savings targets and Home entry | NOT_RUN |
| Obligations | Read originals; tagged reversible schedule/edit, correct outstanding total and civil dates | NOT_RUN |
| Reports | Date/range/currency selection, cash flow, category bars, net worth and period comparisons without reviving performance comparisons | NOT_RUN |
| Export | Authorized output and lifecycle, own data only, readable produced artifact; previously cancelled ZIP remains excepted | NOT_RUN |
| Notifications | Preferences, foreground/background action and correct scoped confirmation without duplicate financial effects | NOT_RUN |
| Support | Form/read status and validation; do not send a message externally without explicit bounded send authorization | NOT_RUN |
| Settings / security | Language/theme/profile/app-lock/recent-auth, readable errors, ordinary preserving lifecycle and owner isolation | NOT_RUN |
| Assistant | Explicit consent, grounded own-data reads, scoped authorized action and readable failure; no paid-provider cohort | NOT_RUN |
| Voice | Original Voice001 correlated read-only to completed empty server batch, no financial effect; intended voice correctness still requires final APK case | NOT_RUN |
| SMS / notification Tracking | Explicit activation from boundary; capture → parser → owner queue → HTTP → worker → ledger → scoped confirmation/UI | NOT_RUN |
| Tracking recovery | Duplicate/offline/process restart/permission change/disable/re-enable and stale generation, with all old work retained | NOT_RUN |
| Package / continuity | Final/installed/delivery/source equality, production signer, API24 fresh-install scope, 16KB and safe higher-version rollback | NOT_RUN |

## Original Voice001

The original protected receipt remains unchanged. New [read-only reconciliation](voice001-read-only-reconciliation.md) strongly correlates the original timing, native duration and named QA account to one confirmed server session with a completed empty batch and completed provider attempt. Zero voice events, proposals, linked transactions or postings exist; the bounded QA-account window also has zero voice-source postings. Exact recovered session/operation IDs are private. The original client did not capture immutable IDs, which limits the correlation. No replay, new recording, provider request or mutation occurred. The planned spoken clip was not played; intended voice correctness and final APK acceptance remain unverified.

## Current source and fixture repairs

- Owner lifecycle drains admitted source changes before SDK termination; owned source/journal purge validates attribution before native cleanup and uses consistent lock order.
- Physical database cleanup inspects retained queue ownership using existing keys before any file removal. Foreign, malformed and un-attributed data remains preserved. Interrupted cleanup uses a protected receipt; filenames alone do not prove ownership.
- Explicit database quarantine retains the exact original encryption key, fences ordinary opens during partial moves and refuses to overwrite an existing recovery backup. Unknown key-loss backups remain unknown and preserved.
- Two category test teardowns now remove their own cursor metadata before deleting fixture profiles. Both previously failed their post-teardown integrity assertions; focused verification now passes. Old failing fixture databases and receipts remain retained.

Focused results and whole-suite attempts are retained privately in this plan's evidence workspace. A whole Mobile run ended with Node process memory exhaustion; it is not a passing gate. Its two failed deletion fixtures were corrected at the unavailable native I/O boundary using real SQLite inspection; the focused48cases pass. The final bounded-worker whole Mobile gate passed611suites/4877tests, including the strict metadata/interruption guards; focused cleanup qualification passed217cases/11suites. Types, changed-file lint and frontend boundaries pass. All132previously skipped API cases now have isolated passes (54+57+5+12+4); the identity fixture uses the real erasure service, exact resumable-deletion assertions and scoped FK teardown. The current code has not yet been installed on Redmi or copied to delivery, no hosted migration/deployment or primary signing transition occurred, and nothing has been pushed.
