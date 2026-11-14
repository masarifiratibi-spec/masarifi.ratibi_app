grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- Existing clients/cohorts keep their policy until explicitly enabled for DEV.
alter table private.tracking_automatic_cohorts add column currency_account_policy text not null
  default 'default_account_nominal_v1' check(currency_account_policy in ('default_account_nominal_v1','source_currency_v1'));

create function private.tracking_currency_destination(p_item uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; cohort private.tracking_automatic_cohorts; account public.accounts;
  currency text; preferred text; admitted text; candidates uuid[]; scale integer; amount numeric;
begin
  select * into i from public.import_items where id=p_item;
  select * into cohort from private.tracking_content_cohort(i.user_id,i.normalized_payload#>>'{transport,deviceId}');
  if cohort.currency_account_policy is distinct from 'source_currency_v1'
    or i.normalized_payload->>'accountingPolicy' is distinct from 'default_account_nominal_v1'
    or i.normalized_payload#>>'{metadata,sourceAdmissionPolicy}' is distinct from 'financial_content_v1'
    then return '{"enabled":false}'::jsonb; end if;
  currency:=i.normalized_payload#>>'{classification,currency}';
  if currency is null then return '{"enabled":true,"reason":"source_currency_required"}'::jsonb; end if;
  select minor_unit into scale from public.currencies where code=currency and enabled;
  if scale is null then return '{"enabled":true,"reason":"source_currency_unsupported"}'::jsonb; end if;
  amount:=(i.normalized_payload->>'sourceAmountDecimal')::numeric*power(10::numeric,scale);
  if amount is null or amount<>trunc(amount) or amount not between 1 and 9007199254740991
    then return '{"enabled":true,"reason":"source_currency_precision_invalid"}'::jsonb; end if;
  -- API v3 forbids accountId; this field is assigned by server admission only.
  admitted:=i.normalized_payload->>'accountId';
  if admitted is not null then
    select * into account from public.accounts where id=admitted::uuid and user_id=i.user_id and currency_code=currency;
    if account.id is not null then
      if account.status<>'active' or account.deleted_at is not null or not account.automatic_tracking_enabled
        then return '{"enabled":true,"reason":"source_currency_account_invalid"}'::jsonb; end if;
      return jsonb_build_object('enabled',true,'accountId',account.id,'currency',currency,'amountMinor',amount::bigint);
    end if;
  end if;
  preferred:=i.normalized_payload#>>'{metadata,preferredAccountId}';
  if preferred is not null then
    if preferred !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
      then return '{"enabled":true,"reason":"source_currency_account_invalid"}'::jsonb; end if;
    select * into account from public.accounts where id=preferred::uuid and user_id=i.user_id
      and status='active' and deleted_at is null and automatic_tracking_enabled;
    if account.id is null then return '{"enabled":true,"reason":"source_currency_account_invalid"}'::jsonb; end if;
    -- Viewing a different currency cannot redirect this movement to that account.
    if btrim(account.currency_code::text)<>currency then account:=null; end if;
  end if;
  if account.id is null then
    select * into account from public.accounts where user_id=i.user_id and is_default
      and status='active' and deleted_at is null and automatic_tracking_enabled and currency_code=currency;
  end if;
  if account.id is null then
    select array_agg(id order by created_at,id) into candidates from public.accounts where user_id=i.user_id
      and status='active' and deleted_at is null and automatic_tracking_enabled and currency_code=currency;
    if coalesce(cardinality(candidates),0)=0 then return '{"enabled":true,"reason":"source_currency_account_required"}'::jsonb; end if;
    if cardinality(candidates)>1 then return '{"enabled":true,"reason":"source_currency_account_ambiguous"}'::jsonb; end if;
    select * into account from public.accounts where id=candidates[1];
  end if;
  return jsonb_build_object('enabled',true,'accountId',account.id,'currency',currency,'amountMinor',amount::bigint);
end $$;
revoke all on function private.tracking_currency_destination(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;

alter function private.get_tracking_device_rule_snapshot(text,text) rename to get_tracking_device_rule_snapshot_before_currency_accounts;
revoke all on function private.get_tracking_device_rule_snapshot_before_currency_accounts(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.get_tracking_device_rule_snapshot(p_user_id text,p_device_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare configuration jsonb; policy text;
begin
  configuration:=private.get_tracking_device_rule_snapshot_before_currency_accounts(p_user_id,p_device_id);
  select currency_account_policy into policy from private.tracking_content_cohort(p_user_id,p_device_id);
  return configuration||case when policy='source_currency_v1' then '{"currencyAccountPolicy":"source_currency_v1"}'::jsonb else '{}'::jsonb end;
end $$;
revoke all on function private.get_tracking_device_rule_snapshot(text,text) from public,anon,authenticated,masarifi_worker;
grant execute on function private.get_tracking_device_rule_snapshot(text,text) to masarifi_api;

alter function private.tracking_nominal_exception(uuid) rename to tracking_nominal_exception_before_currency_accounts;
revoke all on function private.tracking_nominal_exception_before_currency_accounts(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
-- Extend the deployed source-evidence guard across policy transitions in either arrival order.
create or replace function private.tracking_nominal_exception_before_currency_accounts(p_item_id uuid) returns text
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
      and ((exists(select 1 from private.tracking_content_cohort(i.user_id,i.normalized_payload#>>'{transport,deviceId}') c where c.currency_account_policy='source_currency_v1'))
        or (i.normalized_payload#>>'{transport,channel}'='android_notification' and i.normalized_payload#>>'{metadata,notificationAccountId}' is not null)
        or (other.normalized_payload#>>'{transport,channel}'='android_notification' and other.normalized_payload#>>'{metadata,notificationAccountId}' is not null))
      and coalesce(other.normalized_payload->>'accountId',default_destination) is not null
      and coalesce(other.normalized_payload->>'accountId',default_destination)<>destination
      -- A committed observation remains duplicate evidence after account opt-out.
      and (other.status='accepted' or private.tracking_nominal_exception_before_notification_destination(other.id) is null)
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

create function private.tracking_nominal_exception(p_item_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare destination jsonb; i public.import_items;
begin
  destination:=private.tracking_currency_destination(p_item_id);
  if coalesce((destination->>'enabled')::boolean,false) then
    if destination->>'reason' is not null then return destination->>'reason'; end if;
    select * into i from public.import_items where id=p_item_id;
    if i.normalized_payload->>'accountId' is distinct from destination->>'accountId'
      or btrim(i.currency_code::text) is distinct from destination->>'currency' then return 'source_currency_account_unresolved'; end if;
  end if;
  return private.tracking_nominal_exception_before_currency_accounts(p_item_id);
end $$;
revoke all on function private.tracking_nominal_exception(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;

alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_currency_accounts;
revoke all on function private.finalize_import_session_before_currency_accounts(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; i public.import_items; destination jsonb; posting_kind text; category uuid; label text;
begin
  select * into s from public.import_sessions where id=p_session_id;
  if s.schema_version=3 then perform pg_advisory_xact_lock(hashtextextended(s.user_id,0)); end if;
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token
    and lease_until>clock_timestamp() and status='processing' for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version=3 then
    for i in select * from public.import_items where session_id=s.id and status='parsed' order by id for update loop
      destination:=private.tracking_currency_destination(i.id);
      if coalesce((destination->>'enabled')::boolean,false) then
        if destination->>'reason' is null then
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
          update public.import_items set currency_code=destination->>'currency',
            amount_minor=case when posting_kind='income' then (destination->>'amountMinor')::bigint else -(destination->>'amountMinor')::bigint end,
            normalized_payload=jsonb_set(normalized_payload,'{metadata}',coalesce(normalized_payload->'metadata','{}'::jsonb)-'notificationAccountId')||
              jsonb_strip_nulls(jsonb_build_object('accountId',destination->>'accountId','currency',destination->>'currency','kind',posting_kind,'categoryId',category,
                'amountMinor',case when posting_kind='income' then (destination->>'amountMinor')::bigint else -(destination->>'amountMinor')::bigint end))
            where id=i.id returning * into i;
        end if;
      end if;
      label:=nullif(btrim(i.normalized_payload#>>'{metadata,sourceDisplayName}'),'');
      if label is null and i.normalized_payload#>>'{transport,channel}'='android_sms' then label:=nullif(btrim(i.normalized_payload->>'sender'),''); end if;
      if label is not null and char_length(label)<=100 and label !~ '[[:cntrl:]]|https?://|[0-9]{4,}'
        and i.normalized_payload#>>'{metadata,sourceAdmissionPolicy}'='financial_content_v1' then
        update public.import_items set merchant=coalesce(nullif(merchant,''),label),
          normalized_payload=normalized_payload||jsonb_build_object('title',label,'merchant',coalesce(nullif(merchant,''),label)) where id=i.id;
      end if;
    end loop;
  end if;
  return private.finalize_import_session_before_currency_accounts(p_session_id,p_fence_token);
end $$;
revoke all on function private.finalize_import_session(uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.finalize_import_session(uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
