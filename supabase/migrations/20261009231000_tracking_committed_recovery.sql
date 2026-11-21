grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- A committed ledger effect is durable even if import acknowledgement was lost.
-- Recovery reads that immutable identity; it never executes a second command.
create function private.tracking_committed_capture(p_item_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with matches as (
    select t.id,t.reverses_transaction_id from public.import_items i
    join public.transactions t on t.user_id=i.user_id and t.source='tracking-import'
      and t.external_ref='tracking:'||i.canonical_identity_hash and t.status='confirmed' and t.deleted_at is null
    where i.id=p_item_id and i.canonical_identity_hash is not null
      and i.normalized_payload#>>'{classification,status}'='completed'
      and (private.tracking_capture_source_state(i.id)->>'trusted')::boolean
      and not (private.tracking_capture_source_state(i.id)->>'blocked')::boolean
      and t.amount_minor=abs(i.amount_minor) and t.currency_code=i.currency_code and t.fee_minor=0
      and t.kind=case when i.normalized_payload#>>'{classification,subtype}'='reversal' then 'reversal'
        when i.normalized_payload->>'kind'='fee' then 'expense' else i.normalized_payload->>'kind' end
      and case when t.kind='transfer' then
        (select count(*) from public.transaction_postings p where p.transaction_id=t.id)=2
        and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id and p.posting_role='source'
          and p.amount_minor=-t.amount_minor and p.account_id::text=case when i.normalized_payload#>>'{classification,direction}'='incoming'
            then i.normalized_payload->>'destinationAccountId' else i.normalized_payload->>'accountId' end)
        and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id and p.posting_role='destination'
          and p.amount_minor=t.amount_minor and p.account_id::text=case when i.normalized_payload#>>'{classification,direction}'='incoming'
            then i.normalized_payload->>'accountId' else i.normalized_payload->>'destinationAccountId' end)
      else (select count(*) from public.transaction_postings p where p.transaction_id=t.id)=1
        and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id
          and p.account_id::text=i.normalized_payload->>'accountId'
          and p.amount_minor=case when i.normalized_payload#>>'{classification,direction}'='incoming' then t.amount_minor else -t.amount_minor end) end
      and (t.kind not in ('refund','reversal') or exists(select 1 from public.import_items original
        where original.user_id=i.user_id and original.transaction_id=t.reverses_transaction_id and original.status='accepted'
          and original.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
          and i.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
          and original.normalized_payload->>'providerReferenceDigest'=i.normalized_payload->>'originalProviderReferenceDigest'
          and original.normalized_payload#>>'{transport,deviceId}'=i.normalized_payload#>>'{transport,deviceId}'
          and (private.tracking_capture_source_state(original.id)->>'trusted')::boolean
          and private.tracking_capture_source_state(original.id)->>'provider'=private.tracking_capture_source_state(i.id)->>'provider'))
  ) select case when count(*)=1 then jsonb_build_object('transactionId',min(id::text),'originalTransactionId',min(reverses_transaction_id::text)) else null end from matches;
$$;
revoke all on function private.tracking_committed_capture(uuid) from public;

