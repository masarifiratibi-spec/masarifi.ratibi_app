grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create or replace function private.read_operations(p_kind text,p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare permission_key text; page_limit integer; result jsonb; resource_key text; observed timestamptz:=clock_timestamp(); range_interval interval; bucket_interval interval;
begin
  permission_key:=case
    when p_kind='health' then 'operations.health.read'
    when p_kind='providers' then 'operations.providers.read'
    when p_kind in ('queues','scheduled-jobs','job-runs','job-run') then 'operations.jobs.read'
    when p_kind='incidents' then 'operations.incidents.read'
    when p_kind in ('settings','setting') then 'operations.settings.read'
    when p_kind='flags' then 'operations.flags.read'
    when p_kind='maintenance' then 'operations.maintenance.read'
    when p_kind='performance' then 'operations.performance.read'
    when p_kind='recovery' then 'operations.recovery.read'
  end;
  if permission_key is null or p_query is null or jsonb_typeof(p_query)<>'object'
    or private.jsonb_object_key_count(p_query)>10 or pg_catalog.octet_length(p_query::text)>2048 then
    raise exception using errcode='22023',message='OPERATIONS_READ_INPUT_INVALID';
  end if;
  perform private.assert_admin_permission(permission_key);
  page_limit:=least(100,greatest(1,coalesce((p_query->>'limit')::integer,25)));

  if p_kind='health' then
    with latest as (
      select distinct on (provider_key) provider_key,status,latency_ms,checked_at,safe_error_code
      from private.provider_health_checks order by provider_key,checked_at desc,id desc
    )
    select jsonb_build_object(
      'status',case
        when exists(select 1 from private.maintenance_windows where status='active' and scope&&array['api','database','storage']) then 'maintenance'
        when exists(select 1 from latest where provider_key in ('database','storage') and status='down' and checked_at>observed-interval '5 minutes') then 'outage'
        when exists(select 1 from latest where status in ('down','degraded') and checked_at>observed-interval '5 minutes') then 'degraded'
        when (select count(*) from latest where status<>'unknown' and checked_at>observed-interval '5 minutes')<6 then 'unknown' else 'operational' end,
      'services',coalesce((select jsonb_agg(jsonb_build_object(
        'key',provider_key,'status',case when checked_at<=observed-interval '5 minutes' then 'unknown' when status='up' then 'operational' when status='down' then 'outage' else status end,
        'latencyMs',latency_ms,'safeCode',safe_error_code,'freshness',jsonb_build_object(
          'observedAt',checked_at,'staleAt',checked_at+interval '5 minutes','state',case when checked_at<observed-interval '5 minutes' then 'stale' else 'fresh' end)) order by provider_key) from latest),'[]'::jsonb),
      'partial',(select count(*) filter(where status<>'unknown' and checked_at>observed-interval '5 minutes')<6 from latest),
      'freshness',jsonb_build_object('observedAt',coalesce((select max(checked_at) from latest),observed),'staleAt',coalesce((select max(checked_at) from latest),observed)+interval '5 minutes','state',case when not exists(select 1 from latest) then 'unknown' when (select max(checked_at) from latest)<observed-interval '5 minutes' then 'stale' else 'fresh' end)
    ) into result;
  elsif p_kind='providers' then
    select jsonb_build_object(
      'items',coalesce(jsonb_agg(value order by ord) filter(where ord<=page_limit),'[]'::jsonb),
      'nextCursor',case when count(*)>page_limit then (array_agg(cursor_key order by ord))[page_limit] end
    ) into result from (
      select jsonb_build_object('provider',provider_key,'status',status,'latencyMs',latency_ms,'checkedAt',checked_at,'safeCode',safe_error_code) value,
        id::text cursor_key,row_number() over(order by checked_at desc,id desc) ord
      from private.provider_health_checks
      where (p_query->>'provider' is null or provider_key=p_query->>'provider')
        and (p_query->>'status' is null or status=p_query->>'status')
        and (p_query->>'cursor' is null or (checked_at,id)<(select checked_at,id from private.provider_health_checks where id=(p_query->>'cursor')::uuid))
      order by checked_at desc,id desc limit page_limit+1
    ) rows;
  elsif p_kind='queues' then
    select jsonb_build_object(
      'items',coalesce(jsonb_agg(jsonb_build_object('key',job_key,'waiting',waiting,'active',active,'failed',failed,'oldestWaitingSeconds',oldest,'status',case when dead_letters>0 then 'outage' when failed>0 then 'degraded' else 'operational' end) order by job_key),'[]'::jsonb),
      'freshness',jsonb_build_object('observedAt',observed,'staleAt',observed+interval '1 minute','state','fresh'),'partial',false
    ) into result from (
      select s.job_key,count(r.id) filter(where r.status in ('queued','retrying')) waiting,count(r.id) filter(where r.status='running') active,
        count(r.id) filter(where r.status='failed') failed,count(r.id) filter(where r.status='dead_lettered') dead_letters,
        extract(epoch from observed-min(r.queued_at) filter(where r.status in ('queued','retrying')))::integer oldest
      from private.scheduled_jobs s left join private.job_runs r on r.scheduled_job_id=s.id group by s.job_key
    ) queues;
  elsif p_kind='scheduled-jobs' then
    select jsonb_build_object('items',coalesce(jsonb_agg(value order by ord) filter(where ord<=page_limit),'[]'::jsonb),'nextCursor',case when count(*)>page_limit then (array_agg(cursor_key order by ord))[page_limit] end) into result from (
      select jsonb_build_object('id',id,'key',job_key,'ownerSpec',owner_spec,'type',job_type,'schedule',schedule,'enabled',enabled,'timeoutSeconds',timeout_seconds,'maxAttempts',max_attempts,'retrySafe',retry_safe,'cancelSafe',cancel_safe,'nextRunAt',next_run_at,'version',version) value,
        job_key cursor_key,row_number() over(order by job_key) ord
      from private.scheduled_jobs where (p_query->>'cursor' is null or job_key>p_query->>'cursor')
        and (p_query->>'ownerSpec' is null or owner_spec=(p_query->>'ownerSpec')::smallint)
        and (p_query->>'enabled' is null or enabled=(p_query->>'enabled')::boolean)
      order by job_key limit page_limit+1
    ) rows;
  elsif p_kind='job-runs' then
    select jsonb_build_object('items',coalesce(jsonb_agg(value order by ord) filter(where ord<=page_limit),'[]'::jsonb),'nextCursor',case when count(*)>page_limit then (array_agg(cursor_key order by ord))[page_limit] end) into result from (
      select jsonb_build_object('id',id,'jobKey',job_key,'ownerSpec',owner_spec,'status',status,'queuedAt',queued_at,'startedAt',started_at,'completedAt',completed_at,'correlationId',correlation_id,'summary',result_summary,'version',version) value,
        id::text cursor_key,row_number() over(order by queued_at desc,id desc) ord
      from private.job_runs where (p_query->>'jobKey' is null or job_key=p_query->>'jobKey')
        and (p_query->>'status' is null or status=p_query->>'status')
        and (p_query->>'cursor' is null or (queued_at,id)<(select queued_at,id from private.job_runs where id=(p_query->>'cursor')::uuid))
      order by queued_at desc,id desc limit page_limit+1
    ) rows;
  elsif p_kind='job-run' then
    resource_key:=p_query->>'runId';
    if resource_key is null or resource_key !~* '^[0-9a-f-]{36}$' then raise exception using errcode='22023',message='OPERATIONS_READ_INPUT_INVALID'; end if;
    select jsonb_build_object(
      'run',jsonb_build_object('id',r.id,'jobKey',r.job_key,'ownerSpec',r.owner_spec,'status',r.status,'queuedAt',r.queued_at,'startedAt',r.started_at,'completedAt',r.completed_at,'correlationId',r.correlation_id,'summary',r.result_summary,'version',r.version),
      'attempts',coalesce((select jsonb_agg(jsonb_build_object('attempt',a.attempt_no,'status',a.status,'workerId',a.worker_id,'startedAt',a.started_at,'completedAt',a.completed_at,'safeCode',a.safe_error_code,'nextAttemptAt',a.next_attempt_at) order by a.attempt_no) from private.job_attempts a where a.run_id=r.id),'[]'::jsonb),
      'allowedActions',case when r.status in ('failed','dead_lettered') and s.retry_safe then '["retry"]'::jsonb when r.status in ('queued','retrying') and s.cancel_safe then '["cancel"]'::jsonb else '[]'::jsonb end
    ) into result from private.job_runs r left join private.scheduled_jobs s on s.id=r.scheduled_job_id where r.id=resource_key::uuid;
  elsif p_kind='incidents' then
    select jsonb_build_object('items',coalesce(jsonb_agg(value order by ord) filter(where ord<=page_limit),'[]'::jsonb),'nextCursor',case when count(*)>page_limit then (array_agg(cursor_key order by ord))[page_limit] end) into result from (
      select jsonb_build_object('id',id,'title',title,'severity',severity,'status',status,'startedAt',started_at,'resolvedAt',resolved_at,'publicSummary',public_summary,'assignedAdminId',assigned_admin_id,'version',version) value,
        id::text cursor_key,row_number() over(order by started_at desc,id desc) ord
      from private.system_incidents where (p_query->>'id' is null or id=(p_query->>'id')::uuid)
        and (p_query->>'status' is null or status=p_query->>'status')
        and (p_query->>'severity' is null or severity=p_query->>'severity')
        and (p_query->>'cursor' is null or (started_at,id)<(select started_at,id from private.system_incidents where id=(p_query->>'cursor')::uuid))
      order by started_at desc,id desc limit page_limit+1
    ) rows;
  elsif p_kind='settings' then
    select jsonb_build_object('items',coalesce(jsonb_agg(value order by setting_key),'[]'::jsonb)) into result from (
      select setting_key,case when sensitivity='restricted'
        then jsonb_build_object('key',setting_key,'sensitivity',sensitivity,'redacted',true,'version',version,'updatedAt',updated_at)
        else jsonb_build_object('key',setting_key,'value',value,'sensitivity',sensitivity,'redacted',false,'version',version,'updatedAt',updated_at) end value
      from private.system_settings order by setting_key limit 500
    ) rows;
  elsif p_kind='setting' then
    resource_key:=p_query->>'settingKey';
    select case when sensitivity='restricted'
      then jsonb_build_object('key',setting_key,'sensitivity',sensitivity,'redacted',true,'version',version,'updatedAt',updated_at)
      else jsonb_build_object('key',setting_key,'value',value,'sensitivity',sensitivity,'redacted',false,'version',version,'updatedAt',updated_at) end
      into result from private.system_settings where setting_key=resource_key;
  elsif p_kind='flags' then
    select jsonb_build_object('items',coalesce(jsonb_agg(value order by ord) filter(where ord<=page_limit),'[]'::jsonb),'nextCursor',case when count(*)>page_limit then (array_agg(cursor_key order by ord))[page_limit] end) into result from (
      select jsonb_build_object('id',f.id,'key',f.flag_key,'description',f.description,'defaultEnabled',f.default_enabled,'status',f.status,'version',f.version,
        'rules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'priority',r.priority,'audience',r.audience,'enabled',r.enabled,'version',r.version) order by r.priority) from private.feature_flag_rules r where r.feature_flag_id=f.id),'[]'::jsonb)) value,
        f.flag_key cursor_key,row_number() over(order by f.flag_key) ord
      from private.feature_flags f where (p_query->>'key' is null or f.flag_key=p_query->>'key') and (p_query->>'search' is null or f.flag_key ilike '%'||(p_query->>'search')||'%' or f.description ilike '%'||(p_query->>'search')||'%') and (p_query->>'status' is null or f.status=p_query->>'status') and (p_query->>'cursor' is null or f.flag_key>p_query->>'cursor') order by f.flag_key limit page_limit+1
    ) rows;
  elsif p_kind='maintenance' then
    select jsonb_build_object('items',coalesce(jsonb_agg(value order by ord) filter(where ord<=page_limit),'[]'::jsonb),'nextCursor',case when count(*)>page_limit then (array_agg(cursor_key order by ord))[page_limit] end) into result from (
      select jsonb_build_object('id',id,'startsAt',starts_at,'endsAt',ends_at,'scopes',scope,'message',public_message,'status',status,'version',version) value,
        id::text cursor_key,row_number() over(order by case when coalesce((p_query->>'current')::boolean,false) and status='active' then 0 else 1 end,starts_at desc,id desc) ord
      from private.maintenance_windows where (not coalesce((p_query->>'current')::boolean,false) or (status in ('active','scheduled') and ends_at>observed)) and (p_query->>'cursor' is null or (starts_at,id)<(select starts_at,id from private.maintenance_windows where id=(p_query->>'cursor')::uuid))
      order by case when coalesce((p_query->>'current')::boolean,false) and status='active' then 0 else 1 end,starts_at desc,id desc limit page_limit+1
    ) rows;
  elsif p_kind='performance' then
    range_interval:=case coalesce(p_query->>'range','24h') when '1h' then interval '1 hour' when '7d' then interval '7 days' when '30d' then interval '30 days' else interval '24 hours' end;
    bucket_interval:=case coalesce(p_query->>'range','24h') when '1h' then interval '5 minutes' when '7d' then interval '6 hours' when '30d' then interval '1 day' else interval '1 hour' end;
    with attempt_samples as (
      select completed_at,extract(epoch from completed_at-started_at)*1000 latency_ms
      from private.job_attempts where completed_at>=observed-range_interval and completed_at is not null
    ), attempt_stats as (
      select count(*) sample_count,max(completed_at) latest,
        round(percentile_cont(0.50) within group(order by latency_ms)::numeric,2)::float8 p50,
        round(percentile_cont(0.95) within group(order by latency_ms)::numeric,2)::float8 p95,
        round(percentile_cont(0.99) within group(order by latency_ms)::numeric,2)::float8 p99
      from attempt_samples
    ), provider_stats as (
      select count(*) sample_count,max(checked_at) latest,
        round(percentile_cont(0.50) within group(order by latency_ms)::numeric,2)::float8 p50,
        round(percentile_cont(0.95) within group(order by latency_ms)::numeric,2)::float8 p95,
        round(percentile_cont(0.99) within group(order by latency_ms)::numeric,2)::float8 p99
      from private.provider_health_checks where checked_at>=observed-range_interval and status<>'unknown'
    ), series as (
      select date_bin(bucket_interval,completed_at,'2000-01-01T00:00:00Z'::timestamptz) at,
        round(percentile_cont(0.95) within group(order by latency_ms)::numeric,2)::float8 value
      from attempt_samples group by 1 order by 1 limit 720
    )
    select jsonb_build_object('range',coalesce(p_query->>'range','24h'),'budgets',jsonb_build_object(
      'operations.jobs',jsonb_build_object('p50',a.p50,'p95',a.p95,'p99',a.p99,'unit','milliseconds','status',case when a.sample_count=0 then 'unavailable' when a.p95<=300 and a.p99<=750 then 'within_budget' else 'breached' end),
      'providers.shallow',jsonb_build_object('p50',p.p50,'p95',p.p95,'p99',p.p99,'unit','milliseconds','status',case when p.sample_count=0 then 'unavailable' when p.p95<=2000 then 'within_budget' else 'breached' end)),
      'series',coalesce((select jsonb_agg(jsonb_build_object('at',at,'value',value) order by at) from series),'[]'::jsonb),
      'freshness',jsonb_build_object('observedAt',coalesce(a.latest,p.latest,observed),'staleAt',coalesce(a.latest,p.latest,observed)+interval '5 minutes','state',case when a.sample_count+p.sample_count=0 then 'unknown' when greatest(a.latest,p.latest)<observed-interval '5 minutes' then 'stale' else 'fresh' end))
      into result from attempt_stats a cross join provider_stats p;
  elsif p_kind='recovery' then
    result:=jsonb_build_object('items',jsonb_build_array(
      jsonb_build_object('scope','database','status','unavailable','observedAt',observed,'evidenceRef','local-recovery-evidence','rpoSeconds',null,'rtoSeconds',null,'safeCode','LOCAL_EVIDENCE_PENDING'),
      jsonb_build_object('scope','full_dr','status','external_required','observedAt',observed,'evidenceRef','hosted-provider-evidence','rpoSeconds',null,'rtoSeconds',null,'safeCode','HOSTED_EVIDENCE_REQUIRED')),
      'rpoTargetSeconds',900,'rtoTargetSeconds',7200);
  end if;
  if result is null then raise exception using errcode='P0002',message='OPERATIONS_RESOURCE_UNAVAILABLE'; end if;
  return result;
end $$;
alter function private.read_operations(text,jsonb) owner to masarifi_migration;

