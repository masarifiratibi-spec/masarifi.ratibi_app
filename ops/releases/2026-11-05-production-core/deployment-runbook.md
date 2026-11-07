# Approval package and bounded execution order

Prepared only. No hosted SQL, DNS, TLS, routing activation, service activation or primary update has been executed. Application/customer acceptance and public launch are separate gates.

## Exact inputs

- Mobile source: `2d8b5dfefedecd62ff8c48b01c12f89dfee43867`.
- API/parser/image source: `97e66588b2b516ae8c67e285f8439be591439dd6`. The mobile fix changes no backend/image input; rebuilding the qualified image is unnecessary.
- Image: `masarifi-readiness-production@sha256:a9060b3e761495bf8cf0ccbfa769232a0bb3e83edd2ea84c27e435350b812afc`.
- Database: exact five files and order in `forward-manifest.json`, through `apply-forward.sql`. PostgreSQL17.6, original174 history rows and history digest remain frozen. Actual `postgres` must be NOSUPERUSER. No history repair/stamp, migration runner, `db push` or snapshot replacement.
- Runtime: private0600 API and import-worker-v2 files pinned by `runtime-config-manifest.json`. Existing credentials, Clerk instance and immediate-deletion configuration remain byte-preserved. The new worker admits only `import.parse`; no AI provider or broad operations consumer is enabled.
- Routing: `routing-manifest.json`, final new-host configuration, ACME-only bootstrap, and exact private legacy-site candidate. The existing27 containers and their image/start identities remain preserved.
- Signing: current-source bridge100/min33, final101/min24 and higher-counter recovery102/min24. APK hashes and paths are recorded in the completed signing manifest. Existing signer lineage grants installed-data capability only; no old-key permission/authentication/rollback retake capability.

## Before approved execution

1. Obtain approval for this concrete package and the primary signer transition. Preparation, QA signing and a previous access approval do not authorize activation.
2. Reconcile dispatch/terminal receipts. Refresh the bounded SSH source verification and reopen only the current workstation /32 to the same VPS22 if necessary. Keep root/password network SSH disabled. Remove only that new rule when the session ends.
3. Verify all package hashes, private config permissions/hashes, Docker digest, server17.6, exact executor/memberships/history and all guarded function prerequisites. Recheck every serving container and effective Nginx digest. Stop on drift; never update the frozen assertions to conceal it.
4. Take a uniquely receipted encrypted off-host database/roles backup immediately before the write, using the already-qualified pinned17.6 client, existing CA and `sslmode=verify-full` streaming procedure. Authenticate/decrypt/check its archive metadata using the existing protected recovery key. Reuse the completed restore as proof of the procedure; never claim it covers Storage object bytes or independent provider/key recovery. No plaintext persistent backup or secret in argv/Docker environment.
5. Inspect outstanding imports/leases/receipts read-only. Preserve every original pending operation and Voice001; do not reset claims, reorder original work, manually replay it or run qualification fixtures on hosted data.

## Hosted sequence after approval

1. Stage this exact directory read-only under the owned artifact root `/var/tmp/masarifi-production-artifacts-20261105-97e66588`. Keep original config/routing recovery copies and new dispatch markers with0600/0700 permissions. The own artifact directory is not a deployed service.
2. Apply `apply-forward.sql` once with pinned17.6 `psql -X --set=ON_ERROR_STOP=1 --file=/release/apply-forward.sql`, mounted at `/release` in the previously qualified ephemeral client image `sha256:5a4314708484bec672de2c09653a5c01fb1c84a998564ac231b0325e2238ed5b`. Use existing migration.env only to construct the same stdin-fed tmpfs service/passfile and CA binding as the qualified backup client; application name must identify this release, read-only must be off only for this transaction, and statement/lock timeouts must stay bounded. Do not expose the connection URI/password in shell history, process arguments, Docker metadata or Git. Retain acknowledged SQL exit/terminal receipt before another action. Any guard failure aborts the transaction; diagnose without blind retry.
3. Verify history/memberships and original preservation fingerprints immediately after commit. Reuse qualification fixtures; use only narrowly scoped non-mutating hosted capability checks here. A committed migration must never be undone by restoring a stale database over newer work.
4. From the pinned proposal file, start only the new API: `docker compose --file compose.production.yml up --detach --no-deps core-api`. Verify readiness on loopback3080 and actual authenticated read paths before routing public traffic. Do not replace or restart any of the27 retained containers.
5. Start only `import-worker` from that same Compose file after scoped ownership and receipt/idempotency checks. Verify its admitted job key is exactly `import.parse`; all existing consumers retain their prior scopes. New workers must not dispatch Voice001 or enable an AI provider.
6. DNS authority is Hostinger DNS (`aster.dns-parking.com`, `helios.dns-parking.com`). Add only the absent `api.masarifiratibi.com` A record to `187.77.81.97`; use a short supported TTL. Do not alter apex, Staging, Clerk or unrelated A/AAAA records. Verify authoritative and public resolution.
7. Install only `nginx.production-bootstrap.conf` as the new-host site, create its ACME webroot and run `nginx -t` before reload. Existing sites remain unchanged at this stage. The bootstrap serves only ACME and otherwise503. Use the existing Certbot account/webroot procedure to obtain the exact new-host certificate; no guessed certificate/key path substitution is proof of TLS.
8. Install `nginx.production.conf` after the real certificate exists, and the reviewed complete legacy-site candidate only at its exact manifest path. Run `nginx -t`, reload and verify the entire effective configuration, public TLS/hostname/chain and ordinary APIs. DEV aliases must return404, while ordinary Tracking snapshot and existing account-deletion recovery remain usable. No global site replacement.
9. Verify retained Clerk issuer/JWKS, expected audience/authorization, Google/Firebase identity continuity, source opt-in, privacy/deletion configuration and all required consumers before customer admission. No new identity/key adoption or weakened owner checks.

