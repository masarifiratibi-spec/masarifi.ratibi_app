-- Optional notes alone permit LF. Keep title/reason validators and ledger logic intact.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create function private.normalize_ledger_note(p_value text) returns text
language sql immutable security invoker set search_path='' as $$
  select nullif(btrim(replace(replace(p_value,chr(13)||chr(10),chr(10)),chr(13),chr(10)), U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), '')
$$;
revoke all on function private.normalize_ledger_note(text) from public;

create function private.ledger_safe_note(p_value text) returns boolean
language sql immutable security invoker set search_path='' as $$
  select p_value is null or (
    p_value=private.normalize_ledger_note(p_value) and char_length(p_value) between 1 and 500
    and replace(p_value,chr(10),'') !~ '[[:cntrl:]]'
    and p_value !~ U&'[\202A-\202E\2066-\2069]'
  )
$$;
revoke all on function private.ledger_safe_note(text) from public;

-- Replace only the three existing note assignments/guards. pg_get_functiondef
-- preserves SECURITY DEFINER, search paths, signatures, owners and existing ACLs.
do $migration$
declare signature text; definition text; updated text;
begin
  foreach signature in array array[
    'private.post_transaction(text,jsonb)',
    'private.transfer_funds(text,jsonb)',
    'private.revise_transaction(text,uuid,bigint,jsonb,text)'
  ] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if signature like 'private.revise%' then
      updated:=replace(definition,
        'new_note:=case when p_patch?''note'' then p_patch->>''note'' else transaction_row.note end;',
        'new_note:=case when p_patch?''note'' then private.normalize_ledger_note(p_patch->>''note'') else transaction_row.note end;');
      updated:=replace(updated,'private.ledger_safe_text(new_note,1,500)','private.ledger_safe_note(new_note)');
      updated:=replace(updated,'(new_note is not null and not private.ledger_safe_note(new_note))', '(p_patch?''note'' and new_note is not null and not private.ledger_safe_note(new_note))');
    else
      updated:=replace(definition,'note_value text:=p_command->>''note'';',
        'note_value text:=private.normalize_ledger_note(p_command->>''note'');');
      updated:=replace(updated,'private.ledger_safe_text(note_value,1,500)','private.ledger_safe_note(note_value)');
    end if;
    if updated=definition or updated like '%private.ledger_safe_text(note_value,1,500)%'
      or updated like '%private.ledger_safe_text(new_note,1,500)%' then
      raise exception 'LEDGER_NOTE_MIGRATION_PRECONDITION';
    end if;
    execute updated;
  end loop;
end $migration$;

alter table public.transactions drop constraint transactions_note_check;
-- Preserve the old accepted rows during unrelated updates. Only new/changed
-- notes must satisfy the stronger contract; historical notes are never rewritten.
alter table public.transactions add constraint transactions_note_check check (
  note is null or (char_length(note) between 1 and 500 and replace(note,chr(10),'') !~ '[[:cntrl:]]')
);
create function private.enforce_changed_ledger_note() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='INSERT' or new.note is distinct from old.note then
    if not private.ledger_safe_note(new.note) then
      raise exception 'LEDGER_NOTE_INVALID' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.enforce_changed_ledger_note() from public;
create trigger transactions_changed_note_check before insert or update of note
on public.transactions for each row execute function private.enforce_changed_ledger_note();

reset role;
revoke masarifi_migration from current_user granted by current_user;
