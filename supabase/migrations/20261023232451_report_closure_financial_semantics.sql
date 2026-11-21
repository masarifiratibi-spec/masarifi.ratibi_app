grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- Cast malformed fees inside controlled command validation.
create or replace function private.transfer_funds(p_user_id text,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  source_id uuid; destination_id uuid; fee_account_id uuid; account_ids uuid[];
  amount_value bigint; fee_value bigint;
  currency_value text:=p_command->>'currency'; occurred_value timestamptz; title_value text:=p_command->>'title';
  note_value text:=p_command->>'note'; transaction_id uuid; ledger_version bigint; matched integer;
begin
  if p_command is null or jsonb_typeof(p_command)<>'object'
    or (p_command-array['sourceAccountId','destinationAccountId','amountMinor','currency','feeMinor','feeAccountId','occurredAt','title','note']::text[])<>'{}'::jsonb then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  begin
    fee_value:=coalesce((p_command->>'feeMinor')::bigint,0);
    source_id:=(p_command->>'sourceAccountId')::uuid; destination_id:=(p_command->>'destinationAccountId')::uuid;
    amount_value:=(p_command->>'amountMinor')::bigint; occurred_value:=(p_command->>'occurredAt')::timestamptz;
    fee_account_id:=coalesce((p_command->>'feeAccountId')::uuid,source_id);
  exception when others then raise exception using errcode='22023',message='VALIDATION_FAILED'; end;
  if source_id=destination_id or amount_value not between 1 and 9007199254740991
    or fee_value not between 0 and amount_value or currency_value !~ '^[A-Z]{3}$'
    or not private.ledger_safe_text(title_value,1,160)
    or (note_value is not null and not private.ledger_safe_text(note_value,1,500))
    or occurred_value<'1900-01-01T00:00:00Z'::timestamptz or occurred_value>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='TRANSFER_ACCOUNTS_INVALID';
  end if;
  perform private.ledger_begin(p_user_id);
  select array_agg(distinct id order by id) into account_ids
  from unnest(array[source_id,destination_id,fee_account_id]) as u(id);
  perform a.id from public.accounts a where a.id=any(account_ids) order by a.id for update;
  select count(*) into matched from public.accounts a where a.id=any(account_ids)
    and a.user_id=p_user_id and a.status='active' and btrim(a.currency_code::text)=currency_value;
  if matched<>cardinality(account_ids) then
    if exists(select 1 from public.accounts a where a.id=any(account_ids) and a.user_id=p_user_id and btrim(a.currency_code::text)<>currency_value)
      then raise exception using errcode='P0001',message='CURRENCY_MISMATCH'; end if;
    raise exception using errcode='P0001',message='ACCOUNT_INVALID';
  end if;
  ledger_version:=private.ledger_next_version(p_user_id);
  insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,note,occurred_at)
  values(p_user_id,'transfer',amount_value,fee_value,currency_value,title_value,note_value,occurred_value)
  returning id into transaction_id;
  perform private.ledger_apply_posting(transaction_id,source_id,-amount_value,'confirmed','source',occurred_value,ledger_version);
  perform private.ledger_apply_posting(transaction_id,destination_id,amount_value,'confirmed','destination',occurred_value,ledger_version);
  if fee_value>0 then perform private.ledger_apply_posting(transaction_id,fee_account_id,-fee_value,'confirmed','fee',occurred_value,ledger_version); end if;
  perform private.ledger_record_revision(transaction_id,p_user_id,'transfer created','{}'::jsonb);
  return private.ledger_result(transaction_id,ledger_version);
end $$;
alter function private.transfer_funds(text,jsonb) owner to masarifi_migration;
revoke all on function private.transfer_funds(text,jsonb) from public;

