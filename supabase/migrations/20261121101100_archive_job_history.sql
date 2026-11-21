-- Prebuild these two indexes concurrently on a populated deployment (see the release runbook).
set local lock_timeout = '250ms';
do $executor$
begin
  perform set_config('masarifi.archive.executor', current_setting('role'), true);
  if not pg_has_role(current_user, 'masarifi_migration', 'SET') then
    -- Leave any pre-existing membership options intact.
    if exists (select 1 from pg_auth_members where roleid='masarifi_migration'::regrole
      and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'JOB_HISTORY_MIGRATION_REQUIRES_SET_ROLE';
    end if;
    execute 'grant masarifi_migration to current_user with set true, inherit false granted by current_user';
    perform set_config('masarifi.archive.temporary_membership', 'true', true);
  end if;
end
$executor$;
set local role masarifi_migration;

create index if not exists job_runs_retry_parent_idx on private.job_runs(retry_of_run_id)
  where retry_of_run_id is not null;
create index if not exists job_runs_completed_retention_idx on private.job_runs(completed_at,id)
  where completed_at is not null;

do $check_indexes$
begin
  if (select count(*) from pg_index where indrelid='private.job_runs'::regclass
    and indisready and indisvalid and (
      (indexrelid='private.job_runs_retry_parent_idx'::regclass and indnkeyatts=1
        and pg_get_indexdef(indexrelid,1,true)='retry_of_run_id'
        and pg_get_expr(indpred,indrelid)='(retry_of_run_id IS NOT NULL)')
      or (indexrelid='private.job_runs_completed_retention_idx'::regclass and indnkeyatts=2
        and pg_get_indexdef(indexrelid,1,true)='completed_at' and pg_get_indexdef(indexrelid,2,true)='id'
        and pg_get_expr(indpred,indrelid)='(completed_at IS NOT NULL)'))) <> 2 then
    raise exception 'JOB_HISTORY_INDEX_INCOMPLETE';
  end if;
end
$check_indexes$;

-- Store native column values and just the lookup keys used by restore. LIKE also copies NOT NULL.
create table private.job_history_archive (
  like private.job_runs,
  archived_at timestamptz not null default clock_timestamp(),
  primary key(id)
);
create table private.job_attempt_history_archive (
  like private.job_attempts,
  primary key(run_id,attempt_no),
  foreign key(run_id) references private.job_history_archive(id) on delete restrict
);
alter table private.job_history_archive enable row level security;
alter table private.job_history_archive force row level security;
alter table private.job_attempt_history_archive enable row level security;
alter table private.job_attempt_history_archive force row level security;
create policy job_history_archive_owner on private.job_history_archive
  for all to masarifi_migration using (true) with check (true);
create policy job_attempt_history_archive_owner on private.job_attempt_history_archive
  for all to masarifi_migration using (true) with check (true);
revoke all on table private.job_history_archive,private.job_attempt_history_archive
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

create function private.archive_job_history(p_now timestamptz) returns jsonb
language plpgsql set search_path='' set timezone='UTC' set lock_timeout='250ms' as $archive$
declare
  as_of timestamptz := least(p_now,statement_timestamp());
  cutoff timestamptz;
  run_ids uuid[];
  expected_attempts integer;
  moved_attempts integer;
  moved_runs integer;
  swept_checks boolean;
  removed_checks integer := 0;
begin
  select as_of - make_interval(days=>greatest(90, (select (value#>>'{}')::integer
    from private.system_settings where setting_key='operations.history.retention_days'))) into cutoff;

  -- Children leave first. A live child (including a pending retry) keeps its parent online.
  select array(
    select r.id from private.job_runs r
    where r.completed_at < cutoff and r.status in ('succeeded','failed','dead_lettered','canceled')
      and not exists (select 1 from private.job_runs child where child.retry_of_run_id=r.id)
      and not exists (select 1 from private.job_attempts a where a.run_id=r.id
        and (a.completed_at is null or a.completed_at>=cutoff))
    order by r.completed_at,r.id limit 250 for update of r skip locked
  ) into run_ids;

  insert into private.job_history_archive
    select r.*,clock_timestamp() from private.job_runs r where r.id=any(run_ids);
  insert into private.job_attempt_history_archive
    select a.* from private.job_attempts a where a.run_id=any(run_ids);
  get diagnostics expected_attempts=row_count;

  -- Compare all columns before removal. Schema drift or a missing copied row rolls the batch back.
  delete from private.job_attempts a using private.job_attempt_history_archive h
  where a.run_id=any(run_ids) and h.run_id=any(run_ids) and h.run_id=a.run_id and h.attempt_no=a.attempt_no and to_jsonb(h)=to_jsonb(a);
  get diagnostics moved_attempts=row_count;
  delete from private.job_runs r using private.job_history_archive h
  where r.id=any(run_ids) and h.id=any(run_ids) and h.id=r.id and (to_jsonb(h)-'archived_at')=to_jsonb(r);
  get diagnostics moved_runs=row_count;
  if moved_runs<>cardinality(run_ids) or moved_attempts<>expected_attempts then
    raise exception 'JOB_HISTORY_ARCHIVE_MISMATCH';
  end if;

  -- Preserve this job's original daily, 35-day provider-check cleanup independently.
  select not exists(select 1 from private.job_runs r
    where r.job_key='operations.job-history-retain' and r.queued_at>=date_trunc('day',as_of)
      and r.status='succeeded' and r.result_summary @> '{"providerChecksSwept":true}') into swept_checks;
  if swept_checks then
    delete from private.provider_health_checks where id in (
      select id from private.provider_health_checks where checked_at<as_of-interval '35 days'
      order by id limit 1000 for update skip locked
    );
    get diagnostics removed_checks=row_count;
  end if;
  return jsonb_build_object('outcome','succeeded','jobKey','operations.job-history-retain',
    'runsArchived',moved_runs,'attemptsArchived',moved_attempts,'runsDeleted',moved_runs,
    'attemptsDeleted',moved_attempts,'checksDeleted',removed_checks,'providerChecksSwept',swept_checks);
end
$archive$;
revoke all on function private.archive_job_history(timestamptz) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

-- Restore parents first. Conflicts, incompatible schema and missing parents roll back the whole move.
create function private.restore_job_history(p_run_id uuid) returns boolean
language plpgsql set search_path='' set timezone='UTC' set lock_timeout='250ms' as $restore$
declare
  snapshot jsonb;
  actual_run jsonb;
  restored_attempts integer;
  verified_attempts integer;
begin
  select to_jsonb(h)-'archived_at' into snapshot from private.job_history_archive h where h.id=p_run_id for update;
  if not found then return false; end if;
  insert into private.job_runs as r select * from jsonb_populate_record(null::private.job_runs,snapshot)
    returning to_jsonb(r) into actual_run;
  insert into private.job_attempts select h.* from private.job_attempt_history_archive h where h.run_id=p_run_id;
  get diagnostics restored_attempts=row_count;
  delete from private.job_attempt_history_archive h using private.job_attempts a
    where h.run_id=p_run_id and a.run_id=h.run_id and a.attempt_no=h.attempt_no and to_jsonb(h)=to_jsonb(a);
  get diagnostics verified_attempts=row_count;
  if actual_run is distinct from snapshot or restored_attempts<>verified_attempts then
    raise exception 'JOB_HISTORY_RESTORE_MISMATCH';
  end if;
  delete from private.job_history_archive where id=p_run_id;
  return true;
end
$restore$;
revoke all on function private.restore_job_history(uuid) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

-- Patch only the historical deletion branch, preserving the registered handler's owner, ACL and other branches.
do $route$
declare
  definition text := replace(pg_get_functiondef('private.execute_operations_job(text,timestamptz)'::regprocedure), E'\r\n', E'\n');
  old_branch text := $old$    retention_days:=coalesce((select (value#>>'{}')::integer from private.system_settings where setting_key='operations.history.retention_days'),90);
    delete from private.job_attempts where id in (select a.id from private.job_attempts a join private.job_runs r on r.id=a.run_id where r.completed_at<p_now-make_interval(days=>retention_days) order by a.id limit 1000); get diagnostics attempts_deleted=row_count;
    delete from private.job_runs where id in (select id from private.job_runs where completed_at<p_now-make_interval(days=>retention_days) and not exists(select 1 from private.job_runs child where child.retry_of_run_id=job_runs.id) order by id limit greatest(0,1000-attempts_deleted)); get diagnostics runs_deleted=row_count;
    delete from private.provider_health_checks where id in (select id from private.provider_health_checks where checked_at<p_now-interval '35 days' order by id limit 1000); get diagnostics checks_deleted=row_count;
    return jsonb_build_object('outcome','succeeded','jobKey',p_job_key,'runsDeleted',runs_deleted,'attemptsDeleted',attempts_deleted,'checksDeleted',checks_deleted);$old$;
begin
  if strpos(definition,old_branch)=0 then raise exception 'JOB_HISTORY_HANDLER_REQUIRES_RECONCILIATION'; end if;
  execute replace(definition,old_branch,'    return private.archive_job_history(p_now);');
  update private.scheduled_jobs set schedule=jsonb_set(schedule,'{everySeconds}','300'),
    next_run_at=least(next_run_at,clock_timestamp()+interval '5 minutes')
  where job_key='operations.job-history-retain' and schedule->>'kind'='interval';
  if not found then raise exception 'JOB_HISTORY_SCHEDULE_MISSING'; end if;
end
$route$;
select set_config('role',current_setting('masarifi.archive.executor'),true);
do $cleanup$
begin
  if current_setting('masarifi.archive.temporary_membership',true)='true' then
    execute 'revoke masarifi_migration from current_user granted by current_user';
  end if;
end
$cleanup$;
