# Dashboard source, Linux candidate and rollout review packet

**Source and Linux CI artifact qualified for a scoped staging rollout review. Hosted execution has not been approved or performed.**

Reviewed source: `f865131a4cfdcd8ef4b88c3287f125f4d33112e4`, based on `e13a90549788d22b56432377a4cff7da5481f43e`, same `ratibi` branch. The source archive pins15 dashboard-owned files and is retained privately with the runtime archive.

| Item | Exact pin |
|---|---|
| Linux runtime |262,029,155 bytes; SHA256 `186aec1f1fd5f3fa30f5e1791bb841c11664e0255e13c5195a7a26d1934c7c62` |
| Candidate Next build | `scy8yMJdAowpPKpkffiaW` |
| Linux CI | [run42347991605](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42347991605), Admin job succeeded; backend image job skipped |
| Source archive |3,330,269 bytes; SHA256 `f07f5bc16ed0636b3022ed0964b9f7f6f4153578afd72a55ffdaf8c74596634e` |
| Still-serving build | `RfJI7jhDb6BdroFc-2TBT`, source721a943b, Docker loopback3040 |
| Proposed candidate | Same immutable runtime image/environment; new loopback3041; only dashboard proxy3040→3041 after approval |

The Linux build uses Node24.16.0/npm11.17.0, live mode, mocks disabled and **all five public configuration hashes identical to the current service**. The build-only server-key placeholder is not a runtime credential. Activation must retain the real ordered Docker environment on the VPS; no credential is exported or replaced. Target runtime Node24.20.0 and the existing image remain unchanged. The earlier local Windows build is separate evidence.

## Reviewable files

- [Manifest](manifest.json): exact source/runtime/static-probe pins, approval state and remaining gates.
- [Host baseline](host-baseline.json): actual serving container, environment/config hashes, read-only mounts, resources, routing preimage, rollback archive and unchanged protected-service projection.
- [CI manifest](linux-ci-manifest.json): exact checkout/tree/lock/build/public-bindings evidence.
- [Rollout and rollback](rollout-and-rollback.md): candidate scope, admission, canary, guarded handover, deadlines and exact restoration.
- [Findings](../../../docs/evidence/2026-11-07-dashboard-production/findings.md), [capability matrix](../../../docs/evidence/2026-11-07-dashboard-production/capability-matrix.md) and106-route inventory.
- `verify_packet.py`: read-only hash/source/runtime/archive-safety verification; no deployment.
- `rollback_watchdog.py`: default read-only inspection; mutation requires explicit operator assertion **after actual human approval**. It is not installed or running on the host.

```powershell
python -B ops/releases/2026-11-07-dashboard-ui/verify_packet.py
python -B -m unittest discover -s ops/releases/2026-11-07-dashboard-ui -p 'test_*.py'
```

Use `--archive`, `--runtime` and `--runtime-manifest` for copied artifacts, or `--source-only` for source verification alone. Download CI artifact13564411929 before14November2026 if needed; the exact archive is also retained in the ignored local evidence directory. A rebuild creates a different build/artifact pin and needs a new packet. The two report-source files included by the existing CI workflow are provenance only; no API release is proposed.

## Verified boundary and outstanding acceptance

The human privately completed Hostinger sign-in. Read-only Playwright terminal receipts confirmed the current3040 Docker service, all eight runtime-source preimages, matching complete baseline Admin tree, actual environment/public bindings, retained rollback archive and Nginx preimage. All31 running container identities/configurations matched before/after;30 other services are protected. The owned root shell was logged out and console closed. SSH/firewall/DNS/TLS, service configuration, roles, data and sessions were preserved.

The packet permits **review**, not execution. Exact approval is required before uploading/preparing the candidate or changing the host. Fresh drift/resource/pending-work admission, the actual host canary, watchdog arming, public handover and existing-session browser acceptance remain execution gates. Provider writes, current SQL write lifecycle, broad owner/role negatives and whole-product readiness are not proved by the build.

All six Admin jobs in [Foundation run42346940801](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42346940801) passed, including five browser projects. The overall run failed: database migration inventory has an additional `private.tracking_installations` table; API formatting fails in `ai-routing.ts`/`assistant-agent-admission.spec.ts`; the mobile app-shell boundary flags `tracking-native-runtime.ts:2`; and the full-history secret gate reports four inherited matches (three public Clerk publishable keys and one environment SHA256). The CI [gate review](../../../docs/evidence/2026-11-07-dashboard-production/ci-gate-review.json) records their scope. No current dashboard secret match was reported. Shared owners were informed; no scanner rule, shared mobile/API file or historical commit was changed to conceal a failed check. These failures prevent a whole-repository production-ready claim.
