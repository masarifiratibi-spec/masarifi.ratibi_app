begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
set local role masarifi_migration;
do $test$
declare
  owner_id text := 'obligation_schedule_probe_' || gen_random_uuid()::text;
  probe_id uuid := gen_random_uuid();
  result jsonb;
  rows_count integer;
  residual_id uuid := gen_random_uuid();
begin
  insert into public.profiles(id,status,timezone) values(owner_id,'active','Asia/Riyadh');
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',owner_id,'sid','schedule-probe')::text,true);
  result := private.save_obligation(owner_id,jsonb_build_object(
    'operation','create','obligationId',probe_id,'operationId',gen_random_uuid(),'requestId','schedule-probe',
    'name','Schedule probe','direction','payable','type','installment','scheduleKind','fixed_term',
    'currencyCode','SAR','principalMinor','10000','openingPaidMinor','0','installmentAmountMinor','5000',
    'installmentCount',2,'frequency','monthly','expectedDay',extract(day from current_date)::integer,
    'customIntervalDays',null,'startDate',current_date,'endDate',null,'defaultAccountId',null,
    'automaticMatchingEnabled',false,'provider',null,'providerKeywords','[]'::jsonb,'reminderTiming',null,'notes',null
  ));
  select count(*) into rows_count from public.obligation_schedule_items
    where user_id=owner_id and public.obligation_schedule_items.obligation_id=probe_id;
  if rows_count<>2 then raise exception 'INITIAL_SCHEDULE_NOT_GENERATED'; end if;
  if exists(select 1 from public.obligation_schedule_items i where i.obligation_id=probe_id and i.amount_minor<>5000)
    then raise exception 'INSTALLMENT_AMOUNT_MISMATCH'; end if;
  result := private.save_obligation(owner_id,jsonb_build_object(
    'operation','update','obligationId',probe_id,'expectedVersion',(result->>'version')::bigint,
    'operationId',gen_random_uuid(),'requestId','schedule-probe-edit',
    'patch',jsonb_build_object('name','Renamed probe','principalMinor','10000','installmentAmountMinor','5000','installmentCount',2)
  ));
  begin
    perform private.save_obligation(owner_id,jsonb_build_object(
      'operation','update','obligationId',probe_id,'expectedVersion',(result->>'version')::bigint,
      'operationId',gen_random_uuid(),'requestId','schedule-probe-lock','patch',jsonb_build_object('principalMinor','11000')));
    raise exception 'SCHEDULE_LOCK_MISSING';
  exception when others then
    if SQLERRM<>'OBLIGATION_SCHEDULE_LOCKED' then raise; end if;
  end;
  perform private.generate_obligation_schedule(owner_id,probe_id,(current_date+interval '18 months')::date);
  select count(*) into rows_count from public.obligation_schedule_items i where i.obligation_id=probe_id;
  if rows_count<>2 then raise exception 'DUPLICATE_INSTALLMENTS'; end if;
  perform private.save_obligation(owner_id,jsonb_build_object(
    'operation','create','obligationId',residual_id,'operationId',gen_random_uuid(),'requestId','schedule-probe-residual',
    'name','Residual probe','direction','payable','type','installment','scheduleKind','fixed_term',
    'currencyCode','SAR','principalMinor','11500','openingPaidMinor','1000','installmentAmountMinor','5000',
    'installmentCount',3,'frequency','monthly','expectedDay',extract(day from current_date)::integer,
    'customIntervalDays',null,'startDate',current_date,'endDate',null,'defaultAccountId',null,
    'automaticMatchingEnabled',false,'provider',null,'providerKeywords','[]'::jsonb,'reminderTiming',null,'notes',null));
  if (select array_agg(i.amount_minor order by i.sequence_no) from public.obligation_schedule_items i where i.obligation_id=residual_id) is distinct from array[5000,5000,500]::bigint[]
    then raise exception 'RESIDUAL_OR_OPENING_BALANCE_MISMATCH'; end if;
  if exists(select 1 from public.obligation_payments p where p.user_id=owner_id)
    then raise exception 'UNEXPECTED_PAYMENT_CREATED'; end if;
end $test$;
reset role;
select pass('initial installments are atomic, idempotent, exact, and keep financial terms locked');
select * from finish();
rollback;
