grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Only these optional numeric policies may store JSON null (no monthly limit).
alter table private.system_settings drop constraint system_settings_value_check;
alter table private.system_settings add constraint system_settings_value_check check(
  (jsonb_typeof(value) in ('object','array','string','number','boolean')
    or (setting_key in ('ai.chat.monthly_limit','ai.voice.monthly_limit') and value='null'::jsonb))
  and pg_catalog.octet_length(value::text)<=4096);

-- Preserve deployed defaults and caps. These independent keys no longer share counters.
insert into private.system_settings(setting_key,value,sensitivity)
select 'ai.'||feature||'.'||suffix,
  case suffix when 'rolling_limit' then coalesce((select value from private.system_settings where setting_key='ai.user.rolling_limit'),'5'::jsonb)
    when 'monthly_limit' then 'null'::jsonb when 'enabled' then 'true'::jsonb else '{}'::jsonb end,'internal'
from unnest(array['chat','voice']) feature cross join unnest(array['rolling_limit','monthly_limit','enabled','user_override']) suffix
on conflict(setting_key) do nothing;

create table private.ai_user_quota_overrides (
  user_id text not null references public.profiles(id) on delete cascade,
  workload text not null check(workload in ('financial_assistant','voice_transcription')),
  rolling_limit integer check(rolling_limit between 1 and 1000),
  monthly_limit integer check(monthly_limit between 1 and 1000000),
  primary key(user_id,workload)
);
alter table private.ai_user_quota_overrides enable row level security;
revoke all on private.ai_user_quota_overrides from public,anon,authenticated,masarifi_api,masarifi_worker;
-- Carry forward the existing, authorized Staging owner allowance without changing it.
insert into private.ai_user_quota_overrides(user_id,workload,rolling_limit)
select p.id,'voice_transcription',(s.value->>'limit')::integer from private.system_settings s
join public.profiles p on encode(pg_catalog.sha256(pg_catalog.convert_to(p.id,'UTF8')),'hex')=s.value->>'ownerFingerprint'
where s.setting_key='ai.voice.staging_owner_quota' and s.value->>'scope'='staging'
  and s.value->'limit'='30'::jsonb;

