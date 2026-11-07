grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create or replace function private.tracking_capture_source_state(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; observed text; digest text; provider_key text; blocked boolean; trusted boolean;
begin
  select * into i from public.import_items where id=p_item_id;
  observed:=case when i.normalized_payload#>>'{transport,channel}'='android_notification'
    then coalesce(i.normalized_payload#>>'{metadata,sourcePackage}',i.normalized_payload->>'sender')
    else i.normalized_payload->>'sender' end;
  observed:=regexp_replace(lower(btrim(coalesce(observed,''))),'\s+','','g');
  -- Digest fallback is SMS-only and only for a redacted numeric sender.
  if observed='' and i.normalized_payload#>>'{transport,channel}'='android_sms'
    and i.normalized_payload#>>'{metadata,sourceIdentityDigest}' ~ '^[a-f0-9]{64}$' then
    digest:=i.normalized_payload#>>'{metadata,sourceIdentityDigest}';
  end if;
  select coalesce(bool_or(not d.enabled),false),coalesce(bool_or(d.enabled and d.trusted),false) into blocked,trusted
    from public.user_sender_rules d where d.user_id=i.user_id and (
      (observed<>'' and regexp_replace(lower(btrim(d.sender_pattern)),'\s+','','g')=observed)
      or (digest is not null and regexp_replace(lower(btrim(d.sender_pattern)),'\s+','','g') ~ '^\+?[0-9]{5,15}$'
        and encode(extensions.digest(convert_to(regexp_replace(lower(btrim(d.sender_pattern)),'\s+','','g'),'UTF8'),'sha256'),'hex')=digest));
  select provider->>'providerKey' into provider_key from public.tracking_rule_channels c
    join public.tracking_rule_releases r on r.id=c.release_id
    cross join lateral jsonb_array_elements(r.snapshot->'providers') provider
    cross join lateral jsonb_array_elements_text(coalesce(provider->'senders','[]'::jsonb)||coalesce(provider->'packages','[]'::jsonb)) identity(value)
    where c.environment='default' and c.market='global' and c.channel='all'
    and ((observed<>'' and regexp_replace(lower(btrim(identity.value)),'\s+','','g')=observed)
      or (digest is not null and regexp_replace(lower(btrim(identity.value)),'\s+','','g') ~ '^\+?[0-9]{5,15}$'
        and encode(extensions.digest(convert_to(regexp_replace(lower(btrim(identity.value)),'\s+','','g'),'UTF8'),'sha256'),'hex')=digest)) limit 1;
  return jsonb_build_object('blocked',blocked,'trusted',trusted and not blocked,
    'provider',coalesce(provider_key,nullif(observed,''),'sender:'||digest),'source',coalesce(nullif(observed,''),'sender:'||digest));
end $$;
create or replace function private.tracking_verified_correspondence(p_item_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with current_capture as (select * from public.import_items where id=p_item_id),
  matches as (
    select x.id,x.transaction_id,x.canonical_identity_hash,x.operation_id,
      private.tracking_capture_source_state(x.id)->>'provider' provider
    from current_capture i join public.import_items x on x.user_id=i.user_id and x.id<>i.id
    join public.transactions t on t.id=x.transaction_id and t.user_id=i.user_id
    where (
        (i.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2' and x.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2')
        or ((private.tracking_capture_source_state(i.id)->>'trusted')::boolean
          and private.tracking_capture_source_state(i.id)->>'provider'=private.tracking_capture_source_state(x.id)->>'provider'
          and coalesce(i.normalized_payload#>>'{metadata,referenceScheme}','')=coalesce(x.normalized_payload#>>'{metadata,referenceScheme}','')))
      and not (private.tracking_capture_source_state(i.id)->>'blocked')::boolean
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

-- An explicit original reference must resolve uniquely to the same verified
-- provider, owner, device, account and currency. The ledger still enforces caps,
-- versions, immutable postings and refund/reversal concurrency.
create function private.tracking_original_compensation(p_item_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with current_capture as (select * from public.import_items where id=p_item_id), matches as (
    select distinct t.id,t.version from current_capture i
    join public.import_items x on x.user_id=i.user_id and x.id<>i.id
    join public.transactions t on t.id=x.transaction_id and t.user_id=i.user_id
    where i.normalized_payload#>>'{classification,subtype}' in ('refund','reversal')
      and i.normalized_payload#>>'{classification,status}'='completed'
      and i.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
      and x.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
      and i.normalized_payload->>'originalProviderReferenceDigest'=x.normalized_payload->>'providerReferenceDigest'
      and (private.tracking_capture_source_state(i.id)->>'trusted')::boolean
      and not (private.tracking_capture_source_state(i.id)->>'blocked')::boolean
      and (private.tracking_capture_source_state(x.id)->>'trusted')::boolean
      and private.tracking_capture_source_state(i.id)->>'provider'=private.tracking_capture_source_state(x.id)->>'provider'
      and i.normalized_payload#>>'{transport,deviceId}'=x.normalized_payload#>>'{transport,deviceId}'
      and x.status='accepted' and x.canonical_identity_hash is not null
      and t.kind='expense' and t.status='confirmed' and t.deleted_at is null and t.fee_minor=0
      and t.currency_code=i.currency_code and t.occurred_at<=coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz)
      and (select count(*) from public.transaction_postings p where p.transaction_id=t.id)=1
      and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id
        and p.account_id::text=i.normalized_payload->>'accountId' and p.amount_minor=-t.amount_minor)
      and not exists(select 1 from public.transactions d where d.reverses_transaction_id=t.id and d.kind='reversal' and d.status='confirmed')
      and case when i.normalized_payload#>>'{classification,subtype}'='reversal' then
        abs(i.amount_minor)=t.amount_minor and not exists(select 1 from public.transactions d where d.reverses_transaction_id=t.id and d.kind='refund' and d.status='confirmed')
      else abs(i.amount_minor)<=t.amount_minor-coalesce((select sum(d.amount_minor) from public.transactions d
        where d.reverses_transaction_id=t.id and d.kind='refund' and d.status='confirmed'),0) end
  )
  select case when (select count(*) from matches)=1 then
    (select jsonb_build_object('originalTransactionId',id,'originalTransactionVersion',version) from matches) else null end;
$$;
create or replace function private.tracking_capture_exception(p_item_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; state jsonb; hint jsonb; ids uuid[]; affected uuid; reason text; subtype text; counterpart uuid; expected_account uuid; corroboration jsonb; original_proof jsonb;
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
  if not(i.normalized_payload ? 'accountId') then return 'account_proof_required'; end if;
  if (state->>'trusted')::boolean then corroboration:=private.tracking_verified_correspondence(i.id); end if;
  if jsonb_array_length(coalesce(i.normalized_payload#>'{classification,instruments}','[]'::jsonb))=0 and corroboration is null then return 'account_proof_required'; end if;
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
  original_proof:=private.tracking_original_compensation(i.id);
  select value into reason from jsonb_array_elements_text(i.normalized_payload#>'{classification,reasonCodes}')
    where value not in ('source_untrusted') and not(value='original_transaction_required' and original_proof is not null) limit 1;
  if reason is not null then
    return case when reason in ('amount_missing','amount_invalid','amount_conflict','unsupported_currency','date_ambiguous','conflicting_direction','action_unknown',
      'credit_origin_required','cash_destination_required','transfer_counterparty_required','original_transaction_required','fee_components_required','ambiguous_account') then reason when reason='rollout_review' then 'review_required' else 'invalid_input' end;
  end if;
  if i.normalized_payload#>>'{classification,disposition}'<>'capture_candidate' and corroboration is null and original_proof is null then return 'invalid_input'; end if;
  subtype:=i.normalized_payload#>>'{classification,subtype}';
  if not((original_proof is not null and i.normalized_payload->>'kind'='refund' and i.normalized_payload#>>'{classification,direction}'='incoming')
    or(i.normalized_payload->>'kind'='transfer' and counterpart is not null and subtype in ('transfer_sent','transfer_received') and i.normalized_payload#>>'{classification,direction}' in ('incoming','outgoing'))
    or(i.normalized_payload->>'kind' in ('expense','fee') and i.normalized_payload#>>'{classification,direction}'='outgoing'
    and subtype in ('pos_purchase','online_purchase','card_purchase','bill_payment','purchase','payment','generic_debit','fee'))
    or(i.normalized_payload->>'kind'='income' and i.normalized_payload#>>'{classification,direction}'='incoming' and subtype in ('salary','deposit','generic_credit')
      and exists(select 1 from public.accounts a where a.id=affected and a.type='bank')
      and not exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h where h->>'role'='card'))) then return 'unsupported_accounting_operation'; end if;
  return null;
end $$;

create function private.tracking_capture_auto_enabled(p_item_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.import_items i
    join public.tracking_preferences p on p.user_id=i.user_id
    join public.tracking_rule_channels c on c.environment='default' and c.market='global' and c.channel='all'
    join public.tracking_rule_releases r on r.id=c.release_id
    where i.id=p_item_id and p.enabled and not p.review_required and c.mode='automatic' and r.status='published'
      and r.snapshot->>'releaseId'=i.normalized_payload#>>'{classification,releaseId}'
      and r.engine_version=i.normalized_payload#>>'{classification,engineVersion}');
$$;
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
    eligible:=private.tracking_capture_auto_enabled(i.id);
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
    else proposal:=proposal||coalesce(private.tracking_original_compensation(i.id),'{}'::jsonb);
      auto_items:=auto_items||jsonb_build_array(jsonb_build_object('id',i.id,'userId',i.user_id,'values',proposal)); end if;
  end loop;
  return jsonb_build_object('sessionId',s.id,'autoItems',auto_items);
end $$;

-- Correlated unknown-first review recovery reuses an existing ledger effect.
-- It never creates money, source trust, or a second transaction confirmation.
create function private.reconcile_tracking_correspondence() returns trigger
language plpgsql security definer set search_path='' as $$
declare pending record; evidence jsonb; item public.import_items; session_source text;
begin
  if new.status<>'accepted' or new.transaction_id is null
    or not (private.tracking_capture_source_state(new.id)->>'trusted')::boolean then return new; end if;
  for pending in select r.id review_id,r.import_item_id from public.review_items r
    join public.import_items x on x.id=r.import_item_id and x.user_id=new.user_id
    where r.status='pending' and r.reason='source_proof_required' and r.decision_token is null
      and x.status='review' and x.id<>new.id
      and x.normalized_payload->>'providerReferenceDigest'=new.normalized_payload->>'providerReferenceDigest'
      and x.created_at>=clock_timestamp()-interval '24 hours'
    order by r.id for update of r skip locked loop
    select * into item from public.import_items where id=pending.import_item_id and status='review' for update skip locked;
    if item.id is null or not private.tracking_capture_auto_enabled(item.id) or private.tracking_capture_exception(item.id) is not null then continue; end if;
    evidence:=private.tracking_verified_correspondence(item.id);
    if evidence is null or evidence->>'transactionId'<>new.transaction_id::text then continue; end if;
    update public.review_items set status='accepted',reviewed_at=clock_timestamp(),reviewed_by=null,
      accepted_values=proposed_values||jsonb_build_object('transactionId',new.transaction_id,'corroboratedByItemId',new.id)
      where id=pending.review_id;
    update public.import_items set status='accepted',canonical_identity_hash=evidence->>'identityHash',
      transaction_id=new.transaction_id,operation_id=null where id=item.id;
    select source_type into session_source from public.import_sessions where id=item.session_id;
    insert into public.tracking_history(user_id,source_type,source_ref,outcome,reason_codes,parser_version_id,applied_rule_ids,review_item_id,operation_id,transaction_id)
      values(item.user_id,session_source,item.id::text,'duplicate',array['independently_correlated'],item.parser_version_id,item.applied_rule_ids,
        pending.review_id,(evidence->>'operationId')::uuid,new.transaction_id);
    perform private.enqueue_outbox_event('import.item.changed.v1','import-item',item.id,
      jsonb_build_object('sessionId',item.session_id,'itemId',item.id,'status','accepted','transactionId',new.transaction_id,'occurredAt',clock_timestamp()));
  end loop;
  return new;
end $$;
create trigger tracking_correspondence_reconcile after update of status,transaction_id on public.import_items
  for each row when (new.status='accepted' and old.status is distinct from 'accepted') execute function private.reconcile_tracking_correspondence();
revoke all on function private.tracking_original_compensation(uuid),private.tracking_capture_auto_enabled(uuid),private.reconcile_tracking_correspondence() from public;
reset role;
revoke masarifi_migration from current_user granted by current_user;
