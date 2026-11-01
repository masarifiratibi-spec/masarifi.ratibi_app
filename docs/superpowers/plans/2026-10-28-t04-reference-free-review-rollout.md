# T04 Staging reference-free correlation repair — HELD for specific approval

28 October 2026. GPT-6.1 Sol Extra High (`gpt-6.1-sol`, `xhigh`): implementation and self-review. This packet authorizes nothing until the user explicitly approves its exact hash. T04 remains BLOCKED; T05 has not started. The proposed T05 exception was not approved and is not being used.

## Confirmed cause and intended behavior

One other-owner v3 SMS import is repeatedly claimed and completed as failed, then rescheduled normally. At11:27 UTC it had694 attempts:693 `TRACKING_CAPTURE_DEFERRED` and one historical generic processing failure. The current item is parsed with `correlation_unresolved`, no provider-reference digest/reference scheme, no operation/transaction link and no pending review row. Its immutable evidence cannot satisfy `tracking_content_correspondence`, which requires the item's own verified reference digest. Broad read-only comparison finds an already accepted opposite-channel observation with the same device/account/amount/time neighborhood; that does **not** establish whether they represent the same movement. The financial safety hold is correct. The defect is the absence of an actionable owner-review exit from an automatic retry that cannot acquire the missing immutable proof.

The existing tracking process is healthy and emitting normal passes; its recovery gate is enabled with matching anchors. Database `complete_import_attempt` deliberately returns parsed items to received and schedules up to256 seconds later. This is not an SSH, retry scheduler, recent-auth or current permissions failure. The scoped sync worker does not process this import. Source, database and process evidence are retained in the existing T04 evidence directory.

The fix wraps the existing finalizer and moves only v3 parsed `correlation_unresolved` items **without** a providerReferenceDigest, excluded from the upstream autoItems, into the existing `duplicate_candidate` owner-review flow. It preserves the original payload/source/canonical identity and leaves the financial decision pending. Reference-bearing correlation recovery, ready automatic items, legacy schemas, stale fences and unrelated deferred reasons retain their existing behavior. This rule also applies to future imports meeting those exact conditions; it is not restricted to the one currently observed item.

## Exact artifacts and qualification

- New source: `supabase/migrations/20261028114000_tracking_reference_free_correlation_review.sql`, SHA256 `84e6a9d2355b03f7949516886b7ab0e2a53b8fe2573361b713e6129d52b6eb40`.
- Five schema body statements, combined SHA256 `033456158d55c2252e08a0a07ed116b46700a211b28f3028c6269fa3817d91d1`; new function body SHA256 `f1d81a5904da87b818512c12ae09f8f9e46ad95d647f35e3d802d45bfa5a043a`.
- Guarded held runner: `sol-correlation-rollout-held.cjs`, SHA256 `bece81727d37de43049308ea4d4f435838afd344a3e33f050a0571e2f504b651`. It is staged root-owned mode0600 at `$B/sol-correlation-review-bece81727d37.cjs`, verified but never executed.
- Existing qualified migration tool image: `sha256:f1ea1557383d70cd3e78e361c18412171bb0ae002ea53314eefaddbd20495bf4`. Reuse its accepted build/scan evidence. No new image, service, environment or consumer is required.
- The existing owned PG17 cluster/system7700634956601963652 and existing synthetic database were reused. Selected source SQL regression reproduced the missing review, then passed review/idempotence/payload/identity preservation, reference-bearing/legacy/automatic/unrelated-hold exclusions and stale-fence rejection. Actual source table definitions, review creator and completion function were used; the upstream finalizer was an explicit boundary stub. All fixture schema/data changes rolled back; financial hashes and global memberships were unchanged. This is **not** full tracking integration qualification.
- Eight non-live guarded-runner paths passed: missing approval, missing SET role, lock contention, data drift, DDL failure, registry failure, ambiguous commit and successful orchestration. These do not establish hosted execution. The added regression in the existing tracking nominal integration suite is NOT_RUN against a complete tracking target. API typecheck/lint and migration checksum verification passed.

Private receipts: `sol-tracking-pending-root.json`, `sol-tracking-pending-flags.json`, `sol-tracking-candidate-metadata.json`, `sol-tracking-retry-process-trace.json`, `sol-correlation-sql-regression-result.json`, `sol-correlation-rollout-check-result.json`, `sol-correlation-rollout-pins.json`, `sol-correlation-runtime-preconditions.json`, `sol-correlation-held-artifact-staged.json`, under `.superpowers/sdd/2026-10-25-astra-readiness-remediation/T04/access-restoration-2026-10-27T0735Z/`.

