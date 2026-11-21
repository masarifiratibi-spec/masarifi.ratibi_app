grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Engagement receipts reuse owner-erased storage without changing the financial bridge.

create function private.claim_engagement_key(
  p_actor_id text,
  p_scope text,
  p_key_hash text,
  p_request_hash text,
  p_ttl interval
) returns table(
  outcome text,
  response_status integer,
  response_body jsonb,
  resource_ref text,
  retry_after_seconds integer
) language plpgsql security definer set search_path='' as $$
declare
  existing private.idempotency_keys;
  inserted_id uuid;
  now_at timestamptz := clock_timestamp();
begin
  perform private.assert_active_profile(p_actor_id);
  if p_actor_id is distinct from public.current_clerk_user_id() or p_scope is null or p_scope !~ '^engagement\.[a-z][a-z0-9_.-]{2,115}$' then
    raise exception using errcode='42501',message='ENGAGEMENT_COMMAND_FORBIDDEN';
  end if;
  if p_scope is null or p_scope !~ '^[a-z][a-z0-9_.-]{2,127}$'
    or p_key_hash is null or p_key_hash !~ '^sha256:[0-9a-f]{64}$'
    or p_request_hash is null or p_request_hash !~ '^sha256:[0-9a-f]{64}$'
    or p_ttl is null or p_ttl<interval '1 minute' or p_ttl>interval '24 hours' then
    raise exception using errcode='22023',message='IDEMPOTENCY_KEY_INVALID';
  end if;

  insert into private.idempotency_keys(
    actor_id,scope,key_hash,request_hash,locked_until,expires_at
  ) values (
    p_actor_id,p_scope,p_key_hash,p_request_hash,now_at+p_ttl,now_at+interval '30 days'
  ) on conflict(actor_id,scope,key_hash) do nothing returning id into inserted_id;
  if inserted_id is not null then
    return query select 'new'::text,null::integer,null::jsonb,null::text,null::integer;
    return;
  end if;

  select * into existing from private.idempotency_keys k
  where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash
  for update;
  if existing.request_hash<>p_request_hash then
    return query select 'hash_mismatch'::text,null::integer,null::jsonb,null::text,null::integer;
    return;
  elsif existing.state='completed' then
    return query select 'replay'::text,existing.response_status,existing.response_body,
      existing.resource_ref,null::integer;
    return;
  elsif existing.state='claimed' and existing.locked_until>now_at then
    return query select 'in_progress'::text,null::integer,null::jsonb,null::text,
      greatest(1,ceil(extract(epoch from existing.locked_until-now_at)))::integer;
    return;
  end if;

  update private.idempotency_keys set state='claimed',locked_until=now_at+p_ttl,
    response_status=null,response_body=null,resource_ref=null
  where id=existing.id;
  return query select 'new'::text,null::integer,null::jsonb,null::text,null::integer;
end $$;
alter function private.claim_engagement_key(text,text,text,text,interval) owner to masarifi_migration;
revoke all on function private.claim_engagement_key(text,text,text,text,interval) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.claim_engagement_key(text,text,text,text,interval) to masarifi_api;

create function private.complete_engagement_key(
  p_actor_id text,
  p_scope text,
  p_key_hash text,
  p_request_hash text,
  p_response_status integer,
  p_response_body jsonb,
  p_resource_ref text
) returns void language plpgsql security definer set search_path='' as $$
declare existing private.idempotency_keys;
begin
  perform private.assert_active_profile(p_actor_id);
  if p_actor_id is distinct from public.current_clerk_user_id() or p_scope is null or p_scope !~ '^engagement\.[a-z][a-z0-9_.-]{2,115}$' then
    raise exception using errcode='42501',message='ENGAGEMENT_COMMAND_FORBIDDEN';
  end if;
  if p_response_status not between 100 and 599
    or p_response_body is null or jsonb_typeof(p_response_body)<>'object'
    or pg_column_size(p_response_body)>65536 then
    raise exception using errcode='22023',message='IDEMPOTENCY_RESPONSE_INVALID';
  end if;
  select * into existing from private.idempotency_keys k
  where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash
  for update;
  if existing.id is null then
    raise exception using errcode='P0001',message='IDEMPOTENCY_CLAIM_MISSING';
  elsif existing.request_hash<>p_request_hash then
    raise exception using errcode='P0001',message='IDEMPOTENCY_KEY_REUSED';
  elsif existing.state='completed' then
    if existing.response_status=p_response_status and existing.response_body=p_response_body
      and existing.resource_ref is not distinct from p_resource_ref then return; end if;
    raise exception using errcode='P0001',message='IDEMPOTENCY_RESPONSE_MISMATCH';
  elsif existing.state<>'claimed' then
    raise exception using errcode='P0001',message='IDEMPOTENCY_CLAIM_INVALID';
  end if;
  update private.idempotency_keys set state='completed',response_status=p_response_status,
    response_body=p_response_body,resource_ref=p_resource_ref
  where id=existing.id;
end $$;
alter function private.complete_engagement_key(text,text,text,text,integer,jsonb,text) owner to masarifi_migration;
revoke all on function private.complete_engagement_key(text,text,text,text,integer,jsonb,text) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.complete_engagement_key(text,text,text,text,integer,jsonb,text) to masarifi_api;
