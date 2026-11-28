# Single-main source and recovery receipt — 2026-11-28

Only the following approved refs were read as integration sources from `ratibi` (masarifiratibi-spec/masarifi.ratibi_app):

| Ref | Pinned source |
|---|---|
| main and codex/voice-promoted-operating-2026-10-13 | 81736959a41833e235701182729383b1987ad66a |
| codex/google-play-release-2026-11-24 | f00e5de695ad0c83dec6845b0f7ed4681153f758 |
| iOS | 837ec4358c8531e8acd062b8a260a60baa3aac93 |

Recovery bundle: `D:/Masarifi-single-main-backup-20261128/approved-refs.bundle`.
SHA-256: `887DDB663F297EE7C11D4E9C874A27C844DF6236C171A7EA96044173BD825C26`.
`git bundle verify` passed. Restoring the bundle into an independent bare repository resolved all four refs to these exact commits.
The bundle contains committed history only; it does not back up uncommitted working files or production data.

Candidate workspace: `D:/Masarifi-main-readiness-20261128`, branch `codex/unify-platforms-on-main`. Existing validation worktree reused; unrelated prior evidence retained. Mobile dependencies installed in this workspace; prior dependency junction retained in plan scratch, not removed or modified at its target.

## Preserved uncommitted work

- main: 1 status entries preserved in their original checkout.
- operating: 91 status entries preserved in their original checkout.
- play: 2 status entries preserved in their original checkout.
- ios: 5 status entries preserved in their original checkout.
- ios-independent: 0 status entries preserved in their original checkout.

Operating contains historical documents and operational scripts; Play contains two Admin template edits; E:/ iOS contains five untracked device evidence screenshots. These are not silently merged or discarded. The independent D:/ iOS checkout was clean. Their exact paths are in the local execution inventory. Branch/worktree deletion is deferred until these items receive a separate disposition.

Main's one pre-existing untracked file was the approved consolidation plan. It was copied to the candidate without removing the original.

## Diff decisions

See `single-main-decisions.csv` for all 343 source/path comparisons (22 Play and 321 Apple). Counts include documentation/evidence. The candidate preserves current API, Admin, packages, database, ops and Docker content. Apple mobile additions are reconciled with Play settings and baseline Zod 3. Old release receipts remain historical evidence in the bundle; they do not establish current deployment status.
