-- Inert by default everywhere. The authorized Staging migration connection may
-- bind the target owner before this forward migration; application roles cannot.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

insert into private.system_settings(setting_key,value,sensitivity)
values('ai.voice.staging_owner_quota','{}','internal')
on conflict(setting_key) do nothing;

do $$
declare target text:=nullif(current_setting('masarifi.migration_target',true),'');
  fingerprint text:=current_setting('masarifi.staging_voice_owner_hash',true);
begin
  if target is not null and target<>'staging' then
    raise exception using errcode='22023',message='STAGING_QUOTA_TARGET_INVALID';
  end if;
  if target='staging' then
    if fingerprint is null or fingerprint !~ '^[a-f0-9]{64}$'
      or (select count(*) from public.profiles where status='active' and
        encode(pg_catalog.sha256(pg_catalog.convert_to(id,'UTF8')),'hex')=fingerprint)<>1
      or (select value from private.system_settings where setting_key='ai.user.rolling_limit') is distinct from '5'::jsonb
      or (select value from private.system_settings where setting_key='ai.user.rolling_hours') is distinct from '24'::jsonb
      or (select value from private.system_settings where setting_key='ai.global.monthly_budget') is distinct from '2'::jsonb then
      raise exception using errcode='22023',message='STAGING_QUOTA_BINDING_INVALID';
    end if;
    update private.system_settings set value=jsonb_build_object(
      'scope','staging','ownerFingerprint',fingerprint,'limit',30)
      where setting_key='ai.voice.staging_owner_quota' and value='{}'::jsonb;
    if not found then
      raise exception using errcode='22023',message='STAGING_QUOTA_ALREADY_CONFIGURED';
    end if;
  end if;
end $$;

create function private.ai_effective_rolling_limit(p_user_id text,p_workload text)
returns integer language sql stable security invoker set search_path='' as $$
  select case when p_workload='voice_transcription' and exists(
    select 1 from private.system_settings where setting_key='ai.voice.staging_owner_quota'
      and value->>'scope'='staging' and value->'limit'='30'::jsonb
      and value->>'ownerFingerprint'=encode(pg_catalog.sha256(pg_catalog.convert_to(p_user_id,'UTF8')),'hex')
  ) then 30 else coalesce((select (value#>>'{}')::integer from private.system_settings
    where setting_key='ai.user.rolling_limit'),5) end;
$$;
alter function private.ai_effective_rolling_limit(text,text) owner to masarifi_migration;
revoke all on function private.ai_effective_rolling_limit(text,text) from public;

-- Existing admission implementation follows with only its limit lookup changed.
create or replace function private.reserve_ai_quota(p_user_id text,p_operation_id uuid,p_workload text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare used_count integer; first_time timestamptz; existing private.ai_usage_events%rowtype;
  route_row private.ai_feature_routes%rowtype; spent numeric; global_spent numeric; reservation numeric;
  budget numeric; global_budget numeric; percent integer; crossed smallint[]; threshold smallint;
  rolling_limit integer; rolling_hours integer; rolling_window interval;
begin
  perform private.ai_assert_owner(p_user_id);
  select private.ai_effective_rolling_limit(p_user_id,p_workload),
    coalesce((select (value#>>'{}')::integer from private.system_settings where setting_key='ai.user.rolling_hours'),24),
    coalesce((select (value#>>'{}')::numeric from private.system_settings where setting_key='ai.global.monthly_budget'),200)
    into rolling_limit,rolling_hours,global_budget;
  if rolling_limit not between 1 and 1000 or rolling_hours not between 1 and 720 or global_budget<=0 then
    raise exception using errcode='55000',message='AI_QUOTA_CONFIG_INVALID';
  end if;
  rolling_window:=make_interval(hours=>rolling_hours);
  select * into existing from private.ai_usage_events where request_id=p_operation_id::text;
  if found then
    select count(*),min(created_at) into used_count,first_time from private.ai_usage_events
      where user_id=p_user_id and created_at>clock_timestamp()-rolling_window and reservation_status<>'released';
    return jsonb_build_object('allowed',true,'limit',rolling_limit,'used',used_count,
      'resetsAt',coalesce(first_time,clock_timestamp())+rolling_window,'replayed',true);
  end if;
  if p_workload not in ('voice_transcription','financial_assistant','transaction_classification') then
    raise exception using errcode='22023',message='AI_WORKLOAD_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai-quota:'||p_user_id,0));
  perform pg_advisory_xact_lock(hashtextextended('ai-budget:global:'||date_trunc('month',current_date)::date,0));
  perform pg_advisory_xact_lock(hashtextextended('ai-budget:'||p_workload||':'||date_trunc('month',current_date)::date,0));
  select count(*),min(created_at) into used_count,first_time from private.ai_usage_events
    where user_id=p_user_id and created_at>clock_timestamp()-rolling_window and reservation_status<>'released';
  if used_count>=rolling_limit then
    return jsonb_build_object('allowed',false,'limit',rolling_limit,'used',used_count,
      'resetsAt',coalesce(first_time,clock_timestamp())+rolling_window,'replayed',false);
  end if;
  select * into route_row from private.ai_feature_routes where workload=p_workload and deleted_at is null;
  if not found then raise exception using errcode='55000',message='AI_ROUTE_UNAVAILABLE'; end if;
  budget:=(route_row.limits->>'monthlyBudget')::numeric;
  reservation:=((route_row.limits->>'inputTokens')::numeric*(route_row.max_price->>'prompt')::numeric)
    +((route_row.limits->>'outputTokens')::numeric*(route_row.max_price->>'completion')::numeric);
  select coalesce(sum(estimated_cost),0) into spent from private.ai_usage_events
    where workload=p_workload and budget_period=date_trunc('month',current_date)::date and reservation_status in ('reserved','completed','failed');
  select coalesce(sum(estimated_cost),0) into global_spent from private.ai_usage_events
    where budget_period=date_trunc('month',current_date)::date and reservation_status in ('reserved','completed','failed');
  if budget<=0 or spent+reservation>=budget or global_spent+reservation>=global_budget then
    return jsonb_build_object('allowed',false,'limit',rolling_limit,'used',used_count,
      'resetsAt',coalesce(first_time,clock_timestamp())+rolling_window,'replayed',false,'reason','AI_BUDGET_EXHAUSTED');
  end if;
  percent:=floor(((spent+reservation)/budget)*100);
  crossed:=array(select candidate::smallint from unnest(array[70,85,95]) candidate
    where spent/budget*100<candidate and percent>=candidate and not exists(
      select 1 from private.ai_usage_events prior where prior.workload=p_workload
        and prior.budget_period=date_trunc('month',current_date)::date and candidate=any(prior.threshold_events)));
  insert into private.ai_usage_events(user_id,workload,model,provider,request_id,estimated_cost,threshold_events)
  values(p_user_id,p_workload,'pending','pending',p_operation_id::text,reservation,crossed);
  foreach threshold in array crossed loop
    perform private.enqueue_outbox_event('ai.budget_threshold.v1','ai-budget',p_operation_id,
      jsonb_build_object('workload',p_workload,'period',date_trunc('month',current_date)::date,'threshold',threshold,'occurredAt',clock_timestamp()));
  end loop;
  return jsonb_build_object('allowed',true,'limit',rolling_limit,'used',used_count+1,
    'resetsAt',coalesce(first_time,clock_timestamp())+rolling_window,'replayed',false,'reservedCost',reservation);
end $$;
reset role;
revoke masarifi_migration from current_user;
