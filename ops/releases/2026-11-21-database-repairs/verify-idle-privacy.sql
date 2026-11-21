-- Run on a disposable database with empty privacy job queues. All fixtures roll back.
begin;
do $test$
declare
  base timestamptz := clock_timestamp();
  owner_id text := 'idle-privacy-' || gen_random_uuid()::text;
  req uuid := gen_random_uuid();
  del uuid := gen_random_uuid();
  reset_key constant text := 'privacy.financial-reset-cleanup';
  delete_key constant text := 'privacy.account-delete';
  first_job jsonb;
  retry jsonb;
begin
  if exists(select from private.financial_reset_objects) or exists(select from private.account_upload_erasure_tombstones)
    or exists(select from private.account_deletion_requests where status in ('verified','processing')) then
    raise exception 'Test requires empty privacy queues';
  end if;
  update private.scheduled_jobs set next_run_at=base,enabled=true where job_key in (reset_key,delete_key);
  if exists(select from private.claim_due_jobs('privacy-test',1,base,array[reset_key,delete_key])) then
    raise exception 'Empty privacy job scheduled';
  end if;

  insert into public.profiles(id,status) values(owner_id,'active');
  insert into private.financial_reset_receipts(owner_id,request_id,generation,reset_at)
    values(owner_id,req,1,base);
  insert into private.financial_reset_objects(owner_id,request_id,kind,storage_ref,next_attempt_at)
    values(owner_id,req,'export','disposable-reset-fixture',base-interval '1 second');
  select c into strict first_job from private.claim_due_jobs('privacy-test',1,base+interval '15 seconds',array[reset_key]) c;
  if not exists(select from private.list_pending_financial_reset_objects(1,owner_id)) then
    raise exception 'Reset object missed first due tick';
  end if;
  perform private.complete_job_attempt((first_job->>'attemptId')::uuid,'privacy-test','succeeded',null,'{"outcome":"succeeded","processed":1}',base+interval '15 seconds');

  insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at)
    values(del,owner_id,'verified',base,base,base+interval '1 day');
  -- A future cooling-off deadline remains the deletion handler's responsibility.
  select c into strict first_job from private.claim_due_jobs('privacy-test',1,base+interval '60 seconds',array[delete_key]) c;
  perform private.complete_job_attempt((first_job->>'attemptId')::uuid,'privacy-test','succeeded',null,'{"outcome":"succeeded","processed":0}',base+interval '60 seconds');
  update private.account_deletion_requests set status='processing' where id=del;
  select c into strict first_job from private.claim_due_jobs('privacy-test',1,base+interval '120 seconds',array[delete_key]) c;
  perform private.complete_job_attempt((first_job->>'attemptId')::uuid,'privacy-test','succeeded',null,'{"outcome":"succeeded","processed":0}',base+interval '120 seconds');

  update private.account_deletion_requests set status='completed',completed_at=base where id=del;
  insert into private.account_upload_erasure_tombstones(request_id,user_id,storage_ref,capability_expires_at)
    values(del,owner_id,'support/'||gen_random_uuid()::text||'/'||gen_random_uuid()::text,base);
  select c into strict first_job from private.claim_due_jobs('privacy-test',1,base+interval '180 seconds',array[delete_key]) c;
  delete from private.account_upload_erasure_tombstones where request_id=del;
  perform private.complete_job_attempt((first_job->>'attemptId')::uuid,'privacy-test','failed','JOB_FAILED','{}',base+interval '180 seconds');
  select c into strict retry from private.claim_due_jobs('privacy-test',1,base+interval '185 seconds',array[delete_key]) c;
  if retry->>'runId'<>first_job->>'runId' or retry->>'attemptId'=first_job->>'attemptId' then
    raise exception 'Privacy retry lost on empty queues';
  end if;
end $test$;
rollback;
