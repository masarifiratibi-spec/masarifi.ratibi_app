-- Allow workers to acquire administrator-requested retries.
set local lock_timeout='1s';
set local statement_timeout='5s';
do $guard$ begin
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
      where oid=to_regprocedure('private.claim_due_jobs(text,integer,timestamptz,text[])'))
      is distinct from '86e99034c109410e9689d2044faa1925'
    or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
      where oid=to_regprocedure('private.claim_due_jobs(text,integer,timestamptz)'))
      is distinct from 'a7f18a36a957ed8a757a97fe1e3ab49f' then raise exception 'MANUAL_RETRY_SCHEDULER_BODY_MISMATCH'; end if;
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

-- Treat an accepted manual retry as the first attempt of its existing run.
-- Both published overloads use the same scheduler body at the insertion point.
do $install$
declare
  target regprocedure;
  definition text;
  marker constant text := '  open due_jobs for select * from private.scheduled_jobs';
  scope_filter text;
  manual_claim constant text := $claim$
  for retry in
    select r.id as run_id, r.job_key, r.job_type, r.owner_spec, j.timeout_seconds, j.configuration, j.retry_safe
    from private.job_runs r
    join private.scheduled_jobs j on j.id = r.scheduled_job_id
    where r.status = 'queued' and r.retry_of_run_id is not null and r.queued_at <= p_now
      %s
    order by r.queued_at, r.id
    limit remaining for update of r skip locked for share of j skip locked
  loop
    -- Registration can revoke retry safety after the administrator queued the run.
    if not retry.retry_safe then
      update private.job_runs
        set status = 'dead_lettered', started_at = p_now, completed_at = p_now,
            result_summary = '{"errorCode":"OPERATIONS_RETRY_UNSAFE"}'
        where id = retry.run_id;
      continue;
    end if;
    insert into private.job_attempts(run_id, attempt_no, worker_id, status, started_at, heartbeat_at)
      values (retry.run_id, 1, p_worker_id, 'running', p_now, p_now) returning id into attempt_id;
    update private.job_runs set status = 'running', started_at = p_now where id = retry.run_id;
    return next jsonb_build_object(
      'jobKey', retry.job_key, 'jobType', retry.job_type, 'ownerSpec', retry.owner_spec,
      'runId', retry.run_id, 'attemptId', attempt_id,
      'timeoutSeconds', retry.timeout_seconds, 'configuration', retry.configuration);
    remaining := remaining - 1;
    if remaining = 0 then return; end if;
  end loop;

$claim$;
begin
  foreach target in array array[
    'private.claim_due_jobs(text,integer,timestamptz)'::regprocedure,
    'private.claim_due_jobs(text,integer,timestamptz,text[])'::regprocedure
  ] loop
    definition := replace(pg_get_functiondef(target), E'\r\n', E'\n');
    if cardinality(string_to_array(definition, marker)) <> 2 then
      raise exception 'MANUAL_RETRY_CLAIM_MARKER_MISMATCH';
    end if;
    select case when pronargs = 4 then 'and j.job_key = any(p_job_keys)' else '' end
      into strict scope_filter from pg_proc where oid = target;
    execute replace(definition, marker, format(manual_claim, scope_filter) || marker);
  end loop;
end
$install$;

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
