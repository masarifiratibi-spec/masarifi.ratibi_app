# iOS CI/test synchronization — 2026-11-07

The final published shared checkpoint is
`4698fc18316968fd3d090907e1f3309c782384eb` on
`ratibi/codex/voice-promoted-operating-2026-10-13`, merged into `iOS` as
`c9917a720fbe9d2f21f8b5375bc8865242d45087`. It includes the initial CI update
`0ffccbd6`, shared identity/badging fix `26d49117`, disposable-database checker
`0247ed5e`, the earlier shared checkpoint `1440f326`, and their handoff documents. Application runtime, dependencies and
iOS build configuration were unchanged. The API package's database-lint command
now invokes the published checker and its tests.

## Published checker follow-up

Foundation on `1440f326` reached the concrete EXPLAIN checks but failed because
the standalone planner used the CI caller's permissions instead of the reviewed
SECURITY DEFINER function's identity. The source owner published `dd132809` and
`25746a98`, then confirmed the remote checkpoint above. Both commits are included.
The checker now verifies the exact function owner, definer flag and empty search
path before selecting that role for its 59 nonexecuting plans. Temporary grants,
local role/search-path changes and extension setup remain inside an unconditional
rollback. Query-string/fragment connection overrides are rejected.

The same published checkpoint includes reviewed release-helper scripts, their
fixture tests and documentation. Those files were synchronized; the migration
qualifier, SQL packet and Nginx tools were not executed here. No product migration
SQL, runtime, dependency or mobile configuration changed in this follow-up.
Full remote Foundation qualification remains the source owner's responsibility;
local unit results below do not establish its success.

## Published pgTAP inventory follow-up

Checkpoint `7e6f3995` changes only
`supabase/tests/054_phase13_operations_schema.sql`: two obsolete 53-job
expectations now require 54 jobs, and an additional assertion verifies the exact
Spec 004 financial-reset job, type, schedule, timeout, retry and cancellation
policy. Those values match the already-published migration registration. The
migration and all application/runtime/CI scripts remain unchanged from `ea087521`.

Read-only GitHub verification of [Foundation run 42391737577](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42391737577)
at this exact checkpoint confirmed successful `db:lint` and `test:db` steps.
The database job later failed at the fresh-database cross-feature security gate;
dependent downstream checks were skipped. The source owner subsequently published
the two test corrections in `5418a3e4`, now included here. This report does not
claim that the replacement Foundation workflow passed.

## Published security fixtures and isolated packet CI

The workflow-pin fixture now requires all four Android ABIs and the published
compiled-badging verifier, including its test-before-verification ordering. The
ownership fixture retains the accepted personal-ledger behavior after Admin
promotion while checking that another customer's ledger and replay remain hidden.
The final refinement also gives the fixture a real database support role, reuses
the exact recorded mutation commands and forbids conditional/continue-on-error
execution of the compiled Android identity check.
The SQL job assertion additionally pins its empty configuration. These changes
update tests only; no production API, mobile code or SQL policy changed.

The published packet workflow has read-only repository permission, pinned checkout
without persisted credentials and a source-branch/path-limited push trigger. It
runs offline fixture tests and a Linux trial inside a disposable private mount
namespace. It has no iOS/EAS build or hosted activation step, and pushing `iOS`
does not match its source-branch trigger. Release-tool files were synchronized
without invoking their deployment, database, Docker or privileged entry points.

Read-only GitHub verification confirmed that [Linux packet run 42396956430](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42396956430)
completed successfully at `4698fc18`, including the private-namespace Nginx trial
and the new disposable Docker restart-policy check. The replacement [Foundation run 42396963159](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42396963159)
at `4698fc18` was still in progress at verification. The ownership live-database test and
privileged Linux trial were not executed on this Windows workspace.

## Benchmark and rollback follow-up

Published commits `0b7679f9` and `4698fc18` synchronize the synthetic ledger
benchmark seed and packet rollback controls. The fixture enables the existing
profile initialization triggers for its synthetic owners, then restores its
replica-mode bulk loading inside the same transaction. No application code,
production migration or policy changes accompany it. The SQL seed and k6 write
gate were not executed in this Windows workspace; canonical benchmark execution
remains with the source owner's Foundation run.

The packet now keeps unaccepted trial containers from restarting automatically,
verifies exact accepted container identities before enabling restart, and adds
abort/post-accept rollback proofs. Its 58 offline tests passed locally. The new
real Docker restart-policy qualification passed only on the disposable GitHub
runner; no Docker or hosted release entry point was invoked here.

## Exact packet-finding provenance

The final gate initially blocked publication with 24 raw observations: 20 reviewed
and four unreviewed. Two originated in `a7cc6e0e`: a manifest SHA256 equal to the
Git contents of `api_archive.py`, and the literal baseline field name
`protectedLegacyApi3000`. The source owner reviewed the immutable blobs, lines,
columns, values and redacted spans, then published two narrowly bound classifiers
and the two original records in `029eac5f`. Historical Python is parsed as data;
it is never executed, and the manifest digest is checked against its Git sibling.

The other two observations belong only to iOS merge `8ee03184`. Their blobs match
the direct parent `5418a3e4`, which contains the original source commit. The
inventory blob is identical to the origin. The manifest blob and line changed,
so its new immutable context was reviewed independently and its SHA256 was again
proved equal to the source file at that merge. Commit `0905bc6b` adds exactly
these two records. All 14 published Android records and the eight earlier iOS
records remain unchanged. No generic merge, path, value or rule exception was added.

