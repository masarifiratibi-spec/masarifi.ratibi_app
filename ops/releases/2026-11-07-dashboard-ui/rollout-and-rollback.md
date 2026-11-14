# Exact dashboard rollout proposal — not executed

This proposal covers the existing **staging dashboard only**. No hosted preparation, container creation, proxy edit or activation has been authorized or performed. The Linux artifact is built off-host; the source and public configuration are pinned in `manifest.json`. Actual server credentials remain on the VPS. The final human approval must reference this packet's published commit and runtime SHA256.

## Reconciled current service and retained rollback

- Host: `srv2006836`, Hostinger VPS2006836. Browser origin: `https://staging.masarifiratibi.com`.
- Active routing file: `/etc/nginx/sites-available/masarifi-staging`, reached through the existing `sites-enabled/masarifi-staging` symlink. Original SHA256: `be7856f0d5f6183f14fdf01b136e5f4d30eaa15ecefc091aed0cc91c870b7b17`; root:root,0644.
- Dashboard upstream: `http://127.0.0.1:3040`, Docker container `masarifi-admin-canonical-721a943b-20261101-01`, full ID `47ecec2481c32a6cc801498d4681a6acfa0e7f2fb7f627c40cdbf3e7e966cbda`.
- Runtime image: `sha256:53a7a4530dfa0fb9b296d0c5bca3c330bf308fa7160fd7966cea681d092ca2c5`, runtime Node24.20.0. Image is retained; no pull/tag update is proposed.
- Old workspace: `/opt/masarifi/admin-releases/canonical-721a943b-artifact-20261101-01`. Old build: `RfJI7jhDb6BdroFc-2TBT`; source721a943b72837d3f43a4e4b61bc3ab4cd83738d8. Its whole Admin Git tree equals the dashboard baseline e13a905; all eight modified runtime-source preimages match.
- Cold rollback archive: `<old workspace>/verified-ci-runtime.tar.gz`,261,996,161 bytes, SHA256 `0e840ba719882dac127fce6ab878a1176159e2c7c3a5e5c199d1d726430f2a39`. It remains in place. The preferred rollback is the **already running old container**, not a cold restore.
- Exact environment/command/entrypoint/mount/resource/identity pins are in `host-baseline.json`. Environment values are not exported. The current Admin Docker healthcheck is disabled; explicit HTTP checks are required.

## Proposed bounded delta after approval

Candidate name: `masarifi-admin-dashboard-f865131a-20261107`.

Candidate root: `/opt/masarifi/admin-releases/dashboard-ui-f865131a4cfd-20261107`; unpack the verified runtime into its new `runtime` subdirectory. Candidate loopback mapping: `127.0.0.1:3041` to container3040. Port3041 was free during inspection and must be rechecked immediately before creation. Never replace an existing path/name/listener.

Create one Admin container from the **same immutable runtime image**. Copy the old Docker Config/HostConfig in memory, including its actual ordered environment, user1000:1000, working directory, command/entrypoint, bridge network,512MiB/.5CPU limits, read-only root and restart policy. Explicitly change only its generated hostname/name, bind-source roots and loopback HostPort3041. Keep container port3040 and the existing command unchanged. The workspace bind becomes `<candidate root>/runtime:/workspace:ro`; the cache bind becomes `<candidate root>/runtime/apps/admin-web/.next/cache:/workspace/apps/admin-web/.next/cache:rw`. Create that cache directory with uid/gid1000 and retain it separately from immutable runtime files. No placeholder key from the build may enter the container's runtime environment. Compare the new ordered environment hash to `995cbca1a1699ad63e532bae6ee6849fb30ce467385cf5e10703e66d3c856cc3` before start.

After canary checks pass, the only ingress delta is the dashboard `proxy_pass` destination3040→3041 in the pinned routing file. Require exactly one matching `proxy_pass` to127.0.0.1:3040 and review the rendered diff. Any other destination/line change aborts for reconciliation. Keep every API location, auth setting, hostname, TLS setting, header and all other files byte-identical. Validate with `nginx -t`; atomically install the candidate file preserving root:root/0644 and reload Nginx only. Keep the old container running on3040 and its files untouched.

## Order and stop conditions

