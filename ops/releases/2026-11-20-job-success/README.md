# Routine job-success notifications

Migration `20261120012200_reduce_routine_job_success_events` changes the emission branch of `private.complete_job_attempt`. The function first writes the existing run and attempt records, including status, completion time, and result summary. The notification exceptions are documented in the operations [job contract](../../../apps/api/specs/013-performance-caching-observability-operations/contracts/jobs-events.md).

The authoritative VPS applied this single migration at 2026-11-19 22:26:49 UTC under the project migration lock. The transaction checked the pre-existing function, role, and ledger, preserved the function ACL, and recorded the migration SQL in the same commit. The migration file SHA-256 is `15c622eac83a7437b85d3d3bcf36d7940ecb701e072937813353f6834cd20f72`.

Use `verify.sql` inside a rolled-back transaction on a disposable or local test database with the migrated operations schema. It creates synthetic job runs and attempts to exercise 15 branches. Live verification uses aggregate counts of completed job runs, their terminal attempts, and matching outbox records during the same interval.

The pre-change function definition was saved on the VPS at `/opt/masarifi/selfhost/releases/2026-11-20-job-success/previous-completion.sql`. To reverse the policy, issue a forward migration restoring that definition after checking the installed function still has LF-normalized body MD5 `d0780827e1e46c2694e14f21a12adb68`. The restored body should match `8a5db79cc7d5f7703c2c76ad23dce5ca`. Reverting the policy affects subsequent completions and requires no event replay.
