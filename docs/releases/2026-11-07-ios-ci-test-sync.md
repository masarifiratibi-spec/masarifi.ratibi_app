# iOS CI/test synchronization — 2026-11-07

The final published shared checkpoint is
`ea087521e72174c6fb6f630e96a4dffdcf6d10f7` on
`ratibi/codex/voice-promoted-operating-2026-10-13`, merged into `iOS` as
`196c6d0324d339242d2faf60354961e7298d5edc`. It includes the initial CI update
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
The new remote Foundation qualification remains the source owner's responsibility;
local unit results below do not establish its success.

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
| Final shared identity, compiled-badging, secret-scan and database-checker Node suites | 70 passed, zero failed/skipped; natural exit 0 |
| Changed routing/context helpers against offline fixtures | 19 passed; natural exit 0 |
| Changed Python helper syntax and published JSON | Passed without executing release helpers |
| Actual iOS identity command | Passed |
| Actual Android source snapshot through the same guard | Passed with the legacy profile and no runtime marker |
| Actual iOS profile/native-plugin configuration tests | 6 passed, zero skipped |
| Updated security route and generated OpenAPI contracts | 3 passed / 2 suites; natural exit 0 |
| Formatting of the two changed guard files | Passed |
| Incoming/own new history raw strict secret scan | Zero findings |
| Full candidate-history secret gate | 20 raw observations, 20 exact reviewed noncredentials, zero unreviewed findings; exit 0 |
| iOS merge-catalog negative controls | All 32 altered commit/location/rule/match cases rejected |

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

Exactly eight fingerprints were added to this branch's catalog in `f4cca3fb`.
The original twelve entries remain unchanged. Classifier code, rules and
path/value/family exceptions were unchanged. The Android catalog remains
unchanged: these are observations specific to iOS merge history. Both the
original red scan and subsequent passing complete-history scans are retained.

Compared with the final shared checkpoint, the only intended differences under
`apps/`, `packages/` and `scripts/integration/` are the iOS profile, its regression
test and these eight history-catalog entries. All shared CI executable code and
tests are identical. The final 70-case run supersedes the earlier 68- and 39-case runs;
their counts are not added together.

The six iOS profile checks and three API contract cases were run before this
follow-up; their tested mobile/API runtime and configuration inputs are unchanged.

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
