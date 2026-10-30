# T04 Staging Xiaomi reauthentication test v8 â€” awaiting specific approval

Sol Extra High prepared and self-reviewed this distinct successor after the approved reference-free review repair. It authorizes nothing until the user approves this exact packet hash. The preserved v7 packet SHA256 `8a0ca2a4cf771364f2a044905e65b4d5eb41a72910ad56b2a15c0731efe78611` remains unchanged and inert. Frozen T03 consumer V7 is a separate historical artifact and remains stopped and untouched.

## Decision requested and exact impact

Approve one conditional experiment on the existing Staging normal worker and the existing `QA-20261025-EXPENSE-20` transaction. Use the same qualified image, `sha256:f1ea1557383d70cd3e78e361c18412171bb0ae002ea53314eefaddbd20495bf4`, and retain only `sync-mutations.retry`. Temporarily add `MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS=SAR:2000`; the existing recent-auth maximum age remains 600 seconds. Gracefully recreate only this worker for activation and restoration using the pinned existing Compose inputs below.

The threshold applies to **every owner's qualifying SAR ledger command processed by this worker**, including commands arriving during the test. It is not an owner-specific or QA-only policy. Other owners could receive a verification-required rejection. A quiet window, empty current queues and monitoring reduce exposure but cannot prevent another client submitting work. No other service receives this environment override.

The approved device scope would permit at most two distinct ordinary note revisions on the existing 20-SAR QA expense: NULL â†’ `T04 reauth verification` â†’ NULL. These create two permanent audit revisions even after the note is restored. Preserve amount, date, account, category, title, ownership, postings and all other financial fields. No other financial submission, review decision, Voice retry, schema change, service/image upgrade, Production or billing action is included.

Approval also explicitly accepts the revised interference guard below in place of v7's unsatisfied individual pooled-client attribution prerequisite. This changes the proposed experiment's operational guard, **not** T04's acceptance criteria. Do not execute v7 or describe its attribution guard as satisfied.

## Current evidence and unresolved limit

Evidence is in the existing private directory `.superpowers/sdd/2026-10-25-astra-readiness-remediation/T04/access-restoration-2026-10-27T0735Z/`. Input manifest `sol-t04-v8-pins.json`, SHA256 **`76defc1e5871c63833b08598e4f5aeaae905de26011c562c2e259d41c483c00c`**, binds 28 receipt/source files. Recheck these bytes before execution; do not silently replace preimages.

- At 12:28 UTC, the already-installed Expo SQLite inspector showed ten applied mutations, no pending/sending/conflict/rejected mutations, no nonterminal/audio Voice or batch work, no pending SMS, and one retained draft. Native preference metadata established an empty notification queue with SMS/notification capture disabled. No keys, decryption, database export, queue writes or pruning native read were used.
- The user privately unlocked the normal App Lock gate. Ordinary offline UI shows the exact QA20 title, 20 SAR, QA account, 25 October and Synced; the untouched edit form shows a blank note. The UI does not expose the Clerk subject or prove backend version. Those are separately pinned by the hosted row and established account/device evidence. No Save has occurred.
- At 12:34:52 UTC, hosted financial hashes and QA20 match the fixed preimage below; all ten mutations are applied, with zero received/processing or recent-auth-rejected work. All 26 imports are either complete (25) or owner review (1), with no active lease. All sixteen Voice sessions are confirmed. At 12:35:34 UTC, all planning claims, assistant jobs and Voice batches are completed and no account deletion is pending. No transaction changed after the approved repair's commit.
- The approved repair naturally settled attempt705 into exactly one pending owner review. At 12:34 it remains review/705/unleased. The actual import claim function admits only received/processing, so retained next_attempt_at does not make this review runnable. Never accept/reject or otherwise settle this owner's item. The two old October4 retrying source.consume/support-attachment.scan rows belong to the engagement path, are outside this worker's scope and are not ledger commands; preserve them.
- At 12:35 UTC, worker ID `884a80ebc38277dea607d694d5523c64a5ed8e60ee9d62160e48de847d9e101a`, image/scope/security/start/restart state, protected env/CA files, original API and frozen V7/journal match. Threshold is absent. The read-only Compose comparison proves that the proposed seventh file changes only this worker setting and no other service/configuration.
- At 12:35â€“12:36, history is 169 rows / SHA256 `f8ac2cd021d26519d73496237d7ca21ba2e67f0b71d65cbca49cfb83e7ba4c08`. The original 166 history rows, two reauth/planning bodies, mutation functions/ACLs/search_path/constraints/memberships and nullable authenticated_at/receiver shape match their previous pins. The new finalizer/internal protections match the approved repair. The snapshot's mistaken nonexistent finalize_import_parse_v3 lookup returned NULL; it is not protection evidence. The separate correctly named function receipt supplies that evidence.
- The 12:37 container fingerprint receipt binds existing container IDs/images/start/restart/configuration hashes without emitting secrets. Its 215 retained containers/36 running match the earlier inventory counts. This is a preservation baseline, not a new proof of every process's purpose.

