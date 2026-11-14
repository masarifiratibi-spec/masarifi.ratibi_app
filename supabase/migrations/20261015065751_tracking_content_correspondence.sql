grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create index import_items_content_reference_idx on public.import_items
  (user_id,(normalized_payload#>>'{transport,deviceId}'),(normalized_payload->>'providerReferenceDigest'))
  where normalized_payload->>'accountingPolicy'='default_account_nominal_v1'
    and normalized_payload#>>'{metadata,sourceAdmissionPolicy}'='financial_content_v1';

-- A content cohort authorizes intake without inventing a bank/provider identity.
-- Correspondence additionally needs the same reference, device, time and effect.
create function private.tracking_content_correspondence(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; x public.import_items; matches uuid[]; transactions uuid[];
  state jsonb; other_state jsonb; saved public.transactions; identity text; leader uuid;
begin
  select * into i from public.import_items where id=p_item;
  if i.normalized_payload->>'accountingPolicy' is distinct from 'default_account_nominal_v1'
    or i.normalized_payload#>>'{metadata,sourceAdmissionPolicy}' is distinct from 'financial_content_v1'
    or i.normalized_payload#>>'{metadata,referenceScheme}' is distinct from 'plain-v2'
    or coalesce(i.normalized_payload->>'providerReferenceDigest','') !~ '^[a-f0-9]{64}$'
    or private.tracking_nominal_exception(i.id) is not null then return null; end if;
  state:=private.tracking_nominal_source(i.id);
  select array_agg(other.id order by other.created_at,other.id),
    array_agg(distinct other.transaction_id) filter(where other.transaction_id is not null)
    into matches,transactions
  from public.import_items other join public.import_sessions s on s.id=other.session_id
  where other.user_id=i.user_id and other.id<>i.id and s.schema_version=3
    and other.normalized_payload->>'accountingPolicy'='default_account_nominal_v1'
    and other.normalized_payload#>>'{metadata,sourceAdmissionPolicy}'='financial_content_v1'
    and other.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
    and other.normalized_payload->>'providerReferenceDigest'=i.normalized_payload->>'providerReferenceDigest'
    and other.normalized_payload#>>'{transport,deviceId}'=i.normalized_payload#>>'{transport,deviceId}'
    and other.normalized_payload#>>'{transport,channel}'<>i.normalized_payload#>>'{transport,channel}'
    and other.status in ('parsed','accepted') and other.canonical_identity_hash is not null
    and private.tracking_nominal_exception(other.id) is null
    and other.amount_minor=i.amount_minor and other.currency_code=i.currency_code
    and other.normalized_payload->>'accountId'=i.normalized_payload->>'accountId'
    and (other.normalized_payload->>'sourceAmountDecimal')::numeric=(i.normalized_payload->>'sourceAmountDecimal')::numeric
    and other.normalized_payload#>>'{classification,currency}' is not distinct from i.normalized_payload#>>'{classification,currency}'
    and private.tracking_capture_effect_key(other.normalized_payload)=private.tracking_capture_effect_key(i.normalized_payload)
    and private.tracking_effect_family(other.normalized_payload)=private.tracking_effect_family(i.normalized_payload)
    and coalesce(other.normalized_payload#>>'{metadata,movementComponent}','single')=coalesce(i.normalized_payload#>>'{metadata,movementComponent}','single')
    and (nullif(btrim(other.normalized_payload#>>'{classification,merchant}'),'') is null
      or nullif(btrim(i.normalized_payload#>>'{classification,merchant}'),'') is null
      or lower(btrim(other.normalized_payload#>>'{classification,merchant}'))=lower(btrim(i.normalized_payload#>>'{classification,merchant}')))
    and abs(extract(epoch from((other.normalized_payload->>'receivedAt')::timestamptz-(i.normalized_payload->>'receivedAt')::timestamptz)))<=120;
  if coalesce(cardinality(matches),0)=0 or coalesce(cardinality(transactions),0)>1 then return null; end if;
  -- Multiple pending opposite-channel events are ambiguous, even with equal values.
  if cardinality(matches)>1 and exists(select 1 from public.import_items where id=any(matches) and transaction_id is null) then return null; end if;
  select * into x from public.import_items where id=any(matches) order by transaction_id nulls last,created_at,id limit 1;
  other_state:=private.tracking_nominal_source(x.id);
  if state->>'provider' is distinct from state->>'source'
    and other_state->>'provider' is distinct from other_state->>'source'
    and state->>'provider' is distinct from other_state->>'provider' then return null; end if;
  if x.transaction_id is not null then
    select * into saved from public.transactions where id=x.transaction_id and user_id=i.user_id
      and source='tracking-import' and status='confirmed' and deleted_at is null
      and kind=i.normalized_payload->>'kind' and amount_minor=abs(i.amount_minor) and currency_code=i.currency_code;
    identity:=coalesce(x.normalized_payload#>>'{correlation,movementIdentityHash}',x.canonical_identity_hash);
    if saved.id is null or saved.external_ref is distinct from 'tracking:'||identity
      or (select count(*) from public.transaction_postings where transaction_id=saved.id)<>1
      or not exists(select 1 from public.transaction_postings where transaction_id=saved.id
        and account_id::text=i.normalized_payload->>'accountId' and amount_minor=i.amount_minor and clearing_state='confirmed') then return null; end if;
    return jsonb_build_object('scheme','content-reference-v1','primaryItemId',x.id,
      'transactionId',saved.id,'movementIdentityHash',identity);
  end if;
  -- Both channels can arrive before either worker has committed. Elect the
  -- existing reservation primary (or oldest observation) under the owner lock.
  if i.canonical_identity_hash=x.canonical_identity_hash then
    select primary_item_id into leader from private.tracking_capture_reservations
      where user_id=i.user_id and identity_hash=i.canonical_identity_hash;
  else
    select id into leader from public.import_items where id in (i.id,x.id) order by created_at,id limit 1;
  end if;
  return jsonb_build_object('scheme','content-reference-v1','leaderItemId',leader);
end $$;

alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_content_reference;
revoke all on function private.finalize_import_session_before_content_reference(uuid,uuid) from public,masarifi_api,masarifi_worker;
create function private.finalize_import_session(p_session uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare session public.import_sessions; i public.import_items; result jsonb; proof jsonb; items jsonb;
begin
  select * into session from public.import_sessions where id=p_session;
  if session.schema_version=3 then
    -- The ledger commit takes this lock before item/reservation locks too.
    perform pg_advisory_xact_lock(hashtextextended(session.user_id,0));
  end if;
  result:=private.finalize_import_session_before_content_reference(p_session,p_fence);
  if session.schema_version<>3 then return result; end if;
  items:=result->'autoItems';
  for i in select * from public.import_items where session_id=p_session and status='parsed' order by id for update loop
    if i.normalized_payload->>'diagnosticReason' is distinct from 'correlation_unresolved'
      and not exists(select 1 from jsonb_array_elements(items) value where value->>'id'=i.id::text) then continue; end if;
    proof:=private.tracking_content_correspondence(i.id);
    if proof->>'transactionId' is not null then
      -- Preserve the observation's original key, hash and reservation. The
      -- correspondence records its separately verified financial movement.
      update public.import_items set normalized_payload=(normalized_payload-'diagnosticReason')||jsonb_build_object('correlation',proof) where id=i.id;
      perform private.accept_import_item(i.id,p_fence,null,(proof->>'transactionId')::uuid);
      select coalesce(jsonb_agg(value),'[]'::jsonb) into items from jsonb_array_elements(items) value where value->>'id'<>i.id::text;
    elsif proof->>'leaderItemId'=i.id::text and i.normalized_payload->>'diagnosticReason'='correlation_unresolved' then
      update public.import_items set normalized_payload=normalized_payload-'diagnosticReason' where id=i.id returning * into i;
      items:=items||jsonb_build_array(jsonb_build_object('id',i.id,'userId',i.user_id,'values',i.normalized_payload||jsonb_build_object('occurredAt',coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz))));
    end if;
  end loop;
  return result||jsonb_build_object('autoItems',items,'deferredCount',(
    select count(*) from public.import_items pending where pending.session_id=p_session and pending.status='parsed'
      and not exists(select 1 from jsonb_array_elements(items) value where value->>'id'=pending.id::text)));
end $$;
revoke all on function private.tracking_content_correspondence(uuid),private.finalize_import_session(uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.finalize_import_session(uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