## Guarded execution after approval only

Use the existing Staging project `qcffvfbpzvpwcwxwjyro`, strict pinned SSH, protected migration.env/CA and existing migration tool image. Let `B=/opt/masarifi/qa-t03/uploads/de15ee3bc8372432266ce5b188794f1b5cef9b8ef5f7c087accacf949c76487d`. Before invocation verify the held runner hash, image, single controller, no prior intent/CID/container for this operation, unchanged protected files and normal scoped worker/frozen V7 preimages from11:59:20 UTC. Never print credentials or connection strings.

```sh
sudo cat "$B/sol-correlation-review-bece81727d37.cjs" | sudo docker run --rm -i \
  --name masarifi-t04-correlation-review-bece81727d37 \
  --cidfile "$B/sol-correlation-review-bece81727d37.cid" \
  --read-only --cap-drop ALL --security-opt no-new-privileges:true --init \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m --pids-limit 256 --memory 512m --cpus 1 \
  --stop-timeout 30 --no-healthcheck --restart no --user 65532:65532 \
  --network masarifi-staging_backend --env-file /etc/masarifi/migration.env \
  --mount type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/etc/ssl/certs/masarifi-database-ca.crt,readonly \
  -e MASARIFI_APPROVED_T04_CORRELATION_REVIEW=84e6a9d2355b03f7949516886b7ab0e2a53b8fe2573361b713e6129d52b6eb40 \
  --entrypoint /nodejs/bin/node \
  sha256:f1ea1557383d70cd3e78e361c18412171bb0ae002ea53314eefaddbd20495bf4 -
```

Use pipefail and a new durable intent/output receipt. Invoke once. This is the existing one-shot migration tool, not a queue consumer. It uses verified TLS and the existing postgres executor/SET capability. Timeouts: statement5s, lock1s, idle-in-transaction10s, transaction30s. It acquires the existing migration advisory lock; under the existing migration role it locks import tables and holds SHARE locks on financial/mutation tables, restores postgres for the history lock and checks all pinned preimages.

Inside one transaction require:168 unchanged history rows/hash; exact finalizer OID55818, definition/protection/body pins; unchanged five financial/mutation hashes; exactly the pinned one unleased received import/parsed item and its immutable hashes, no pending review; zero non-applied client mutations; absent target migration/internal wrapper. It executes only the five source schema statements under masarifi_migration, restores postgres and inserts one history record, then verifies source bodies, owner/search_path/ACL, unchanged original history, unchanged financial data/target/memberships. It never calls the finalizer or claims an import itself. Role-membership wrapper statements are replaced by the existing explicit SET/restore boundary, as in the accepted T04 rollout; no global membership changes are made.

Any drift or contention aborts before commit. Do not silently repin or force an operation. The transaction renames the existing function to a migration-owner-only internal function and adds the worker-callable wrapper with the same security-definer owner, empty search_path and worker-only execution boundary. It adds history version20261028114000, taking168 rows to169. No other missing migrations are applied.

## Post-commit observation and recovery

After a confirmed commit, verify the history body/hash and function protections read-only. Let the existing tracking worker reach its **normal scheduled retry**; do not change next_attempt_at, claim/lease/state, gate or worker. Observe through the next scheduled pass (bounded six minutes, no forced replay). Expected result: the same item/session become review, exactly one pending duplicate_candidate review belongs to the same owner, no transaction/operation link is invented, immutable payload/source/identity hashes match, and financial hashes remain unchanged. The owner's review remains unresolved; no accept/reject/merge/settle action is authorized. An unrelated new operation, unexpected ledger effect, no eligible natural retry, or any mismatch stops this slice for read-only reconciliation.

Before commit, failure rolls the transaction back. An uncertain commit is reconciled from authoritative history/function/data evidence without automatic replay. After a confirmed commit, do not automatically reverse review state, delete its history or restore retry. If code reversal is required, prepare a separately approved compensating migration preserving all created review/evidence and pending owner decisions.

This approval covers only this schema/history change and its normal nonfinancial owner-review transition, including the known other-owner item. It does **not** approve the held recent-auth policy, QA note edits, worker replacement/restart, access changes, financial submission/settlement, full T04 acceptance or T05 progression. The normal worker remains `sync-mutations.retry` only. Frozen V7, its budget/journal/deadline, Production, billing, authentication and hidden/deferred features remain untouched. Preserve all inherited work and three-hour handoffs.
