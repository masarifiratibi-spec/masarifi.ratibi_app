# Verified preservation and isolated recovery

Original checkouts are unchanged. Recovery must use a new destination; do not reset, clean, overwrite or remove an original worktree. No branch, stash or historical evidence was discarded.

## Primary verified backup

Directory: `C:/Users/DELL/.codex/backups/masarifi-consolidation-2026-10-10-v2`.

- `recoverable-content.zip`: content-addressed archive,4080405681 bytes; SHA256 `b6dd73d7a69f34280bfb7f7558d62fcb5ef45e9143b40d81f638fb72bd4024cd`.
- `manifest.json`: every original path/root, source hash, file metadata, preserved links,18 Git snapshots and explicitly excluded reproducible caches; SHA256 `fb226909d30650c5763cf4cdcd7056f4d5a2ecda8ca2da3369c318ba6808d7f4`.
- `VERIFIED.json`:175615 file records,68936 unique blobs hash-checked; original fingerprints checked;18 original Git states unchanged; complete restored common Git `fsck --full` exit0.
- `restore-check.git`: concretely restored common Git metadata, including original refs, object files, reflogs, stash parents and worktree indexes/metadata. Dangling objects remain recoverable; `restored-git-fsck.txt` records them.

`D:/Masarifi-preservation-2026-10-10/nested-git-restoration-checks-v2/NESTED-GIT-VERIFIED.json` independently verifies all five ignored nested Git directories: concrete restoration, exact original file hashes and HEAD/ref/stash/reflog state, all fsck exit0. Two restoration-only alternates point at the restored common object directory; their original bytes remain in the archive. The shallow Manual build-archive intentionally has no index; none was synthesized. Git-required empty refs/objects directories were recreated.

The first incomplete main archive and failed first restoration directories remain preserved alongside the verified replacements. Do not use them as the success receipt.

## Restoring original source and dirty evidence

Use the accompanying `restore-preserved-files.py`. It refuses existing destinations and destinations inside original checkouts, checks every restored SHA256, preserves file timestamps, and records preserved links for explicit reconstruction. It supports Windows extended paths and preserves absent Git indexes.

Example command, after choosing a new empty destination on a volume with enough space:

```powershell
& 'C:\Users\DELL\AppData\Local\Programs\Python\Python311\python.exe' 'C:\Users\DELL\.codex\visualizations\2026\10\10\01a1246b-1e96-7402-a61c-35bd296d00c7\restore-preserved-files.py' --backup 'C:\Users\DELL\.codex\backups\masarifi-consolidation-2026-10-10-v2' --root W9 --destination '<NEW-EMPTY-VOICE-RECOVERY-DIRECTORY>'
```

W9 is the dirty Voice worktree; W1 is the original primary checkout/common Git. The manifest lists all18 root IDs and exact source paths. `--selection '<PATH-TO-Voice-Source-Disposition.json>'` optionally restores only the215 reviewed source/design/helper paths; omission restores all preserved W9 source/evidence. The full Voice supplement below also retains all reproducible caches.

Restored worktree `.git` files retain their original pointer bytes as evidence. Inspect the common restored Git directly with `git --git-dir='<BACKUP>/restore-check.git' ...`. Before using a restored checkout after relocation, reconstruct its links to a separately restored common Git directory; never redirect an original checkout. Inspect stash source with `git show <STASH-SHA>:<PATH>` and preserved untracked stash source with `git show <STASH-SHA>^3:<PATH>`.

## Entire Voice supplement

`D:/Masarifi-preservation-2026-10-10/Voice-entire-worktree.7z` includes the entire original tree without cache exclusions and is **VERIFIED**. Archive4852942577 bytes, SHA256 `e5836532dcd4534903052dd022e930cef5f49ba0edb36442cbcab9443a8e9071`.

`VOICE-VERIFIED.json` confirms archive creation exit0, all-content CRC test exit0, concrete restoration and source-hash comparison of all630 dirty paths, fresh fingerprints of all11410 reviewed ignored-source instances, unchanged original Voice HEAD/status/stashes, and archive SHA256. `Voice-archive-test.txt`, `Voice-archive-inventory.txt`, `Voice-restoration-test.txt` and `Voice-dirty-restoration-check` preserve verification evidence. Extraction also retained extra matching package evidence; all630 required paths were verified.

`VOICE-COMPLETENESS-VERIFIED.json` proves every top-level physical-file count/raw byte total equals the frozen physical inventory:558580 ordinary files,14226777146 bytes. Three preserved dependency junctions point to archived `apps/*/node_modules` contents; including their aliased views exactly reproduces the earlier730540-file/17371945495-byte logical inventory. `Voice-reparse-points.json` records all three targets. Reconstruct junctions only inside a NEW restored checkout, mapping original-root targets to the restored root. Never redirect original junctions or restore files through links pointing to an original checkout.

The first verifier's completion-log timing failure remains preserved in `voice-entire-verification.log`; the corrected verifier and full success receipt are `voice-entire-verification-v2.log` / `VOICE-VERIFIED.json`. All preservation gates passed before isolated candidate creation at `D:/Masarifi-integration-2026-10-10`, branch `codex/masarifi-complete-integration-2026-10-10`, base `3bd0c5d3149259ad69fb6a5e86083a820052b7f4`.
