do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.budget_timezone_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.budget_timezone_grant', 'temporary', true);
  end if;
end
$role$;

set local role masarifi_migration;

create or replace view public.v_budget_utilization with (security_invoker=true) as
select b.id budget_id,b.user_id,c.id budget_category_id,c.category_id,c.limit_minor,
  spend.spent_minor,
  c.limit_minor-spend.spent_minor remaining_minor,
  case when c.limit_minor=0 then null
    else round(10000.0*spend.spent_minor/c.limit_minor)::integer end utilization_bps,
  coalesce((select max(ab.ledger_version) from public.account_balances ab
    join public.accounts a on a.id=ab.account_id where a.user_id=b.user_id),0)::bigint ledger_version,
  case when spend.missing_rate then 'partial' else 'complete' end::text data_state,
  case when spend.missing_rate then 'missing_rate' else null end::text unavailable_reason
from public.budgets b
join public.profiles p on p.id=b.user_id
join public.budget_categories c on c.budget_id=b.id
cross join lateral (
  select coalesce(sum(case when item.rate is null then 0
      when item.kind='expense' then round(item.amount_minor*item.rate)
      else -round(item.amount_minor*item.rate) end),0)::bigint spent_minor,
    coalesce(bool_or(item.rate is null),false) missing_rate
  from (
    select t.kind,t.amount_minor,
      case when t.currency_code=b.currency_code then 1::numeric
        else (select r.rate from public.exchange_rates r
          where r.base_currency=t.currency_code and r.quote_currency=b.currency_code
            and r.effective_at<=t.occurred_at and r.effective_at>=t.occurred_at-interval '30 days'
          order by r.effective_at desc,r.provider,r.id limit 1) end rate
    from public.transactions t
    left join public.transactions original
      on original.id=t.reverses_transaction_id and original.user_id=t.user_id
    where t.user_id=b.user_id and coalesce(t.category_id,original.category_id)=c.category_id
      and t.status='confirmed' and t.kind in ('expense','refund')
      and t.occurred_at>=(b.period_start::timestamp at time zone p.timezone)
      and t.occurred_at<((b.period_end+1)::timestamp at time zone p.timezone)
  ) item
) spend
where b.status<>'deleted' and c.status<>'deleted';

reset role;

do $role$
begin
  if current_setting('masarifi.budget_timezone_grant') = 'temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
