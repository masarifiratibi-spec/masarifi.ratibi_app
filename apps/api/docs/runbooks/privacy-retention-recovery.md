# Privacy Export, Deletion, and Retention Recovery

Owner: Privacy operations with Security on-call; legal policy changes require the designated human policy approver.

For export failure, keep the object private, expire the request, delete any partial object by its opaque reference, verify handler-manifest completeness, then retry through the guarded action. Never log a signed URL, object key, package body, email, or provider response. Close only after HEAD size validation, manifest/checksum completion, owner/recent-auth signing, and expiry deletion.

For deletion failure, pause the worker, recheck cancellation and every active hold immediately before resuming, reconcile every registered handler outcome, and retry idempotently. Provider session revocation completes before local session references are cleared. Never use generic dynamic SQL or cascade-delete audit/security evidence.

For retention, process only enabled, human-approved policy rows through the registered owner handler in bounded batches. Overlapping holds are rejected under an advisory lock. On a hold race, retain the object and retry from a fresh candidate read. Roll policy changes back with a new versioned update, not history deletion.

Close after all handler outcomes are accounted for as deleted, anonymized, archived, or retained under an identified active hold; profile/session state is reconciled; export objects are expired; backlog/age alerts recover; and no sensitive value appears in operational evidence.

## Financial reset cleanup

Apply the financial reset migration, then release the matching API and worker builds before enabling the mobile action. Update the consumers for tracking imports, sync mutations, planning, reports, engagement notifications, assistant and voice. These builds carry the generation from a durable job through later database writes. Keep the tracking `raw.purge` consumer enabled so expired upload reservations are removed after interrupted imports. The governed worker must consume `privacy.financial-reset-cleanup`. For the existing dedicated privacy worker, set `MASARIFI_OPERATIONS_JOB_KEYS=privacy.account-delete,privacy.financial-reset-cleanup`. An independently scoped worker may consume just `privacy.financial-reset-cleanup`.

If a reset receipt stays in `processing`, check job scheduling, worker health, database role grants and private Storage availability. The worker retries outstanding manifest entries and accepts confirmed missing objects. Poll the original operation ID until its status becomes `completed`. Storage keys and customer financial data should stay out of operational logs.