create function private.ai_quota_policy(p_user_id text,p_workload text) returns jsonb
language sql stable security invoker set search_path='' as $$
  with feature as (select case p_workload when 'financial_assistant' then 'chat' when 'voice_transcription' then 'voice' end name)
  select jsonb_build_object('limit',coalesce(o.rolling_limit,(select (value#>>'{}')::integer from private.system_settings where setting_key='ai.'||f.name||'.rolling_limit'),
      (select (value#>>'{}')::integer from private.system_settings where setting_key='ai.user.rolling_limit'),5),
    'monthlyLimit',coalesce(o.monthly_limit,(select (value#>>'{}')::integer from private.system_settings where setting_key='ai.'||f.name||'.monthly_limit')),
    'enabled',coalesce((select (value#>>'{}')::boolean from private.system_settings where setting_key='ai.'||f.name||'.enabled'),true),
    'override',jsonb_build_object('rollingLimit',o.rolling_limit,'monthlyLimit',o.monthly_limit))
  from feature f left join private.ai_user_quota_overrides o on o.user_id=p_user_id and o.workload=p_workload;
$$;
revoke all on function private.ai_quota_policy(text,text) from public;

create or replace function private.ai_effective_rolling_limit(p_user_id text,p_workload text)
returns integer language sql stable security invoker set search_path='' as $$
  select (private.ai_quota_policy(p_user_id,p_workload)->>'limit')::integer;
$$;

create function private.ai_quota_snapshot(p_user_id text,p_workload text) returns jsonb
language sql stable security invoker set search_path='' as $$
  with policy as(select private.ai_quota_policy(p_user_id,p_workload) p),
  month as(select date_trunc('month',statement_timestamp() at time zone 'UTC') at time zone 'UTC' start),
  usage as(select count(*) filter(where created_at>statement_timestamp()-interval '24 hours') used,
    min(created_at) filter(where created_at>statement_timestamp()-interval '24 hours') first_time,
    count(*) filter(where created_at>=month.start) monthly_used,
    coalesce(sum(estimated_cost) filter(where created_at>=month.start),0) cost
    from private.ai_usage_events cross join month where user_id=p_user_id and workload=p_workload and reservation_status<>'released')
  select p||jsonb_build_object('used',used,'remaining',greatest(0,(p->>'limit')::integer-used),
    'resetsAt',coalesce(first_time,statement_timestamp())+interval '24 hours','windowHours',24,
    'monthlyUsed',monthly_used,'monthlyRemaining',case when p->>'monthlyLimit' is null then null else greatest(0,(p->>'monthlyLimit')::integer-monthly_used) end,
    'monthlyResetsAt',month.start+interval '1 month','estimatedCostUsd',cost)
  from policy cross join usage cross join month;
$$;
revoke all on function private.ai_quota_snapshot(text,text) from public;

create function private.validate_ai_usage_setting(p_key text,p_value jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_key in ('ai.user.rolling_limit','ai.chat.rolling_limit','ai.voice.rolling_limit') then
    return jsonb_typeof(p_value)='number' and p_value#>>'{}' ~ '^([1-9][0-9]{0,2}|1000)$';
  elsif p_key in ('ai.chat.monthly_limit','ai.voice.monthly_limit') then
    return p_value='null'::jsonb or (jsonb_typeof(p_value)='number' and p_value#>>'{}' ~ '^[1-9][0-9]{0,6}$' and (p_value#>>'{}')::numeric<=1000000);
  elsif p_key in ('ai.chat.enabled','ai.voice.enabled') then return jsonb_typeof(p_value)='boolean';
  elsif p_key='ai.global.monthly_budget' then
    return jsonb_typeof(p_value)='number' and (p_value#>>'{}')::numeric between 0.01 and 1000000;
  elsif p_key in ('ai.chat.user_override','ai.voice.user_override') then
    return jsonb_typeof(p_value)='object' and private.jsonb_object_key_count(p_value)=3
      and p_value ?& array['userId','rollingLimit','monthlyLimit']
      and jsonb_typeof(p_value->'userId')='string' and p_value->>'userId' ~ '^[A-Za-z0-9_-]{1,128}$'
      and exists(select 1 from public.profiles where id=p_value->>'userId' and status='active')
      and (p_value->'rollingLimit'='null'::jsonb or private.validate_ai_usage_setting('ai.chat.rolling_limit',p_value->'rollingLimit'))
      and private.validate_ai_usage_setting('ai.chat.monthly_limit',p_value->'monthlyLimit');
  end if;
  return false;
end $$;
revoke all on function private.validate_ai_usage_setting(text,jsonb) from public;

-- Extend only the existing governed command, retaining its audit, permission,
-- optimistic concurrency and idempotency implementation.
do $migration$
declare definition text:=replace(pg_get_functiondef('private.execute_operations_command(text,text,jsonb,text,text,text)'::regprocedure),E'\r\n',E'\n');
  branch text:=$needle$    select version into current_version from private.system_settings where setting_key=p_resource_key for update;$needle$;
  allowance text:=$needle$(setting_key='operations.ai.allowance' and p_body->'value'='5'::jsonb)$needle$;
  audit_tail text:=$needle$'version',result->>'version'));$needle$;
begin
  if strpos(definition,'validate_ai_usage_setting')>0 or strpos(definition,branch)=0 or strpos(definition,allowance)=0 or strpos(definition,audit_tail)=0 then
    raise exception 'AI_USAGE_GOVERNANCE_BASELINE_MISMATCH';
  end if;
  definition:=replace(definition,'declare permission_key text;','declare previous_setting jsonb; permission_key text;');
  definition:=replace(definition,'  request_hash:=', $guard$  if p_operation='updateSetting' and (p_resource_key like 'ai.chat.%' or p_resource_key like 'ai.voice.%' or p_resource_key in ('ai.user.rolling_limit','ai.global.monthly_budget')) then
    perform private.assert_admin_permission('ai.routes.manage');
    if not coalesce(private.validate_ai_usage_setting(p_resource_key,p_body->'value'),false) then
      raise exception using errcode='22023',message='OPERATIONS_SETTING_VALUE_INVALID';
    end if;
  end if;
  request_hash:=$guard$);
  definition:=replace(definition,branch,replace(branch,'select version into current_version','select version,value into current_version,previous_setting'));
  definition:=replace(definition,replace(branch,'select version into current_version','select version,value into current_version,previous_setting'),
    replace(branch,'select version into current_version','select version,value into current_version,previous_setting')||$before$
    if p_resource_key in ('ai.chat.user_override','ai.voice.user_override') then
      select jsonb_build_object('userId',p_body->'value'->>'userId','rollingLimit',o.rolling_limit,'monthlyLimit',o.monthly_limit)
      into previous_setting from (select 1) anchor left join private.ai_user_quota_overrides o
        on o.user_id=p_body->'value'->>'userId' and o.workload=case p_resource_key when 'ai.chat.user_override' then 'financial_assistant' else 'voice_transcription' end;
    end if;$before$);
  definition:=replace(definition,allowance,'private.validate_ai_usage_setting(setting_key,p_body->''value'') or '||allowance);
  definition:=replace(definition,$needle$    if result is null then raise exception using errcode='22023',message='OPERATIONS_SETTING_VALUE_INVALID'; end if;$needle$,
    $append$    if result is null then raise exception using errcode='22023',message='OPERATIONS_SETTING_VALUE_INVALID'; end if;
    if p_resource_key in ('ai.chat.user_override','ai.voice.user_override') then
      if p_body->'value'->>'rollingLimit' is null and p_body->'value'->>'monthlyLimit' is null then
        delete from private.ai_user_quota_overrides where user_id=p_body->'value'->>'userId'
          and workload=case p_resource_key when 'ai.chat.user_override' then 'financial_assistant' else 'voice_transcription' end;
      else
        insert into private.ai_user_quota_overrides(user_id,workload,rolling_limit,monthly_limit)
        values(p_body->'value'->>'userId',case p_resource_key when 'ai.chat.user_override' then 'financial_assistant' else 'voice_transcription' end,
          (p_body->'value'->>'rollingLimit')::integer,(p_body->'value'->>'monthlyLimit')::integer)
        on conflict(user_id,workload) do update set rolling_limit=excluded.rolling_limit,monthly_limit=excluded.monthly_limit;
      end if;
    end if;$append$);
  definition:=replace(definition,audit_tail,$audit$'version',result->>'version') || case when p_operation='updateSetting' and coalesce(private.validate_ai_usage_setting(p_resource_key,p_body->'value'),false)
    then jsonb_build_object('before',previous_setting::text,'after',(p_body->'value')::text) else '{}'::jsonb end);$audit$);
  execute definition;
end $migration$;

-- Preserve price reservations, budget locks and dispatch accounting while
-- isolating request counts and enforcing monthly/per-feature admission.
do $migration$
declare definition text:=replace(pg_get_functiondef('private.reserve_ai_quota(text,uuid,text)'::regprocedure),E'\r\n',E'\n');
  count_query text:=$needle$  select count(*),min(created_at) into used_count,first_time from private.ai_usage_events$needle$;
begin
  if strpos(definition,'AI_MONTHLY_QUOTA_EXCEEDED')>0 or strpos(definition,count_query)=0 then raise exception 'AI_USAGE_ADMISSION_BASELINE_MISMATCH'; end if;
  definition:=replace(definition,'declare used_count integer;','declare quota jsonb; used_count integer;');
  definition:=replace(definition,'rolling_window:=make_interval(hours=>rolling_hours);',
    'if p_workload in (''financial_assistant'',''voice_transcription'') then rolling_hours:=24; end if; rolling_window:=make_interval(hours=>rolling_hours);');
  definition:=replace(definition,'where user_id=p_user_id and created_at>','where user_id=p_user_id and workload=p_workload and created_at>');
  definition:=replace(definition,'  if found then', $guard$  if found then
    if existing.user_id is distinct from p_user_id or existing.workload is distinct from p_workload then
      raise exception using errcode='42501',message='AI_QUOTA_OPERATION_OWNER_MISMATCH';
    end if;$guard$);
  -- The normal-admission count has two spaces; the replay branch has four.
  definition:=replace(definition,E'\n'||count_query,E'\n'||$guard$  select * into existing from private.ai_usage_events where request_id=p_operation_id::text;
  if found then
    if existing.user_id is distinct from p_user_id or existing.workload is distinct from p_workload then raise exception using errcode='42501',message='AI_QUOTA_OPERATION_OWNER_MISMATCH'; end if;
    return private.ai_quota_snapshot(p_user_id,p_workload)||jsonb_build_object('allowed',true,'replayed',true);
  end if;
  quota:=private.ai_quota_snapshot(p_user_id,p_workload);
  if not (quota->>'enabled')::boolean then return quota||jsonb_build_object('allowed',false,'reason','AI_FEATURE_DISABLED'); end if;
  if quota->>'monthlyLimit' is not null and (quota->>'monthlyUsed')::integer >= (quota->>'monthlyLimit')::integer then
    return quota||jsonb_build_object('allowed',false,'reason','AI_MONTHLY_QUOTA_EXCEEDED','resetsAt',quota->'monthlyResetsAt');
  end if;
$guard$||count_query);
  execute definition;
end $migration$;

create or replace function private.get_assistant_availability(p_user_id text,p_policy_version text default 'assistant-privacy-v1')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare quota jsonb; consented boolean; available boolean;
begin
  perform private.ai_assert_owner(p_user_id);
  quota:=private.ai_quota_snapshot(p_user_id,'financial_assistant');
  select exists(select 1 from public.assistant_consents where user_id=p_user_id and policy_version=p_policy_version and revoked_at is null) into consented;
  available:=private.ai_workload_available('financial_assistant') and (quota->>'enabled')::boolean;
  return jsonb_build_object('status',case when not consented or not available then 'disabled'
    when (quota->>'remaining')::integer=0 or quota->>'monthlyRemaining'='0' then 'limit_reached' else 'available' end,
    'limit',quota->'limit','used',quota->'used','remaining',case when quota->>'monthlyRemaining'='0' then '0'::jsonb else quota->'remaining' end,
    'resetsAt',case when quota->>'monthlyRemaining'='0' then quota->'monthlyResetsAt' else quota->'resetsAt' end);
end $$;

create function private.read_ai_usage_limits(p_user_id text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare settings jsonb; features jsonb; history jsonb:='[]'; selected text:=coalesce(p_user_id,public.current_clerk_user_id()); project_cost numeric;
begin
  perform private.assert_admin_permission('operations.settings.read');
  if not exists(select 1 from public.profiles where id=selected and status='active') then raise exception using errcode='P0002',message='AI_USAGE_USER_NOT_FOUND'; end if;
  select jsonb_agg(jsonb_build_object('key',setting_key,'value',value,'version',version) order by setting_key) into settings
    from private.system_settings where setting_key in ('ai.user.rolling_limit','ai.global.monthly_budget',
      'ai.chat.rolling_limit','ai.voice.rolling_limit','ai.chat.monthly_limit','ai.voice.monthly_limit',
      'ai.chat.enabled','ai.voice.enabled','ai.chat.user_override','ai.voice.user_override');
  select jsonb_agg(private.ai_quota_snapshot(selected,workload)||jsonb_build_object('feature',feature,
    'routeEnabled',private.ai_workload_available(workload))) into features
    from (values ('chat','financial_assistant'),('voice','voice_transcription')) f(feature,workload);
  select coalesce(sum(estimated_cost),0) into project_cost from private.ai_usage_events
    where budget_period=date_trunc('month',current_date)::date and reservation_status in ('reserved','completed','failed');
  begin
    perform private.assert_admin_permission('audit.read');
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'key',resource_id,'at',occurred_at,'actorId',actor_id,'reason',reason,'before',metadata->'before','after',metadata->'after') order by occurred_at desc),'[]') into history
    from (select * from audit.audit_events where action='operations.setting.update' and resource_id in
      ('ai.user.rolling_limit','ai.global.monthly_budget','ai.chat.rolling_limit','ai.voice.rolling_limit',
       'ai.chat.monthly_limit','ai.voice.monthly_limit','ai.chat.enabled','ai.voice.enabled','ai.chat.user_override','ai.voice.user_override') order by occurred_at desc,id desc limit 20) events;
  exception when insufficient_privilege then history:='[]'; end;
  return jsonb_build_object('userId',selected,'settings',settings,'features',features,'projectEstimatedCostUsd',project_cost,
    'monthlyProjectResetsAt',(date_trunc('month',statement_timestamp() at time zone 'UTC') at time zone 'UTC')+interval '1 month',
    'history',history,'directReadsConsumeQuota',false);
end $$;
revoke all on function private.read_ai_usage_limits(text) from public;
grant execute on function private.read_ai_usage_limits(text) to masarifi_api;

reset role;
revoke masarifi_migration from current_user granted by current_user;
