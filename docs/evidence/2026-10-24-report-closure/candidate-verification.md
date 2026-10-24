# Report closure candidate verification

Source commit: `3026ac60100d46c856321ab195c80823dfff1913`. Main history is preserved through merge `c7532a27fae4475f4714701009e58dfaf87210fc`. [Draft integration PR #9](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/pull/9) carries the candidate. Evidence-only commits may follow without changing this implementation.

This is a review candidate, **not a production release qualification**. The [closure ledger](closure-ledger.json) retains 69 original references and 88 independently tracked acceptance units; no completion percentage is inferred. Billing and its grouped subscription subcheck stay open. Screenshots remain allowed everywhere, including local unlock.

## Local regression evidence

| Check | Observed result |
| --- | --- |
| API unit/contract | 263 suites, 2,150 tests passed |
| Other API offline projects | 100 suites, 307 tests passed; 138 suites/1,059 external tests skipped |
| Selected actual-PG service tests | 6 suites, 96 tests passed; tracking financial-content follow-up 86/86 passed |
| Actual MigrationRunner | 1 test passed: seven forward migrations, idempotent rerun and exact inventory |
| Admin full suite | 104 suites, 1,002 tests passed |
| Admin build/typecheck/lint | Passed using explicitly inert CI build configuration; /delete-account compiled |
| Mobile final complete serial suite | 559 suites, 3,992 tests passed after final disclosure routing/copy changes |
| Mobile typecheck/lint/boundaries | Passed; lint retains 116 inherited warnings and no errors |
| Parser | 109 tests passed |
| Native SMS JUnit | 15 suites, 96 tests, zero failures |
| Native prebuild and minification | BUILD SUCCESSFUL, 489 tasks; R8 8.13.19 |
| Final release manifest | Forbidden storage/overlay/media-playback permissions, development scheme and transitive wallet query absent |
| Production JS diagnostic export | Passed; 13 production service entrypoints and no checked mock/test/demo/purchase-screen sources |
| Build/profile policy | 13 tests passed |
| Identity / merged-manifest checker | 6 / 4 tests passed |
| Workflow contract | 8 tests passed; all 28 setup-node steps explicitly select npm 11.17.0 |

Exact commands and raw local log hashes are in [candidate-verification.json](candidate-verification.json). Raw exploratory logs remain locally available and are not forced into Git. A prior full Mobile run had one five-second timeout while the native compiler was competing for resources; the unchanged TransactionForm suite then passed 105 checks and the subsequent complete serial run passed. No timeout or production assertion was weakened. A stale workflow command-string expectation was updated to the serial command and its eight tests passed. Admin's initial unconfigured build correctly rejected absent API bindings; its explicit inert-configuration diagnostic build passed.

## Database qualification

Only the previously approved disposable PostgreSQL 18.6 cluster at localhost:55442 was used, after verifying its data directory and migration history. No new cluster, shared/hosted reset or production migration was performed.

- Both source-exact fresh/upgrade transactional candidates pass the 50 new sync/fee/upload cleanup/worker-context checks; candidate changes roll back.
- Both full RLS paths pass **67 suites / 1,915 assertions**, with no inherited-failure allowlist. Refreshed baseline fixtures pass **64 / 1,865**. Eleven old failures were traced to fixtures that predated stronger verified-identity/suspension requirements or counted intentionally development-only templates; the assertions were preserved and fixtures brought into valid setup states. Production authorization was not relaxed. The old 12-failure T8 result remains historical evidence, superseded only for this local target.
- The real application migration runner applies all seven registered forward migrations to the existing browser scratch target, runs idempotently, and passes exact object inventory. The refreshed inventory adds 12 tables and 83 functions tied to registered migrations.
- Hosted Supabase remains on PostgreSQL 17.6 with 165 migration entries. Its candidate/provider behavior is still an external gate. Local all-green RLS does not claim hosted parity.

Receipts: [fresh](admin_recovery_rls_fresh-rls.json), [upgrade](admin_recovery_rls_upgrade-rls.json), [inventory](migration-inventory-refresh.json). Reproducers verify the exact retained test target before proceeding.

## Artifact limits

The diagnostic native output is unsigned and uses inert configuration. Full R8 compilation and the final manifest were qualified separately, as documented in [native-diagnostic.json](native-diagnostic.json). R8 still emits Kotlin metadata parsing warnings. Startup, SQLCipher, Clerk, voice, tracking, notifications, themes and app links must pass on the final signed/minified artifact. No physical Android device was attached. Existing Jest forceExit warnings remain; this does not establish clean async teardown.

The refreshed JS bundle/source-map audit is [production-bundle-audit.json](production-bundle-audit.json). Its SHA-256 identifies a diagnostic source export, not the final signed AAB. The approved endpoint, identity, version, upload certificate and bundle must be qualified together later.

## Existing production configuration and operator gates

The requested [read-only inspection report](production-configuration-inspection.md) records existing Hostinger, Supabase, Clerk, GitHub and EAS configuration. A valid EAS-managed JKS already exists and matches the retained internal APK. **No new key is needed based on current evidence.** A live Clerk instance exists on a Staging domain; it must not be confused with a separately approved production binding. Production EAS variables are empty; no production API origin was verified. The current Play account opens signup, so its intended publisher/signing/version history cannot be assumed.

Remaining gates: intended Play publisher and registered upload certificate; production environment decision and release label; existing EAS code 1 implies next code 2 subject to Play history; dedicated server cursor key configuration; final signed AAB; physical-device/offline/OEM/RTL/screenshot acceptance; real hosted provider, sender fixtures, delivery and seven server behaviors; public deletion/privacy URLs; SMS approval, Data safety and applicable closed testing. No passwords, private keys or keystore exports are needed in chat.

The first remote candidate exposed a stale whole-file SQLite source pin, a test dependency on an already generated Gradle policy, old direct Supabase CLI bootstrap calls that lose the invoking history role, and two tracking fixtures whose collision/replay tests assumed bare-riyal currency. The three extracted SQLite schema segments are byte-identical to C0; the full-file pin was refreshed. Prebuild installation is now exercised in a clean temporary project with overwrite/idempotency checks. Existing guarded canonical migration setup is reused for disposable CI start/reset/migrate while preserving historical SQL. The collision/replay fixtures now explicitly name Saudi riyals and all 86 actual-PG checks pass. Historical image publication now requires explicit invocation with its original qualification gates retained. Exact updated integration-candidate CI remains pending. Main required-check configuration remains open; repository infrastructure/settings were not changed during inspection. Billing stays explicitly deferred with the requested Stripe/Google Play policy TODO. The non-PDF nullable source_version CHECK is separately tracked and does not increase the 69-item inventory.

The native diagnostic output predates a semantics-preserving extraction of its file-copy helper; the clean-project test verifies all three checked policy files are installed and stale generated copies are replaced. Final signed-artifact qualification remains mandatory.

## Remote qualification continuation

At `41baa43b`, remote API application, Admin, Mobile, secret/redaction checks, authenticated voice, 249 voice/tracking integration checks and all three encrypted-journal jobs pass. The full database job then exposed a historical upgrade fixture that inspected owner-guarded functions without owner claims and compared a 110→111 snapshot against every later policy release. The fixture now supplies scoped owner claims, tests the exact registered nominal migration prefix, and leaves full-candidate financial-history upgrades as independent checks. No old migration or production authorization guard changed. Eight negative target/operation/version tests pass before any database connection. Browser qualification stops on its first failure while retaining the same tests and retries; failures still fail the job. Updated exact-candidate CI remains pending.


## Broad integration repairs and current qualification

At `6e0a1d6c`, remote application, Admin unit/build, Mobile, secrets/redaction, Android minification/identity and all encrypted-journal jobs pass. The broad upgraded-database run then failed 19 suites (116 tests), while five browser viewports failed a stale expectation that deployment-only import settings were editable.

`1426e90e` repairs demonstrated production defects: worker configuration reads now bind owner identity from a live server-issued import lease; fallback tracking operation IDs are owner-specific; profile activity updates acquire the writer lock before the active-profile shared lock; and a new forward migration restores transfer source/external-reference and multiline-note support lost by the earlier fee fix. Existing authorization, lease, posting, replay and deletion guards remain enabled. The additional SQL tests include wrong/stale lease, suspended owner, claims restoration, worker-only ACLs and transfer provenance. Historical migrations are unchanged.

Fixtures now provide the claims required by existing guards, create their own synthetic source rather than reviving disabled demo institutions, use real disposable operating epochs for voice, and isolate other retained owners' pending claims through row locks. The explicit disposable planning guard accepts the existing GitHub database; it was not broadened to workstation or hosted targets. Local qualification reran the other 18 failing suites: **171/171 tests passed**. The planning suite and the complete upgraded/fresh integrations remain mandatory remote checks. The new cross-owner operation-ID regression failed before its fix and passes afterward. All 263 API unit/contract suites (2,150 tests), three build targets, typecheck, lint, formatting and migration checksums pass.

`d67dafb7` preserves the accepted read-only import settings page in browser expectations. All 675 browser tests remain listed across five viewports, with lint passing. Full exact-candidate GitHub qualification is pending; no all-green CI claim is made here.

A repository administrator must configure required checks on main. The current account has push/triage access but no admin/maintain rights. No branch protection, production configuration, DNS, hosted schema, credential or deployment was changed during this inspection.


At `3cddb81d`, application, Admin unit/build, Mobile, secrets/redaction and voice/tracking CI pass. Its historical 110→111 verifier used the current repository after that repository gained a migration171 context RPC. `112e336a` instead verifies the exact 110/111 schema and executes its original prepared-import function with owner claims and the worker role. The complete current-candidate worker remains independently covered; no production fallback is added. Eight negative target guards pass, with unregistered versions rejected before loading the compiler.

The browser run then exposed missing support overview and older ticket list/detail fixtures. `3026ac60` aligns the mock with the current live client DTOs, keeps permission denial, and tests list/detail/overview plus a real client mutation and refreshed counts. The new contract case failed before the repair; three focused suites pass 20 tests, and the full Admin suite passes 104/1,002 with typecheck/lint green. The keyboard browser test uses the current action selector and required audit reason. Its assertions are retained.

The 390px English browser trace records a 417px layout viewport because the full environment badge widened the toolbar; the panel inherited that wider containing viewport. The mobile toolbar now allows the badge text to shrink while keeping its full accessible label, and the portal panel uses an explicit viewport width. The existing browser viewport assertions remain unchanged. Remote browser acceptance is still pending on this source.


At `59f496b1`, all historical upgrade checks pass and the complete upgraded-schema integration reaches **144 passing suites / 1,001 passing tests**, with seven suites / 116 tests skipped for their prerequisites. One test still assumes a 12-currency registry after earlier fixtures added five synthetic enabled currencies. `2b7982cb` compares the enabled registry and its deterministic order while retaining inactive/anonymous denials. It passes locally with 13 enabled currencies; the extra fixture is removed in `finally`.

The 390px notification-panel test and all 22 Phase11 route checks now pass in the browser. Its next failure expects campaign creation that the accepted recovery code explicitly defers. The same test-only commit verifies the disabled gate in Arabic/English, privacy-safe content and absence of campaign mutation requests. Campaign creation is not enabled to satisfy an obsolete fixture expectation. All 675 browser cases remain selected. Fresh full-candidate qualification is pending.


At `7f227c5e`, four browser viewports pass. The desktop-1440 artifact confirms a visible action combobox named "الإجراء"; `1dcfd399` uses that accessible role/name instead of matching the surrounding label's combined text. No production UI or timeout changes. The same run's upgraded integration has two default 5,000 ms tracking replay-journey timeouts; those cases passed on the previous candidate with unchanged production code. An unchanged-source database retry is pending completion of the workflow. These failures are retained, not relabeled as passing.

The [native compatibility receipt](native-compatibility-inspection.json) records the resolved API 36/min 24 manifest, mobile lockfile and library hashes. All 38 merged 64-bit libraries pass LOAD alignment and RELRO protected-range checks, including the official separate-LOAD exception. This is not final signed-package zip alignment or 16 KB device runtime acceptance. Root-domain /privacy and /delete-account currently return HTTP 200 parked-domain HTML; they do not satisfy the public-page gates.
