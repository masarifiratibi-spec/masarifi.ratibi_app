# T04 R18 v4 review — both existing candidates only

GPT-6.1 Sol Extra High is the sole responsible implementer/reviewer. This is self-review plus separately named automated, actual Engine/server, hosted database and Xiaomi evidence. No independent model review is claimed.

## Actual v3 outcome

V3 was specifically approved, staged once and invoked once after fresh independent guards. It reused sync candidate5ba09a5b36366ec707726f5e23d73e93b3b36ec0f50147100d4ab51beb3d9747 and created reports candidatee778fb2f00a396b9c570584f8baf50ae6e679d396e9000be342880fd64da3e5a. Both pre-start candidate guards passed. Original bootstrap then ACK stopped cleanly. New ACK started/healthy before new bootstrap; both became healthy by17:35:48UTC. Strict post-start HostConfig equality then rejected OomKillDisable false becoming null. V3 never wrote a completed-cutover receipt.

Read-only reconciliation proved both new APIs healthy/restart0 and full Config matching, with that single HostConfig difference. No phone reconnect, API client/financial operation, force kill, retry, bypass, container removal or journal reset followed. Fresh database/native/phone/quiet-window guards preceded one invocation of the already-approved coordinated rollback. Both candidates stopped cleanly; original ACK then bootstrap resumed and became healthy by17:38:46UTC. Post-rollback inspection confirmed original IDs/images and full Config/HostConfig hashes. Only EndpointID/MacAddress regenerated; original IP, gateway, network, aliases, DNS names, ports and routing remained unchanged. This regeneration is recorded explicitly; old network pins remain in history and new current pins require this new approval.

All seven complete financial row-set fingerprints and full sync-state hash match the preflight:81transactions/14accounts/87postings/12balances/12applied mutations/109revisions/406idempotency rows,169migrations. No unsettled mutation, lease, active ledger claim or runnable import. QA20 remains20SAR/version7/NULLnote and confirmed2525/pending0/ledger17. Xiaomi stays offline with the same12applied operations/one draft/original three cursor hashes and timestamps. Worker/frozen V7/33other services/7protected file pins unchanged. V3 result is ROLLED_BACK; cursor recovery NOT_RUN; T04 BLOCKED.

## Complete lifecycle root cause

[Engine29.8.1 commit464cd50 Unix settings code](https://github.com/moby/moby/blob/464cd50c3d9e92877d56940ea160de6fca7bea23/daemon/daemon_unix.go) defaults an unset OomKillDisable to false during creation, but its resource verifier clears that pointer when the kernel lacks the capability. [ContainerStart](https://github.com/moby/moby/blob/464cd50c3d9e92877d56940ea160de6fca7bea23/daemon/start.go) runs that verifier again before starting. Actual Docker /info reports OomKillDisable=false, CgroupVersion=2, CgroupDriver=systemd. Thus created false and started/stopped null represent this host's different lifecycle stages. V3 qualified the former but incorrectly reused that expectation for the latter. It is a runner qualification error, not evidence that OOM killing was disabled.

## Narrow v4 correction

Both exact qualified candidates now exist, each with its previous dedicated-key binding and a proven successful start/health/clean-stop lifecycle. V4 reuses both; it has no Docker create/update/remove or key-rewrite preparation path. No new image, container, secret, environment or broad qualification is needed.

The expected runtime HostConfig is copied exactly from each current original, including literal OomKillDisable=null. It must equal every actual candidate HostConfig field before holding originals and again after start. There is no boolean/null tolerance, ignored field or catch-and-continue. A false or true OOM value now fails exact runtime comparison, as does any other security drift. Engine version and current cgroup/capability are pinned so a changed platform stops before cutover.

Both retained IDs, names, images, full Config including real key Env, full HostConfig, static networks, restart0 and exact clean-stopped StartedAt/FinishedAt/status/exit/PID/error flags are mandatory. Both are validated before any hold. V3 apply and rollback journals, runner and packet plus the older v2 history are separately pinned and never reset. V4 gets a new exclusive artifact/journal subdirectory in the same existing bucket. Rollback accepts only the exact two completed ordered reuse bindings. Old files, candidates and original containers are retained.

## Verification and review

- Actual stopped lifecycle fixture first failed against the v3 false OOM expectation; after correction22focused tests pass. They cover exact runtime equality, both reuse bindings with no Docker preparation mutation, stopped-state drift, OOM/security/label/Env/network drift, predecessor rollback-journal drift, changed capability, stale gates, one-shot journals, coordinated ordering, graceful stop, uncertain actions and rollback targets.
- Exact final v4 runner preflight passes READ ONLY against the real server and both retained candidates, including existing-key equality/push-key separation in memory. Both originals healthy. All current original pins/protected files/worker/frozen/33other services and both consumed histories match. No v4 candidate mutation/start/stop occurred.
- All217inherited Git entries/282original R18 artifacts, sealed v2/v3 files and v3 execution receipts preserve their hashes. Tracked diff95f5577da3315a392ff357c1310d5bace6637ea360d537ef346ceb00adcce633; branch/HEAD unchanged. Product source, index, migrations and lockfiles unchanged. Existing inherited whitespace warning remains documented, not fixed.
- Existing qualified image/runtime/package/scan and accepted mobile/financial/navigation evidence reused. No unchanged broad suite, financial operation or accepted reauthentication test repeated.
- Existing real Xiaomi passive Network.enable capability responds successfully; observer closed, no app code execution, request/payload/header retention or network change. Future approved ordinary sync can be observed without printing tokens/cursors. This proves observation availability only; cursor recovery is NOT_RUN.

## Remaining execution controls

V4 approval does not accept T04 or extend the consumed v3 approval. Refresh sole ownership and every server/database/financial/native/phone/original-cursor/client-inactivity/quiet prerequisite immediately before execution, with the same eight-check120second packet-bound gate. Stop on any failed/unknown guard. Preserve all financial/auth/settings/drafts/capture/visibility states.

Same cutover: hold original bootstrap then ACK; start new ACK/health then bootstrap/health. Same indefinite SIGTERM/bounded observations/180second budget, no forced kill or automatic retries/compensation. Expected affected read/report/sync disruption20–60seconds, potentially longer on failure. After reconciliation, the approved separate rollback branch holds new bootstrap then ACK, restores original ACK/health then bootstrap/health with a new fresh gate. Both generations/journals persist.

Only after successful strict post-start/server checks may the approved bounded ordinary Xiaomi recovery reconnect Wi-Fi, present the three original cursors, observe typed400 SYNC_CURSOR_INVALID and automatic bootstrap/delta/ACK, then verify replacement cursor fingerprints/owner/session/App Lock/12applied identities/one draft and unchanged complete financial fingerprints. Preserve mobile data/airplane/capture, restore network/locale, use only affected AR/EN reads, private PIN by human. No Save/replay/financial/provider/capture/logout/purge/other-client reconnect. Any incomplete criterion keeps T04 BLOCKED, with T05/fullT06/later gates intact.