**Remaining attribution limitation:** Supavisor multiplexing and available metadata do not reliably map individual pooled sessions to their originating containers; the historical 08:15 client may remain unattributable. The earlier bounded inventory already identified multiple legitimate services sharing the login. Do not infer exclusivity, harmlessness or financial activity from a login, idle connection or matching endpoint.

The replacement guard uses current runnable/in-flight financial work, immutable financial preimages, known producer states, local queue visibility and unchanged service/configuration fingerprints. Source shows LedgerService reads its process configuration; SyncCommandRuntime inherits that configuration except its command database URL and process kind. A shared DB login does not propagate an environment setting to another process. This does not exclude an unknown external producer or competing consumer; direct authoritative rejection and exactly-once observations remain mandatory. If another process takes the operation and no required rejection occurs, the test does not pass and no additional operation is created to force it.

## Fixed preimage and execution gates

Only checkout `D:/Masarifi-integration-2026-10-10`, branch `codex/voice-promoted-operating-2026-10-13`, HEAD `e7ad90e8b91c118e6365f57cc6cc542f94873595`. Sole Sol writer/controller. Preserve every inherited change and the original plan's 62 requirements, 69 references and 88 acceptance units. No accepted journey, 241-test rerun, PG17 requalification or temporary consumer is needed.

| Hosted preimage | Count / SHA256 |
| --- | --- |
| Transactions | 81 / `7108e5b22ed803f31416ff9f2abdb211041130d45b52155f799aaa26cf273583` |
| Postings | 87 / `a8cc94f4cc92fe9e4cb21e0b8842e3fe2c221a605cb0d48649d3ed0ce0929f03` |
| Accounts | 14 / `e39e6e31ee848d25c46a971b3554343c6428a7b9e3cb0a3f00849b658353d3be` |
| Balances | 12 / `b95358cc2a86f4f8de4ddb988486f1f2de23c5c18a8176bf39554b0e006f90b8` |
| Ten original applied mutations, including auth column | `7555e972effe05e1be32eeb3fb194ef9ca266ab830ed72c8b76326d0ea5f9cd3` |
| QA20 row / posting set | `886f5029b650586e895079670365283a6a9fe4e7b6ea074ef35cc8ddad575829` / `74c00dfd77843037507ab83610a08ff8f24a1ea174daa1b30f25fbd9d8c4fd87` |

QA20 is version5, NULL-note, 2000 minor units, one posting and five revisions. Exact owner/device/resource identifiers remain in the private receipts. Any pre-start drift aborts this packet; a new user operation or independently changed record is not silently adopted as baseline.

Immediately before starting, require the specifically approved packet/hash and a current quiet Staging window with the human available for ordinary verification. Recheck exclusive control, source/manifest/runtime/Compose/protected-file/journal/schema pins, financial preimages, all producer states and absence of other-owner activity or service/migration control. Recheck phone package `com.masarifi.mobile.dev`, same device/account, normal security, existing inspector queues and no default network (Wi-Fi0/data0/airplane0). The recorded network baseline to restore is Wi-Fi1/data0/airplane0. Preserve Arabic/All Accounts/October, the retained draft and all feature flags. Ask for a private normal unlock only if the actual gate appears; do not read or automate PIN/password/code/token.

