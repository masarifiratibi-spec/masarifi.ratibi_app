grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

alter table private.ai_usage_events add column platform text check(platform in ('ios','android'));
alter table private.ai_failure_events add column platform text check(platform in ('ios','android'));
create table private.ai_platform_collection (
 singleton boolean primary key default true check(singleton), started_at timestamptz not null default clock_timestamp()
);
alter table private.ai_platform_collection owner to masarifi_migration;
alter table private.ai_platform_collection enable row level security;
insert into private.ai_platform_collection default values;

create function private.capture_ai_event_platform() returns trigger
language plpgsql security definer set search_path='' as $$
declare claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb; native_platform text;
begin
  -- Only an authenticated native request's current session can supply attribution.
  if new.platform is null and claims->>'nativeRequest'='true' and claims->>'sub'=new.user_id then
    select case when count(distinct d.platform)=1 then min(d.platform) end into native_platform
      from public.user_devices d join public.profiles p on p.id=d.user_id
      where d.user_id=new.user_id and d.clerk_session_id=claims->>'sid' and d.revoked_at is null
        and d.platform in ('ios','android') and p.status='active';
    new.platform:=native_platform;
  end if;
  if new.platform is null and tg_table_name='ai_failure_events' then
    select u.platform into new.platform from private.ai_usage_events u where u.request_id=new.request_id and u.user_id=new.user_id;
  end if;
  return new;
end $$;
alter function private.capture_ai_event_platform() owner to masarifi_migration;
revoke all on function private.capture_ai_event_platform() from public;
create trigger ai_usage_native_platform before insert on private.ai_usage_events for each row execute function private.capture_ai_event_platform();
create trigger ai_failure_native_platform before insert on private.ai_failure_events for each row execute function private.capture_ai_event_platform();

