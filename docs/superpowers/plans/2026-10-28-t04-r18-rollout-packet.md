# T04 R18 two-API key binding packet implementation plan

> Execute inline as GPT-6.1 Sol Extra High. No delegation. This plan prepares an approval packet; it authorizes no protected change.

**Goal:** Prepare a bounded replacement of the two qualified Staging APIs, reusing the existing isolated T03 dedicated cursor key.

**Spec:** `docs/handoffs/T04-R18-continuation-handoff-2026-10-28.md`, sections 6–10. The original 29-task plan, simplified strategy and both requirement crosswalks remain binding.

**Architecture:** Retain both original containers for rollback. Copy each actual Docker Config/HostConfig and network configuration in memory, adding only the dedicated cursor environment binding and selecting its qualified image. Persist the new binding only in Docker's existing protected container metadata. Keep source env files unchanged. Hold bootstrap before ACK; start qualified ACK before bootstrap. Use indefinite graceful SIGTERM waits with a bounded observation timeout; an uncertain action stops for read-only reconciliation.

**Files:** New private files under the existing `r18-cursor-api-artifact-prep/rollout-packet-v1` directory: pinned nonsecret spec, runner, focused runner tests, preservation/current-state receipts and packet manifest. Public approval proposal here and in the resulting review document. Do not edit product code, migrations, lockfiles, index or prior evidence.

## Required preparation

- [x] Confirm current session `gpt-6.1-sol/xhigh`, sole active chat/root, expected branch/HEAD, inherited Git and artifact hashes.
- [x] Read saved handoff/current evidence and governing requirements. Reuse completed tests and historical attribution.
- [x] Refresh authoritative hosted counts/QA state read-only.
- [x] Restore existing strict SSH access via the official Hostinger Web Console and the user's exact single-source UFW approval. One rule applied; prior rules/defaults preserved. Current API/config/image/worker/frozen/protected/key checks passed read-only at16:05UTC; compiled modules/routes/health checked at16:08UTC. This access approval does not authorize deployment.
- [x] Refresh protected Xiaomi queues/producers/cursors with its existing supported inspector. After guarded localhost bridge restoration and the user's private offline readiness, 15:50 UTC SELECT/native metadata proved unchanged cursors/12 applied/one draft/no runnable Voice/SMS/native capture. Phone remains offline; refresh again before cutover.
- [x] Test new runner boundaries before implementation: immutable configuration, key shape/distinctness, coordinated ordering, failed health, uncertain mutation, repeat/journal guards and coordinated rollback. Fourteen new checks pass with a synthetic engine boundary; no live service operations.
- [x] Implement bounded draft runner with explicit approval-hash and fresh prerequisite gates, exclusive journal, intent-before-action, no retries/removals/forced kills or secret output. Actual Engine transport/configuration normalization remains unqualified.
- [x] Sol self-review and named independent automated/image/database evidence gate assessed in deployment-review.md. Overall operational gate remains HELD for live server/client/approval evidence.
- [ ] Bind final runner/spec/review hashes and obtain specific user approval only once ready. Approval must cover client cursor retirement, other active clients, downtime, exact targets, key reuse/persistence, rollback and bounded ordinary phone verification.

## Protected action and acceptance, pending approval

- [ ] After specific approval, refresh all guards immediately before action; abort on drift, unknown/pending work or another owner. No silent repin.
- [ ] Gracefully hold original bootstrap then original ACK. Start qualified ACK and require health; start qualified bootstrap and require health. Verify exact Config/HostConfig preservation, same dedicated key, original push/Clerk/security values, unchanged worker/unrelated files.
- [ ] If a known failed health gate occurs, reconcile before invoking the separately guarded rollback branch. Any uncertain call receives no automatic retry or compensation.
- [ ] On rollback, hold new bootstrap then new ACK; start old ACK then old bootstrap. Preserve both image sets/containers and journals; never reset phone cursors.
- [ ] On the real Xiaomi, use its three existing stored cursors through normal signed-in sync: typed 400 `SYNC_CURSOR_INVALID`, automatic bootstrap/delta/ACK, replacement cursors, unchanged owner/session/App Lock/12 applied operations/one draft, no capture or financial submission. Verify AR/EN affected reads and authoritative financial hashes. Private authentication, if required, is human-only.
- [ ] Reconcile all T04 criteria and independent evidence before acceptance. T05 and full T06 remain dependency blocked until T04 is accepted.

## Review focus

1. ACK and cursor issuance must never run with different key generations during either cutover or rollback.
2. Preserve reports/ledger behavior and every unrelated actual env/config/security field; never load the whole T03 env file into an API.
3. Fresh activity and client compatibility are gates. Version 0.0.1 does not prove corrected recovery on every active device.
4. An HTTP timeout after a mutation is uncertain. Stop, preserve intent, inspect read-only; never retry, force kill or assume rollback.
5. Key material stays in protected server memory/Docker metadata; no secret command line, log, key digest, new key or protected source-file edit.

**Current disposition:** FINAL APPROVAL PREPARATION ONLY. Current phone and server read-only checks passed; exact request is `2026-10-28-t04-r18-final-deployment-approval.md`. Held immutable packet v1 is retained; a final v2 binds later evidence. One separately approved SSH firewall rule is applied. No API deployment/key binding/service restart/database or financial change occurred. Separate deployment/maintenance approval is pending.
