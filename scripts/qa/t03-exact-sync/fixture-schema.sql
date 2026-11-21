-- Synthetic compatibility fixture: no profiles, foreign keys, product ledger, or production migrations.
create role masarifi_migration nologin;
create role masarifi_worker nologin nosuperuser nobypassrls;
create role t03_bootstrap login nosuperuser bypassrls noinherit;
create role t03_no_select login nosuperuser bypassrls noinherit;
create role t03_filtered login nosuperuser nobypassrls noinherit;
create role t03_no_role login nosuperuser bypassrls noinherit;
create role t03_normal login nosuperuser nobypassrls noinherit;
grant masarifi_worker to t03_normal with inherit false,set true;
grant execute on function pg_control_system() to t03_bootstrap,t03_filtered,t03_no_select,t03_no_role;
create schema private authorization masarifi_migration;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema private,extensions to masarifi_worker,masarifi_migration;
grant usage on schema private,extensions to t03_bootstrap,t03_filtered,t03_no_select,t03_no_role;

create table public.client_mutations (
  id uuid primary key default extensions.gen_random_uuid(), user_id text not null, device_id uuid not null,
  factor_age_seconds integer, authenticated_at timestamptz,
  operation_id uuid not null, domain text not null, resource_type text not null, schema_version integer not null,
  depends_on uuid[] not null default '{}', resource_id text, operation text not null, base_version bigint,
  payload_hash text not null, payload jsonb not null, status text not null default 'received', result jsonb,error jsonb,
  attempt_count integer not null default 0,next_attempt_at timestamptz,locked_by text,locked_until timestamptz,
  lease_token uuid,processed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(user_id,operation_id),
  check ((status='processing')=(locked_by is not null and locked_until is not null and lease_token is not null)),
  check ((status in ('applied','conflict','rejected'))=(processed_at is not null))
);
alter table public.client_mutations owner to masarifi_migration;
alter table public.client_mutations enable row level security;
create policy synthetic_filtered on public.client_mutations for select to t03_filtered using (user_id='hidden-owner');

create table public.transactions (
  id uuid primary key,user_id text not null,kind text not null,status text not null,amount_minor bigint not null,
  fee_minor bigint not null default 0,currency_code text not null,category_id uuid,title text not null,
  merchant text,payment_method text,note text,occurred_at timestamptz not null,version bigint not null
);
create table public.transaction_postings (
  id uuid primary key,transaction_id uuid not null,account_id uuid not null,amount_minor bigint not null,
  clearing_state text not null,posting_role text not null,occurred_at timestamptz not null
);
-- Models an external idempotent handler; this is NOT the product ledger.
create table public.synthetic_external_effects (operation_id uuid primary key,mutation_id uuid not null,note text not null,principal jsonb not null);
-- Predicate-only synthetic relation; this protocol fixture is not the product ledger.
create table public.salary_receipts(id uuid primary key,user_id text not null,transaction_id uuid,status text not null,automatically_detected boolean not null default false);
grant select on public.salary_receipts to t03_bootstrap,t03_filtered,t03_no_role;
grant select on public.client_mutations,public.transactions,public.transaction_postings to t03_bootstrap,t03_filtered,t03_no_role;
