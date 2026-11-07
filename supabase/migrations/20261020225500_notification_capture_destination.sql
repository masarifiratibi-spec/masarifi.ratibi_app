grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

alter function private.tracking_nominal_exception(uuid) rename to tracking_nominal_exception_before_notification_destination;
revoke all on function private.tracking_nominal_exception_before_notification_destination(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;

-- Equal source evidence cannot authorize two postings in different destinations.
-- Keep a conflict pending rather than invent a currency conversion or merge.
create function private.tracking_nominal_exception(p_item_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; reason text; default_destination text; destination text; state jsonb;
begin
  reason:=private.tracking_nominal_exception_before_notification_destination(p_item_id);
  if reason is not null then return reason; end if;
  select * into i from public.import_items where id=p_item_id;
  if i.normalized_payload#>>'{metadata,sourceAdmissionPolicy}' is distinct from 'financial_content_v1' then return null; end if;
  select id::text into default_destination from public.accounts where user_id=i.user_id and is_default
    and status='active' and deleted_at is null and automatic_tracking_enabled;
  destination:=coalesce(i.normalized_payload->>'accountId',default_destination);
  if destination is null then return null; end if;
  state:=private.tracking_nominal_source(i.id);
  if exists(select 1 from public.import_items other join public.import_sessions s on s.id=other.session_id
    where other.user_id=i.user_id and other.id<>i.id and s.schema_version=3 and other.status in ('parsed','accepted')
      and other.normalized_payload->>'accountingPolicy'='default_account_nominal_v1'
      and other.normalized_payload#>>'{metadata,sourceAdmissionPolicy}'='financial_content_v1'
      and (other.normalized_payload->>'providerReferenceDigest' is null or i.normalized_payload->>'providerReferenceDigest' is null
        or (other.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2' and i.normalized_payload#>>'{metadata,referenceScheme}'='plain-v2'
          and other.normalized_payload->>'providerReferenceDigest'=i.normalized_payload->>'providerReferenceDigest'))
      and other.normalized_payload#>>'{transport,deviceId}'=i.normalized_payload#>>'{transport,deviceId}'
      and other.normalized_payload#>>'{transport,channel}'<>i.normalized_payload#>>'{transport,channel}'
      and ((i.normalized_payload#>>'{transport,channel}'='android_notification' and i.normalized_payload#>>'{metadata,notificationAccountId}' is not null)
        or (other.normalized_payload#>>'{transport,channel}'='android_notification' and other.normalized_payload#>>'{metadata,notificationAccountId}' is not null))
      and coalesce(other.normalized_payload->>'accountId',default_destination) is not null
      and coalesce(other.normalized_payload->>'accountId',default_destination)<>destination
      and private.tracking_nominal_exception_before_notification_destination(other.id) is null
      and (other.normalized_payload->>'sourceAmountDecimal')::numeric=(i.normalized_payload->>'sourceAmountDecimal')::numeric
      and (other.normalized_payload#>>'{classification,currency}' is null or i.normalized_payload#>>'{classification,currency}' is null
        or other.normalized_payload#>>'{classification,currency}'=i.normalized_payload#>>'{classification,currency}')
      and private.tracking_capture_effect_key(other.normalized_payload)=private.tracking_capture_effect_key(i.normalized_payload)
      and private.tracking_effect_family(other.normalized_payload)=private.tracking_effect_family(i.normalized_payload)
      and coalesce(other.normalized_payload#>>'{metadata,movementComponent}','single')=coalesce(i.normalized_payload#>>'{metadata,movementComponent}','single')
      and (nullif(btrim(other.normalized_payload#>>'{classification,merchant}'),'') is null or nullif(btrim(i.normalized_payload#>>'{classification,merchant}'),'') is null
        or lower(btrim(other.normalized_payload#>>'{classification,merchant}'))=lower(btrim(i.normalized_payload#>>'{classification,merchant}')))
      and (state->>'provider'=state->>'source' or private.tracking_nominal_source(other.id)->>'provider'=private.tracking_nominal_source(other.id)->>'source'
        or state->>'provider'=private.tracking_nominal_source(other.id)->>'provider')
      and abs(extract(epoch from((other.normalized_payload->>'receivedAt')::timestamptz-(i.normalized_payload->>'receivedAt')::timestamptz)))<=120)
    then return 'notification_destination_conflict'; end if;
  return null;
end $$;
revoke all on function private.tracking_nominal_exception(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;

alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_notification_destination;
revoke all on function private.finalize_import_session_before_notification_destination(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;

-- A notification may name a destination; ownership, currency, amount and posting
-- kind are resolved here. SMS retains the existing nominal default-account path.
create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; i public.import_items; a public.accounts;
  destination text; scale integer; amount numeric; posting_kind text; category uuid;
begin
  select * into s from public.import_sessions where id=p_session_id;
  if s.schema_version=3 then perform pg_advisory_xact_lock(hashtextextended(s.user_id,0)); end if;
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token
    and lease_until>clock_timestamp() and status='processing' for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version=3 then
    for i in select * from public.import_items where session_id=s.id and status='parsed'
      and normalized_payload->>'accountingPolicy'='default_account_nominal_v1'
      and normalized_payload#>>'{transport,channel}'='android_notification'
      and normalized_payload#>>'{metadata,sourceAdmissionPolicy}'='financial_content_v1'
      and normalized_payload#>>'{metadata,notificationAccountId}' is not null order by id for update loop
      destination:=i.normalized_payload#>>'{metadata,notificationAccountId}';
      if destination !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
        update public.import_items set status='rejected',normalized_payload=normalized_payload||'{"diagnosticReason":"notification_account_invalid"}'::jsonb where id=i.id;
        continue;
      end if;
      select * into a from public.accounts where id=destination::uuid and user_id=i.user_id
        and status='active' and deleted_at is null and automatic_tracking_enabled and currency_code=i.currency_code for share;
      -- Retain an unavailable destination as blocked; never silently use the default.
      if a.id is null then
        update public.import_items set normalized_payload=normalized_payload||jsonb_build_object('accountId',destination) where id=i.id;
        continue;
      end if;
      select minor_unit into scale from public.currencies where code=a.currency_code and enabled;
      amount:=(i.normalized_payload->>'sourceAmountDecimal')::numeric*power(10::numeric,scale);
      if amount is null or amount<>trunc(amount) or amount not between 1 and 9007199254740991 then
        update public.import_items set status='rejected',normalized_payload=normalized_payload||'{"diagnosticReason":"amount_precision_invalid"}'::jsonb where id=i.id;
        continue;
      end if;
      posting_kind:=case when i.normalized_payload#>>'{classification,direction}'='incoming' then 'income' else 'expense' end;
      category:=null;
      select c.category_id into category from public.category_rules c join public.categories cat on cat.id=c.category_id
        and cat.kind=posting_kind and cat.active and cat.deleted_at is null and (cat.user_id is null or cat.user_id=i.user_id)
        where c.active and (c.user_id is null or c.user_id=i.user_id) and strpos(lower(coalesce(i.merchant,'')),lower(c.pattern))>0
        order by c.user_id nulls last,c.priority,c.id limit 1;
      if category is null and posting_kind='expense' then
        select id into category from public.categories where id='04000000-0000-4000-8000-000000000006'
          and kind='expense' and active and deleted_at is null and (user_id is null or user_id=i.user_id);
      end if;
      update public.import_items set amount_minor=case when posting_kind='income' then amount::bigint else -amount::bigint end,
        normalized_payload=normalized_payload||jsonb_strip_nulls(jsonb_build_object('accountId',a.id,'kind',posting_kind,
          'currency',btrim(a.currency_code::text),'amountMinor',case when posting_kind='income' then amount::bigint else -amount::bigint end,'categoryId',category)) where id=i.id;
    end loop;
  end if;
  return private.finalize_import_session_before_notification_destination(p_session_id,p_fence_token);
end $$;
revoke all on function private.finalize_import_session(uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.finalize_import_session(uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
