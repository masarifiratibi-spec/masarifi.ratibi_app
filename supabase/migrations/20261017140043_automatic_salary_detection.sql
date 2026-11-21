grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

alter table public.salary_profiles add column automatic_detection_started_at timestamptz;
alter table public.salary_receipts add column automatically_detected boolean not null default false;

create index transactions_salary_detection_idx
  on public.transactions(user_id,currency_code,amount_minor,occurred_at,id)
  where kind='income' and status='confirmed' and deleted_at is null;
create index salary_receipts_transaction_history_idx
  on public.salary_receipts(transaction_id) where transaction_id is not null;

create function private.initialize_salary_detection() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not new.automatic_detection_enabled or new.status<>'active' then
    new.automatic_detection_started_at:=null;
  elsif tg_op='INSERT' then
    new.automatic_detection_started_at:=transaction_timestamp();
  elsif old.automatic_detection_started_at is null or not old.automatic_detection_enabled or old.status<>'active' then
    new.automatic_detection_started_at:=transaction_timestamp();
  else
    new.automatic_detection_started_at:=old.automatic_detection_started_at;
  end if;
  return new;
end $$;
create trigger salary_detection_activation before insert or update on public.salary_profiles
  for each row execute function private.initialize_salary_detection();

create function private.salary_income_is_clear(p_title text,p_merchant text,p_employer text)
returns boolean language sql immutable parallel safe set search_path='' as $$
  select coalesce(concat_ws(' ',p_title,p_merchant) !~*
    '(^|[[:space:][:punct:]])(refund|reversal|loan|استرداد|مرتجع|عكس|قرض|سلفة)([[:space:][:punct:]]|$)'
    and (concat_ws(' ',p_title,p_merchant) ~*
      '(^|[[:space:][:punct:]])(salary|payroll|wage|wages|راتب|راتبي|الراتب|رواتب|الرواتب|مرتب|مرتبي)([[:space:][:punct:]]|$)'
      or (char_length(btrim(p_employer))>=3 and
        position(lower(btrim(p_employer)) in lower(concat_ws(' ',p_title,p_merchant)))>0)),false)
$$;

create function private.salary_detection_candidates(p_user_id text,p_profile_id uuid)
returns table(receipt_id uuid,transaction_id uuid,amount_minor bigint,received_at timestamptz)
language sql stable security definer set search_path='' as $$
  with candidates as (
    select r.id receipt_id,t.id transaction_id,t.amount_minor,t.occurred_at received_at,
      count(*) over(partition by r.id) receipt_candidates,
      count(*) over(partition by t.id) transaction_candidates
    from public.salary_profiles p
    join public.profiles u on u.id=p.user_id and u.status='active'
    join public.accounts a on a.id=p.account_id and a.user_id=p.user_id and a.status='active'
      and a.currency_code=p.currency_code
    join public.salary_receipts r on r.salary_profile_id=p.id and r.user_id=p.user_id
      and r.status in ('expected','missed')
    join public.transactions t on t.user_id=p.user_id and t.kind='income' and t.status='confirmed'
      and t.deleted_at is null and t.reverses_transaction_id is null
      and t.currency_code=p.currency_code and t.amount_minor=p.amount_minor
      and t.created_at>=p.automatic_detection_started_at
      and t.occurred_at between r.expected_at-interval '5 days' and r.expected_at+interval '5 days'
    where p.id=p_profile_id and p.user_id=p_user_id and p.status='active'
      and p.automatic_detection_enabled and p.automatic_detection_started_at is not null
      and abs((t.occurred_at at time zone u.timezone)::date-(r.expected_at at time zone u.timezone)::date)<=3
      and (p.frequency<>'monthly' or extract(day from r.expected_at at time zone u.timezone)=least(
        p.expected_day,extract(day from date_trunc('month',r.expected_at at time zone u.timezone)+interval '1 month - 1 day')))
      and private.salary_income_is_clear(t.title,t.merchant,p.name)
      and (select sum(tp.amount_minor) from public.transaction_postings tp
        where tp.transaction_id=t.id and tp.account_id=a.id and tp.clearing_state='confirmed')=t.amount_minor
      -- An owner undo is permanent for this transaction, even after a retry or re-enable.
      and not exists(select 1 from public.salary_receipts history where history.transaction_id=t.id)
      and not exists(select 1 from public.salary_profiles other
        where other.id<>p.id and other.user_id=p.user_id and other.status='active'
          and other.automatic_detection_enabled and other.automatic_detection_started_at is not null
          and t.created_at>=other.automatic_detection_started_at
          and other.account_id=p.account_id and other.currency_code=p.currency_code and other.amount_minor=p.amount_minor
          and private.salary_income_is_clear(t.title,t.merchant,other.name))
  )
  select receipt_id,transaction_id,amount_minor,received_at from candidates
  where receipt_candidates=1 and transaction_candidates=1
