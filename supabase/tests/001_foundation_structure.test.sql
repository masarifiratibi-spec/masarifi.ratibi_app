begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select has_schema('private', 'private schema exists');
select has_schema('audit', 'audit schema exists');
select ok(exists(select 1 from pg_extension where extname = 'pgcrypto'), 'pgcrypto exists');
select ok(exists(select 1 from pg_extension where extname = 'pgmq'), 'pgmq exists');
select ok(exists(select 1 from pg_roles where rolname = 'masarifi_migration' and not rolcanlogin), 'migration role is NOLOGIN');
select ok(exists(select 1 from pg_roles where rolname = 'masarifi_api' and not rolcanlogin), 'api role is NOLOGIN');
select ok(exists(select 1 from pg_roles where rolname = 'masarifi_worker' and not rolcanlogin), 'worker role is NOLOGIN');
select ok(not exists(
  select 1
  from pg_auth_members membership
  join pg_roles owned_role on owned_role.oid = membership.roleid
  where owned_role.rolname = 'masarifi_migration'
    and membership.member = membership.grantor
    and membership.set_option
), 'temporary migration-owner SET grant is removed');
select has_table('private', 'outbox_events', 'outbox table exists');
select has_column('private', 'outbox_events', 'id', 'outbox id exists');
select has_column('private', 'outbox_events', 'created_at', 'outbox created_at exists');
select has_column('private', 'outbox_events', 'aggregate_type', 'outbox aggregate_type exists');
select has_column('private', 'outbox_events', 'aggregate_id', 'outbox aggregate_id exists');
select has_column('private', 'outbox_events', 'event_type', 'outbox event_type exists');
select has_column('private', 'outbox_events', 'payload', 'outbox payload exists');
select has_column('private', 'outbox_events', 'available_at', 'outbox available_at exists');
select has_column('private', 'outbox_events', 'published_at', 'outbox published_at exists');
select has_column('private', 'outbox_events', 'attempt_count', 'outbox attempt_count exists');
select has_column('private', 'outbox_events', 'last_error_code', 'outbox last_error_code exists');
select has_column('private', 'outbox_events', 'locked_by', 'outbox locked_by exists');
select has_column('private', 'outbox_events', 'locked_until', 'outbox locked_until exists');
select has_pk('private', 'outbox_events', 'outbox primary key exists');
select has_index('private', 'outbox_events', 'outbox_events_claim_idx', 'claim index exists');
select has_index('private', 'outbox_events', 'outbox_events_claim_order_idx', 'claim order index exists');
select has_index('private', 'outbox_events', 'outbox_events_aggregate_history_idx', 'aggregate index exists');
select has_index('private', 'outbox_events', 'outbox_events_lease_recovery_idx', 'lease index exists');
select ok(to_regclass('pgmq."q_platform-events"') is not null, 'logged platform queue exists');
select ok(exists(select 1 from storage.buckets where id = 'support-attachments' and not public), 'support bucket is private');
select ok(exists(select 1 from storage.buckets where id = 'report-exports' and not public), 'report bucket is private');
select ok(exists(select 1 from storage.buckets where id = 'voice-temp' and not public), 'voice bucket is private');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.outbox_events'::regclass), 'RLS is enabled and forced');
select is((select count(*)::integer from pg_policies where schemaname = 'private' and tablename = 'outbox_events' and roles && array['anon']::name[]), 0, 'anon has no policy');

select * from finish();
rollback;
