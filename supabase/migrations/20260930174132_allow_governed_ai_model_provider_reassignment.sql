grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create or replace function private.mutate_admin_ai(p_resource text,p_id uuid,p_expected_version bigint,p_patch jsonb,p_admin_id text,p_reason text,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; permission text; changed_id uuid;
begin
  permission:=case p_resource when 'providers' then 'ai.providers.manage' when 'models' then 'ai.models.manage' when 'routes' then 'ai.routes.manage'
    when 'failures' then 'ai.operations.manage' when 'response-reports' then 'ai.reports.manage' when 'safety-rules' then 'ai.safety.manage' when 'prompts' then 'ai.prompts.manage' end;
  if permission is null or p_admin_id<>public.current_clerk_user_id() or not private.admin_has_permission(p_admin_id,permission,clock_timestamp()) or char_length(btrim(p_reason)) not between 10 and 500 or jsonb_typeof(p_patch)<>'object' then raise exception using errcode='42501',message='ADMIN_PERMISSION_DENIED'; end if;
  if p_resource in ('providers','models','routes','safety-rules') then
    -- ponytail: serialize rare configuration writes; use route-scoped locks if contention becomes material.
    perform pg_advisory_xact_lock(hashtextextended('masarifi:ai-config',0));
  end if;
  if p_resource='providers' then
    if p_patch-array['approved','zdrCapable','trainingPolicy','displayName']<>'{}'::jsonb then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    update private.ai_providers set approved=coalesce((p_patch->>'approved')::boolean,approved),zdr_capable=coalesce((p_patch->>'zdrCapable')::boolean,zdr_capable),training_policy=coalesce(p_patch->>'trainingPolicy',training_policy),display_name=coalesce(p_patch->>'displayName',display_name),retention_reviewed_at=case when p_patch?'approved' then clock_timestamp() else retention_reviewed_at end where id=p_id and version=p_expected_version and deleted_at is null returning id into changed_id;
  elsif p_resource='models' then
    if p_patch-array['approved','capabilities','maxContext','structuredOutput','costPolicy','providerId']<>'{}'::jsonb then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    if p_patch ? 'providerId' then
      if jsonb_typeof(p_patch->'providerId') is distinct from 'string'
        or p_patch->>'providerId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
        raise exception using errcode='22023',message='AI_MUTATION_INVALID';
      end if;
      perform 1 from private.ai_providers
      where id=(p_patch->>'providerId')::uuid and approved and zdr_capable
        and training_policy='no_training' and retention_reviewed_at is not null and deleted_at is null
      for share;
      if not found then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    end if;
    update private.ai_models set provider_id=coalesce((p_patch->>'providerId')::uuid,provider_id),approved=coalesce((p_patch->>'approved')::boolean,approved),capabilities=case when p_patch?'capabilities' then array(select jsonb_array_elements_text(p_patch->'capabilities')) else capabilities end,max_context=coalesce((p_patch->>'maxContext')::integer,max_context),structured_output=coalesce((p_patch->>'structuredOutput')::boolean,structured_output),cost_policy=coalesce(p_patch->'costPolicy',cost_policy) where id=p_id and version=p_expected_version and deleted_at is null returning id into changed_id;
  elsif p_resource='routes' then
    if p_patch-array['primaryModelId','fallbackModelIds','providerAllowlist','enabled','maxPrice','limits']<>'{}'::jsonb then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    update private.ai_feature_routes set primary_model_id=coalesce((p_patch->>'primaryModelId')::uuid,primary_model_id),fallback_model_ids=case when p_patch?'fallbackModelIds' then array(select jsonb_array_elements_text(p_patch->'fallbackModelIds'))::uuid[] else fallback_model_ids end,provider_allowlist=case when p_patch?'providerAllowlist' then array(select jsonb_array_elements_text(p_patch->'providerAllowlist')) else provider_allowlist end,enabled=coalesce((p_patch->>'enabled')::boolean,enabled),max_price=coalesce(p_patch->'maxPrice',max_price),limits=coalesce(p_patch->'limits',limits) where id=p_id and version=p_expected_version and deleted_at is null returning id into changed_id;
  elsif p_resource='response-reports' then
    if p_patch-array['status']<>'{}'::jsonb or p_patch->>'status' not in ('reviewed','actioned','dismissed') then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    update public.ai_response_reports set status=p_patch->>'status',reviewed_at=clock_timestamp() where id=p_id and version=p_expected_version and deleted_at is null returning id into changed_id;
  elsif p_resource='failures' then
    if p_patch-array['status']<>'{}'::jsonb or p_patch->>'status' not in ('open','acknowledged','resolved') then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    update private.ai_failure_events set status=p_patch->>'status' where id=p_id and version=p_expected_version returning id into changed_id;
  elsif p_resource='safety-rules' and p_id is null then
    if not (p_patch ?& array['key','workload','ruleType','configuration','enabled']) then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    insert into private.ai_safety_rules(key,workload,rule_type,configuration,enabled) values(p_patch->>'key',p_patch->>'workload',p_patch->>'ruleType',p_patch->'configuration',(p_patch->>'enabled')::boolean) returning id into changed_id;
  elsif p_resource='safety-rules' then
    if p_patch-array['key','workload','ruleType','configuration','enabled']<>'{}'::jsonb then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    update private.ai_safety_rules set key=coalesce(p_patch->>'key',key),workload=coalesce(p_patch->>'workload',workload),rule_type=coalesce(p_patch->>'ruleType',rule_type),configuration=coalesce(p_patch->'configuration',configuration),enabled=coalesce((p_patch->>'enabled')::boolean,enabled) where id=p_id and version=p_expected_version and deleted_at is null returning id into changed_id;
  elsif p_resource='prompts' and p_id is null then
    if not (p_patch ?& array['workload','template','schemaVersion']) then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    insert into private.ai_prompt_versions(workload,version_no,template,schema_version) values(p_patch->>'workload',(select coalesce(max(version_no),0)+1 from private.ai_prompt_versions where workload=p_patch->>'workload'),p_patch->>'template',(p_patch->>'schemaVersion')::integer) returning id into changed_id;
  else raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
  if changed_id is null then raise exception using errcode='40001',message='AI_ADMIN_CONFLICT'; end if;
  if p_resource in ('providers','models','routes','safety-rules') and exists(select 1 from private.ai_feature_routes r where r.enabled and r.deleted_at is null and not private.ai_route_is_compliant(r)) then
    raise exception using errcode='22023',message='AI_ROUTE_POLICY_INVALID';
  end if;
  perform audit.append_event(p_admin_id,'admin','ai.config-updated','ai_config',changed_id::text,null,null,p_reason,p_request_id,jsonb_build_object('resource',p_resource));
  select value into result from private.read_admin_ai(p_resource,changed_id,1); return result;
end $$;
alter function private.mutate_admin_ai(text,uuid,bigint,jsonb,text,text,text) owner to masarifi_migration;
revoke all on function private.mutate_admin_ai(text,uuid,bigint,jsonb,text,text,text) from public;

reset role;
revoke masarifi_migration from current_user granted by current_user;