$$;

create function private.detect_salary_receipts(p_user_id text,p_profile_id uuid,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  profile public.salary_profiles; receipt public.salary_receipts; candidate record;
  detected integer:=0; undone integer:=0; ledger_version bigint;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode='22023',message='SALARY_DETECTION_LIMIT_INVALID';
  end if;
  perform 1 from public.profiles where id=p_user_id and status='active' for share;
  if not found then return jsonb_build_object('detectedCount',0,'undoneCount',0); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id,0));
  select * into profile from public.salary_profiles where id=p_profile_id and user_id=p_user_id for update;
  if not found then raise exception using errcode='P0001',message='SALARY_PROFILE_NOT_FOUND'; end if;
  select coalesce(max(b.ledger_version),0) into ledger_version from public.account_balances b
    join public.accounts a on a.id=b.account_id where a.user_id=p_user_id;

  for receipt in select r.* from public.salary_receipts r join public.transactions t on t.id=r.transaction_id
    where r.salary_profile_id=profile.id and r.user_id=p_user_id and r.automatically_detected
      and r.status in ('received','corrected') and (t.status<>'confirmed' or t.deleted_at is not null
        or t.kind<>'income' or t.amount_minor<>r.amount_minor)
    order by r.id limit p_limit for update of r
  loop
    update public.salary_receipts set status='undone',received_at=null where id=receipt.id returning * into receipt;
    perform private.enqueue_outbox_event('planning.salary_receipt_undone','salary-receipt',receipt.id,
      jsonb_build_object('profileId',profile.id,'receiptId',receipt.id,'userId',p_user_id,
        'version',receipt.version,'status',receipt.status,'cycleDate',receipt.expected_at::date,
        'ledgerVersion',ledger_version,'occurredAt',clock_timestamp(),'requestId','automatic-salary-reconcile'));
    perform audit.append_event(p_user_id,'system','planning.salary-receipt-undone','salary_receipt',receipt.id::text,
      null,null,null,'automatic-salary-reconcile',jsonb_build_object('version',receipt.version,'automatic',true));
    undone:=undone+1;
  end loop;

  for candidate in select * from private.salary_detection_candidates(p_user_id,profile.id) order by receipt_id limit p_limit
  loop
    perform 1 from public.transactions where id=candidate.transaction_id and user_id=p_user_id for update;
    update public.salary_receipts r set transaction_id=candidate.transaction_id,
      received_at=candidate.received_at,amount_minor=candidate.amount_minor,status='received',
      automatically_detected=true,operation_id=extensions.gen_random_uuid()
    where r.id=candidate.receipt_id and r.user_id=p_user_id and r.status in ('expected','missed') returning * into receipt;
    if not found then continue; end if;
    perform private.enqueue_outbox_event('planning.salary_receipt_received','salary-receipt',receipt.id,
      jsonb_build_object('profileId',profile.id,'receiptId',receipt.id,'userId',p_user_id,
        'version',receipt.version,'status',receipt.status,'cycleDate',receipt.expected_at::date,
        'ledgerVersion',ledger_version,'occurredAt',clock_timestamp(),'requestId','automatic-salary-detection'));
    perform audit.append_event(p_user_id,'system','planning.salary-receipt-received','salary_receipt',receipt.id::text,
      null,null,null,'automatic-salary-detection',jsonb_build_object('version',receipt.version,'automatic',true));
    detected:=detected+1;
  end loop;
  return jsonb_build_object('detectedCount',detected,'undoneCount',undone);
