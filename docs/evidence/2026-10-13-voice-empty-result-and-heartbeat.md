# Voice empty result and operating heartbeat correction

Scope: `codex/voice-promoted-operating-2026-10-13`, existing worktree, no consolidation.

## Confirmed incident

Read-only Staging evidence collected at 2026-10-13 17:19 Riyadh supersedes the earlier ON observation. The operating epoch closed at 16:13:27 Riyadh with `runtime_failed`. The scoped worker logged `failureStage: heartbeat` and the guarded driver reason `Query read timeout`. Automatic cleanup returned Posting OFF, stopped the owned writer/API, and restored the original API routes and analysis worker. No automatic reactivation occurred.

The latest capture, created at 17:06:59 Riyadh, completed in analysis-only mode with an empty analysis event list and no financial events. It was not financially posted. Two earlier captures in the operating epoch did commit, while a third event was skipped for `invalid_category`; the UI message alone is never financial evidence. The underlying reason the driver query exceeded its deadline remains unproven.

Home displayed the generic “analyzed, not saved” heading even for an empty completed analysis receipt. This is separate from a genuine nonempty unsaved analysis result.

## Narrow changes

- Retry only an exact guarded heartbeat `Query read timeout`, once, with identical epoch/worker/source arguments inside the existing shared heartbeat promise. A rejected repository transaction destroys its uncertain connection. SQL rechecks admission and cannot reopen a closed epoch.
- Block new work after stop during an in-flight heartbeat, suppress healthy observations after stop, and await a pending background heartbeat before financial finalization. A repeated failure still closes the runtime. Financial operations, claims, extraction, activation and recordings are never retried by this change.
- Render analysis-only cards only when they contain events. Retain real unsaved results and saved ledger rows in Arabic and English. Do not modify cache, journals or receipts.

## Local verification

Regression tests reproduced both defects before the production changes. After the changes:

- API: five focused suites, 57 passing tests, including shared heartbeat retry, stop races, persistent failure, finalization gating, connection disposal and financial non-retry.
- Mobile: three focused suites, 23 passing tests, including Arabic/English empty receipts, real nonempty receipts and mixed expired/current receipts without cache mutation.
- API and Mobile TypeScript checks and targeted ESLint checks pass. The initial API test lint findings were corrected; the focused worker suite was rerun successfully afterward.
- Workflow YAML parses. The dedicated qualification workflow runs only relevant regression checks and a disposable runner database. Two additional database cases verify repeated acknowledged heartbeats preserve a committed fixture's ledger/session and do not reopen a closed epoch. Hosted Staging credentials are not supplied to this workflow.

Independent source review is retained privately outside Git. [CI run 38416326128](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38416326128) at `b8e2d46e1e0ba35ba201a9daa60396f2702076ad` completed successfully: 57 API, 23 Mobile, and 66 actual disposable database tests, all with zero failures. The first CI attempt exposed a premature assertion in the mixed-receipt test; waiting for its visible query notification fixed the test without changing production code or increasing its timeout.

The signed Staging APK has SHA-256 `55df69b435348d8788de59c1865904e18098ad39a0aa879f53d56384e61542a9`. Independent signature/ZIP comparison confirms the original certificate, 92 native libraries, six DEX files, manifest and resources are preserved. Only `assets/index.android.bundle` differs from the installed qualified base.

Direct user approval authorized installation-only scope `320784de5352dcd459bb806897099eaae72d9943bb09a007a9b6fe523dc59c69`. Exactly one in-place installation occurred. Candidate hash, UID10304/versionCode1 and final DEFAULT/stopped state are confirmed by retained approved-operation responses. The executor rejected its intermediate assumption that installation would retain `disabled`; the actual last response was already DEFAULT/stopped, the required final state. Its original failed result is preserved unchanged, with a separate independently reviewed reconciliation. No recovery command, extra installation or automated launch occurred. CE/DE inode continuity confirms directory identity, not a fresh private-journal contents comparison. Manual physical UI acceptance remains pending.

The image qualification workflow binds both successful CI jobs to the exact branch, workflow path and source SHA, refuses application drift, then exercises container contracts and vulnerability scanning before publishing an immutable CI image. It runs on an edit to its own workflow on this branch, or an explicit workflow dispatch. Matching pushes bind the pinned successful regression source and still refuse application drift; manual dispatch requires explicit qualification inputs. It supplies no hosted deployment or activation command.

[Image CI38417735710](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38417735710) completed successfully at source `8e4f4ed94d96ca59b88903149f95f5def387f75b`: 26 container tests, nonroot image user, zero HIGH/CRITICAL findings. Remaining findings are 23 MEDIUM/eight LOW. Qualified image digest: `sha256:06c0de0f2c9ae6d091853e8617cecb9218be3a0395c80963c5129a26773a7308`. No Staging deployment or financial activation was executed.

## Preservation and release boundaries

This code patch does not activate Posting, replay any recording, change database schema/data or touch Production. The separate explicitly approved APK installation is recorded above. Existing unrelated uncommitted documentation remains outside this patch. Staging deployment and a new operating activation require separate approval, qualified artifact identities, fresh preservation checks and automatic failure shutdown. The previously closed epoch and its recordings must not be reused as new work; the existing strict canary release-binding gate must not be bypassed for a newly built worker image.
