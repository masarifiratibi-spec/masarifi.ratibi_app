-- Isolated database only. The fixtures, scoped claim and restore are rolled back together.
\set ON_ERROR_STOP on
begin;
set local role masarifi_migration;
set local timezone='UTC';
do $$ begin
  if exists(select from private.job_runs) or exists(select from private.job_history_archive) then
    raise exception 'VERIFY_REQUIRES_EMPTY_DISPOSABLE_HISTORY';
  end if;
  if (select schedule->>'everySeconds' from private.scheduled_jobs
    where job_key='operations.job-history-retain') is distinct from '300' then raise exception 'CADENCE'; end if;
  if has_function_privilege('masarifi_worker','private.restore_job_history(uuid)','execute') or
     has_table_privilege('masarifi_worker','private.job_history_archive','select') or
     has_function_privilege('masarifi_api','private.archive_job_history(timestamptz)','execute') then
    raise exception 'ARCHIVE_ACL';
  end if;
end $$;

create temp table cases as
select i,md5('history-'||i)::uuid id,transaction_timestamp() - (case i when 5 then 89 when 6 then 90 else 95 end)*interval '1 day' t
from generate_series(1,10) i;
insert into private.job_runs(id,job_key,job_type,owner_spec,status,queued_at,started_at,completed_at,
  correlation_id,retry_of_run_id,result_summary,version)
select id,'operations.fixture','operations.fixture',13,
  case i when 1 then 'dead_lettered' when 2 then 'succeeded' when 3 then 'failed' when 4 then 'retrying'
    when 9 then 'canceled' when 10 then 'failed' else 'succeeded' end,
  t-interval '1 hour',t-interval '1 hour',case when i<>4 then t end,'history-'||i,
  case i when 2 then md5('history-1')::uuid when 4 then md5('history-3')::uuid end,'{"count":2}',4 from cases;
insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at,completed_at,safe_error_code,next_attempt_at)
select id,1,'history-worker',case i when 7 then 'running' else 'failed' end,t-interval '1 hour',t,
  case i when 7 then null when 8 then transaction_timestamp()-interval '3 days' else t end,
  case when i<>7 then 'TEST_ERROR' end,case when i=2 then t+interval '1 second' end from cases where i<>9;
insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at,completed_at)
select id,2,'second-worker','succeeded',t,t,t from cases where i=2;
insert into private.provider_health_checks(provider_key,check_type,status,latency_ms,checked_at)
select 'database','shallow','up',1,transaction_timestamp()-i*interval '1 day' from (values (34),(36)) v(i);
create temp table original as
select id,to_jsonb(r) run_record,coalesce((select jsonb_agg(to_jsonb(a) order by a.attempt_no)
  from private.job_attempts a where a.run_id=r.id),'[]'::jsonb) attempt_records from private.job_runs r;
update private.system_settings set value='120' where setting_key='operations.history.retention_days';
do $$ begin
  if private.execute_operations_job('operations.job-history-retain',transaction_timestamp())->>'runsArchived'<>'0' then
    raise exception 'LONGER_RETENTION'; end if;
end $$;
update private.system_settings set value='30' where setting_key='operations.history.retention_days';
update private.scheduled_jobs set next_run_at=transaction_timestamp()-interval '1 minute'
where job_key='operations.job-history-retain';
set local role masarifi_worker;
do $normal$
declare claim jsonb; summary jsonb; finished jsonb;
begin
  select c into strict claim from private.claim_due_jobs('verify-retention',1,transaction_timestamp(),
    array['operations.job-history-retain']) c;
  if claim->>'jobKey'<>'operations.job-history-retain' then raise exception 'SCOPE'; end if;
  summary:=private.execute_operations_job(claim->>'jobKey',transaction_timestamp());
  if (summary->>'runsArchived')::int<>3 or (summary->>'attemptsArchived')::int<>3 then
    raise exception 'FIRST_ARCHIVE: %',summary; end if;
  finished:=private.complete_job_attempt((claim->>'attemptId')::uuid,'verify-retention','succeeded',null,summary,clock_timestamp());
  if finished->>'status'<>'succeeded' then raise exception 'COMPLETION'; end if;
end
$normal$;
set local role masarifi_migration;
do $$ declare result jsonb;
begin
  if exists(select 1 from private.job_history_archive h join cases c on c.id=h.id where c.i not in (2,9,10)) then
    raise exception 'PROTECTION'; end if;
  if (select count(*) from private.provider_health_checks)<>1 then raise exception 'PROVIDER_RETENTION'; end if;
  -- Even a caller-supplied future timestamp cannot move a run within the 90-day floor.
  -- Reuse the exact cutoff for the boundary case here, then check the 89-day example separately.
  result:=private.execute_operations_job('operations.job-history-retain',transaction_timestamp());
  if result->>'runsArchived'<>'1' or result->>'providerChecksSwept'<>'false' then raise exception 'RETRY_PARENT'; end if;
  if (select count(*) from private.job_history_archive h join original o on o.id=h.id
    and (to_jsonb(h)-'archived_at')=o.run_record and o.attempt_records=coalesce((select jsonb_agg(to_jsonb(a) order by a.attempt_no)
      from private.job_attempt_history_archive a where a.run_id=h.id),'[]'::jsonb))<>4 then raise exception 'EXACT_COPY'; end if;
  begin
    perform private.restore_job_history(md5('history-2')::uuid);
    raise exception 'CHILD_RESTORED_WITHOUT_PARENT';
  exception when foreign_key_violation then null; end;
  if not exists(select from private.job_history_archive where id=md5('history-2')::uuid) then raise exception 'RESTORE_ROLLBACK'; end if;
  if not private.restore_job_history(md5('history-1')::uuid) or not private.restore_job_history(md5('history-2')::uuid) then
    raise exception 'RETRY_RESTORE'; end if;
  if private.restore_job_history(md5('history-2')::uuid) then raise exception 'RESTORE_REPLAY'; end if;
  if (select count(*) from original o join private.job_runs r on r.id=o.id
    where to_jsonb(r)=o.run_record and o.attempt_records=coalesce((select jsonb_agg(to_jsonb(a) order by a.attempt_no)
    from private.job_attempts a where a.run_id=r.id),'[]'::jsonb))<>8 then raise exception 'EXACT_RESTORE'; end if;
  perform private.execute_operations_job('operations.job-history-retain',transaction_timestamp()+interval '10 years');
  if not exists(select from private.job_runs where id=md5('history-5')::uuid) then raise exception 'FUTURE_CUTOFF'; end if;
end $$;

-- Force a failure after the archive insert and attempt delete. The whole move must roll back.
create function pg_temp.reject_history_delete() returns trigger language plpgsql as $$
begin raise exception using errcode='ZX001',message='injected rollback test'; end $$;
create trigger reject_history_delete before delete on private.job_runs
for each row execute function pg_temp.reject_history_delete();
do $$ declare before_attempts bigint; before_runs bigint; before_archive bigint;
begin
  select count(*) into before_attempts from private.job_attempts;
  select count(*) into before_runs from private.job_runs;
  select count(*) into before_archive from private.job_history_archive;
  begin
    perform private.execute_operations_job('operations.job-history-retain',clock_timestamp());
    raise exception 'EXPECTED_INJECTED_FAILURE';
  exception when sqlstate 'ZX001' then null; end;
  if before_attempts<>(select count(*) from private.job_attempts) or before_runs<>(select count(*) from private.job_runs)
    or before_archive<>(select count(*) from private.job_history_archive) then raise exception 'PARTIAL_MOVE'; end if;
end $$;
rollback;
