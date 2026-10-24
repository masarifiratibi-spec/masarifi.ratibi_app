grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create table private.user_job_quota_events (
  user_id text not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('import','report_generation')),
  operation_key text not null check(
    operation_key=btrim(operation_key) and char_length(operation_key) between 1 and 128
    and operation_key !~ '[[:cntrl:]]'
  ),
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,kind,operation_key)
);
alter table private.user_job_quota_events owner to masarifi_migration;
create index user_job_quota_events_window_idx
  on private.user_job_quota_events(user_id,kind,created_at);
alter table private.user_job_quota_events enable row level security;
alter table private.user_job_quota_events force row level security;
create policy user_job_quota_events_migration_all on private.user_job_quota_events
  for all to masarifi_migration using(true) with check(true);

insert into private.system_settings(setting_key,value,sensitivity) values
  ('tracking.user.import_rolling_limit','25','internal'),
  ('reports.user.generation_rolling_limit','10','internal'),
  ('jobs.user.rolling_hours','24','internal')
on conflict(setting_key) do nothing;

create function private.reserve_user_job_quota(
  p_user_id text,
  p_kind text,
  p_operation_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare quota_limit integer; rolling_hours integer; used_count integer; first_used_at timestamptz;
  rolling_window interval; error_code text;
begin
  perform private.assert_active_profile(p_user_id);
  if public.current_clerk_user_id() is distinct from p_user_id
    or p_kind not in ('import','report_generation')
    or p_operation_key is null
    or p_operation_key<>btrim(p_operation_key)
    or char_length(p_operation_key) not between 1 and 128
    or p_operation_key~'[[:cntrl:]]'
  then raise exception using errcode='22023',message='JOB_QUOTA_INVALID'; end if;
  select case p_kind
      when 'import' then coalesce((select (value#>>'{}')::integer from private.system_settings where setting_key='tracking.user.import_rolling_limit'),25)
      else coalesce((select (value#>>'{}')::integer from private.system_settings where setting_key='reports.user.generation_rolling_limit'),10)
    end,
    coalesce((select (value#>>'{}')::integer from private.system_settings where setting_key='jobs.user.rolling_hours'),24)
    into quota_limit,rolling_hours;
  if quota_limit not between 1 and 10000 or rolling_hours not between 1 and 720 then
    raise exception using errcode='55000',message='JOB_QUOTA_CONFIG_INVALID';
  end if;
  rolling_window:=make_interval(hours=>rolling_hours);
  perform pg_advisory_xact_lock(hashtextextended('user-job-quota:'||p_kind||':'||p_user_id,0));
  delete from private.user_job_quota_events
    where user_id=p_user_id and kind=p_kind and created_at<=clock_timestamp()-rolling_window;
  if exists(select 1 from private.user_job_quota_events where user_id=p_user_id and kind=p_kind and operation_key=p_operation_key) then
    select count(*),min(created_at) into used_count,first_used_at
      from private.user_job_quota_events where user_id=p_user_id and kind=p_kind;
    return jsonb_build_object('allowed',true,'limit',quota_limit,'used',used_count,
      'resetsAt',first_used_at+rolling_window,'replayed',true);
  end if;
  select count(*),min(created_at) into used_count,first_used_at
    from private.user_job_quota_events where user_id=p_user_id and kind=p_kind;
  if used_count>=quota_limit then
    error_code:=case p_kind when 'import' then 'IMPORT_QUOTA_EXCEEDED' else 'REPORT_QUOTA_EXCEEDED' end;
    raise exception using errcode='P0001',message=error_code;
  end if;
  insert into private.user_job_quota_events(user_id,kind,operation_key)
    values(p_user_id,p_kind,p_operation_key);
  return jsonb_build_object('allowed',true,'limit',quota_limit,'used',used_count+1,
    'resetsAt',coalesce(first_used_at,clock_timestamp())+rolling_window,'replayed',false);
end $$;
alter function private.reserve_user_job_quota(text,text,text) owner to masarifi_migration;
revoke all on function private.reserve_user_job_quota(text,text,text) from public;
grant execute on function private.reserve_user_job_quota(text,text,text) to masarifi_api;

reset role;
revoke masarifi_migration from current_user granted by current_user;
