grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- A neutral digest is a correlation key, never a source-authentication claim.
-- An unknown observation may only reuse an existing, independently verified
-- financial effect. It cannot authorize a new transaction or create trust.
create function private.tracking_capture_effect_key(p_payload jsonb) returns text
language sql immutable set search_path='' as $$
  select case when p_payload->>'kind'='transfer' and p_payload ? 'destinationAccountId' then
    concat_ws('|','internal',case when p_payload#>>'{classification,direction}'='incoming' then p_payload->>'destinationAccountId' else p_payload->>'accountId' end,
      case when p_payload#>>'{classification,direction}'='incoming' then p_payload->>'accountId' else p_payload->>'destinationAccountId' end)
    else p_payload#>>'{classification,direction}' end;
$$;

create function private.tracking_verified_correspondence(p_item_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with current_capture as (select * from public.import_items where id=p_item_id),
  matches as (
    select x.id,x.transaction_id,x.canonical_identity_hash,x.operation_id,
      private.tracking_capture_source_state(x.id)->>'provider' provider
    from current_capture i join public.import_items x on x.user_id=i.user_id and x.id<>i.id
    join public.transactions t on t.id=x.transaction_id and t.user_id=i.user_id
    where i.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
      and x.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
      and i.normalized_payload->>'providerReferenceDigest'=x.normalized_payload->>'providerReferenceDigest'
      and i.normalized_payload#>>'{transport,deviceId}'=x.normalized_payload#>>'{transport,deviceId}'
      and i.normalized_payload#>>'{transport,channel}'<>x.normalized_payload#>>'{transport,channel}'
      and x.status='accepted' and t.status='confirmed' and t.deleted_at is null and x.canonical_identity_hash is not null
      and (private.tracking_capture_source_state(x.id)->>'trusted')::boolean
      and x.normalized_payload#>>'{classification,status}'='completed'
      and private.tracking_capture_effect_key(i.normalized_payload)=private.tracking_capture_effect_key(x.normalized_payload)
      and private.tracking_effect_family(i.normalized_payload)=private.tracking_effect_family(x.normalized_payload)
      and abs(i.amount_minor)=abs(x.amount_minor) and i.currency_code=x.currency_code
      and t.amount_minor=abs(i.amount_minor) and t.currency_code=i.currency_code
      and t.kind=case when i.normalized_payload->>'kind'='fee' then 'expense' when i.normalized_payload#>>'{classification,subtype}'='reversal' then 'reversal' else i.normalized_payload->>'kind' end
      and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id and p.account_id::text=i.normalized_payload->>'accountId'
        and p.amount_minor=case when i.normalized_payload#>>'{classification,direction}'='incoming' then abs(i.amount_minor) else -abs(i.amount_minor) end)
      and (t.kind<>'transfer' or exists(select 1 from public.transaction_postings p where p.transaction_id=t.id
        and p.account_id::text=i.normalized_payload->>'destinationAccountId'
        and p.amount_minor=case when i.normalized_payload#>>'{classification,direction}'='incoming' then -abs(i.amount_minor) else abs(i.amount_minor) end))
      and abs(extract(epoch from(coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz)-coalesce(x.occurred_at,(x.normalized_payload->>'receivedAt')::timestamptz))))<=120
  )
  select case when (select count(distinct transaction_id) from matches)=1 then
    (select jsonb_build_object('itemId',id,'transactionId',transaction_id,'identityHash',canonical_identity_hash,'operationId',operation_id,'provider',provider)
      from matches order by id limit 1) else null end;
$$;

-- Preserve the existing ledger implementation and its multiline-note change.
-- Add only normal provenance fields, with the same text bounds as expenses.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.transfer_funds(text,jsonb)'::regprocedure);
  updated:=replace(definition,
    'note_value text:=private.normalize_ledger_note(p_command->>''note'');',
    'note_value text:=private.normalize_ledger_note(p_command->>''note''); source_value text:=coalesce(p_command->>''source'',''manual''); external_value text:=p_command->>''externalRef'';');
  updated:=replace(updated,'''occurredAt'',''title'',''note'']::text[]','''occurredAt'',''title'',''note'',''source'',''externalRef'']::text[]');
  updated:=replace(updated,'if source_id=destination_id or amount_value',
    'if not private.ledger_safe_text(source_value,1,64) or (external_value is not null and not private.ledger_safe_text(external_value,1,200)) or source_id=destination_id or amount_value');
  updated:=replace(updated,'insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,note,occurred_at)',
    'insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,note,occurred_at,source,external_ref)');
  updated:=replace(updated,'title_value,note_value,occurred_value)', 'title_value,note_value,occurred_value,source_value,external_value)');
  if updated=definition or position('external_value text' in updated)=0 or position('''source'',''externalRef'']::text[]' in updated)=0
    or position('occurred_at,source,external_ref)' in updated)=0 then raise exception 'TRACKING_TRANSFER_MIGRATION_PRECONDITION'; end if;
  execute updated;
end $migration$;

create or replace function private.reserve_tracking_capture(p_item_id uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions; r private.tracking_capture_reservations; source_state jsonb; proof text; hash text; legacy_hash text; corroboration jsonb;
begin
  select x.* into i from public.import_items x join public.import_sessions y on y.id=x.session_id
  where x.id=p_item_id and x.status='parsed' and y.claim_token=p_fence and y.lease_until>clock_timestamp() for update of x;
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  select * into s from public.import_sessions where id=i.session_id;
  source_state:=private.tracking_capture_source_state(i.id);
  if not (source_state->>'trusted')::boolean and not (source_state->>'blocked')::boolean then
    corroboration:=private.tracking_verified_correspondence(i.id);
    if corroboration is not null then
      update public.import_items set canonical_identity_hash=corroboration->>'identityHash' where id=i.id;
      return jsonb_build_object('identityHash',corroboration->>'identityHash','primaryItemId',corroboration->>'itemId',
        'transactionId',corroboration->>'transactionId','operationId',corroboration->>'operationId','conflict',false);
    end if;
  end if;
  proof:=case when (source_state->>'trusted')::boolean and i.normalized_payload ? 'providerReferenceDigest' then
    concat_ws('|','reference-verified',source_state->>'provider',i.normalized_payload->>'providerReferenceDigest',
      private.tracking_capture_effect_key(i.normalized_payload),private.tracking_effect_family(i.normalized_payload))
    when i.normalized_payload ? 'transport' then concat_ws('|',case when (source_state->>'trusted')::boolean then 'transport' else 'unverified-transport' end,
      i.normalized_payload#>>'{transport,deviceId}',i.normalized_payload#>>'{transport,channel}',i.normalized_payload#>>'{transport,nativeIdDigest}')
    else s.source_type||chr(10)||i.source_item_key end;
  hash:=encode(extensions.digest(convert_to(proof,'UTF8'),'sha256'),'hex');
  -- Preserve earlier verified identities/review settlement links on upgrade.
  -- An unverified old primary must never be reused as verified authority.
  if (source_state->>'trusted')::boolean and i.normalized_payload ? 'providerReferenceDigest' then
    select x.canonical_identity_hash into legacy_hash from public.import_items x
      join private.tracking_capture_reservations old on old.user_id=x.user_id and old.identity_hash=x.canonical_identity_hash
      where x.user_id=i.user_id and x.id<>i.id and x.canonical_identity_hash is not null
      and x.normalized_payload->>'providerReferenceDigest'=i.normalized_payload->>'providerReferenceDigest'
      and private.tracking_capture_effect_key(x.normalized_payload)=private.tracking_capture_effect_key(i.normalized_payload)
      and private.tracking_effect_family(x.normalized_payload)=private.tracking_effect_family(i.normalized_payload)
      and (private.tracking_capture_source_state(x.id)->>'trusted')::boolean
      and private.tracking_capture_source_state(x.id)->>'provider'=source_state->>'provider'
      and (private.tracking_capture_source_state(old.primary_item_id)->>'trusted')::boolean
      order by x.created_at,x.id limit 1;
    hash:=coalesce(legacy_hash,hash);
  end if;
  insert into private.tracking_capture_reservations(user_id,identity_hash,primary_item_id) values(i.user_id,hash,i.id) on conflict do nothing;
  select * into r from private.tracking_capture_reservations where user_id=i.user_id and identity_hash=hash for update;
  update public.import_items set canonical_identity_hash=hash where id=i.id;
  return jsonb_build_object('identityHash',hash,'primaryItemId',r.primary_item_id,
    'operationId',(select operation_id from public.import_items where id=r.primary_item_id),
    'conflict',exists(select 1 from public.import_items x where x.id=r.primary_item_id and
      (abs(x.amount_minor) is distinct from abs(i.amount_minor) or x.currency_code is distinct from i.currency_code or
        (x.normalized_payload->>'accountId' is not null and i.normalized_payload->>'accountId' is not null and case when i.normalized_payload->>'kind'='transfer' then private.tracking_capture_effect_key(x.normalized_payload) is distinct from private.tracking_capture_effect_key(i.normalized_payload)
          else x.normalized_payload->>'accountId' is distinct from i.normalized_payload->>'accountId' end))),
    'transactionId',coalesce(r.transaction_id,(select transaction_id from public.import_items where id=r.primary_item_id)));
end $$;

create or replace function private.tracking_capture_exception(p_item_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; state jsonb; hint jsonb; ids uuid[]; affected uuid; reason text; subtype text; counterpart uuid; expected_account uuid; corroboration jsonb;
begin
  select * into i from public.import_items where id=p_item_id;
  if coalesce(i.normalized_payload#>>'{classification,status}','unknown')<>'completed' then return 'lifecycle_not_completed'; end if;
  state:=private.tracking_capture_source_state(i.id);
  if (state->>'blocked')::boolean then return 'source_blocked'; end if;
  if not (state->>'trusted')::boolean then
    corroboration:=private.tracking_verified_correspondence(i.id);
    if corroboration is null then return 'source_proof_required'; end if;
    state:=state||jsonb_build_object('provider',corroboration->>'provider');
  end if;
  if not coalesce((select enabled from public.tracking_preferences where user_id=i.user_id),false) then return 'paused'; end if;
  if i.normalized_payload#>>'{metadata,ruleConfigurationRevision}' is distinct from private.tracking_configuration_revision(i.user_id) then return 'configuration_stale'; end if;
  -- Explicit instrument evidence is required even when a caller sends an ID.
  if not(i.normalized_payload ? 'accountId') or jsonb_array_length(coalesce(i.normalized_payload#>'{classification,instruments}','[]'::jsonb))=0 then return 'account_proof_required'; end if;
  affected:=(i.normalized_payload->>'accountId')::uuid;
  subtype:=i.normalized_payload#>>'{classification,subtype}';
  if subtype in ('transfer_sent','transfer_received') then
    if not(i.normalized_payload ? 'destinationAccountId') then return 'transfer_counterparty_required'; end if;
    counterpart:=(i.normalized_payload->>'destinationAccountId')::uuid;
    if counterpart=affected or not exists(select 1 from public.accounts a where a.id=counterpart and a.user_id=i.user_id
      and a.status='active' and a.automatic_tracking_enabled and a.currency_code=i.currency_code and a.type in ('bank','debit_card','credit_card','wallet','savings'))
      or not exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h where h->>'side'='source')
      or not exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h where h->>'side'='destination') then return 'transfer_counterparty_required'; end if;
  end if;
  if not exists(select 1 from public.accounts a where a.id=affected and a.user_id=i.user_id and a.status='active'
    and a.automatic_tracking_enabled and a.currency_code=i.currency_code) then return 'account_proof_required'; end if;
  for hint in select * from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') loop
    expected_account:=affected;
    if counterpart is not null then
      if hint->>'side' not in ('source','destination') or hint->>'side' is null then return 'transfer_counterparty_required'; end if;
      if (i.normalized_payload#>>'{classification,direction}'='incoming' and hint->>'side'='source')
        or (i.normalized_payload#>>'{classification,direction}'='outgoing' and hint->>'side'='destination') then expected_account:=counterpart; end if;
    end if;
    select array_agg(distinct a.id) into ids from public.accounts a
      where a.user_id=i.user_id and a.status='active' and a.automatic_tracking_enabled and a.currency_code=i.currency_code
      and (exists(select 1 from public.tracking_account_bindings b where b.user_id=i.user_id and b.enabled
        and b.provider=state->>'provider' and b.role=hint->>'role' and b.suffix=hint->>'suffix' and b.account_id=a.id)
      or (length(hint->>'suffix')=4 and a.last_four=hint->>'suffix'
        and not exists(select 1 from public.tracking_account_bindings b where b.user_id=i.user_id and b.enabled and b.role=hint->>'role' and b.suffix=hint->>'suffix')));
    if cardinality(ids) is distinct from 1 or ids[1] is distinct from expected_account then return 'account_proof_required'; end if;
  end loop;
  if i.amount_minor is null or i.currency_code is null or abs(i.amount_minor) is distinct from (i.normalized_payload#>>'{classification,amountMinor}')::bigint
    or i.currency_code::text is distinct from i.normalized_payload#>>'{classification,currency}' then return 'invalid_input'; end if;
  select value into reason from jsonb_array_elements_text(i.normalized_payload#>'{classification,reasonCodes}')
    where value not in ('source_untrusted') limit 1;
  if reason is not null then
    return case when reason in ('amount_missing','amount_invalid','amount_conflict','unsupported_currency','date_ambiguous','conflicting_direction','action_unknown',
      'credit_origin_required','cash_destination_required','transfer_counterparty_required','original_transaction_required','fee_components_required','ambiguous_account') then reason when reason='rollout_review' then 'review_required' else 'invalid_input' end;
  end if;
  if i.normalized_payload#>>'{classification,disposition}'<>'capture_candidate' and corroboration is null then return 'invalid_input'; end if;
  subtype:=i.normalized_payload#>>'{classification,subtype}';
  if not((i.normalized_payload->>'kind'='transfer' and counterpart is not null and subtype in ('transfer_sent','transfer_received') and i.normalized_payload#>>'{classification,direction}' in ('incoming','outgoing'))
    or(i.normalized_payload->>'kind' in ('expense','fee') and i.normalized_payload#>>'{classification,direction}'='outgoing'
    and subtype in ('pos_purchase','online_purchase','card_purchase','bill_payment','purchase','payment','generic_debit','fee'))
    or(i.normalized_payload->>'kind'='income' and i.normalized_payload#>>'{classification,direction}'='incoming' and subtype in ('salary','deposit','generic_credit')
      and exists(select 1 from public.accounts a where a.id=affected and a.type='bank')
      and not exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h where h->>'role'='card'))) then return 'unsupported_accounting_operation'; end if;
  return null;
end $$;

create or replace function private.compute_duplicate_candidates(p_import_item_id uuid) returns setof public.duplicate_candidates
language plpgsql security definer set search_path='' as $$
declare i public.import_items; window_seconds integer; candidate public.duplicate_candidates;
begin
  select * into i from public.import_items where id=p_import_item_id for update;
  if i.id is null or i.amount_minor is null or i.currency_code is null then return; end if;
  if exists(select 1 from private.tracking_capture_reservations r where r.user_id=i.user_id and r.identity_hash=i.canonical_identity_hash and (r.primary_item_id<>i.id or exists(select 1 from public.import_items x where x.id=r.primary_item_id and x.transaction_id is not null))) then return; end if;
  select coalesce(p.duplicate_window_seconds,86400) into window_seconds from public.tracking_preferences p where p.user_id=i.user_id;
  window_seconds:=coalesce(window_seconds,86400);
  for candidate in
  insert into public.duplicate_candidates(user_id,left_item_id,right_transaction_id,score,reasons)
  select i.user_id,i.id,t.id,
    least(1::numeric,0.5000 + case when abs(extract(epoch from (t.occurred_at-i.occurred_at)))<=300 then 0.2000 else 0.1000 end
      + case when lower(coalesce(t.merchant,''))=lower(coalesce(i.merchant,'')) and i.merchant is not null then 0.1500 else 0 end
      + case when t.external_ref is not null and t.external_ref=i.normalized_payload->>'externalRef' then 0.1500 else 0 end),
    array_remove(array['amount_currency',case when abs(extract(epoch from (t.occurred_at-i.occurred_at)))<=300 then 'time_near' else 'time_window' end,
      case when lower(coalesce(t.merchant,''))=lower(coalesce(i.merchant,'')) and i.merchant is not null then 'merchant_exact' end,
      case when t.external_ref is not null and t.external_ref=i.normalized_payload->>'externalRef' then 'external_ref_exact' end],null)
  from public.transactions t where t.user_id=i.user_id and t.status='confirmed' and t.deleted_at is null and t.amount_minor=abs(i.amount_minor)
    and t.kind=case when i.normalized_payload->>'kind'='fee' then 'expense' else i.normalized_payload->>'kind' end
    and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id and p.account_id::text=i.normalized_payload->>'accountId')
    and t.currency_code=i.currency_code and i.occurred_at is not null and abs(extract(epoch from (t.occurred_at-i.occurred_at)))<=window_seconds
  and not exists(select 1 from public.import_items proof where proof.user_id=i.user_id and proof.transaction_id=t.id and proof.status='accepted'
      and (private.tracking_capture_source_state(i.id)->>'trusted')::boolean and (private.tracking_capture_source_state(proof.id)->>'trusted')::boolean
      and private.tracking_capture_source_state(i.id)->>'provider'=private.tracking_capture_source_state(proof.id)->>'provider'
      and i.normalized_payload ? 'providerReferenceDigest' and proof.normalized_payload ? 'providerReferenceDigest'
      and coalesce(i.normalized_payload#>>'{metadata,referenceScheme}','legacy')=coalesce(proof.normalized_payload#>>'{metadata,referenceScheme}','legacy')
      and i.normalized_payload->>'providerReferenceDigest'<>proof.normalized_payload->>'providerReferenceDigest'
      and private.tracking_effect_family(i.normalized_payload)=private.tracking_effect_family(proof.normalized_payload)
      and private.tracking_capture_effect_key(i.normalized_payload)=private.tracking_capture_effect_key(proof.normalized_payload))
  on conflict(left_item_id,right_transaction_id) do nothing returning *
  loop
    perform private.enqueue_outbox_event('tracking.duplicate.detected.v1','duplicate-candidate',candidate.id,
      jsonb_build_object('candidateId',candidate.id,'itemId',candidate.left_item_id,'existingTransactionId',candidate.right_transaction_id,
        'scoreBand',case when candidate.score>=0.85 then 'high' when candidate.score>=0.70 then 'medium' else 'low' end,
        'version',candidate.version,'occurredAt',candidate.created_at));
    return next candidate;
  end loop;
end $$;

create or replace function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions; prefs public.tracking_preferences; reason text; proposal jsonb; eligible boolean; auto_items jsonb:='[]';
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version<>2 then return private.finalize_import_session_rules_base(p_session_id,p_fence_token); end if;
  select * into prefs from public.tracking_preferences where user_id=s.user_id;
  for i in select * from public.import_items where session_id=s.id and status='parsed' order by id for update loop
    reason:=private.tracking_capture_exception(i.id);
    if reason is not null then perform private.create_review_item(i.id,reason,i.normalized_payload); continue; end if;
    select exists(select 1 from public.tracking_rule_releases r join public.tracking_rule_channels c on c.release_id=r.id
      where r.status='published' and c.environment='default' and c.market='global' and c.channel='all' and c.mode='automatic'
        and r.snapshot->>'releaseId'=i.normalized_payload#>>'{classification,releaseId}'
        and i.normalized_payload#>>'{classification,engineVersion}'=r.engine_version) into eligible;
    if not eligible or coalesce(prefs.review_required,true) then perform private.create_review_item(i.id,'review_required',i.normalized_payload); continue; end if;
    begin
      perform private.assert_automatic_tracking_account(s.user_id,i.normalized_payload->>'accountId');
      if i.normalized_payload ? 'destinationAccountId' then perform private.assert_automatic_tracking_account(s.user_id,i.normalized_payload->>'destinationAccountId'); end if;
    exception when sqlstate 'P0001' then perform private.defer_import_item(i.id,p_fence_token,'account_tracking_blocked'); continue; end;
    update public.import_items x set merchant=coalesce(x.merchant,(
      select m.normalized_merchant from public.merchant_rules m where m.active and (m.user_id is null or m.user_id=s.user_id)
        and strpos(lower(coalesce(x.merchant,'')),lower(m.pattern))>0 order by m.user_id nulls last,m.priority,m.id limit 1)),
      normalized_payload=coalesce((select jsonb_build_object('categoryId',c.category_id) from public.category_rules c
        where c.active and (c.user_id is null or c.user_id=s.user_id) and strpos(lower(coalesce(x.merchant,'')),lower(c.pattern))>0
        order by c.user_id nulls last,c.priority,c.id limit 1),'{}'::jsonb)||x.normalized_payload,
      confidence_basis_points=9000 where x.id=i.id returning * into i;
    perform private.compute_duplicate_candidates(i.id);
    proposal:=i.normalized_payload||jsonb_strip_nulls(jsonb_build_object('amountMinor',i.amount_minor,'currency',btrim(i.currency_code::text),'merchant',i.merchant,'occurredAt',i.occurred_at));
    if exists(select 1 from public.duplicate_candidates d where d.left_item_id=i.id and d.status='proposed') then
      perform private.create_review_item(i.id,'duplicate_candidate',proposal);
    else auto_items:=auto_items||jsonb_build_array(jsonb_build_object('id',i.id,'userId',i.user_id,'values',proposal)); end if;
  end loop;
  return jsonb_build_object('sessionId',s.id,'autoItems',auto_items);
end $$;

revoke all on function private.tracking_capture_effect_key(jsonb),private.tracking_verified_correspondence(uuid) from public;
reset role;
revoke masarifi_migration from current_user granted by current_user;
