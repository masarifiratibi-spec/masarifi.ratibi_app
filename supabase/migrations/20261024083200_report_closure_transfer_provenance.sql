grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Retain the fee conversion guard while restoring the later ledger contracts.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.transfer_funds(text,jsonb)'::regprocedure);
  if position('fee_value bigint;' in definition)=0
    or position('fee_value:=coalesce((p_command->>''feeMinor'')::bigint,0);' in definition)=0 then
    raise exception 'TRANSFER_FEE_VALIDATION_PRECONDITION';
  end if;
  updated:=replace(definition,'note_value text:=p_command->>''note'';',
    'note_value text:=private.normalize_ledger_note(p_command->>''note''); source_value text:=coalesce(p_command->>''source'',''manual''); external_value text:=p_command->>''externalRef'';');
  updated:=replace(updated,'private.ledger_safe_text(note_value,1,500)','private.ledger_safe_note(note_value)');
  updated:=replace(updated,'''occurredAt'',''title'',''note'']::text[]','''occurredAt'',''title'',''note'',''source'',''externalRef'']::text[]');
  updated:=replace(updated,'if source_id=destination_id or amount_value',
    'if not private.ledger_safe_text(source_value,1,64) or (external_value is not null and not private.ledger_safe_text(external_value,1,200)) or source_id=destination_id or amount_value');
  updated:=replace(updated,'insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,note,occurred_at)',
    'insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,note,occurred_at,source,external_ref)');
  updated:=replace(updated,'title_value,note_value,occurred_value)', 'title_value,note_value,occurred_value,source_value,external_value)');
  if updated=definition or position('external_value text' in updated)=0
    or position('''source'',''externalRef'']::text[]' in updated)=0
    or position('occurred_at,source,external_ref)' in updated)=0
    or position('private.ledger_safe_text(note_value,1,500)' in updated)>0 then
    raise exception 'TRANSFER_PROVENANCE_PRECONDITION';
  end if;
  execute updated;
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
