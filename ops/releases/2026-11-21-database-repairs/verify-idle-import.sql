-- Run in a disposable database with no pending imports or mutations.
begin;
do $test$
declare
  base timestamptz := clock_timestamp() - interval '2 minutes';
  owner_id text := 'import-poll-' || gen_random_uuid()::text;
  session_id uuid := gen_random_uuid();
  original_claim uuid;
  claimed uuid;
  job jsonb;
  retried jsonb;
begin
  if exists (select from public.import_sessions where status in ('received','processing')) or
     exists (select from public.client_mutations where status in ('received','processing')) then
    raise exception 'Disposable queues must be empty';
  end if;
  update private.scheduled_jobs set enabled=false where enabled;
  update private.scheduled_jobs set enabled=true,next_run_at=base where job_key='import.parse';
  if exists(select from private.claim_due_jobs('verify-worker',1,base,array['import.parse'])) then
    raise exception 'Empty import scheduled';
  end if;
  if (select next_run_at from private.scheduled_jobs where job_key='import.parse')
       is distinct from base+interval '30 seconds' then raise exception 'Import cadence changed'; end if;

  -- All four empty schedules may precede the one job that fills the batch.
  update private.scheduled_jobs set enabled=true,next_run_at=base where job_key in ('sync-mutations.retry','privacy.financial-reset-cleanup','privacy.account-delete');
  insert into private.scheduled_jobs(job_key,owner_spec,job_type,timeout_seconds,max_attempts,retry_safe,schedule,next_run_at)
    values('test.after-idle-import',2,'test',10,3,true,'{"kind":"interval","timezone":"UTC","everySeconds":600}',base+interval '31 seconds');
  base:=base+interval '31 seconds';
  select c into strict job from private.claim_due_jobs('verify-worker',1,base) c;
  if job->>'jobKey'<>'test.after-idle-import' then raise exception 'Batch slot lost'; end if;
  perform private.complete_job_attempt((job->>'attemptId')::uuid,'verify-worker','succeeded',null,'{}',base);

  insert into public.profiles(id,status) values(owner_id,'active');
  insert into public.import_sessions(id,user_id,source_type,request_hash,status,next_attempt_at)
    values(session_id,owner_id,'manual',md5(session_id::text)||md5(session_id::text),'received',base);
  if exists(select from private.claim_due_jobs('verify-worker',1,base+interval '29 seconds',array['import.parse'])) then
    raise exception 'Import scheduled early';
  end if;
  base:=base+interval '30 seconds';
  select c into strict job from private.claim_due_jobs('verify-worker',1,base,array['import.parse']) c;
  select claim_token into strict original_claim from private.claim_import_session('parser',1,60) where id=session_id;
  perform private.complete_job_attempt((job->>'attemptId')::uuid,'verify-worker','succeeded',null,'{"outcome":"succeeded","processed":1}',base);

  update public.import_sessions set lease_until=clock_timestamp()-interval '1 second' where id=session_id;
  base:=base+interval '30 seconds';
  select c into strict job from private.claim_due_jobs('verify-worker',1,base,array['import.parse']) c;
  select claim_token into strict claimed from private.claim_import_session('recovery',1,60) where id=session_id;
  if original_claim=claimed or claimed is null then raise exception 'Expired import lease was not renewed'; end if;
  update public.import_sessions set status='failed',completed_at=clock_timestamp(),claim_token=null,claimed_by=null,lease_until=null where id=session_id;
  perform private.complete_job_attempt((job->>'attemptId')::uuid,'verify-worker','failed','JOB_FAILED','{}',base);
  update private.scheduled_jobs set enabled=false where job_key='import.parse';
  select c into strict retried from private.claim_due_jobs('verify-worker',1,base+interval '5 seconds',array['import.parse']) c;
  if job->>'runId'<>retried->>'runId' or job->>'attemptId'=retried->>'attemptId' then
    raise exception 'Explicit retry skipped after last import';
  end if;
end $test$;
rollback;
