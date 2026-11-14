# Current VPS dashboard packet

**Blocked; no hosted execution authorized.** The manifest is the authority for exact source, artifact and target pins. The November7 packet is historical and must not be executed. This directory imports nothing from it. Pure admission algorithms were frozen here to keep the current packet independent of historical executors and their concurrent WIP.

The admitted Admin source is `fd834905433060551bb71940be1eb0e504097cca`, artifact `14086067555`, build `JnPTcIfQ1KSXKIwHFmZEy`. Foundation `43528337279` passed the full application, database, stress, UI matrix and image gates. The API proposal retains the installed immutable image and all29 migration mounts, changing only the two hash-bound support-access modules. It does not replace the VPS runtime with clean HEAD or an old checkout.

## Exact proposed effects

- Stage under `/opt/masarifi/admin/releases/dashboard-vps-fd834905-20261114`, a new root-only directory. Extract the verified Admin archive with path/link/type checks; keep runtime files read-only and provide a separate cache owned by1000:1000.
- Create `masarifi-dashboard-admin-fd834905-20261114`, loopback3090→3040, and `masarifi-dashboard-api-fd834905-20261114`, loopback3091→3000. Retain admitted images, commands, environment and memberships in current networks; do not inherit service aliases. Trial restart policy is `no`. API module mounts are read-only; unrelated mounts and originals are retained.
- Qualify the two modules using the exact installed Node/image with no network, no published port and no original container environment. Start both candidates privately and require readiness/static probes before arming the watchdog. Original containers, frozen consumers, PostgreSQL and storage must match their admitted state.
- Render and execute only migration `20261107140100`. Bind the transaction to the current VPS cluster, executor, full ledger, role memberships and CHECK preimage; use the canonical advisory lock and bounded timeouts. Grant cleanup, DDL, postconditions and canonical ledger insertion occur in the same transaction. An uncertain commit is resolved by `attest`, never a blind replay.
- Change only the staging Admin root upstream3041→3090 and add four exact/descendant support-request locations to3091. Other Admin/API routes retain their current parents; the production vhost is unchanged. Preserve existing proxy policy and headers; explicitly prevent support-response caching.
- The independent systemd watchdog owns the switch and enforces a20-minute deadline. A disconnected operator cannot keep the trial active. Acceptance must match the ticket, watchdog PID, candidate IDs, admitted actor digests and all14 private evidence cases. The durable decision precedes persistent routing and accepted restart-policy updates.
- Expiry, failed gates, abort or watchdog restart restores admitted original routing, proves the actually served generation, then disables candidate restart and stops only the admitted candidate IDs. Accepted rollback uses an independent unit. Preserve all VPS database/storage data and new writes, including the compatible denial CHECK after a successful migration.

## Required review and execution order

Resolve the manifest blockers first. Complete Linux/PG17 qualification and review the exact admission receipt, candidate payload hashes, routing delta, independent actors and protected-service probes. Install the packet root-owned with a0700 parent and non-writable files; independently compare its approved file hashes before importing any module. Retain the immutable artifact, canonical LF migration and private evidence under `/etc/masarifi/selfhost/dashboard-inputs-20261114` (root0700, files0600). No secret is part of this packet.

Only after the human approves the exact final manifest SHA256, an operator may create a root-only `approval.json` containing exactly `packetSha256`, `decision:"approved"`, `actor:"user"`. The executor cannot create that approval. It also refuses a blocked manifest, altered packet files, missing Linux qualification, foreign target or missing approval. Never populate approvals or acceptance evidence from mock tests.

Run `host_release.py` only from the admitted root-owned packet path, with `--approved-packet-sha256` on every action:

1. `stage`: dispatch a bounded independent staging unit; inspect private `staged.json` and the live watchdog acknowledgment. `ExecStopPost` quiesces only owned, unarmed candidates on staging interruption. Do not proceed on an uncertain result.
2. `migrate`: execute the one transaction and verify its postimage. On a lost result, use `attest` read-only. On failure, let the private trial expire or request `abort`; original routing remains authoritative.
3. `trial`: independently recheck candidates and migration, then request the armed watchdog's switch. Read `switched.json` and its bound observation; a command returning is not proof of a served switch.
4. Capture real browser/API evidence with the independent authorized actors. Scope is only `account-status/read-status`. Cover consent, independent review, masked assignment, end, external revoke, natural expiry, stale version, uncertain replay, wrong owner/assignee, self-review rejection, refresh/session continuity and protected routes/services.
5. `accept --evidence-sha256 <actual-private-receipt>`: request acceptance; require `accepted.json`, public generation proof and accepted configuration readback. Otherwise use `abort` while the watchdog is active. After an accepted trial and an inactive watchdog, `restore` dispatches independent service-routing rollback. A failed restoration has no success receipt and must be investigated through the private unit state.

`admission.py` is read-only and emits no Env or config bodies. `migration_packet.py`, `runtime_plan.py`, `patch_security_modules.py` and `trial_watchdog.py` have no automatic host actions. Qualification scripts require disposable fixtures; Linux service/mount qualifications refuse execution outside a GitHub VM. Their results do not authorize any VPS action.

## Current limits

The manifest remains blocked. The installed-image module/cold-start checks and authenticated acceptance have not run. Current target admission is being finalized. Independent actors are not yet identified. Linux timeout/mount/PG17 qualification must pass. No service, Nginx file, schema, role membership or container has been changed by this dashboard packet.
