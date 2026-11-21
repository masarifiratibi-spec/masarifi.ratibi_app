# Admin recovery: local database verification

This receipt describes the isolated test infrastructure used for the approved Admin recovery. It is not hosted Staging acceptance or evidence of a deployed change.

## Isolation and provenance

- Source baseline: `b45625d3` (implementation plan only; historical migration prefix contains 150 files).
- The existing Windows PostgreSQL service on port 5432 was not changed or used for write tests. It reported recovery mode during a read-only availability check.
- Docker Desktop failed startup because its existing `sailor-ingest.sock` was inaccessible. No factory reset, application update, or deletion of Docker data was performed.
- A new plan-local PostgreSQL 18.6 cluster was initialized under the ignored SDD workspace, listening only on `127.0.0.1:55442`, with local disposable test data.
- PostgreSQL's separate [extension control path](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-EXTENSION-CONTROL-PATH) allowed official SQL-only extensions to be installed inside that workspace, without modifying the system PostgreSQL installation: [PGMQ 1.4.4](https://github.com/pgmq/pgmq/tree/v1.4.4/pgmq-extension), [pgTAP 1.3.3](https://github.com/theory/pgtap/tree/v1.3.3).
- The bootstrap provides the local `anon`, `authenticated`, and `service_role` roles and minimal `storage.buckets` / `storage.objects` schema fixtures needed by the repository's migration grants. It does not implement the Supabase Storage HTTP service or Clerk.
- pgTAP infrastructure schema usage is granted to test roles. Application tables, permission checks, ownership predicates, policies, functions, triggers and candidate migrations are the real repository definitions.
- SQL input is normalized to LF, consistently with the checksum manifest. Existing guarded function-replacement migrations otherwise compare CRLF needle strings against normalized function definitions on a Windows checkout.

## Baseline observations

The historical schema applied successfully. An empty, concurrently CLI-created Task 1 candidate was initially recorded by the scratch migration runner; that scratch-only history entry is corrected before candidate verification. The runner now rejects empty migration files. Fresh/upgrade verification must use the historical 150-migration boundary rather than treating that empty entry as a historical migration.

The baseline selected SQL checks passed:

| Suite | Assertions |
|---|---:|
| 009 Admin RBAC structure | 33 |
| 006 identity devices and push | 50 |
| 007 Clerk webhook inbox privileges | 36 |
| 038 AI RLS and grants | 82 |
| 041 report schema | 16 |
| 042 report RLS | 11 |
| 043 report functions | 21 |
| 054 operations schema | 33 |
| 055 operations security | 25 |
| 060 assistant routing | 13 |
| 060 security definer privileges | 1 |

The broad baseline also exposed existing failures, before recovery implementation: inactive-profile fixture inserts conflict with newer frozen-owner notification-preference triggers; older tracking fixtures lack current JWT admission context; several older sync/planning/content expectations have drifted. Three initial extension-schema errors were test-bootstrap issues and passed after test infrastructure grants were supplied. The immutable baseline logs and receipts remain in the plan's ignored workspace while implementation is active. These failures must not be hidden by weakening current financial, Voice, or authorization behavior.

## Limits

This native PostgreSQL run provides real SQL, trigger, transaction, grant and RLS execution. It does not replace a fresh/upgrade run on the repository's configured Supabase PostgreSQL 17 image, provider-backed attachment delivery, Clerk session verification, or authenticated inspection of the deployed Admin. Those remain separate acceptance gates.

Candidate-specific results are recorded in the final recovery verification report after implementation and review.
