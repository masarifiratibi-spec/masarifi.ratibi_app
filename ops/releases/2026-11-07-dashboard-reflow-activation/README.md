# Approved staging dashboard reflow activation

Source `97ad25515ca283083057f010366516d4cd5931d4` retains the qualified UI/contract fixes and approved emerald/gold logo, and fixes the390px queue-card overflow that rejected the prior rollout. The human's explicit staging approval remains in scope. Only this dashboard is changed; no SQL, API/worker, role, session, DNS, TLS, SSH/firewall, credential or mobile action is authorized here.

| Identity | Pin |
|---|---|
| Admin source tree | `e7a0af6e67a7bbff2794f882d0aeb59edac77de4` |
| Runtime | 263559773 bytes; SHA256 `2ee32773b953a04f8a9e4c25b02f024924f99e510a9888460c55091326d9a68a` |
| Next build | `HpKjKCcL4BG8PJNVU5_VI` |
| Runtime image, unchanged | `sha256:53a7a4530dfa0fb9b296d0c5bca3c330bf308fa7160fd7966cea681d092ca2c5` |
| New candidate | `masarifi-admin-reflow-97ad2551-20261107`; loopback3041 to container3040 |
| Original retained rollback | old container47ecec2481c3 on3040; buildRfJI7jhDb6BdroFc-2TBT |
| Original / candidate Nginx SHA256 | `be7856f0d5f6183f14fdf01b136e5f4d30eaa15ecefc091aed0cc91c870b7b17` / `81c6ca948a8264214b1c64fa1d72c06079403814064bda62311143691466c9b9` |

Read the [manifest](manifest.json), [baseline](host-baseline.json), [CI manifest](linux-ci-manifest.json), [local evidence](../../../docs/evidence/2026-11-07-dashboard-brand-activation/reflow-verification.json), and [previous rejection/rollback](../2026-11-07-dashboard-brand-activation/execution-result.json). Prior source abd641d1/runtime31d434... is rejected, stopped and retained. Its watcher was terminated after pinned restore. Do not replay that stage or any SQL/mobile helper.

Local50 UI/operations tests passed across5 viewports. The final label test passed20 locale/theme/width combinations, retaining the full128-character synthetic public job label and checking actual text-line bounds;20 screenshots were saved and representative desktop/tablet/mobile views inspected. TypeScript/full ESLint/final test lint passed. Exact-source Linux [CI42364646173](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42364646173) must be successful with backend-image work skipped. The retained1029-unit and106-route inventory/rendering evidence remains scoped to unchanged behavioral inputs; new hosted available-route acceptance is recorded separately.

## Guarded execution

1. Copy this packet from its immutable published review commit into a new root-owned review directory, verify every canonical file SHA256, and run the17 offline tests on Linux. `python3 host_release.py inspect` is read-only. It rechecks original31 running process/configuration identities, old image/environment/build, and the Nginx link. Require old routing, free3041 and sufficient resources. Existing real queue reads remain read-only; no pending work is drained or replayed.
2. `python3 host_release.py stage --execute-approved` creates the fresh candidate root/name once, downloads the CI ZIP only at a hidden one-use HTTPS prompt, hashes ZIP/runtime/source/build and validates/extracts the complete safe archive. It then compares the entire extracted tree (all file bytes, executable bits, symlink targets, parent directories and unexpected entries) with that pinned tar, allowing only contents of the real dedicated writable cache. The actual Env stays in Docker memory; no CI placeholder replaces it. Exact Config/HostConfig/image checks precede start; OomKillDisable is explicitly false so OOM killing remains enabled, with no filtered comparison. A failed qualification stops only the receipt-owned candidate.
3. After three consecutive canary build/brand/auth probes, `python3 host_release.py switch --execute-approved` arms an independent600-second watcher, verifies it is alive, installs only the one-destination pinned Nginx delta, validates/reloads and probes the routed build through strict TLS. The old3040 process/archive stay available. Reconcile a consumed receipt; never replay an uncertain stage or handover.
4. Verify the existing real administrator within120seconds: exact build/logo/favicon, real53-queue response and53 rendered cards, truthful null/unknown/freshness, no exceptions. Complete the20 locale/theme/width matrix, actual screenshots and representative/available route reads within the600-second watcher window. Do not issue provider/customer writes or retries. Any new layout/auth/data failure requires pinned rollback, not acceptance.
5. Only after observed acceptance, `python3 host_release.py accept --execute-approved` publishes the marker bound to source/runtime/watcher PID and waits for that watcher's acknowledgment. It then rechecks routing/process/configuration/services/strict-TLS build. Missing acknowledgment or failed post-ack check withdraws the marker and restores old routing. Record actual execution in a separate `execution-result.json`, preserve the rollback, exit root and close only the owned console.

Immediate rollback from `/opt/masarifi/admin-releases/dashboard-reflow-97ad25515ca2-20261107/review-packet`:

```sh
python3 rollback_watchdog.py --action restore --execute-approved --runtime-sha256 2ee32773b953a04f8a9e4c25b02f024924f99e510a9888460c55091326d9a68a
```

The guard accepts only this exact candidate/original file and unchanged enabled symlink; unrelated routing drift is not overwritten. Verify old build and authenticated recovery before stopping only this candidate. Cold rollback archive SHA256 remains0e840ba719882dac127fce6ab878a1176159e2c7c3a5e5c199d1d726430f2a39; no cold-restore RTO is claimed. Serving/build acceptance is distinct from unsupported billing, provider-write acceptance, recent-auth privacy guards and unrelated repository-wide CI findings.
