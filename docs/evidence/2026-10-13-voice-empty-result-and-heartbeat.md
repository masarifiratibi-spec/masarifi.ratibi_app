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

Independent source review is retained privately outside Git. Disposable database CI results must be verified before release qualification is claimed.

## Preservation and release boundaries

This patch does not activate Posting, replay any recording, deploy services, install an APK, change database schema/data or touch Production. Existing unrelated uncommitted documentation remains outside this patch. Deployment and a new operating activation require separate approval, qualified artifact identities, fresh preservation checks and automatic failure shutdown. The previously closed epoch and its recordings must not be reused as new work.
