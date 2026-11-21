-- Preserve immutable sync evidence except inside the existing verified, locked
-- owner-erasure transaction. Ordinary worker/API DELETE and all UPDATE rules stay unchanged.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create or replace function private.guard_client_mutation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare context private.account_erasure_context%rowtype;
begin
  if tg_op='DELETE' then
    if current_user='masarifi_migration' then
      select * into context from private.account_erasure_context
        where transaction_id=pg_catalog.txid_current()
          and user_id=old.user_id and objects_locked;
      if found then
        perform private.assert_account_erasure_request(context.request_id,context.user_id,true);
        return old;
      end if;
    end if;
    raise exception using errcode='42501',message='SYNC_MUTATION_IMMUTABLE';
  end if;
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

reset role;
revoke masarifi_migration from current_user granted by current_user;