create function private.admin_ai_matches(r jsonb,f jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select (not f ? 'search' or strpos(lower(concat_ws(' ',r->>'id',r->>'key',r->>'display_name',r->>'model_id',r->>'model',r->>'provider',r->>'workload',r->>'failure_code',r->>'report_type')),lower(f->>'search'))>0)
 and (not f ? 'status' or coalesce(r->>'status',r->>'reservation_status',case when coalesce((r->>'approved')::boolean,(r->>'enabled')::boolean) then case when r ? 'display_name' then 'healthy' else 'active' end else case when r ? 'display_name' then 'unavailable' else 'inactive' end end)=f->>'status')
 and (not f ? 'feature' or r->>'workload'=case f->>'feature' when 'voice_parsing' then 'voice_transcription' when 'categorization' then 'transaction_classification' when 'spending_insights' then 'financial_insights' when 'report_explanation' then 'report_summarization' else f->>'feature' end)
 and (not f ? 'platform' or f->>'platform'='all' or coalesce(r->>'platform','unknown')=f->>'platform')
 and (not f ? 'providerId' or r->>'provider_id'=f->>'providerId' or exists(select 1 from private.ai_providers p where p.id=(f->>'providerId')::uuid and p.key=r->>'provider'))
 and (not f ? 'modelId' or exists(select 1 from private.ai_models m where m.id=(f->>'modelId')::uuid and m.model_id=r->>'model'))
 and (not f ? 'dateFrom' or (r->>'created_at')::timestamptz>=(f->>'dateFrom')::date)
 and (not f ? 'dateTo' or (r->>'created_at')::timestamptz<(f->>'dateTo')::date+interval '1 day');
$$;
alter function private.admin_ai_matches(jsonb,jsonb) owner to masarifi_migration;
revoke all on function private.admin_ai_matches(jsonb,jsonb) from public;
create function private.read_admin_ai_filtered(p_resource text,p_id uuid,p_limit integer,p_filters jsonb)
returns table(value jsonb) language plpgsql stable security definer set search_path='' as $$
declare admin_id text:=public.current_clerk_user_id(); permission text; p_exact boolean:=false; observed timestamptz:=statement_timestamp(); starts timestamptz:=statement_timestamp()-make_interval(days=>case coalesce(p_filters->>'period','30d') when '7d' then 7 when '90d' then 90 else 30 end);
begin
  permission:=case p_resource when 'overview' then 'ai.overview.read' when 'providers' then 'ai.providers.read' when 'models' then 'ai.models.read'
    when 'routes' then 'ai.routes.read' when 'prompts' then 'ai.prompts.read' when 'usage' then 'ai.usage.read'
    when 'failures' then 'ai.failures.manage' when 'response-reports' then 'ai.reports.read' when 'safety-rules' then 'ai.safety.read' end;
  if permission is null or not private.admin_has_permission(admin_id,permission,clock_timestamp()) then raise exception using errcode='42501',message='ADMIN_PERMISSION_DENIED'; end if;
  if p_limit not between 1 and 101 then raise exception using errcode='22023',message='AI_LIMIT_INVALID'; end if;
  if p_resource='overview' then
    return query select jsonb_build_object('id','99000000-0000-4000-8000-000000000001','kind','overview','version',1,'data',jsonb_build_object(
      'providers',(select count(*) from private.ai_providers where deleted_at is null),
      'models',(select count(*) from private.ai_models where deleted_at is null),
      'enabledRoutes',(select count(*) from private.ai_feature_routes where enabled and deleted_at is null),
      'requests',(select count(*) from private.ai_usage_events u where created_at>=starts and created_at<=observed and private.admin_ai_matches(to_jsonb(u),p_filters)),
      'estimatedCost',(select coalesce(sum(estimated_cost),0)::text from private.ai_usage_events u where created_at>=starts and created_at<=observed and private.admin_ai_matches(to_jsonb(u),p_filters)),
      'failures',(select count(*) from private.ai_failure_events u where created_at>=starts and created_at<=observed and private.admin_ai_matches(to_jsonb(u),p_filters)),
      'totalAttempts',null,'fallbackAttempts',null,'observedAt',observed,
      'collectionStartedAt',(select started_at from private.ai_platform_collection),
      'attribution','event_native_session','coverage','partial'));
  elsif p_resource='providers' then return query select jsonb_build_object('id',p.id,'kind','provider','version',p.version,'data',to_jsonb(p)-array['id','version','deleted_at']) from private.ai_providers p where p.deleted_at is null and (p_id is null or (p_exact and p.id=p_id) or (not p_exact and p.id>p_id)) and private.admin_ai_matches(to_jsonb(p),p_filters) order by p.id limit p_limit;
  elsif p_resource='models' then return query select jsonb_build_object('id',m.id,'kind','model','version',m.version,'data',to_jsonb(m)-array['id','version','deleted_at']) from private.ai_models m where m.deleted_at is null and (p_id is null or (p_exact and m.id=p_id) or (not p_exact and m.id>p_id)) and private.admin_ai_matches(to_jsonb(m),p_filters) order by m.id limit p_limit;
  elsif p_resource='routes' then return query select jsonb_build_object('id',r.id,'kind','route','version',r.version,'data',to_jsonb(r)-array['id','version','deleted_at']) from private.ai_feature_routes r where r.deleted_at is null and (p_id is null or (p_exact and r.id=p_id) or (not p_exact and r.id>p_id)) and private.admin_ai_matches(to_jsonb(r),p_filters) order by r.id limit p_limit;
  elsif p_resource='prompts' then return query select jsonb_build_object('id',p.id,'kind','prompt','version',p.version_no,'data',(to_jsonb(p)-array['id','version_no','claim_token','claimed_by','lease_until','deleted_at'])) from private.ai_prompt_versions p where (p_id is null or (p_exact and p.id=p_id) or (not p_exact and p.id>p_id)) and private.admin_ai_matches(to_jsonb(p),p_filters) order by p.id limit p_limit;
  elsif p_resource='usage' then return query select jsonb_build_object('id',u.id,'kind','usage','version',1,'data',jsonb_build_object('workload',u.workload,'model',u.model,'provider',u.provider,'inputTokens',u.input_tokens,'outputTokens',u.output_tokens,'estimatedCost',u.estimated_cost::text,'latencyMs',u.latency_ms,'fallbackUsed',u.fallback_used,'status',u.reservation_status,'createdAt',u.created_at)) from private.ai_usage_events u where (p_id is null or (p_exact and u.id=p_id) or (not p_exact and u.id>p_id)) and private.admin_ai_matches(to_jsonb(u),p_filters) order by u.id limit p_limit;
  elsif p_resource='failures' then return query select jsonb_build_object('id',f.id,'kind','failure','version',f.version,'data',to_jsonb(f)-array['id','user_id','version','platform']) from private.ai_failure_events f where (p_id is null or (p_exact and f.id=p_id) or (not p_exact and f.id>p_id)) and private.admin_ai_matches(to_jsonb(f),p_filters) order by f.id limit p_limit;
  elsif p_resource='response-reports' then return query select jsonb_build_object('id',r.id,'kind','response-report','version',r.version,'data',jsonb_build_object('reportType',r.report_type,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at)) from public.ai_response_reports r where r.deleted_at is null and (p_id is null or (p_exact and r.id=p_id) or (not p_exact and r.id>p_id)) and private.admin_ai_matches(to_jsonb(r),p_filters) order by r.id limit p_limit;
  elsif p_resource='safety-rules' then return query select jsonb_build_object('id',s.id,'kind','safety-rule','version',s.version,'data',to_jsonb(s)-array['id','version','deleted_at']) from private.ai_safety_rules s where s.deleted_at is null and (p_id is null or (p_exact and s.id=p_id) or (not p_exact and s.id>p_id)) and private.admin_ai_matches(to_jsonb(s),p_filters) order by s.id limit p_limit;
  else raise exception using errcode='22023',message='AI_RESOURCE_INVALID'; end if;
end $$;
alter function private.read_admin_ai_filtered(text,uuid,integer,jsonb) owner to masarifi_migration;
revoke all on function private.read_admin_ai_filtered(text,uuid,integer,jsonb) from public;

grant execute on function private.read_admin_ai_filtered(text,uuid,integer,jsonb) to masarifi_api;
create or replace function private.read_admin_ai(p_resource text,p_id uuid,p_limit integer,p_exact boolean)
returns table(value jsonb) language plpgsql stable security definer set search_path='' as $$
declare admin_id text:=public.current_clerk_user_id(); permission text;
begin
  permission:=case p_resource when 'overview' then 'ai.overview.read' when 'providers' then 'ai.providers.read' when 'models' then 'ai.models.read'
    when 'routes' then 'ai.routes.read' when 'prompts' then 'ai.prompts.read' when 'usage' then 'ai.usage.read'
    when 'failures' then 'ai.failures.manage' when 'response-reports' then 'ai.reports.read' when 'safety-rules' then 'ai.safety.read' end;
  if permission is null or not private.admin_has_permission(admin_id,permission,clock_timestamp()) then raise exception using errcode='42501',message='ADMIN_PERMISSION_DENIED'; end if;
  if p_limit not between 1 and 100 then raise exception using errcode='22023',message='AI_LIMIT_INVALID'; end if;
  if p_resource='overview' then
    return query select jsonb_build_object('id','99000000-0000-4000-8000-000000000001','kind','overview','version',1,'data',jsonb_build_object(
      'providers',(select count(*) from private.ai_providers where deleted_at is null),'models',(select count(*) from private.ai_models where deleted_at is null),
      'enabledRoutes',(select count(*) from private.ai_feature_routes where enabled and deleted_at is null),
      'requests',(select count(*) from private.ai_usage_events where created_at>clock_timestamp()-interval '30 days'),
      'estimatedCost',(select coalesce(sum(estimated_cost),0)::text from private.ai_usage_events where created_at>clock_timestamp()-interval '30 days'),
      'failures',(select count(*) from private.ai_failure_events where created_at>clock_timestamp()-interval '30 days')));
  elsif p_resource='providers' then return query select jsonb_build_object('id',p.id,'kind','provider','version',p.version,'data',to_jsonb(p)-array['id','version','deleted_at']) from private.ai_providers p where p.deleted_at is null and (p_id is null or (p_exact and p.id=p_id) or (not p_exact and p.id>p_id)) order by p.id limit p_limit;
  elsif p_resource='models' then return query select jsonb_build_object('id',m.id,'kind','model','version',m.version,'data',to_jsonb(m)-array['id','version','deleted_at']) from private.ai_models m where m.deleted_at is null and (p_id is null or (p_exact and m.id=p_id) or (not p_exact and m.id>p_id)) order by m.id limit p_limit;
  elsif p_resource='routes' then return query select jsonb_build_object('id',r.id,'kind','route','version',r.version,'data',to_jsonb(r)-array['id','version','deleted_at']) from private.ai_feature_routes r where r.deleted_at is null and (p_id is null or (p_exact and r.id=p_id) or (not p_exact and r.id>p_id)) order by r.id limit p_limit;
  elsif p_resource='prompts' then return query select jsonb_build_object('id',p.id,'kind','prompt','version',p.version_no,'data',(to_jsonb(p)-array['id','version_no','claim_token','claimed_by','lease_until','deleted_at'])) from private.ai_prompt_versions p where (p_id is null or (p_exact and p.id=p_id) or (not p_exact and p.id>p_id)) order by p.id limit p_limit;
  elsif p_resource='usage' then return query select jsonb_build_object('id',u.id,'kind','usage','version',1,'data',jsonb_build_object('workload',u.workload,'model',u.model,'provider',u.provider,'inputTokens',u.input_tokens,'outputTokens',u.output_tokens,'estimatedCost',u.estimated_cost::text,'latencyMs',u.latency_ms,'fallbackUsed',u.fallback_used,'status',u.reservation_status,'createdAt',u.created_at)) from private.ai_usage_events u where (p_id is null or (p_exact and u.id=p_id) or (not p_exact and u.id>p_id)) order by u.id limit p_limit;
  elsif p_resource='failures' then return query select jsonb_build_object('id',f.id,'kind','failure','version',f.version,'data',to_jsonb(f)-array['id','user_id','version','platform']) from private.ai_failure_events f where (p_id is null or (p_exact and f.id=p_id) or (not p_exact and f.id>p_id)) order by f.id limit p_limit;
  elsif p_resource='response-reports' then return query select jsonb_build_object('id',r.id,'kind','response-report','version',r.version,'data',jsonb_build_object('reportType',r.report_type,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at)) from public.ai_response_reports r where r.deleted_at is null and (p_id is null or (p_exact and r.id=p_id) or (not p_exact and r.id>p_id)) order by r.id limit p_limit;
  elsif p_resource='safety-rules' then return query select jsonb_build_object('id',s.id,'kind','safety-rule','version',s.version,'data',to_jsonb(s)-array['id','version','deleted_at']) from private.ai_safety_rules s where s.deleted_at is null and (p_id is null or (p_exact and s.id=p_id) or (not p_exact and s.id>p_id)) order by s.id limit p_limit;
  else raise exception using errcode='22023',message='AI_RESOURCE_INVALID'; end if;
end $$;
alter function private.read_admin_ai(text,uuid,integer,boolean) owner to masarifi_migration;
revoke all on function private.read_admin_ai(text,uuid,integer,boolean) from public;


alter table private.ai_prompt_test_cases add column source_test_case_id uuid;
alter table private.ai_prompt_test_cases add column source_version bigint;
alter table private.ai_prompt_test_cases add column source_prompt_version_id uuid;
alter table private.ai_prompt_test_cases add constraint ai_case_source_complete check(
 (source_test_case_id is null and source_version is null and source_prompt_version_id is null)
 or (source_test_case_id is not null and source_version>0 and source_prompt_version_id is not null));
create function private.guard_evaluated_ai_corpus() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_status text; old_parent uuid; new_parent uuid;
begin
 if tg_op<>'INSERT' then old_parent:=old.prompt_version_id; end if;
 if tg_op<>'DELETE' then new_parent:=new.prompt_version_id; end if;
 -- Lock both parents so reassignment and starting evaluation cannot race corpus edits.
 for parent_status in select p.status from private.ai_prompt_versions p
   where p.id in (old_parent,new_parent) order by p.id for share loop
   if parent_status<>'draft' then
     raise exception using errcode='55000',message='AI_EVALUATION_CORPUS_IMMUTABLE';
   end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
alter function private.guard_evaluated_ai_corpus() owner to masarifi_migration;
revoke all on function private.guard_evaluated_ai_corpus() from public;
create trigger ai_evaluated_corpus_immutable before insert or update or delete on private.ai_prompt_test_cases for each row execute function private.guard_evaluated_ai_corpus();
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
    perform pg_advisory_xact_lock(hashtextextended('masarifi:ai-prompt:'||(p_patch->>'workload'),0));
    if not (p_patch ?& array['workload','template','schemaVersion']) then raise exception using errcode='22023',message='AI_MUTATION_INVALID'; end if;
    insert into private.ai_prompt_versions(workload,version_no,template,schema_version) values(p_patch->>'workload',(select coalesce(max(version_no),0)+1 from private.ai_prompt_versions where workload=p_patch->>'workload'),p_patch->>'template',(p_patch->>'schemaVersion')::integer) returning id into changed_id;
    insert into private.ai_prompt_test_cases(prompt_version_id,case_key,fixture_redacted,expected_rules,source_test_case_id,source_version,source_prompt_version_id)
      select changed_id,c.case_key,c.fixture_redacted,c.expected_rules,c.id,c.version,c.prompt_version_id
      from private.ai_prompt_test_cases c join private.ai_prompt_versions approved on approved.id=c.prompt_version_id
      where approved.workload=p_patch->>'workload' and approved.status='approved' and approved.evaluation_passed
        and c.enabled and c.deleted_at is null;
    if not found then raise exception using errcode='22023',message='AI_EVALUATION_CASES_REQUIRED'; end if;

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

create or replace function private.read_tracking_admin(p_resource text,p_id uuid,p_limit_count integer,p_purpose text,p_admin_id text,
  p_cursor_at timestamptz,p_cursor_id uuid,p_filters jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare permission text; result jsonb; v_search text:=nullif(p_filters->>'search',''); v_status text:=nullif(p_filters->>'status',''); v_source text:=nullif(p_filters->>'sourceType',''); v_severity text:=nullif(p_filters->>'severity','');
  v_institution uuid:=nullif(p_filters->>'institutionId','')::uuid; v_parser_version uuid:=nullif(p_filters->>'parserVersionId','')::uuid;
  v_from timestamptz:=nullif(p_filters->>'from','')::timestamptz; v_to timestamptz:=nullif(p_filters->>'to','')::timestamptz+case when length(p_filters->>'to')=10 then interval '1 day'-interval '1 microsecond' else interval '0' end;
begin
  if p_limit_count not between 1 and 101 then raise exception using errcode='22023',message='ADMIN_LIST_INVALID'; end if;
  if p_filters is null or jsonb_typeof(p_filters)<>'object' or (p_cursor_at is null)<>(p_cursor_id is null) then
    raise exception using errcode='22023',message='ADMIN_LIST_INVALID'; end if;
  permission:=case
    when p_resource in ('overview','sessions') then case when p_id is null then 'imports.read' else 'imports.detail.read' end
    when p_resource in ('failures','low-confidence','duplicates','unsupported') then 'imports.read'
    when p_resource='institutions' then 'parsers.coverage.read'
    when p_resource='senders' then 'parsers.coverage.read'
    when p_resource='rules' then 'parsers.rules.read'
    when p_resource in ('test-cases','versions','merchant-rules','category-rules') then 'parsers.rules.read'
    when p_resource='settings' then 'settings.imports.read'
    else null end;
  if permission is null then raise exception using errcode='22023',message='ADMIN_RESOURCE_INVALID'; end if;
  perform private.assert_admin_permission(permission);
  if p_resource='sessions' and p_id is not null and (p_purpose is null or p_purpose<>btrim(p_purpose) or char_length(p_purpose) not between 10 and 500) then
    raise exception using errcode='22023',message='ADMIN_PURPOSE_REQUIRED';
  end if;
  result:=case p_resource
    when 'overview' then (select jsonb_build_object(
      'totalSessions',count(*),'uniqueCustomers',count(distinct user_id),
      'totalItems',coalesce(sum(item_count),0),'failedSessions',count(*) filter(where status='failed'),
      'reviewSessions',count(*) filter(where status='review'),
      'highestFailureSource',coalesce((select s.source_type from public.import_sessions s where s.status='failed' group by s.source_type order by count(*) desc,s.source_type limit 1),'manual'))
      from public.import_sessions)
    when 'sessions' then (select coalesce(jsonb_agg(to_jsonb(x)-'user_id'-'request_hash'-'claim_token'-'claimed_by'-'lease_until'-'last_error_code'),'[]') from (select * from public.import_sessions where (p_id is null or id=p_id) and (v_search is null or strpos(lower(coalesce(source_name,'')||' '||source_type||' '||status),lower(v_search))>0) and (v_status is null or status=v_status) and (v_source is null or source_type=v_source) and (v_severity is null or case when status='failed' then 'high' else 'info' end=v_severity) and (v_from is null or started_at>=v_from) and (v_to is null or started_at<=v_to) and (p_cursor_at is null or (started_at,id)<(p_cursor_at,p_cursor_id)) order by started_at desc,id desc limit p_limit_count) x)
    when 'failures' then (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'sessionId',x.session_id,'status',x.status,'version',x.version,'sourceType',x.source_type,'createdAt',x.created_at,'updatedAt',x.updated_at)),'[]') from (select i.*,s.source_type from public.import_items i join public.import_sessions s on s.id=i.session_id and s.user_id=i.user_id where i.status='failed' and (v_status is null or i.status=v_status) and (v_severity is null or v_severity='high') and (v_search is null or strpos(lower(i.id::text||' '||i.session_id::text),lower(v_search))>0) and (v_source is null or s.source_type=v_source) and (v_from is null or i.created_at>=v_from) and (v_to is null or i.created_at<=v_to) and (p_cursor_at is null or (i.created_at,i.id)<(p_cursor_at,p_cursor_id)) order by i.created_at desc,i.id desc limit p_limit_count) x)
    when 'low-confidence' then (select coalesce(jsonb_agg(to_jsonb(x)-'user_id'-'original_values'-'proposed_values'-'accepted_values'-'decision_token'-'decision_lease_until'),'[]') from (select r.* from public.review_items r join public.import_items i on i.id=r.import_item_id left join public.parser_rule_versions v on v.id=i.parser_version_id left join public.parser_rules pr on pr.id=v.parser_rule_id where (v_status is null and r.status='pending' or v_status is not null and r.status=v_status) and (v_search is null or strpos(lower(r.id::text||' '||r.import_item_id::text),lower(v_search))>0) and (v_institution is null or pr.institution_id=v_institution) and (v_parser_version is null or i.parser_version_id=v_parser_version) and (v_from is null or r.created_at>=v_from) and (v_to is null or r.created_at<=v_to) and (p_cursor_at is null or (r.created_at,r.id)<(p_cursor_at,p_cursor_id)) order by r.created_at desc,r.id desc limit p_limit_count) x)
    when 'duplicates' then (select coalesce(jsonb_agg(to_jsonb(x)-'user_id'-'reasons'-'decision_token'-'decision_lease_until'),'[]') from (select * from public.duplicate_candidates where (v_status is null or status=v_status) and (v_from is null or created_at>=v_from) and (v_to is null or created_at<=v_to) and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)) order by created_at desc,id desc limit p_limit_count) x)
    when 'unsupported' then (select coalesce(jsonb_agg(to_jsonb(x)-'user_id'-'content_hash'-'sample_redacted'),'[]') from (select * from public.unsupported_formats where (v_search is null or strpos(lower(reason||' '||session_id::text),lower(v_search))>0) and (v_status is null or status=v_status) and (v_from is null or created_at>=v_from) and (v_to is null or created_at<=v_to) and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)) order by created_at desc,id desc limit p_limit_count) x)
    when 'institutions' then (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.financial_institutions where (p_id is null or id=p_id) and (v_search is null or strpos(lower(name||' '||code||' '||country_code),lower(v_search))>0) and (v_status is null or active=(v_status='active')) and (v_institution is null or id=v_institution) and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)) order by created_at desc,id desc limit p_limit_count) x)
    when 'senders' then (select coalesce(jsonb_agg(to_jsonb(x)-'sender_pattern'),'[]') from (select * from public.institution_senders where (v_search is null or strpos(lower(display_label),lower(v_search))>0) and (v_status is null or active=(v_status='active')) and (v_institution is null or institution_id=v_institution) and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)) order by created_at desc,id desc limit p_limit_count) x)
    when 'rules' then (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.parser_rules where (p_id is null or id=p_id) and (v_search is null or strpos(lower(name||' '||source_type||' '||status),lower(v_search))>0) and (v_status is null or status=v_status) and (v_source is null or source_type=v_source) and (v_institution is null or institution_id=v_institution) and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)) order by created_at desc,id desc limit p_limit_count) x)
    when 'test-cases' then (select coalesce(jsonb_agg(to_jsonb(x)-'input_fixture'-'expected_output'),'[]') from (select t.* from public.parser_test_cases t join public.parser_rule_versions v on v.id=t.parser_version_id join public.parser_rules r on r.id=v.parser_rule_id where (v_search is null or strpos(lower(t.name),lower(v_search))>0) and (v_parser_version is null or t.parser_version_id=v_parser_version) and (v_institution is null or r.institution_id=v_institution) and (p_cursor_at is null or (t.created_at,t.id)<(p_cursor_at,p_cursor_id)) order by t.created_at desc,t.id desc limit p_limit_count) x)
    when 'versions' then (select coalesce(jsonb_agg(to_jsonb(x)-'definition'-'corpus_requested_by'-'corpus_reason'-'corpus_claim_token'-'corpus_claimed_by'-'corpus_lease_until'),'[]') from (select v.*,r.version parent_rule_version,case when r.active_version_id=v.id then 'published' when v.published_at is not null then 'retired' else 'draft' end status from public.parser_rule_versions v join public.parser_rules r on r.id=v.parser_rule_id where (v_parser_version is null or v.id=v_parser_version) and (v_institution is null or r.institution_id=v_institution) and (v_status is null or v_status=case when r.active_version_id=v.id then 'published' when v.published_at is not null then 'retired' else 'draft' end) and (p_cursor_at is null or (v.created_at,v.id)<(p_cursor_at,p_cursor_id)) order by v.created_at desc,v.id desc limit p_limit_count) x)
    when 'merchant-rules' then (select coalesce(jsonb_agg(to_jsonb(x)-'pattern'),'[]') from (select * from public.merchant_rules where (v_search is null or strpos(lower(normalized_merchant),lower(v_search))>0) and (v_status is null or active=(v_status='active')) and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)) order by created_at desc,id desc limit p_limit_count) x)
    when 'category-rules' then (select coalesce(jsonb_agg(to_jsonb(x)-'pattern'),'[]') from (select c.* from public.category_rules c join public.categories k on k.id=c.category_id where (v_search is null or strpos(lower(k.label_en||' '||k.label_ar),lower(v_search))>0) and (v_status is null or c.active=(v_status='active')) and (p_cursor_at is null or (c.created_at,c.id)<(p_cursor_at,p_cursor_id)) order by c.created_at desc,c.id desc limit p_limit_count) x)
    when 'settings' then jsonb_build_object('rawRetentionDays',30,'historyRetentionDays',365,'maxCsvBytes',6291456,'maxRows',10000)
  end;
  if p_resource='sessions' and p_id is not null then
    perform audit.append_event(p_admin_id,'admin','tracking.import-detail-viewed','import_session',p_id::text,null,null,p_purpose,private.tracking_request_id(),jsonb_build_object('purposeRecorded',true));
  end if;
  return coalesce(result,'[]'::jsonb);
end $$;


reset role;
revoke masarifi_migration from current_user granted by current_user;
