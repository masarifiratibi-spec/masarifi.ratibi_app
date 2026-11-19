-- Install only alongside the isolated staging_reports schema. Run as a migration
-- administrator in psql with ON_ERROR_STOP enabled. All hooks install atomically.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '4s';
set local role masarifi_migration;
set local search_path = '';

create or replace function staging_reports.lock_owner_files(p_owner text, busy_message text)
returns table(storage_ref text) language plpgsql set search_path='' as $$
declare attempt record; expected text;
begin
  for attempt in select a.id,a.storage_ref,a.snapshot->>'format' as fmt
    from staging_reports.report_output_attempts a where a.user_id=p_owner order by a.id loop
    if not pg_try_advisory_xact_lock(hashtextextended(attempt.id::text,0))
       or not pg_try_advisory_xact_lock(hashtextextended(attempt.id::text,1)) then
      raise exception using errcode='55000',message=busy_message;
    end if;
    expected := 'reports/'||encode(extensions.digest(p_owner,'sha256'),'hex')
      ||'/'||attempt.id||'.'||attempt.fmt;
    if expected is null or attempt.fmt not in ('pdf','csv','json')
       or (attempt.storage_ref is not null and attempt.storage_ref<>expected)
       or exists(select from private.report_output_attempts p where p.id=attempt.id) then
      raise exception 'STAGING_REPORT_STORAGE_IDENTITY_INVALID';
    end if;
    storage_ref := expected;
    return next;
  end loop;
end $$;

create or replace function staging_reports.erase_owner_rows(p_owner text)
returns integer language plpgsql set search_path='' as $$
declare removed integer; affected integer;
begin
  delete from staging_reports.outbox_events o where o.payload->>'userId'=p_owner
    or o.payload->>'profileId'=p_owner or o.payload#>>'{sync,userId}'=p_owner
    or (replace(o.aggregate_type,'-','_')='report_attempt' and o.aggregate_id in
         (select id from staging_reports.report_output_attempts where user_id=p_owner))
    or (replace(o.aggregate_type,'-','_')='report_schedule' and o.aggregate_id in
         (select id from staging_reports.report_schedules where user_id=p_owner));
  get diagnostics removed=row_count;
  delete from staging_reports.report_output_attempts where user_id=p_owner;
  get diagnostics affected=row_count; removed:=removed+affected;
  delete from staging_reports.report_schedules where user_id=p_owner;
  get diagnostics affected=row_count; removed:=removed+affected;
  delete from staging_reports.user_job_quota_events where user_id=p_owner;
  get diagnostics affected=row_count; removed:=removed+affected;
  delete from staging_reports.idempotency_keys where actor_id=p_owner;
  get diagnostics affected=row_count;
  return removed+affected;
end $$;
revoke all on function staging_reports.lock_owner_files(text,text),staging_reports.erase_owner_rows(text)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

-- Preserve all existing privilege checks, holds and runtime-specific additions.
-- Require a unique insertion point. A changed definition aborts the installation.
create function pg_temp.insert_before(target regprocedure, anchor text, addition text)
returns void language plpgsql as $$
declare body text:=pg_get_functiondef(target); updated text;
begin
  body:=replace(body,E'\r\n',E'\n');
  if strpos(body,addition||anchor)>0 then return; end if;
  if array_length(string_to_array(body,anchor),1)<>2 then
    raise exception 'Unexpected installation point in %',target;
  end if;
  updated:=replace(body,anchor,addition||anchor);
  execute updated;
end $$;

select pg_temp.insert_before('private.begin_account_erasure(uuid,text)',
  $$('public','accounts','account'),$$,
  $$('staging_reports','report_output_attempts','staging_report_attempt'),
    ('staging_reports','report_schedules','staging_report_schedule'),
    $$);

select pg_temp.insert_before('private.lock_account_erasure_objects(uuid,text)',
  $$  update private.account_erasure_context set objects_locked=true$$,
  $$  return query select 'report'::text,f.storage_ref
    from staging_reports.lock_owner_files(p_owner,'ERASURE_WORK_BUSY') f;
$$);

select pg_temp.insert_before('private.erase_account_owner_payload(uuid,text)',
  $$  delete from private.report_output_attempts where user_id=p_owner;$$,
  $$  removed:=removed+staging_reports.erase_owner_rows(p_owner);
$$);

select pg_temp.insert_before('private.reset_financial_data(text,uuid)',
  $$('public.transactions','transaction'),$$,
  $$('staging_reports.report_output_attempts','staging-report-attempt'),
    ('staging_reports.report_schedules','staging-report-schedule'),
    $$);

select pg_temp.insert_before('private.reset_financial_data(text,uuid)',
  $$  insert into private.financial_reset_objects(owner_id,request_id,kind,storage_ref,protect_until)$$,
  $$  insert into private.financial_reset_objects(owner_id,request_id,kind,storage_ref)
    select p_owner,p_request,'report',f.storage_ref
    from staging_reports.lock_owner_files(p_owner,'FINANCIAL_RESET_WORK_BUSY') f;
  perform staging_reports.erase_owner_rows(p_owner);
$$);
drop function pg_temp.insert_before(regprocedure,text,text);
commit;
