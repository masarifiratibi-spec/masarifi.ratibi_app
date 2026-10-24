# Report closure candidate verification

Source commit: `7fc9c86d34353d8f9df64799c5a4992542b24a3b`. Main history is preserved through merge `c7532a27fae4475f4714701009e58dfaf87210fc`. [Draft integration PR #9](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/pull/9) carries the candidate. Evidence-only commits may follow without changing this implementation.

This is a review candidate, **not a production release qualification**. The [closure ledger](closure-ledger.json) retains 69 original references and 88 independently tracked acceptance units; no completion percentage is inferred. Billing and its grouped subscription subcheck stay open. Screenshots remain allowed everywhere, including local unlock.

## Local regression evidence

| Check | Observed result |
| --- | --- |
| API unit/contract | 263 suites, 2,149 tests passed |
| Other API offline projects | 100 suites, 307 tests passed; 138 suites/1,059 external tests skipped |
| Selected actual-PG service tests | 6 suites, 96 tests passed; tracking financial-content follow-up 86/86 passed |
| Actual MigrationRunner | 1 test passed: four forward migrations, idempotent rerun and exact inventory |
| Admin full suite | 104 suites, 1,001 tests passed |
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

- Both source-exact fresh/upgrade transactional candidates pass the 28 new sync/fee/upload cleanup checks; candidate changes roll back.
- Both full RLS paths pass **66 suites / 1,893 assertions**, with no inherited-failure allowlist. Refreshed baseline fixtures pass **64 / 1,865**. Eleven old failures were traced to fixtures that predated stronger verified-identity/suspension requirements or counted intentionally development-only templates; the assertions were preserved and fixtures brought into valid setup states. Production authorization was not relaxed. The old 12-failure T8 result remains historical evidence, superseded only for this local target.
- The real application migration runner applies all four registered forward migrations to the existing browser scratch target, runs idempotently, and passes exact object inventory. The refreshed inventory adds 12 tables and 81 functions tied to registered migrations.
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
