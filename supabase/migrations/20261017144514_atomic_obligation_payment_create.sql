grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create function private.create_obligation_payment(p_user_id text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ledger_result jsonb; payment_result jsonb; transaction_id uuid; payload jsonb;
begin
  perform private.assert_active_profile(p_user_id);
  if p_body is null or jsonb_typeof(p_body)<>'object' or pg_column_size(p_body)>65536
    or p_body->>'operation' is distinct from 'record' or p_body ? 'transactionId'
    or jsonb_typeof(p_body->'transaction') is distinct from 'object'
    or p_body#>>'{transaction,source}' is distinct from 'manual' then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  -- Posting, allocation, events and the API's idempotency claim share one transaction.
  ledger_result:=private.post_transaction(p_user_id,p_body->'transaction');
  transaction_id:=(ledger_result->>'transactionId')::uuid;
  payment_result:=private.allocate_obligation_payment(p_user_id,
    (p_body-'transaction')||jsonb_build_object('transactionId',transaction_id));
  update public.obligation_payments set transaction_ownership='created' where id=(payment_result->>'id')::uuid;
  payload:=jsonb_build_object('transactionId',transaction_id,'kind',p_body#>>'{transaction,kind}',
    'accountIds',private.ledger_account_ids(transaction_id),'version',(ledger_result->>'version')::bigint,
    'ledgerVersion',(ledger_result->>'ledgerVersion')::bigint,
    'occurredAt',p_body#>>'{transaction,occurredAt}','requestId',p_body->>'requestId');
  perform private.enqueue_outbox_event('transaction.created','transaction',transaction_id,payload);
  perform private.enqueue_outbox_event('balance.changed','transaction',transaction_id,
    payload-array['kind','version','occurredAt']);
  perform audit.append_event(p_user_id,'user','transaction.created','transaction',transaction_id::text,
    null,null,null,p_body->>'requestId',jsonb_build_object('operation','createObligationPayment',
      'version',ledger_result->'version','ledgerVersion',ledger_result->'ledgerVersion'));
  return payment_result||jsonb_build_object('transactionOwnership','created');
end $$;
alter function private.create_obligation_payment(text,jsonb) owner to masarifi_migration;
revoke all on function private.create_obligation_payment(text,jsonb) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.create_obligation_payment(text,jsonb) to masarifi_api;
reset role;
revoke masarifi_migration from current_user granted by current_user;
