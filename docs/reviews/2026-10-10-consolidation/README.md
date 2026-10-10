# Isolated integration candidate — 2026-10-10

Base: `3bd0c5d3149259ad69fb6a5e86083a820052b7f4` (`codex/tracking-final-automatic`). Candidate: `codex/masarifi-complete-integration-2026-10-10`.

This candidate preserves Tracking as the implementation baseline and recovers verified missing deltas. Main, all original worktrees, branches and stashes remain unchanged; Staging and Production are untouched. The local-main merge is **into this candidate only** and carries only the display-name delta. Savings remains available.

## Complete Voice accounting

- All 630 modified/untracked dirty paths: `Voice-Source-Disposition.json`. Every relevant source file identifies functionality and compares it against Tracking; 215 source/design/helper files: 169 ALREADY INCLUDED, 10 SUPERSEDED, 35 INTEGRATE, 1 NEEDS DECISION.
- All 11,410 ignored source instances: `Ignored-Voice-All-Source-Disposition.json`, plus snapshot A/B and helper proof ledgers. 10,238 ALREADY INCLUDED, 1,006 SUPERSEDED, 13 INTEGRATE (selective), 153 NEEDS DECISION.
- All seven stashes: the two stash ledgers. Older snapshots are retained; narrow Home 200% reflow coverage is recovered.
- All 87 original branch/remote refs and 28 unique divergent commits: `Remaining-Divergent-Commits-Review.json` (14 ALREADY INCLUDED, 12 SUPERSEDED, 2 display-name INTEGRATE).
- `Recovery-Traceability.json` binds every prepared recovery path to the reviewed source and current candidate hash; extra ignored-evidence recoveries are recorded too.

NEEDS DECISION denotes preserved, deliberately unexecuted operational/provider/device/budget/admission tools and the disabled development automatic-posting flag. These are not silently discarded. No missing approved product feature is left unaccounted for. Historical Savings-removal changes are superseded by the explicit instruction to preserve Savings. Historical readiness DB queries that broaden privileges remain excluded.

## Included recovery

1. Complete owner/account/currency/timezone-scoped Today activity, paginated and deduplicated; signed grouped transaction cards; Arabic/English 200% reflow and uncategorized/time presentation. Current app layouts are preserved.
2. Assistant retry/recovery resets; bounded Assistant authentication and Reports authentication/transport/decode deadlines; prevention of late token dispatch.
3. Bounded, redacted HTTP failure metadata and best-effort development diagnostics; auth logging failures cannot interrupt provider cleanup/retry.
4. Manual draft timestamp/error-banner/cross-layer HTTP regressions; current accounting and definite-validation semantics retained.
5. Voice operating persistence/concurrent replay regressions, scoped stop/abort behavior, preflight-before-stop guards; safe offline accuracy/capacity/capture/visibility tests.
6. Display name `Masarifi.Ratibi` only. Android package, slug, EAS identity, Firebase config, Savings and newer Tracking/Voice/Admin/ledger/security implementations retained.
7. Exact-commit candidate CI: existing gates, fresh database plus genuine 68/70-migration main upgrades with ledger/Savings history checks, compiled idle workers, and an arm64 Android release APK identity check. Candidate pushes do not publish or deploy.

## Verified preservation

`Backup-Recovery-Guide.md` identifies concrete recovery destinations and instructions. Primary archive SHA256 `b6dd73d7a69f34280bfb7f7558d62fcb5ef45e9143b40d81f638fb72bd4024cd`; whole Voice archive SHA256 `e5836532dcd4534903052dd022e930cef5f49ba0edb36442cbcab9443a8e9071`.

Verified before candidate creation: all 18 original Git/source states, archived blob hashes, restored Git fsck, all five nested Git restorations, complete Voice CRC/physical inventory, 630 concrete restored dirty hashes and 11,410 fresh ignored-source fingerprints. Three archived junction targets explain logical versus physical file counts. Never restore over originals.

## Read-only operating findings and remaining external acceptance

Staging's release pointer still references `0ad0c0410b77d83b1d665b72f2f6b9bf8c38c979`; actual API serves Tracking `3bd0c5d`. The Assistant worker is older (`2af0ca8d0b261577aeb5f971dc28ab8cadb3555c`) and lacks newer advice-only, safe-diagnostics and provider retry fixes. Running services and deployment configuration were not changed.

All 103 Staging migration versions are present. One recorded historical SQL entry (`20260922211640`) differs from canonical source; both observed/source variants revoke PUBLIC access. Historical migration history must not be rewritten. A future operator compatibility decision is separate from isolated disposable-DB verification.

Real-device SMS/Voice acceptance, Samsung installed APK versus served JS provenance, future service/pointer remediation, and operational general-worker monitoring remain external deployment/readiness gates. Native CI is a real compilation; no EAS deployment or device installation is authorized. A green candidate CI run is required before proposing the main PR; no main merge or update is authorized.

Full originals and unsanitized review evidence remain in verified archives and local audit output. This directory retains per-path disposition/proof metadata; `Evidence-Manifest.json` binds copied/sanitized reports to original evidence hashes. Final exact-SHA CI and readiness results are reported outside the candidate after verification, keeping the verified commit stable.
