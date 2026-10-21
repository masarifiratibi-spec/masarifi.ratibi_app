grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Preserve the deployed multiline-note and refund-floor guards.
do $migration$
declare definition text; changed text; old_fragment text; new_fragment text;
begin
  definition := pg_get_functiondef('private.revise_transaction(text,uuid,bigint,jsonb,text)'::regprocedure);
  changed := definition;
  for old_fragment,new_fragment in select * from (values
    ('new_account_id uuid; new_amount bigint;', 'new_kind text; new_account_id uuid; new_amount bigint;'),
    ('''amountMinor'',''accountId'',''categoryId'',''title'',''merchant'',''paymentMethod'',''note'',''occurredAt''',
     '''kind'',''amountMinor'',''accountId'',''categoryId'',''title'',''merchant'',''paymentMethod'',''note'',''occurredAt'''),
    ('  select p.account_id,sum(p.amount_minor)::bigint into old_account_id,old_effect',
     $guard$  new_kind := case when p_patch?'kind' then p_patch->>'kind' else transaction_row.kind end;
  if new_kind is null or new_kind not in ('income','expense') then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if new_kind<>transaction_row.kind and (transaction_row.source<>'manual' or exists(
    select 1 from public.transactions linked where linked.reverses_transaction_id=p_transaction_id
      and linked.user_id=p_user_id and linked.status in ('confirmed','reversed')
  )) then raise exception using errcode='P0001',message='TRANSACTION_INELIGIBLE'; end if;
  select p.account_id,sum(p.amount_minor)::bigint into old_account_id,old_effect$guard$),
    ('else transaction_row.category_id end;',
     'else case when new_kind<>transaction_row.kind then null else transaction_row.category_id end end;'),
    ('private.resolve_category(p_user_id,new_category_id,transaction_row.kind)',
     'private.resolve_category(p_user_id,new_category_id,new_kind)'),
    ('new_effect:=case when transaction_row.kind=''income'' then new_amount else -new_amount end;',
     'new_effect:=case when new_kind=''income'' then new_amount else -new_amount end;'),
    ('  if new_account_id=old_account_id then',
     '  if new_account_id=old_account_id and new_kind=transaction_row.kind then'),
    ('  update public.transactions set amount_minor=new_amount,category_id=new_category_id,title=new_title,',
     $header$  perform pg_catalog.set_config('masarifi.transaction_kind_revision',p_transaction_id::text,true);
  update public.transactions set kind=new_kind,amount_minor=new_amount,category_id=new_category_id,title=new_title,$header$),
    ('  perform private.ledger_record_revision(p_transaction_id,p_user_id,p_reason,before_snapshot);',
     $audit$  perform pg_catalog.set_config('masarifi.transaction_kind_revision','',true);
  perform private.ledger_record_revision(p_transaction_id,p_user_id,p_reason,before_snapshot);$audit$)
  ) replacements(old_fragment,new_fragment) loop
    if position(old_fragment in changed)=0 then raise exception 'KIND_REVISION_PRECONDITION'; end if;
    changed := replace(changed,old_fragment,new_fragment);
  end loop;
  execute changed;

  definition := pg_get_functiondef('private.guard_transaction_update()'::regprocedure);
  old_fragment := 'or new.kind is distinct from old.kind';
  if position(old_fragment in definition)=0 then raise exception 'KIND_GUARD_PRECONDITION'; end if;
  execute replace(definition,old_fragment,$kind$or (new.kind is distinct from old.kind and not (
      old.source='manual' and old.kind in ('income','expense') and new.kind in ('income','expense')
      and old.status='confirmed' and new.status='confirmed'
      and coalesce(current_setting('masarifi.transaction_kind_revision',true),'')=old.id::text
    ))$kind$);
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
