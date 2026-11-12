# GitHub follow-up to source preparation

On 12 November 2026 the user explicitly requested publishing the prepared changes, monitoring CI until successful and asking the iPhone chat to synchronize its branch, while continuing to prohibit a new installable application build.

Published source initially: `38ce8ba6c288e4b327ee0f700feec0c101f9acaf` on `ratibi/codex/voice-promoted-operating-2026-10-13`, PR #9. The earlier `report.md` and `verification.json` record the local preparation phase before that push; their no-push/no-CI statements refer to that phase.

The first Foundation run, `43253643768`, exposed an Admin packaging problem after typecheck, lint and all Admin tests passed. Turbopack could not resolve any of the four shared legal JSON imports outside the Admin app root. Installed Next documentation explicitly states that files outside `turbopack.root` are not resolved, and that monorepo output tracing similarly defaults to the app directory.

The fix sets both `turbopack.root` and `outputFileTracingRoot` to the repository root. It keeps the existing single legal source and existing runtime/authentication validation. A regression verifies that the actual four JSON imports exist and remain within both effective configured roots. It failed on the original app-only defaults and passed after the fix. The full public legal test group passed, nine tests in two files.

No EAS invocation, IPA/APK/AAB generation, manual application build, deployment, live deletion or customer notification is part of this follow-up. Existing automatic GitHub validation still runs its usual compilation, database, browser and image checks; it does not publish an installable mobile release. Final head, completed run URLs and iOS synchronization must be checked live rather than inferred from this intermediate record.
