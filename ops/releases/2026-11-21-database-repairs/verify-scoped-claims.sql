-- Roll back on a disposable operations DB. Exercises the actual scope/readiness transition.
begin;
do $test$
declare
  base timestamptz := clock_timestamp();
  registered uuid;
  claim jsonb;
  result jsonb;
  bad_key text[];
begin
  insert into private.scheduled_jobs(job_key,owner_spec,job_type,timeout_seconds,max_attempts,
    retry_safe,schedule,next_run_at)
  values('test.scoped-repair',2,'test',10,3,true,'{"kind":"interval","timezone":"UTC","everySeconds":60}',base)
    returning id into registered;
  foreach bad_key slice 1 in array array[
    array['unknown.key','test.scoped-repair'],array['test.scoped-repair','test.scoped-repair'],
    array['test.scoped-repair',null]] loop
    begin
      perform private.claim_due_jobs('tester',1,base,bad_key);
      raise exception 'Invalid scope accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  if exists(select from private.claim_due_jobs('tester',1,base-interval '1 second',array['test.scoped-repair'])) then
    raise exception 'Premature schedule claim';
  end if;
  select c into strict claim from private.claim_due_jobs('tester',1,base,array['test.scoped-repair']) c;
  update private.scheduled_jobs set enabled=false where id=registered;
  if exists(select from private.claim_due_jobs('tester',1,base+interval '9 seconds',array['test.scoped-repair'])) then
    raise exception 'Live lease claimed early';
  end if;
  perform private.claim_due_jobs('tester',1,base+interval '10 seconds',array['test.scoped-repair']);
  if not exists(select from private.job_attempts where id=(claim->>'attemptId')::uuid
    and status='failed' and safe_error_code='WORKER_LEASE_EXPIRED') then raise exception 'Stale lease skipped'; end if;
  select c into strict result from private.claim_due_jobs('tester',1,base+interval '15 seconds',array['test.scoped-repair']) c;
  if result->>'runId' <> claim->>'runId' or result->>'attemptId'=claim->>'attemptId' then raise exception 'Wrong retry'; end if;
  perform private.complete_job_attempt((result->>'attemptId')::uuid,'tester','succeeded',null,'{}',base+interval '16 seconds');
  if exists(select from private.claim_due_jobs('tester',1,base+interval '1 day',array['test.scoped-repair'])) then
    raise exception 'Disabled schedule claimed';
  end if;
end $test$;
rollback;
