grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- Coarse native foreground observations only; never infer historical activity from devices.
insert into private.system_settings(setting_key,value,sensitivity)
values ('reports.reporting_timezone','"Asia/Riyadh"','internal') on conflict do nothing;
create table private.mobile_activity_collection (
  singleton boolean primary key default true check(singleton),
  started_at timestamptz not null default clock_timestamp()
);
insert into private.mobile_activity_collection default values;
create table private.mobile_activity_buckets (
  user_id text not null references public.profiles(id) on delete cascade,
  platform text not null check(platform in ('ios','android')),
  bucket_at timestamptz not null,
  observed_at timestamptz not null default clock_timestamp(),
  primary key(user_id,platform,bucket_at)
);
create index mobile_activity_retention_idx on private.mobile_activity_buckets(bucket_at);
create index mobile_activity_observed_idx on private.mobile_activity_buckets(observed_at,user_id,platform);
alter table private.mobile_activity_collection owner to masarifi_migration;
alter table private.mobile_activity_buckets owner to masarifi_migration;
alter table private.mobile_activity_collection enable row level security;
alter table private.mobile_activity_buckets enable row level security;
revoke all on private.mobile_activity_collection,private.mobile_activity_buckets from public,anon,authenticated,masarifi_api,masarifi_worker;

create function private.prune_mobile_activity() returns void
language sql security definer set search_path='' as $$
  delete from private.mobile_activity_buckets where bucket_at < statement_timestamp()-interval '120 days';
$$;
alter function private.prune_mobile_activity() owner to masarifi_migration;
revoke all on function private.prune_mobile_activity() from public;
grant execute on function private.prune_mobile_activity() to masarifi_worker;

create function private.record_mobile_activity(p_platform text) returns void
language plpgsql security definer set search_path='' as $$
declare subject text:=public.current_clerk_user_id(); observed timestamptz:=clock_timestamp();
begin
  if p_platform is null or p_platform not in ('ios','android') or subject is null or not exists(
    select 1 from public.user_devices d join public.profiles p on p.id=d.user_id
    where d.user_id=subject and d.clerk_session_id=current_setting('request.jwt.claims',true)::jsonb->>'sid'
      and d.platform=p_platform and d.revoked_at is null and p.status='active'
  ) then raise exception using errcode='42501',message='MOBILE_ACTIVITY_DENIED'; end if;
  insert into private.mobile_activity_buckets(user_id,platform,bucket_at,observed_at)
  values(subject,p_platform,date_bin(interval '15 minutes',observed,'2000-01-01'::timestamptz),observed)
  on conflict do nothing;
end $$;
alter function private.record_mobile_activity(text) owner to masarifi_migration;
revoke all on function private.record_mobile_activity(text) from public;
grant execute on function private.record_mobile_activity(text) to masarifi_api;