-- Largest movement ordering is partitioned by currency.
create or replace function private.read_assistant_agent_data(p_job_id uuid,p_claim_token uuid,p_query jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<assistant_read>>
declare
  owner_id text; owner_timezone text; allowed_scopes text[]; tool_name text:=p_query->>'tool';
  from_date date; to_date date; selected_account_id uuid; selected_category_id uuid; matches integer;
  take_count integer:=coalesce((p_query->>'limit')::integer,20);
  skip_count integer:=coalesce((p_query->>'offset')::integer,0);
  outcome jsonb; payload jsonb; alias_map jsonb; current_version bigint;
begin
  select j.user_id,p.timezone,m.context_scope into owner_id,owner_timezone,allowed_scopes
  from private.assistant_agent_jobs j
  join public.assistant_messages m on m.id=j.id and m.user_id=j.user_id
  join public.assistant_conversations c on c.id=m.conversation_id and c.user_id=m.user_id
  join public.profiles p on p.id=j.user_id
  where j.id=p_job_id and j.state='processing' and j.claim_token=p_claim_token
    and j.lease_until>clock_timestamp() and m.work_status='processing' and m.role='user'
    and c.status='active' and c.deleted_at is null and p.status='active' and p.deleted_at is null
    and exists(select 1 from public.assistant_consents s where s.user_id=j.user_id
      and s.policy_version='assistant-privacy-v1' and s.revoked_at is null);
  if owner_id is null then raise exception using errcode='42501',message='ASSISTANT_DATA_FENCE_DENIED'; end if;
  if jsonb_typeof(p_query) is distinct from 'object' or tool_name is null
    or tool_name not in ('overview','accounts','transactions','summary','planning','profile','tracking')
    or p_query - array['tool','collection','kind','startDate','endDate','currency','minAmountMinor','maxAmountMinor','account','category','search','sort','limit','offset'] <> '{}'::jsonb
    or (p_query->>'collection' is not null and (jsonb_typeof(p_query->'collection')<>'string' or not ((tool_name='planning' and p_query->>'collection' in ('salary','budget','budget_category','obligation','goal','obligation_schedule','salary_receipt','report_schedule','savings_movement','obligation_payment','report_delivery')) or (tool_name='tracking' and p_query->>'collection' in ('tracking_review','tracking_history','voice_session','voice_preference')))))
    or take_count not between 1 and 50 or skip_count not between 0 and 10000
    or (p_query ? 'limit' and (jsonb_typeof(p_query->'limit')<>'number' or p_query->>'limit' !~ '^[0-9]+$'))
    or (p_query ? 'offset' and (jsonb_typeof(p_query->'offset')<>'number' or p_query->>'offset' !~ '^[0-9]+$'))
    or (p_query ? 'sort' and (jsonb_typeof(p_query->'sort')<>'string' or p_query->>'sort' not in ('latest','largest')))
    or (p_query->>'kind' is not null and (jsonb_typeof(p_query->'kind')<>'string' or p_query->>'kind' not in ('expense','income','transfer','refund','opening','reversal','adjustment')))
    or (p_query->>'currency' is not null and (jsonb_typeof(p_query->'currency')<>'string' or p_query->>'currency' !~ '^[A-Z]{3}$'))
    or exists(select 1 from jsonb_each(p_query) q where q.key in ('account','category','search') and q.value<>'null'::jsonb
      and (jsonb_typeof(q.value)<>'string' or length(q.value#>>'{}') not between 1 and 160 or q.value#>>'{}'<>btrim(q.value#>>'{}') or q.value#>>'{}' ~ '[[:cntrl:]]'))
    then raise exception using errcode='22023',message='ASSISTANT_DATA_QUERY_INVALID'; end if;
  if exists(select 1 from jsonb_each(p_query) q where q.key in ('minAmountMinor','maxAmountMinor') and q.value<>'null'::jsonb and (jsonb_typeof(q.value)<>'string' or q.value#>>'{}' !~ '^(0|[1-9][0-9]{0,15})$' or p_query->>'currency' is null)) or (p_query->>'minAmountMinor')::numeric>(p_query->>'maxAmountMinor')::numeric then raise exception using errcode='22023',message='ASSISTANT_DATA_QUERY_INVALID'; end if;
  if exists(select 1 from jsonb_each(p_query) q where q.key in ('startDate','endDate') and q.value<>'null'::jsonb
    and (jsonb_typeof(q.value)<>'string' or q.value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) then
    raise exception using errcode='22023',message='ASSISTANT_DATA_QUERY_INVALID'; end if;
  from_date:=(p_query->>'startDate')::date; to_date:=(p_query->>'endDate')::date;
  if from_date>to_date then raise exception using errcode='22023',message='ASSISTANT_DATA_QUERY_INVALID'; end if;
  if tool_name='overview' then
    from_date:=coalesce(from_date,date_trunc('month',clock_timestamp() at time zone owner_timezone)::date);
    to_date:=coalesce(to_date,(clock_timestamp() at time zone owner_timezone)::date);
  end if;
  if (tool_name='accounts' and not 'accounts_summary'=any(allowed_scopes))
    or (tool_name in ('transactions','summary') and not 'recent_transactions'=any(allowed_scopes))
    or (tool_name='tracking' and not 'tracking_reviews'=any(allowed_scopes))
    or (tool_name='planning' and not allowed_scopes && array['accounts_summary','budgets','obligations'])
    or (tool_name='planning' and p_query->>'collection' is not null and not
      (case when p_query->>'collection' in ('salary','salary_receipt') then 'accounts_summary'
        when p_query->>'collection' in ('obligation','obligation_schedule','obligation_payment') then 'obligations'
        else 'budgets' end)=any(allowed_scopes))
    or (p_query->>'account' is not null and not 'accounts_summary'=any(allowed_scopes))
    or (p_query->>'category' is not null and not allowed_scopes && array['recent_transactions','budgets']) then
    raise exception using errcode='42501',message='ASSISTANT_DATA_SCOPE_DENIED'; end if;
  if p_query->>'account' is not null then
    select count(*),(array_agg(a.id))[1] into matches,selected_account_id from (
      select a.id,a.name,'ACCOUNT-'||row_number() over(order by a.created_at,a.id) alias
      from public.accounts a where a.user_id=owner_id
    ) a where a.alias=p_query->>'account' or lower(a.name)=lower(p_query->>'account');
    if matches<>1 then return jsonb_build_object('observedAt',clock_timestamp(),'ledgerVersion',0,'data',jsonb_build_object('status',case when matches>1 then 'ambiguous' else 'not_found' end,'selector','account','matches',matches),'aliases','[]'::jsonb); end if;
  end if;
  if p_query->>'category' is not null then
    select count(*),(array_agg(c.id))[1] into matches,selected_category_id from (
      select c.id,c.label_ar,c.label_en,'CATEGORY-'||row_number() over(order by c.created_at,c.id) alias
      from public.categories c where c.user_id=owner_id or c.user_id is null
    ) c where c.alias=p_query->>'category' or lower(c.label_ar)=lower(p_query->>'category') or lower(c.label_en)=lower(p_query->>'category');
    if matches<>1 then return jsonb_build_object('observedAt',clock_timestamp(),'ledgerVersion',0,'data',jsonb_build_object('status',case when matches>1 then 'ambiguous' else 'not_found' end,'selector','category','matches',matches),'aliases','[]'::jsonb); end if;
  end if;
  select coalesce(max(b.ledger_version),0) into current_version from public.accounts a
    left join public.account_balances b on b.account_id=a.id where a.user_id=owner_id;

  with accounts as materialized (
    select a.*,'ACCOUNT-'||row_number() over(order by a.created_at,a.id) alias
    from public.accounts a where a.user_id=owner_id and 'accounts_summary'=any(allowed_scopes)
  ), categories as materialized (
    select c.*,'CATEGORY-'||row_number() over(order by c.created_at,c.id) alias
    from public.categories c where (c.user_id=owner_id or c.user_id is null) and 'recent_transactions'=any(allowed_scopes)
  ), tx_catalog as (
    select t.*,'TRANSACTION-'||row_number() over(order by t.created_at,t.id) alias
    from public.transactions t where t.user_id=owner_id and 'recent_transactions'=any(allowed_scopes)
  ), scoped_transactions as materialized (
    select t.* from tx_catalog t where t.deleted_at is null and t.status in ('confirmed','pending')
      and (p_query->>'minAmountMinor' is null or t.amount_minor::numeric>=(p_query->>'minAmountMinor')::numeric)
      and (p_query->>'maxAmountMinor' is null or t.amount_minor::numeric<=(p_query->>'maxAmountMinor')::numeric)
      and (p_query->>'kind' is null or t.kind=p_query->>'kind')
      and (p_query->>'currency' is null or t.currency_code=p_query->>'currency')
      and (selected_category_id is null or t.category_id=selected_category_id or (tool_name in ('summary','overview') and t.kind='refund' and exists(select 1 from tx_catalog original where original.id=t.reverses_transaction_id and original.category_id=selected_category_id)))
      and (selected_account_id is null or exists(select 1 from public.transaction_postings p join accounts a on a.id=p.account_id where p.transaction_id=t.id and a.id=selected_account_id))
      and (p_query->>'search' is null or position(lower(p_query->>'search') in lower(coalesce(t.merchant,'')||' '||coalesce(t.note,'')||' '||t.title))>0)
  ), filtered as materialized (
    select t.* from scoped_transactions t where (from_date is null or t.occurred_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or t.occurred_at<(to_date+1)::timestamp at time zone owner_timezone)
  ), latest_all_history as (
    select * from scoped_transactions where status='confirmed' order by occurred_at desc,id desc limit 1
  ), currency_ranked as (
    select f.*,row_number() over(partition by currency_code order by amount_minor desc,occurred_at desc,id desc) currency_rank from filtered f
  ), tx_page as (
    select f.* from filtered f join currency_ranked r on r.id=f.id
      order by case when p_query->>'sort'='largest' then r.currency_rank end asc nulls last,case when p_query->>'sort'='largest' then f.currency_code end,f.occurred_at desc,f.id desc
      limit case when tool_name='overview' then 5 else take_count end offset case when tool_name='overview' then 0 else skip_count end
  ), entities as materialized (
    select a.id,'account' kind,a.alias,a.version,jsonb_build_object('alias',a.alias,'name',a.name,'type',a.type,'currency',a.currency_code,'status',a.status,'includeInTotals',a.include_in_totals,'balanceAvailability',case when b.account_id is null then 'unavailable' else 'available' end,'confirmedMinor',b.confirmed_minor::text,'pendingMinor',b.pending_minor::text,'balanceAsOf','current') data
    from accounts a left join public.account_balances b on b.account_id=a.id
    where (selected_account_id is null or a.id=selected_account_id) and (p_query->>'currency' is null or a.currency_code=p_query->>'currency')
    union all
    select c.id,'category',c.alias,c.version,jsonb_build_object('alias',c.alias,'labelAr',c.label_ar,'labelEn',c.label_en,'kind',c.kind,'active',c.active)
    from categories c where selected_category_id is null or c.id=selected_category_id
    union all
    select t.id,'transaction',t.alias,t.version,jsonb_build_object('alias',t.alias,'kind',t.kind,'status',t.status,'amountMinor',t.amount_minor::text,'feeMinor',t.fee_minor::text,'currency',t.currency_code,'occurredAt',t.occurred_at,'title',t.title,'merchant',t.merchant,'category',(select c.alias from categories c where c.id=t.category_id),'categoryLabelAr',(select c.label_ar from categories c where c.id=t.category_id),'categoryLabelEn',(select c.label_en from categories c where c.id=t.category_id),'accounts',coalesce((select jsonb_agg(distinct a.alias) from public.transaction_postings p join accounts a on a.id=p.account_id where p.transaction_id=t.id),'[]'::jsonb)) from (select * from tx_page union select * from latest_all_history where tool_name='overview') t
  ), numbered as (
    select e.*,row_number() over(partition by kind order by alias) n,count(*) over(partition by kind) total from entities e
  ), selected as materialized (
    select * from numbered where (kind='transaction' and tool_name in ('overview','transactions'))
      or (kind in ('account','category') and tool_name in ('overview','accounts') and n>skip_count and n<=skip_count+take_count)
  ), sums as (
    select currency_code,kind,status,count(*) count,sum(amount_minor)::text amount,sum(fee_minor)::text fees
    from filtered group by currency_code,kind,status
  ), merchant_totals as (
    select currency_code,coalesce(merchant,'(unknown)') merchant,count(*) count,sum(amount_minor) amount from filtered where kind='expense' and status='confirmed' group by currency_code,coalesce(merchant,'(unknown)')
  ), merchant_page as (select * from merchant_totals order by amount desc,currency_code,merchant limit coalesce((p_query->>'limit')::int,10) offset skip_count
  ), category_effects as (
    select t.currency_code,t.category_id,t.amount_minor amount from filtered t where t.kind='expense' and t.status='confirmed'
    union all
    select t.currency_code,o.category_id,-t.amount_minor from filtered t
      join tx_catalog o on o.id=t.reverses_transaction_id and o.user_id=t.user_id
      where t.kind='refund' and t.status='confirmed'
  ), category_totals as (
    select t.currency_code,c.alias,c.label_ar,c.label_en,count(*) count,sum(t.amount) amount
    from category_effects t left join categories c on c.id=t.category_id
    group by t.currency_code,c.alias,c.label_ar,c.label_en
  ), top_categories as (
    select * from category_totals order by amount desc,currency_code,alias nulls last limit coalesce((p_query->>'limit')::int,10) offset skip_count
  ), effects as (
    select currency_code,case when kind='income' then amount_minor else 0 end income,
      case when kind='expense' then amount_minor+fee_minor when kind='refund' then -amount_minor when fee_minor>0 then fee_minor else 0 end expense
    from filtered where status='confirmed' and (kind in ('income','expense','refund') or fee_minor>0)
  ), financial_effects as (
    select currency_code,sum(income) income,sum(expense) expense,count(*) n from effects group by currency_code
  ), balance_totals as (
    select a.currency_code,count(*) n,count(*) filter(where b.account_id is null) missing,
      sum(b.confirmed_minor) confirmed,sum(b.pending_minor) pending
    from accounts a left join public.account_balances b on b.account_id=a.id
    where a.status='active' and a.include_in_totals and (selected_account_id is null or a.id=selected_account_id)
      and (p_query->>'currency' is null or a.currency_code=p_query->>'currency') group by a.currency_code
  )
  select jsonb_build_object(
    'status','ok','tool',tool_name,'availableScopes',to_jsonb(allowed_scopes),'overviewCoverage',case when tool_name='overview' then 'Summaries, top categories, top merchants and latest five transactions cover the displayed period (current month by default). latestTransactionAllHistory separately covers confirmed movements across all history.' else null end,'period',jsonb_build_object('startDate',from_date,'endDate',to_date,'timezone',owner_timezone),
    'currencyUnits',coalesce((select jsonb_agg(jsonb_build_object('currency',c.code,'minorUnit',c.minor_unit)) from public.currencies c where c.enabled),'[]'::jsonb),
    'rankingConvention','Categories use confirmed expense amounts less linked refunds attributed to the original category, excluding fees. Unknown-category rows remain explicit. Merchants rank gross confirmed expense amounts, excluding fees/refunds. Rankings are currency separated.',
    'financialEffects',case when tool_name in ('overview','summary') and 'recent_transactions'=any(allowed_scopes) then coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'incomeMinor',income::text,'expenseMinor',expense::text,'netCashFlowMinor',(income-expense)::text,'transactionCount',n) order by currency_code) from financial_effects),'[]'::jsonb) else null end,
    'balanceTotals',case when tool_name in ('overview','accounts') and 'accounts_summary'=any(allowed_scopes) then coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'accountCount',n,'missingBalanceCount',missing,'availability',case when missing=0 then 'available' else 'unavailable' end,'confirmedMinor',case when missing=0 then confirmed::text end,'pendingMinor',case when missing=0 then pending::text end) order by currency_code) from balance_totals),'[]'::jsonb) else null end,
    'balanceConvention','Current active accounts with includeInTotals=true, separated by currency. Missing contributing projections make totals unavailable. These are not historical balances.',
    'transactionAmountConvention','Transaction amountMinor is the principal amount. feeMinor is separate. sort=largest ranks principal amountMinor separately within each currency, never across currencies; ties between currency ranks are ordered by currency. Refunds and transfers remain their own transaction kinds; filter kind=expense for expense ranking.',
    'financialEffectsConvention','Confirmed report semantics: income amounts; expense amounts plus their fees; subtract refund amounts (refund fees excluded); fees on all other kinds. Net cashflow is income minus this expense. Gross summaries remain per kind.',
    'convention','Transaction summaries include confirmed and pending separately; income, expense, transfer, refund, opening, reversal and adjustment are separate kinds. No currency conversion. Account balances are current, not historical.',
    'latestTransactionAllHistory',case when tool_name='overview' and 'recent_transactions'=any(allowed_scopes) then jsonb_build_object('coverage','all_history','transaction',(select s.data from selected s join latest_all_history l on l.id=s.id where s.kind='transaction')) else null end,
    'topExpenseMerchants',case when tool_name in ('overview','summary') and 'recent_transactions'=any(allowed_scopes) then jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'merchant',merchant,'count',count,'amountMinor',amount::text) order by amount desc) from merchant_page),'[]'::jsonb),'count',(select count(*) from merchant_totals),'hasMore',(select count(*) from merchant_totals)>skip_count+coalesce((p_query->>'limit')::int,10),'limit',coalesce((p_query->>'limit')::int,10),'offset',skip_count) else null end,
    'accounts',case when 'accounts_summary'=any(allowed_scopes) and tool_name in ('overview','accounts') then jsonb_build_object('items',coalesce((select jsonb_agg(data order by alias) from selected where kind='account'),'[]'::jsonb),'count',(select count(*) from entities where kind='account'),'hasMore',(select count(*) from entities where kind='account')>skip_count+take_count) else null end,
    'categories',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','accounts') then jsonb_build_object('items',coalesce((select jsonb_agg(data order by alias) from selected where kind='category'),'[]'::jsonb),'count',(select count(*) from entities where kind='category'),'hasMore',(select count(*) from entities where kind='category')>skip_count+take_count) else null end,
    'transactions',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','transactions') then jsonb_build_object('items',coalesce((select jsonb_agg(data order by case when p_query->>'sort'='largest' then (select p.currency_rank from currency_ranked p where p.id=selected.id) end asc nulls last,case when p_query->>'sort'='largest' then data->>'currency' end,(data->>'occurredAt') desc,alias desc) from selected where kind='transaction' and id in(select id from tx_page)),'[]'::jsonb),'count',(select count(*) from filtered),'offset',case when tool_name='overview' then 0 else skip_count end,'hasMore',(select count(*) from filtered)>case when tool_name='overview' then 5 else skip_count+take_count end) else null end,
    'summaries',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','summary') then coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'kind',kind,'status',status,'count',count,'amountMinor',amount,'feesMinor',fees)) from sums),'[]'::jsonb) else null end,
    'topExpenseCategories',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','summary') then jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'category',alias,'labelAr',label_ar,'labelEn',label_en,'count',count,'amountMinor',amount::text) order by amount desc,currency_code,alias nulls last) from top_categories),'[]'::jsonb),'count',(select count(*) from category_totals),'limit',coalesce((p_query->>'limit')::int,10),'offset',skip_count,'hasMore',(select count(*) from category_totals)>skip_count+coalesce((p_query->>'limit')::int,10)) else null end
  ),coalesce((select jsonb_agg(jsonb_build_object('alias',alias,'kind',kind,'id',id,'version',version,'data',data)) from selected),'[]'::jsonb)
  into payload,alias_map;
  if tool_name in ('overview','planning') then
    with plan_entities as (
      select s.id,'salary' kind,s.version,s.created_at,jsonb_build_object('name',s.name,'amountMinor',s.amount_minor::text,'currency',s.currency_code,'frequency',s.frequency,'expectedDay',s.expected_day,'customIntervalDays',s.custom_interval_days,'status',s.status) data
      from public.salary_profiles s where 'accounts_summary'=any(allowed_scopes) and s.user_id=owner_id and s.deleted_at is null and (selected_account_id is null or s.account_id=selected_account_id) and (p_query->>'currency' is null or s.currency_code=p_query->>'currency')
      union all
      select b.id,'budget',b.version,b.created_at,jsonb_build_object('name',b.name,'currency',b.currency_code,'periodStart',b.period_start,'periodEnd',b.period_end,'totalMinor',b.total_minor::text,'incomeTargetMinor',b.income_target_minor::text,'savingsTargetMinor',b.savings_target_minor::text,'rolloverMinor',b.rollover_minor::text,'status',b.status)
      from public.budgets b where 'budgets'=any(allowed_scopes) and b.user_id=owner_id and b.deleted_at is null and (p_query->>'currency' is null or b.currency_code=p_query->>'currency')
        and (from_date is null or b.period_end>=from_date) and (to_date is null or b.period_start<=to_date)
      union all
      select bc.id,'budget_category',bc.version,bc.created_at,jsonb_build_object('budgetName',b.name,'labelAr',c.label_ar,'labelEn',c.label_en,'currency',b.currency_code,'limitMinor',bc.limit_minor::text,'rolloverMinor',bc.rollover_minor::text,'spentMinor',v.spent_minor::text,'remainingMinor',v.remaining_minor::text,'dataState',v.data_state,'unavailableReason',v.unavailable_reason,'periodStart',b.period_start,'periodEnd',b.period_end)
      from public.budget_categories bc join public.budgets b on b.id=bc.budget_id and b.user_id=bc.user_id
      join public.categories c on c.id=bc.category_id and (c.user_id=owner_id or c.user_id is null)
      join public.v_budget_utilization v on v.budget_category_id=bc.id and v.user_id=owner_id
      where 'budgets'=any(allowed_scopes) and bc.user_id=owner_id and b.deleted_at is null and bc.status<>'deleted'
        and (selected_category_id is null or bc.category_id=selected_category_id)
        and (p_query->>'currency' is null or b.currency_code=p_query->>'currency')
        and (from_date is null or b.period_end>=from_date) and (to_date is null or b.period_start<=to_date)
      union all
      select o.id,'obligation',o.version,o.created_at,jsonb_build_object('name',o.name,'currency',o.currency_code,'type',o.type,'direction',o.direction,'status',o.status,'frequency',o.frequency,'scheduleKind',o.schedule_kind,'startDate',o.start_date,'endDate',o.end_date,'principalMinor',o.principal_minor::text,'openingPaidMinor',o.opening_paid_minor::text,'installmentAmountMinor',o.installment_amount_minor::text,'installmentCount',o.installment_count,'expectedDay',o.expected_day,'customIntervalDays',o.custom_interval_days,'remainingPrincipalMinor',(select v.remaining_minor::text from public.v_obligation_status v where v.obligation_id=o.id and v.user_id=owner_id),'overdueMinor',(select v.overdue_minor::text from public.v_obligation_status v where v.obligation_id=o.id and v.user_id=owner_id),'nextDueAt',(select v.next_due_at from public.v_obligation_status v where v.obligation_id=o.id and v.user_id=owner_id),'confirmedPaymentsMinor',coalesce((select sum(p.amount_minor) from public.obligation_payments p where p.user_id=owner_id and p.obligation_id=o.id and p.status='confirmed'),0)::text)
      from public.obligations o where 'obligations'=any(allowed_scopes) and o.user_id=owner_id and o.deleted_at is null and (selected_account_id is null or o.default_account_id=selected_account_id) and (p_query->>'currency' is null or o.currency_code=p_query->>'currency')
      union all
      select g.id,'goal',g.version,g.created_at,jsonb_build_object('name',g.name,'currency',g.currency_code,'status',g.status,'targetMinor',g.target_minor::text,'targetDate',g.target_date,'trackedMinor',(g.opening_tracked_minor+coalesce((select sum(m.amount_minor) from public.savings_goal_movements m where m.user_id=owner_id and m.goal_id=g.id),0))::text,'emergencyFund',g.emergency_fund)
      from public.savings_goals g where 'budgets'=any(allowed_scopes) and g.user_id=owner_id and g.deleted_at is null and (selected_account_id is null or g.linked_account_id=selected_account_id) and (p_query->>'currency' is null or g.currency_code=p_query->>'currency')
      union all
      select i.id,'obligation_schedule',i.version,i.created_at,jsonb_build_object('obligationName',o.name,'currency',o.currency_code,'dueAt',i.due_at,'amountMinor',i.amount_minor::text,'paidMinor',i.paid_minor::text,'status',i.status,'sequence',i.sequence_no)
      from public.obligation_schedule_items i join public.obligations o on o.id=i.obligation_id and o.user_id=i.user_id
      where 'obligations'=any(allowed_scopes) and i.user_id=owner_id and o.deleted_at is null and (selected_account_id is null or o.default_account_id=selected_account_id) and (p_query->>'currency' is null or o.currency_code=p_query->>'currency')
        and (from_date is null or i.due_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or i.due_at<(to_date+1)::timestamp at time zone owner_timezone)
      union all
      select r.id,'salary_receipt',r.version,r.created_at,jsonb_build_object('salaryName',s.name,'currency',s.currency_code,'expectedAt',r.expected_at,'receivedAt',r.received_at,'amountMinor',r.amount_minor::text,'status',r.status)
      from public.salary_receipts r join public.salary_profiles s on s.id=r.salary_profile_id and s.user_id=r.user_id
      where 'accounts_summary'=any(allowed_scopes) and r.user_id=owner_id and s.deleted_at is null and (selected_account_id is null or s.account_id=selected_account_id) and (p_query->>'currency' is null or s.currency_code=p_query->>'currency')
        and (from_date is null or r.expected_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or r.expected_at<(to_date+1)::timestamp at time zone owner_timezone)
      union all
      select r.id,'report_schedule',r.version,r.created_at,jsonb_build_object('reportType',r.report_type,'frequency',r.frequency,'timezone',r.timezone,'nextRunAt',r.next_run_at,'enabled',r.enabled)
      from public.report_schedules r where 'budgets'=any(allowed_scopes) and r.user_id=owner_id
      union all
      select m.id,'savings_movement',1,m.created_at,jsonb_build_object('goalName',g.name,'currency',g.currency_code,'amountMinor',m.amount_minor::text,'kind',m.kind,'occurredAt',m.occurred_at)
      from public.savings_goal_movements m join public.savings_goals g on g.id=m.goal_id and g.user_id=m.user_id
      where 'budgets'=any(allowed_scopes) and m.user_id=owner_id and g.deleted_at is null
        and (selected_account_id is null or g.linked_account_id=selected_account_id) and (p_query->>'currency' is null or g.currency_code=p_query->>'currency')
        and (from_date is null or m.occurred_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or m.occurred_at<(to_date+1)::timestamp at time zone owner_timezone)
      union all
      select p.id,'obligation_payment',p.version,p.created_at,jsonb_build_object('obligationName',o.name,'currency',o.currency_code,'amountMinor',p.amount_minor::text,'principalReductionMinor',p.principal_reduction_minor::text,'settlementAdjustmentMinor',p.settlement_adjustment_minor::text,'status',p.status,'paidAt',p.paid_at,'paymentCase',p.payment_case)
      from public.obligation_payments p join public.obligations o on o.id=p.obligation_id and o.user_id=p.user_id
      where 'obligations'=any(allowed_scopes) and p.user_id=owner_id and o.deleted_at is null
        and (selected_account_id is null or o.default_account_id=selected_account_id) and (p_query->>'currency' is null or o.currency_code=p_query->>'currency')
        and (from_date is null or p.paid_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or p.paid_at<(to_date+1)::timestamp at time zone owner_timezone)
      union all
      select r.id,'report_delivery',1,r.created_at,jsonb_build_object('reportType',r.report_type,'periodStart',r.period_start,'periodEnd',r.period_end,'deliveryStatus',r.delivery_status,'attemptCount',r.attempt_count,'errorCode',r.error_code,'expiresAt',r.expires_at)
      from private.report_output_attempts r where 'budgets'=any(allowed_scopes) and r.user_id=owner_id
        and (from_date is null or r.period_end>=from_date) and (to_date is null or r.period_start<=to_date)
    ), selected_plan_entities as (
      select * from plan_entities where p_query->>'collection' is null or kind=p_query->>'collection'
    ), numbered as (
      select e.* ,upper(kind)||'-'||(('x'||substr(md5(id::text),1,12))::bit(48)::bigint)::text alias,
        row_number() over(order by kind,created_at,id) n from selected_plan_entities e
    ), page as materialized (
      select *,data||jsonb_build_object('alias',alias) safe_data from numbered where n>skip_count and n<=skip_count+case when tool_name='overview' then 5 else take_count end
    ), grouped as (
      select kind,jsonb_build_object('items',coalesce((select jsonb_agg(p.safe_data order by p.n) from page p where p.kind=e.kind),'[]'::jsonb),'count',count(*),'offset',skip_count,'limit',case when tool_name='overview' then 5 else take_count end,'hasMore',exists(select 1 from numbered remaining where remaining.kind=e.kind and remaining.n>skip_count+case when tool_name='overview' then 5 else take_count end)) collection from selected_plan_entities e group by kind
    ) select payload||jsonb_build_object('planning',jsonb_build_object('stateAsOf','current','paginationConvention','Without collection, offset and limit apply to the combined page ordered by collection then creation and identity. Each count is the full collection count. Select one collection to page it alone.','totals',jsonb_build_object('goals',coalesce((select jsonb_agg(t) from (select data->>'currency' currency,sum((data->>'targetMinor')::numeric)::text "targetMinor",sum((data->>'trackedMinor')::numeric)::text "trackedMinor",sum(greatest((data->>'targetMinor')::numeric-(data->>'trackedMinor')::numeric,0))::text "shortfallMinor",count(*) count from plan_entities where kind='goal' group by data->>'currency') t),'[]'::jsonb),'obligations',coalesce((select jsonb_agg(t) from (select data->>'currency' currency,data->>'direction' direction,sum((data->>'remainingPrincipalMinor')::numeric)::text "remainingPrincipalMinor",sum((data->>'overdueMinor')::numeric)::text "overdueMinor",count(*) count from plan_entities where kind='obligation' group by data->>'currency',data->>'direction') t),'[]'::jsonb)),'budgetUtilizationConvention','Existing budget projection converts currencies using stored rates and marks partial when a rate is missing; all ledger summaries remain separated by currency.','dateFilterAppliesTo','budget overlap, obligation due dates and salary expected dates; goals, obligation balances and salary settings are current','accountFilterAppliesTo','salary, receipts, obligations, obligation schedules, goals; budgets and report schedules have no account scope','collections',coalesce((select jsonb_object_agg(kind,collection) from grouped),case when p_query->>'collection' is not null then jsonb_build_object(p_query->>'collection',jsonb_build_object('items','[]'::jsonb,'count',0,'offset',skip_count,'limit',take_count,'hasMore',false)) else '{}'::jsonb end))),
      alias_map||coalesce((select jsonb_agg(jsonb_build_object('alias',alias,'kind',kind,'id',id,'version',version,'data',safe_data)) from page),'[]'::jsonb)
    into payload,alias_map;
  end if;
  if tool_name in ('overview','profile') then
    payload:=payload||jsonb_build_object('profile',(select jsonb_build_object('locale',p.locale,'timezone',p.timezone) from public.profiles p where p.id=owner_id));
  end if;
  if tool_name='tracking' then
    payload:=payload||jsonb_build_object('tracking',jsonb_build_object('stateAsOf','current','preferences',(select jsonb_build_object('enabled',t.enabled,'reviewRequired',t.review_required) from public.tracking_preferences t where t.user_id=owner_id),'outcomes',coalesce((select jsonb_agg(jsonb_build_object('outcome',h.outcome,'count',h.n)) from (select th.outcome,count(*) n from public.tracking_history th where th.user_id=owner_id and (from_date is null or th.occurred_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or th.occurred_at<(to_date+1)::timestamp at time zone owner_timezone) group by th.outcome) h),'[]'::jsonb)));
  end if;
  if tool_name='tracking' then
    with details as (
      select r.id,'tracking_review' kind,r.version,r.created_at,jsonb_build_object('status',r.status,'reason',r.reason,'createdAt',r.created_at,'reviewedAt',r.reviewed_at,'amountMinor',i.amount_minor::text,'currency',i.currency_code,'merchant',i.merchant,'occurredAt',i.occurred_at,'confidenceBasisPoints',i.confidence_basis_points) data
      from public.review_items r join public.import_items i on i.id=r.import_item_id and i.user_id=r.user_id where r.user_id=owner_id
      union all
      select h.id,'tracking_history',1,h.occurred_at,jsonb_build_object('outcome',h.outcome,'sourceType',h.source_type,'reasonCodes',h.reason_codes,'occurredAt',h.occurred_at)
      from public.tracking_history h where h.user_id=owner_id
      union all
      select v.id,'voice_session',v.version,v.created_at,jsonb_build_object('status',v.status,'createdAt',v.created_at,'finalizedAt',v.finalized_at,'confirmedAt',v.confirmed_at,'failureCode',v.failure_code,'analysisOnly',coalesce(c.analysis_only,false),'analysisEventCount',coalesce(jsonb_array_length(c.analysis_events),0),'analysisExpiresAt',c.analysis_expires_at,'batchStatus',b.status,'committedEventCount',(select count(*) from private.voice_events e where e.user_id=owner_id and e.batch_id=b.id and e.status='committed'))
      from public.voice_sessions v left join private.voice_batch_context c on c.session_id=v.id and c.user_id=v.user_id
      left join private.voice_batches b on b.session_id=v.id and b.user_id=v.user_id where v.user_id=owner_id and v.deleted_at is null
      union all
      select v.id,'voice_preference',v.version,v.created_at,jsonb_build_object('merchantPattern',v.merchant_pattern,'confidence',v.confidence,'categoryLabelAr',c.label_ar,'categoryLabelEn',c.label_en)
      from public.voice_category_preferences v join public.categories c on c.id=v.category_id and (c.user_id=owner_id or c.user_id is null) where v.user_id=owner_id and v.deleted_at is null
    ), filtered_details as (
      select * from details where (p_query->>'collection' is null or kind=p_query->>'collection')
        and (from_date is null or created_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or created_at<(to_date+1)::timestamp at time zone owner_timezone)
        and (p_query->>'currency' is null or data->>'currency'=p_query->>'currency')
    ), numbered as (
      select *,row_number() over(order by created_at desc,id desc) n,upper(kind)||'-'||(('x'||substr(md5(id::text),1,12))::bit(48)::bigint)::text alias from filtered_details
    ), page as materialized (
      select *,data||jsonb_build_object('alias',alias) safe_data from numbered where n>skip_count and n<=skip_count+take_count
    ), grouped as (
      select kind,jsonb_build_object('items',coalesce((select jsonb_agg(p.safe_data order by p.n) from page p where p.kind=d.kind),'[]'::jsonb),'count',count(*),'offset',skip_count,'limit',take_count,'hasMore',exists(select 1 from numbered r where r.kind=d.kind and r.n>skip_count+take_count)) collection from filtered_details d group by kind
    ) select payload||jsonb_build_object('tracking',(payload->'tracking')||jsonb_build_object(
      'coverage','Review details use normalized import columns; source bodies, proposed payloads, transcripts and analysis event content are unavailable. Voice settings are saved category preferences; session analysis reports retained counts/status only, not financial ledger records. Device microphone and local-only settings are unavailable. Date filters apply to history occurrence or record creation; currency filters omit records without a currency.',
      'paginationConvention','Without collection, page all details together by creation descending. Select one collection to page it alone.',
      'voiceAnalysisPolicyEnabled',exists(select 1 from private.voice_analysis_policy a where a.enabled and a.owner_id=assistant_read.owner_id),
      'voiceOperatingStatus',coalesce((select jsonb_build_object('availability','available','state',e.state,'mode',e.mode,
        'activeOperating',e.mode='operating' and private.voice_epoch_open(e.id),'heartbeatAt',e.heartbeat_at)
        from private.staging_voice_runtime_control c join private.staging_voice_epochs e on e.id=c.current_epoch
        where e.manifest->>'ownerId'=assistant_read.owner_id),jsonb_build_object('availability','unavailable')),
      'collections',coalesce((select jsonb_object_agg(kind,collection) from grouped),case when p_query->>'collection' is not null then jsonb_build_object(p_query->>'collection',jsonb_build_object('items','[]'::jsonb,'count',0,'offset',skip_count,'limit',take_count,'hasMore',false)) else '{}'::jsonb end))),
      alias_map||coalesce((select jsonb_agg(jsonb_build_object('alias',alias,'kind',kind,'id',id,'version',version,'data',safe_data)) from page),'[]'::jsonb)
      into payload,alias_map;
  end if;
  outcome:=jsonb_build_object('observedAt',clock_timestamp(),'ledgerVersion',current_version,'data',(select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from jsonb_each(payload) p(k,v) where v<>'null'::jsonb),'aliases',alias_map);
  if octet_length(outcome::text)>60000 then
    if take_count<=1 then raise exception using errcode='54000',message='ASSISTANT_DATA_RESULT_TOO_LARGE'; end if;
    return private.read_assistant_agent_data(p_job_id,p_claim_token,p_query||jsonb_build_object('limit',greatest(1,take_count/2)))||jsonb_build_object('responseLimitReduced',true);
  end if;
  return outcome;
end $$;
alter function private.read_assistant_agent_data(uuid,uuid,jsonb) owner to masarifi_migration;
revoke all on function private.read_assistant_agent_data(uuid,uuid,jsonb) from public,anon,authenticated,service_role,masarifi_api;

reset role;
revoke masarifi_migration from current_user granted by current_user;
