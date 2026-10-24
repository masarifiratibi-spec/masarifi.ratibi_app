-- Permit receipt cleanup only in the existing locked, request-bound owner erasure.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create or replace function private.guard_idempotency_key() returns trigger
language plpgsql security invoker set search_path='' as $$
declare context private.account_erasure_context%rowtype;
begin
  if tg_op='DELETE' then
    if current_user='masarifi_migration' then
      select * into context from private.account_erasure_context
        where transaction_id=pg_catalog.txid_current()
          and user_id=old.actor_id and objects_locked;
      if found then
        perform private.assert_account_erasure_request(context.request_id,context.user_id,true);
        return old;
      end if;
    end if;
    raise exception using errcode='42501',message='IDEMPOTENCY_KEY_IMMUTABLE';
  end if;
  if old.actor_id is distinct from new.actor_id
    or old.scope is distinct from new.scope
    or old.key_hash is distinct from new.key_hash
    or old.request_hash is distinct from new.request_hash
    or old.created_at is distinct from new.created_at
    or old.expires_at is distinct from new.expires_at
    or old.state='completed' then
    raise exception using errcode='42501',message='IDEMPOTENCY_KEY_IMMUTABLE';
  end if;
  if not (
    (old.state='claimed' and new.state in ('claimed','completed','failed'))
    or (old.state='failed' and new.state='claimed')
  ) then
    raise exception using errcode='42501',message='IDEMPOTENCY_STATE_INVALID';
  end if;
  return new;
end $$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