alter function private.tracking_original_compensation(uuid) rename to tracking_original_compensation_fresh;
revoke all on function private.tracking_original_compensation_fresh(uuid) from public;
create function private.tracking_original_compensation(p_item_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce((select jsonb_build_object('originalTransactionId',t.id,'originalTransactionVersion',t.version)
    from public.transactions t where t.id::text=private.tracking_committed_capture(p_item_id)->>'originalTransactionId'),
    private.tracking_original_compensation_fresh(p_item_id));
$$;
revoke all on function private.tracking_original_compensation(uuid) from public;

alter function private.reserve_tracking_capture(uuid,uuid) rename to reserve_tracking_capture_identity;
revoke all on function private.reserve_tracking_capture_identity(uuid,uuid) from public,masarifi_worker;
create function private.reserve_tracking_capture(p_item_id uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; committed jsonb; current_item public.import_items; prior public.import_items; review public.review_items; session_source text;
begin
  result:=private.reserve_tracking_capture_identity(p_item_id,p_fence);
  select * into current_item from public.import_items where id=p_item_id;
  if (result->>'conflict')::boolean then return result; end if;
  committed:=private.tracking_committed_capture(p_item_id);
  if committed is not null then return result||committed; end if;
  if result->>'transactionId' is not null or result->>'primaryItemId'=p_item_id::text
    or private.tracking_capture_exception(p_item_id) is not null or not private.tracking_capture_auto_enabled(p_item_id) then return result; end if;
  select * into prior from public.import_items where id=(result->>'primaryItemId')::uuid and user_id=current_item.user_id for update;
  select * into review from public.review_items where import_item_id=prior.id and status='pending' and decision_token is null
    and reason='lifecycle_not_completed' for update;
  if prior.status='review' and review.id is not null and prior.transaction_id is null
    and prior.normalized_payload#>>'{classification,status}'='pending'
    and (private.tracking_capture_source_state(prior.id)->>'trusted')::boolean
    and (private.tracking_capture_source_state(current_item.id)->>'trusted')::boolean
    and not (private.tracking_capture_source_state(prior.id)->>'blocked')::boolean
    and private.tracking_capture_source_state(prior.id)->>'provider'=private.tracking_capture_source_state(current_item.id)->>'provider'
    and prior.normalized_payload#>>'{transport,deviceId}'=current_item.normalized_payload#>>'{transport,deviceId}'
    and prior.created_at>=clock_timestamp()-interval '24 hours'
    and abs(prior.amount_minor)=abs(current_item.amount_minor) and prior.currency_code=current_item.currency_code
    and private.tracking_capture_effect_key(prior.normalized_payload)=private.tracking_capture_effect_key(current_item.normalized_payload)
    and private.tracking_effect_family(prior.normalized_payload)=private.tracking_effect_family(current_item.normalized_payload)
    and prior.normalized_payload#>>'{classification,direction}'=current_item.normalized_payload#>>'{classification,direction}'
    and ((prior.normalized_payload#>>'{transport,channel}'=current_item.normalized_payload#>>'{transport,channel}'
      and prior.normalized_payload#>>'{transport,nativeIdDigest}'=current_item.normalized_payload#>>'{transport,nativeIdDigest}')
      or (prior.normalized_payload ? 'providerReferenceDigest' and current_item.normalized_payload ? 'providerReferenceDigest'
        and prior.normalized_payload->>'providerReferenceDigest'=current_item.normalized_payload->>'providerReferenceDigest'
        and coalesce(prior.normalized_payload#>>'{metadata,referenceScheme}','legacy')=coalesce(current_item.normalized_payload#>>'{metadata,referenceScheme}','legacy'))) then
    update private.tracking_capture_reservations set primary_item_id=p_item_id where user_id=current_item.user_id and identity_hash=result->>'identityHash' and transaction_id is null;
    update public.review_items set status='rejected',reviewed_at=clock_timestamp() where id=review.id;
    update public.import_items set status='rejected' where id=prior.id;
    update public.import_items set normalized_payload=normalized_payload||jsonb_build_object('supersedesItemId',prior.id) where id=p_item_id;
    select source_type into session_source from public.import_sessions where id=prior.session_id;
    insert into public.tracking_history(user_id,source_type,source_ref,outcome,reason_codes,review_item_id)
      values(prior.user_id,session_source,prior.id::text,'ignored',array['lifecycle_superseded'],review.id);
    perform private.enqueue_outbox_event('import.item.changed.v1','import-item',prior.id,jsonb_build_object('itemId',prior.id,'status','rejected','supersededByItemId',p_item_id,'occurredAt',clock_timestamp()));
    result:=result||jsonb_build_object('primaryItemId',p_item_id);
  end if;
  return result;
end $$;
revoke all on function private.reserve_tracking_capture(uuid,uuid) from public;
grant execute on function private.reserve_tracking_capture(uuid,uuid) to masarifi_worker;

-- Reservation may recover an already committed compensation or promote a
-- lifecycle revision. Recompute eligibility after that atomic step.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.prepare_import_session(uuid,uuid)'::regprocedure);
  updated:=replace(definition,'if reason is not null then perform private.create_review_item',
    'reason:=private.tracking_capture_exception(i.id); if reason is not null then perform private.create_review_item');
  if updated=definition then raise exception 'TRACKING_RECOVERY_MIGRATION_PRECONDITION'; end if;
  execute updated;
end $migration$;

alter function private.compute_duplicate_candidates(uuid) rename to compute_duplicate_candidates_fresh;
revoke all on function private.compute_duplicate_candidates_fresh(uuid) from public,masarifi_api,masarifi_worker;
create function private.compute_duplicate_candidates(p_import_item_id uuid) returns setof public.duplicate_candidates
language plpgsql security definer set search_path='' as $$
begin
  if private.tracking_committed_capture(p_import_item_id) is not null then return; end if;
  return query select * from private.compute_duplicate_candidates_fresh(p_import_item_id);
end $$;
revoke all on function private.compute_duplicate_candidates(uuid) from public;
grant execute on function private.compute_duplicate_candidates(uuid) to masarifi_worker;

-- The engagement worker deliberately has no direct SELECT on ledger tables.
create function private.is_tracking_notification_capture(p_user_id text,p_transaction_id text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.transactions t where t.user_id=p_user_id and t.id::text=p_transaction_id
    and t.source='tracking-import' and t.status='confirmed' and t.deleted_at is null);
$$;
revoke all on function private.is_tracking_notification_capture(text,text) from public;
grant execute on function private.is_tracking_notification_capture(text,text) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
