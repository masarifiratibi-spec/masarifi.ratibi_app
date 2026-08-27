# Migration And Recovery

Release Engineering owns migration execution; Database Operations owns backup,
restore, and reconciliation. Migrations run once before traffic through the
dedicated migration command with checksum/history validation and advisory lock.
API and worker startup never apply DDL.

## Failed Migration

1. Keep the previous signed image serving traffic. Do not route traffic to a
   release whose migration or schema compatibility check failed.
2. Preserve the failed job exit code, release SHA, migration filename/checksum,
   safe database error code, and duration. Do not log SQL values or credentials.
3. Compare repository checksums with `supabase_migrations.schema_migrations`.
   Never edit an applied migration or repair history from the Dashboard.
4. Create a new immutable forward corrective migration. Review locks, statement
   timeout, grants, RLS, indexes, and rollback compatibility; rerun reset,
   pgTAP, contention, smoke, and backup/restore tests in disposable state.

## Image Rollback

Rollback changes traffic to the previous signed N-1 image only when that image
declares compatibility with the current schema range. Database rollback is a
forward corrective migration, never destructive down-migration automation. Run
the compatibility probe before traffic and keep workers stopped if queue/table
contracts are incompatible.

## Backup And Restore Rehearsal

Use a disposable Supabase project. Capture the owned schemas, table data,
functions, grants/RLS, storage bucket records, queue presence, migration history,
and checksums. Restore into empty disposable state, then reconcile:

- schemas: `private`, `audit`;
- table: `private.outbox_events`, columns, constraints, indexes, policies;
- three owned functions with owners, signatures, fixed search paths, grants;
- queue `platform-events` and three private bucket records;
- total/unpublished/published/leased/terminal outbox row counts and sampled IDs;
- negative grants for PUBLIC, anon, authenticated, and API roles.

RPO target is the managed database backup/PITR policy selected for production;
RTO target and measured restore duration must be approved before launch. SPEC
BE-013 owns durable DR governance, but this foundation rehearsal blocks release
until the selected targets are recorded and met.

## Prohibited Actions And Closure

Never run production reset, teardown, truncate, drop, history rewrite, manual
Dashboard DDL, force unlock, or direct outbox deletion. Close only after the
forward fix and previous-image path are tested, all object/grant/bucket/queue and
row counts reconcile, checksums pass, readiness is stable, and Database
Operations plus Release Engineering sign the retained evidence.
