# Exact T04 R18 v4 approval — activate the two retained candidates

READY FOR NEW SPECIFIC APPROVAL; V4 NOT DEPLOYED. V3 was rolled back using its approved controls after its post-start guard failed. Its approval and journals are consumed and preserved. Read REVIEW.md and the actual v3 result receipts.

Approve staging this exact packet only into /opt/masarifi/qa-t03/uploads/8937ba09919a4e94ee7179bf354fc4697dfad6b9105b2c3bce210f7c61e09f83/rollout-r18-v4, root0700/files0600, and one guarded coordinated cutover plus its reviewed rollback after reconciliation if needed. The runner differs from v3 and reuses both candidates after their known successful-start/clean-stop lifecycle, so a new exact approval is required.

| Role | Existing candidate to reuse | Exact qualified image | Serving original retained for rollback |
|---|---|---|---|
| bootstrap/delta,127.0.0.1:3020 |5ba09a5b36366ec707726f5e23d73e93b3b36ec0f50147100d4ab51beb3d9747 |sha256:6569dd9087ab58bed5a3c8dc7ca1d65fcd6354547642f63786af0438939351e0 |ae727700013ef9bc9e7b3cbaea595143baebd9e7bae5c6f22fd54dfcc862ac73 |
| ACK/report fallback,127.0.0.1:3001 |e778fb2f00a396b9c570584f8baf50ae6e679d396e9000be342880fd64da3e5a |sha256:a4456b3dc7fc8e883e50879f1f6291aae5140700b0cf1136e2190cc70f5da721 |4e9bc21d1475dff650b606e4c1627e12f603fd2b6a94bd15fe48a33a9790be05 |

No new container, image, key material or key binding is created. Both candidates retain the existing dedicated cursor key already bound by the approved v2/v3 attempts. Its source /etc/masarifi/qa-t03-api.env stays unchanged:2057bytes,UID/GID1000,0600,whole-file SHA06506707b7a28c3817fb6afb577a1c9ab84ba11e39962755bd9d612e1984a077. Verify key shape, equality to each candidate binding and inequality to both push keys only in protected server memory. No full-env substitution, auth/push/encryption rotation or secret output. Bindings remain in existing protected Docker Config; no old recreation command is approved.

Exact full runtime Config/HostConfig comparison remains mandatory before and after start. OomKillDisable must literally match each original's null runtime value on the pinned Engine/cgroup platform; no ignored field or null/boolean tolerance. Original runtime labels plus exact provenance labels and original environment/security/ports/CA/network/log/restart behavior are preserved. Both candidates require exact known stopped lifecycle timestamps/status/restart0/exit0/error-free identity. Current original network pins explicitly incorporate only EndpointID/MacAddress regeneration from the approved rollback; original IP/gateway/aliases/DNS/network/ports are unchanged. Old pins are retained, and this approval binds the documented new current hashes.

Before execution, independently verify fresh server/database/worker/financial activity, all local/native producers/queues, original Xiaomi cursors, sole ownership and no other active clients or financial operations. Keep all other testing clients inactive throughout maintenance and recovery. Packet-bound120second gate must have all eight prerequisites verified; any failure/uncertainty stops without a new cutover. No stale receipt, journal reset, silent repin or mutation retry.

Cutover gracefully holds original bootstrap then original ACK, starts retained new ACK/health then bootstrap/health. SIGTERM Docker timeout-1 prevents forced killing; observations are bounded, with180second cutover budget. Affected read/report/sync routes may be unavailable/502 about20–60seconds; failures can extend downtime. No automatic compensation. Reconcile read-only on any failure; the reviewed separate rollback branch, with fresh gates, stops new bootstrap then ACK and restores original ACK/health then bootstrap/health. Preserve all containers, source files, old/new packets and journals. Rollback restores the old cursor defect and cannot pass T04.

Successful key activation retires shared-key cursors. Authorize only bounded ordinary Xiaomi sync/read recovery using its three stored original cursors: passive observation of actual typed400 SYNC_CURSOR_INVALID, automatic bootstrap/delta/ACK and new cursor hashes, without resetting or manufacturing cursors. Temporarily use ordinary Wi-Fi after fresh queue/native checks; keep mobile data/airplane/capture unchanged and restore exact precheck network/locale. Affected Arabic/English reads may temporarily switch locale then restore it. Human enters private PIN/factors if needed. Preserve owner/session/App Lock,12applied operation identities, one draft and all financial/auth/settings data.

Require before/after full transaction/account/posting/balance/mutation/revision/idempotency fingerprints, QA20version7/NULLnote/20SAR/one original posting and account2525confirmed/0pending/ledger17. Explain only legitimate sync protocol metadata changes. Verify worker sync-only scope/no temporary financial policy, frozen V7,33other services and7protected file pins unchanged. No Production, financial Save/replay/payment, provider call, capture activation, logout/purge, other-device reconnect, hidden-feature activation, DB/schema/policy, unrelated service, migration, source/index/commit/merge/billing change is included.

T04 remains BLOCKED until deployed recovery and every original acceptance criterion pass. Only then T05, full T06 and eligible original chain may proceed. This approval itself is not acceptance.

Requested approval: I approve the exact v4 packet SHA-256 presented with this file, reusing both retained candidates and their existing bindings, the strict runtime guards, coordinated two-API cutover, documented rollback and bounded Xiaomi recovery. Other testing clients remain inactive; independently recheck all preconditions and stop on any failed/unknown safety condition.

Exact packet SHA-256: **5c9a1e2833471a5ab66c70c92c44e1e9775dbfc8babcf22f5eba84c2b96a1fcd**. Runner SHA-256: afac9034c792c0641ed011cdad5996efe39fc1530aaf83d751ca9e23d8206452. Bound files: 24.

All22focused tests and actual-server read-only qualification passed. No v4 files staged server-side; no further protected action after approved v3 rollback.

See [actual v3 deployment/rollback result](../../evidence/2026-10-25-astra-remediation-review/execution/T04/r18-v3-actual-rollback-2026-10-28.md) and [complete runtime review](../../evidence/2026-10-25-astra-remediation-review/execution/T04/r18-v4-runtime-review-2026-10-28.md).
