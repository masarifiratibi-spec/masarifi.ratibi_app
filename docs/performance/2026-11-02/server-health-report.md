# Server memory and I/O follow-up — 2 November 2026, Riyadh

**Outcome: current memory has headroom; a proven continuous-discard I/O backlog was removed. Production remains NOT READY.** Application source, routes, worker scopes, financial data and installed mobile applications were not changed by this follow-up. The same branch remains in use. Supabase connectivity investigation remains deferred.

## Actual measurements

The customer's screenshot displayed75% memory and22% CPU. Its averaging interval and memory formula were not established. It is not a synchronized measurement of the current host. The following measurements come directly from `/proc`, cgroup v2, Docker metadata and private liveness checks over strict, pinned-host SSH.

| Metric | Before intervention | Follow-up after approved reboot |
| --- | ---: | ---: |
| Observation UTC | 2026-11-01T21:52:17.951124+00:00 | 2026-11-01T22:03:57.227572+00:00 |
| Memory total | 8.32 GB | 8.32 GB |
| Memory available | 3.91 GB | 4.62 GB |
| Used = total minus available | 53.0% | 44.5% |
| CPU busy, including steal | 22.47% | 25.33% |
| CPU I/O wait | 41.47% | 0.33% |
| CPU sample definition | 6 sequential2-second samples | 12 sequential5-second samples |
| Disk available | 75.17 GB | 75.16 GB |
| Disk busy in separate10-second sample | 98.89% | 0.52% |
| Discard commands in that disk sample | 110 | 0 |

GB means decimal bytes. CPU sample durations differ; these are operational snapshots rather than a controlled application benchmark or sustained-load qualification. The follow-up range was 8.82–63.96%, with mean steal3.34%. Brief100% CPU during simultaneous service/scanner boot was observed separately and excluded from the later60-second summary. The1/5/15-minute load averages retain startup history and are not CPU percentages.

## Why memory was occupied

Before intervention, the27 active/restarting roles comprised14 API processes,11 workers, one scanner and one Admin. Aggregate cgroup working sets were:

- API roles: 1.523 GB.
- Workers: 0.718 GB; this snapshot includes a worker between restarts, so it is not a peak budget.
- Scanner: 0.998 GB. The `clamd` process alone had approximately0.992 GB proportional resident memory and was the largest individual consumer.
- Canonical Admin: 0.055 GB.

The host also held approximately3.03 GB in buffers/file cache and0.66 GB reclaimable slab. These categories overlap `MemAvailable`; do not add them to available RAM or equate them all to unavailable application memory. Working set subtracts inactive-file cache from cgroup current memory; it is not PSS or a reserved container limit. Containers retain configured limits; those limits were not summed as actual usage.

The baseline had47% memory available and0.00% recent memory-pressure averages. No memory leak was demonstrated. The lower post-reboot resident/cache footprint is an immediate observation, not proof of a permanent leak correction. Scanner signatures and the service count explain substantial fixed overhead even with one user. The scanner was preserved; no cache drop, memory-limit squeeze, encryption change or security reduction was applied. Further lasting API-process reduction requires the existing route/auth/feature/schema/worker-scope qualification; protected services were not stopped just to lower a dashboard number.

## Proven I/O cause and executed correction

The root ext4 filesystem used `discard,commit=30,errors=remount-ro`. A blocked kernel worker's stack was `submit_bio_wait → blkdev_issue_discard → ext4_issue_discard → ext4_try_to_trim_range → ext4_discard_work`. The10-second baseline recorded110 discard operations and almost continuous disk busy time, while ordinary reads/writes were small. This proves discard work was occupying the device; the recent large cleanup is the likely source of the backlog, rather than a demonstrated memory shortage.

1. Backed up `/etc/fstab`, remounted `/` with `nodiscard`, verified it remained writable, changed only the root discard option in fstab and ran `findmnt --verify`. Existing weekly `fstrim.timer` stayed enabled/active; no immediate trim was started.
2. The already queued kernel discard work continued after remount. A temporary zero discard ceiling stopped it, but restoration returned `EINVAL`: the host's7.0.0-38-generic kernel reported zero discard granularity. Upstream code shows why this state rejects a positive value: the alignment mask underflows at zero granularity, while the parser rejects the next representable aligned value above `UINT_MAX`. A capability revalidation and a guarded software-ceiling restoration did not restore it. These attempts were not successful fixes and must not be replayed.
3. The assistant disclosed the additional effect and obtained explicit approval for exactly one reboot. Before reboot, verified all41 container identities,27 `unless-stopped` role policies,14 stopped/no-restart artifacts, enabled core boot services/socket, valid fstab/Nginx and canonical Admin CSS200. Full container/config recovery material was encrypted off-host and read-back verified. No broad stop/delete/prune or database action was run.
4. Reboot requested at2026-11-01T22:01:10.125258+00:00; a new boot was observed by SSH at2026-11-01T22:01:40.544624+00:00, approximately30 seconds later. This bounds SSH recovery, not uninterrupted public availability. After boot, verified original effective discard ceiling1,073,741,824 bytes and granularity4,096 bytes restored; root remained writable with continuous discard disabled. Existing periodic trim remained active. No further reboot was performed.

