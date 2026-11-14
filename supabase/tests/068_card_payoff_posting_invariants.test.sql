begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- BR3/BR4: synthetic ledger effects only. Real card payment execution stays deferred.
grant masarifi_migration,masarifi_api to current_user with inherit true,set true;
grant usage on schema extensions to masarifi_api;
set local role masarifi_migration;
insert into public.profiles(id,status) values ('card_posting_fixture','active');
insert into public.accounts(id,user_id,name,type,currency_code) values
 ('68000000-0000-4000-8000-000000000001','card_posting_fixture','Bank','bank','SAR'),
 ('68000000-0000-4000-8000-000000000002','card_posting_fixture','Card','credit_card','SAR');
reset role;
select set_config('request.jwt.claims','{"sub":"card_posting_fixture","role":"authenticated"}',true);
set local role masarifi_api;
select private.post_opening_transaction('card_posting_fixture',
 '68000000-0000-4000-8000-000000000001',100000,'Bank opening','2026-08-01T00:00:00Z','manual');
select private.post_opening_transaction('card_posting_fixture',
 '68000000-0000-4000-8000-000000000002',-32000,'Card liability','2026-08-01T00:00:00Z','manual');

select is((select confirmed_minor from public.account_balances
 where account_id='68000000-0000-4000-8000-000000000002'),-32000::bigint,
 'card debt is one signed liability in the account projection');
select is((select sum(confirmed_minor)::bigint from public.account_balances b join public.accounts a on a.id=b.account_id
 where a.user_id='card_posting_fixture'),68000::bigint,'liability reduces assets exactly once');

create temporary table card_posting_result as select private.transfer_funds('card_posting_fixture',
 '{"sourceAccountId":"68000000-0000-4000-8000-000000000001","destinationAccountId":"68000000-0000-4000-8000-000000000002","amountMinor":20000,"currency":"SAR","title":"Synthetic card payoff","occurredAt":"2026-08-02T00:00:00Z"}'::jsonb) result;

select is((select confirmed_minor from public.account_balances
 where account_id='68000000-0000-4000-8000-000000000001'),80000::bigint,'payoff reduces bank assets');
select is((select confirmed_minor from public.account_balances
 where account_id='68000000-0000-4000-8000-000000000002'),-12000::bigint,'payoff reduces the outstanding card liability');
select is((select sum(confirmed_minor)::bigint from public.account_balances b join public.accounts a on a.id=b.account_id
 where a.user_id='card_posting_fixture'),68000::bigint,'equal asset and liability effects preserve net worth');
select is((select kind from public.transactions where id=(select (result->>'transactionId')::uuid from card_posting_result)),
 'transfer','card payoff retains its transfer ledger intent');
select is((select count(*)::integer from public.transaction_postings
 where transaction_id=(select (result->>'transactionId')::uuid from card_posting_result)),2,'payoff has exactly two postings');
select is((select amount_minor from public.transaction_postings
 where transaction_id=(select (result->>'transactionId')::uuid from card_posting_result) and posting_role='source'),
 -20000::bigint,'source posting is the exact negative amount');
select is((select amount_minor from public.transaction_postings
 where transaction_id=(select (result->>'transactionId')::uuid from card_posting_result) and posting_role='destination'),
 20000::bigint,'card posting is the exact positive amount');
select is((select sum(amount_minor)::bigint from public.transaction_postings
 where transaction_id=(select (result->>'transactionId')::uuid from card_posting_result)),0::bigint,'payoff postings balance');
select is((select count(*)::integer from public.transaction_postings
 where transaction_id=(select (result->>'transactionId')::uuid from card_posting_result) and posting_role='fee'),0,
 'absent fee does not invent a third posting');
select ok(not exists(select 1 from public.transactions where user_id='card_posting_fixture' and kind in ('income','expense')),
 'card payoff creates no income or expense transaction');
select is((select count(*)::integer from public.v_monthly_financial_summary where user_id='card_posting_fixture'),0,
 'opening balances and fee-free payoff do not enter income or expense totals');

reset role;
select * from finish();
rollback;
