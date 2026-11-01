# Server cleanup execution — 1–2 November 2026 (Riyadh)

**Obsolete-artifact cleanup executed. Full backend consolidation and production readiness remain NOT READY.** Cleanup-completion snapshot: 2026-11-02T00:23:50+03:00. Later resource measurements and the approved host-maintenance correction are in the [2 November health follow-up](../2026-11-02/server-health-report.md). Application code is qualified at `721a943b72837d3f43a4e4b61bc3ab4cd83738d8` on `codex/voice-promoted-operating-2026-10-13`; later branch commits change CI/reporting only, with identical apps/packages/schema/Docker trees.

| Measurement | Before cleanup | Latest observed |
| --- | ---: | ---: |
| Filesystem available | 11,684,458,496 bytes (11.68 GB) | 75,182,309,376 bytes (75.18 GB) |
| Filesystem used | 89% | 27% |
| Available memory | Approximately 1.80 GB in the initial priority sample | 3,837,984,768 bytes (3.84 GB) |
| Running HTTP API roles | 25 | 14 |
| Active Admin versions | 7 host services | 1 canonical container |
| Application workers | 11 | 11 preserved |

Net available filesystem increase is **63,497,850,880 bytes (63.50 GB)** from the first-removal snapshot. It includes intervening creation/removal of owned build artifacts and ordinary runtime activity; it is not a sum of overlapping folder sizes. GB here means decimal bytes; `df -h` uses binary-sized units.

## Exact executed scope

- Removed **95** obsolete generated directories:48 `node_modules` and47 `.next` copies. Source/package/lock/config/state remained in place unless the entire separately archived unused source tree was subsequently removed.
- Removed **56** unreferenced release source trees after encrypted off-host capture, recovery of every archived regular file, and a fresh complete content-hash/reference check.
- Removed **209** original stopped/created stateless application containers without force or volume deletion. Mounted state and host bind sources were retained.
- Removed **57** zero-container-reference images, reclaiming4,442,320,896 observed available bytes in that isolated image batch. This includes one owned unused Storage restore-tool image;56 were historical application images.
- Stopped and disabled six unreferenced old Admin services. Their pre-stop cgroups accounted for 659,116,032 bytes; observed available memory increased 799,719,424 bytes at the follow-up sample.
- Gracefully retired 11 unreferenced HTTP-only APIs after route/control/bootstrap audits and three quiet connection samples. Every process exited0 on SIGTERM, with no forced termination. Their cgroups accounted for 1,134,116,864 bytes; the immediate observed available-memory increase was 1,246,609,408 bytes. Their containers/specifications are temporarily retained as part of the previous deployment set.
- Captured and retired three failed, untriggered transient Admin build units. Their complete definitions were encrypted/read-back before reset; no build was restarted.
- Removed the owned failed Admin builder/root after protecting its logs and receipts, and removed its unused 327,352,320-byte Node tool image. The successful Admin build ran off-host.
- A scoped unused BuildKit cache prune hit its client deadline; it was not repeated. Subsequent daemon metadata showed 252→17 entries and 9.698 MB remaining. No exclusive filesystem saving is attributed to that concurrent operation.

The [exact completed-item ledger](cleanup-removed-items.csv) records identities and actions. Parent/source-tree and earlier child removals overlap; counts describe actions and must not be added as exclusive bytes. The old `cleanup-candidates.csv` is a historical provisional baseline, not the current execution ledger.

## Recovery and exclusions

The compressed 56-tree source archive contained 3,403,867,126 bytes before authenticated DPAPI wrapping. All 156,756 entries and 134,514 regular files were reconciled; 4,705,794,725 file bytes were recovered and SHA-matched without persisting plaintext files. Archive SHA256: `8822263cabf5f811f964b37472b99d16bbd5b06e25e7e87fb6066dbcdae55b65`.

The actual previous Admin runtime is retained on-host and encrypted off-host. All 46,840 regular files / 838,164,584 bytes were recovered and matched; only regenerable Next cache was excluded. Its 257,019,152-byte archive has SHA256 `f40f8f087e35dff20d00d120cb2d8e698d57c7e8cabe255484bf55eda56de493`. Current container specifications, Nginx/systemd/TLS/UFW configuration and selected unchanged Admin secrets were captured/read-back after promotion. A broad Opt rescan failed; the explicit current configuration capture succeeded and earlier extra Opt env/key captures remain retained.

Backups use an ACL-protected off-host directory and authenticated Windows CurrentUser DPAPI. Byte recovery is proved; copying encrypted files alone is not portable disaster recovery. Database/Storage/keys and all three host volumes were preserved. The two owned isolated PostgreSQL fixtures are stopped with their state retained. No Linux cache drop, Docker-internal deletion, blanket system prune or volume removal occurred.

Fourteen other generated directories remain protected by unresolved installed-unit/drop-in or retained deployment-controller references. The selected previous source, actual previous Admin runtime, current canonical Admin tree, all 14 routed/private APIs, all 11 workers, scanner and recovery data remain protected. Age/name/stopped status alone never authorized removal.

## Latest code and operational limits

The exact 721a943b backend image passed the complete configured qualification/security/container workflow and is installed by digest. The same digest runs the current Admin, whose real public-config build was produced on GitHub without sending a runtime secret key there. The 11 redundant API stops preserved all 14 required API liveness responses at 200, Nginx API routing and all worker claim scopes.

Only Staging Admin ingress was changed: old IPv6 loopback 3039→canonical IPv4 loopback 3040. HTTPS root 307, public deletion shell 200 and the new CSS asset 200 passed. No deletion action was submitted. The previous UI was drained, stopped and disabled; the new container uses `unless-stopped`. The first scoped attempt automatically restored the original ingress when probing before asynchronous Nginx reload acceptance; the successful retry waited for a release-specific asset (404→200), preserving API configuration byte-for-byte apart from the Admin upstream.

**Backend traffic still uses 14 protected feature/private APIs and 11 existing workers. Their migration to one canonical code release is incomplete.** Owner/authenticated reads, feature-policy compatibility, migration/RPC reconciliation, leases/admission scopes and full rollback/observation must pass before those services are retired. Health 200 is not authenticated business-API qualification. Supabase connection investigation was deferred by the user; one early readiness GET may have indirectly probed DB/queue and was not repeated. No new financial record, registration/deletion replay, paid AI or delivery action was initiated by this cleanup.

See [current server state](current-server-state.json), [release manifest](release-manifest.json), [readiness](production-readiness-report.md) and [recovery](recovery-report.md). This cleanup proves resource recovery, not app/API p95 acceleration or production readiness.
