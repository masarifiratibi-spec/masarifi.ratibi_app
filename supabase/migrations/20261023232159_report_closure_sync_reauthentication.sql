grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

alter table public.client_mutations add column authenticated_at timestamptz;

create or replace function private.guard_client_mutation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.user_id is distinct from new.user_id
    or old.device_id is distinct from new.device_id
    or old.operation_id is distinct from new.operation_id
    or old.domain is distinct from new.domain
    or old.resource_type is distinct from new.resource_type
    or old.schema_version is distinct from new.schema_version
    or old.depends_on is distinct from new.depends_on
    or old.resource_id is distinct from new.resource_id
    or old.operation is distinct from new.operation
    or old.base_version is distinct from new.base_version
    or old.payload_hash is distinct from new.payload_hash
    or old.payload is distinct from new.payload
    or old.created_at is distinct from new.created_at then
    raise exception using errcode='42501',message='SYNC_MUTATION_IMMUTABLE';
  end if;
  -- Only the security-definer receive function can refresh the same rejected operation.
  if old.status='rejected' and old.error->>'code'='RECENT_AUTH_REQUIRED'
    and new.status='received' and current_user='masarifi_migration'
    and new.authenticated_at is not null
    and new.authenticated_at > coalesce(old.authenticated_at, '-infinity'::timestamptz)
    and new.authenticated_at between clock_timestamp()-interval '61 seconds' and clock_timestamp()
    and new.error is null and new.result is null
    and new.locked_by is null and new.locked_until is null and new.lease_token is null then
    new.updated_at=clock_timestamp();
    return new;
  end if;
  if old.authenticated_at is distinct from new.authenticated_at then
    raise exception using errcode='42501',message='SYNC_MUTATION_IMMUTABLE';
  end if;
  if old.status in ('applied','conflict','rejected') and new is distinct from old then
    raise exception using errcode='42501',message='SYNC_MUTATION_TERMINAL';
  end if;
  if not (
    (old.status='received' and new.status in ('received','processing','rejected'))
    or (old.status='processing' and new.status in ('received','processing','applied','conflict','rejected'))
  ) then
    raise exception using errcode='42501',message='SYNC_MUTATION_STATE_INVALID';
  end if;
  new.updated_at=clock_timestamp();
  return new;
end $$;
alter function private.guard_client_mutation() owner to masarifi_migration;
revoke all on function private.guard_client_mutation() from public;
create or replace function private.receive_client_mutation(
  p_user_id text,p_device_id uuid,p_factor_age_seconds integer,p_operation_id uuid,p_domain text,
  p_resource_type text,p_schema_version integer,p_depends_on uuid[],p_operation text,
  p_resource_id text,p_base_version bigint,p_payload_hash text,p_payload jsonb
) returns table(
  outcome text,mutation_id uuid,status text,result jsonb,error jsonb
) language plpgsql security definer set search_path='' as $$
declare existing public.client_mutations; inserted_id uuid;
begin
  perform private.assert_active_sync_device(p_user_id,p_device_id);
  if p_operation_id is null or p_domain not in ('accounts','categories','transactions')
    or not ((p_domain='accounts' and p_resource_type='account')
      or (p_domain='categories' and p_resource_type='category')
      or (p_domain='transactions' and p_resource_type='transaction'))
    or p_schema_version<>1 or p_depends_on is null or cardinality(p_depends_on)>100
    or array_position(p_depends_on,null) is not null or p_operation_id=any(p_depends_on)
    or exists(select 1 from unnest(p_depends_on) d group by d having count(*)>1)
    or exists(
      select 1 from unnest(p_depends_on) d
      where not exists(
        select 1 from public.client_mutations dependency
        where dependency.user_id=p_user_id and dependency.operation_id=d
      )
    )
    or p_operation not in ('create','update','archive','restore','delete')
    or (p_resource_id is not null and (
      p_resource_id<>btrim(p_resource_id) or char_length(p_resource_id) not between 1 and 128
      or p_resource_id~'[[:cntrl:]]'
    ))
    or (p_base_version is not null and p_base_version<0)
    or (p_factor_age_seconds is not null and p_factor_age_seconds<0)
    or p_payload_hash is null or p_payload_hash!~'^sha256:[0-9a-f]{64}$'
    or p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>65536 then
    raise exception using errcode='22023',message='SYNC_MUTATION_INVALID';
  end if;
  insert into public.client_mutations(
    user_id,device_id,factor_age_seconds,authenticated_at,operation_id,domain,resource_type,schema_version,
    depends_on,operation,resource_id,base_version,payload_hash,payload
  ) values (
    p_user_id,p_device_id,p_factor_age_seconds,
    case when p_factor_age_seconds is not null then clock_timestamp()-make_interval(secs=>p_factor_age_seconds) end,
    p_operation_id,p_domain,p_resource_type,
    p_schema_version,p_depends_on,p_operation,p_resource_id,p_base_version,p_payload_hash,p_payload
  ) on conflict(user_id,operation_id) do nothing returning id into inserted_id;
  if inserted_id is not null then
    return query select 'received'::text,inserted_id,'received'::text,null::jsonb,null::jsonb;
    return;
  end if;
  select * into existing from public.client_mutations m
  where m.user_id=p_user_id and m.operation_id=p_operation_id for update;
  if existing.payload_hash<>p_payload_hash or existing.payload is distinct from p_payload
    or existing.domain is distinct from p_domain or existing.resource_type is distinct from p_resource_type
    or existing.operation is distinct from p_operation or existing.resource_id is distinct from p_resource_id
    or existing.base_version is distinct from p_base_version or existing.schema_version is distinct from p_schema_version
    or existing.depends_on is distinct from p_depends_on then
    return query select 'hash_mismatch'::text,existing.id,existing.status,existing.result,existing.error;
  elsif existing.device_id=p_device_id and existing.status='rejected'
    and existing.error->>'code'='RECENT_AUTH_REQUIRED'
    and p_factor_age_seconds between 0 and 60
    and clock_timestamp()-make_interval(secs=>p_factor_age_seconds)
      > coalesce(existing.authenticated_at, '-infinity'::timestamptz) then
    update public.client_mutations m set status='received',
      authenticated_at=clock_timestamp()-make_interval(secs=>p_factor_age_seconds),
      error=null,result=null,processed_at=null,next_attempt_at=null,attempt_count=0
    where m.id=existing.id;
    return query select 'received'::text,existing.id,'received'::text,null::jsonb,null::jsonb;
  else
    return query select 'replay'::text,existing.id,existing.status,existing.result,existing.error;
  end if;
