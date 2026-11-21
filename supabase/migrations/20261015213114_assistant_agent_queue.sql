grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create table private.assistant_agent_jobs (
  id uuid primary key references public.assistant_messages(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  state text not null default 'queued' check(state in ('queued','processing','completed','failed','cancelled')),
  claim_token uuid, lease_until timestamptz, attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  failure_code text, uncertain_dispatch boolean not null default false,
  dispatch_count integer not null default 0 check(dispatch_count between 0 and 6),
  check ((state='processing')=(claim_token is not null and lease_until is not null))
);
alter table private.assistant_agent_jobs enable row level security;
alter table private.assistant_agent_jobs force row level security;
create policy assistant_agent_jobs_migration on private.assistant_agent_jobs to masarifi_migration using(true) with check(true);
create index assistant_agent_jobs_ready on private.assistant_agent_jobs(user_id,next_attempt_at) where state in ('queued','processing');

create table private.assistant_agent_receipts (
  generation_hash text primary key check(generation_hash ~ '^[a-f0-9]{64}$'),
  job_id uuid not null references private.assistant_agent_jobs(id) on delete cascade,
  model text not null,provider text not null,input_tokens integer not null check(input_tokens>=0),
  output_tokens integer not null check(output_tokens>=0),cost numeric not null check(cost>=0),
  latency_ms integer not null check(latency_ms>=0),fallback_used boolean not null,created_at timestamptz not null default now()
);
alter table private.assistant_agent_receipts enable row level security;
alter table private.assistant_agent_receipts force row level security;
create policy assistant_agent_receipts_migration on private.assistant_agent_receipts to masarifi_migration using(true) with check(true);

create function private.enqueue_assistant_agent_message(
  p_user_id text,p_conversation_id uuid,p_content text,p_intent text,p_context_scope text[],
  p_context jsonb,p_evidence jsonb,p_history jsonb,p_response_mode text,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; message_id uuid;
begin
  perform private.ai_assert_owner(p_user_id);
  if p_context->>'assistantAgent' is distinct from '1' then
    raise exception using errcode='22023',message='AI_MESSAGE_INVALID';
  end if;
  result:=private.enqueue_assistant_message_v3(p_user_id,p_conversation_id,p_content,p_intent,
    p_context_scope,p_context,p_evidence,p_history,p_response_mode,p_operation_id);
  message_id:=(result->>'id')::uuid;
  -- One user question can make three decisions with at most two providers each.
  -- Keep one quota identity and reserve the full bounded cost before dispatch.
  if not exists(select 1 from private.assistant_agent_jobs where id=message_id) and
    exists(select 1 from private.ai_usage_events where request_id=p_operation_id::text and reservation_status='reserved') then
    if (select coalesce(sum(estimated_cost),0) from private.ai_usage_events where workload='financial_assistant'
        and budget_period=date_trunc('month',current_date)::date and reservation_status<>'released') +
       (select estimated_cost*5 from private.ai_usage_events where request_id=p_operation_id::text) >=
       (select (limits->>'monthlyBudget')::numeric from private.ai_feature_routes where workload='financial_assistant' and deleted_at is null)
      or (select coalesce(sum(estimated_cost),0) from private.ai_usage_events where budget_period=date_trunc('month',current_date)::date and reservation_status<>'released')+
       (select estimated_cost*5 from private.ai_usage_events where request_id=p_operation_id::text) >=
       (select (value#>>'{}')::numeric from private.system_settings where setting_key='ai.global.monthly_budget') then
      raise exception using errcode='P0001',message='AI_BUDGET_EXHAUSTED';
    end if;
    update private.ai_usage_events set estimated_cost=estimated_cost*6 where request_id=p_operation_id::text;
  end if;
  insert into private.assistant_agent_jobs(id,user_id) values(message_id,p_user_id) on conflict(id) do nothing;
  -- The separate job table owns the real lease; legacy workers must never claim this request.
  update public.assistant_messages set work_status='processing',lease_until='infinity',claimed_by='assistant-agent',claim_token=extensions.gen_random_uuid()
    where id=message_id and work_status='queued';
  return result;
end $$;

create function private.claim_assistant_agent_job(p_owner text,p_lease_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.assistant_agent_jobs%rowtype; message public.assistant_messages%rowtype;
begin
  if p_lease_seconds not between 30 and 180 then raise exception 'AI_CLAIM_INVALID'; end if;
  -- Close abandoned or invalid work without dispatching, including worker crashes at the retry ceiling.
  for job in select j.* from private.assistant_agent_jobs j
    join public.assistant_messages m on m.id=j.id
    join public.assistant_conversations c on c.id=m.conversation_id
    join public.profiles p on p.id=j.user_id
    where j.user_id=p_owner and j.state in ('queued','processing') and
      ((j.attempt_count>=3 and j.lease_until<=clock_timestamp()) or m.work_status<>'processing' or
       c.status<>'active' or c.deleted_at is not null or p.status<>'active' or p.deleted_at is not null or
       not exists(select 1 from public.assistant_consents s where s.user_id=j.user_id and s.policy_version='assistant-privacy-v1' and s.revoked_at is null))
    for update of j skip locked
  loop
    update private.assistant_agent_jobs set state='failed',claim_token=null,lease_until=null,
      failure_code='AI_WORK_CANCELLED',updated_at=clock_timestamp() where id=job.id;
    update public.assistant_messages set work_status='failed',failure_code='AI_WORK_CANCELLED',
      claim_token=null,claimed_by=null,lease_until=null where id=job.id and work_status='processing';
    update private.ai_usage_events u set reservation_status='failed',
      estimated_cost=case when job.uncertain_dispatch or job.dispatch_count>(select count(*) from private.assistant_agent_receipts where job_id=job.id)
        then u.estimated_cost else coalesce((select sum(cost) from private.assistant_agent_receipts where job_id=job.id),0) end
      where u.request_id=(select operation_id::text from public.assistant_messages where id=job.id);
  end loop;
  select j.* into job from private.assistant_agent_jobs j join public.assistant_messages m on m.id=j.id
    join public.assistant_conversations c on c.id=m.conversation_id
    where j.user_id=p_owner and j.state in ('queued','processing') and j.next_attempt_at<=clock_timestamp()
      and (j.lease_until is null or j.lease_until<=clock_timestamp()) and m.work_status='processing'
      and m.user_id=j.user_id and c.user_id=j.user_id and c.status='active' and c.deleted_at is null
      and exists(select 1 from public.profiles p where p.id=j.user_id and p.status='active' and p.deleted_at is null)
      and exists(select 1 from public.assistant_consents s where s.user_id=j.user_id and s.policy_version='assistant-privacy-v1' and s.revoked_at is null)
    order by j.next_attempt_at,j.id for update of j skip locked limit 1;
  if not found then return null; end if;
  update private.assistant_agent_jobs set state='processing',claim_token=extensions.gen_random_uuid(),
    lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempt_count=attempt_count+1,
    updated_at=clock_timestamp() where id=job.id returning * into job;
  update public.assistant_messages set claim_token=job.claim_token,attempt_count=job.attempt_count
    where id=job.id returning * into message;
  return jsonb_build_object('id',job.id,'userId',job.user_id,'claimToken',job.claim_token,
    'attempt',job.attempt_count,'operationId',message.operation_id,'content',message.content_redacted,
    'contextScope',message.context_scope,'context',message.context_payload,
    'timezone',(select timezone from public.profiles where id=job.user_id),
    'history',coalesce((select jsonb_agg(x.payload order by x.created_at,x.id) from (
      select h.id,h.created_at,jsonb_build_object('role',h.role,'content',left(h.content_redacted,2000)) payload
      from public.assistant_messages h where h.user_id=job.user_id and h.conversation_id=message.conversation_id
        and h.id<>job.id and h.work_status='completed' and h.created_at<=message.created_at
      order by h.created_at desc,h.id desc limit 16) x),'[]'::jsonb));
end $$;

create function private.authorize_assistant_agent_dispatch(p_id uuid,p_token uuid,p_route jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare job private.assistant_agent_jobs%rowtype;
begin
  select j.* into job from private.assistant_agent_jobs j
    join public.assistant_messages m on m.id=j.id and m.user_id=j.user_id
    join public.assistant_conversations c on c.id=m.conversation_id and c.user_id=j.user_id
    join public.profiles p on p.id=j.user_id
    where j.id=p_id and j.state='processing' and j.claim_token=p_token and j.lease_until>clock_timestamp()
      and m.work_status='processing' and c.status='active' and c.deleted_at is null
      and p.status='active' and p.deleted_at is null
      and exists(select 1 from public.assistant_consents s where s.user_id=j.user_id and s.policy_version='assistant-privacy-v1' and s.revoked_at is null)
    for update of j;
  if not found then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  if job.dispatch_count>=6 then raise exception using errcode='54000',message='AI_DISPATCH_LIMIT'; end if;
  if p_route is null or private.get_effective_ai_route('financial_assistant') is distinct from p_route
    or not (private.ai_quota_policy(job.user_id,'financial_assistant')->>'enabled')::boolean
    then raise exception using errcode='42501',message='AI_ROUTE_UNAVAILABLE'; end if;
  if not exists(select 1 from private.ai_usage_events u join public.assistant_messages m on u.request_id=m.operation_id::text
    where m.id=p_id and u.user_id=job.user_id and u.workload='financial_assistant'
      and u.budget_period=date_trunc('month',current_date)::date and u.reservation_status<>'released'
      and u.estimated_cost>=6*((p_route->'limits'->>'inputTokens')::numeric*(p_route->'maxPrice'->>'prompt')::numeric+
        (p_route->'limits'->>'outputTokens')::numeric*(p_route->'maxPrice'->>'completion')::numeric))
    then raise exception using errcode='P0001',message='AI_BUDGET_EXHAUSTED'; end if;
  update private.assistant_agent_jobs set dispatch_count=dispatch_count+1 where id=p_id;
  -- Persist potential cost before dispatch, including a crash before the receipt callback.
  -- The legacy stale-reservation rollup must never release charged assistant work.
  update private.ai_usage_events set reservation_status='completed'
    where request_id=(select operation_id::text from public.assistant_messages where id=p_id);
  return true;
end $$;

create function private.finish_assistant_agent_job(p_id uuid,p_token uuid,p_output jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.assistant_agent_jobs%rowtype; saved jsonb;
begin
  select * into job from private.assistant_agent_jobs where id=p_id and state='processing'
    and claim_token=p_token and lease_until>clock_timestamp() for update;
  if not found then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  if not exists(select 1 from public.assistant_messages m join public.assistant_conversations c on c.id=m.conversation_id
    where m.id=p_id and m.user_id=job.user_id and m.work_status='processing' and c.status='active' and c.deleted_at is null and c.user_id=job.user_id)
    then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  if not exists(select 1 from public.profiles where id=job.user_id and status='active' and deleted_at is null)
    or not exists(select 1 from public.assistant_consents where user_id=job.user_id and policy_version='assistant-privacy-v1' and revoked_at is null)
    then raise exception using errcode='42501',message='AI_CONSENT_REQUIRED'; end if;
  saved:=private.save_assistant_result(p_id,p_token,p_output->>'provider',p_output->>'model',
    p_output->>'content',p_output->'evidence',nullif(p_output->'preview','null'::jsonb));
  update public.assistant_messages set context_payload=context_payload||jsonb_build_object('assistantMetadata',p_output->'metadata') where id=p_id;
  -- The prompt is versioned with the deployed agent source, not the legacy global prompt.
  update public.assistant_messages set prompt_version_id=null,context_payload=context_payload||jsonb_build_object('assistantMetadata',p_output->'metadata')
    where id=(saved->>'messageId')::uuid;
  update private.assistant_agent_jobs set state='completed',claim_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_id;
  update private.ai_usage_events u set reservation_status='completed',
    estimated_cost=case when job.uncertain_dispatch or job.dispatch_count>(select count(*) from private.assistant_agent_receipts where job_id=p_id) then u.estimated_cost else coalesce((select sum(cost) from private.assistant_agent_receipts where job_id=p_id),u.estimated_cost) end
    where u.request_id=(select operation_id::text from public.assistant_messages where id=p_id);
  return saved;
end $$;

create function private.record_assistant_agent_receipt(p_id uuid,p_token uuid,p_receipt jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare job private.assistant_agent_jobs%rowtype;
begin
  select * into job from private.assistant_agent_jobs where id=p_id and claim_token=p_token
    and state='processing' and lease_until>clock_timestamp() for update;
  if not found then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  if p_receipt ? 'uncertain' then
    update private.assistant_agent_jobs set uncertain_dispatch=true where id=p_id; return true;
  end if;
  insert into private.assistant_agent_receipts(generation_hash,job_id,model,provider,input_tokens,output_tokens,cost,latency_ms,fallback_used)
    values(p_receipt->>'generationHash',p_id,p_receipt->>'model',p_receipt->>'provider',
      (p_receipt->'usage'->>'inputTokens')::integer,(p_receipt->'usage'->>'outputTokens')::integer,
      (p_receipt->'usage'->>'cost')::numeric,(p_receipt->>'latencyMs')::integer,(p_receipt->>'fallbackUsed')::boolean)
    on conflict(generation_hash) do nothing;
  update private.ai_usage_events u set model=p_receipt->>'model',provider=p_receipt->>'provider',
    input_tokens=(select sum(input_tokens) from private.assistant_agent_receipts where job_id=p_id),
    output_tokens=(select sum(output_tokens) from private.assistant_agent_receipts where job_id=p_id),
    latency_ms=(select sum(latency_ms) from private.assistant_agent_receipts where job_id=p_id),
    fallback_used=(select bool_or(fallback_used) from private.assistant_agent_receipts where job_id=p_id),
    estimated_cost=greatest(u.estimated_cost,(select sum(cost) from private.assistant_agent_receipts where job_id=p_id))
    where u.request_id=(select operation_id::text from public.assistant_messages where id=p_id);
  return true;
end $$;

create function private.fail_assistant_agent_job(p_id uuid,p_token uuid,p_code text,p_retry boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare job private.assistant_agent_jobs%rowtype;
begin
  select * into job from private.assistant_agent_jobs where id=p_id and state='processing'
    and claim_token=p_token and lease_until>clock_timestamp() for update;
  if not found then return false; end if;
  update private.ai_usage_events u set reservation_status='failed',
    estimated_cost=case when job.uncertain_dispatch or job.dispatch_count>(select count(*) from private.assistant_agent_receipts where job_id=p_id)
      then u.estimated_cost else coalesce((select sum(cost) from private.assistant_agent_receipts where job_id=p_id),0) end
    where u.request_id=(select operation_id::text from public.assistant_messages where id=p_id)
      and (not p_retry or job.attempt_count>=3 or not exists(select 1 from public.assistant_messages where id=p_id and work_status='processing'));
  if not exists(select 1 from public.assistant_messages where id=p_id and work_status='processing') then
    update private.assistant_agent_jobs set state='cancelled',claim_token=null,lease_until=null,updated_at=clock_timestamp() where id=p_id;
    return true;
  end if;
  update private.assistant_agent_jobs set state=case when p_retry and attempt_count<3 then 'queued' else 'failed' end,
    next_attempt_at=clock_timestamp()+interval '5 seconds',claim_token=null,lease_until=null,
    failure_code=p_code,updated_at=clock_timestamp() where id=p_id returning * into job;
  update public.assistant_messages set work_status=case when job.state='queued' then 'processing' else 'failed' end,
    failure_code=case when job.state='failed' then p_code else null end,
    claim_token=case when job.state='queued' then extensions.gen_random_uuid() else null end,
    claimed_by=case when job.state='queued' then 'assistant-agent' else null end,
    lease_until=case when job.state='queued' then 'infinity'::timestamptz else null end where id=p_id;
  return true;
end $$;

revoke all on private.assistant_agent_jobs from public,anon,authenticated,masarifi_api,masarifi_worker;
revoke all on private.assistant_agent_receipts from public,anon,authenticated,masarifi_api,masarifi_worker;
alter function private.enqueue_assistant_agent_message(text,uuid,text,text,text[],jsonb,jsonb,jsonb,text,uuid) owner to masarifi_migration;
alter function private.claim_assistant_agent_job(text,integer) owner to masarifi_migration;
alter function private.finish_assistant_agent_job(uuid,uuid,jsonb) owner to masarifi_migration;
alter function private.fail_assistant_agent_job(uuid,uuid,text,boolean) owner to masarifi_migration;
alter function private.record_assistant_agent_receipt(uuid,uuid,jsonb) owner to masarifi_migration;
alter function private.authorize_assistant_agent_dispatch(uuid,uuid,jsonb) owner to masarifi_migration;
revoke all on function private.enqueue_assistant_agent_message(text,uuid,text,text,text[],jsonb,jsonb,jsonb,text,uuid) from public;
revoke all on function private.claim_assistant_agent_job(text,integer) from public;
revoke all on function private.finish_assistant_agent_job(uuid,uuid,jsonb) from public;
revoke all on function private.fail_assistant_agent_job(uuid,uuid,text,boolean) from public;
revoke all on function private.record_assistant_agent_receipt(uuid,uuid,jsonb) from public;
revoke all on function private.authorize_assistant_agent_dispatch(uuid,uuid,jsonb) from public;
grant execute on function private.enqueue_assistant_agent_message(text,uuid,text,text,text[],jsonb,jsonb,jsonb,text,uuid) to masarifi_api;
grant execute on function private.claim_assistant_agent_job(text,integer) to masarifi_worker;
grant execute on function private.finish_assistant_agent_job(uuid,uuid,jsonb) to masarifi_worker;
grant execute on function private.fail_assistant_agent_job(uuid,uuid,text,boolean) to masarifi_worker;
grant execute on function private.record_assistant_agent_receipt(uuid,uuid,jsonb) to masarifi_worker;
grant execute on function private.authorize_assistant_agent_dispatch(uuid,uuid,jsonb) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
