-- Run only on a disposable operations database with an empty mutation queue.
begin;
do $test$
declare
  sync_key constant text := 'sync-mutations.retry';
  base timestamptz := clock_timestamp() - interval '1 minute';
  owner_id text := 'sync-schedule-' || gen_random_uuid()::text;
  device uuid := gen_random_uuid();
  mutation uuid := gen_random_uuid();
  dependent_op uuid := gen_random_uuid();
  claim jsonb;
  retried jsonb;
  before_runs bigint;
  before_attempts bigint;
begin
  if exists (select from public.client_mutations where status in ('received','processing')) then
    raise exception 'Test requires an empty disposable queue';
  end if;
  select count(*) into before_runs from private.job_runs where job_key=sync_key;
  select count(*) into before_attempts from private.job_attempts a join private.job_runs r
    on r.id=a.run_id where r.job_key=sync_key;

  update private.scheduled_jobs set enabled=false where enabled and job_key<>sync_key;
  update private.scheduled_jobs set enabled=true,next_run_at=base where job_key=sync_key;
  if exists(select from private.claim_due_jobs('test',1,base,array[sync_key])) then
    raise exception 'Scoped idle tick allocated a run';
  end if;
  if (select next_run_at from private.scheduled_jobs where job_key=sync_key)
      is distinct from base+interval '10 seconds' then raise exception 'Sync cadence changed'; end if;
  base:=base+interval '10 seconds';
  if exists(select from private.claim_due_jobs('test',1,base)) then
    raise exception 'Unscoped idle tick allocated a run';
  end if;
  if (select count(*) from private.job_runs where job_key=sync_key)<>before_runs
    or (select count(*) from private.job_attempts a join private.job_runs r on r.id=a.run_id
        where r.job_key=sync_key)<>before_attempts then raise exception 'Idle history changed'; end if;

  -- Both rows are due, with sync first. A batch of one must still return the other job.
  insert into private.scheduled_jobs(job_key,owner_spec,job_type,timeout_seconds,max_attempts,
    retry_safe,schedule,next_run_at)
    values('test.other-work',2,'test',10,3,true,'{"kind":"interval","timezone":"UTC","everySeconds":600}',
           base+interval '11 seconds');
  base:=base+interval '11 seconds';
  select c into strict claim from private.claim_due_jobs('test',1,base,array[sync_key,'test.other-work']) c;
  if claim->>'jobKey'<>'test.other-work' then raise exception 'Idle sync displaced other work'; end if;
  perform private.complete_job_attempt((claim->>'attemptId')::uuid,'test','succeeded',null,'{}',base);

  insert into public.profiles(id,status) values(owner_id,'active');
  insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version)
    values(device,owner_id,'h1:'||repeat('a',64),'sync-schedule','ios','1');
  insert into public.client_mutations(user_id,device_id,operation_id,domain,resource_type,schema_version,
    operation,payload_hash,payload)
    values(owner_id,device,mutation,'accounts','account',1,'create','sha256:'||repeat('a',64),'{}');
  if exists(select from private.claim_due_jobs('test',1,base+interval '9 seconds',array[sync_key])) then
    raise exception 'Sync claimed before its next scheduled tick';
  end if;
  base:=base+interval '10 seconds';
  select c into strict claim from private.claim_due_jobs('test',1,base,array[sync_key]) c;
  if (select operation_id from private.claim_client_mutations('test-sync',1,60))
     is distinct from mutation then raise exception 'New mutation missed first due tick'; end if;
  perform private.complete_job_attempt((claim->>'attemptId')::uuid,'test','succeeded',null,
    '{"outcome":"succeeded","processed":1}',base);

  update public.client_mutations set locked_until=base+interval '15 seconds' where operation_id=mutation;
  if exists(select from private.claim_due_jobs('test',1,base+interval '10 seconds',array[sync_key])) then
    raise exception 'Unexpired lease caused a run';
  end if;
  base:=base+interval '20 seconds';
  select c into strict claim from private.claim_due_jobs('test',1,base) c;
  if (select attempt_count from private.claim_client_mutations('test-recovery',1,60)
      where operation_id=mutation) is distinct from 2 then raise exception 'Expired lease missed tick'; end if;
  perform private.complete_job_attempt((claim->>'attemptId')::uuid,'test','succeeded',null,
    '{"outcome":"succeeded","processed":1}',base);

  -- A dependency failure can require work even with a future retry deadline and no executable claims.
  update public.client_mutations set status='rejected',error='{"code":"SYNC_DEPENDENCY_REJECTED"}',
    processed_at=base,locked_by=null,locked_until=null,lease_token=null where operation_id=mutation;
  insert into public.client_mutations(user_id,device_id,operation_id,domain,resource_type,schema_version,
    operation,payload_hash,payload,depends_on,next_attempt_at)
    values(owner_id,device,dependent_op,'accounts','account',1,'create','sha256:'||repeat('b',64),
           '{}',array[mutation],clock_timestamp()+interval '1 hour');
  base:=base+interval '10 seconds';
  select c into strict claim from private.claim_due_jobs('test',1,base,array[sync_key]) c;
  if exists(select from private.claim_client_mutations('test-sync',1,60)) then
    raise exception 'Blocked dependency returned as executable';
  end if;
  if not exists(select from public.client_mutations where operation_id=dependent_op and
    status='rejected' and error->>'code'='SYNC_DEPENDENCY_REJECTED') then raise exception 'Missed dependency rejection'; end if;

  perform private.complete_job_attempt((claim->>'attemptId')::uuid,'test','failed','JOB_FAILED','{}',base);
  update private.scheduled_jobs set enabled=false where job_key=sync_key;
  select c into strict retried from private.claim_due_jobs('test',1,base+interval '5 seconds',array[sync_key]) c;
  if claim->>'runId'<>retried->>'runId' or claim->>'attemptId'=retried->>'attemptId' then
    raise exception 'Active run retry was skipped on empty queue';
  end if;
end $test$;
rollback;
