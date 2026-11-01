-- Bound impact on a small Staging compute. Any failure rolls back this migration.
-- This index only changes access paths; it does not claim/publish/replay outbox
-- work or change owner, epoch, notification, financial or retention predicates.
set local lock_timeout = '1s';
-- The live heap is ~171 MB; at Nano's documented 5 MB/s baseline its scan
-- alone can take ~34 seconds. Bound this administrative DDL separately from
-- the application's existing, unchanged query deadlines.
set local statement_timeout = '45s';

do $guard$
begin
  if to_regclass('private.outbox_events_voice_confirmation_idx') is not null then
    raise exception 'VOICE_CONFIRMATION_INDEX_ALREADY_EXISTS_REQUIRES_RECONCILIATION';
  end if;
  if to_regprocedure('private.voice_confirmation_sources(uuid,integer)') is null then
    raise exception 'VOICE_CONFIRMATION_SOURCE_FUNCTION_MISSING';
  end if;
  perform set_config('masarifi.index.executor_role', current_setting('role'), true);
  -- PostgreSQL can grant a role creator ADMIN with SET/INHERIT disabled.
  -- Change only this executor's own grant, then restore its exact options.
  -- Grants from other grantors are never updated or revoked.
  perform set_config('masarifi.index.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    join pg_roles role_name on role_name.oid = membership.roleid
    join pg_roles member_name on member_name.oid = membership.member
    join pg_roles grantor_name on grantor_name.oid = membership.grantor
    where role_name.rolname = 'masarifi_migration'
      and member_name.rolname = current_user and grantor_name.rolname = current_user
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.index.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.index.granted_role', 'true', true);
  end if;
end
$guard$;

set local role masarifi_migration;

-- The existing aggregate-history index begins with aggregate_type. Voice
-- confirmation joins constrain aggregate_id and event_type without that prefix.
create index outbox_events_voice_confirmation_idx
  on private.outbox_events (aggregate_id, created_at, id)
  where event_type = 'transaction.created';

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.index.executor_role'), true);
end
$restore_executor$;
do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.index.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.index.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
