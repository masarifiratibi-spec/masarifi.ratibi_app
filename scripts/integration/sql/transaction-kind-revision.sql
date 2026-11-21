-- Run on a disposable database, before/after the forward migration. Always rolls back.
begin;
grant masarifi_migration,masarifi_api to current_user with inherit true,set true;
set local role masarifi_migration;
insert into public.profiles(id,status) values ('kind_revision_fixture','active'),('kind_revision_other','active');
insert into public.accounts(id,user_id,name,type,currency_code) values
 ('71000000-0000-4000-8000-000000000001','kind_revision_fixture','Revision SAR','cash','SAR'),
 ('71000000-0000-4000-8000-000000000002','kind_revision_fixture','Revision EGP','cash','EGP');
reset role;
select set_config('request.jwt.claims','{"sub":"kind_revision_fixture","role":"authenticated"}',true);
set local role masarifi_api;
do $test$
declare receipt jsonb; target_id uuid; maximum_id uuid; current_version bigint; prior_postings bigint;
begin
  receipt:=private.post_transaction('kind_revision_fixture',jsonb_build_object('kind','expense','amountMinor',1000,
    'currency','SAR','accountId','71000000-0000-4000-8000-000000000001',
    'categoryId','04000000-0000-4000-8000-000000000006','title','Synthetic correction','occurredAt',clock_timestamp()));
  target_id:=(receipt->>'transactionId')::uuid;
  begin
    perform private.revise_transaction('kind_revision_fixture',target_id,1,'{"kind":"transfer"}','Unsupported correction');
    raise exception 'UNSUPPORTED_KIND_ACCEPTED';
  exception when sqlstate '22023' then
    if sqlerrm<>'VALIDATION_FAILED' then raise; end if;
  end;
  perform set_config('request.jwt.claims','{"sub":"kind_revision_other","role":"authenticated"}',true);
  begin
    perform private.revise_transaction('kind_revision_other',target_id,1,'{"kind":"income"}','Foreign correction');
    raise exception 'FOREIGN_CORRECTION_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'TRANSACTION_NOT_FOUND' then raise; end if;
  end;
  perform set_config('request.jwt.claims','{"sub":"kind_revision_fixture","role":"authenticated"}',true);
  perform private.revise_transaction('kind_revision_fixture',target_id,1,
    '{"kind":"income","categoryId":"04000000-0000-4000-8000-000000000016"}', 'Correct expense to income');
  if (select confirmed_minor from public.account_balances where account_id='71000000-0000-4000-8000-000000000001')<>1000
    or (select kind from public.transactions where id=target_id)<>'income'
    or (select sum(p.amount_minor) from public.transaction_postings p where p.transaction_id=target_id)<>1000 then
    raise exception 'EXPENSE_TO_INCOME_BALANCE_FAILED';
  end if;
  begin
    perform private.revise_transaction('kind_revision_fixture',target_id,1,'{"kind":"expense"}','Stale revision');
    raise exception 'STALE_REVISION_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'VERSION_CONFLICT' then raise; end if;
  end;
  perform private.revise_transaction('kind_revision_fixture',target_id,2,
    '{"kind":"expense","amountMinor":700,"categoryId":"04000000-0000-4000-8000-000000000006"}', 'Correct income to expense');
  if (select confirmed_minor from public.account_balances where account_id='71000000-0000-4000-8000-000000000001')<>-700 then
    raise exception 'INCOME_TO_EXPENSE_BALANCE_FAILED';
  end if;
  if (select count(*) from audit.transaction_revisions r where r.transaction_id=target_id)<>3 then
    raise exception 'CORRECTION_AUDIT_MISSING';
  end if;
  perform private.refund_transaction('kind_revision_fixture',target_id,3,100,null,clock_timestamp(),'Synthetic linked refund');
  select version into current_version from public.transactions where id=target_id;
  select count(*) into prior_postings from public.transaction_postings p where p.transaction_id=target_id;
  begin
    perform private.revise_transaction('kind_revision_fixture',target_id,current_version,'{"kind":"income","categoryId":null}','Cannot detach refund');
    raise exception 'REFUNDED_KIND_CHANGE_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'TRANSACTION_INELIGIBLE' then raise; end if;
  end;
  if (select count(*) from public.transaction_postings p where p.transaction_id=target_id)<>prior_postings then
    raise exception 'REJECTED_CHANGE_LEFT_POSTINGS';
  end if;
  receipt:=private.post_transaction('kind_revision_fixture',jsonb_build_object('kind','expense','amountMinor',9007199254740991::bigint,
    'currency','EGP','accountId','71000000-0000-4000-8000-000000000002',
    'categoryId','04000000-0000-4000-8000-000000000006','title','Synthetic boundary','occurredAt',clock_timestamp()));
  maximum_id:=(receipt->>'transactionId')::uuid;
  perform private.revise_transaction('kind_revision_fixture',maximum_id,1,
    '{"kind":"income","categoryId":"04000000-0000-4000-8000-000000000016"}', 'Correct maximum safely');
  if (select confirmed_minor from public.account_balances where account_id='71000000-0000-4000-8000-000000000002')<>9007199254740991::bigint then
    raise exception 'MAXIMUM_KIND_CHANGE_FAILED';
  end if;
end $test$;
rollback;