end $$;

create function private.queue_salary_detection() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='salary_profiles' then
    if new.status='active' then
      insert into private.planning_job_claims(job_name,resource_id,natural_key)
      values('planning.salary-cycle.generate',new.id,'salary-profile:'||new.id::text||':'||new.version::text)
      on conflict(job_name,natural_key) do nothing;
    end if;
  elsif new.kind='income' then
    insert into private.planning_job_claims(job_name,resource_id,natural_key)
    select 'planning.salary-cycle.generate',p.id,'salary-income:'||p.id::text||':'||new.id::text||':'||new.version::text
    from public.salary_profiles p where p.user_id=new.user_id and (
      (p.status='active' and p.automatic_detection_enabled and p.automatic_detection_started_at is not null
        and p.currency_code=new.currency_code and p.amount_minor=new.amount_minor)
      or exists(select 1 from public.salary_receipts r where r.salary_profile_id=p.id
        and r.transaction_id=new.id and r.automatically_detected and r.status in ('received','corrected')))
    on conflict(job_name,natural_key) do nothing;
  end if;
  return new;
end $$;
create trigger salary_profile_detection_queue after insert or update on public.salary_profiles
  for each row execute function private.queue_salary_detection();
create trigger salary_income_detection_queue after insert or update on public.transactions
  for each row execute function private.queue_salary_detection();

create function private.run_salary_detection_jobs(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare claim record; outcome jsonb; processed integer:=0; detected integer:=0; failed integer:=0; code text;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode='22023',message='SALARY_DETECTION_LIMIT_INVALID';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('automatic-salary-runner',0)) then
    return jsonb_build_object('processedCount',0,'detectedCount',0,'failedCount',0);
  end if;
  for claim in select * from private.claim_planning_salary_cycles(null,p_limit,60)
  loop
    begin
      outcome:=private.execute_planning_claim(claim.id,claim.lease_token,'planning.salary-cycle.generate',claim.resource_id);
      perform private.complete_planning_claim(claim.id,claim.lease_token,'completed',outcome);
      detected:=detected+coalesce((outcome->>'detectedCount')::integer,0);
    exception when others then
      code:=coalesce(substring(sqlerrm from '[A-Z][A-Z0-9_]{2,63}'),'SALARY_DETECTION_FAILED');
      perform private.complete_planning_claim(claim.id,claim.lease_token,
        case when claim.attempt_count>=8 then 'exhausted' else 'retry' end,jsonb_build_object('errorCode',code));
      failed:=failed+1;
    end;
    processed:=processed+1;
  end loop;
  return jsonb_build_object('processedCount',processed,'detectedCount',detected,'failedCount',failed);
end $$;

