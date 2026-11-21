-- Reuse the authorized base snapshot when computing its configuration revision.
set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $guard$
begin
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
      where oid=to_regprocedure('private.tracking_configuration_revision(text)'))
      is distinct from '78293608cbbdf3f4d780a1a4daea451c'
    or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
      where oid=to_regprocedure('private.get_tracking_rule_snapshot_before_nominal(text)'))
      is distinct from 'f71520c461e4cfe6fde28719c3deba76' then
    raise exception 'TRACKING_SNAPSHOT_DEFINITION_MISMATCH';
  end if;
  perform set_config('masarifi.tracking_snapshot.executor_role', current_setting('role'), true);
  perform set_config('masarifi.tracking_snapshot.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.tracking_snapshot.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.tracking_snapshot.granted_role', 'true', true);
  end if;
end
$guard$;

set local role masarifi_migration;

create function private.tracking_revision_from_snapshot(p_user_id text, p_snapshot jsonb)
returns text language sql stable security invoker set search_path='' as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'configuration', p_snapshot,
    'preferences', (
      select jsonb_build_object('version', p.version, 'enabled', p.enabled, 'reviewRequired', p.review_required)
      from public.tracking_preferences p where p.user_id = p_user_id
    ),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'status', a.status, 'currency', a.currency_code,
        'tracking', a.automatic_tracking_enabled, 'suffix', a.last_four
      ) order by a.id)
      from public.accounts a where a.user_id = p_user_id
    ), '[]'::jsonb),
    'cohorts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'device', c.device_id, 'release', c.release_id, 'engine', c.engine_version,
        'enabled', c.enabled, 'expiresAt', c.expires_at
      ) order by c.device_id)
      from private.tracking_automatic_cohorts c where c.user_id = p_user_id
    ), '[]'::jsonb)
  )::text, 'UTF8'), 'sha256'), 'hex');
$$;
revoke all on function private.tracking_revision_from_snapshot(text,jsonb) from public, masarifi_api, masarifi_worker;

create or replace function private.tracking_configuration_revision(p_user_id text)
returns text language sql stable security definer set search_path='' as $$
  select private.tracking_revision_from_snapshot(p_user_id, private.get_tracking_rule_snapshot_base(p_user_id));
$$;

create or replace function private.get_tracking_rule_snapshot_before_nominal(p_user_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  with base as materialized (
    select private.get_tracking_rule_snapshot_base(p_user_id) as snapshot
  )
  select base.snapshot || jsonb_build_object(
    'configurationRevision', private.tracking_revision_from_snapshot(p_user_id, base.snapshot)
  ) || case when exists (
    select 1 from private.tracking_automatic_cohorts cohort
    join public.tracking_rule_channels c on c.release_id = cohort.release_id
    join public.tracking_rule_releases r on r.id = c.release_id
    join public.tracking_preferences p on p.user_id = cohort.user_id
    where cohort.user_id = p_user_id and not cohort.installation_managed
      and cohort.enabled and cohort.expires_at > clock_timestamp()
      and p.enabled and not p.review_required
      and r.status = 'published' and cohort.engine_version = r.engine_version
      and c.environment = 'default' and c.market = 'global' and c.channel = 'all'
  ) then jsonb_build_object('rolloutMode','automatic') else '{}'::jsonb end
  from base;
$$;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.tracking_snapshot.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.tracking_snapshot.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.tracking_snapshot.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
