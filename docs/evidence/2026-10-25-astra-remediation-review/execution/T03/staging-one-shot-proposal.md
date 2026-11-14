# T03 exact-operation runner — local preparation, no hosted approval

Astra High authorizes reversible local tooling and isolated tests as a prerequisite under the approved backend-remediation scope. Preparation is not hosted acceptance or operational approval. The mobile candidate's quality approval is separately recorded in astra-review-round-3.json. T03 still has no authoritative application, original-note restoration, exactly-one result or second cold edit.

## Established boundary

Masarifi Staging project `qcffvfbpzvpwcwxwjyro`, API `https://api.staging.masarifiratibi.com`, approved QA operation `10de16e6-a966-41b4-a583-1716314b285b`. Root read-only observations show received/attempt0/no dependency or lease and the general worker Created, not Running. The only pending mutation in the observed snapshot was this operation. A nonatomic count is not an execution restriction. Normal general-worker activation could run deletion, retention and email jobs; it is excluded.

The verified `masarifi_worker` role has no direct SELECT/UPDATE/DELETE/TRUNCATE on client_mutations. PoolService already narrows worker connections before repository use. Never reset that role, borrow migration/admin credentials, add grants, disable RLS, or use Management SQL for financial mutation.

## Selected design: Repeatable Read only

Use a SEPARATE, explicitly authorized EXISTING bootstrap connection for global-read verification and the guarded claim transaction, followed by the ordinary worker pool/shared executor for processing. The existing authenticated Hostinger browser terminal now provides transport access; the earlier SSH timeout is historical. Actual reviewed runner invocation, installed artifact/source compatibility and a legitimately authorized separate bootstrap connection path/capabilities remain unverified. Missing prerequisites abort. Catalog metadata showing that postgres has BYPASSRLS/global SELECT/worker membership is not permission to use its credentials; API/worker logins cannot supply the global guard. Existing worker.env/migration.env file presence/mode metadata proves neither connection contents nor authority, and no contents were read.

The single selected strategy is PostgreSQL17 REPEATABLE READ. Its fixed snapshot excludes later inserts from the transaction's candidate set; concurrent target changes must abort or raise serialization failure, with no automatic retry. See [PostgreSQL17 isolation](https://www.postgresql.org/docs/17/transaction-iso.html). Do not silently fall back to table locking or broader privileges.

Pin an execution manifest to exact staging target, operation/mutation-row/owner/device/resource bindings, operation/domain/schema/base version/dependencies/canonical payload hash, approved QA note-only change and unchanged financial/date fields. Include reviewed runner/source hashes, deployed image identity, exact compatible claim/complete/retry function definitions and relevant trigger/transitive behavior. Missing/placeholder/mismatched fields abort; general logs exclude credentials/customer IDs/payloads.

On the separate connection:

1. Begin bounded REPEATABLE READ transaction.
2. Verify target/connection identity, legitimate existing privileges and unfiltered global visibility. Include explicit RLS-filtered-read failure; catalog SELECT permission alone is insufficient. Do not alter policies/roles or SET row_security off.
3. Verify exact function/provenance bindings, including the generic claim function's blocked-dependency update preamble and deterministic rewrite-rule definitions/enabled state as well as triggers/transitive behavior.
4. Require that every visible received/processing mutation is the single approved manifest-bound row, attempt0, no dependency/lease and eligible retry time.
5. SET LOCAL ROLE masarifi_worker on the SAME connection/transaction; invoke the existing claim function with limit1.
6. Require exactly the matching claim and expected lease transition; rollback on mismatch/role/contention/serialization/timeout. No automatic retry.
7. Commit before handler execution; process this claim ONCE using ordinary worker semantics, then close resources.

No bootstrapWorker/start/runOnce, scheduler, maintenance, unrelated jobs, manufactured owner principal, refreshed stored authentication, new operation ID, manual applied state, queue deletion or lease reset. Prefer a narrow shared claimed-mutation executor extraction with preserved existing call site over copied logic/private-method access. Validate dependency initialization starts no background jobs before any mutable claim.

## Local fixture and validation

Astra explicitly authorizes a new isolated native PostgreSQL17 fixture under `.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17/`. Use official distribution provenance, available vendor checks/signatures, extracted runtime only, no OS service/admin install/PATH change, new synthetic-only data, loopback-only free dedicated port and bounded hidden process. Pin PG_VERSION17, server_version_num17 range, exact data_directory/port/listen address and fresh cluster system identifier. Never inherit application DATABASE_URL. Stop only the recorded fixture process. Existing PostgreSQL18 and hosted targets stay untouched.

