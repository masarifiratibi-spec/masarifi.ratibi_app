# iOS CI/test synchronization — 2026-11-07

The final published shared checkpoint is
`1440f3260ebaa1185527dd7d61c8fe1b7fc9e1e3`, merged into `iOS` as
`60462a99818144adc86285d172ca7d75392069fd`. It includes the initial CI update
`0ffccbd6`, shared identity/badging fix `26d49117`, disposable-database checker
`0247ed5e`, and their handoff documents. Application runtime, dependencies and
iOS build configuration were unchanged. The API package's database-lint command
now invokes the published checker and its tests.

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
| Final shared identity, compiled-badging, secret-scan and database-checker Node suites | 68 passed, zero failed/skipped; natural exit 0 |
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
tests are identical. The final 68-case run supersedes the earlier 39-case run;
their counts are not added together.

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
