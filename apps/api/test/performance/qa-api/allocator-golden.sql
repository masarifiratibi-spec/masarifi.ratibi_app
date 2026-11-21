-- Test-only, unqualified until real rollback/restoration admission passes.
-- The private coordinator creates this exact owned schema as the database owner,
-- then switches to its migration owner inside the same DDL transaction.
revoke all on schema qa_perf_golden_v2 from public;

create table qa_perf_golden_v2.run (
  singleton boolean primary key check (singleton),
  run_id text not null check (run_id in ('golden_v2_20261102_1')),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  armed boolean not null,
  created_at timestamptz not null default clock_timestamp(),
  lease_until timestamptz not null,
  hard_deadline timestamptz not null,
  check (lease_until > created_at and lease_until <= hard_deadline),
  check (hard_deadline > created_at and hard_deadline <= created_at + interval '90 minutes')
);
create table qa_perf_golden_v2.bindings (
  owner text primary key,
  session_id text unique not null,
  check ((owner,session_id) in (
   ('perf_20261102_t0','qa_session_primary_0'),
   ('perf_20261102_t1000','qa_session_primary_1000'),
   ('perf_20261102_t10000','qa_session_primary_10000'),
   ('perf_20261102_secondary','qa_session_secondary')))
);
create table qa_perf_golden_v2.entries (
  owner text not null references qa_perf_golden_v2.bindings(owner),
  entity text not null check (entity in ('accounts','categories','transactions')),
  ordinal integer not null check (ordinal >= 0),
  id uuid unique not null check (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  primary key (owner,entity,ordinal)
);
create table qa_perf_golden_v2.cursors (
  owner text not null references qa_perf_golden_v2.bindings(owner),
  entity text not null check (entity in ('accounts','categories','transactions')),
  next_ordinal integer not null default 0 check (next_ordinal >= 0),
  primary key (owner,entity)
);
revoke all on all tables in schema qa_perf_golden_v2 from public,masarifi_api;

create function qa_perf_golden_v2.allocate(p_entity text)
returns uuid language plpgsql volatile security definer set search_path = '' as $qa$
declare
  claims jsonb;
  owner_id text;
  allocation_ordinal integer;
  allocation_id uuid;
  active_run qa_perf_golden_v2.run%rowtype;
begin
  if session_user <> 'masarifi_perf_r2_api_20261102'
    or p_entity is null or p_entity not in ('accounts','categories','transactions') then
    raise exception using errcode='P0001',message='QA_ID_CALLER_OR_ENTITY_DENIED';
  end if;
  begin
    claims := coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
  exception when invalid_text_representation then
    raise exception using errcode='P0001',message='QA_ID_CLAIMS_INVALID';
  end;
  owner_id := claims->>'sub';
  if coalesce(claims->>'role','') <> 'authenticated'
    or not exists (select 1 from qa_perf_golden_v2.bindings b
      where b.owner=owner_id and b.session_id=claims->>'sid') then
    raise exception using errcode='P0001',message='QA_ID_OWNER_SESSION_DENIED';
  end if;
  select c.next_ordinal into allocation_ordinal from qa_perf_golden_v2.cursors c
    where c.owner=owner_id and c.entity=p_entity for update;
  if not found then
    raise exception using errcode='P0001',message='QA_ID_CURSOR_MISSING';
  end if;
  select r.* into active_run from qa_perf_golden_v2.run r where r.singleton for share;
  if not found or not active_run.armed
    or active_run.run_id not in ('golden_v2_20261102_1')
    or active_run.lease_until<=clock_timestamp() or active_run.hard_deadline<=clock_timestamp() then
    raise exception using errcode='P0001',message='QA_ID_RUN_INACTIVE';
  end if;
  select e.id into allocation_id from qa_perf_golden_v2.entries e
    where e.owner=owner_id and e.entity=p_entity and e.ordinal=allocation_ordinal;
  if not found then
    raise exception using errcode='P0001',message='QA_ID_EXHAUSTED';
  end if;
  update qa_perf_golden_v2.cursors set next_ordinal=next_ordinal+1
    where owner=owner_id and entity=p_entity;
  return allocation_id;
end $qa$;
revoke all on function qa_perf_golden_v2.allocate(text) from public;
grant usage on schema qa_perf_golden_v2 to masarifi_api;
grant execute on function qa_perf_golden_v2.allocate(text) to masarifi_api;

alter table public.accounts alter column id set default qa_perf_golden_v2.allocate('accounts');
alter table public.categories alter column id set default qa_perf_golden_v2.allocate('categories');
alter table public.transactions alter column id set default qa_perf_golden_v2.allocate('transactions');

-- Unexpected inherited default ACLs abort the entire coordinator-owned transaction.
do $acl$
begin
  if exists (
    select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where n.nspname='qa_perf_golden_v2' and c.relkind='r' and a.grantee<>c.relowner
  ) or exists (
    select 1 from pg_catalog.pg_namespace n cross join lateral pg_catalog.aclexplode(n.nspacl) a
    where n.nspname='qa_perf_golden_v2' and a.grantee<>n.nspowner
      and (a.grantee<>'masarifi_api'::regrole or a.privilege_type<>'USAGE' or a.is_grantable)
  ) or exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    cross join lateral pg_catalog.aclexplode(p.proacl) a
    where n.nspname='qa_perf_golden_v2' and a.grantee<>p.proowner
      and (a.grantee<>'masarifi_api'::regrole or a.privilege_type<>'EXECUTE' or a.is_grantable)
  ) then
    raise exception using errcode='P0001',message='QA_HELPER_ACL_UNEXPECTED';
  end if;
end $acl$;
