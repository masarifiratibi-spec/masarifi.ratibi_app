-- Run only on an empty disposable database restored to the migrated operations schema.
\set ON_ERROR_STOP on
begin;
set local role masarifi_migration;
set local timezone='UTC';
do $$ begin
  if exists(select from private.job_runs) or exists(select from private.job_history_archive) then
    raise exception 'BENCHMARK_REQUIRES_EMPTY_DISPOSABLE_HISTORY';
  end if;
end $$;

insert into private.job_runs(id,job_key,job_type,owner_spec,status,queued_at,started_at,completed_at,correlation_id)
select md5(i::text)::uuid,'operations.fixture','operations.fixture',13,'succeeded',t,t,t,'fixture-'||i
from generate_series(1,375000) i
cross join lateral (select transaction_timestamp() -
  case when i<=27320 then interval '100 days' else interval '1 day' end - i*interval '1 ms' as t) seed;
insert into private.job_attempts(run_id,attempt_no,worker_id,status,started_at,heartbeat_at,completed_at)
select id,1,'fixture','succeeded',started_at,started_at,completed_at from private.job_runs;
analyze private.job_runs;
analyze private.job_attempts;
-- Compare the same FK lookup with and without the new index, against the same rows.
savepoint fk_probe;
drop index private.job_runs_retry_parent_idx;
explain (analyze,buffers) select 1 from only private.job_runs where retry_of_run_id=md5('1')::uuid for key share;
rollback to fk_probe;
explain (analyze,buffers) select 1 from only private.job_runs where retry_of_run_id=md5('1')::uuid for key share;

create temp table archive_timings (runs integer, attempts integer, elapsed_ms numeric);
create function pg_temp.measure_batch() returns void language plpgsql as $$
declare started timestamptz := clock_timestamp(); result jsonb;
begin
  result:=private.execute_operations_job('operations.job-history-retain',clock_timestamp());
  insert into archive_timings values ((result->>'runsArchived')::int,(result->>'attemptsArchived')::int,
    extract(epoch from clock_timestamp()-started)*1000);
end $$;
set local statement_timeout='2s';
select 'select pg_temp.measure_batch();' from generate_series(1,110) \gexec
set local statement_timeout='0';
do $$ begin
  if (select sum(runs)<>27320 or sum(attempts)<>27320 or count(*) filter(where runs=250)<>109
    or max(runs)>250 from archive_timings) then raise exception 'BENCHMARK_ARCHIVE_COUNTS'; end if;
  if (select count(*) from private.job_runs)<>347680 or
     (select count(*) from private.job_attempts)<>347680 or
     (select count(*) from private.job_history_archive)<>27320 or
     (select count(*) from private.job_attempt_history_archive)<>27320 then raise exception 'BENCHMARK_INVENTORY'; end if;
end $$;
select count(*) batches,sum(runs) archived_runs,sum(attempts) archived_attempts,
  round(sum(elapsed_ms),1) total_ms,round(percentile_cont(.95) within group(order by elapsed_ms)::numeric,1) p95_ms,
  round(max(elapsed_ms),1) max_ms,(pg_total_relation_size('private.job_history_archive')+pg_total_relation_size('private.job_attempt_history_archive')) archive_bytes
from archive_timings;
rollback;
