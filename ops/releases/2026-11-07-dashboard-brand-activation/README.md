# Approved dashboard branding and UI activation

Source `abd641d1032654298f0c94a99d8ed73ce3cea712` includes the previously qualified dashboard repairs and the human-requested approved emerald/gold logo. The human explicitly approved staging activation in this chat and subsequently completed private root-console login. This packet records that approval; no new database, API, worker, role, mobile or credential change is included.

| Identity | Pin |
|---|---|
| Source Admin tree | `cc7a7dfb04b452ba2c4d3d7f80b29f2bc16bc497` |
| Linux runtime |263,597,364 bytes; SHA256 `31d4347333007fcdb5812118032714ca0a0533146acd79afeeb1e29e1c85660a` |
| Candidate Next build | `tVR-q9gIlaCqW_hSYBwNT` |
| Immutable runtime image | `sha256:53a7a4530dfa0fb9b296d0c5bca3c330bf308fa7160fd7966cea681d092ca2c5` (unchanged) |
| Candidate | `masarifi-admin-dashboard-abd641d1-20261107`, loopback3041→container3040 |
| Retained current/rollback | old container `47ecec2481c32a6cc801498d4681a6acfa0e7f2fb7f627c40cdbf3e7e966cbda` on3040, build `RfJI7jhDb6BdroFc-2TBT` |
| Original routing file | SHA256 `be7856f0d5f6183f14fdf01b136e5f4d30eaa15ecefc091aed0cc91c870b7b17` |
| One-destination candidate routing | SHA256 `81c6ca948a8264214b1c64fa1d72c06079403814064bda62311143691466c9b9` |

The [manifest](manifest.json), [fresh host baseline](host-baseline.json), [CI manifest](linux-ci-manifest.json) and [English evidence](../../../docs/evidence/2026-11-07-dashboard-brand-activation/verification.json) are the review inputs. At this pre-execution publication no candidate process or ingress change has run. Execution outcomes belong in a separate `execution-result.json`; source/runtime pins remain frozen.

The browser matrix passed20 locale/theme/width cases with no page/console errors or overflow. The15 repaired UI regressions passed again, with TypeScript and ESLint exit0. [Linux CI42358370867](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42358370867) passed exact checkout/install/typecheck/build/package; backend image work was skipped. All20 changed source files match the retained runtime. Unchanged1029-unit and106-route rendering evidence is reused. API/mobile/database CI issues and known noncredential secret-scan matches remain separate from this scoped release.

## Execution order

1. Copy this reviewed packet from its immutable published Git commit to a new root-owned review directory; compare canonical file hashes before executing any helper. `archive_verifier.py` verifies retained local source/runtime bytes; its approved flag is informational, not permission for unrelated actions. Run the offline tests; the host helper rejects Python optimization so `-O` cannot disable safeguards.
2. Run `python3 host_release.py inspect`. It is read-only and rechecks the old process/image/environment, all31 original container configuration/identity hashes, routing link and old build. The real GET projection contains53 registered rows, active0/waiting2/failed0 at09:56:30UTC; it is a snapshot, not an instruction to drain or replay those jobs. One earlier503 recovered to200 and remains in the evidence.
3. Run `python3 host_release.py stage --execute-approved`, supplying the one-use CI artifact download URL only at the hidden prompt. Actual server credentials never leave Docker's existing Env and are cloned in memory. The helper requires new candidate root/name absence, port3041 free,2GiB disk and1.5GiB available memory, then pins ZIP/runtime/source bytes before safe extraction. It clones the old Config/HostConfig, changing only generated hostname, immutable-image representation, two bind-source roots and the loopback host port. Every other setting, exact Env,512MiB/.5CPU/read-only-root/bridge/restart policy remains checked. It compares the created container's actual image ID before start. A failed qualification stops only the receipt-recorded owned candidate and leaves ingress/old services untouched. An uncertain/stopped stage must be reconciled from its receipt; never replay it blindly.
4. Canary qualification requires three consecutive exact static/build/brand probes, the same unauthenticated307 Clerk sign-in challenge on `/admin`, no OOM/restart, and unchanged original services. Then run `python3 host_release.py switch --execute-approved`. It starts an independent600-second rollback watcher, verifies it is alive, installs only the pinned one-destination Nginx delta, validates/reloads Nginx and rechecks the served build over TLS. Original container3040 stays running.
5. Within120seconds verify the real existing administrator session, logo/favicon/build, queue page rendering all53 rows, permissions and representative real reads in Playwright. Complete responsive/theme/language verification before the600-second rollback deadline. No provider/customer write or job retry/cancel belongs to this acceptance. If anything is unqualified, execute the pinned rollback immediately; do not accept a failed handover merely because static assets load.
6. Only after observed public/authenticated acceptance run `python3 host_release.py accept --execute-approved`. It verifies served health before atomically publishing a marker bound to this source/runtime/watcher PID, **waits for that watcher's acknowledgment**, then rechecks routing, candidate process/configuration, old services and served TLS build before recording acceptance. Missing/late acknowledgment or a failed post-acknowledgment check withdraws the marker and invokes the pinned guarded restore; neither reports success. Retain the old container/artifact/configuration, record sanitized execution receipts and close the owned root session/console. No retirement or cleanup of other work is authorized.

Immediate rollback from the staged review-packet directory:

```sh
python3 rollback_watchdog.py --action restore --execute-approved --runtime-sha256 31d4347333007fcdb5812118032714ca0a0533146acd79afeeb1e29e1c85660a
```

It restores only the pinned original file if the current file is either the original or this exact candidate and the enabled symlink still points to it. Even a retry with original disk bytes validates/reloads Nginx. Verify old build/static/authenticated recovery before stopping only this candidate. Unrelated routing drift is never overwritten. The retained cold archive remains SHA256 `0e840ba719882dac127fce6ab878a1176159e2c7c3a5e5c199d1d726430f2a39`; no cold-restore RTO is claimed.

No SSH/firewall/DNS/TLS/password/OS change is proposed or performed. The existing SSH transport probe timed out; use the human-authenticated console. Keep every API/worker, current Android129 delivery/session, iOS work, financial/private data and pending operations unchanged.
