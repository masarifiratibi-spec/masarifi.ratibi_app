-- Retain authoritative job-run/attempt audit. Suppress only the recurring
-- zero-claim sync success notification; financial/retry/error behavior is unchanged.
set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $guard$
begin
  if not exists (
    select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('private.complete_job_attempt(uuid,text,text,text,jsonb,timestamptz)')
      and p.proowner='masarifi_migration'::regrole and p.prosecdef
      and l.lanname='plpgsql' and p.prorettype='jsonb'::regtype
      and p.proconfig=array['search_path=""']
      and md5(replace(p.prosrc,E'\r\n',E'\n'))='7a43dff135d670b96afe15464ea1bd2b'
  ) then
    raise exception 'OPERATIONS_COMPLETION_REQUIRES_RECONCILIATION';
  end if;
  perform set_config('masarifi.sync_event.original_acl',coalesce((
    select proacl::text from pg_proc
    where oid='private.complete_job_attempt(uuid,text,text,text,jsonb,timestamptz)'::regprocedure
  ),'null'),true);
  perform set_config('masarifi.sync_event.executor_role', current_setting('role'), true);
  perform set_config('masarifi.sync_event.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.sync_event.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.sync_event.granted_role', 'true', true);
  end if;
end
$guard$;

set local role masarifi_migration;

CREATE OR REPLACE FUNCTION private.complete_job_attempt(p_attempt_id uuid, p_worker_id text, p_outcome text, p_safe_error_code text, p_result_summary jsonb, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare attempt private.job_attempts%rowtype; run private.job_runs%rowtype; job private.scheduled_jobs%rowtype; final_status text; retry_at timestamptz; updated_version bigint;
begin
  if p_outcome not in ('succeeded','failed') or p_now is null
    or p_result_summary is null or not private.valid_safe_summary(p_result_summary)
    or (p_safe_error_code is not null and p_safe_error_code !~ '^[A-Z][A-Z0-9_]{2,79}$') then
    raise exception using errcode='22023',message='OPERATIONS_COMPLETION_INPUT_INVALID';
  end if;
  select * into attempt from private.job_attempts where id=p_attempt_id for update;
  if not found or attempt.status<>'running' or attempt.worker_id<>p_worker_id then
    raise exception using errcode='P0002',message='OPERATIONS_ATTEMPT_UNAVAILABLE';
  end if;
  select * into run from private.job_runs where id=attempt.run_id for update;
  select * into job from private.scheduled_jobs where id=run.scheduled_job_id;
  if run.status='canceled' then
    update private.job_attempts set status='failed',completed_at=p_now,safe_error_code='JOB_CANCELED' where id=attempt.id;
    return jsonb_build_object('runId',run.id,'attemptId',attempt.id,'status','canceled');
  end if;
  retry_at:=case when p_outcome='failed' and job.retry_safe and attempt.attempt_no<job.max_attempts
    then p_now+make_interval(secs=>least(300,(2^greatest(0,attempt.attempt_no-1))::integer*5)) end;
  final_status:=case when p_outcome='succeeded' then 'succeeded' when retry_at is not null then 'retrying' else 'dead_lettered' end;
  update private.job_attempts set status=p_outcome,completed_at=p_now,safe_error_code=case when p_outcome='failed' then coalesce(p_safe_error_code,'JOB_FAILED') end,
    next_attempt_at=retry_at
    where id=attempt.id;
  update private.job_runs set status=final_status,completed_at=case when final_status='retrying' then null else p_now end,result_summary=p_result_summary where id=run.id returning version into updated_version;
  -- Zero executable claims can still reject blocked dependencies. Keep all run
  -- history; omit only this recurring success notification, never failure events.
  if not coalesce(run.job_key='sync-mutations.retry' and p_outcome='succeeded'
    and final_status='succeeded' and p_result_summary->>'outcome'='succeeded'
    and p_result_summary->'processed'='0'::jsonb,false) then
    perform private.enqueue_outbox_event(
      case when final_status='succeeded' then 'operations.job-succeeded' when final_status='dead_lettered' then 'operations.job-dead-lettered' else 'operations.job-failed' end,
      'job_run',run.id,jsonb_build_object('jobKey',run.job_key,'ownerSpec',run.owner_spec,'version',updated_version,
        'safeCode',case when p_outcome='failed' then coalesce(p_safe_error_code,'JOB_FAILED') end,
        'durationBucket',case when p_now-attempt.started_at<interval '1 second' then 'under_1s' when p_now-attempt.started_at<interval '10 seconds' then '1s_to_10s' else 'over_10s' end));
  end if;
  return jsonb_build_object('runId',run.id,'attemptId',attempt.id,'status',final_status);
end $function$;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.sync_event.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.sync_event.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.sync_event.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;

do $verify_acl$
begin
  if (select coalesce(proacl::text,'null') from pg_proc
    where oid='private.complete_job_attempt(uuid,text,text,text,jsonb,timestamptz)'::regprocedure)
      <> current_setting('masarifi.sync_event.original_acl') then
    raise exception 'OPERATIONS_COMPLETION_GRANTS_CHANGED';
  end if;
end
$verify_acl$;
