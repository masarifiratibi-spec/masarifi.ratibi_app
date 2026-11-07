grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create function private.enqueue_assistant_message_v3(
  p_user_id text,
  p_conversation_id uuid,
  p_content text,
  p_intent text,
  p_context_scope text[],
  p_context jsonb,
  p_evidence jsonb,
  p_history jsonb,
  p_response_mode text,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.assistant_messages%rowtype;
begin
  perform private.ai_assert_owner(p_user_id);
  if not exists(select 1 from public.assistant_consents where user_id=p_user_id and revoked_at is null)
    then raise exception using errcode='42501',message='AI_CONSENT_REQUIRED'; end if;
  if not exists(select 1 from public.assistant_conversations where id=p_conversation_id and user_id=p_user_id and status='active')
    or octet_length(btrim(p_content)) not between 1 and 8192
    or p_response_mode not in ('async','stream')
    or p_intent is null
    or p_context_scope is null
    or cardinality(p_context_scope)>5
    or not p_context_scope <@ array['accounts_summary','recent_transactions','budgets','obligations','tracking_reviews']::text[]
    then raise exception using errcode='22023',message='AI_MESSAGE_INVALID'; end if;
  select * into m from public.assistant_messages where operation_id=p_operation_id and user_id=p_user_id;
  if not found then
    insert into public.assistant_messages(
      user_id,conversation_id,role,content_redacted,intent,context_scope,context_payload,
      evidence_payload,history_payload,operation_id,work_status,response_mode
    ) values(
      p_user_id,p_conversation_id,'user',left(btrim(p_content),8192),p_intent,p_context_scope,
      p_context,p_evidence,p_history,p_operation_id,'queued',p_response_mode
    ) returning * into m;
    update public.assistant_conversations set last_message_at=m.created_at where id=p_conversation_id;
  end if;
  return to_jsonb(m)-array[
    'user_id','claim_token','claimed_by','lease_until','context_scope','context_payload',
    'evidence_payload','history_payload'
  ];
end $$;
alter function private.enqueue_assistant_message_v3(text,uuid,text,text,text[],jsonb,jsonb,jsonb,text,uuid) owner to masarifi_migration;
revoke all on function private.enqueue_assistant_message_v3(text,uuid,text,text,text[],jsonb,jsonb,jsonb,text,uuid) from public;
grant execute on function private.enqueue_assistant_message_v3(text,uuid,text,text,text[],jsonb,jsonb,jsonb,text,uuid) to masarifi_api;

create or replace function private.get_assistant_work_input_v2(p_id uuid,p_claim_token uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id',m.id,
    'operationId',m.operation_id,
    'content',m.content_redacted,
    'intent',m.intent,
    'contextScope',m.context_scope,
    'contextPayload',m.context_payload,
    'historyPayload',m.history_payload,
    'evidence',m.evidence_payload,
    'aliases',coalesce((select jsonb_agg(reference order by reference->>'alias') from (
      select jsonb_build_object(
        'alias','ACCOUNT-'||a.ordinality,'kind','account','id',a.id,'version',a.version,
        'data',jsonb_build_object('currency',btrim(a.currency_code::text),'type',a.type,'isDefault',a.is_default)
      ) reference
      from (
        select a.*,row_number() over(order by a.is_default desc,a.sort_order,a.id) ordinality
        from public.accounts a where a.user_id=m.user_id and a.status='active' and a.deleted_at is null
      ) a where a.ordinality<=10
        and m.intent in ('create_transaction','update_transaction','create_savings_goal')
        and 'accounts_summary'=any(m.context_scope)
      union all
      select jsonb_build_object(
        'alias','CATEGORY-'||c.ordinality,'kind','category','id',c.id,'version',c.version,
        'data',jsonb_build_object('kind',c.kind,'labelAr',c.label_ar,'labelEn',c.label_en)
      )
      from (
        select c.*,row_number() over(order by c.user_id nulls first,c.sort_order,c.id) ordinality
        from public.categories c
        where c.active and c.deleted_at is null and (c.user_id is null or c.user_id=m.user_id)
      ) c where c.ordinality<=20 and (
        (m.intent in ('create_transaction','update_transaction') and 'recent_transactions'=any(m.context_scope))
        or (m.intent='update_budget' and 'budgets'=any(m.context_scope))
      )
      union all
      select jsonb_build_object(
        'alias','TRANSACTION-'||t.ordinality,'kind','transaction','id',t.id,'version',t.version,
        'data',jsonb_build_object('kind',t.kind,'amountMinor',t.amount_minor::text,'currency',btrim(t.currency_code::text),'occurredAt',t.occurred_at)
      )
      from (
        select t.*,row_number() over(order by t.occurred_at desc,t.id) ordinality
        from public.transactions t where t.user_id=m.user_id and t.deleted_at is null
      ) t where t.ordinality<=20 and m.intent='update_transaction'
        and 'recent_transactions'=any(m.context_scope)
      union all
      select jsonb_build_object(
        'alias','BUDGET-'||b.ordinality,'kind','budget','id',b.id,'version',b.version,
        'data',jsonb_build_object('name',b.name,'currency',btrim(b.currency_code::text),'periodStart',b.period_start,'periodEnd',b.period_end)
      )
      from (
        select b.*,row_number() over(order by b.period_start desc,b.id) ordinality
        from public.budgets b where b.user_id=m.user_id and b.deleted_at is null
      ) b where b.ordinality<=10 and m.intent='update_budget' and 'budgets'=any(m.context_scope)
      union all
      select jsonb_build_object(
        'alias','OBLIGATION-'||o.ordinality,'kind','obligation','id',o.id,'version',o.version,
        'data',jsonb_build_object('name',o.name,'currency',btrim(o.currency_code::text),'direction',o.direction,'status',o.status)
      )
      from (
        select o.*,row_number() over(order by o.created_at desc,o.id) ordinality
        from public.obligations o where o.user_id=m.user_id and o.deleted_at is null
      ) o where o.ordinality<=10 and m.intent='record_obligation_payment'
        and 'obligations'=any(m.context_scope)
      union all
      select jsonb_build_object(
        'alias','REVIEW-'||r.ordinality,'kind','review','id',r.id,'version',r.version,
        'data',jsonb_build_object('reason',r.reason,'status',r.status)
      )
      from (
        select r.*,row_number() over(order by r.created_at desc,r.id) ordinality
        from public.review_items r where r.user_id=m.user_id and r.status='pending'
      ) r where r.ordinality<=10 and m.intent='resolve_tracking_review'
        and 'tracking_reviews'=any(m.context_scope)
    ) aliases),'[]'::jsonb)
  ) into result
  from public.assistant_messages m
  where m.id=p_id and m.claim_token=p_claim_token and m.work_status='processing'
    and m.lease_until>clock_timestamp()
    and exists(select 1 from public.assistant_consents c where c.user_id=m.user_id and c.revoked_at is null);
  if result is null then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  return result;
end $$;
alter function private.get_assistant_work_input_v2(uuid,uuid) owner to masarifi_migration;
revoke all on function private.get_assistant_work_input_v2(uuid,uuid) from public;
grant execute on function private.get_assistant_work_input_v2(uuid,uuid) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
