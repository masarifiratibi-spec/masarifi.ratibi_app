# Temporary support access — blocked release review packet

7 November 2026. **No hosted execution is authorized or performed by this packet.** The previous dashboard/logo approval belongs to a different release. `manifest.json` deliberately records missing API and routing pins and cannot be treated as an execution approval request.

## Qualified inputs

The implemented live client uses the canonical support-access API, real versions/cursors/scopes and immutable operation receipts. The API metadata is additive; existing clients retain their contract. Consent, separate review, recent authentication, owner isolation, assignee checks, expiry and revocation remain server enforced. [Behavior and evidence](../../../docs/evidence/2026-11-07-access-ci-integration/report.md) separates fixture, local SQL and hosted receipts.

The Linux Admin runtime was built by [run 42380284312](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42380284312), artifact `13576619088`, from `73b790d04d705d349107da1e34cc65a06b195107`. Its complete Admin tree and both reports sources match `0ffccbd6918b3e6c4878a96e431ef94a376935f0`. The compressed runtime is 263,726,798 bytes, SHA256 `8fe6f57f5bcee817639f0ae3a3102c21aa8b2f25bdadbab587986cf74ab32e88`, build `mT4teHZyRNxcKzft789xW`. The independently downloaded artifact ZIP has SHA256 `408046198198bf166613f20fa31ac437e416fe44fbf989f37caa2aeb7b6c3858`. See `admin-pins.json` and `admin-verification.json`.

Streaming admission verified 576 tracked source files, 52,750 members, 44 internal symlinks, build/toolchain/lock/manifest pins and 73 static assets. No extraction, execution, rebuild or generated source exception was used. Generated runtime/dependency bytes are bound by the archive hash; this is not a reproducible-build or full secret-content-scan claim. The complete artifact manifest binds the existing public API/auth settings; runtime secrets are absent. Do not copy server environment files, authenticated screenshots, tokens, signed download URLs or raw customer receipts into this directory.

The exact `0ffccbd6` [Foundation run](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42382098669) passed API, Mobile, Admin, all five browser projects and secrets; the upgraded SQL integration suite passed 151 suites/1,066 tests. [Staging Client](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42382098635) and [Private Journal](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/42382098637), including Linux SQLCipher/JNI and disposable Android, passed. Foundation nevertheless failed fresh static database lint and an outdated English compiled-label assertion. Image/container/Trivy/archive gates were correctly skipped. **There is no qualified API runtime archive for that run.** Fresh repair qualification must replace this state before execution review.

## Actual target and protected services

| Input | Observed service | Proposed boundary |
| --- | --- | --- |
| `https://staging.masarifiratibi.com` | Admin source `97ad2551`, loopback 3041 | New verified Admin on loopback 3043 |
| `https://api.staging.masarifiratibi.com` default | Existing API on loopback 3001, public version `a488f4ad` | Keep default and every specialized route |
| Support-access API families | Existing canonical requests | New qualified API-only sidecar on loopback 3042, four locations below |
| Primary API134 and legacy API3000 | Separate running containers/sites | Preserve identity, environment, process start and routing |
| Existing workers/providers/mobile sessions | Existing running services | Preserve; no migration process or worker is started by API main |

The read-only human-console snapshot is `host-baseline.json`. Its Config/HostConfig fingerprints use exact `docker inspect --format '{{json .Config}} {{json .HostConfig}}'` output including the separating space and trailing LF; they are not canonical JSON hashes. Check the exact algorithm when comparing. The Nginx master/configuration-prefix identity, current loaded state, all protected container identities/configurations and free ports must be readmitted immediately before any separately approved operation. The console expired after inspection; a stale session/snapshot is not an admission.

## Narrow proposed routing

Only the API TLS server for `api.staging.masarifiratibi.com` gains:

| Modifier | URI | Upstream |
| --- | --- | --- |
| `=` | `/api/v1/admin/support-access/requests` | `http://127.0.0.1:3042` |
| `^~` | `/api/v1/admin/support-access/requests/` | `http://127.0.0.1:3042` |
| `=` | `/api/v1/me/support-access/requests` | `http://127.0.0.1:3042` |
| `^~` | `/api/v1/me/support-access/requests/` | `http://127.0.0.1:3042` |

The two Admin locations preserve the effective 3033 recovery-prefix body; the two customer locations preserve the default 3001 body. Each retains its own request/auth/forwarded headers and has no URI component in `proxy_pass`. It disables proxy caching, suppresses upstream Cache-Control and sends `Cache-Control: no-store` on all statuses. Proxy timeouts retain stricter existing limits and are capped at 60 seconds; they are not total request deadlines. The slash boundary does not consume similarly named siblings. The Admin TLS server changes only its one default proxy destination from 3041 to 3043. Existing HTTP redirects, TLS includes, API default3001, 25 specialized location heads and the primary site remain unchanged.

