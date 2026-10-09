grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- A revision binds posting eligibility to the owner's actual database config.
-- Account balances are deliberately excluded; financial activity is not a rule edit.
alter function private.get_tracking_rule_snapshot(text) rename to get_tracking_rule_snapshot_base;
revoke all on function private.get_tracking_rule_snapshot_base(text) from public,masarifi_api,masarifi_worker;
create function private.tracking_configuration_revision(p_user_id text) returns text
language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'configuration',private.get_tracking_rule_snapshot_base(p_user_id),
    'preferences',(select jsonb_build_object('version',p.version,'enabled',p.enabled,'reviewRequired',p.review_required)
      from public.tracking_preferences p where p.user_id=p_user_id),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'currency',a.currency_code,
      'tracking',a.automatic_tracking_enabled,'suffix',a.last_four) order by a.id)
      from public.accounts a where a.user_id=p_user_id),'[]'::jsonb)
  )::text,'UTF8'),'sha256'),'hex');
$$;
create function private.get_tracking_rule_snapshot(p_user_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select private.get_tracking_rule_snapshot_base(p_user_id)||jsonb_build_object('configurationRevision',private.tracking_configuration_revision(p_user_id));
$$;
grant execute on function private.get_tracking_rule_snapshot(text) to masarifi_api;

-- Infer provider namespace from the observed source, never a package's claim
-- about which bank/provider it represents. Package provenance wins for NLS.
create function private.tracking_capture_source_state(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; observed text; provider_key text; blocked boolean; trusted boolean;
begin
  select * into i from public.import_items where id=p_item_id;
  observed:=case when i.normalized_payload#>>'{transport,channel}'='android_notification'
    then coalesce(i.normalized_payload#>>'{metadata,sourcePackage}',i.normalized_payload->>'sender')
    else i.normalized_payload->>'sender' end;
  observed:=regexp_replace(lower(btrim(coalesce(observed,''))),'\s+','','g');
  select exists(select 1 from public.user_sender_rules d where d.user_id=i.user_id and not d.enabled
    and regexp_replace(lower(btrim(d.sender_pattern)),'\s+','','g')=observed),
    exists(select 1 from public.user_sender_rules d where d.user_id=i.user_id and d.enabled and d.trusted
    and regexp_replace(lower(btrim(d.sender_pattern)),'\s+','','g')=observed) into blocked,trusted;
  select provider->>'providerKey' into provider_key from public.tracking_rule_channels c
    join public.tracking_rule_releases r on r.id=c.release_id
    cross join lateral jsonb_array_elements(r.snapshot->'providers') provider
    cross join lateral jsonb_array_elements_text(coalesce(provider->'senders','[]'::jsonb)||coalesce(provider->'packages','[]'::jsonb)) identity(value)
    where c.environment='default' and c.market='global' and c.channel='all'
    and regexp_replace(lower(btrim(identity.value)),'\s+','','g')=observed limit 1;
  return jsonb_build_object('blocked',blocked,'trusted',trusted and not blocked,'provider',coalesce(provider_key,observed),'source',observed);
end $$;
create function private.tracking_effect_family(p_payload jsonb) returns text
language sql immutable set search_path='' as $$
  select case when p_payload#>>'{classification,subtype}' in ('pos_purchase','online_purchase','card_purchase','bill_payment','purchase','payment','generic_debit') then 'expense'
    when p_payload#>>'{classification,subtype}' in ('salary','deposit','generic_credit') then 'credit'
    when p_payload#>>'{classification,subtype}' in ('transfer_sent','transfer_received') then 'transfer'
    else p_payload#>>'{classification,subtype}' end;
$$;

create or replace function private.reserve_tracking_capture(p_item_id uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions; r private.tracking_capture_reservations; source_state jsonb; proof text; hash text; legacy_hash text;
begin
  select x.* into i from public.import_items x join public.import_sessions y on y.id=x.session_id
  where x.id=p_item_id and x.status='parsed' and y.claim_token=p_fence and y.lease_until>clock_timestamp() for update of x;
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  select * into s from public.import_sessions where id=i.session_id;
  source_state:=private.tracking_capture_source_state(i.id);
  proof:=case when (source_state->>'trusted')::boolean and i.normalized_payload ? 'providerReferenceDigest' then
    concat_ws('|','reference-verified',source_state->>'provider',i.normalized_payload->>'providerReferenceDigest',
      i.normalized_payload#>>'{classification,direction}',private.tracking_effect_family(i.normalized_payload))
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
      and x.normalized_payload#>>'{classification,direction}'=i.normalized_payload#>>'{classification,direction}'
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
      (x.amount_minor is distinct from i.amount_minor or x.currency_code is distinct from i.currency_code or
        (x.normalized_payload->>'accountId' is not null and i.normalized_payload->>'accountId' is not null and x.normalized_payload->>'accountId' is distinct from i.normalized_payload->>'accountId'))),
    'transactionId',coalesce(r.transaction_id,(select transaction_id from public.import_items where id=r.primary_item_id)));
end $$;

create function private.tracking_capture_exception(p_item_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; state jsonb; hint jsonb; ids uuid[]; affected uuid; reason text; subtype text;
begin
  select * into i from public.import_items where id=p_item_id;
  if coalesce(i.normalized_payload#>>'{classification,status}','unknown')<>'completed' then return 'lifecycle_not_completed'; end if;
  state:=private.tracking_capture_source_state(i.id);
  if (state->>'blocked')::boolean then return 'source_blocked'; end if;
  if not (state->>'trusted')::boolean then return 'source_proof_required'; end if;
  if not coalesce((select enabled from public.tracking_preferences where user_id=i.user_id),false) then return 'paused'; end if;
  if i.normalized_payload#>>'{metadata,ruleConfigurationRevision}' is distinct from private.tracking_configuration_revision(i.user_id) then return 'configuration_stale'; end if;
  -- Explicit instrument evidence is required even when a caller sends an ID.
  if not(i.normalized_payload ? 'accountId') or jsonb_array_length(coalesce(i.normalized_payload#>'{classification,instruments}','[]'::jsonb))=0 then return 'account_proof_required'; end if;
  affected:=(i.normalized_payload->>'accountId')::uuid;
  if not exists(select 1 from public.accounts a where a.id=affected and a.user_id=i.user_id and a.status='active'
    and a.automatic_tracking_enabled and a.currency_code=i.currency_code) then return 'account_proof_required'; end if;
  for hint in select * from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') loop
    select array_agg(distinct a.id) into ids from public.accounts a
      where a.user_id=i.user_id and a.status='active' and a.automatic_tracking_enabled and a.currency_code=i.currency_code
      and (exists(select 1 from public.tracking_account_bindings b where b.user_id=i.user_id and b.enabled
        and b.provider=state->>'provider' and b.role=hint->>'role' and b.suffix=hint->>'suffix' and b.account_id=a.id)
      or (length(hint->>'suffix')=4 and a.last_four=hint->>'suffix'
        and not exists(select 1 from public.tracking_account_bindings b where b.user_id=i.user_id and b.enabled and b.role=hint->>'role' and b.suffix=hint->>'suffix')));
    if cardinality(ids) is distinct from 1 or ids[1] is distinct from affected then return 'account_proof_required'; end if;
  end loop;
  if i.amount_minor is null or i.currency_code is null or abs(i.amount_minor) is distinct from (i.normalized_payload#>>'{classification,amountMinor}')::bigint
    or i.currency_code::text is distinct from i.normalized_payload#>>'{classification,currency}' then return 'invalid_input'; end if;
  select value into reason from jsonb_array_elements_text(i.normalized_payload#>'{classification,reasonCodes}')
    where value not in ('source_untrusted') limit 1;
  if reason is not null then
    return case when reason in ('amount_missing','amount_invalid','amount_conflict','unsupported_currency','date_ambiguous','conflicting_direction','action_unknown',
      'credit_origin_required','cash_destination_required','transfer_counterparty_required','original_transaction_required','fee_components_required','ambiguous_account') then reason else 'invalid_input' end;
  end if;
  if i.normalized_payload#>>'{classification,disposition}'<>'capture_candidate' then return 'invalid_input'; end if;
  subtype:=i.normalized_payload#>>'{classification,subtype}';
  if not((i.normalized_payload->>'kind' in ('expense','fee') and i.normalized_payload#>>'{classification,direction}'='outgoing'
    and subtype in ('pos_purchase','online_purchase','card_purchase','bill_payment','purchase','payment','generic_debit','fee'))
    or(i.normalized_payload->>'kind'='income' and i.normalized_payload#>>'{classification,direction}'='incoming' and subtype in ('salary','deposit','generic_credit')
      and exists(select 1 from public.accounts a where a.id=affected and a.type='bank')
      and not exists(select 1 from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') h where h->>'role'='card'))) then return 'unsupported_accounting_operation'; end if;
  return null;
end $$;

create or replace function private.prepare_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions; reason text;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version<>2 then return private.prepare_import_session_legacy(p_session_id,p_fence_token); end if;
  for i in select * from public.import_items where session_id=s.id and status='parsed' order by id for update loop
    reason:=private.tracking_capture_exception(i.id);
    if reason='source_blocked' then perform private.create_review_item(i.id,reason,i.normalized_payload); continue; end if;
    if (private.reserve_tracking_capture(i.id,p_fence_token)->>'conflict')::boolean then perform private.create_review_item(i.id,'duplicate_candidate',i.normalized_payload); continue; end if;
    if reason is not null then perform private.create_review_item(i.id,reason,i.normalized_payload); continue; end if;
    if exists(select 1 from public.import_items prior where prior.user_id=i.user_id and prior.id<>i.id and prior.status='review'
      and (private.tracking_capture_source_state(prior.id)->>'trusted')::boolean
      and abs(prior.amount_minor)=abs(i.amount_minor) and prior.currency_code=i.currency_code
      and prior.normalized_payload->>'accountId'=i.normalized_payload->>'accountId'
      and prior.normalized_payload#>>'{classification,direction}'=i.normalized_payload#>>'{classification,direction}'
      and private.tracking_effect_family(prior.normalized_payload)=private.tracking_effect_family(i.normalized_payload)
      and coalesce(prior.merchant,'')=coalesce(i.merchant,'')
      and not(prior.normalized_payload ? 'providerReferenceDigest' and i.normalized_payload ? 'providerReferenceDigest'
        and prior.normalized_payload->>'providerReferenceDigest'<>i.normalized_payload->>'providerReferenceDigest')
      and abs(extract(epoch from(coalesce(prior.occurred_at,(prior.normalized_payload->>'receivedAt')::timestamptz)-coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz))))<=120) then
      perform private.create_review_item(i.id,'duplicate_candidate',i.normalized_payload);
    end if;
  end loop;
  return jsonb_build_object('sessionId',s.id,'parserItems','[]'::jsonb);
end $$;

-- Recheck immediately before returning financial commands to the worker.
alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_rules_base;
revoke all on function private.finalize_import_session_rules_base(uuid,uuid) from public,masarifi_api,masarifi_worker;
create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions; reason text;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version=2 then
    for i in select * from public.import_items where session_id=s.id and status='parsed' order by id for update loop
      reason:=private.tracking_capture_exception(i.id);
      if reason is not null then perform private.create_review_item(i.id,reason,i.normalized_payload); end if;
    end loop;
  end if;
  return private.finalize_import_session_rules_base(p_session_id,p_fence_token);
end $$;
grant execute on function private.reserve_tracking_capture(uuid,uuid),private.prepare_import_session(uuid,uuid),private.finalize_import_session(uuid,uuid) to masarifi_worker;
revoke all on function private.tracking_configuration_revision(text),private.get_tracking_rule_snapshot(text),private.tracking_capture_source_state(uuid),private.tracking_effect_family(jsonb),private.tracking_capture_exception(uuid),private.reserve_tracking_capture(uuid,uuid),private.prepare_import_session(uuid,uuid),private.finalize_import_session(uuid,uuid) from public;

reset role;
revoke masarifi_migration from current_user granted by current_user;
