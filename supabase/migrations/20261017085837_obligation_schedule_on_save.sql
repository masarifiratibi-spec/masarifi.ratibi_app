set local role masarifi_migration;

create or replace function private.save_obligation(p_user_id text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  operation text:=p_body->>'operation';request_id text:=p_body->>'requestId';patch jsonb;
  obligation public.obligations;next_status text;event_type text;account public.accounts;
begin
  perform private.assert_active_profile(p_user_id);
  if p_body is null or jsonb_typeof(p_body)<>'object' or pg_column_size(p_body)>16384
    or operation not in ('create','update','archive') or request_id !~ '^[A-Za-z0-9._:-]{1,128}$' then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if operation='create' then
    if exists(select 1 from jsonb_object_keys(p_body) key where key not in (
      'operation','obligationId','operationId','requestId','name','direction','type','scheduleKind','currencyCode',
      'principalMinor','openingPaidMinor','installmentAmountMinor','installmentCount','frequency','expectedDay',
      'customIntervalDays','startDate','endDate','defaultAccountId','automaticMatchingEnabled','provider',
      'providerKeywords','reminderTiming','notes'
    )) or not exists(select 1 from public.currencies c where c.code=(p_body->>'currencyCode')::char(3) and c.enabled) then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    end if;
    if p_body->>'defaultAccountId' is not null then
      select * into account from public.accounts a where a.id=(p_body->>'defaultAccountId')::uuid
        and a.user_id=p_user_id and a.status='active' and a.currency_code=(p_body->>'currencyCode')::char(3);
      if account.id is null then raise exception using errcode='P0001',message='OBLIGATION_ACCOUNT_INVALID'; end if;
    end if;
    if (p_body->>'scheduleKind')='fixed_term' and
      ((p_body->>'installmentCount')::bigint-1)*(p_body->>'installmentAmountMinor')::bigint
        >=(p_body->>'principalMinor')::bigint-(p_body->>'openingPaidMinor')::bigint then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    elsif (p_body->>'scheduleKind')='open_ended' and (p_body->>'installmentAmountMinor') is null then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    end if;
    insert into public.obligations(
      id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,opening_paid_minor,
      installment_amount_minor,installment_count,frequency,expected_day,custom_interval_days,start_date,end_date,
      default_account_id,automatic_matching_enabled,provider,provider_keywords,reminder_timing,notes
    ) values(
      (p_body->>'obligationId')::uuid,p_user_id,p_body->>'name',p_body->>'direction',p_body->>'type',p_body->>'scheduleKind',
      (p_body->>'currencyCode')::char(3),(p_body->>'principalMinor')::bigint,(p_body->>'openingPaidMinor')::bigint,
      (p_body->>'installmentAmountMinor')::bigint,(p_body->>'installmentCount')::integer,p_body->>'frequency',
      (p_body->>'expectedDay')::smallint,(p_body->>'customIntervalDays')::smallint,(p_body->>'startDate')::date,
      (p_body->>'endDate')::date,(p_body->>'defaultAccountId')::uuid,(p_body->>'automaticMatchingEnabled')::boolean,
      p_body->>'provider',array(select value from jsonb_array_elements_text(p_body->'providerKeywords') value),
      p_body->>'reminderTiming',p_body->>'notes'
    ) returning * into obligation;
    event_type='planning.obligation_created';
  else
    if exists(select 1 from jsonb_object_keys(p_body) key where key not in (
      'operation','obligationId','expectedVersion','patch','operationId','requestId'
    )) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
    select * into obligation from public.obligations o
    where o.id=(p_body->>'obligationId')::uuid and o.user_id=p_user_id for update;
    if obligation.id is null then raise exception using errcode='P0001',message='OBLIGATION_NOT_FOUND'; end if;
    if obligation.version<>(p_body->>'expectedVersion')::bigint then
      raise exception using errcode='P0001',message='VERSION_CONFLICT',detail=obligation.version::text;
    end if;
    if obligation.status='archived' then raise exception using errcode='P0001',message='OBLIGATION_INELIGIBLE'; end if;
    if operation='archive' then
      update public.obligations o set status='archived',deleted_at=clock_timestamp()
      where o.id=obligation.id returning * into obligation;
      event_type='planning.obligation_archived';
    else
      patch=p_body->'patch';
      if patch is null or jsonb_typeof(patch)<>'object' or patch='{}'::jsonb
        or exists(select 1 from jsonb_object_keys(patch) key where key not in (
          'name','direction','type','scheduleKind','principalMinor','openingPaidMinor','installmentAmountMinor',
          'installmentCount','frequency','expectedDay','customIntervalDays','startDate','endDate','defaultAccountId',
          'automaticMatchingEnabled','provider','providerKeywords','reminderTiming','notes','status'
        )) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
      if exists(select 1 from public.obligation_schedule_items i where i.obligation_id=obligation.id)
        and exists (
          select 1 from jsonb_each(patch) changed
          where changed.key in ('scheduleKind','principalMinor','openingPaidMinor','installmentAmountMinor','installmentCount',
            'frequency','expectedDay','customIntervalDays','startDate','endDate')
          and changed.value is distinct from (jsonb_build_object(
            'scheduleKind',obligation.schedule_kind,'principalMinor',obligation.principal_minor::text,
            'openingPaidMinor',obligation.opening_paid_minor::text,'installmentAmountMinor',obligation.installment_amount_minor::text,
            'installmentCount',obligation.installment_count,'frequency',obligation.frequency,'expectedDay',obligation.expected_day,
            'customIntervalDays',obligation.custom_interval_days,'startDate',obligation.start_date,'endDate',obligation.end_date
          )->changed.key)
        ) then
        raise exception using errcode='P0001',message='OBLIGATION_SCHEDULE_LOCKED';
      end if;
      if patch?'defaultAccountId' and patch->>'defaultAccountId' is not null then
        select * into account from public.accounts a where a.id=(patch->>'defaultAccountId')::uuid
          and a.user_id=p_user_id and a.status='active' and a.currency_code=obligation.currency_code;
        if account.id is null then raise exception using errcode='P0001',message='OBLIGATION_ACCOUNT_INVALID'; end if;
      end if;
      next_status=coalesce(patch->>'status',obligation.status);
      if not(next_status=obligation.status or next_status='archived'
        or (obligation.status='active' and next_status in ('paused','completed','closed'))
        or (obligation.status='paused' and next_status in ('active','completed','closed')))
      then raise exception using errcode='P0001',message='OBLIGATION_TRANSITION_INVALID'; end if;
      update public.obligations o set
        name=case when patch?'name' then patch->>'name' else o.name end,
        direction=case when patch?'direction' then patch->>'direction' else o.direction end,
        type=case when patch?'type' then patch->>'type' else o.type end,
        schedule_kind=case when patch?'scheduleKind' then patch->>'scheduleKind' else o.schedule_kind end,
        principal_minor=case when patch?'principalMinor' then (patch->>'principalMinor')::bigint else o.principal_minor end,
        opening_paid_minor=case when patch?'openingPaidMinor' then (patch->>'openingPaidMinor')::bigint else o.opening_paid_minor end,
        installment_amount_minor=case when patch?'installmentAmountMinor' then (patch->>'installmentAmountMinor')::bigint else o.installment_amount_minor end,
        installment_count=case when patch?'installmentCount' then (patch->>'installmentCount')::integer else o.installment_count end,
        frequency=case when patch?'frequency' then patch->>'frequency' else o.frequency end,
        expected_day=case when patch?'expectedDay' then (patch->>'expectedDay')::smallint else o.expected_day end,
        custom_interval_days=case when patch?'customIntervalDays' then (patch->>'customIntervalDays')::smallint else o.custom_interval_days end,
        start_date=case when patch?'startDate' then (patch->>'startDate')::date else o.start_date end,
        end_date=case when patch?'endDate' then (patch->>'endDate')::date else o.end_date end,
        default_account_id=case when patch?'defaultAccountId' then (patch->>'defaultAccountId')::uuid else o.default_account_id end,
        automatic_matching_enabled=case when patch?'automaticMatchingEnabled' then (patch->>'automaticMatchingEnabled')::boolean else o.automatic_matching_enabled end,
        provider=case when patch?'provider' then patch->>'provider' else o.provider end,
        provider_keywords=case when patch?'providerKeywords' then array(select value from jsonb_array_elements_text(patch->'providerKeywords') value) else o.provider_keywords end,
        reminder_timing=case when patch?'reminderTiming' then patch->>'reminderTiming' else o.reminder_timing end,
        notes=case when patch?'notes' then patch->>'notes' else o.notes end,
        status=next_status,deleted_at=case when next_status='archived' then clock_timestamp() else null end
      where o.id=obligation.id returning * into obligation;
      event_type=case when obligation.status='archived' then 'planning.obligation_archived'
        when obligation.status='completed' then 'planning.obligation_completed' else 'planning.obligation_updated' end;
    end if;
  end if;
  -- Initial installments must commit with the obligation; workers extend the rolling horizon.
  if operation='create' then
    perform private.generate_obligation_schedule(p_user_id,obligation.id,
      (current_date+case when obligation.schedule_kind='fixed_term' then interval '18 months' else interval '3 months' end)::date);
  end if;
  perform private.enqueue_outbox_event(event_type,'obligation',obligation.id,jsonb_build_object(
    'obligationId',obligation.id,'userId',p_user_id,'aggregateVersion',obligation.version,
    'status',obligation.status,'ledgerVersion',coalesce((select max(ab.ledger_version) from public.account_balances ab
      join public.accounts a on a.id=ab.account_id where a.user_id=p_user_id),0),'requestId',request_id));
  perform audit.append_event(p_user_id,'user',replace(event_type,'_','-'),'obligation',obligation.id::text,
    null,null,null,request_id,jsonb_build_object('version',obligation.version,'status',obligation.status));
  return jsonb_build_object('id',obligation.id,'name',obligation.name,'direction',obligation.direction,'type',obligation.type,
    'scheduleKind',obligation.schedule_kind,'currencyCode',obligation.currency_code,'principalMinor',obligation.principal_minor::text,
    'openingPaidMinor',obligation.opening_paid_minor::text,'installmentAmountMinor',obligation.installment_amount_minor::text,
    'installmentCount',obligation.installment_count,'frequency',obligation.frequency,'expectedDay',obligation.expected_day,
    'customIntervalDays',obligation.custom_interval_days,'startDate',obligation.start_date,'endDate',obligation.end_date,
    'status',obligation.status,'defaultAccountId',obligation.default_account_id,
    'automaticMatchingEnabled',obligation.automatic_matching_enabled,'provider',obligation.provider,
    'providerKeywords',obligation.provider_keywords,'reminderTiming',obligation.reminder_timing,'notes',obligation.notes,
    'deletedAt',obligation.deleted_at,'createdAt',obligation.created_at,'updatedAt',obligation.updated_at,'version',obligation.version);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or unique_violation then
  raise exception using errcode='22023',message='VALIDATION_FAILED';
end $$;