CREATE OR REPLACE FUNCTION private.execute_planning_claim(p_claim_id uuid, p_lease_token uuid, p_job_name text, p_resource_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare owner_id text; schedule record; intent_id uuid; result jsonb;
begin
  perform 1 from private.planning_job_claims
  where id=p_claim_id and lease_token=p_lease_token and status='running'
    and locked_until>clock_timestamp() and job_name=p_job_name and resource_id=p_resource_id
  for update;
  if not found then raise exception using errcode='P0001',message='PLANNING_CLAIM_STALE'; end if;

  if p_job_name='planning.salary-cycle.generate' then
    select user_id into owner_id from public.salary_profiles where id=p_resource_id;
    if owner_id is null then raise exception using errcode='P0001',message='PLANNING_RESOURCE_NOT_FOUND'; end if;
    perform 1 from public.profiles where id=owner_id and status='active' for share;
    if not found then return jsonb_build_object('insertedCount',0,'existingCount',0,'detectedCount',0); end if;
    -- Match ledger lock order before acquiring the salary profile row lock.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id,0));
    select jsonb_build_object('insertedCount',inserted_count,'existingCount',existing_count) into result
      from private.generate_salary_receipts(owner_id,p_resource_id,current_date+90);
    result:=result||private.detect_salary_receipts(owner_id,p_resource_id,50);
  elsif p_job_name='planning.obligation-schedule.generate' then
    select user_id into owner_id from public.obligations where id=p_resource_id and status='active';
    if owner_id is null then raise exception using errcode='P0001',message='PLANNING_RESOURCE_NOT_FOUND'; end if;
    select jsonb_build_object('insertedCount',inserted_count,'existingCount',existing_count) into result
      from private.generate_obligation_schedule(
        owner_id,p_resource_id,(current_date+interval '18 months')::date
      );
  elsif p_job_name='planning.payment-match.propose' then
    select jsonb_build_object('insertedCount',inserted_count,'existingCount',existing_count) into result
      from private.propose_payment_matches(p_resource_id,20);
  elsif p_job_name='planning.overdue.mark' then
    select i.user_id,i.obligation_id,i.version,i.due_at into schedule
      from public.obligation_schedule_items i join public.obligations o on o.id=i.obligation_id
      where i.id=p_resource_id and o.status='active' and i.status in ('due','partial')
        and i.paid_minor<i.amount_minor and i.due_at<clock_timestamp()
      for update of i;
    if schedule.user_id is null then
      result=jsonb_build_object('insertedCount',0,'existingCount',1);
    else
      update public.obligation_schedule_items set status='overdue' where id=p_resource_id;
      perform private.enqueue_outbox_event('planning.obligation_overdue','obligation-schedule',p_resource_id,
        jsonb_build_object('obligationId',schedule.obligation_id,'scheduleItemId',p_resource_id,
          'userId',schedule.user_id,'aggregateVersion',schedule.version+1,'dueAt',schedule.due_at,
          'status','overdue','ledgerVersion',0,'requestId','planning-overdue'));
      perform audit.append_event(schedule.user_id,'system','planning.obligation-overdue','obligation_schedule',
        p_resource_id::text,null,null,null,'planning-overdue',jsonb_build_object('version',schedule.version+1));
      result=jsonb_build_object('insertedCount',1,'existingCount',0);
    end if;
  elsif p_job_name='planning.reminders.emit' then
    select i.id,i.user_id,i.obligation_id,i.due_at,o.version into schedule
      from public.obligation_schedule_items i join public.obligations o on o.id=i.obligation_id
      where i.id=p_resource_id and o.status='active';
    if schedule.id is null then raise exception using errcode='P0001',message='PLANNING_RESOURCE_NOT_FOUND'; end if;
    insert into private.planning_reminder_intents(user_id,resource_type,resource_id,due_at,reason_code)
      values(schedule.user_id,'obligation',schedule.obligation_id,schedule.due_at,'obligation_due')
      on conflict(resource_type,resource_id,due_at,reason_code) do nothing returning id into intent_id;
    if intent_id is not null then
      perform private.enqueue_outbox_event('planning.reminder_intent_created','obligation',schedule.obligation_id,
        jsonb_build_object('obligationId',schedule.obligation_id,'userId',schedule.user_id,
          'aggregateVersion',schedule.version,'dueAt',schedule.due_at,'reasonCode','obligation_due',
          'ledgerVersion',0,'requestId','planning-reminder-worker'));
    end if;
    result=jsonb_build_object('insertedCount',case when intent_id is null then 0 else 1 end,
      'existingCount',case when intent_id is null then 1 else 0 end);
  else
    raise exception using errcode='22023',message='PLANNING_JOB_INVALID';
  end if;
  return coalesce(result,'{}'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION private.generate_salary_receipts(p_user_id text, p_profile_id uuid, p_through_date date)
 RETURNS TABLE(inserted_count integer, existing_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  profile public.salary_profiles; owner_timezone text; anchor date; candidate date; month_anchor date;
  sequence_no integer:=0; inserted_total integer:=0; considered integer:=0; receipt_id uuid;
begin
  select p.* into profile from public.salary_profiles p
  where p.id=p_profile_id and p.user_id=p_user_id for update;
  if profile.id is null then raise exception using errcode='P0001',message='SALARY_PROFILE_NOT_FOUND'; end if;
  select u.timezone into owner_timezone from public.profiles u where u.id=p_user_id;
  if profile.status<>'active' then return query select 0,0; return; end if;
  anchor:=case when profile.automatic_detection_enabled and profile.automatic_detection_started_at is not null
    then greatest((clock_timestamp() at time zone owner_timezone)::date-3,
      (profile.automatic_detection_started_at at time zone owner_timezone)::date-3)
    else greatest(current_date,profile.created_at::date) end;
  if p_through_date is null or p_through_date<anchor or p_through_date>anchor+interval '18 months' then
    raise exception using errcode='22023',message='PLANNING_HORIZON_INVALID';
  end if;

  loop
    if profile.frequency='monthly' then
      month_anchor:=(date_trunc('month',anchor)::date+(sequence_no||' months')::interval)::date;
      candidate:=make_date(extract(year from month_anchor)::integer,extract(month from month_anchor)::integer,
        least(profile.expected_day,extract(day from (month_anchor+interval '1 month'-interval '1 day'))::integer));
      if sequence_no=0 and candidate<anchor then sequence_no:=sequence_no+1; continue; end if;
    elsif profile.frequency in ('weekly','biweekly') then
      candidate:=anchor+((profile.expected_day-extract(dow from anchor)::integer+7)%7)
        +sequence_no*case when profile.frequency='weekly' then 7 else 14 end;
    else
      candidate:=anchor+sequence_no*profile.custom_interval_days;
    end if;
    exit when candidate>p_through_date;
    considered:=considered+1; receipt_id:=null;
    insert into public.salary_receipts(user_id,salary_profile_id,expected_at,amount_minor)
    values(p_user_id,profile.id,candidate::timestamp at time zone owner_timezone,profile.amount_minor)
    on conflict(salary_profile_id,expected_at) do nothing returning id into receipt_id;
    if receipt_id is not null then
      inserted_total:=inserted_total+1;
      perform private.enqueue_outbox_event('planning.salary_receipt_expected','salary-receipt',receipt_id,
        jsonb_build_object('profileId',profile.id,'receiptId',receipt_id,'userId',p_user_id,'version',1,
          'status','expected','cycleDate',candidate,'ledgerVersion',0,'occurredAt',clock_timestamp(),
          'requestId','salary-generator'));
    end if;
    sequence_no:=sequence_no+1;
    if sequence_no>600 then raise exception using errcode='22023',message='PLANNING_HORIZON_INVALID'; end if;
  end loop;
  return query select inserted_total,considered-inserted_total;
end $function$
;

alter function private.initialize_salary_detection() owner to masarifi_migration;
alter function private.salary_income_is_clear(text,text,text) owner to masarifi_migration;
alter function private.salary_detection_candidates(text,uuid) owner to masarifi_migration;
alter function private.detect_salary_receipts(text,uuid,integer) owner to masarifi_migration;
alter function private.queue_salary_detection() owner to masarifi_migration;
alter function private.run_salary_detection_jobs(integer) owner to masarifi_migration;
revoke all on function private.initialize_salary_detection(),private.salary_income_is_clear(text,text,text),
  private.salary_detection_candidates(text,uuid),private.detect_salary_receipts(text,uuid,integer),
  private.queue_salary_detection(),private.run_salary_detection_jobs(integer)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.detect_salary_receipts(text,uuid,integer),private.run_salary_detection_jobs(integer) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
