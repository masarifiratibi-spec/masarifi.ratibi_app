grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

alter table public.tracking_account_bindings drop constraint tracking_account_bindings_role_check;
alter table public.tracking_account_bindings add constraint tracking_account_bindings_role_check
  check(role in ('card','account','cash_card','cash_account'));

-- External transfers have a single owned effect, as explicitly requested.
-- An identified second owned endpoint must never be booked as income/expense.
create function private.tracking_external_transfer_account(p_item_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.import_items i where i.id=p_item_id
    and ((i.normalized_payload#>>'{classification,subtype}'='transfer_sent'
      and i.normalized_payload#>>'{classification,direction}'='outgoing' and i.normalized_payload->>'kind'='expense')
      or(i.normalized_payload#>>'{classification,subtype}'='transfer_received'
      and i.normalized_payload#>>'{classification,direction}'='incoming' and i.normalized_payload->>'kind'='income'))
    and not (i.normalized_payload ? 'destinationAccountId')
    and exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h
      where h->>'side'=case when i.normalized_payload#>>'{classification,direction}'='incoming' then 'destination' else 'source' end
        or (h->>'side' is null and jsonb_array_length(i.normalized_payload#>'{classification,instruments}')=1))
    and not exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h
      join public.accounts a on a.user_id=i.user_id and a.status='active' and a.currency_code=i.currency_code
      where h->>'side'=case when i.normalized_payload#>>'{classification,direction}'='incoming' then 'source' else 'destination' end
        and ((length(h->>'suffix')=4 and a.last_four=h->>'suffix')
          or exists(select 1 from public.tracking_account_bindings b where b.user_id=i.user_id and b.enabled
            and b.provider=private.tracking_capture_source_state(i.id)->>'provider'
            and b.role=h->>'role' and b.suffix=h->>'suffix' and b.account_id=a.id))));
$$;

-- Cash is a destination only after a user explicitly remembered a reviewed
-- withdrawal. Currency or a default cash account alone is never sufficient.
create function private.tracking_cash_destination(p_item_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select a.id from public.import_items i join public.accounts a
    on a.user_id=i.user_id and a.id::text=i.normalized_payload->>'destinationAccountId'
      and a.type='cash' and a.status='active' and a.automatic_tracking_enabled and a.currency_code=i.currency_code
  where i.id=p_item_id and i.normalized_payload#>>'{classification,subtype}'='withdrawal'
    and i.normalized_payload#>>'{classification,direction}'='outgoing' and i.normalized_payload->>'kind'='transfer'
    and a.id::text<>i.normalized_payload->>'accountId'
    and jsonb_array_length(i.normalized_payload#>'{classification,instruments}')>0
    and not exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h
      where not exists(select 1 from public.tracking_account_bindings b where b.user_id=i.user_id and b.enabled
        and b.provider=coalesce(private.tracking_verified_correspondence(i.id)->>'provider',private.tracking_capture_source_state(i.id)->>'provider')
        and b.role='cash_'||(h->>'role') and b.suffix=h->>'suffix' and b.account_id=a.id));
$$;

create function private.remember_tracking_cash_binding(p_user_id text,p_item_id uuid,p_transaction_id uuid,p_patch jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare i public.import_items; source_state jsonb; bank uuid; cash uuid;
begin
  if p_patch->'rememberAccountBinding' is distinct from 'true'::jsonb then return; end if;
  select * into i from public.import_items where id=p_item_id and user_id=p_user_id;
  if i.normalized_payload#>>'{classification,subtype}'<>'withdrawal' then return; end if;
  source_state:=private.tracking_capture_source_state(i.id);
  if not (source_state->>'trusted')::boolean or (source_state->>'blocked')::boolean then return; end if;
  select p.account_id into bank from public.transaction_postings p join public.transactions t on t.id=p.transaction_id
    where t.id=p_transaction_id and t.user_id=i.user_id and t.kind='transfer' and t.status='confirmed' and p.posting_role='source';
  select p.account_id into cash from public.transaction_postings p join public.accounts a on a.id=p.account_id and a.user_id=i.user_id
    where p.transaction_id=p_transaction_id and p.posting_role='destination' and a.type='cash' and a.status='active';
  if bank is null or cash is null then return; end if;
  insert into public.tracking_account_bindings(user_id,provider,role,suffix,account_id)
    select distinct i.user_id,source_state->>'provider',binding.role,h->>'suffix',binding.account_id
    from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h
    cross join lateral (values (h->>'role',bank),('cash_'||(h->>'role'),cash)) binding(role,account_id)
    where h->>'side' is null or h->>'side'='source'
    on conflict(user_id,provider,role,suffix) do update set account_id=excluded.account_id,enabled=true,version=public.tracking_account_bindings.version+1;
  return;
end $$;

-- Extend only the proven movement branches. Source trust, lifecycle, opt-in,
-- configuration revision, account evidence and amount checks remain intact.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.decide_review_item(text,uuid,text,jsonb,uuid,uuid,uuid)'::regprocedure);
  if position('update public.review_items set status=' in definition)=0
    or position('where coalesce(p_patch->>''kind'',r.proposed_values->>''kind'')<>''transfer'' or hint->>''side'' in (''source'',''destination'')' in definition)=0
    or position('on conflict(user_id,provider,role,suffix) do update' in definition)=0
    then raise exception 'TRACKING_REVIEWED_CASH_MIGRATION_PRECONDITION'; end if;
  updated:=replace(definition,'update public.review_items set status=',
    'if p_decision<>''reject'' then perform private.remember_tracking_cash_binding(p_user_id,i.id,p_transaction_id,p_patch); end if; update public.review_items set status=');
  updated:=replace(updated,'where coalesce(p_patch->>''kind'',r.proposed_values->>''kind'')<>''transfer'' or hint->>''side'' in (''source'',''destination'')',
    'where (coalesce(p_patch->>''kind'',r.proposed_values->>''kind'')<>''transfer'' or hint->>''side'' in (''source'',''destination''))');
  updated:=replace(updated,'on conflict(user_id,provider,role,suffix) do update',
    'and (i.normalized_payload#>>''{classification,subtype}'' not in (''transfer_sent'',''transfer_received'') or coalesce(p_patch->>''kind'',r.proposed_values->>''kind'')=''transfer'' or hint->>''side''=case when i.normalized_payload#>>''{classification,direction}''=''incoming'' then ''destination'' else ''source'' end or (hint->>''side'' is null and jsonb_array_length(i.normalized_payload#>''{classification,instruments}'')=1)) on conflict(user_id,provider,role,suffix) do update');
  if updated=definition then raise exception 'TRACKING_REVIEWED_CASH_MIGRATION_PRECONDITION'; end if;
  execute updated;
  definition:=pg_get_functiondef('private.tracking_capture_exception(uuid)'::regprocedure);
  if position('original_proof jsonb;' in definition)=0
    or position('if subtype in (''transfer_sent'',''transfer_received'') then' in definition)=0
    or position('expected_account:=affected;' in definition)=0
    or position('where value not in (''source_untrusted'')' in definition)=0
    or position('and original_proof is null then return ''invalid_input'';' in definition)=0
    or position('if not((original_proof is not null' in definition)=0
    then raise exception 'TRACKING_MOVEMENT_MIGRATION_PRECONDITION'; end if;
  updated:=replace(definition,'original_proof jsonb;', 'original_proof jsonb; cash_destination uuid; external_transfer boolean;');
  updated:=replace(updated,'if subtype in (''transfer_sent'',''transfer_received'') then',
    'cash_destination:=private.tracking_cash_destination(i.id); external_transfer:=private.tracking_external_transfer_account(i.id); if subtype=''withdrawal'' and cash_destination is null then return ''cash_destination_required''; end if; if subtype in (''transfer_sent'',''transfer_received'') and not external_transfer then');
  updated:=replace(updated,'expected_account:=affected;',
    'if external_transfer and hint->>''side''=case when i.normalized_payload#>>''{classification,direction}''=''incoming'' then ''source'' else ''destination'' end then continue; end if; expected_account:=affected;');
  updated:=replace(updated,'where value not in (''source_untrusted'')',
    'where value not in (''source_untrusted'') and not(value=''cash_destination_required'' and cash_destination is not null) and not(value=''transfer_counterparty_required'' and external_transfer)');
  updated:=replace(updated,'and original_proof is null then return ''invalid_input'';',
    'and original_proof is null and cash_destination is null and not external_transfer then return ''invalid_input'';');
  updated:=replace(updated,'if not((original_proof is not null',
    'if not(external_transfer or cash_destination is not null or (original_proof is not null');
  if updated=definition or position('external_transfer boolean;' in updated)=0 or position('if not(external_transfer or cash_destination' in updated)=0
    then raise exception 'TRACKING_MOVEMENT_MIGRATION_PRECONDITION'; end if;
  execute updated;
  definition:=pg_get_functiondef('private.finalize_import_session(uuid,uuid)'::regprocedure);
  updated:=replace(definition,'if i.normalized_payload ? ''destinationAccountId'' then',
    'if i.normalized_payload ? ''destinationAccountId'' and private.tracking_cash_destination(i.id) is null then');
  if updated=definition then raise exception 'TRACKING_CASH_MIGRATION_PRECONDITION'; end if;
  execute updated;
end $migration$;

revoke all on function private.tracking_external_transfer_account(uuid),private.tracking_cash_destination(uuid),private.remember_tracking_cash_binding(text,uuid,uuid,jsonb) from public;
reset role;
revoke masarifi_migration from current_user granted by current_user;
