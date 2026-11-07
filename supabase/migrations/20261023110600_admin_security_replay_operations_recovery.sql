grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- Keep financial/tracking admission unchanged; security commands share the durable lease store.
create function private.assert_security_replay_actor(p_actor_id text,p_scope text) returns void
language plpgsql security definer set search_path='' as $$
declare permission_key text;
begin
  if p_actor_id is distinct from public.current_clerk_user_id() then
    raise exception using errcode='42501',message='SECURITY_REPLAY_ACTOR_DENIED';
  end if;
  perform private.assert_active_profile(p_actor_id);
  permission_key:=case p_scope
    when 'security.disableadmin' then 'admin-team.disable'
    when 'security.revokeadminsessions' then 'admin-team.sessions.revoke'
    when 'security.createadmininvitation' then 'access.invites.write'
    when 'security.createrole' then 'access.roles.write'
    when 'security.updaterole' then 'access.roles.write'
    when 'security.assignadminrole' then 'access.assignments.write'
    when 'security.revokeadminrole' then 'access.assignments.write'
    when 'security.createsupportaccessrequest' then 'support.access.request'
    when 'security.decidesupportaccessrequest' then 'support.access.approve'
    when 'security.revokesupportaccess' then 'support.access.revoke'
    when 'security.endsupportaccess' then 'support.access.use'
    when 'security.createsecurityincident' then 'security.incidents.manage'
    when 'security.updatesecurityincident' then 'security.incidents.manage'
    when 'security.actonprivacyexport' then 'privacy.exports.manage'
    when 'security.actondeletionrequest' then 'privacy.deletions.manage'
    when 'security.updateretentionpolicy' then 'retention.write'
    when 'security.createretentionhold' then 'retention.write'
    when 'security.releaseretentionhold' then 'retention.write'
    when 'security.acceptadmininvitation' then 'self'
    when 'security.decidemysupportaccessrequest' then 'self'
    when 'security.createmyprivacyexport' then 'self'
    when 'security.createmydeletionrequest' then 'self'
    when 'security.cancelmydeletionrequest' then 'self'
    else null end;
  if permission_key is null then raise exception using errcode='42501',message='SECURITY_REPLAY_OPERATION_DENIED'; end if;
  if permission_key<>'self' then perform private.assert_admin_permission(permission_key); end if;
end $$;
alter function private.assert_security_replay_actor(text,text) owner to masarifi_migration;
revoke all on function private.assert_security_replay_actor(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;

create function private.claim_security_idempotency(
  p_actor_id text,p_scope text,p_key_hash text,p_request_hash text,p_ttl interval
) returns table(
  outcome text,response_status integer,response_body jsonb,resource_ref text,
  retry_after_seconds integer,lease_token uuid
) language plpgsql security definer set search_path='' as $$
declare existing private.idempotency_keys; inserted_id uuid; new_token uuid:=extensions.gen_random_uuid();
  now_at timestamptz:=clock_timestamp();
begin
  perform private.assert_security_replay_actor(p_actor_id,p_scope);
  if p_scope is null or p_scope !~ '^security\.[a-z]+$'
    or p_key_hash is null or p_key_hash !~ '^sha256:[0-9a-f]{64}$'
    or p_request_hash is null or p_request_hash !~ '^sha256:[0-9a-f]{64}$'
    or p_ttl is null or p_ttl<interval '1 minute' or p_ttl>interval '24 hours' then
    raise exception using errcode='22023',message='IDEMPOTENCY_KEY_INVALID'; end if;
  insert into private.idempotency_keys(actor_id,scope,key_hash,request_hash,locked_until,expires_at,lease_token)
  values(p_actor_id,p_scope,p_key_hash,p_request_hash,now_at+p_ttl,now_at+interval '30 days',new_token)
  on conflict(actor_id,scope,key_hash) do nothing returning id into inserted_id;
  if inserted_id is not null then
    return query select 'new'::text,null::integer,null::jsonb,null::text,null::integer,new_token; return;
  end if;
  select * into existing from private.idempotency_keys k
  where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash for update;
  if existing.request_hash<>p_request_hash then
    return query select 'hash_mismatch'::text,null::integer,null::jsonb,null::text,null::integer,null::uuid;
  elsif existing.state='completed' then
    return query select 'replay'::text,existing.response_status,existing.response_body,existing.resource_ref,null::integer,null::uuid;
  elsif existing.state='claimed' and existing.locked_until>now_at then
    return query select 'in_progress'::text,null::integer,null::jsonb,null::text,
      greatest(1,ceil(extract(epoch from existing.locked_until-now_at)))::integer,null::uuid;
  else
    update private.idempotency_keys set state='claimed',locked_until=now_at+p_ttl,response_status=null,
      response_body=null,resource_ref=null,lease_token=new_token where id=existing.id;
    return query select 'new'::text,null::integer,null::jsonb,null::text,null::integer,new_token;
  end if;
end $$;

create function private.complete_security_idempotency(
  p_actor_id text,p_scope text,p_key_hash text,p_request_hash text,p_lease_token uuid,
  p_response_status integer,p_response_body jsonb,p_resource_ref text
) returns void language plpgsql security definer set search_path='' as $$
declare existing private.idempotency_keys;
begin
  perform private.assert_security_replay_actor(p_actor_id,p_scope);
  if p_lease_token is null or p_response_status not between 100 and 599
    or p_response_body is null or jsonb_typeof(p_response_body)<>'object'
    or pg_column_size(p_response_body)>65536 then
    raise exception using errcode='22023',message='IDEMPOTENCY_RESPONSE_INVALID'; end if;
  select * into existing from private.idempotency_keys k
  where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash for update;
  if existing.id is null then raise exception using errcode='P0001',message='IDEMPOTENCY_CLAIM_MISSING';
  elsif existing.request_hash<>p_request_hash then raise exception using errcode='P0001',message='IDEMPOTENCY_KEY_REUSED';
  elsif existing.state='completed' then
    if existing.response_status=p_response_status and existing.response_body=p_response_body
      and existing.resource_ref is not distinct from p_resource_ref then return; end if;
    raise exception using errcode='P0001',message='IDEMPOTENCY_RESPONSE_MISMATCH';
  elsif existing.state<>'claimed' or existing.lease_token is distinct from p_lease_token then
    raise exception using errcode='P0001',message='IDEMPOTENCY_LEASE_LOST';
  end if;
  update private.idempotency_keys set state='completed',response_status=p_response_status,
    response_body=p_response_body,resource_ref=p_resource_ref where id=existing.id;
end $$;

alter function private.claim_security_idempotency(text,text,text,text,interval) owner to masarifi_migration;
alter function private.complete_security_idempotency(text,text,text,text,uuid,integer,jsonb,text) owner to masarifi_migration;
revoke all on function private.claim_security_idempotency(text,text,text,text,interval),private.complete_security_idempotency(text,text,text,text,uuid,integer,jsonb,text) from public,anon,authenticated,masarifi_worker;
grant execute on function private.claim_security_idempotency(text,text,text,text,interval),private.complete_security_idempotency(text,text,text,text,uuid,integer,jsonb,text) to masarifi_api;

-- CHECK constraints execute this pure validator as the inserting API role.
grant execute on function private.is_valid_support_scope(jsonb) to masarifi_api;
