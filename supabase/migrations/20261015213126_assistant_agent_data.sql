-- Fixed, read-only assistant tools. Owner comes only from the fenced queue row.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create function private.read_assistant_agent_data(p_job_id uuid,p_claim_token uuid,p_query jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
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
    or p_query - array['tool','kind','startDate','endDate','currency','minAmountMinor','maxAmountMinor','account','category','search','sort','limit','offset'] <> '{}'::jsonb
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
      and (selected_category_id is null or t.category_id=selected_category_id)
      and (selected_account_id is null or exists(select 1 from public.transaction_postings p join accounts a on a.id=p.account_id where p.transaction_id=t.id and a.id=selected_account_id))
      and (p_query->>'search' is null or position(lower(p_query->>'search') in lower(coalesce(t.merchant,'')||' '||coalesce(t.note,'')||' '||t.title))>0)
  ), filtered as materialized (
    select t.* from scoped_transactions t where (from_date is null or t.occurred_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or t.occurred_at<(to_date+1)::timestamp at time zone owner_timezone)
  ), latest_all_history as (
    select * from scoped_transactions where status='confirmed' order by occurred_at desc,id desc limit 1
  ), tx_page as (
    select * from filtered order by case when p_query->>'sort'='largest' then amount_minor end desc nulls last,occurred_at desc,id desc
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
  ), merchant_page as (select * from merchant_totals order by amount desc,currency_code,merchant limit 10
  ), top_categories as (
    select t.currency_code,c.alias,c.label_ar,c.label_en,count(*) count,sum(t.amount_minor)::text amount
    from filtered t left join categories c on c.id=t.category_id where t.kind='expense' and t.status='confirmed'
    group by t.currency_code,c.alias,c.label_ar,c.label_en order by sum(t.amount_minor) desc limit 10
  )
  select jsonb_build_object(
    'status','ok','tool',tool_name,'availableScopes',to_jsonb(allowed_scopes),'overviewCoverage',case when tool_name='overview' then 'Summaries, top categories, top merchants and latest five transactions cover the displayed period (current month by default). latestTransactionAllHistory separately covers confirmed movements across all history.' else null end,'period',jsonb_build_object('startDate',from_date,'endDate',to_date,'timezone',owner_timezone),
    'currencyUnits',coalesce((select jsonb_agg(jsonb_build_object('currency',c.code,'minorUnit',c.minor_unit)) from public.currencies c where c.enabled),'[]'::jsonb),
    'convention','Transaction summaries include confirmed and pending separately; income, expense, transfer, refund, opening, reversal and adjustment are separate kinds. No currency conversion. Account balances are current, not historical.',
    'latestTransactionAllHistory',case when tool_name='overview' and 'recent_transactions'=any(allowed_scopes) then jsonb_build_object('coverage','all_history','transaction',(select s.data from selected s join latest_all_history l on l.id=s.id where s.kind='transaction')) else null end,
    'topExpenseMerchants',case when tool_name in ('overview','summary') and 'recent_transactions'=any(allowed_scopes) then jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'merchant',merchant,'count',count,'amountMinor',amount::text) order by amount desc) from merchant_page),'[]'::jsonb),'count',(select count(*) from merchant_totals),'hasMore',(select count(*) from merchant_totals)>10,'limit',10) else null end,
    'accounts',case when 'accounts_summary'=any(allowed_scopes) and tool_name in ('overview','accounts') then jsonb_build_object('items',coalesce((select jsonb_agg(data order by alias) from selected where kind='account'),'[]'::jsonb),'count',(select count(*) from entities where kind='account'),'hasMore',(select count(*) from entities where kind='account')>skip_count+take_count) else null end,
    'categories',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','accounts') then jsonb_build_object('items',coalesce((select jsonb_agg(data order by alias) from selected where kind='category'),'[]'::jsonb),'count',(select count(*) from entities where kind='category'),'hasMore',(select count(*) from entities where kind='category')>skip_count+take_count) else null end,
    'transactions',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','transactions') then jsonb_build_object('items',coalesce((select jsonb_agg(data order by case when p_query->>'sort'='largest' then (data->>'amountMinor')::numeric end desc nulls last,(data->>'occurredAt') desc,alias desc) from selected where kind='transaction' and id in(select id from tx_page)),'[]'::jsonb),'count',(select count(*) from filtered),'offset',case when tool_name='overview' then 0 else skip_count end,'hasMore',(select count(*) from filtered)>case when tool_name='overview' then 5 else skip_count+take_count end) else null end,
    'summaries',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','summary') then coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'kind',kind,'status',status,'count',count,'amountMinor',amount,'feesMinor',fees)) from sums),'[]'::jsonb) else null end,
    'topExpenseCategories',case when 'recent_transactions'=any(allowed_scopes) and tool_name in ('overview','summary') then coalesce((select jsonb_agg(jsonb_build_object('currency',currency_code,'category',alias,'labelAr',label_ar,'labelEn',label_en,'count',count,'amountMinor',amount)) from top_categories),'[]'::jsonb) else null end
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
      where 'obligations'=any(allowed_scopes) and i.user_id=owner_id and (selected_account_id is null or o.default_account_id=selected_account_id) and (p_query->>'currency' is null or o.currency_code=p_query->>'currency')
        and (from_date is null or i.due_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or i.due_at<(to_date+1)::timestamp at time zone owner_timezone)
      union all
      select r.id,'salary_receipt',r.version,r.created_at,jsonb_build_object('salaryName',s.name,'currency',s.currency_code,'expectedAt',r.expected_at,'receivedAt',r.received_at,'amountMinor',r.amount_minor::text,'status',r.status)
      from public.salary_receipts r join public.salary_profiles s on s.id=r.salary_profile_id and s.user_id=r.user_id
      where 'accounts_summary'=any(allowed_scopes) and r.user_id=owner_id and (selected_account_id is null or s.account_id=selected_account_id) and (p_query->>'currency' is null or s.currency_code=p_query->>'currency')
        and (from_date is null or r.expected_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or r.expected_at<(to_date+1)::timestamp at time zone owner_timezone)
      union all
      select r.id,'report_schedule',r.version,r.created_at,jsonb_build_object('reportType',r.report_type,'frequency',r.frequency,'timezone',r.timezone,'nextRunAt',r.next_run_at,'enabled',r.enabled)
      from public.report_schedules r where 'budgets'=any(allowed_scopes) and r.user_id=owner_id
    ), numbered as (
      select e.* ,upper(kind)||'-'||(('x'||substr(md5(id::text),1,12))::bit(48)::bigint)::text alias,
        row_number() over(partition by kind order by created_at,id) n from plan_entities e
    ), page as materialized (
      select *,data||jsonb_build_object('alias',alias) safe_data from numbered where n>skip_count and n<=skip_count+case when tool_name='overview' then 5 else take_count end
    ), grouped as (
      select kind,jsonb_build_object('items',coalesce((select jsonb_agg(p.safe_data order by p.n) from page p where p.kind=e.kind),'[]'::jsonb),'count',count(*),'hasMore',count(*)>skip_count+case when tool_name='overview' then 5 else take_count end) collection from plan_entities e group by kind
    ) select payload||jsonb_build_object('planning',jsonb_build_object('stateAsOf','current','budgetUtilizationConvention','Existing budget projection converts currencies using stored rates and marks partial when a rate is missing; all ledger summaries remain separated by currency.','dateFilterAppliesTo','budget overlap, obligation due dates and salary expected dates; goals, obligation balances and salary settings are current','accountFilterAppliesTo','salary, receipts, obligations, obligation schedules, goals; budgets and report schedules have no account scope','collections',coalesce((select jsonb_object_agg(kind,collection) from grouped),'{}'::jsonb))),
      alias_map||coalesce((select jsonb_agg(jsonb_build_object('alias',alias,'kind',kind,'id',id,'version',version,'data',safe_data)) from page),'[]'::jsonb)
    into payload,alias_map;
  end if;
  if tool_name in ('overview','profile') then
    payload:=payload||jsonb_build_object('profile',(select jsonb_build_object('locale',p.locale,'timezone',p.timezone) from public.profiles p where p.id=owner_id));
  end if;
  if tool_name='tracking' then
    payload:=payload||jsonb_build_object('tracking',jsonb_build_object('stateAsOf','current','preferences',(select jsonb_build_object('enabled',t.enabled,'reviewRequired',t.review_required) from public.tracking_preferences t where t.user_id=owner_id),'outcomes',coalesce((select jsonb_agg(jsonb_build_object('outcome',h.outcome,'count',h.n)) from (select outcome,count(*) n from public.tracking_history where user_id=owner_id and (from_date is null or occurred_at>=from_date::timestamp at time zone owner_timezone) and (to_date is null or occurred_at<(to_date+1)::timestamp at time zone owner_timezone) group by outcome) h),'[]'::jsonb)));
  end if;
  outcome:=jsonb_build_object('observedAt',clock_timestamp(),'ledgerVersion',current_version,'data',(select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from jsonb_each(payload) p(k,v) where v<>'null'::jsonb),'aliases',alias_map);
  if octet_length(outcome::text)>65536 then raise exception using errcode='54000',message='ASSISTANT_DATA_RESULT_TOO_LARGE'; end if;
  return outcome;
end $$;
alter function private.read_assistant_agent_data(uuid,uuid,jsonb) owner to masarifi_migration;
revoke all on function private.read_assistant_agent_data(uuid,uuid,jsonb) from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.read_assistant_agent_data(uuid,uuid,jsonb) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
