grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Relative support dates are resolved only after authorization, in the target timezone.
create function private.read_supported_financial_report_relative(p_target_user_id text,p_days integer,p_observed timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text; starts date; ends date; result jsonb;
begin
  if p_days is null or p_days not in (7,30,90) or p_observed is null or not isfinite(p_observed) then
    raise exception using errcode='22023',message='REPORT_PERIOD_INVALID'; end if;
  perform private.assert_support_grant(p_target_user_id,'financial-report','read-aggregate');
  select timezone into tz from public.profiles where id=p_target_user_id;
  ends:=(p_observed at time zone tz)::date; starts:=ends-(p_days-1);
  result:=private.read_supported_financial_report(p_target_user_id,starts,ends);
  return result||jsonb_build_object('startDate',starts,'endDate',ends,'observedAt',p_observed,
    'periodStart',starts::timestamp at time zone tz,'periodEndExclusive',(ends+1)::timestamp at time zone tz);
end $$;
alter function private.read_supported_financial_report_relative(text,integer,timestamptz) owner to masarifi_migration;
revoke all on function private.read_supported_financial_report_relative(text,integer,timestamptz) from public;
grant execute on function private.read_supported_financial_report_relative(text,integer,timestamptz) to masarifi_api;

-- One bounded read with a fixed observed-through instant; never page mutable audit offsets.
create function private.read_admin_overview_activity_at(p_platform text,p_days integer,p_limit integer,p_observed timestamptz)
returns table(id text,event_type text,summary text,occurred_at timestamptz,platform_scope text,permission text,destination text,total_count bigint)
language plpgsql security definer set search_path='' as $$
declare tz text; starts timestamptz;
begin
  perform private.assert_admin_permission('admin.overview.read');
  if p_platform is null or p_platform not in ('all','ios','android') or p_days is null or p_days not in (7,30,90) or p_observed is null or not isfinite(p_observed) or p_observed>statement_timestamp() or p_limit not between 1 and 10001 then
    raise exception using errcode='22023',message='REPORT_ADMIN_FILTER_INVALID'; end if;
  select value#>>'{}' into tz from private.system_settings where setting_key='reports.reporting_timezone';
  starts:=(((p_observed at time zone tz)::date-(p_days-1))::timestamp at time zone tz);
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
    from audit.audit_events e where e.occurred_at>=starts and e.occurred_at<=p_observed
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
    from private.account_deletion_requests d where d.status='completed' and d.completed_at>=starts and d.completed_at<=p_observed
  ), filtered as (select * from activity a where p_platform='all' or a.platform_scope in (p_platform,'global'))
  select a.id,a.event_type,a.summary,a.occurred_at,a.platform_scope,a.permission,a.destination,count(*) over()::bigint
    from filtered a order by a.occurred_at desc,a.id desc limit p_limit;
end $$;


alter function private.read_admin_overview_activity_at(text,integer,integer,timestamptz) owner to masarifi_migration;
revoke all on function private.read_admin_overview_activity_at(text,integer,integer,timestamptz) from public;
grant execute on function private.read_admin_overview_activity_at(text,integer,integer,timestamptz) to masarifi_api;
reset role;
revoke masarifi_migration from current_user granted by current_user;
