# Isolated hosted-helper compatibility continuation

**Production and canonical backend/worker cutover remain NOT READY.** The retained historical PostgreSQL17.6 clone now has an exact match to the original bounded live prerequisite capture immediately before adding three missing helpers. The helpers passed isolated synthetic behavior checks. No hosted schema/history, live application rows, Storage or running application service was changed.

## Reconciled checkpoint and owner ACL

Continuation started at documentation commit `0329e36781b85983608e1b01e9e1aca857108b13`, equal to the configured `ratibi` upstream. Its application trees equal qualified `2236b1bb83c737ebe9695b518f5f3724f404a7e2`. Existing private evidence and one-shot markers were retained.

The conservative owner-ACL draft remained unchanged. A separate draft pins the complete reviewed GRANT-capable trigger set and exact trigger/function identity, owner, body/definition, language, security, configuration, ACL and enabled state. Independent review found and corrected a SQL NULL-postcondition edge: `IS TRUE` now rejects a NULL ACL before COMMIT. No trigger was disabled or broadly exempted.

One acknowledged clone-only owner self-GRANT materialized the existing equivalent owner ACL. All-role/eight-privilege/grant-option checks and unrelated catalog/role fingerprints stayed equal. Full user-relation/TOAST/index/sequence file SHA-256 remained `e9d81a2d892805daa7a55ab3d49617df594d83d707b3c6324416b1d0fc7a2b7a`. The original frozen metadata comparison passed without relaxing its ACL representation. The clone was cleanly stopped afterward. This is bounded historical prerequisite parity, not full current-live restore parity.

## Exact additive artifact and synthetic witnesses

Supabase CLI2.116.0 created a private clone-only artifact, SHA-256 `8544f0d66e294ccaea96ef53739895ed2e594c6c1891804a5ea9a4db2db56e6a`. It adds exact canonical SQL cores for:

- `private.set_tracking_worker_context(text,uuid,uuid)`.
- `private.list_due_account_upload_erasure_owners(integer)`.
- `private.reminder_baseline(text)`.

The artifact rejects changed frozen prerequisites or existing signatures, uses the intended migration owner and fixed empty search path, and grants only owner/worker execution. It retains grantor-specific temporary membership restoration. It does not replay rename migrations, replace existing finalizer/reminder consumers, change RLS/policies, or add migration-history records. Its absence guard is for the reviewed partial hosted state; it is not an unconditional migration to append to the canonical fresh-install chain, where these signatures already exist.

The independently reviewed harness demonstrated:

| Witness | Result |
| --- | --- |
| Original three signatures absent | PASS before any helper addition |
| Injected failure after helper DDL | Complete transaction rollback; original bounded metadata/catalogs/data equal |
| Tracking lease/owner admission | Valid session/item derive owner from server rows; nine invalid-kind/missing/wrong/expired/frozen-owner cases reject; prior claims retained on failure and restored by savepoint rollback |
| Worker/API/owner isolation | Actual nonsuperuser/NOBYPASSRLS worker execution; worker direct table access denied, API helper call denied, owner RLS excludes the other synthetic owner; PUBLIC/API/anon/authenticated/service-role execute denied |
| Upload-owner selection | NULL/0/17 limits reject; deterministic/distinct bounded results; future/active-lease/active-profile/request-status/request-owner mismatches excluded; expired lease admitted; processing/completed/failed request fixtures included |
| Reminder parser | 45 direct cases across UTC/Riyadh/New York: ISO/PostgreSQL offsets, microseconds, STRICT NULL, malformed/impossible dates/offsets; no batch-aborting cast error |
| Two simultaneous worker transactions | Separate synthetic owner contexts overlap by1.000407s; each retains its own owner; both roll back; fresh connection claims empty |
| Lock and statement deadlines | Real isolated relation lock yields55P03 at lock deadline and57014 at statement deadline; holder rolls back |
| Reapply | Existing-signature/frozen-prerequisite guard rejects before replacement |
| Final unrelated state | Normalized catalog/role fingerprints unchanged except exactly the three intended functions/dependencies; five application-relation logical fingerprints plus migration history equal; no synthetic fixtures persisted; protected originals unchanged; clean stop |

The three helper definitions were committed **only on the owned isolated clone** for the concurrency witnesses. The clone is stopped with these three reviewed additions retained. Helper fixture writes were rolled back; unlike the earlier ACL-only operation, no physical relation-file equality is claimed for transactions that inserted and rolled back synthetic rows. The bounded history witness has171 rows because this is the historical restore; current hosted history has174. Do not call these histories equal.

The first synthetic harness stopped before helper commit because fixture setup tried to insert an import session after suspending its owner. The existing `PROFILE_INACTIVE` fence correctly rejected it. Read-only reconciliation proved three helpers absent, zero synthetic profiles, original catalog fingerprints and clean stop before a separately reviewed fixture-order correction was dispatched. The rejection, consumed marker and original program remain preserved; the production fence was never bypassed.

An additional independently reviewed transaction also passed the deletion-pending selector branch and two real non-superuser operator cases. `SET LOCAL SESSION AUTHORIZATION` made both current/session user a temporary NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE operator. Its separate administrator grant allowed role administration but initially denied SET. The same exact additive artifact temporarily obtained SET and restored the complete grantor-specific membership fingerprint, both with no original self-grant and with an existing self-grant whose ADMIN/INHERIT/SET options were all false. Savepoints and the outer rollback restored the three installed helper definitions and removed every temporary role/grant/fixture. Final installed metadata, normalized unrelated catalog/membership and bounded data/history fingerprints stayed equal; clean stop was verified. The artifact's temporary-grant branch is therefore exercised, rather than inferred from the superuser coordinator or worker execution.

## Remaining live gates

The hosted helpers remain absent and ordered history still fails at index124. A new bounded Supabase-plugin catalog read confirms that the actual `before_correlation_review` inner exists and calls `before_date_review`; this is one additional chain link, not full finalization qualification. The absent canonical `before_owner_context` name is still not proof that the current top-level runtime necessarily fails.

The existing full fixture067 is not qualified by the helper-only slice, and the original reminder consumers remain unnormalized. Retain all required legacy callers/services until the remaining capability/history/finalizer/reminder decisions, complete recovery, exact artifact acceptance, rollback and observation gates pass. No canonical API/worker switch or production activation occurred.

Private execution receipts and SQL remain local. Aggregate evidence is maintained separately from raw catalog definitions, synthetic execution logs and account/device evidence.