All 24 actual observations and the two incoming strict-scan observations were
accepted by the published classifier plus the exact catalog. The 22 new negative
controls reject copied commits/files, moved lines, changed rules, columns, spans,
redacted matches and altered catalog blob/line/value digests. The initial red
reports are retained alongside the final pinned-candidate verification.

## Reviewed iOS identity compatibility

The real identity command initially rejected the existing iOS profile: its new
comparison used profile `0389dff3`, while this branch already contains the
approved production-marker change `5482885f`. The app/EAS profiles were retained.

The narrow fix `45fcaac5b548b1e01570ac4b8541fe0a1e298819` selects the exact iOS
profile from `5482885f` only when that reviewed commit belongs to the candidate's
ancestry. Otherwise the original `0389dff3` profile remains required. Mandatory
branding/base ancestry, C0 package/project/Firebase/entrypoint bindings and
production safety checks remain in force. Unknown profiles, altered markers and
marker removal are rejected.

The CI source owner reserved the two guard files, reviewed this fix and tested
the same files against the Android branch. Its branch has no `5482885f` ancestor,
so its original profile remains unchanged. The owner published the same files
in `26d49117`; that published commit was then merged here. Shared CI scripts,
tests and workflow match the final Android checkpoint. No Android worktree or
branch was changed by this task.

## Local evidence

| Check | Result |
| --- | --- |
| Identity regression before the fix | 2 expected failures / 21 passing controls |
| Final shared identity, compiled-badging, secret-scan and database-checker Node suites | 71 passed, zero failed/skipped; natural exit 0 |
| Complete published packet against offline fixtures | 58 passed; natural exit 0 |
| Updated workflow-pin security fixture | 8 passed / 1 suite; zero skipped; natural exit 0 |
| Disposable Linux packet workflow on GitHub | Passed at `4698fc18`, including Docker restart-policy qualification |
| Changed Python helper syntax and published JSON | Passed without executing release helpers |
| Actual iOS identity command | Passed |
| Published pgTAP fixture and database lint in canonical GitHub CI | Both steps passed on `7e6f3995`; later security gate failed |
| Actual Android source snapshot through the same guard | Passed with the legacy profile and no runtime marker |
| Actual iOS profile/native-plugin configuration tests | 6 passed, zero skipped |
| Updated security route and generated OpenAPI contracts | 3 passed / 2 suites; natural exit 0 |
| Formatting of the two changed guard files | Passed |
| Incoming/own new history raw strict secret scan | 2 raw exact reviewed noncredentials; zero unreviewed findings |
| Full candidate-history secret gate | 24 raw observations, 24 exact reviewed noncredentials, zero unreviewed findings; exit 0 |
| iOS merge-catalog negative controls | 32 earlier controls and 22 new altered-context/catalog controls rejected |

The first temporary Git-fixture run on the E filesystem failed to recognize its
new disposable repositories. The unchanged stock tests passed when their
temporary directories were scoped to an owned NTFS location; the final run also
passed there. No global Git trust setting, scanner suppression, test timeout,
test skip or forced runner exit was introduced. Initial failures remain in the
evidence folder.

The approved upstream classifier was also exercised against the prior raw
Android 136 finding: one exact reviewed synthetic unit lease, zero unreviewed
findings, classification exit 0. Its original raw report was retained. The Node
suites include rejection of copied/altered contexts and real or unknown tokens.

The full-history gate initially reported eight additional observations from old
iOS merge commits: seven public Clerk SHA256 digests and one synthetic unit
lease. Each was independently verified as a byte-identical reviewed blob,
including its exact line, value, match bounds and a direct merge parent whose
ancestry contains the original reviewed commit. The CI owner reviewed and
accepted these eight immutable contexts and independently rejected 32 mutations;
the same negative controls were repeated locally.

The initial eight iOS fingerprints were added in `f4cca3fb` without changing
classifier code or path/value/family exceptions. The original twelve records
remain unchanged. The later shared `029eac5f` adds two original packet records;
the iOS-only `0905bc6b` adds their two independently verified merge observations.
The Android catalog therefore has 14 records and this branch has 24. Original red
scans and subsequent passing complete-history scans are retained.

Compared with the final shared checkpoint, the only intended differences under
`apps/`, `packages/` and `scripts/integration/` are the iOS profile, its regression
test and ten iOS history-catalog entries. All shared CI executable code and
tests are identical. The final 71-case run supersedes the earlier 70-, 68- and 39-case runs;
their counts are not added together.

The final 58-case packet run was repeated after the latest source merge and
supersedes the earlier 51- and 19-case runs. The previously verified 71-case Node
and eight-case workflow suite inputs are unchanged by this follow-up and were
not rerun unnecessarily. These counts are not added across successive runs.
The six iOS profile checks and three API contract
cases also retain their unchanged tested mobile/API inputs. These local results
were not rerun or relabelled as execution of the SQL or live-ownership fixtures.

API contract tests used live-database tests disabled and inert loopback service
URLs. The changed planning-worker live-database test is synchronized but was not
executed locally; disposable-database execution remains part of canonical CI.
These local results do not establish a complete remote CI run or hosted/device
acceptance.

Evidence: `E:\Masarifi-ios-artifacts\sync-ci-20261107-0ffccbd6`.
The earlier unfinished Modal work remains preserved in stash `ff79cf20` and its
verified E-drive backups, separate from this change. No app/EAS/iOS configuration
was changed, and no iPhone/IPA build, EAS build request, App Store submission,
hosted operation, live database mutation or phone operation was performed.