1. Reconfirm the human approval, packet commit and exact runtime archive SHA256. Re-run `verify_packet.py` locally. Re-read serving container ID/start/image, ordered environment hash, routing symlink/hash, source/lock/build, all30 protected container identity/config hashes and a current pending-work projection. The present packet has no fresh pending-job SQL receipt; capture a read-only scoped projection before execution, never retry/consume jobs to obtain one. Any identity/config drift requires a new reconciled packet before proceeding.
2. Recheck port3041, candidate name/path absence, actual image presence, disk headroom and available memory. Require at least2GiB free disk and1.5GiB available memory before adding the512MiB canary. Do not stop/reclaim another service. These admission values are rollout limits, not production load qualification.
3. Transfer the exact retained CI archive by authenticated HTTPS. Verify bytes/hash **on the host before extraction**. Reject absolute/traversal/escaping symlink/device/archive entries and private `.env` files. Extract only into the new candidate root, never over the old workspace. Two report-source files are inert provenance members of the existing workflow; do not copy them into any API workspace or deploy a backend image.
4. Capture the original routing file under `<candidate root>/rollback/masarifi-staging.original`, verify its original hash, metadata and symlink target. Copy this complete reviewed packet into `<candidate root>/review-packet`; keep the rollback directory root-owned0700. Run the watchdog's default read-only inspection and syntax check. Before changing ingress, **start** its ten-minute watcher using the exact command below, record its PID/log, and confirm the PID is alive after two seconds and again immediately before proxy installation. It must remain independently running if the operator connection closes. Do not switch ingress without a live watcher; no general process-kill or container-prune command belongs here.
5. Create/start only the candidate container described above. Within60 seconds require a stable running process, no OOM/restart, and three consecutive HTTP200 reads of `/brand-icon.png` plus the candidate-specific static probe pinned in the manifest, with exact content hashes. Use Host:`staging.masarifiratibi.com` for loopback probes. An unauthenticated protected-route probe must produce the existing authentication challenge/redirect rather than500; it does not establish authenticated acceptance. Failure stops only the new candidate and leaves ingress untouched.
6. Install only the reviewed one-destination proxy delta, `nginx -t`, reload, then verify public TLS, candidate static hash/build and real administrator reads within120 seconds. Reuse the existing session; the human completes any private challenge. Failure,5xx, candidate restart/OOM, protected-service drift or missing administrator acceptance triggers rollback. Do not disarm the watchdog before these checks pass.
7. Perform the acceptance below, then atomically publish `<candidate root>/rollback/acceptance.json` containing `accepted:true`, `sourceCommit:f865131a4cfdcd8ef4b88c3287f125f4d33112e4`, and `runtimeSha256:186aec1f1fd5f3fa30f5e1791bb841c11664e0255e13c5195a7a26d1934c7c62` (JSON strings for the hashes). Require the watcher log to confirm its matching explicit acceptance. Malformed/unreadable/symlink markers do not disarm it. Record the served build/source and final protected projection. Retain the old running container/artifact and original routing file for rollback. Close temporary access/owned console. No cleanup/retirement is proposed by this approval.

The following command is documented for the **approved execution only** and has not run. Start it from the candidate root after preflight/canary admission, before ingress change; record the background PID and verify its liveness as above:

```sh
nohup python3 review-packet/rollback_watchdog.py --action watch --execute-approved --runtime-sha256 186aec1f1fd5f3fa30f5e1791bb841c11664e0255e13c5195a7a26d1934c7c62 > rollback/watchdog.log 2>&1 < /dev/null &
```

The exact immediate restoration command, from the same root, is:

```sh
python3 review-packet/rollback_watchdog.py --action restore --execute-approved --runtime-sha256 186aec1f1fd5f3fa30f5e1791bb841c11664e0255e13c5195a7a26d1934c7c62
```

## Acceptance and exact rollback

Public static/HTML checks prove the selected release was served. Authenticated Playwright checks must also cover Overview nullable revenue/counts, customer search/filter/paging, support/feedback reads, imports, AI/job reads and the actual53-row queue page. Check actual network responses and absence of schema/React-key errors; null age and unknown status/freshness remain explicit. Privacy recent-auth403 must explain its real requirement; it must not be bypassed. Recheck Arabic/English, light/dark and the repaired charts at1440/1280/1024/768/390. Billing stays unavailable. No customer/provider write is included in this rollout acceptance.

Rollback restores **only** `<candidate root>/rollback/masarifi-staging.original` to the existing resolved routing file, after confirming its SHA256 equals the original pinned hash and the enabled symlink still resolves to that file. Preserve the symlink, root:root and0644; `nginx -t` and reload. A retry validates/reloads even when disk bytes are already original, because disk state alone does not prove which configuration running workers loaded. Require old build `RfJI7jhDb6BdroFc-2TBT`, old static SHA256 `47e885f0b6ce11f7149a2fe4e58a29ce5dab1d384ab57a365ce74d05549db2f1` at `/brand-icon.png`, the old container identity/start/environment pins and public/authenticated recovery within60 seconds. Then stop **only** `masarifi-admin-dashboard-f865131a-20261107` after recording its receipt. Do not remove files, stop/restart the old Admin, restore a database, change DNS/TLS, replace an API/worker or replay an operation. A failed `nginx -t` leaves running workers serving their prior configuration. If any unrelated routing/symlink drift is detected, the watchdog refuses to overwrite it; the operator must reconcile that drift immediately rather than claim rollback succeeded.

The cold archive is an additional retained recovery pin; no cold-restore timing or full application RTO is claimed. The watchdog and actual host canary/rollback exercise belong to the explicitly approved execution, and have not run in this read-only preparation.
