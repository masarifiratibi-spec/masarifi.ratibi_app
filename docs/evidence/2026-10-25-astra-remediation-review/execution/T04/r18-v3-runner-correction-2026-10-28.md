# T04 R18 v3 runner correction — 28 October 2026

Status: LOCAL CORRECTION QUALIFIED; AWAITING NEW SPECIFIC DEPLOYMENT APPROVAL. GPT-6.1 Sol/xhigh only; self-review with named independent evidence. Full T04 BLOCKED; cursor recovery NOT_RUN. T05 NOT_STARTED/full T06 and later dependencies unchanged.

The [consumed v2 attempt](r18-deployment-guard-stop-2026-10-28.md) remains preserved. No v3 protected server file was staged, candidate created/started/stopped/rewritten, or serving key activated. Existing strict SSH continues to work through the previously approved rule; no additional firewall action.

## Corrected behavior

- Explicitly request the exact three qualified-image provenance labels while preserving every original runtime label/value. Image metadata is separately checked against its immutable base-image labels plus that provenance, including existing runtime overrides.
- Explicitly materialize OomKillDisable=false only for an unset original flag, matching [the exact deployed Engine default](https://github.com/moby/moby/blob/464cd50c3d9e92877d56940ea160de6fca7bea23/daemon/daemon_unix.go). The [same Engine's merge rule](https://github.com/moby/moby/blob/464cd50c3d9e92877d56940ea160de6fca7bea23/daemon/commit.go) explains image-label inheritance. Other fields are not normalized or ignored; entire Config/HostConfig equality is mandatory.
- Reuse exact retained never-started sync candidate5ba09a5b36366ec707726f5e23d73e93b3b36ec0f50147100d4ab51beb3d9747 after full identity/config/key/static-network/clean-created-state guards. Only the reports candidate is newly created after approval. No duplicate sync create, rebuild or new key.
- Pin consumed predecessor packet/runner/journal. Use a separate exclusive v3 artifact/journal directory in the same existing bucket. Rollback requires exact ordered distinct completed reuse/create role bindings. No reset, replay or inferred candidate identity.

## Verified evidence

All26 focused runner checks pass. The actual sanitized candidate regression first failed on the original label expectation. Base-image label handling also has red/green evidence. Changed tests cover retained reuse and all identified drift/failure paths; accepted application/image/financial/navigation suites were not repeated.

At16:52:41UTC, the exact final runner preflight and actual retained candidate comparison passed read-only on Staging Engine29.8.1/API1.56/git464cd50. Both serving original APIs remained healthy. Existing dedicated-key canonical shape/push-key separation and its actual candidate binding were verified in protected server memory, with no individual key digest/value output. All original Config/HostConfig/network pins,7protected files, worker/frozen consumer/33unrelated service guards and consumed history passed. New create/start/stop/rollback transport is NOT_RUN; reports actual-created equality remains a mandatory pre-cutover guard.

All217 inherited Git entries,282 original R18 artifacts and every sealed v2 packet file matched their saved SHA-256. Tracked diff remains95f5577da3315a392ff357c1310d5bace6637ea360d537ef346ceb00adcce633. Original plan SHA remainsdde83afd481bb9d5f1f68e0be12c39eaa1c5b221c33b4ad49caf48f2b95bf189. Branch/HEAD unchanged; no source/index/migration/lockfile edit.

Exact sealed v3 packet SHA-256: **a4bda58e0d340e6410264a0bfdc48094fcf60dd34b4f4e67e6aa710485e1e615**. Runner SHA-256: **9e6503a71f86f45ec7d93b983042fc49da64c8c759be3088715145f27b50cba0**.18boundfiles. Private location: existing R18 bucket, rollout-packet-v3. Files include REVIEW.md, APPROVAL.md, spec.json, runner/tests/log, real-server readonly receipts, sanitized Docker fixture, original qualified-image receipts and preservation.json. CHECKSUM.json sits outside the hash manifest to avoid a self-reference.

The [new exact approval request](../../../../superpowers/plans/2026-10-28-t04-r18-v3-deployment-approval.md) was submitted asynchronously. The older v2 approval cannot cover changed runner/reuse behavior. Approval must reconfirm other testing clients inactive, current safety checks and the stated rollback/recovery bounds. No activity or financial baseline is silently refreshed into a permissive gate.

While awaiting approval, [new bounded offline Xiaomi search and Support observations](../T06/search-support-pending-v3-2026-10-28.md) were completed under the existing navigation exception. All three original cursor hashes/timestamps,12applied operation identities and one draft remain unchanged. Arabic/Home/All Accounts/October and Wi-Fi0/data0 restored; original appPID24113 and owned Metro25284/32992/8081reverse retained. No financial/auth/support submission, capture, provider call or reconnect.

Before any approved execution, independently refresh all server/database/worker/client/native/phone prerequisites and full financial preimages, sole ownership and client-inactivity confirmation. Require the new packet-bound120second gate; stop on any failure or uncertainty. Do not reuse old receipts as current execution evidence. Full T04 acceptance still requires real Xiaomi typed old-cursor rejection plus automatic recovery and every remaining original criterion.

Verification note: git diff --check reported the inherited apps/mobile/src/config/client-runtime.ts:191 blank line at EOF, alongside existing LF/CRLF warnings. That file retains its saved original hash and was not edited by this correction; no broad whitespace cleanup was performed. This is not reported as a clean whole-checkout whitespace check.
