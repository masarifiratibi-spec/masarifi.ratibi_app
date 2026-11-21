set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $role$
begin
  perform set_config('masarifi.direct_worker.executor_role', current_setting('role'), true);
  perform set_config('masarifi.direct_worker.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.direct_worker.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.direct_worker.granted_role', 'true', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- The direct tracking and owner-scoped privacy workers poll independently of the scheduler.
create function private.direct_import_work_due() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select from public.import_sessions
    where status in ('received','processing') and next_attempt_at <= statement_timestamp()
      and (lease_until is null or lease_until <= statement_timestamp())
  )
$$;

-- A matching row is only a hint. The handlers recheck leases, holds and cooling-off.
create function private.scoped_privacy_work_pending(p_owner text) returns boolean
language sql stable strict security definer set search_path='' as $$
  select exists (select from private.account_deletion_requests
                 where user_id=p_owner and status in ('verified','processing'))
      or exists (select from private.account_upload_erasure_tombstones where user_id=p_owner)
      or exists (select from private.financial_reset_objects where owner_id=p_owner)
$$;

revoke all on function private.direct_import_work_due(), private.scoped_privacy_work_pending(text)
  from public, anon, authenticated, service_role, masarifi_api;
grant execute on function private.direct_import_work_due(), private.scoped_privacy_work_pending(text)
  to masarifi_worker;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.direct_worker.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.direct_worker.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.direct_worker.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