## Primary Redmi sequence after explicit approval

Target only the operator-bound Redmi serial in the private read-only baseline receipt, package `com.masarifi.mobile`, API35. Set the serial only from that pinned receipt; never accept an unset/empty or arbitrary target. Refresh the read-only baseline immediately before installation: APK hash, UID, firstInstallTime, source/version, saved session, pending rows and owned/foreign retained work. Never clear, uninstall, sign out, reset keys or bypass identity fencing.

Install the qualified bridge100 with normal update semantics (`adb -s "$APPROVED_REDMISERIAL" install -r --no-streaming <qualified-bridge>`), retain the actual command receipt, then verify unchanged UID/firstInstallTime and actual SecureStore/SQLCipher/Clerk/native continuity before installing final101 in the same manner. Stop on failure; no uninstall, downgrade flag or old-key retake. These are customer artifacts with no QA helper. The separate QA application's prior proof remains a limited supporting witness.

Run the actual current customer matrix: saved Google session/Home/Accounts; account/currency/date-sensitive reads and bounded synthetic create/edit/refund/reversal with exact accounting; SMS and notification capture→durable queue→ordinary authenticated HTTP→leased worker→ledger→confirmation; duplicate/retry, offline/restart, permission, pause/disable/re-enable and generation fences. Preserve original user rows/operations. Fresh Google OAuth must use an independent clean target; do not log out the primary. Voice001 remains untouched; only a separately authorized distinct voice test may establish new voice acceptance.

For fresh OAuth, the phone reports support for up to four Android users; no additional user has been created or switched. The proposed independent target is one new, clearly named secondary Android test user, using the already-qualified customer APK through `install-existing` after the primary update is approved. Inventory available slots and verify the Clerk session policy first so a new test session cannot revoke the primary session. Do not use or change an existing secondary user's data. A clean secondary user keeps the primary app's data and session separate and avoids another APK build. Google passwords, verification and any new legal acceptance remain human-only steps. Preserve the new test session/profile and return to the original user after testing; do not delete it or clear either app. If this cannot be done safely, fresh OAuth remains open rather than substituting the primary's saved-session shortcut.

Keep recovery102 available. It contains the same current source and durable record format; it is a compatible higher-counter recovery artifact, not a claim that an older client can read the new journal. Do not install it merely to repeat the separate fixture's already-complete mechanical rollback test. If recovery102 is required and proves the current customer flow, its exact installed bytes become the potential deliverable; never downgrade to101. API24–32 legacy upgrades and physical compatibility beyond this API35 phone remain separately unqualified.

## Failure handling and recovery

- Before SQL commit: transactional rollback; preserve error/terminal receipt and investigate drift.
- After SQL commit: retain additive compatibility/consent tables, current rows and receipts. Do not drop new metadata, reverse financial effects manually or restore the old clone over live data.
- New service/routing failure: stop only the newly introduced API/worker, retain queues/receipts, restore only the frozen previous legacy-site file, and return the new origin to its ACME/503 bootstrap. Validate Nginx before reload. Preserve DNS/TLS material for diagnosis; no existing consumer is stopped. Keep new capture closed until its compatible consumer is verified.
- APK update failure: leave the installed application/data intact. Use its acknowledged package-manager error to decide the next bounded action; no clear/uninstall/sign-out or signer-capability relaxation.
- Interrupted cleanup: the current native purge and database-purge-ready journals remain authoritative. Retry only the pinned approved disposition; never reopen a purging database or prepare a completed native generation.

## Delivery and public launch gates

Only after actual current customer proof: replace the delivery APK/identity, prove installed=delivered=qualified hash/source, update the English handoff and push this same branch to `ratibi`, then verify remote HEAD. Inherited documents and private evidence remain preserved; no blanket staging.

Public privacy/deletion resources and legal operator/notice approval remain open. Existing `docs/legal/1.0-draft` documents are review drafts and must not be silently published as approved notices. Google continuity, distinct voice acceptance, Storage/provider/key recovery limits and every pending physical gate must be recorded honestly. A package approval or internal owner test is not a public production-readiness declaration.
