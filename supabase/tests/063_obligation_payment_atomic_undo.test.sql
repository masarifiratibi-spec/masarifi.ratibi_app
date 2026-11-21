begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public,extensions,pg_temp;
select no_plan();
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

do $test$
declare
  scenario text;
  owner_id text;
  other_owner text;
  probe_account_id uuid;
  probe_obligation_id uuid;
  probe_payment_id uuid;
  probe_transaction_id uuid;
  probe_schedule_id uuid;
  other_obligation_id uuid;
  result jsonb;
  command jsonb;
  expected_balance bigint;
  original_payment_version bigint;
  original_obligation_version bigint;
  events_before bigint;
begin
  foreach scenario in array array['payable','receivable','legacy','already_reversed','stale','foreign','refund_failure','reused'] loop
    owner_id := 'atomic_undo_probe_'||gen_random_uuid()::text;
    probe_account_id := gen_random_uuid();
    probe_obligation_id := gen_random_uuid();
    probe_payment_id := gen_random_uuid();
    insert into public.profiles(id,status,timezone) values(owner_id,'active','Asia/Riyadh');
    perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',owner_id,'sid','atomic-undo-probe')::text,true);
    insert into public.accounts(id,user_id,name,type,currency_code) values(probe_account_id,owner_id,'Undo probe','cash','SAR');
    perform private.post_transaction(owner_id,jsonb_build_object('kind','income','amountMinor',10000,'currency','SAR',
      'accountId',probe_account_id,'categoryId','04000000-0000-4000-8000-000000000017','title','Probe opening','occurredAt',clock_timestamp()));
    result := private.save_obligation(owner_id,jsonb_build_object(
      'operation','create','obligationId',probe_obligation_id,'operationId',gen_random_uuid(),'requestId','undo-probe-create',
      'name','Undo probe','direction',case when scenario='receivable' then 'receivable' else 'payable' end,
      'type','installment','scheduleKind','fixed_term','currencyCode','SAR','principalMinor','10000','openingPaidMinor','0',
      'installmentAmountMinor','5000','installmentCount',2,'frequency','monthly','expectedDay',extract(day from current_date)::integer,
      'customIntervalDays',null,'startDate',current_date,'endDate',null,'defaultAccountId',null,
      'automaticMatchingEnabled',false,'provider',null,'providerKeywords','[]'::jsonb,'reminderTiming',null,'notes',null));
    select i.id into probe_schedule_id from public.obligation_schedule_items i where i.obligation_id=probe_obligation_id and i.sequence_no=1;
    result := private.post_transaction(owner_id,jsonb_build_object('kind',case when scenario='receivable' then 'income' else 'expense' end,
      'amountMinor',5000,'currency','SAR','accountId',probe_account_id,
      'categoryId',case when scenario='receivable' then '04000000-0000-4000-8000-000000000017' else '04000000-0000-4000-8000-000000000019' end,
      'title','Probe payment','occurredAt',clock_timestamp()));
    probe_transaction_id := (result->>'transactionId')::uuid;
    result := private.allocate_obligation_payment(owner_id,jsonb_build_object('operation','record','obligationId',probe_obligation_id,
      'paymentId',probe_payment_id,'transactionId',probe_transaction_id,'expectedVersion',1,'paymentMethod',null,'paymentCase','partial',
      'allocationIntent','current','source','manual','allocations',jsonb_build_array(jsonb_build_object('scheduleItemId',probe_schedule_id,'amountMinor','5000')),
      'operationId',gen_random_uuid(),'requestId','undo-probe-record'));
    command := jsonb_build_object('operation','reverse','obligationId',probe_obligation_id,'paymentId',probe_payment_id,
      'expectedVersion',1,'operationId',gen_random_uuid(),'requestId','undo-probe-reverse');
    expected_balance := case when scenario='receivable' then 15000 else 5000 end;

    if scenario in ('legacy','reused') then
      update public.obligation_payments p set status='reversed' where p.id=probe_payment_id;
      perform private.recompute_obligation_schedule_item(probe_schedule_id);
      command := command||jsonb_build_object('expectedVersion',2);
    elsif scenario='already_reversed' then
      perform private.reverse_transaction(owner_id,probe_transaction_id,1,clock_timestamp(),'Probe external reversal');
      select p.version into original_payment_version from public.obligation_payments p where p.id=probe_payment_id;
      command := command||jsonb_build_object('expectedVersion',original_payment_version);
    end if;

    if scenario='stale' then
      begin
        perform private.allocate_obligation_payment(owner_id,command||jsonb_build_object('expectedVersion',99));
        raise exception 'STALE_VERSION_ACCEPTED';
      exception when sqlstate 'P0001' then
        if sqlerrm<>'VERSION_CONFLICT' then raise; end if;
      end;
    elsif scenario='foreign' then
      other_owner := 'atomic_undo_probe_'||gen_random_uuid()::text;
      insert into public.profiles(id,status) values(other_owner,'active');
      perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',other_owner,'sid','other-probe')::text,true);
      begin
        perform private.allocate_obligation_payment(other_owner,command);
        raise exception 'FOREIGN_PAYMENT_ACCEPTED';
      exception when sqlstate 'P0001' then
        if sqlerrm not in ('PAYMENT_NOT_FOUND','OBLIGATION_NOT_FOUND') then raise; end if;
      end;
    elsif scenario='refund_failure' then
      perform private.refund_transaction(owner_id,probe_transaction_id,1,100,probe_account_id,clock_timestamp(),'Probe refund');
      begin
        perform private.allocate_obligation_payment(owner_id,command);
        raise exception 'DEPENDENT_REFUND_ACCEPTED';
      exception when sqlstate 'P0001' then
        if sqlerrm<>'TRANSACTION_HAS_DEPENDENTS' then raise; end if;
      end;
      expected_balance := 5100;
    elsif scenario='reused' then
      other_obligation_id := gen_random_uuid();
      insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,frequency,start_date)
        values(other_obligation_id,owner_id,'Reused probe','payable','debt','irregular','SAR',10000,'irregular',current_date);
      insert into public.obligation_payments(user_id,obligation_id,transaction_id,paid_at,amount_minor,payment_case,allocation_intent)
        values(owner_id,other_obligation_id,probe_transaction_id,clock_timestamp(),5000,'partial','current');
      begin
        perform private.allocate_obligation_payment(owner_id,command);
        raise exception 'REUSED_TRANSACTION_ACCEPTED';
      exception when sqlstate 'P0001' then
        if sqlerrm<>'PAYMENT_TRANSACTION_USED' then raise; end if;
      end;
    else
      result := private.allocate_obligation_payment(owner_id,command);
      if result->>'status'<>'reversed' then raise exception 'UNDO_STATUS_INVALID'; end if;
      if (select t.status from public.transactions t where t.id=probe_transaction_id)<>'reversed' then raise exception 'LEDGER_NOT_REVERSED'; end if;
      if (select ab.confirmed_minor from public.account_balances ab where ab.account_id=probe_account_id)<>10000 then raise exception 'BALANCE_NOT_RESTORED'; end if;
      if (select count(*) from public.transactions t where t.reverses_transaction_id=probe_transaction_id and t.kind='reversal')<>1 then raise exception 'REVERSAL_COUNT_INVALID'; end if;
      if scenario<>'already_reversed' and (
        (select count(*) from private.outbox_events e join public.transactions t on t.id=e.aggregate_id
          where t.reverses_transaction_id=probe_transaction_id and e.event_type='transaction.reversed' and e.payload#>>'{sync,userId}'=owner_id)<>1
        or (select count(*) from private.outbox_events e join public.transactions t on t.id=e.aggregate_id
          where t.reverses_transaction_id=probe_transaction_id and e.event_type='balance.changed')<>1
      ) then raise exception 'REVERSAL_SYNC_EVENTS_MISSING'; end if;
      if (select i.paid_minor from public.obligation_schedule_items i where i.id=probe_schedule_id)<>0 then raise exception 'SCHEDULE_STILL_PAID'; end if;
      if (select count(*) from public.obligation_payment_allocations a where a.payment_id=probe_payment_id)<>1 then raise exception 'ALLOCATION_EVIDENCE_LOST'; end if;
      select p.version into original_payment_version from public.obligation_payments p where p.id=probe_payment_id;
      select o.version into original_obligation_version from public.obligations o where o.id=probe_obligation_id;
      select count(*) into events_before from private.outbox_events e where e.aggregate_id=probe_payment_id;
      result := private.allocate_obligation_payment(owner_id,command||jsonb_build_object('expectedVersion',original_payment_version,'operationId',gen_random_uuid()));
      if (select ab.confirmed_minor from public.account_balances ab where ab.account_id=probe_account_id)<>10000
        or (select count(*) from public.transactions t where t.reverses_transaction_id=probe_transaction_id and t.kind='reversal')<>1
        or (select p.version from public.obligation_payments p where p.id=probe_payment_id)<>original_payment_version
        or (select o.version from public.obligations o where o.id=probe_obligation_id)<>original_obligation_version
        or (select count(*) from private.outbox_events e where e.aggregate_id=probe_payment_id)<>events_before
        then raise exception 'UNDO_REPLAY_NOT_IDEMPOTENT'; end if;
      continue;
    end if;

    if (select ab.confirmed_minor from public.account_balances ab where ab.account_id=probe_account_id)<>expected_balance
      or (select t.status from public.transactions t where t.id=probe_transaction_id)<>'confirmed'
      or exists(select 1 from public.transactions t where t.reverses_transaction_id=probe_transaction_id and t.kind='reversal')
      then raise exception 'FAILED_UNDO_CHANGED_LEDGER'; end if;
    if scenario in ('stale','foreign','refund_failure') and
      ((select p.status from public.obligation_payments p where p.id=probe_payment_id)<>'confirmed'
      or (select i.paid_minor from public.obligation_schedule_items i where i.id=probe_schedule_id)<>5000)
      then raise exception 'FAILED_UNDO_CHANGED_ALLOCATION'; end if;
  end loop;
end $test$;
reset role;
select pass('Undo restores payable/receivable balances atomically, repairs legacy rows, retains evidence, rejects stale/foreign/reused/refunded transactions, and replays once');
select * from finish();
rollback;