end $$;
alter function private.receive_client_mutation(text,uuid,integer,uuid,text,text,integer,uuid[],text,text,bigint,text,jsonb) owner to masarifi_migration;
revoke all on function private.receive_client_mutation(text,uuid,integer,uuid,text,text,integer,uuid[],text,text,bigint,text,jsonb) from public;


-- A protected parent awaiting re-verification must not terminally reject its dependent edits.
create or replace function private.claim_client_mutations(
  p_worker_id text,p_limit_count integer,p_lease_seconds integer
) returns setof public.client_mutations
language plpgsql security definer set search_path='' as $$
begin
  if p_worker_id is null or p_worker_id<>btrim(p_worker_id)
    or char_length(p_worker_id) not between 1 and 128 or p_worker_id~'[[:cntrl:]]'
    or p_limit_count is null or p_limit_count not between 1 and 100
    or p_lease_seconds is null or p_lease_seconds not between 1 and 300 then
    raise exception using errcode='22023',message='SYNC_MUTATION_CLAIM_INVALID';
  end if;
  with blocked as (
    select m.id from public.client_mutations m
    where m.status='received' and exists(
      select 1 from unnest(m.depends_on) dependency_id
      join public.client_mutations dependency
        on dependency.user_id=m.user_id and dependency.operation_id=dependency_id
      where dependency.status in ('conflict','rejected')
        and not (dependency.status='rejected' and dependency.error->>'code'='RECENT_AUTH_REQUIRED')
    )
    order by m.created_at,m.id for update skip locked limit p_limit_count
  )
  update public.client_mutations m set status='rejected',processed_at=clock_timestamp(),
    error=jsonb_build_object('code','SYNC_DEPENDENCY_REJECTED')
  from blocked where m.id=blocked.id;

  return query
  with eligible as (
    select m.id from public.client_mutations m
    where (
      m.status='received' and (m.next_attempt_at is null or m.next_attempt_at<=clock_timestamp())
      and not exists(
        select 1 from unnest(m.depends_on) dependency_id
        join public.client_mutations dependency
          on dependency.user_id=m.user_id and dependency.operation_id=dependency_id
        where dependency.status<>'applied'
      )
    ) or (m.status='processing' and m.locked_until<=clock_timestamp())
    order by coalesce(m.next_attempt_at,m.created_at),m.created_at,m.id
    for update skip locked limit p_limit_count
  )
  update public.client_mutations m set
    status='processing',attempt_count=m.attempt_count+1,
    locked_by=btrim(p_worker_id),locked_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),
    lease_token=extensions.gen_random_uuid(),next_attempt_at=null
  from eligible where m.id=eligible.id returning m.*;
end $$;
alter function private.claim_client_mutations(text,integer,integer) owner to masarifi_migration;
revoke all on function private.claim_client_mutations(text,integer,integer) from public;


reset role;
revoke masarifi_migration from current_user granted by current_user;
