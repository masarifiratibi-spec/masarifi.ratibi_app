do $role$
begin
  if pg_has_role(current_user,'masarifi_migration','SET') then
    perform set_config('masarifi.repayment_grant','existing',true);
  else
    if exists(select from pg_auth_members where roleid='masarifi_migration'::regrole
      and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I',current_user,current_user);
    perform set_config('masarifi.repayment_grant','temporary',true);
  end if;
end
$role$;
set local role masarifi_migration;

-- The V2 parser can create reviews during preparation. Intercept repayments
-- before that stage and before V3 selects a single default posting account.
alter function private.prepare_import_session(uuid,uuid) rename to prepare_import_session_before_card_repayment;
revoke all on function private.prepare_import_session_before_card_repayment(uuid,uuid)
  from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.prepare_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; i public.import_items; c jsonb; reservation jsonb; reason text; source_state jsonb;
begin
  select * into s from public.import_sessions where id=p_session_id and status='processing'
    and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if not found then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  for i in select * from public.import_items where session_id=s.id and status='parsed'
    and s.source_type in ('sms','provider') and normalized_payload#>>'{classification,subtype}'='card_repayment'
    order by normalized_payload#>>'{transport,deviceId}',id for update loop
    perform pg_advisory_xact_lock(hashtextextended(i.user_id,0));
    if i.normalized_payload#>>'{transport,deviceId}' is not null
      and private.lock_tracking_installation(i.user_id,i.normalized_payload#>>'{transport,deviceId}')
      and not private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) then
      raise exception using errcode='40001',message='TRACKING_INSTALLATION_STALE';
    end if;
    c:=i.normalized_payload->'classification';
    source_state:=case when s.schema_version=3 then private.tracking_nominal_source(i.id)
      else private.tracking_capture_source_state(i.id) end;
    reason:=case
      when coalesce(c->>'status','') not in ('completed','unknown') or c->>'disposition'='ignore' then 'lifecycle_not_completed'
      when source_state->>'blocked'='true' or (s.schema_version=3 and source_state->>'eligible' is distinct from 'true') then 'source_proof_required'
      when i.amount_minor is null or i.amount_minor>=0 or abs(i.amount_minor) is distinct from (c->>'amountMinor')::bigint
        or i.currency_code is null or btrim(i.currency_code::text) is distinct from c->>'currency' then 'amount_invalid'
      when (coalesce(c->'reasonCodes','[]'::jsonb)-array['card_repayment_requires_transfer','ambiguous_account','source_untrusted','rollout_review','action_unknown','date_ambiguous'])<>'[]'::jsonb then 'invalid_input'
    end;
    if reason is null then
      -- Source and reference reservations are immutable. Only their primary can
      -- offer a transfer. A subsequent observation cannot authorize another one.
      if i.canonical_identity_hash is null then
        reservation:=private.reserve_tracking_capture(i.id,p_fence_token);
      else
        select jsonb_build_object('primaryItemId',primary_item_id,'transactionId',transaction_id)
          into reservation from private.tracking_capture_reservations where user_id=i.user_id and identity_hash=i.canonical_identity_hash;
      end if;
      if reservation->>'primaryItemId' is distinct from i.id::text or reservation->>'transactionId' is not null
        or reservation->>'conflict'='true' then reason:='identity_conflict'; end if;
    end if;
    if reason is null and s.schema_version=3 then
      select case when x.normalized_payload->>'providerReferenceDigest'=i.normalized_payload->>'providerReferenceDigest'
        then 'identity_conflict' else 'correlation_unresolved' end into reason
      from public.import_items x where x.user_id=i.user_id and x.id<>i.id
        and x.status in ('review','accepted') and x.canonical_identity_hash is not null
        and x.amount_minor=i.amount_minor and x.currency_code=i.currency_code
        and x.normalized_payload#>>'{transport,deviceId}'=i.normalized_payload#>>'{transport,deviceId}'
        and x.normalized_payload#>>'{transport,channel}'<>i.normalized_payload#>>'{transport,channel}'
        and abs(extract(epoch from ((x.normalized_payload->>'receivedAt')::timestamptz-(i.normalized_payload->>'receivedAt')::timestamptz)))<=120
        and (x.normalized_payload->>'providerReferenceDigest'=i.normalized_payload->>'providerReferenceDigest'
          or (x.normalized_payload#>>'{classification,subtype}'='card_repayment' and
            (not (x.normalized_payload ? 'providerReferenceDigest') or not (i.normalized_payload ? 'providerReferenceDigest'))))
        and (private.tracking_nominal_source(x.id)->>'provider'=source_state->>'provider'
          or private.tracking_nominal_source(x.id)->>'provider'=private.tracking_nominal_source(x.id)->>'source'
          or source_state->>'provider'=source_state->>'source')
      order by (x.normalized_payload->>'providerReferenceDigest'=i.normalized_payload->>'providerReferenceDigest') desc nulls last
      limit 1;
    end if;
    if reason is not null and reason<>'correlation_unresolved' then
      update public.import_items set status='rejected',
        normalized_payload=normalized_payload||jsonb_build_object('diagnosticReason',reason) where id=i.id;
    else
      -- Similar reference-free observations retain independent identities. The
      -- owner can distinguish a second repayment in the existing duplicate review.
      perform private.create_review_item(i.id,case when reason='correlation_unresolved' then 'duplicate_candidate' else 'card_repayment_requires_transfer' end,
        (i.normalized_payload-array['accountId','destinationAccountId','categoryId'])||jsonb_build_object('kind','transfer'));
    end if;
  end loop;
  return private.prepare_import_session_before_card_repayment(p_session_id,p_fence_token);
end $$;
revoke all on function private.prepare_import_session(uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.prepare_import_session(uuid,uuid) to masarifi_worker;
reset role;
do $role$
begin
  if current_setting('masarifi.repayment_grant')='temporary' then
    execute format('revoke masarifi_migration from %I granted by %I',current_user,current_user);
  end if;
end
$role$;
