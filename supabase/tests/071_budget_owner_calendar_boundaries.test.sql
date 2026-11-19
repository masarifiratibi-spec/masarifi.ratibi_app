begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
set local time zone 'UTC';

grant masarifi_migration,masarifi_api to current_user with inherit true,set true;
grant usage on schema extensions to masarifi_api;
set local role masarifi_migration;
insert into public.profiles(id,timezone) values
  ('budget_calendar_riyadh','Asia/Riyadh'),
  ('budget_calendar_new_york','America/New_York');
insert into public.budgets(id,user_id,name,currency_code,period_start,period_end,total_minor,status) values
  ('071b0000-0000-4000-8000-000000000001','budget_calendar_riyadh','March','SAR','2026-03-01','2026-03-31',1000,'active'),
  ('071b0000-0000-4000-8000-000000000002','budget_calendar_new_york','March','SAR','2026-03-01','2026-03-31',1000,'active');
insert into public.budget_categories(user_id,budget_id,category_id,limit_minor)
select user_id,id,'04000000-0000-4000-8000-000000000002',1000
from public.budgets where user_id in ('budget_calendar_riyadh','budget_calendar_new_york');

-- Identical instants for both owners. Each amount identifies one boundary point in the sum.
insert into public.transactions(user_id,kind,status,amount_minor,currency_code,category_id,title,occurred_at,created_at)
select p.id,'expense','confirmed',point.amount,'SAR','04000000-0000-4000-8000-000000000002',
  'March boundary',point.instant::timestamptz,'2026-04-02T00:00:00Z'
from public.profiles p cross join (values
  (1,   '2026-02-28T20:59:59.999999Z'),
  (2,   '2026-02-28T21:00:00Z'),          -- Riyadh starts
  (4,   '2026-02-28T21:30:00Z'),
  (8,   '2026-03-01T04:59:59.999999Z'),
  (16,  '2026-03-01T05:00:00Z'),          -- New York starts in standard time
  (32,  '2026-03-31T20:59:59.999999Z'),
  (64,  '2026-03-31T21:00:00Z'),          -- Riyadh ends
  (128, '2026-04-01T03:59:59.999999Z'),
  (256, '2026-04-01T04:00:00Z')           -- New York ends in daylight time
) point(amount,instant)
where p.id in ('budget_calendar_riyadh','budget_calendar_new_york');

reset role;
set local role masarifi_api;
select set_config('request.jwt.claims','{"sub":"budget_calendar_riyadh","role":"authenticated"}',true);
select is((select spent_minor from public.v_budget_utilization where user_id='budget_calendar_riyadh'),
  62::bigint,'Riyadh includes local March 1 midnight through the last microsecond of March');
select is((select count(*) from public.v_budget_utilization where user_id='budget_calendar_new_york'),
  0::bigint,'the API caller sees only its own budget');

select set_config('request.jwt.claims','{"sub":"budget_calendar_new_york","role":"authenticated"}',true);
select is((select spent_minor from public.v_budget_utilization where user_id='budget_calendar_new_york'),
  240::bigint,'New York uses its own local midnights on either side of the DST change');
set local time zone 'Asia/Tokyo';
select is((select spent_minor from public.v_budget_utilization where user_id='budget_calendar_new_york'),
  240::bigint,'changing the database session timezone leaves owner-local spend unchanged');

reset role;
select * from finish();
rollback;