create function private.read_admin_report_measurements(p_platform text,p_days integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare observed timestamptz:=statement_timestamp(); tz text; first_day date; today date;
  starts timestamptz; collection timestamptz; result jsonb; activity jsonb; growth jsonb; import_volume jsonb; versions jsonb; operations jsonb;
begin
  perform private.assert_admin_permission('admin.overview.read');
  if p_platform is null or p_platform not in ('all','ios','android') or p_days is null or p_days not in (7,30,90) then
    raise exception using errcode='22023',message='REPORT_ADMIN_FILTER_INVALID'; end if;
  select value#>>'{}' into tz from private.system_settings where setting_key='reports.reporting_timezone';
  -- Invalid settings fail explicitly instead of silently changing the reporting report_day.
  today:=(observed at time zone tz)::date; first_day:=today-(p_days-1); starts:=first_day::timestamp at time zone tz;
  select started_at into collection from private.mobile_activity_collection;
  with devices as (
    select d.user_id,bool_or(platform='ios') ios,bool_or(platform='android') android,
      count(*) filter(where platform='ios') ios_count,count(*) filter(where platform='android') android_count
    from public.user_devices d where revoked_at is null and platform in ('ios','android') group by d.user_id
  ), customers as (
    select p.*,coalesce(d.ios,false) ios,coalesce(d.android,false) android,coalesce(d.ios_count,0) ios_count,coalesce(d.android_count,0) android_count
    from public.profiles p left join devices d on d.user_id=p.id where p.status<>'deleted'
      and (p_platform='all' or (p_platform='ios' and d.ios) or (p_platform='android' and d.android))
  ) select jsonb_build_object(
    'totalUsers',count(*),'newUsers',count(*) filter(where created_at>=starts and created_at<=observed),
    'iosUsers',count(*) filter(where ios),'androidUsers',count(*) filter(where android),'bothUsers',count(*) filter(where ios and android),
    'unknownUsers',count(*) filter(where not ios and not android),
    'newIosUsers',count(*) filter(where ios and created_at>=starts and created_at<=observed),
    'newAndroidUsers',count(*) filter(where android and created_at>=starts and created_at<=observed),
    'newBothUsers',count(*) filter(where ios and android and created_at>=starts and created_at<=observed),
    'newUnknownUsers',count(*) filter(where not ios and not android and created_at>=starts and created_at<=observed),
    'iosDevices',case when p_platform='android' then 0 else coalesce(sum(ios_count),0) end,
    'androidDevices',case when p_platform='ios' then 0 else coalesce(sum(android_count),0) end
  ) into result from customers;
  with days as (select first_day+g report_day from generate_series(0,p_days-1) g),
  events as (
    select a.* from private.mobile_activity_buckets a join public.profiles p on p.id=a.user_id
    where p.status<>'deleted' and a.observed_at>=collection and a.observed_at<=observed
      and a.observed_at>=((first_day-29)::timestamp at time zone tz)
      and (p_platform='all' or a.platform=p_platform)
  ), points as (
    select d.report_day,d.report_day::timestamp at time zone tz stamp,
      case when d.report_day<(collection at time zone tz)::date then null else
        (select count(distinct e.user_id) from events e where (e.observed_at at time zone tz)::date=d.report_day) end daily,
      case when d.report_day<(collection at time zone tz)::date then null else
        (select count(distinct e.user_id) from events e where (e.observed_at at time zone tz)::date between d.report_day-29 and d.report_day) end monthly
    from days d
  ) select jsonb_build_object(
    'total',(select count(distinct user_id) from events where observed_at>=starts),
    'ios',(select count(distinct user_id) from events where observed_at>=starts and platform='ios'),
    'android',(select count(distinct user_id) from events where observed_at>=starts and platform='android'),
    'daily',jsonb_agg(jsonb_build_object('timestamp',stamp,'value',daily) order by report_day),
    'monthly',jsonb_agg(jsonb_build_object('timestamp',stamp,'value',monthly) order by report_day)
  ) into activity from points;
  with days as (select first_day+g report_day from generate_series(0,p_days-1) g), daily as (
    select (p.created_at at time zone tz)::date report_day,count(*) total from public.profiles p
    where p.status<>'deleted' and p.created_at>=starts and p.created_at<=observed
      and (p_platform='all' or exists(select 1 from public.user_devices u where u.user_id=p.id and u.revoked_at is null and u.platform=p_platform))
    group by (p.created_at at time zone tz)::date
  ) select jsonb_agg(jsonb_build_object('timestamp',d.report_day::timestamp at time zone tz,'value',coalesce(n.total,0)) order by d.report_day)
    into growth from days d left join daily n using(report_day);
  with distribution as (
    select d.platform,coalesce(nullif(d.app_version,''),'unknown') version,count(*) device_count
    from public.user_devices d join public.profiles p on p.id=d.user_id
    where p.status<>'deleted' and d.revoked_at is null and d.platform in ('ios','android') and (p_platform='all' or d.platform=p_platform)
    group by d.platform,coalesce(nullif(d.app_version,''),'unknown')
  ), ranked as (select *,row_number() over(partition by platform order by device_count desc,version) rank from distribution),
  bounded as (select platform,case when rank<=24 then version else 'other-versions' end version,sum(device_count) device_count from ranked group by platform,case when rank<=24 then version else 'other-versions' end)
  select coalesce(jsonb_agg(jsonb_build_object('platform',platform,'version',version,'deviceCount',device_count,
    'share',device_count::numeric/total,'supportState','unknown','unattributed',version='unknown') order by device_count desc,platform,version),'[]'::jsonb)
    into versions from (select *,sum(device_count) over() total from bounded) v;
  with days as (select first_day+g report_day from generate_series(0,p_days-1) g), daily as (
    select (i.created_at at time zone tz)::date report_day,count(*) total from public.import_items i
    where i.created_at>=starts and i.created_at<=observed group by (i.created_at at time zone tz)::date
  ) select jsonb_agg(jsonb_build_object('timestamp',d.report_day::timestamp at time zone tz,'value',coalesce(n.total,0)) order by d.report_day)
    into import_volume from days d left join daily n using(report_day);
  -- These sources do not record the originating OS; report global totals explicitly.
  select jsonb_build_array(
    (select jsonb_build_object('id','imports','kind','imports','platformScope','global','total',count(*),'successful',count(*) filter(where status='accepted'),'failed',count(*) filter(where status='failed')) from public.import_items where created_at>=starts and created_at<=observed),
    (select jsonb_build_object('id','ai-usage','kind','requests','platformScope','global','total',count(*),'successful',count(*) filter(where reservation_status='completed'),'failed',count(*) filter(where reservation_status='failed')) from private.ai_usage_events where created_at>=starts and created_at<=observed and workload<>'admin_support'),
    (select jsonb_build_object('id','support-tickets','kind','tickets','platformScope','global','total',count(*)) from public.support_tickets where created_at>=starts and created_at<=observed)
  ) into operations;
  return result||jsonb_build_object('observedAt',observed,'timezone',tz,'periodStart',starts,'periodEnd',observed,
    'collectionStartedAt',collection,'retentionDays',120,'activity',activity,'growth',growth,'importVolume',import_volume,'versions',versions,'operations',operations);
end $$;
alter function private.read_admin_report_measurements(text,integer) owner to masarifi_migration;
revoke all on function private.read_admin_report_measurements(text,integer) from public;
grant execute on function private.read_admin_report_measurements(text,integer) to masarifi_api;

-- Same transaction effects as the canonical report summary, with exact local date boundaries.
create or replace function private.read_supported_financial_report(p_target_user_id text,p_start date,p_end date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare grant_id uuid; result jsonb; tz text; preferred text; ledger_version bigint;
begin
  if p_start is null or p_end is null or p_end<p_start or p_end>=p_start+interval '1 year' then raise exception using errcode='22023',message='REPORT_PERIOD_INVALID'; end if;
  grant_id:=private.assert_support_grant(p_target_user_id,'financial-report','read-aggregate');
  select p.timezone,coalesce(u.default_currency,'SAR') into tz,preferred from public.profiles p left join public.user_preferences u on u.user_id=p.id where p.id=p_target_user_id;
  select coalesce(max(b.ledger_version),0) into ledger_version from public.accounts a join public.account_balances b on b.account_id=a.id where a.user_id=p_target_user_id;
  with effects as (
    select t.currency_code,case when t.kind='income' then t.amount_minor else 0 end income_minor,
      case when t.kind='expense' then t.amount_minor+t.fee_minor when t.kind='refund' then -t.amount_minor when t.fee_minor>0 then t.fee_minor else 0 end expense_minor
    from public.transactions t where t.user_id=p_target_user_id and t.status='confirmed' and t.deleted_at is null
      and t.occurred_at >= (p_start::timestamp at time zone tz) and t.occurred_at < ((p_end+1)::timestamp at time zone tz)
      and (t.kind in ('income','expense','refund') or t.fee_minor>0)
  ), sums as (
    select currency_code,sum(income_minor)::bigint income_minor,sum(expense_minor)::bigint expense_minor,
      (sum(income_minor)-sum(expense_minor))::bigint net_cash_flow_minor,count(*) transaction_count from effects group by currency_code
  ) select jsonb_build_object('adminAggregate',true,'supportGrantId',grant_id,'ledgerVersion',ledger_version,'timezone',tz,
    'currencyCode',case when count(*)=1 then min(currency_code) else preferred end,
    'currencyMinorUnits',(select jsonb_object_agg(code,minor_unit) from public.currencies),
    'summaries',coalesce(jsonb_agg(to_jsonb(s) order by currency_code),'[]'::jsonb)) into result from sums s;
  return result;
end $$;

create or replace function private.read_admin_overview_activity(p_platform text,p_days integer,p_offset integer,p_limit integer)
returns table(id text,event_type text,summary text,occurred_at timestamptz,platform_scope text,permission text,destination text,total_count bigint)
language plpgsql security definer set search_path='' as $$
declare tz text; starts timestamptz;
begin
  perform private.assert_admin_permission('admin.overview.read');
  if p_platform is null or p_platform not in ('all','ios','android') or p_days is null or p_days not in (7,30,90) or p_offset<0 or p_limit not between 1 and 25 then
    raise exception using errcode='22023',message='REPORT_ADMIN_FILTER_INVALID'; end if;
  select value#>>'{}' into tz from private.system_settings where setting_key='reports.reporting_timezone';
  starts:=(((statement_timestamp() at time zone tz)::date-(p_days-1))::timestamp at time zone tz);
  return query with mapped as (
    select e.id::text,e.occurred_at,
      case when e.action like 'parser.%' then 'parser-rule-update'
        when e.action in ('security.assign-admin-role','security.revoke-admin-role','admin.role_assigned','admin.role_revoked') then 'admin-role-change'
        when e.action in ('security.create-support-access-request','support_access.requested') then 'support-access-requested'
        when e.action in ('security.decide-support-access-request','security.decide-my-support-access-request') then 'support-access-decision'
        when e.action='support_access.granted' then 'support-access-approval'
        when e.action in ('security.revoke-support-access','security.end-support-access','security.support-access-expired','support_access.revoked') then 'support-access-revoked'
        when e.action in ('security.create-my-deletion-request','privacy.deletion_requested') then 'account-deletion-requested'
        when e.action='security.cancel-my-deletion-request' then 'account-deletion-cancelled'
      end event_type,
      case when e.metadata->>'platform' in ('ios','android') then e.metadata->>'platform' else 'global' end platform_scope
    from audit.audit_events e where e.occurred_at>=starts and e.occurred_at<=statement_timestamp()
  ), activity as (
    select m.id,m.event_type,
      case m.event_type when 'parser-rule-update' then 'Parser configuration changed.'
        when 'admin-role-change' then 'Administrative role assignment changed.'
        when 'support-access-requested' then 'Support access requested.'
        when 'support-access-decision' then 'Support access decision recorded.'
        when 'support-access-approval' then 'Support access granted.'
        when 'support-access-revoked' then 'Support access ended or revoked.'
        when 'account-deletion-requested' then 'Account deletion requested.'
        when 'account-deletion-cancelled' then 'Account deletion cancelled.' end summary,
      m.occurred_at,m.platform_scope,
      case when m.event_type='parser-rule-update' then 'imports.read' else 'admin.overview.read' end permission,
      case when m.event_type='parser-rule-update' then '/admin/imports' else '/admin' end destination
    from mapped m where m.event_type is not null
    union all
    select 'deletion:'||d.id::text,'account-deletion-completed','Account deletion completed.',d.completed_at,'global','admin.overview.read','/admin'
    from private.account_deletion_requests d where d.status='completed' and d.completed_at>=starts and d.completed_at<=statement_timestamp()
  ), filtered as (select * from activity a where p_platform='all' or a.platform_scope in (p_platform,'global'))
  select a.id,a.event_type,a.summary,a.occurred_at,a.platform_scope,a.permission,a.destination,count(*) over()::bigint
    from filtered a order by a.occurred_at desc,a.id desc offset p_offset limit p_limit;
end $$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
