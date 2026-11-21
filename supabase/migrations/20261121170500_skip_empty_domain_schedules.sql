-- Advance idle import and privacy schedules without allocating run history.
set local lock_timeout='1s';
set local statement_timeout='5s';
do $guard$ begin
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
      where oid=to_regprocedure('private.claim_due_jobs(text,integer,timestamptz,text[])'))
      is distinct from 'ce1204b0a75bca99decf652be5fb680f'
    or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
      where oid=to_regprocedure('private.claim_due_jobs(text,integer,timestamptz)'))
      is distinct from 'c3393d054e94a69a5030c2b7c12798bf' then raise exception 'DOMAIN_SCHEDULER_BODY_MISMATCH'; end if;
  perform set_config('masarifi.scoped_claim.executor_role', current_setting('role'), true);
  perform set_config('masarifi.scoped_claim.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.scoped_claim.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.scoped_claim.granted_role', 'true', true);
  end if;
end
$guard$;

set local role masarifi_migration;

create or replace function private.claim_due_jobs(p_worker_id text,p_limit integer,p_now timestamptz)
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare job private.scheduled_jobs%rowtype; retry record; stale record; run_id uuid; attempt_id uuid; remaining integer:=p_limit;
  due_jobs refcursor;
begin
  if p_worker_id is null or char_length(p_worker_id) not between 1 and 128 or p_worker_id ~ '[[:cntrl:]]'
    or p_limit not between 1 and 100 or p_now is null then
    raise exception using errcode='22023',message='OPERATIONS_CLAIM_INPUT_INVALID';
  end if;

  for stale in
    select a.id attempt_id,a.run_id,a.attempt_no,j.max_attempts,j.retry_safe
    from private.job_attempts a join private.job_runs r on r.id=a.run_id
    join private.scheduled_jobs j on j.id=r.scheduled_job_id
    where a.status='running' and a.heartbeat_at+make_interval(secs=>j.timeout_seconds)<=p_now
    order by a.heartbeat_at,a.id for update of a skip locked limit p_limit
  loop
    update private.job_attempts set status='failed',completed_at=p_now,safe_error_code='WORKER_LEASE_EXPIRED',
      next_attempt_at=case when stale.retry_safe and stale.attempt_no<stale.max_attempts
        then p_now+make_interval(secs=>least(300,(2^greatest(0,stale.attempt_no-1))::integer*5)) end
      where id=stale.attempt_id;
    update private.job_runs set status=case when stale.retry_safe and stale.attempt_no<stale.max_attempts then 'retrying' else 'dead_lettered' end,
      completed_at=case when stale.retry_safe and stale.attempt_no<stale.max_attempts then null else p_now end
      where id=stale.run_id;
  end loop;

  for retry in
    select a.id,a.run_id,a.attempt_no,j.job_key,j.owner_spec,j.job_type,j.timeout_seconds,j.configuration
    from private.job_attempts a join private.job_runs r on r.id=a.run_id
    join private.scheduled_jobs j on j.id=r.scheduled_job_id
    where a.status='failed' and a.next_attempt_at<=p_now and r.status='retrying'
      and not exists(select 1 from private.job_attempts newer where newer.run_id=a.run_id and newer.attempt_no>a.attempt_no)
    order by a.next_attempt_at,a.id for update of a skip locked limit remaining
  loop
    insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at)
      values(retry.run_id,retry.attempt_no+1,p_worker_id,'running',p_now,p_now) returning id into attempt_id;
    update private.job_runs set status='running',started_at=coalesce(started_at,p_now) where id=retry.run_id;
    remaining:=remaining-1;
    return next jsonb_build_object('jobKey',retry.job_key,'jobType',retry.job_type,'ownerSpec',retry.owner_spec,'runId',retry.run_id,'attemptId',attempt_id,
      'timeoutSeconds',retry.timeout_seconds,'configuration',retry.configuration);
    exit when remaining=0;
  end loop;

  if remaining=0 then return; end if;
  open due_jobs for select * from private.scheduled_jobs
    where enabled and schedule is not null and next_run_at<=p_now
      and not exists(select 1 from private.job_runs r where r.scheduled_job_id=scheduled_jobs.id and r.status in ('queued','running','retrying'))
    order by next_run_at,job_key for update skip locked limit (remaining + 4);
  -- Fetch one locked row at a time. The four skippable schedules consume no claim slots when idle.
  loop
    fetch due_jobs into job;
    exit when not found;
    update private.scheduled_jobs set next_run_at=greatest(next_run_at,p_now)+make_interval(secs=>(schedule->>'everySeconds')::integer)
      where id=job.id;
    if job.job_key='sync-mutations.retry' and not exists (
      select from public.client_mutations m
      where m.status in ('received','processing')
        and (m.status='received' or m.locked_until<=p_now)
    ) then
      -- Even a deferred received mutation may need dependency rejection.
      continue;
    end if;
    if job.job_key='privacy.financial-reset-cleanup' and not exists (
      select from private.financial_reset_objects
    ) then
      continue;
    end if;
    -- Outstanding uploads can outlive the deletion request that created them.
    -- Leave cooling-off, retention holds, claim fences and retries to the handler.
    if job.job_key='privacy.account-delete' and not exists (
      select from private.account_deletion_requests where status in ('verified','processing')
    ) and not exists (select from private.account_upload_erasure_tombstones) then
      continue;
    end if;
    -- The import handler owns due times, lease recovery and attempt limits.
    -- Only skip a scheduled run when its indexed set of pending sessions is empty.
    if job.job_key='import.parse' and not exists (
      select from public.import_sessions where status in ('received','processing')
    ) then
      continue;
    end if;
    insert into private.job_runs(scheduled_job_id,job_key,job_type,owner_spec,status,queued_at,started_at,correlation_id)
      values(job.id,job.job_key,job.job_type,job.owner_spec,'running',p_now,p_now,extensions.gen_random_uuid()::text)
      returning id into run_id;
    insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at)
      values(run_id,1,p_worker_id,'running',p_now,p_now) returning id into attempt_id;
    return next jsonb_build_object('jobKey',job.job_key,'jobType',job.job_type,'ownerSpec',job.owner_spec,'runId',run_id,'attemptId',attempt_id,
      'timeoutSeconds',job.timeout_seconds,'configuration',job.configuration);
    remaining:=remaining-1;
    exit when remaining=0;
  end loop;
  close due_jobs;
