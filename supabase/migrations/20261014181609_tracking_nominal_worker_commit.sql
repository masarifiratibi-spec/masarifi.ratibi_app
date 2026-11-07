grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- The worker supplies only a capture and live lease, never a financial command.
create function private.commit_tracking_nominal_capture(p_item uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; reservation jsonb; command jsonb; result jsonb; receipt jsonb;
  saved public.transactions; key_value text; key_hash text; request_hash text; claim record;
  transaction_id uuid; count_value integer; payload jsonb; finalized jsonb;
begin
  select * into i from public.import_items where id=p_item;
  if i.id is null then raise exception 'IMPORT_ITEM_NOT_FOUND'; end if;
  -- Match the ledger's owner lock before taking the item/reservation locks.
  perform pg_advisory_xact_lock(hashtextextended(i.user_id,0));
  select x.* into i from public.import_items x join public.import_sessions s on s.id=x.session_id
    where x.id=p_item and s.schema_version=3 and s.claim_token=p_fence and s.lease_until>clock_timestamp()
    and x.status in ('parsed','accepted') for update of x;
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if i.normalized_payload->>'accountingPolicy' is distinct from 'default_account_nominal_v1' then raise exception 'TRACKING_NOMINAL_PROOF_REQUIRED'; end if;
  if i.status='accepted' then return jsonb_build_object('status','accepted','transactionId',i.transaction_id); end if;
  finalized:=private.finalize_import_session(i.session_id,p_fence);
  if not exists(select 1 from jsonb_array_elements(finalized->'autoItems') value where value->>'id'=i.id::text)
    or private.tracking_nominal_exception(i.id) is not null then raise exception 'TRACKING_NOMINAL_PROOF_REQUIRED'; end if;
  select * into i from public.import_items where id=p_item;
  reservation:=private.reserve_tracking_capture(i.id,p_fence);
  if coalesce((reservation->>'conflict')::boolean,true) then raise exception 'TRACKING_CAPTURE_EFFECT_CONFLICT'; end if;
  key_value:='tracking:'||(reservation->>'identityHash');
  transaction_id:=(reservation->>'transactionId')::uuid;
  if transaction_id is not null then
    select * into saved from public.transactions where id=transaction_id and user_id=i.user_id and status='confirmed' and deleted_at is null;
    if saved.id is null or saved.source<>'tracking-import' or saved.external_ref<>key_value
      or saved.kind is distinct from i.normalized_payload->>'kind' or saved.amount_minor<>abs(i.amount_minor)
      or saved.currency_code<>i.currency_code
      or (select count(*) from public.transaction_postings p where p.transaction_id=saved.id)<>1
      or not exists(select 1 from public.transaction_postings p where p.transaction_id=saved.id and p.account_id::text=i.normalized_payload->>'accountId' and p.amount_minor=i.amount_minor and p.clearing_state='confirmed') then
      raise exception 'TRACKING_CAPTURE_EFFECT_CONFLICT'; end if;
  else
    if reservation->>'primaryItemId'<>i.id::text then raise exception 'IMPORT_CAPTURE_IN_PROGRESS'; end if;
    command:=jsonb_build_object('kind',i.normalized_payload->>'kind','amountMinor',abs(i.amount_minor),'currency',btrim(i.currency_code::text),
      'accountId',i.normalized_payload->>'accountId','categoryId',i.normalized_payload->>'categoryId',
      'title',coalesce(i.normalized_payload->>'title',i.merchant,'Imported transaction'),'merchant',i.merchant,
      'paymentMethod',i.normalized_payload->>'paymentMethod','note',i.normalized_payload->>'note',
      'occurredAt',coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz),'source','tracking-import','externalRef',key_value);
    key_hash:='sha256:'||encode(extensions.digest(key_value,'sha256'),'hex');
    request_hash:='sha256:'||encode(extensions.digest(command::text,'sha256'),'hex');
    select * into claim from private.claim_idempotency_key(i.user_id,'tracking.nominal.commit',key_hash,request_hash,interval '1 minute');
    if claim.outcome<>'new' then raise exception 'TRACKING_CAPTURE_IDEMPOTENCY_CONFLICT'; end if;
    perform private.ledger_begin(i.user_id);
    perform pg_advisory_xact_lock(hashtextextended(i.user_id||':ledger.write',0));
    select count(*) into count_value from public.security_events where user_id=i.user_id and event_type='security.request_attempt'
      and metadata->>'category'='ledger.write' and occurred_at>clock_timestamp()-interval '60 seconds';
    if count_value>=60 then raise exception 'TRACKING_EXECUTION_RATE_LIMITED'; end if;
    insert into public.security_events(user_id,event_type,severity,metadata) values(i.user_id,'security.request_attempt','info','{"category":"ledger.write"}');
    result:=private.post_transaction(i.user_id,command);
    transaction_id:=(result->>'transactionId')::uuid;
    perform audit.append_event(i.user_id,'user','transaction.created','transaction',transaction_id::text,null,
      'sha256:'||encode(extensions.digest(transaction_id::text||':'||(result->>'version'),'sha256'),'hex'),null,key_value,
      jsonb_build_object('operation','tracking.nominal.commit','version',result->'version','ledgerVersion',result->'ledgerVersion','captureId',i.id));
    payload:=jsonb_build_object('transactionId',transaction_id,'kind',command->'kind','accountIds',jsonb_build_array(command->'accountId'),
      'version',result->'version','ledgerVersion',result->'ledgerVersion','occurredAt',command->'occurredAt','requestId',key_value);
    perform private.enqueue_outbox_event('transaction.created','transaction',transaction_id,payload);
    perform private.enqueue_outbox_event('balance.changed','transaction',transaction_id,payload-array['kind','version','occurredAt']);
    receipt:=jsonb_build_object('status','accepted','transactionId',transaction_id);
    perform private.complete_idempotency_key(i.user_id,'tracking.nominal.commit',key_hash,request_hash,201,receipt,transaction_id::text);
  end if;
  perform private.accept_import_item(i.id,p_fence,null,transaction_id);
  return jsonb_build_object('status','accepted','transactionId',transaction_id);
end $$;
revoke all on function private.commit_tracking_nominal_capture(uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.commit_tracking_nominal_capture(uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
