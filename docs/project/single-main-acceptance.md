# Single-main acceptance — work in progress

Baseline: `81736959a41833e235701182729383b1987ad66a`.
Candidate: `codex/unify-platforms-on-main` (not yet promoted).

Verified so far: recoverable four-ref bundle; exact protected backend trees; config regression RED then GREEN; manual-only signing/unsigned PR-main workflow policy; Zod 3 retained; no added OTA client.

Qualification results and final reviewed SHA will be appended after tests complete. Native iOS compilation and physical-device acceptance are mandatory distinct evidence; none is inferred from Windows tests. Keep old refs/worktrees until unique work is accounted for.

No server, database, OTA or Store deployment is part of this change.
