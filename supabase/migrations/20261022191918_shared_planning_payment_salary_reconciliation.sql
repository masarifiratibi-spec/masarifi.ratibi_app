-- Promote the qualified payment correction and atomic salary-link reconciliation.
-- No historical discovery or financial data rewrite. DEV entry points stay intact.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Ownership is a trusted argument, never a client-controlled JSON property.
create or replace function private.allocate_obligation_payment_core(p_user_id text,p_body jsonb,p_transaction_ownership text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  operation text:=p_body->>'operation';request_id text:=p_body->>'requestId';
  allocation_intent text:=p_body->>'allocationIntent';
  obligation public.obligations;payment public.obligation_payments;transaction_row public.transactions;
  schedule public.obligation_schedule_items;allocation jsonb;allocation_total bigint:=0;payment_result jsonb;
  allocation_amount bigint;allocation_excess bigint;excess_total bigint:=0;
  was_confirmed boolean;
  ledger_result jsonb;ledger_payload jsonb;reversed_at timestamptz;
begin
  perform private.assert_active_profile(p_user_id);
  if p_transaction_ownership is null or p_transaction_ownership not in ('created','linked_existing') then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if p_body is null or jsonb_typeof(p_body)<>'object' or pg_column_size(p_body)>65536
    or operation not in ('record','reverse') or request_id !~ '^[A-Za-z0-9._:-]{1,128}$' then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if operation='record' then
    select * into transaction_row from public.transactions t
    where t.id=(p_body->>'transactionId')::uuid and t.user_id=p_user_id for update;
  else
    -- Match ledger compensation lock order: owner, transaction, obligation, payment.
    perform private.ledger_begin(p_user_id);
    select t.* into transaction_row
    from public.transactions t join public.obligation_payments p on p.transaction_id=t.id
    where p.id=(p_body->>'paymentId')::uuid and p.obligation_id=(p_body->>'obligationId')::uuid
      and p.user_id=p_user_id and t.user_id=p_user_id
    for update of t;
    if transaction_row.id is null then raise exception using errcode='P0001',message='PAYMENT_NOT_FOUND'; end if;
  end if;
  select * into obligation from public.obligations o
  where o.id=(p_body->>'obligationId')::uuid and o.user_id=p_user_id for update;
  if obligation.id is null then raise exception using errcode='P0001',message='OBLIGATION_NOT_FOUND'; end if;

  if operation='record' then
    if exists(select 1 from jsonb_object_keys(p_body) key where key not in (
      'operation','obligationId','paymentId','transactionId','expectedVersion','paymentMethod','paymentCase',
      'allocationIntent','source','allocations','operationId','requestId'
    )) or obligation.status<>'active' then raise exception using errcode='P0001',message='OBLIGATION_INELIGIBLE'; end if;
    if obligation.version<>(p_body->>'expectedVersion')::bigint then
      raise exception using errcode='P0001',message='VERSION_CONFLICT',detail=obligation.version::text;
    end if;
    if transaction_row.id is null or transaction_row.status<>'confirmed'
      or transaction_row.kind<>(case when obligation.direction='payable' then 'expense' else 'income' end)
      or transaction_row.currency_code<>obligation.currency_code then
      raise exception using errcode='P0001',message='PAYMENT_TRANSACTION_INVALID';
    end if;
    if exists(select 1 from public.obligation_payments p where p.transaction_id=transaction_row.id and p.status<>'reversed') then
      raise exception using errcode='P0001',message='PAYMENT_TRANSACTION_USED';
    end if;
    if jsonb_typeof(p_body->'allocations')<>'array' or jsonb_array_length(p_body->'allocations') not between 1 and 100
      or exists(select 1 from jsonb_array_elements(p_body->'allocations') value
        group by value->>'scheduleItemId' having count(*)>1) then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    end if;
    for allocation in select value from jsonb_array_elements(p_body->'allocations') order by value->>'scheduleItemId'
    loop
      if jsonb_typeof(allocation)<>'object' or exists(select 1 from jsonb_object_keys(allocation) key
        where key not in ('scheduleItemId','amountMinor')) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
      select * into schedule from public.obligation_schedule_items i
      where i.id=(allocation->>'scheduleItemId')::uuid and i.user_id=p_user_id
        and i.obligation_id=obligation.id for update;
      if schedule.id is null then raise exception using errcode='P0001',message='PAYMENT_SCHEDULE_INVALID'; end if;
      allocation_amount:=(allocation->>'amountMinor')::bigint;
      if allocation_amount<=0 then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
      allocation_excess:=greatest(allocation_amount-(schedule.amount_minor-schedule.paid_minor),0);
      if allocation_excess>0 and allocation_intent not in ('prepayment','principal','settlement') then
        raise exception using errcode='P0001',message='PAYMENT_ALLOCATION_EXCEEDS_REMAINDER';
      end if;
      allocation_total:=allocation_total+allocation_amount;
      excess_total:=excess_total+allocation_excess;
    end loop;
    if allocation_total<>transaction_row.amount_minor then
      raise exception using errcode='P0001',message='PAYMENT_ALLOCATION_SUM_MISMATCH';
    end if;
    insert into public.obligation_payments(
      id,user_id,obligation_id,transaction_id,paid_at,amount_minor,payment_method,payment_case,
      allocation_intent,source,principal_reduction_minor,settlement_adjustment_minor,operation_id,transaction_ownership
    ) values(
      (p_body->>'paymentId')::uuid,p_user_id,obligation.id,transaction_row.id,transaction_row.occurred_at,
      transaction_row.amount_minor,p_body->>'paymentMethod',p_body->>'paymentCase',allocation_intent,
      p_body->>'source',case when allocation_intent in ('prepayment','principal') then excess_total else 0 end,
      case when allocation_intent='settlement' then excess_total else 0 end,(p_body->>'operationId')::uuid,p_transaction_ownership
    ) returning * into payment;
    for allocation in select value from jsonb_array_elements(p_body->'allocations') order by value->>'scheduleItemId'
    loop
      insert into public.obligation_payment_allocations(user_id,payment_id,schedule_item_id,amount_minor)
      values(p_user_id,payment.id,(allocation->>'scheduleItemId')::uuid,(allocation->>'amountMinor')::bigint);
      perform private.recompute_obligation_schedule_item((allocation->>'scheduleItemId')::uuid);
    end loop;
    update public.obligations o set updated_at=o.updated_at where o.id=obligation.id returning * into obligation;
    perform private.enqueue_outbox_event('planning.obligation_payment_recorded','obligation-payment',payment.id,
      jsonb_build_object('obligationId',obligation.id,'paymentId',payment.id,'transactionId',payment.transaction_id,
        'userId',p_user_id,'aggregateVersion',payment.version,'status',payment.status,
        'ledgerVersion',coalesce((select max(ab.ledger_version) from public.account_balances ab
          join public.accounts a on a.id=ab.account_id where a.user_id=p_user_id),0),'requestId',request_id));
    perform audit.append_event(p_user_id,'user','planning.obligation-payment-recorded','obligation_payment',payment.id::text,
      null,null,null,request_id,jsonb_build_object('version',payment.version,'obligationId',obligation.id));
  else
    if exists(select 1 from jsonb_object_keys(p_body) key where key not in (
      'operation','obligationId','paymentId','expectedVersion','operationId','requestId'
    )) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
    select * into payment from public.obligation_payments p
    where p.id=(p_body->>'paymentId')::uuid and p.user_id=p_user_id and p.obligation_id=obligation.id for update;
    if payment.id is null then raise exception using errcode='P0001',message='PAYMENT_NOT_FOUND'; end if;
    if payment.version<>(p_body->>'expectedVersion')::bigint then
      raise exception using errcode='P0001',message='VERSION_CONFLICT',detail=payment.version::text;
    end if;
    if payment.status not in ('confirmed','reversed') then raise exception using errcode='P0001',message='PAYMENT_INELIGIBLE'; end if;
    if transaction_row.status not in ('confirmed','reversed')
      or transaction_row.kind<>(case when obligation.direction='payable' then 'expense' else 'income' end)
      or transaction_row.currency_code<>obligation.currency_code or transaction_row.amount_minor<>payment.amount_minor then
      raise exception using errcode='P0001',message='PAYMENT_TRANSACTION_INVALID';
    end if;
    if exists(select 1 from public.obligation_payments p where p.transaction_id=transaction_row.id
      and p.id<>payment.id and p.status='confirmed') then
      raise exception using errcode='P0001',message='PAYMENT_TRANSACTION_USED';
    end if;
    was_confirmed := payment.status='confirmed';
    if was_confirmed then
      -- Avoid duplicate projection events from the ledger invalidation trigger.
      update public.obligation_payments p set status='reversed',operation_id=(p_body->>'operationId')::uuid
      where p.id=payment.id returning * into payment;
      for allocation in select jsonb_build_object('scheduleItemId',a.schedule_item_id,'amountMinor',a.amount_minor) value
        from public.obligation_payment_allocations a where a.payment_id=payment.id order by a.schedule_item_id
      loop
        select * into schedule from public.obligation_schedule_items i
        where i.id=(allocation->>'scheduleItemId')::uuid for update;
        perform private.recompute_obligation_schedule_item(schedule.id);
      end loop;
      update public.obligations o set updated_at=o.updated_at where o.id=obligation.id returning * into obligation;
    end if;
    if transaction_row.status='confirmed' then
      reversed_at := clock_timestamp();
      ledger_result := private.reverse_transaction(p_user_id,transaction_row.id,transaction_row.version,
        reversed_at,'Obligation payment undo: '||payment.id::text);
      ledger_payload := jsonb_build_object('transactionId',ledger_result->>'transactionId','kind','reversal',
        'accountIds',private.ledger_account_ids((ledger_result->>'transactionId')::uuid),
        'version',(ledger_result->>'version')::bigint,'ledgerVersion',(ledger_result->>'ledgerVersion')::bigint,
        'occurredAt',reversed_at,'requestId',request_id);
      perform private.enqueue_outbox_event('transaction.reversed','transaction',(ledger_result->>'transactionId')::uuid,ledger_payload);
      perform private.enqueue_outbox_event('balance.changed','transaction',(ledger_result->>'transactionId')::uuid,
        ledger_payload-array['kind','version','occurredAt']);
    elsif (select count(*) from public.transactions t where t.user_id=p_user_id
      and t.reverses_transaction_id=transaction_row.id and t.kind='reversal' and t.status='confirmed')<>1 then
      raise exception using errcode='P0001',message='PAYMENT_TRANSACTION_INVALID';
    end if;
    if was_confirmed then
      perform private.enqueue_outbox_event('planning.obligation_payment_reversed','obligation-payment',payment.id,
        jsonb_build_object('obligationId',obligation.id,'paymentId',payment.id,'transactionId',payment.transaction_id,
          'userId',p_user_id,'aggregateVersion',payment.version,'status',payment.status,
          'ledgerVersion',coalesce((select max(ab.ledger_version) from public.account_balances ab
            join public.accounts a on a.id=ab.account_id where a.user_id=p_user_id),0),'requestId',request_id));
      perform audit.append_event(p_user_id,'user','planning.obligation-payment-reversed','obligation_payment',payment.id::text,
        null,null,null,request_id,jsonb_build_object('version',payment.version,'obligationId',obligation.id));
    end if;
  end if;
  payment_result=jsonb_build_object('id',payment.id,'obligationId',payment.obligation_id,
    'transactionId',payment.transaction_id,'paidAt',payment.paid_at,'amountMinor',payment.amount_minor::text,
    'paymentMethod',payment.payment_method,'paymentCase',payment.payment_case,'allocationIntent',payment.allocation_intent,
    'source',payment.source,'status',payment.status,'operationId',payment.operation_id,
    'transactionOwnership',payment.transaction_ownership,'createdAt',payment.created_at,'updatedAt',payment.updated_at,'version',payment.version,'obligationVersion',obligation.version);
  return payment_result;
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or unique_violation then
  raise exception using errcode='22023',message='VALIDATION_FAILED';
end $$;
alter function private.allocate_obligation_payment_core(text,jsonb,text) owner to masarifi_migration;
revoke all on function private.allocate_obligation_payment_core(text,jsonb,text)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

create or replace function private.allocate_obligation_payment(p_user_id text,p_body jsonb) returns jsonb
language sql security definer set search_path='' as $$
  select private.allocate_obligation_payment_core(p_user_id,p_body,'linked_existing')
$$;
alter function private.allocate_obligation_payment(text,jsonb) owner to masarifi_migration;
revoke all on function private.allocate_obligation_payment(text,jsonb)
  from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.allocate_obligation_payment(text,jsonb) to masarifi_api;

create or replace function private.create_obligation_payment(p_user_id text,p_body jsonb) returns jsonb
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
  payment_result:=private.allocate_obligation_payment_core(p_user_id,
    (p_body-'transaction')||jsonb_build_object('transactionId',transaction_id),'created');
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
  return payment_result;
end $$;
alter function private.create_obligation_payment(text,jsonb) owner to masarifi_migration;
revoke all on function private.create_obligation_payment(text,jsonb) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.create_obligation_payment(text,jsonb) to masarifi_api;

create function private.reconcile_salary_receipts(p_user_id text,p_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  candidate record; receipt public.salary_receipts; owner_timezone text;
  ledger_version bigint; corrected integer:=0; undone integer:=0;
begin
  perform private.assert_active_profile(p_user_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id,0));
  perform 1 from public.transactions where id=p_transaction_id and user_id=p_user_id for update;
  if not found then raise exception using errcode='P0001',message='TRANSACTION_NOT_FOUND'; end if;
  select timezone into owner_timezone from public.profiles where id=p_user_id;
  select coalesce(max(b.ledger_version),0) into ledger_version from public.account_balances b
    join public.accounts a on a.id=b.account_id where a.user_id=p_user_id;
  -- Only reconcile existing automatic links to this edited transaction; never discover history.
  for candidate in select r.id,t.occurred_at,
      (t.status='confirmed' and t.deleted_at is null and t.kind='income' and t.amount_minor=r.amount_minor
        and abs((t.occurred_at at time zone owner_timezone)::date
          -(r.expected_at at time zone owner_timezone)::date)<=3) valid_income
    from public.salary_receipts r join public.transactions t on t.id=r.transaction_id and t.user_id=r.user_id
    where r.user_id=p_user_id and t.id=p_transaction_id and r.automatically_detected
      and r.status in ('received','corrected') and (t.status<>'confirmed' or t.deleted_at is not null
        or t.kind<>'income' or t.amount_minor<>r.amount_minor or t.occurred_at is distinct from r.received_at)
    order by r.id for update of r
  loop
    if candidate.valid_income then
      update public.salary_receipts set received_at=candidate.occurred_at,status='corrected'
        where id=candidate.id returning * into receipt;
      perform private.enqueue_outbox_event('planning.salary_receipt_corrected','salary-receipt',receipt.id,
        jsonb_build_object('profileId',receipt.salary_profile_id,'receiptId',receipt.id,'userId',p_user_id,
          'version',receipt.version,'status',receipt.status,'cycleDate',receipt.expected_at::date,
          'ledgerVersion',ledger_version,'occurredAt',clock_timestamp(),'requestId','salary-reconcile'));
      perform audit.append_event(p_user_id,'system','planning.salary-receipt-corrected','salary_receipt',receipt.id::text,
        null,null,null,'salary-reconcile',jsonb_build_object('version',receipt.version,'automatic',true));
      corrected:=corrected+1;
    else
      update public.salary_receipts set status='undone',received_at=null where id=candidate.id returning * into receipt;
      perform private.enqueue_outbox_event('planning.salary_receipt_undone','salary-receipt',receipt.id,
        jsonb_build_object('profileId',receipt.salary_profile_id,'receiptId',receipt.id,'userId',p_user_id,
          'version',receipt.version,'status',receipt.status,'cycleDate',receipt.expected_at::date,
          'ledgerVersion',ledger_version,'occurredAt',clock_timestamp(),'requestId','salary-reconcile'));
      perform audit.append_event(p_user_id,'system','planning.salary-receipt-undone','salary_receipt',receipt.id::text,
        null,null,null,'salary-reconcile',jsonb_build_object('version',receipt.version,'automatic',true));
      undone:=undone+1;
    end if;
  end loop;
  return jsonb_build_object('correctedCount',corrected,'undoneCount',undone);
end $$;
alter function private.reconcile_salary_receipts(text,uuid) owner to masarifi_migration;
revoke all on function private.reconcile_salary_receipts(text,uuid)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
-- Keep every deployed ledger guard and reconcile only links to the revised row.
do $migration$
declare definition text; anchor text:='  return private.ledger_result(p_transaction_id,ledger_version);';
begin
  definition := pg_get_functiondef('private.revise_transaction(text,uuid,bigint,jsonb,text)'::regprocedure);
  if length(definition)-length(replace(definition,anchor,''))<>length(anchor)
    or position('private.reconcile_salary_receipts(' in definition)>0 then
    raise exception 'SALARY_REVISION_PRECONDITION';
  end if;
  execute replace(definition,anchor,
    '  perform private.reconcile_salary_receipts(p_user_id,p_transaction_id);'||chr(10)||anchor);
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
