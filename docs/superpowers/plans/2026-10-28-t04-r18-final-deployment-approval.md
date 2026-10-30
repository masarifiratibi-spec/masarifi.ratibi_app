# T04 R18 exact Staging deployment approval request

**Status: READY FOR SPECIFIC HUMAN APPROVAL; NOT DEPLOYED.** GPT-6.1 Sol Extra High is the sole responsible model. This is Sol self-review with separately named automated/runtime/database evidence, not independent model review. The latest instruction permits preparation only; the following actions require a new explicit approval.

## Proposed bounded action

Approve one coordinated replacement of the existing two Staging API roles, binding both to the **existing** dedicated cursor key from unchanged `/etc/masarifi/qa-t03-api.env`, and the reviewed rollback branch if needed after read-only reconciliation. No new key is generated. Do not replace either role with the worker/backend image.

| Role / routes | Original container | Original image | Qualified replacement image |
|---|---|---|---|
| sync-readiness / bootstrap and delta / loopback3020 | `ae727700013ef9bc9e7b3cbaea595143baebd9e7bae5c6f22fd54dfcc862ac73` | `sha256:53d890f0d8f8f8ed6cac7ed5a32889d9f4710a3d1badc7d440123a2bf2dbdcbd` | `sha256:6569dd9087ab58bed5a3c8dc7ca1d65fcd6354547642f63786af0438939351e0` |
| reports-ledger / ACK and existing fallback/report routes / loopback3001 | `4e9bc21d1475dff650b606e4c1627e12f603fd2b6a94bd15fe48a33a9790be05` | `sha256:bde04a161f8988897117b7810e976263ec723a42a5fac6703469d5e0070cfeff` | `sha256:a4456b3dc7fc8e883e50879f1f6291aae5140700b0cf1136e2190cc70f5da721` |

Archive SHA-256 `8937ba09919a4e94ee7179bf354fc4697dfad6b9105b2c3bce210f7c61e09f83`; build-manifest SHA-256 `9bd60a69874cba5b0af54b568d85151d3bf329f4332ee70119570b154d84450e`. Existing qualified images/scans/tests are reused unchanged. Local final packet is `r18-cursor-api-artifact-prep/rollout-packet-v2/packet.json`; its hash is presented in the chat and the external checksum receipt. The earlier held v1 is immutable and does not authorize this action.

After approval, stage only the hash-bound runner/spec/packet/evidence files into the existing archive bucket's `rollout-r18-v1`, root-owned0700/files0600, then use its existing sudo/Docker access. No new infrastructure, environment or builder is created. This is the first approved staging of this runner, not a repeat of the completed image upload/build.

The reviewed runner is byte-identical to the locally qualified v1 runner. Each API retains its own actual complete Config/HostConfig, all existing environment values and security/CA/network/port/restart/log settings. Exactly the dedicated cursor-key environment entry is added and the pinned API image selected. Candidate container names gain the fixed R18 suffix; existing names are preserved as network DNS aliases. The stopped originals remain available. See the [full operational review](2026-10-28-t04-r18-deployment-review.md) for exact mechanisms and limitations.

## Key binding and client impact

The existing T03 file is unchanged: whole-file SHA-256 `06506707b7a28c3817fb6afb577a1c9ab84ba11e39962755bd9d612e1984a077`, UID/GID1000:1000, mode0600. Current read-only server preflight confirms canonical32-byte base64url material distinct from both APIs' push hash keys. Only its dedicated key is extracted in protected server memory. The whole older env file is never substituted for an API's current environment. No push/Clerk/auth/encryption rotation or protected source-env edit is proposed. Values/key digests are never printed or placed on a command line.

The binding persists in Docker's existing protected container Config metadata. A same-container/daemon restart retains it; recreation using older launch configuration would omit it. Preserve this exact service configuration record and never run an old recreation command implicitly.

Switching keys deliberately retires shared-key cursors. Expected response to an old cursor is typed HTTP400 `SYNC_CURSOR_INVALID`; the existing corrected Xiaomi client must recover through normal bootstrap/delta/ACK, preserving pending operations, receipts, drafts, owner and session. No legacy shared-key fallback or manual cursor reset is included. Rollback retires any newly issued dedicated cursors and similarly requires ordinary recovery.

**Required maintenance condition:** keep every other client/device inactive during the cutover and until its own cursor recovery has been safely qualified. Hosted metadata has five sync-state rows/domain and four device rows active within24hours; the most recent device-seen value advanced to15:37:29UTC. Version0.0.1 does not establish identical recovery implementations. This approval requests the user's explicit quiet-window/inactivity confirmation; it does not claim those clients were tested or authorize their later reconnect. Do not set the client-compatibility/quiet-window gates true from aggregate metadata alone. The existing Xiaomi is the only ordinary online read/sync verification target in this action.

## Ordering, bounds and failure handling

