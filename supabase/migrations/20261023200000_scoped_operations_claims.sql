set local role masarifi_migration;

-- Keep the original three-argument contract and ACL unchanged. Future claim
-- algorithm fixes must update both overloads; scope every path before writes.
create function private.claim_due_jobs(p_worker_id text,p_limit integer,p_now timestamptz,p_job_keys text[])
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare job private.scheduled_jobs%rowtype; retry record; stale record; run_id uuid; attempt_id uuid; remaining integer:=p_limit;
begin
  if p_worker_id is null or char_length(p_worker_id) not between 1 and 128 or p_worker_id ~ '[[:cntrl:]]'
    or p_limit is null or p_limit not between 1 and 100 or p_now is null then
    raise exception using errcode='22023',message='OPERATIONS_CLAIM_INPUT_INVALID';
  end if;
  if p_job_keys is null or cardinality(p_job_keys) not between 1 and 53
    or array_position(p_job_keys,null) is not null
    or cardinality(p_job_keys)<>(select count(distinct key) from unnest(p_job_keys) key)
    or exists(select 1 from unnest(p_job_keys) key
      where not exists(select 1 from private.scheduled_jobs j where j.job_key=key)) then
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
  for job in select * from private.scheduled_jobs
    where enabled and schedule is not null and next_run_at<=p_now
      and job_key=any(p_job_keys)
      and not exists(select 1 from private.job_runs r where r.scheduled_job_id=scheduled_jobs.id and r.status in ('queued','running','retrying'))
    order by next_run_at,job_key for update skip locked limit remaining
  loop
    insert into private.job_runs(scheduled_job_id,job_key,job_type,owner_spec,status,queued_at,started_at,correlation_id)
      values(job.id,job.job_key,job.job_type,job.owner_spec,'running',p_now,p_now,extensions.gen_random_uuid()::text)
      returning id into run_id;
    insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at)
      values(run_id,1,p_worker_id,'running',p_now,p_now) returning id into attempt_id;
    update private.scheduled_jobs set next_run_at=greatest(next_run_at,p_now)+make_interval(secs=>(schedule->>'everySeconds')::integer)
      where id=job.id;
    return next jsonb_build_object('jobKey',job.job_key,'jobType',job.job_type,'ownerSpec',job.owner_spec,'runId',run_id,'attemptId',attempt_id,
      'timeoutSeconds',job.timeout_seconds,'configuration',job.configuration);
  end loop;
end $$;
alter function private.claim_due_jobs(text,integer,timestamptz,text[]) owner to masarifi_migration;
revoke all on function private.claim_due_jobs(text,integer,timestamptz,text[]) from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.claim_due_jobs(text,integer,timestamptz,text[]) to masarifi_worker;

reset role;
