# Masarifi Performance and Production Readiness Execution Plan

Approved specification: the user's 1 November 2026 plan in this conversation.

## Fixed decisions

- Work in `D:/Masarifi-integration-2026-10-10` on `codex/voice-promoted-operating-2026-10-13`, starting at `f957cb3d`.
- Existing VPS, strict SSH identity/host verification; no firewall or credential changes.
- Preserve both installed apps and data. Initial Metro12652 was found absent (PID reused by Playwright); the user explicitly authorized restoration on8081. Verified replacement Metro PID31340; preserve it and the unrelated Playwright process. New Release benchmark identity: `com.masarifi.mobile.benchmark` on the same Redmi, Staging auth, existing account, read-only actions.
- No financial writes, deletion/registration replay, paid AI, email or notification delivery tests.
- No cleanup/cutover before current recoverability and isolated restore are proved. No blanket prune, manual Docker-internal deletion, volume deletion or cache dropping.
- One canonical immutable release across necessary process roles. Preserve compatible N-1 artifacts and state; move routes/claims gradually. Observe 24 hours before final retirement, retain off-host rollback for seven days.
- Merge/main, release tag and production qualification follow successful required gates; production traffic/store publication remain separate actions.

## Task checklist and completion contracts

- [ ] 1. Inventory every route, container, image, service, schedule, mount and release reference; classify active/dependency/rollback/unused/unresolved.
- [ ] 2. Reproduce and fix frontend-quality and encrypted-store/WAL CI failures without weakening source/encryption checks; required checks pass on candidate.
- [ ] 3. Verify current encrypted off-host DB, Storage, configuration, secrets and artifact recovery; complete isolated restore with reconciliation.
- [ ] 4. Build/install independent benchmark Release with its own Firebase/OAuth identity; preserve both installed apps; authenticate existing owner read-only.
- [ ] 5. Measure Arabic/English cold/warm startup (20 runs/scenario), core-screen readiness, requests/retries/payloads, frame/memory data; record sample counts and limitations.
- [ ] 6. Remove only verified unreferenced artifacts after recovery proof; target 25GB free before candidate deployment.
- [ ] 7. Correct proven bottlenecks with a regression check and comparable before/after evidence.
- [ ] 8. Build immutable canonical backend/Admin artifacts; reconcile source/schema/config/release manifest and cover all currently split routes/workers.
- [ ] 9. Qualify idle candidate, move one route/consumer group at a time; rollback on incorrect reads/isolation/duplicates or sustained >20% p95 regression.
- [ ] 10. After 24 hours retire explicit old objects; finish production identity/security/observability/restore/rollback qualification, then review/main/tag.

## Measurement and release gates

Targets: Release cold p95<=3s; warm<=1.5s; cached transition<=300ms; simple origin reads<=300ms (stricter existing budgets preserved); disk<=75%; representative available memory>=25%; no OOM; artifact rollback<=5min. Report p99 only for >=1000 samples.

Concurrency only against the isolated candidate: <=5 users for 3min, abort for sustained CPU>85%, available memory<1GB, OOM/restarts, failed reads>1%. Readiness stays private; diagnostics redact all secrets/PII/financial content. No public contract changes planned.

## English deliverables

Baseline report, dependency/deployment inventory, optimization report, exact cleanup report and production-readiness verdict with release manifest. Unknowns/unexecuted acceptance remain explicit blockers; do not infer READY from a push, cleanup or health checks.