1. Refresh sole ownership, source/pins, server Config/image/files/worker/frozen state, local/native queues/cursors and authoritative financial preimages immediately before action. A gate receipt binds this packet's hash, all eight required prerequisite checks and a maximum age of120seconds. Any drift/pending/unknown work, another controller or missing quiet-window confirmation stops execution. No silent repin.
2. Reserve an exclusive fsynced journal. Create exactly two stopped candidates and compare their Config/HostConfig/static network fields before holding either serving API. An unexpected Docker default/normalization difference leaves originals serving and requires reconciliation.
3. Gracefully hold original bootstrap first, original ACK second. Stop uses SIGTERM with Docker timeout-1 and a bounded observation; no SIGKILL. Start qualified ACK and require Docker health plus actual loopback live/ready200; only then start qualified bootstrap and require the same. Nginx routing and the original sync-only worker remain intact. This is coordinated, not atomic.
4. Expected healthy-path disruption is approximately20–60seconds for affected read/report/sync routes, with a fail-closed unavailable/502 interval. The controller's cutover observation budget is180seconds. Failure can extend downtime until read-only reconciliation and reviewed rollback; the budget is not a restoration guarantee.
5. No automatic mutation retries, compensation, container removal, pruning or forced kills. Every action has intent/completion receipts. An uncertain action stops; inspect read-only rather than retrying. After reconciliation, the separately invoked rollback branch uses the same approved packet and a new fresh gate: hold new bootstrap then new ACK; restore original ACK/health then original bootstrap/health. Both generations/containers/evidence remain preserved. A partial/uncertain create with no two completed candidate IDs is not guessed into rollback. Rollback restores the historical R18 defect and cannot accept T04.
6. Verify exact images/key equality and original push-key inequality in protected memory, security/config preservation, both live/ready routes, protected hashes, unchanged worker/frozen consumer and all33other services. Only then allow the bounded ordinary Xiaomi online reads/metadata ACKs below.

## Post-cutover acceptance scope

Use the Xiaomi's three original stored cursors through ordinary signed-in synchronization. Observe actual typed old-cursor failure, normal bootstrap/delta/ACK across both actual services, new cursor fingerprints and preserved owner/device/domain binding. Do not manufacture invalid cursors, edit queue rows, re-save expenses, replay applied operations, log out or purge storage. Any necessary PIN/factor is completed privately by the human through supported UI.

This bounded verification includes temporarily reconnecting the existing Xiaomi through its ordinary Wi-Fi only after fresh queue/native-producer checks, with mobile data/airplane/capture settings preserved. It permits temporary Arabic/English selection solely for the affected read journeys, followed by restoration of the exact pre-verification network/locale settings. No other device reconnect, capture/permission activation, provider call or financial submission is authorized.

Verify the same SDK session/App Lock,12applied operation identities, one retained draft and disabled capture. Check affected reads in Arabic/RTL and English/LTR without repeating completed unrelated navigation journeys. Verify no new mutation/idempotency/financial revision, and full transaction/posting/account/balance/mutation/revision/idempotency fingerprints against the immediately preceding approved preimages. Preserve QA20 version7/NULLnote/20SAR/one original posting and account2525confirmed/0pending/ledger17. If metadata changes legitimately, stop and explain it; do not silently weaken a guard.

Full T04 acceptance still requires reconciling original2.1/R5/R10/R17/R18/R19, historical source/Astra approval, fixture-only destructive cases and completed actual reauthentication/restoration evidence. This approval does not mark T04 PASS. T05 and full T06 remain gated until applicable T04 acceptance actually passes.

## Current independent evidence and remaining limits

| Producer | Current evidence / scope |
|---|---|
| Strict existing SSH,16:05:27UTC | Both original IDs/images/Config/HostConfig/network hashes match; both healthy/restart0;36runningcontainers; both exact qualified images present/inactive;7protected file byte/permission pins match; original worker/frozen state and33other services match; existing dedicated key reusable without new material. No Docker mutations. |
| Actual compiled-module reads and loopback health,16:08:55UTC | Both current service modules hash `2997e1ade138e1c6cb072b90f8537217b1e56428d96e19f455537008223cb63a`, each has3shared-key reads/0dedicated reads;3020and3001live/ready all200. Effective nginx/site routes retain3020bootstrap/delta and3001ACK/fallback. |
| Existing qualified image runtime/package/Trivy checks | Reused exact candidates: nine cursor/config cases each, config/package preservation, scoped middleware qualification; HIGH0/CRITICAL0 with lower severities and advisory reproduction limits retained. No unchanged suite rerun. |
| New private runner unittest producer |14PASS plus syntax proof, byte-bound unchanged source. Synthetic Docker boundary only; actual Docker create/start/stop/rollback transport NOT_RUN. Candidate configuration guards precede serving holds. |
| Current Xiaomi SQLite SELECTs,16:09:42UTC | Same expected owner DB/device/appPID24113; offline;12applied only, same three original cursor hashes, one draft, zeroVoice journal/unfinished-or-audio batches/SMS rows; operation-set hash equals hosted12. Native producer metadata15:50UTC showed sources/captureoff/no queuedciphertext and must be refreshed immediately before action. |
| Connected hosted READ ONLY,16:07:52UTC |169migrations;81transactions/14accounts/87postings/12balances/12mutations/109revisions/406idempotencyrows; full fingerprints captured; zero unsettled or runnable imports. Accounts/postings/full-balance fingerprints match completed restoration pins; QA values unchanged. Other row-set fingerprints are new exact before/after pins, not retroactive old-evidence equivalence. |
| Human access approval | Only one SSH `/32` rule was approved and applied;29rules now, all28prior rules/defaultpolicy preserved. Original key/strictknownhost SSH works. This was not deployment/key approval. |
| Human deployment/quiet-window gate | PENDING. All protected rollout actions and ordinary phone reconnect remain unperformed. |

Sol's self-review accepts preparation for this exact bounded approval request, with the limits above. Automated/image/authoritative database producers remain attributed separately; no independent model review is claimed. No original requirement, hidden feature, prior success, exception or denominator has been changed. Production, billing, financial submissions, provider messages, migrations/policies, worker lifecycle, frozen V7 and authentication/settings changes are excluded.
