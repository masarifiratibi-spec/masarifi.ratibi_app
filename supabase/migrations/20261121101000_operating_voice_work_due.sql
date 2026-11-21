set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $role$
begin
  perform set_config('masarifi.voice_due.executor_role', current_setting('role'), true);
  perform set_config('masarifi.voice_due.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.voice_due.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.voice_due.granted_role', 'true', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- Complement voice_sessions_claim_idx for accepted batches waiting to finalize.
create index voice_batches_finalizing_due_idx on private.voice_batches(next_attempt_at,session_id)
  where status='finalizing';

-- An idle hint only. The worker still validates its source heartbeat, then uses
-- the existing epoch, owner and lease-fenced claim and execution capabilities.
create function private.operating_voice_work_due(p_epoch uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.voice_epoch_open(p_epoch) and (exists (
    select 1 from public.voice_sessions s
    join private.staging_voice_members m on m.session_id=s.id and m.user_id=s.user_id
    join private.voice_batch_context c on c.session_id=s.id and not c.analysis_only
    join public.profiles p on p.id=s.user_id and p.status='active'
    where m.epoch_id=p_epoch and s.contract_version=3 and s.content_hash=m.content_hash
      and s.capture_at=m.capture_at and s.locale=m.locale
      and s.status in ('uploaded','processing') and s.finalized_at is not null
      and s.next_attempt_at<=statement_timestamp() and (s.lease_until is null or s.lease_until<=statement_timestamp())
      and s.cancelled_at is null and s.deleted_at is null and s.expires_at>statement_timestamp()
      and not exists (select 1 from private.voice_batches b where b.session_id=s.id)
  ) or exists (
    select 1 from private.voice_batches b
    join private.staging_voice_members m on m.session_id=b.session_id and m.user_id=b.user_id
    join public.voice_sessions s on s.id=b.session_id
    join private.voice_batch_context c on c.session_id=b.session_id and not c.analysis_only
    join public.profiles p on p.id=b.user_id and p.status='active'
    where m.epoch_id=p_epoch and b.status='finalizing' and b.next_attempt_at<=statement_timestamp()
      and (b.lease_until is null or b.lease_until<=statement_timestamp())
      and s.cancelled_at is null and s.deleted_at is null and s.expires_at>statement_timestamp()
  ))
$$;
revoke all on function private.operating_voice_work_due(uuid) from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.operating_voice_work_due(uuid) to masarifi_worker;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.voice_due.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.voice_due.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.voice_due.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
