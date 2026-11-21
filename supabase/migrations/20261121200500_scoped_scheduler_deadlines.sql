set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $role$
begin
  perform set_config('masarifi.scheduler_deadline.executor_role', current_setting('role'), true);
  perform set_config('masarifi.scheduler_deadline.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.scheduler_deadline.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.scheduler_deadline.granted_role', 'true', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- Reuse the existing claim fencing, then calculate the next deadline from post-claim state.
create function private.claim_scoped_jobs_with_deadline(p_worker text,p_limit integer,p_keys text[])
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare claims jsonb; deadline timestamptz; delay_ms numeric;
begin
  select coalesce(jsonb_agg(c),'[]') into claims
    from private.claim_due_jobs(p_worker,p_limit,clock_timestamp(),p_keys) c;
  with jobs as materialized (
    select id,enabled,next_run_at,timeout_seconds from private.scheduled_jobs where job_key=any(p_keys)
  ), active as materialized (
    select r.id,r.status,r.retry_of_run_id,r.queued_at,r.scheduled_job_id
    from jobs j join private.job_runs r on r.scheduled_job_id=j.id
    where r.status in ('queued','running','retrying')
  ), deadlines(t) as (
    select j.next_run_at from jobs j where j.enabled and not exists
      (select from active r where r.scheduled_job_id=j.id)
    union all select queued_at from active where status='queued' and retry_of_run_id is not null
    union all select a.next_attempt_at from active r cross join lateral (
      select status,next_attempt_at from private.job_attempts where run_id=r.id
      order by attempt_no desc limit 1
    ) a where r.status='retrying' and a.status='failed'
    union all select a.heartbeat_at+make_interval(secs=>j.timeout_seconds)
      from private.job_attempts a join private.job_runs r on r.id=a.run_id
      join jobs j on j.id=r.scheduled_job_id where a.status='running'
  )
  select min(t) into deadline from deadlines;
  delay_ms := ceil(extract(epoch from deadline-clock_timestamp())*1000);
  -- An overdue row can be locked by another claimant. Retry at the original cadence.
  return jsonb_build_object('claims',claims,'delayMs',case
    when delay_ms <= 0 then 1000 else least(coalesce(delay_ms,300000),300000) end);
end
$fn$;

-- Hints are delivered only on commit. The worker always reclaims through PostgreSQL.
create function private.notify_scheduler_wakeup() returns trigger
language plpgsql set search_path='' as $fn$
begin
  perform pg_catalog.pg_notify('masarifi_operations_wakeup',new.job_key);
  return null;
end
$fn$;

create trigger scheduler_registration_wakeup after insert on private.scheduled_jobs
  for each row execute function private.notify_scheduler_wakeup();
create trigger scheduler_earlier_wakeup after update on private.scheduled_jobs
  for each row when ((new.enabled and not old.enabled) or
    (new.enabled and new.next_run_at is not null and
      (old.next_run_at is null or new.next_run_at < old.next_run_at)) or
    new.timeout_seconds < old.timeout_seconds)
  execute function private.notify_scheduler_wakeup();
create trigger scheduler_queued_wakeup after insert on private.job_runs
  for each row when (new.status='queued') execute function private.notify_scheduler_wakeup();
create trigger scheduler_run_wakeup after update of status on private.job_runs
  for each row when (new.status is distinct from old.status and
    (new.status='retrying' or old.status in ('queued','running','retrying')))
  execute function private.notify_scheduler_wakeup();

revoke all on function private.claim_scoped_jobs_with_deadline(text,integer,text[]),
  private.notify_scheduler_wakeup() from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.claim_scoped_jobs_with_deadline(text,integer,text[]) to masarifi_worker;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.scheduler_deadline.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.scheduler_deadline.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.scheduler_deadline.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