## One conditional attempt

1. After approval and fresh gates, use ordinary **offline** UI to change only QA20's note to the exact fixed text and press Save once. Use the existing read-only SQLite inspector to bind the newly queued operation UUID, resource/owner/device, base5 and payload/body digest before transmission. Require exactly this one new pending mutation, no unexpected payload changes and all other queue surfaces unchanged. Never edit the queued body, IDs, auth instant, status, attempts or database. If this guard fails, remain offline, preserve the queue and stop for focused recovery; do not activate policy.
2. While the phone remains offline, refresh all hosted/runtime guards. Stage the exact local override bytes as a new root-owned0600 file `$B/sol-t04-reauth-v8.override.yml`; require SHA256 `dfc1c7712411b13e81370c15a3c2cd1b590fe35ddcd8837b34487e2ef014f500`, regular file/no symlink, no overwrite of inherited files. The file contains only the worker environment setting shown below. Gracefully hold the exact pinned original normal worker once: `sudo docker stop --signal SIGTERM --timeout -1 884a80ebc38277dea607d694d5523c64a5ed8e60ee9d62160e48de847d9e101a`. Record intent/process/start/output. Observe for at most40 seconds without killing it; incomplete or ambiguous stop means reconcile that outstanding action, never retry/force/recreate. Require successful container exit0, no OOM/restart, zero scoped in-flight and hosted unsettled work, and all preimages unchanged.
3. Start only the existing normal worker once with the exact seven-file command below. Record its new full ID/start time. Confirm image/scope/security/network/restart/config equivalence, threshold exactly SAR:2000, healthy normal polling, protected files and every other service unchanged, and no unexpected financial work. Ambiguous/abnormal startup requires reconciliation, no blind retry/fallback. No phone reconnect if these checks fail.
4. Reconnect through ordinary Wi-Fi only after fresh local/hosted guards. Let the ordinary coordinator send the stored operation. Observe it through authoritative read-only rows and existing diagnostics, never injecting a request. Require a **direct RECENT_AUTH_REQUIRED rejection** on the original queued UUID/hosted mutation row, matching body/base/owner/device. Before human verification, capture original nonnull authenticated_at and trustworthy rejection timing proving it was naturally more than600 seconds old. No clock/token/age fabrication. If direct rejection or authentic age evidence is absent, do not claim acceptance or create another operation.
5. Ask the human to complete the actual normal supported SDK dialog privately using its offered password/email/phone factor. Never capture the credential-bearing screen or request a secret in chat. Do not programmatically open a different auth mechanism. If unsupported, failed or cancelled, preserve pending work and report the concrete failure. After ordinary successful verification, require the **same operation UUID, hosted row, body and base** with a strictly newer authentication instant, one applied receipt, exactly one completed ledger idempotency effect and one new revision/version6. Original applied operations must never be replayed. No second Save to replace the challenged operation.
6. Only after that operation settles correctly, restore the original NULL note using one distinct normal UI operation, with its own UUID/base6. Require exactly one further applied receipt/idempotency effect/revision, version7, original NULL note and every monetary/posting/account/owner field unchanged. If normal UI serializes an empty string or changes any unintended field, do not accept it as NULL restoration; stop for focused recovery rather than editing the queue or issuing additional writes.

Poll only bounded, read-only relevant queue/activity/financial metadata at each transition and roughly every15 seconds while awaiting processing; no repeated broad audits. Target one monitored attempt within15 minutes after activation. Another owner's new activity, unexpected queued/in-flight work, scope/config drift, cancellation, ambiguous submission, missing verification, financial mismatch, elapsed window or lost control means stop initiating new actions, preserve all data/queues/evidence and report the exact state. Elapsed time does not approve anything.

## Exact override and worker commands

```yaml
services:
  worker:
    environment:
      MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS: "SAR:2000"
```

Use these existing directories, unchanged:

```sh
D=/opt/masarifi/releases/f97a5d9d41d30267b5730acbfaadc60ba0e4fd12/docker/staging
B=/opt/masarifi/qa-t03/uploads/de15ee3bc8372432266ce5b188794f1b5cef9b8ef5f7c087accacf949c76487d
OLD=/opt/masarifi/qa-t03/uploads/f00163437d5b60a7649ebabfd6d3cc90c2a64ba972e65ae0d3d72ae2a7bf0203/normal-worker.override.yml
```