Real PostgreSQL17 tests cover post-guard unrelated insertion remaining untouched, visible unrelated/blocked-dependent rows aborting, concurrent target changes, denied privileges/role assumption, RLS filtering, manifest/function mismatch, exact success, duplicate/replay, stale auth, lease loss, crash after ledger commit, no background initialization and only supplied claim dispatch. Distinguish external-handler fixtures from actual product-ledger proof. PostgreSQL18/mocks do not qualify17 concurrency. Failed fixture/runtime setup leaves precise NOTRUN gates.

Static root-retrieved function definitions and hashes may seed local compatibility fixtures; record adaptations. They authorize no hosted DDL.

The approved real local PostgreSQL17 iteration passed 23 tests, zero skips, with independent start/test/strict-stop exits0/0/0. The original synthetic cluster/system ID was retained and the final owned process/listener were verified gone. This includes rule-only and rule-enabled-state drift rejection before claim/effect; the marker table/grant predated each baseline. The archived older catalog fingerprint missed those changes. Initial real testing failed early (7 harness passes/16 failures); its address-representation and JSON timestamp shutdown failures and reviewed recovery remain separate history, not qualification. Synthetic external effects are not product-ledger or hosted compatibility proof. See runner-prep/checks.json and the exact executed source-manifest reference there.

## Read-only diagnosis and proposed hosted scope

Independent Astra approved the diagnosis/strategy only. The immediate cause is the absence of an active general OperationsWorker consumer. The general container is Created/not Running, created2026-10-06T09:45:35.240081125Z, with zero start/finish timestamps, exit0/errornone and no logs. Those observations alone do not prove its historical reason. The historical [customer staging recovery note](../../../2026-10-11-customer-staging-recovery/README.md) records intentional worker isolation because an older audit found over497000 unpublished outbox events; a current read-only aggregate was canceled at5s/57014 without retry, so the current count is unverified.

The general worker image `sha256:a81aed5572a4e5035bfd8cc3116a725ee8ccf32f60aa3c592ce0a87227cc81a9` differs from the healthy API image `sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383`. Neither image is assumed to contain the locally extracted executor. The live API cohort is `/opt/masarifi/staging-cohort-ac7bc92-client-recovery-20261010`, with compose.backend.yml, release-version.yml, voice-runtime.yml, voice-analysis.yml, candidate.yml and api-ai-admission.yml. This metadata is not an installation or activation approval. Complete read-only facts and authorization boundaries are in runner-prep/hosted-read-only-diagnosis.json.

The later proposed hosted action has two separately reviewable scopes: install a compatible pinned runner/runtime artifact without starting any consumer, then explicitly approve execution for only operation `10de16e6-a966-41b4-a583-1716314b285b` after all actual target/bootstrap/image/schema/provenance/manifest/configuration gates are met. Installation approval does not approve execution. No auth refresh, changed operation ID, lease edits, manual financial completion, scheduler, outbox drain, general worker activation or automatic runner retry is included. Both scopes still need independent Astra review and explicit user approval; no hosted write has occurred.

Normal processing may reject, conflict or reschedule stale authentication/validation; a claim may commit before a crash. `processed-once` means the supplied claim was processed once, not that it was applied. A later operator must reconcile the terminal receipt, exactly one ledger effect, unchanged amount/account/category/currency/date/other fields and the app's result. An uncertain commit or response requires reconciliation, not replay with a new identity.

This one-shot is original QA recovery only. It does not restore continuous sync or automatically restore the original note. Ordinary cleanup can itself queue while no approved consumer runs. A later cold edit without an approved consumer can prove local preservation/enqueue only; further separately approved one-shots would show operator-assisted application, not automatic sync acceptance. General worker activation remains forbidden under this proposal. Automatic second-edit/server acceptance and full T03 stay BLOCKED; T04 does not advance.

## Final execution boundary

Complete and independently review the artifact/tests/manifest before requesting operational approval. Actual staging claim/execution requires verified existing command access, legitimate bootstrap global-read capability, deployed compatibility/provenance and explicit user approval. Preparation authorizes none of those hosted actions.

After a real terminal receipt is reconciled through the app, restore the original empty QA note via approved ordinary UI/API, verify exactly-one accepted result and unchanged financial fields, then complete cold-edit acceptance. Empty server text is not cleanup while the queued note remains executable. T02 exceptions remain exceptions. No production, billing, merge, branch or worktree changes are included.
