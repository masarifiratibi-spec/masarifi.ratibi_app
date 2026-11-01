grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create table private.account_deletion_receipts (
  user_id text not null references public.profiles(id) on delete restrict,
  operation_id uuid not null,
  request_id uuid not null references private.account_deletion_requests(id) on delete restrict,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  primary key (operation_id)
);
create index account_deletion_receipts_lookup_idx
  on private.account_deletion_receipts(operation_id,token_hash);
alter table private.account_deletion_receipts enable row level security;
alter table private.account_deletion_receipts force row level security;
revoke all on private.account_deletion_receipts from public, anon, authenticated;
grant select,insert on private.account_deletion_receipts to masarifi_api;
grant select on private.account_deletion_receipts to masarifi_worker;
create policy deletion_receipts_api_select on private.account_deletion_receipts
  for select to masarifi_api using (user_id=public.current_clerk_user_id());
create policy deletion_receipts_api_insert on private.account_deletion_receipts
  for insert to masarifi_api with check (
    user_id=public.current_clerk_user_id() and exists (
      select 1 from private.account_deletion_requests d where d.id=request_id and d.user_id=account_deletion_receipts.user_id
    )
  );
create policy deletion_receipts_worker_select on private.account_deletion_receipts
  for select to masarifi_worker using (true);
create policy deletion_receipts_migration_all on private.account_deletion_receipts
  for all to masarifi_migration using (true) with check (true);

create table private.deletion_completion_rate_buckets (
  network_hash text not null check (network_hash ~ '^[a-f0-9]{64}$'),
  bucket_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 61),
  primary key (network_hash,bucket_at)
);
create index deletion_completion_rate_buckets_expiry_idx
  on private.deletion_completion_rate_buckets(bucket_at);
alter table private.deletion_completion_rate_buckets enable row level security;
alter table private.deletion_completion_rate_buckets force row level security;
revoke all on private.deletion_completion_rate_buckets from public,anon,authenticated,masarifi_api;
grant select,insert,update,delete on private.deletion_completion_rate_buckets to masarifi_worker;
create policy deletion_completion_rate_worker_all on private.deletion_completion_rate_buckets
  for all to masarifi_worker using (true) with check (true);
create policy deletion_completion_rate_migration_all on private.deletion_completion_rate_buckets
  for all to masarifi_migration using (true) with check (true);