`nginx_delta.py` computes only this delta. `read_nginx_context.py` verifies the pinned available/enabled pairs and main/HTTP/server include/header context, then computes the candidate in memory. It performs no subprocess, network, file write, installation or reload. It emits input/context hashes and a sanitized structural diff; raw configuration/header/environment/customer data is not emitted. The independently reviewed canonical LF transfer pins are in `manifest.json.readOnlyToolsSha256`: delta `558be644ee6010c588a19e3de43398233f86cee911c2a7d96ebac43cf06ed7da`, context driver `5301d6bbebfa709b6518f953c24edcd2af06ab80fcd86fe42997e13f0e0f23f5`. Recompute these from the exact reviewed commit before transfer. Run an isolated `python3 -I -B` interpreter; decode the two first-party source byte sequences in memory and verify BOTH hashes against those independent literal pins before evaluating either. Register `types.ModuleType("nginx_delta")` in `sys.modules`, execute its verified bytes, then execute the verified context driver with `__name__ = "__main__"`. Do not import transferred helpers from the host working directory, write bytecode, or execute an unverified download. The receipt describes disk state, not loaded workers. The actual context and candidate routing hashes are still missing.

## Database scope and rollback

The actual API database was positively matched to Supabase project `qcffvfbpzvpwcwxwjyro` (Masarifi Staging). A read-only, five-second-bounded catalog query found 177 ledger rows, latest version `20261107140000`, and the old pending-only consent CHECK. This ledger is not the full 187-file canonical source sequence: do not run a blanket migration replay, synthesize missing history, or repair historical entries as part of this release.

The only proposed schema change is canonical `20261107140100_support_access_denial_without_consent.sql`, SHA256 `4a826dda49786f3469f96b6c29dddebc8c652fcae0482e995869193d8fe5051c`. It permits denial without pretending that consent was given; approval continues to require real consent. Apply only after separate approval, under bounded lock/statement timeouts and the existing migration advisory lock, with exact preimage/target checks and canonical version/name/statements recording in the same transaction. A tool that generates an unrelated migration version is insufficient for this canonical ledger. `migration_packet.py` renders that exact transaction without making a connection. Fresh read-only cluster/version-list fingerprints bind the SQL to the admitted database. A separate PostgreSQL 18 disposable fixture proved rollback, one canonical ledger entry, negative replay and consent checks. The hosted database remains at its old preimage; the API must not launch the general migration runner.

Keep the forward-compatible CHECK after any application rollback. Reinstalling the old constraint could reject genuine new denials. Do not rewrite customer rows, fabricate consent timestamps, revoke real sessions, change roles/permissions or replay notifications to achieve rollback. Historical SQL/checksum entries remain unchanged.

## Required activation sequence after complete review

1. Replace every blocked/null pin with an immutable successful exact-source CI artifact, image ID, routing/context receipt and reviewed executor/watchdog hashes. Verify the source ancestry/tree relationship and scan all new history. Ask the human to approve that complete specific packet only then.
2. Following that approval, readmit protected services, database target/constraint/ledger, Nginx links/bytes/context, existing API/auth bindings, resource headroom and free loopback ports. Drift requires reconciliation before a mutation.
3. Transfer only the pinned public packet/runtime archives through the authorized operator channel. Verify bytes again on the host. Preserve existing secrets in memory by cloning the admitted Config/HostConfig; never put them in shell arguments, logs, source files or temporary environment files.
4. Load the scanned API image and stage the verified Admin archive in a new isolated release root. Create exactly the two named candidates with API main/production settings, loopback-only mappings, retained CA/network boundaries, read-only root/mounts, separate writable Admin cache, OOM protection and admitted memory/CPU limits. Only the image/release identity and documented mount/port changes are allowed. Compare created configurations before starting them; preserve all old services.
5. Check candidate API private liveness/readiness and exact release identity, Admin BUILD_ID/static hash/auth challenge, database contract and unchanged authorization behavior. Failure stops adoption. Do not expose private readiness publicly or declare dependency health from a 404 blocked by the existing proxy.
6. Install an independently running, acknowledged rollback watchdog bound to both candidates, original/candidate routing pins, protected service snapshots and a short explicit acceptance deadline. Keep the exact original bytes and metadata in a private rollback directory. The watchdog must survive loss of the operator console and reload the original routing if acceptance is absent or health fails.
7. Atomically replace only the admitted staging file with the exact pinned candidate, preserve enabled links and primary configuration, validate Nginx and reload. If validation/reload or probes fail, guarded restoration must reload the pinned original bytes and prove the old endpoints work. No old container is removed.
8. Verify public TLS/static build, exact paths/queries and no-store on both allowed and denied requests. Test authenticated list/detail, actual fresh-consent and independent-review flow, exact masked/status workspace, external revocation/expiry/end, version conflict, idempotent uncertain-response recovery, owner/assignee denial, reload/back and session continuity. Check representative existing default/specialized/primary routes and protected process identities. Keep authenticated evidence private.
9. Disarm the watchdog only with a matching explicit acceptance receipt and positive acknowledgment from its actual PID. Record served source/build/image separately from repository source. Retain old services/rollback inputs; close only temporary access created for the operation.

