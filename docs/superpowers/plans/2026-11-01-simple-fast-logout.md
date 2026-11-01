# Preserve data during simple, fast sign-out

Latest explicit user direction supersedes the sync-first removal default: ordinary sign-out must retain the same owner's encrypted local database, drafts and pending work; skip full sync and removal confirmation, suspend native intake, terminate only the pinned Clerk session, release local access/cache and keep a durable preserve disposition until cleanup finishes. Same-owner authenticated login reopens the retained database; another owner must not read it. Existing explicit removal and account deletion remain separate. Keep the single progress overlay. Add failing persistence/owner/crash-recovery tests, verify source, then perform one actual same-account logout/login and compare current projections and2026-13. No assistant/provider trial, new account, APK or Metro restart.

User scope: show only Signing out during ordinary sign-out, finish without unnecessary waiting, then reach the existing login screen. Preserve owner isolation, current data,2026-13, APK and Metro12652. Assistant creation stays deferred.

- [x] Reproduce premature recovery presentation, unconditional sync and missing planning-draft protection with failing tests.
- [x] Reuse the shared logout operation for owner-scoped progress; cover route transitions without restarting the navigator.
- [x] Skip synchronization and removal confirmation for ordinary preserving logout; suspend intake, drain admitted draft writes and terminate only the pinned session.
- [x] Retain encrypted database/key/drafts/queues; fence and release local access with durable restart recovery.
- [x] Preserve distinct legacy/encrypted SMS work and reject conflicting submissions before deletion.
- [x] Remove registration-preview copy from returning sign-in while retaining legal links and Welcome behavior.
- [x] Verify588 mobile suites /4443 tests, TypeScript, targeted lint and1254-file boundaries; address independent review findings.
- [x] Restore the missing draft exactly under the user's explicit instruction and verify all other current projections unchanged.

- [x] Perform one real same-account logout/login; verify all16 current projections exactly match,13 transactions and2026-13 retained, APK/Metro unchanged.
- [x] Inspect recorded transition: progress only, then clean sign-in, approximately4 seconds in this run.

See [acceptance evidence](../../evidence/2026-11-01-simple-fast-logout.md). Private snapshots and consumed intents remain local; no repeat live trial or restoration is required. Normal logout's preserving policy supersedes the earlier sync-first/removal proposal; explicit destructive paths remain distinct. The precedingbe3ffaf9 workflows all succeeded; assess new-head CI separately after push.