The final disk sample had zero discard operations, no blocked discard worker and0.52% device busy time. I/O wait averaged0.33% over the later60-second CPU window. No file, volume, database, service identity, API routing or worker admission scope was removed or replaced by this change. A live periodic TRIM run was not forced, so timer configuration/device capability are verified, not a newly completed trim job.

## Verification and remaining limits

- All41 original container identities remain; all14 intentionally stopped/recovery containers remain stopped. The27 required roles resumed without recreating containers. Core Docker/Nginx/SSH/private voice ingress are active. No failed systemd units were reported after boot.
- All14 protected `/health/live` endpoints returned200 after settling; canonical Admin's release-specific CSS returned200 with TLS verification. Nginx configuration SHA256 stayed`35eccbf6189150c82789e4efcaddfb530c3b4b4e8ec2a6e10164a9d45b9aea39`.
- No current-boot kernel OOM kill, killed-process, block I/O or ext4 error matched the bounded acceptance check. Memory pressure averaged0.00%. This is not proof of indefinite stability.
- Repeated voice/PDF worker exits and existing connection-terminated/timeout categories were present before reboot. They persisted: the final metadata had8 voice-worker restarts and4 requested-PDF worker restarts after boot. Restarts can temporarily make their measured memory look lower; absence of a restarting state in the final instant does not prove dependency recovery. These workers and pending scopes remain protected. No claim is made that database connectivity or background work correctness is repaired.
- No authenticated business flow, financial write, deletion/registration replay, paid AI call, email or push action was deliberately invoked. Existing background roles continued their already configured duties and resumed after host maintenance; their external outcomes were not qualified.
- Local Metro remained on127.0.0.1:19081 with listener PID24564. The two original applications, benchmark APK and their data were not changed.
- Restart the Admin observation window after this planned interruption; full canonical backend observation has still not begun. Keep the previous recoverable release and existing retention protections.

### Recovery and rollback

Protected pre-reboot recovery: 373,331 plaintext bytes before DPAPI wrapping, SHA256`dd83ba620b1729cfd23d6248e6e6582787c2b05357c714b0953eecb954f4caed`, authenticated decrypt/read-back verified. Encryption is Windows CurrentUser DPAPI, with the existing portability limitations. The root-only fstab backup is`/etc/fstab.masarifi-before-nodiscard-20261102`. The current fstab SHA256 is`827290e9fb0b7f224de681adb69189f2e8c336f78f38460cf42fc3b03a4e7db1`; previous SHA256`839b7820c3e3159b787c94cee40028ad7005f3eaec7f76e133a7053a57117a5f`. Do not blindly rerun private mutation controllers. A reviewed rollback would restore only the root `discard` option from the backup and remount with `discard`, which can reintroduce the observed I/O overhead; reboot is not required merely to revert that mount option.

Machine-readable sanitized evidence: [server-resource-evidence.json](server-resource-evidence.json). Earlier cleanup: [cleanup report](../2026-11-01/cleanup-report.md). Full release decision remains [NOT READY](../2026-11-01/production-readiness-report.md).

Primary technical references: [ext4 mount options](https://docs.kernel.org/admin-guide/ext4.html), [util-linux fstrim guidance](https://www.man7.org/linux/man-pages/man8/fstrim.8.html), [Linux7.0 queue attribute implementation](https://kernel.googlesource.com/pub/scm/linux/kernel/git/torvalds/linux/+/refs/tags/v7.0/block/blk-sysfs.c), [queue limit validation](https://kernel.googlesource.com/pub/scm/linux/kernel/git/torvalds/linux/+/refs/tags/v7.0/block/blk-settings.c). The upstream-code explanation is an inference consistent with measured host behavior, not a byte-for-byte audit of Ubuntu's deployed kernel binary.
