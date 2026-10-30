# T05 current-candidate database qualification — 28 October 2026

**PASS in the original candidate-qualification scope. T04 is accepted; T06 is now eligible. Hosted migration parity and deployment are not approved by this result.** Sole responsible model: GPT-6.1 Sol Extra High. [Structured evidence](evidence.json) records the acceptance timestamp and all limits.

## Candidate and target identity

The original plan names 174 migrations. All 174 files remain LF-identical to qualified commit `70a989e0fa746cce784c0e7725e2d641c0d421a2`; all 67 previously qualified SQL test files also remain unchanged. Current inventory is 176, adding `20261023200000_scoped_operations_claims.sql` and `20261028114000_tracking_reference_free_correlation_review.sql`. No historical migration or checksum entry was rewritten by T05. The current migration checksum command passed.

Qualification reused the previously approved PostgreSQL 18.6 cluster at `127.0.0.1:55442`, system identifier `7699798384845591272`, under the retained Admin-recovery `native-db/data` directory. It created no environment, database, cluster, role or credential. The separate Windows service on port 5432 and the existing PG17 fixture were preserved.

Both retained targets, `admin_recovery_rls_fresh` and `admin_recovery_rls_upgrade`, initially had 165 exact canonical history bodies, with their previously recorded fresh/upgrade lineage. All seven financial tables were empty. The actual application MigrationRunner applied the 11 pending migrations to reach the exact 176-file history on each target and passed its required idempotent rerun. This extends the retained lineage; it is not a newly initialized zero-state Supabase17 run. The browser scratch target had one unexplained historical text discrepancy and was excluded from writes.

## Current results and bounded correction

| Producer/check | Result |
|---|---|
| Migration checksum command | PASS; 176 registered files |
| Actual MigrationRunner, both retained paths | 165 → 176; exact canonical history; idempotent reruns PASS |
| Actual Jest migration application/checksum rejection/lock contention | 3 suites / 3 tests per path; zero skipped; PASS |
| Changed-wrapper composition: SQL 035, 036 and 067 | 104 assertions per path; PASS |
| New named BR3/BR4 card-posting fixture | 13 assertions per path; PASS; rollback contained |
| Seven complete local financial-data fingerprints | Unchanged after qualification and all fixture tests |
| Global role memberships around Jest and card fixtures | Preserved exactly |
| Final owned cluster lifecycle | Smart shutdown verified; no listener/PID file; configuration hashes unchanged |

The first exact-inventory check failed on both current schemas because its expected function multiset omitted one registered `claim_due_jobs` overload and `finalize_import_session_before_correlation_review`. The test now lists those two exact entries. No wildcard, exclusion, production assertion or authorization guard changed. The subsequent actual Jest gates pass. The failed result and test preimage remain preserved.

The new SQL fixture verifies signed card liability, equal and opposite bank/card postings, unchanged net worth, transfer classification, no invented fee and exclusion from income/expense summaries. It executes only synthetic ledger commands inside rollback transactions. It does not execute a real card payment or enable the deferred payment feature.

`npm run test:db`'s Docker-dependent CLI wrapper was not invoked: the existing engine is unavailable. Relevant current SQL ran directly through the already approved native pgTAP fixture, with actual TAP output and SQL-error detection. The unchanged 67-suite / 1,929-assertion historical fresh/upgrade evidence is reused rather than rerun. Current affected cases and the added card case extend that evidence; their counts are not presented as a new complete 68-suite run.

## Requirement reconciliation

| Original criterion | Evidence and boundary |
|---|---|
| Whole historical chain and current additions, fresh/upgrade compatibility | Exact unchanged 174-source/67-test binding; recorded retained lineage; actual 165→176 runner and idempotence on both targets; exact inventory and current affected SQL results |
| RLS and isolation | Reused full qualified RLS evidence; current worker-context/ACL/frozen-owner cases; no permission relaxation |
| Fee rejection and safe minor units | Reused unchanged ledger/closure fixtures; both current schemas retain the registered definitions and exact inventory |
| Currency grouping, transfer/refund read totals | Reused unchanged report schema/financial semantics cases; BR1 transfers excluded and BR2 linked refunds reduce expense; existing financial-parity fixture sources remain identical |
| BR3 liability and BR4 payoff posting meaning | New real-SQL fixture on both current schemas; unchanged financial-parity/net-worth sources; actual payment execution stays deferred |
| Planning receipts and operation idempotency | Reused unchanged closure/planning/idempotency SQL and historical integration evidence; current canonical functions preserved |
| Added scoped claims and correlation wrapper | Existing named PG17 regressions retained; current full-schema migration and affected tracking composition pass; upstream-stub limitation of the old correlation unit fixture remains explicit |
| Hosted metadata | Fresh READ ONLY history, source and constraint inspection below; no parity inference or application |
| Separate nullable `source_version` finding | Recorded N04/P3 below, outside the 69-reference denominator; no unapproved fix |

## Hosted boundary and N04 follow-up

Hosted Staging remains PostgreSQL 17.6 with 169 migration entries. Comparison found 162 matching version identifiers: 156 literal text matches after LF/outer-whitespace/final-semicolon normalization, plus six separately inspected role/preflight-wrapper cases. Their candidate core statements are present literally and in order. Five additional same-name timestamp aliases exist: four literal text matches and one identical core plus a guarded preflight. Nine candidate filenames have neither their canonical version nor a same-name alias recorded. Two hosted-only entries are prior Staging runtime actions. These are source/history findings, not proof of complete live object parity.

The hosted history is not a canonical prefix. The strict migration runner must not be pointed at it to bulk-apply guessed missing files. No hosted history, function, policy, worker, financial row or configuration changed. Full current-176 fresh/upgrade qualification on the configured Supabase17 platform remains an explicit external/release boundary; native18 results do not assert it. This task introduces no deployment or dependency waiver.

The actual hosted `ai_case_source_complete` CHECK still allows UNKNOWN when both source identifiers are present and `source_version` is NULL. READ ONLY inspection confirms the column is nullable, the predicate accepts that synthetic truth-table case, and the current incomplete-row count is zero. No exploit is claimed. N04 remains a separate P3 hardening follow-up: any fix requires a specifically approved additive migration and direct constraint rejection/acceptance regression. Historical SQL must remain unchanged.

## Preservation and review

Sol reviewed the two-entry inventory correction and the single coherent card-posting fixture using test-guard. Independent evidence comes from actual PostgreSQL/Jest/pgTAP execution, authoritative hosted READ ONLY results and the named historical CI/PG17 receipts; self-review is not substituted for those producers. No mobile product code or native artifact changed, so T05 adds no new mobile behavior requiring a new Xiaomi journey. Existing device acceptance remains attributed to its original task; T06 retains its own device requirements.

All inherited source/evidence hashes remain preserved, allowing only the explicitly recorded accepted T04 evidence update. The two originally self-excluded snapshot files retain their stated handling; the Git snapshot matches its handoff manifest. All 282 older R18 artifacts remain unchanged. The original 29-task plan, 62/69/88 denominators, branch/HEAD and empty staged index remain. Private receipts, raw TAP/Jest logs, history comparisons, preimages and lifecycle records are retained under `.superpowers/sdd/2026-10-25-astra-readiness-remediation/T05/compatibility-2026-10-28`.
