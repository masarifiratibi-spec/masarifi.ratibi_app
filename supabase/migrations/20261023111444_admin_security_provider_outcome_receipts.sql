grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- A committed local command does not prove that the external provider completed it.
create table private.security_provider_outcomes (
  actor_id text not null,
  scope text not null check (scope in ('security.createadmininvitation','security.revokeadminsessions','security.disableadmin')),
  key_hash text not null,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key(actor_id,scope,key_hash),
  foreign key(actor_id,scope,key_hash) references private.idempotency_keys(actor_id,scope,key_hash) on delete cascade,
  check ((status='completed' and result is not null and jsonb_typeof(result)='object' and pg_column_size(result)<=65536)
    or (status<>'completed' and result is null))
);
alter table private.security_provider_outcomes enable row level security;
revoke all on private.security_provider_outcomes from public,anon,authenticated,masarifi_api,masarifi_worker;

create function private.start_security_provider_outcome(p_actor_id text,p_scope text,p_key_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_security_replay_actor(p_actor_id,p_scope);
  if not exists(select 1 from private.idempotency_keys k where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash and k.state='completed') then
    raise exception using errcode='42501',message='SECURITY_PROVIDER_COMMAND_MISSING';
  end if;
  insert into private.security_provider_outcomes(actor_id,scope,key_hash) values(p_actor_id,p_scope,p_key_hash);
end $$;

create function private.read_security_provider_outcome(p_actor_id text,p_scope text,p_key_hash text)
returns table(status text,result jsonb) language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_security_replay_actor(p_actor_id,p_scope);
  return query select r.status,r.result from private.security_provider_outcomes r
    where r.actor_id=p_actor_id and r.scope=p_scope and r.key_hash=p_key_hash;
end $$;

create function private.finish_security_provider_outcome(p_actor_id text,p_scope text,p_key_hash text,p_status text,p_result jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_security_replay_actor(p_actor_id,p_scope);
  if p_status not in ('completed','failed') or p_status is null then
    raise exception using errcode='22023',message='SECURITY_PROVIDER_OUTCOME_INVALID';
  end if;
  update private.security_provider_outcomes r set status=p_status,
    result=case when p_status='completed' then p_result else null end,completed_at=clock_timestamp()
    where r.actor_id=p_actor_id and r.scope=p_scope and r.key_hash=p_key_hash and r.status='pending';
  if not found then raise exception using errcode='P0001',message='SECURITY_PROVIDER_OUTCOME_NOT_PENDING'; end if;
end $$;

alter function private.start_security_provider_outcome(text,text,text) owner to masarifi_migration;
alter function private.read_security_provider_outcome(text,text,text) owner to masarifi_migration;
alter function private.finish_security_provider_outcome(text,text,text,text,jsonb) owner to masarifi_migration;
revoke all on function private.start_security_provider_outcome(text,text,text),private.read_security_provider_outcome(text,text,text),private.finish_security_provider_outcome(text,text,text,text,jsonb) from public,anon,authenticated,masarifi_worker;
grant execute on function private.start_security_provider_outcome(text,text,text),private.read_security_provider_outcome(text,text,text),private.finish_security_provider_outcome(text,text,text,text,jsonb) to masarifi_api;
