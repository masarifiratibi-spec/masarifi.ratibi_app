# Cleanup report — 1 November 2026

Decision: **BLOCKED** pending complete recovery and release-dependency qualification.

| Result | Actual outcome |
| --- | --- |
| Original server items removed | None; reclaimed bytes0 |
| Original application services stopped/retired | None |
| Application routing or database settings changed | None |
| Proven memory released by consolidation | 0; no consolidation |
| Verified removable directories/images | 0 |
| Provisional no-discovered-reference folders | 174; all protected |
| Original Docker images | 89, each referenced by a container at inventory time |

The [explicit ledger](cleanup-candidates.csv) and [dependency inventory](deployment-inventory.md) preserve unresolved references. Age, stopped status or duplicate names do not establish safe removal. Parent/child directory sizes and shared layers cannot be summed as exclusive savings.

Fresh strict SSH after the approved source-address firewall exception measured13,143,601,152 bytes available and88% usage before the Storage restore-tool image pull. Memory available was1,791,483,904 bytes of8,321,167,360 (about21.5%); no consolidation benefit is claimed. Further current resource measurements are required before any additional release.

Encrypted off-host captures include database, roles, configuration, Storage and active runtime images. Isolated database restore passed192 table-count and15 financial aggregate witnesses; all30 Storage objects/49,495 bytes were recovered and reconciled. Full Storage API/application, artifact/configuration and N-1 recovery remain incomplete. [Recovery evidence](recovery-report.md) records the exact limits.

Only explicitly owned restore artifacts were created: pinned PostgreSQL and Storage API images and isolated fixtures. The first owned fixture was stopped after a failed role restore and its volume retained. No original service was stopped. The Storage image was inspected without starting its service or mounting restored state; two migration hashes differ from the restored snapshot, so compatibility is not cleared. These activities add disk use, not reclaim it.

The sole host configuration change in the latest access-recovery pass was the explicitly approved UFW rule allowing the current workstation source only to the VPS TCP22, followed by strict existing-key/host verification. No broad SSH exposure or application-route change was made.

Before removal, finish recovery, resolve incoming references and workload ownership, preserve required off-host artifacts, recheck exact identities, then remove only an explicit eligible list and record before/after filesystem bytes. Reach≥25GB available before staging a canonical release. Retire old services only after canonical capability coverage, gradual cutover and24-hour observation; preserve recoverable N-1 off-host≥7days. Existing prune schedules must respect that retention. No blanket Docker prune, volume deletion, Docker-internal deletion or Linux cache drop was run.

Latest post-Storage-tool-pull OS snapshot: available disk11,702,063,104 bytes,89% used; available memory1,795,878,912 of8,321,167,360 bytes (about21.6%). Earlier values above are explicitly dated/pre-pull snapshots, not current reclaimed capacity.
