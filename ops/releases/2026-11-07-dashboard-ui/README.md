# Dashboard source and deployment review packet

**Source qualified; hosted activation is not approved or executed.**

Reviewed source: `f865131a4cfdcd8ef4b88c3287f125f4d33112e4`, based on `e13a90549788d22b56432377a4cff7da5481f43e`, same `ratibi` branch. The manifest pins the15 changed files, canonical preimages/candidate bytes, source patch and3,330,269-byte source archive.

Source archive SHA256: `f07f5bc16ed0636b3022ed0964b9f7f6f4153578afd72a55ffdaf8c74596634e`.

## Contents and verification

- [Manifest](manifest.json): source pins, observed public bindings, protected scope and blocking gates.
- [Evidence](../../../docs/evidence/2026-11-07-dashboard-production/findings.md): repairs, real reads, screenshots, tests and limits.
- [Capability matrix](../../../docs/evidence/2026-11-07-dashboard-production/capability-matrix.md) and106-route inventory.
- `verify_packet.py`: read-only local source/archive verification. It does not connect to the host, install packages or activate anything.

```powershell
python ops/releases/2026-11-07-dashboard-ui/verify_packet.py
```

On another workstation, use `--archive <copied-source-archive>` to override the local artifact path. The source is also reconstructible using `git -c core.autocrlf=false archive --format=tar.gz f865131a4cfdcd8ef4b88c3287f125f4d33112e4 apps/admin-web`; compare its checksum before use. The archive has no node_modules, private environment, session state or runtime credentials.

The final source compiled in production mode with mocks disabled and the actual browser-observed public API/Clerk bindings. Local validation used a **noncredential server-secret placeholder**. This local build is not the hosted runtime artifact. Do not copy its environment or treat it as authentication acceptance.

## Observed serving boundary

The authenticated browser served Next build `RfJI7jhDb6BdroFc-2TBT` at `https://staging.masarifiratibi.com`, reading `https://api.staging.masarifiratibi.com` and `https://clerk.staging.masarifiratibi.com`. Its release marker returned404. The October3039 service/build checkpoint is historical and differs from this browser build.

SSH22 remains unavailable from this workstation. The hPanel console attempt did not yield a verified host command receipt; the created console was closed. Direct Playwright hPanel access reached private sign-in. No firewall, DNS, environment, proxy or service was changed to get around these limits.

Therefore this packet intentionally contains **no runnable activation command**. Null serving-unit, environment and rollback pins in the manifest are blocking facts, not defaults to guess. Approval to activate must identify the final runtime artifact and verified rollback, not just this source archive.

## Required preparation before requesting activation approval

1. With read-only authorized access, reconcile the actual Nginx host/location/upstream and serving unit/container against browser build `RfJI7jhDb6BdroFc-2TBT`. Record source/artifact path and hash, unit definition, bind address/port, process/start identity, actual Node/dependency versions, current health checks and sanitized API/Clerk bindings. Record private environment-file hashes/ownership without displaying secret values. Do not assume the historical3039 unit is still routed.
2. Record every protected API/worker/container/Admin unit identity, start time, image, resource limit, environment hash and pending-work baseline. Preserve the currently installed Android127, legitimate sessions, iOS work, owners' data and durable pending receipts. Record current memory/disk headroom; do not reclaim other work to fit a candidate.
3. In an isolated candidate directory, verify retained runtime source preimages against the manifest. Reconcile any drift before applying an overlay. Preserve working hosted auth/API contracts and credentials. Build with the existing real runtime environment, live mode and mocks disabled; no dependency upgrades or example keys. Pin the complete resulting runtime artifact, source/environment hashes and public build marker.
4. Prepare the exact proxy/unit change and exact rollback using the **freshly captured** current preimages. Keep the existing artifact/unit untouched as the rollback target. Pin the candidate loopback port and prove it is free, then provide bounded health deadlines, resource admission and watchdog rollback. No API/worker/DB/schema/DNS/TLS changes belong to this dashboard release.
5. Publish the completed immutable runtime/review/rollback manifest, then request one specific approval covering only that candidate and handover. Current source qualification does not authorize those hosted mutations.

## Acceptance after exact approval

Activate only the reviewed artifact and proxy/unit delta. Check TLS/static build marker and the existing administrator session; inspect UI at the agreed widths/locales/themes. Verify real customer filtering/paging, support/feedback reads, imports/AI/jobs and the53-row queue registry. Reconfirm unknown age/status/freshness, nullable revenue and actual recent-auth failures. Verify identity/permissions and all protected service/pending-work projections against their before-state.

If routing, health, permissions, resource or protected-service checks fail, restore only the captured proxy/unit preimage and old artifact binding using the pinned rollback. Do not retry uncertain provider/customer operations. Record the served build and source independently, close only newly created access and retain private receipts.