Pin the six files in this order (also enforced by the bound existing read-only Compose script):

| Input | SHA256 |
| --- | --- |
| `$D/compose.backend.yml` | `41e9cc72535ad3d8f9ed095db7946bfe1a81ea5b6cf26d86e63eb291b5f1ff2b` |
| `$D/release-version.yml` | `cdf81d2b841b1307702b1c45d6c5f22880ea7e9d734c557d824e71868c0ca0b3` |
| `$D/voice-runtime.yml` | `ba530c50469b6fdf9025326b4b249e316abd25810928c3a77d12b2ab25aff32b` |
| `$D/voice-analysis.yml` | `ca85db116b4ec1b85fb8062b0aed41034eb043248dbb49fb6103bd9ed3c91dce` |
| `$OLD` | `f6572c27d2fd9d8daa73a80a93f2dcb79565e0c423f81cf17dc0bc3b6145715c` |
| `$B/terra-worker-held.override.yml` | `9fa8d0d3fa5bb5aa3f43e165808a9067d541e569aaae15fc6f600d05143e72a7` |

Activation, once after its gates:

```sh
sudo env MASARIFI_BACKEND_REPOSITORY=ghcr.io/masarifiratibi-spec/masarifi-backend \
  MASARIFI_BACKEND_DIGEST=a81aed5572a4e5035bfd8cc3116a725ee8ccf32f60aa3c592ce0a87227cc81a9 \
  docker compose --project-directory "$D" --project-name masarifi-staging \
  -f "$D/compose.backend.yml" -f "$D/release-version.yml" \
  -f "$D/voice-runtime.yml" -f "$D/voice-analysis.yml" \
  -f "$OLD" -f "$B/terra-worker-held.override.yml" \
  -f "$B/sol-t04-reauth-v8.override.yml" up -d --no-deps worker
```

## Restoration and unsettled-state recovery

Once both allowed operations settle, verify zero received/processing and zero direct/wrapped recent-auth-rejected work for **all owners**, local queues clear again except the retained draft, QA20 version7/NULL-note/two added revisions, unchanged original ten operation rows and unchanged financial effects. The transactions full-row hash necessarily changes for the two legitimate revisions; compare all non-QA rows exactly and QA financial/ownership fields excluding only note/version/normal audit metadata, plus the complete unchanged posting/account/balance hashes. Verify two distinct ledger idempotency effects, not two financial postings.

Then require the actual full experiment-worker ID/start/config to match the activation receipt; hold it once with the same non-forcing SIGTERM/infinite timeout and bounded observation rules. Once exit0/no outstanding work is established, restore the original six-file Compose configuration once by repeating the activation command **without** its seventh `-f "$B/sol-t04-reauth-v8.override.yml"` argument. Confirm qualified image/sync-only scope/healthy polling and threshold absent again, protected files and all other services unchanged. Preserve the inert override as evidence. Restore original phone network/UI baseline without clearing drafts/storage/auth/security.

If activation succeeded but **no operation was transmitted**, rollback is permitted only after confirming all hosted relevant queues are clear and the phone is still offline; any locally queued approved QA operation must remain offline and preserved for explicit recovery. If any operation was transmitted or its outcome is uncertain, do not remove the stricter policy while work remains received/processing/recent-auth-rejected or its status is unknown. Do not force-retry, purge, compensate, weaken auth or restore schema. The temporary policy and pending work may remain in place beyond the intended window pending a separately approved focused recovery. If a worker hold/start is ambiguous, reconcile its single outstanding action before any next command.

Full T04 acceptance still requires review of actual supported human reauthentication, original-operation synchronization and authoritative exactly-once effects; a successful policy startup alone is not PASS. T05 stays NOT_STARTED and full T06 stays BLOCKED until their original dependencies and acceptance evidence are satisfied. Hidden/deferred features, Production/billing and the three-hour safe-boundary handoff strategy remain intact.