The guarded executor is implemented for review and refuses the blocked manifest. An actual qualified API artifact, exact complete host receipt and hosted multi-actor acceptance are still outstanding. Do not replay previous Admin-only helpers with their old roots, ports, service IDs or approval flags.

## Local read-only checks

### Operator inputs and implementation under review

`api_archive.py` checks the GitHub ZIP digest/bytes independently of the inner CI manifest. It streams the Docker-save file without loading the image, matches the revision, user, Linux platform, API entrypoint/command, config ID, raw layer blobs and uncompressed filesystem digests. A foreign tag, worker command or differing layer is rejected even if an inner manifest was rehashed.

`host_readmission.py` reads the actual master, original protected container set, recovery loopback 3033 and both APIs' project bindings. It computes the two proposed Docker payload hashes in memory once the API image is pinned. The host returns only identities, resource numbers and hashes; raw Config/HostConfig/Env and database URLs remain on the host. The Docker Config/HostConfig baseline pins and the canonical JSON payload pins use distinct algorithms.

After a **separately approved exact manifest**, use these steps and no historical helper:

1. Readmit the unchanged host after transferring the exact reviewed Python sources, manifest and baseline into a root-owned private packet directory. Place the original immutable ZIP files (not newly assembled ZIPs) in `/opt/masarifi/support-access-inputs-20261107/{admin,api}.zip`, with access limited to root. Recheck the manifest SHA256 out of band, then verify every executable against that manifest before invocation.
2. Render the SQL with `migration_packet.py` from the pinned canonical migration bytes. Use the admitted Supabase project only. After commit, run `read_migration_result.sql` as a separate read-only transaction. On uncertain completion, run that readback before any retry; an existing canonical row and new CHECK require no second migration. Record its exact singleton row as `result` in a private `database-attestation.json` alongside the ZIPs, with `project`, `packetSha256`, and observation time `observedUnix`. Do not record credentials. No DDL or ledger changes are performed by the sidecar staging command.
3. `host_release.py stage --approved-packet-sha256 <approved digest>` verifies fresh fingerprints, resource headroom, exact original services, loopback ports, DB postimage and both payload pins before staging. It verifies both ZIPs and the image, extracts Admin into a new release root and validates both created containers before starting either. A failed or uncertain create/start is recorded under the private release root; do not repeat staging blindly. Inspect exact candidate IDs before any reconciliation.
4. `host_release.py switch --approved-packet-sha256 <same digest>` starts the independent systemd watchdog and waits for its armed PID receipt. Under the shared cutover lock it installs only the pinned candidate bytes, preserving permissions and extended metadata. The 15-minute acceptance window starts at staging. A lost console does not disarm the watchdog; a restarted watchdog cannot inherit its predecessor's approval. Failure restores the original, validates and reloads even when disk bytes are already original, proves the old public endpoints and stops only the matching candidates. Keep the separate primary, recovery/default API, previous Admin and workers intact.
5. Check actual fresh consent, distinct reviewer, versioned workspace/end/revoke and unchanged routes within the window. Record the private authenticated acceptance receipt; only then invoke `host_release.py accept --approved-packet-sha256 <same digest> --private-acceptance-sha256 <receipt digest>`. Public probes, a fixture and an unacknowledged marker are not acceptance. Retain the old containers, original routing and forward-compatible CHECK. If the window expires, reconcile restoration; do not reuse the spent ticket.

These instructions document future execution scope; current manifests cannot enter stage/switch/accept. Offline tests exercise simulated container payloads and watchdog failure/expiry/restart/ack behavior; they do not claim an actual serviced cutover or successful hosted authentication.

```powershell
python -B -m unittest discover -s ops/releases/2026-11-07-temporary-support-access -p 'test_*.py' -v
```

The archive, routing and release controls pass 42 local tests. The archive tests include rehashed adversarial members and source drift, duplicate/escaping/chained links, missing files, metadata mismatches, output/input collisions and stale-success replacement. Routing fixtures include all 25 observed specialized heads, TLS/redirect selection, scoped proxy semantics, inherited headers, input/link drift and private-output checks. New negative controls reject inherited HTTP/server upstream hide/pass policies and a renamed or duplicate primary enabled link. The archive verifier is not a host extractor; a separately reviewed extraction/staging boundary remains required. These checks do not establish a deployed routing hash, hosted authentication or successful deployment.