end $$;

create or replace function private.claim_due_jobs(p_worker_id text,p_limit integer,p_now timestamptz,p_job_keys text[])
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare job private.scheduled_jobs%rowtype; retry record; stale record; run_id uuid; attempt_id uuid; remaining integer:=p_limit;
  due_jobs refcursor;
  known_keys integer; may_have_work boolean;
begin
  if p_worker_id is null or char_length(p_worker_id) not between 1 and 128 or p_worker_id ~ '[[:cntrl:]]'
    or p_limit is null or p_limit not between 1 and 100 or p_now is null then
    raise exception using errcode='22023',message='OPERATIONS_CLAIM_INPUT_INVALID';
  end if;
  if p_job_keys is null or cardinality(p_job_keys) not between 1 and 53
    or array_position(p_job_keys,null) is not null
    then raise exception using errcode='22023',message='OPERATIONS_JOB_SCOPE_INVALID';
  end if;
  select count(*),bool_or((j.enabled and j.next_run_at<=p_now) or exists (
    select from private.job_runs r where r.scheduled_job_id=j.id
      and r.status in ('queued','running','retrying')))
    into known_keys,may_have_work
    from private.scheduled_jobs j where j.job_key=any(p_job_keys);
  if known_keys<>cardinality(p_job_keys) then
    raise exception using errcode='22023',message='OPERATIONS_JOB_SCOPE_INVALID';
  end if;
  for stale in
    select a.id attempt_id,a.run_id,a.attempt_no,j.max_attempts,j.retry_safe
    from private.job_attempts a join private.job_runs r on r.id=a.run_id
    join private.scheduled_jobs j on j.id=r.scheduled_job_id
    where a.status='running' and a.heartbeat_at+make_interval(secs=>j.timeout_seconds)<=p_now
      and j.job_key=any(p_job_keys)
    order by a.heartbeat_at,a.id for update of a skip locked limit p_limit
  loop
    update private.job_attempts set status='failed',completed_at=p_now,safe_error_code='WORKER_LEASE_EXPIRED',
      next_attempt_at=case when stale.retry_safe and stale.attempt_no<stale.max_attempts
        then p_now+make_interval(secs=>least(300,(2^greatest(0,stale.attempt_no-1))::integer*5)) end
      where id=stale.attempt_id;
    update private.job_runs set status=case when stale.retry_safe and stale.attempt_no<stale.max_attempts then 'retrying' else 'dead_lettered' end,
      completed_at=case when stale.retry_safe and stale.attempt_no<stale.max_attempts then null else p_now end
      where id=stale.run_id;
  end loop;

  -- Preserve lease cleanup even for historical attempts whose run state drifted.
  if may_have_work is not true then return; end if;
  for retry in
    select a.id,a.run_id,a.attempt_no,j.job_key,j.owner_spec,j.job_type,j.timeout_seconds,j.configuration
    from private.job_attempts a join private.job_runs r on r.id=a.run_id
    join private.scheduled_jobs j on j.id=r.scheduled_job_id
    where a.status='failed' and a.next_attempt_at<=p_now and r.status='retrying'
      and j.job_key=any(p_job_keys)
      and not exists(select 1 from private.job_attempts newer where newer.run_id=a.run_id and newer.attempt_no>a.attempt_no)
    order by a.next_attempt_at,a.id for update of a skip locked limit remaining
  loop
    insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at)
      values(retry.run_id,retry.attempt_no+1,p_worker_id,'running',p_now,p_now) returning id into attempt_id;
    update private.job_runs set status='running',started_at=coalesce(started_at,p_now) where id=retry.run_id;
    remaining:=remaining-1;
    return next jsonb_build_object('jobKey',retry.job_key,'jobType',retry.job_type,'ownerSpec',retry.owner_spec,'runId',retry.run_id,'attemptId',attempt_id,
      'timeoutSeconds',retry.timeout_seconds,'configuration',retry.configuration);
    exit when remaining=0;
  end loop;

  if remaining=0 then return; end if;
  open due_jobs for select * from private.scheduled_jobs
    where enabled and schedule is not null and next_run_at<=p_now
      and job_key=any(p_job_keys)
      and not exists(select 1 from private.job_runs r where r.scheduled_job_id=scheduled_jobs.id and r.status in ('queued','running','retrying'))
    order by next_run_at,job_key for update skip locked limit (remaining + 4);
  -- Fetch one locked row at a time. The four skippable schedules consume no claim slots when idle.
  loop
    fetch due_jobs into job;
    exit when not found;
    update private.scheduled_jobs set next_run_at=greatest(next_run_at,p_now)+make_interval(secs=>(schedule->>'everySeconds')::integer)
      where id=job.id;
    if job.job_key='sync-mutations.retry' and not exists (
      select from public.client_mutations m
      where m.status in ('received','processing')
        and (m.status='received' or m.locked_until<=p_now)
    ) then
      -- Even a deferred received mutation may need dependency rejection.
      continue;
    end if;
    if job.job_key='privacy.financial-reset-cleanup' and not exists (
      select from private.financial_reset_objects
    ) then
      continue;
    end if;
    -- Outstanding uploads can outlive the deletion request that created them.
    -- Leave cooling-off, retention holds, claim fences and retries to the handler.
    if job.job_key='privacy.account-delete' and not exists (
      select from private.account_deletion_requests where status in ('verified','processing')
    ) and not exists (select from private.account_upload_erasure_tombstones) then
      continue;
    end if;
    -- The import handler owns due times, lease recovery and attempt limits.
    -- Only skip a scheduled run when its indexed set of pending sessions is empty.
    if job.job_key='import.parse' and not exists (
      select from public.import_sessions where status in ('received','processing')
    ) then
      continue;
    end if;
    insert into private.job_runs(scheduled_job_id,job_key,job_type,owner_spec,status,queued_at,started_at,correlation_id)
      values(job.id,job.job_key,job.job_type,job.owner_spec,'running',p_now,p_now,extensions.gen_random_uuid()::text)
      returning id into run_id;
    insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at)
      values(run_id,1,p_worker_id,'running',p_now,p_now) returning id into attempt_id;
    return next jsonb_build_object('jobKey',job.job_key,'jobType',job.job_type,'ownerSpec',job.owner_spec,'runId',run_id,'attemptId',attempt_id,
      'timeoutSeconds',job.timeout_seconds,'configuration',job.configuration);
    remaining:=remaining-1;
    exit when remaining=0;
  end loop;
  close due_jobs;
end $$;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.scoped_claim.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.scoped_claim.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.scoped_claim.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
