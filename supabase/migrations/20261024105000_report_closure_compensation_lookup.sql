grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Resolve the immutable committed proof once. Comparing the UUID directly keeps
-- recovery independent of the number of unrelated transactions in the ledger.
create or replace function private.tracking_original_compensation(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare committed jsonb; original jsonb;
begin
  committed:=private.tracking_committed_capture(p_item_id);
  if committed->>'originalTransactionId' is not null then
    select jsonb_build_object('originalTransactionId',t.id,'originalTransactionVersion',t.version)
      into original from public.transactions t
      where t.id=(committed->>'originalTransactionId')::uuid;
  end if;
  return coalesce(original,private.tracking_original_compensation_fresh(p_item_id));
end $$;
alter function private.tracking_original_compensation(uuid) owner to masarifi_migration;
revoke all on function private.tracking_original_compensation(uuid)
  from public,anon,authenticated,masarifi_api,masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
