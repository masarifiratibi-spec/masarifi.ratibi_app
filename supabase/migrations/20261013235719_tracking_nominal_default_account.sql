grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- User tombstones remain in the unique phrase index, so automatic seeding
-- cannot resurrect a deleted default. Published lifecycle safety is separate.
alter table public.user_keyword_rules add column deleted_at timestamptz;
alter function private.delete_keyword_rule(text,uuid,bigint) rename to delete_keyword_rule_before_nominal;
revoke all on function private.delete_keyword_rule_before_nominal(text,uuid,bigint) from public,masarifi_api;
create function private.delete_keyword_rule(p_user_id text,p_id uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare r public.user_keyword_rules;
begin
  perform private.assert_active_profile(p_user_id);
  select * into r from public.user_keyword_rules where user_id=p_user_id and id=p_id for update;
  if r.id is null or r.version is distinct from p_expected_version then raise exception using errcode='40001',message='TRACKING_RULE_CONFLICT'; end if;
  if r.origin<>'default' then perform private.delete_keyword_rule_before_nominal(p_user_id,p_id,p_expected_version); return; end if;
  update public.user_keyword_rules set enabled=false,deleted_at=clock_timestamp() where id=r.id;
  perform private.enqueue_outbox_event('tracking.rule.changed.v1','tracking-rule',r.id,jsonb_build_object('ruleKind','keyword','ruleId',r.id,'action','deleted','occurredAt',clock_timestamp()));
  perform audit.append_event(p_user_id,'user','tracking.keyword-rule-deleted','tracking_rule',r.id::text,null,null,null,private.tracking_request_id(),jsonb_build_object('scope','user-default','version',r.version));
end $$;
revoke all on function private.delete_keyword_rule(text,uuid,bigint) from public;
grant execute on function private.delete_keyword_rule(text,uuid,bigint) to masarifi_api;

alter function private.upsert_keyword_rule(text,uuid,text,text,text,text,uuid,integer,boolean,bigint) rename to upsert_keyword_rule_before_nominal;
revoke all on function private.upsert_keyword_rule_before_nominal(text,uuid,text,text,text,text,uuid,integer,boolean,bigint) from public,masarifi_api;
create function private.upsert_keyword_rule(p_user_id text,p_id uuid,p_keyword text,p_group_key text,p_language_code text,p_match_type text,p_category_id uuid,p_priority integer,p_enabled boolean,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.user_keyword_rules;
begin
  perform private.assert_active_profile(p_user_id);
  if p_id is null then
    select * into prior from public.user_keyword_rules where user_id=p_user_id and lower(keyword)=lower(btrim(p_keyword)) and match_type=p_match_type and deleted_at is not null for update;
    if prior.id is not null then
      update public.user_keyword_rules set deleted_at=null where id=prior.id returning * into prior;
      return private.upsert_keyword_rule_before_nominal(p_user_id,prior.id,prior.keyword,prior.group_key,prior.language_code,prior.match_type,prior.category_id,prior.priority,p_enabled,prior.version);
    end if;
  end if;
  return private.upsert_keyword_rule_before_nominal(p_user_id,p_id,p_keyword,p_group_key,p_language_code,p_match_type,p_category_id,p_priority,p_enabled,p_expected_version);
end $$;
revoke all on function private.upsert_keyword_rule(text,uuid,text,text,text,text,uuid,integer,boolean,bigint) from public;
grant execute on function private.upsert_keyword_rule(text,uuid,text,text,text,text,uuid,integer,boolean,bigint) to masarifi_api;

alter table public.import_sessions drop constraint import_sessions_schema_version_check;
alter table public.import_sessions add constraint import_sessions_schema_version_check check(schema_version in (1,2,3));

-- Extend the existing intake, without transforming old sessions or queues.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('private.create_import_session(text,text,text,integer,text,jsonb)'::regprocedure);
  if position('p_schema_version not in (1,2)' in definition)=0 then raise exception 'TRACKING_NOMINAL_INTAKE_PRECONDITION'; end if;
  execute replace(definition,'p_schema_version not in (1,2)','p_schema_version not in (1,2,3)');
end $migration$;

-- A new nullable column must not change legacy snapshot hashes and strand
-- queued/offline v2 captures. Disabled tombstones stay in the override list.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('private.get_tracking_rule_snapshot_base(text)'::regprocedure);
  if position('to_jsonb(k)-''user_id''' in definition)=0 then raise exception 'TRACKING_LEGACY_SNAPSHOT_PRECONDITION'; end if;
  execute replace(definition,'to_jsonb(k)-''user_id''','to_jsonb(k)-''user_id''-''deleted_at''');
end $migration$;
alter function private.get_tracking_rule_snapshot(text) rename to get_tracking_rule_snapshot_before_nominal;
revoke all on function private.get_tracking_rule_snapshot_before_nominal(text) from public,masarifi_api;
create function private.get_tracking_rule_snapshot(p_user_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select private.get_tracking_rule_snapshot_before_nominal(p_user_id)||jsonb_build_object('accountingPolicy','default_account_nominal_v1');
$$;
revoke all on function private.get_tracking_rule_snapshot(text) from public;
grant execute on function private.get_tracking_rule_snapshot(text) to masarifi_api;

create function private.tracking_nominal_source(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; state jsonb; known boolean; institution uuid;
begin
  select * into i from public.import_items where id=p_item_id;
  state:=private.tracking_capture_source_state(p_item_id);
  if state->>'source' in ('com.whatsapp','com.whatsapp.w4b','org.telegram.messenger','org.telegram.messenger.web','com.facebook.orca','com.facebook.mlite','com.discord','com.snapchat.android','com.instagram.android','com.google.android.apps.messaging','com.samsung.android.messaging') then
    return state||jsonb_build_object('eligible',false,'blocked',true);
  end if;
  select exists(select 1 from public.tracking_rule_channels c join public.tracking_rule_releases r on r.id=c.release_id and r.status='published'
    cross join lateral jsonb_array_elements(r.snapshot->'providers') provider
    cross join lateral jsonb_array_elements_text(case when i.normalized_payload#>>'{transport,channel}'='android_notification' then provider->'packages' else provider->'senders' end) identity(value)
    where c.environment='default' and c.market='global' and c.channel='all' and regexp_replace(lower(identity.value),'\s+','','g')=state->>'source') into known;
  select d.institution_id into institution from public.user_sender_rules d where d.user_id=i.user_id and d.enabled and d.trusted and regexp_replace(lower(d.sender_pattern),'\s+','','g')=state->>'source' limit 1;
  return state||jsonb_build_object('eligible',not (state->>'blocked')::boolean and (known or (state->>'trusted')::boolean))
    ||case when institution is null then '{}'::jsonb else jsonb_build_object('provider','institution:'||institution::text) end;
end $$;

create function private.tracking_nominal_exception(p_item_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; source jsonb; a public.accounts; reason text;
begin
  select * into i from public.import_items where id=p_item_id;
  if i.normalized_payload->>'accountingPolicy'<>'default_account_nominal_v1' then return 'invalid_input'; end if;
  if i.normalized_payload#>>'{metadata,movementComponent}' is not null and (
    i.normalized_payload#>>'{metadata,movementComponent}' not in ('principal','fee') or
    (i.normalized_payload#>>'{metadata,movementComponent}'='fee') is distinct from (i.normalized_payload#>>'{classification,subtype}'='fee')
  ) then return 'invalid_movement_component'; end if;
  source:=private.tracking_nominal_source(i.id);
  if not coalesce((source->>'eligible')::boolean,false) then return 'source_proof_required'; end if;
  if i.normalized_payload#>>'{classification,status}'<>'completed' or i.normalized_payload#>>'{classification,disposition}'='ignore' then return 'lifecycle_not_completed'; end if;
  if i.normalized_payload#>>'{classification,direction}' not in ('incoming','outgoing') then return 'conflicting_direction'; end if;
  if i.normalized_payload->>'sourceAmountDecimal' !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,3})?$' or (i.normalized_payload->>'sourceAmountDecimal')::numeric<=0 then return 'amount_invalid'; end if;
  if (i.normalized_payload->>'activatedAt')::timestamptz>(i.normalized_payload->>'receivedAt')::timestamptz then return 'before_activation'; end if;
  -- Capture configuration is immutable provenance. Mutable default-account
  -- changes must not strand an already admitted offline movement. The active
  -- release, current source exclusions and rollout are still revalidated below.
  if coalesce(i.normalized_payload#>>'{metadata,ruleConfigurationRevision}','') !~ '^[a-f0-9]{64}$' then return 'configuration_stale'; end if;
  select value into reason from jsonb_array_elements_text(i.normalized_payload#>'{classification,reasonCodes}') where value not in
    ('credit_origin_required','cash_destination_required','transfer_counterparty_required','original_transaction_required','unsupported_currency','amount_missing','amount_invalid') limit 1;
  if reason is not null then return reason; end if;
  if not private.tracking_capture_auto_enabled(i.id) then return 'automatic_not_activated'; end if;
  if i.normalized_payload ? 'accountId' then
    select * into a from public.accounts where id=(i.normalized_payload->>'accountId')::uuid and user_id=i.user_id and status='active' and deleted_at is null and automatic_tracking_enabled;
    if a.id is null or a.currency_code<>i.currency_code then return 'account_tracking_blocked'; end if;
  end if;
  return null;
end $$;

alter function private.reserve_tracking_capture(uuid,uuid) rename to reserve_tracking_capture_before_nominal;
revoke all on function private.reserve_tracking_capture_before_nominal(uuid,uuid) from public,masarifi_worker;
create function private.reserve_tracking_capture(p_item_id uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; state jsonb; proof text; hash text; r private.tracking_capture_reservations; committed uuid;
begin
  select x.* into i from public.import_items x join public.import_sessions s on s.id=x.session_id
    where x.id=p_item_id and x.status='parsed' and s.claim_token=p_fence and s.lease_until>clock_timestamp() for update of x;
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if i.normalized_payload->>'accountingPolicy' is distinct from 'default_account_nominal_v1' then return private.reserve_tracking_capture_before_nominal(p_item_id,p_fence); end if;
  state:=private.tracking_nominal_source(i.id);
  if not coalesce((state->>'eligible')::boolean,false) then raise exception 'TRACKING_SOURCE_BLOCKED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(i.user_id||'|nominal|'||(state->>'provider'),0));
  proof:=case when i.normalized_payload ? 'providerReferenceDigest' then concat_ws('|','reference-verified',state->>'provider',i.normalized_payload->>'providerReferenceDigest',private.tracking_capture_effect_key(i.normalized_payload),private.tracking_effect_family(i.normalized_payload))
    else concat_ws('|','nominal-transport',i.normalized_payload#>>'{transport,deviceId}',i.normalized_payload#>>'{transport,channel}',i.normalized_payload#>>'{transport,nativeIdDigest}',case when i.normalized_payload#>>'{transport,channel}'='android_notification' then i.normalized_payload->>'receivedAt' end,coalesce(i.normalized_payload#>>'{metadata,movementComponent}','single')) end;
  hash:=encode(extensions.digest(convert_to(proof,'UTF8'),'sha256'),'hex');
  insert into private.tracking_capture_reservations(user_id,identity_hash,primary_item_id) values(i.user_id,hash,i.id) on conflict do nothing;
  select * into r from private.tracking_capture_reservations where user_id=i.user_id and identity_hash=hash for update;
  update public.import_items set canonical_identity_hash=hash where id=i.id;
  select t.id into committed from public.transactions t where t.user_id=i.user_id and t.external_ref='tracking:'||hash and t.source='tracking-import' and t.status='confirmed' and t.deleted_at is null;
  return jsonb_build_object('identityHash',hash,'primaryItemId',r.primary_item_id,'transactionId',coalesce(r.transaction_id,committed),'conflict',exists(select 1 from public.import_items x where x.id=r.primary_item_id and
    (abs(x.amount_minor) is distinct from abs(i.amount_minor) or x.currency_code is distinct from i.currency_code or x.normalized_payload->>'accountId' is distinct from i.normalized_payload->>'accountId' or private.tracking_capture_effect_key(x.normalized_payload) is distinct from private.tracking_capture_effect_key(i.normalized_payload))));
end $$;

alter function private.prepare_import_session(uuid,uuid) rename to prepare_import_session_before_nominal;
revoke all on function private.prepare_import_session_before_nominal(uuid,uuid) from public,masarifi_worker;
create function private.prepare_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version<>3 then return private.prepare_import_session_before_nominal(p_session_id,p_fence_token); end if;
  return jsonb_build_object('sessionId',s.id,'parserItems','[]'::jsonb);
end $$;

alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_nominal;
revoke all on function private.finalize_import_session_before_nominal(uuid,uuid) from public,masarifi_worker;
create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; i public.import_items; a public.accounts; scale integer; amount numeric; category uuid; posting_kind text; reason text; reservation jsonb; items jsonb:='[]'; deferred integer:=0; state jsonb;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version<>3 then return private.finalize_import_session_before_nominal(p_session_id,p_fence_token); end if;
  for i in select * from public.import_items where session_id=s.id and status='parsed' order by id for update loop
    reason:=private.tracking_nominal_exception(i.id);
    if reason='lifecycle_not_completed' then
      update public.import_items set status='rejected',normalized_payload=normalized_payload||jsonb_build_object('diagnosticReason',reason) where id=i.id; continue;
    end if;
    if reason is null and not(i.normalized_payload ? 'accountId') then
      select * into a from public.accounts where user_id=i.user_id and is_default and status='active' and deleted_at is null and automatic_tracking_enabled for share;
      if a.id is null then reason:='default_account_unavailable'; else
        select minor_unit into scale from public.currencies where code=a.currency_code and enabled;
        amount:=(i.normalized_payload->>'sourceAmountDecimal')::numeric*power(10::numeric,scale);
        if amount is null or amount<>trunc(amount) or amount not between 1 and 9007199254740991 then reason:='amount_precision_invalid'; else
          posting_kind:=case when i.normalized_payload#>>'{classification,direction}'='incoming' then 'income' else 'expense' end;
          select c.category_id into category from public.category_rules c join public.categories cat on cat.id=c.category_id and cat.kind=posting_kind and cat.active and cat.deleted_at is null and (cat.user_id is null or cat.user_id=i.user_id)
            where c.active and (c.user_id is null or c.user_id=i.user_id) and strpos(lower(coalesce(i.merchant,'')),lower(c.pattern))>0 order by c.user_id nulls last,c.priority,c.id limit 1;
          if category is null and posting_kind='expense' then select id into category from public.categories where id='04000000-0000-4000-8000-000000000006' and kind='expense' and active and deleted_at is null and (user_id is null or user_id=i.user_id); end if;
          if category is null and posting_kind='expense' then reason:='shopping_category_unavailable'; else
            update public.import_items set amount_minor=case when posting_kind='income' then amount::bigint else -amount::bigint end,currency_code=a.currency_code,
              normalized_payload=normalized_payload||jsonb_strip_nulls(jsonb_build_object('accountId',a.id,'currency',btrim(a.currency_code::text),'amountMinor',case when posting_kind='income' then amount::bigint else -amount::bigint end,'kind',posting_kind,'categoryId',category)) where id=i.id returning * into i;
          end if;
        end if;
      end if;
    end if;
    if reason is null then
      reservation:=private.reserve_tracking_capture(i.id,p_fence_token);
      if (reservation->>'conflict')::boolean then reason:='identity_conflict'; end if;
      state:=private.tracking_nominal_source(i.id);
      if reason is null and reservation->>'transactionId' is null and reservation->>'primaryItemId'=i.id::text and not(i.normalized_payload ? 'providerReferenceDigest') and exists(
        select 1 from public.import_items x where x.user_id=i.user_id and x.id<>i.id and x.canonical_identity_hash is not null
          and (x.normalized_payload#>>'{transport,channel}'<>i.normalized_payload#>>'{transport,channel}' or
            (x.normalized_payload#>>'{transport,deviceId}'<>i.normalized_payload#>>'{transport,deviceId}' and
             x.normalized_payload#>>'{transport,revisionDigest}'=i.normalized_payload#>>'{transport,revisionDigest}') or
            (i.normalized_payload#>>'{transport,channel}'='android_notification' and x.normalized_payload#>>'{transport,nativeIdDigest}'=i.normalized_payload#>>'{transport,nativeIdDigest}'))
          and private.tracking_nominal_source(x.id)->>'provider'=state->>'provider'
          and abs(x.amount_minor)=abs(i.amount_minor) and x.currency_code=i.currency_code
          and private.tracking_capture_effect_key(x.normalized_payload)=private.tracking_capture_effect_key(i.normalized_payload)
          and private.tracking_effect_family(x.normalized_payload)=private.tracking_effect_family(i.normalized_payload)
          and abs(extract(epoch from(coalesce(x.occurred_at,(x.normalized_payload->>'receivedAt')::timestamptz)-coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz))))<=120) then reason:='correlation_unresolved'; end if;
    end if;
    if reason is not null then
      update public.import_items set normalized_payload=normalized_payload||jsonb_build_object('diagnosticReason',reason) where id=i.id;
      deferred:=deferred+1; continue;
    end if;
    items:=items||jsonb_build_array(jsonb_build_object('id',i.id,'userId',i.user_id,'values',i.normalized_payload||jsonb_build_object('occurredAt',coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz))));
  end loop;
  return jsonb_build_object('sessionId',s.id,'autoItems',items,'deferredCount',deferred);
end $$;

-- A cash default is authorized only by a matching v3 capture reservation.
-- Every other caller keeps the existing account-type and opt-in guard.
create or replace function private.guard_tracking_import_posting() returns trigger
language plpgsql security definer set search_path='' as $$
declare t public.transactions; i public.import_items;
begin
  select * into t from public.transactions where id=new.transaction_id;
  if t.source='tracking-import' and not exists(select 1 from public.transaction_postings where transaction_id=t.id) then
    select x.* into i from public.import_items x join private.tracking_capture_reservations r on r.user_id=x.user_id and r.identity_hash=x.canonical_identity_hash
      where x.user_id=t.user_id and t.external_ref='tracking:'||x.canonical_identity_hash and x.normalized_payload->>'accountingPolicy'='default_account_nominal_v1' and x.status='parsed' and r.primary_item_id=x.id limit 1;
    if i.id is null then perform private.assert_automatic_tracking_account(t.user_id,new.account_id::text); else
      if private.tracking_nominal_exception(i.id) is not null or new.account_id::text is distinct from i.normalized_payload->>'accountId' or t.amount_minor<>abs(i.amount_minor) or t.currency_code<>i.currency_code or t.kind<>i.normalized_payload->>'kind' or new.amount_minor<>i.amount_minor then raise exception using errcode='P0001',message='TRACKING_ACCOUNT_BLOCKED'; end if;
    end if;
  end if;
  return new;
end $$;

alter function private.tracking_confirmation_sources(integer) rename to tracking_confirmation_sources_before_quiet;
revoke all on function private.tracking_confirmation_sources_before_quiet(integer) from public,masarifi_worker;
create function private.tracking_confirmation_sources(p_limit integer)
returns table(source_event_id uuid,source_id text,event_type text,user_id text,locale text,time_zone text,occurred_at text,expires_at text)
language sql stable security definer set search_path='' as $$
  select * from private.tracking_confirmation_sources_before_quiet(p_limit) where false;
$$;
revoke all on function private.tracking_confirmation_sources(integer) from public;
grant execute on function private.tracking_confirmation_sources(integer) to masarifi_worker;

alter function private.defer_import_item(uuid,uuid,text) rename to defer_import_item_before_nominal;
revoke all on function private.defer_import_item_before_nominal(uuid,uuid,text) from public,masarifi_worker;
create function private.defer_import_item(p_item_id uuid,p_fence_token uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items;
begin
  select x.* into i from public.import_items x join public.import_sessions s on s.id=x.session_id where x.id=p_item_id and s.claim_token=p_fence_token and s.lease_until>clock_timestamp() for update of x;
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if i.normalized_payload->>'accountingPolicy' is distinct from 'default_account_nominal_v1' then return private.defer_import_item_before_nominal(p_item_id,p_fence_token,p_reason); end if;
  update public.import_items set normalized_payload=normalized_payload||jsonb_build_object('diagnosticReason',p_reason) where id=i.id;
  return to_jsonb(i)-'user_id'-'normalized_payload'-'source_hash'-'normalized_hash';
end $$;
revoke all on function private.defer_import_item(uuid,uuid,text) from public;
grant execute on function private.defer_import_item(uuid,uuid,text) to masarifi_worker;

alter table public.import_sessions drop constraint import_sessions_attempt_count_check;
alter table public.import_sessions add constraint import_sessions_attempt_count_check check(attempt_count>=0 and (schema_version=3 or attempt_count<=20));
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('private.claim_import_session(text,integer,integer)'::regprocedure);
  if position('s.attempt_count<10' in definition)=0 then raise exception 'TRACKING_NOMINAL_RETRY_PRECONDITION'; end if;
  execute replace(definition,'s.attempt_count<10','(s.schema_version=3 or s.attempt_count<10)');
end $migration$;
alter function private.complete_import_attempt(uuid,uuid,text,text) rename to complete_import_attempt_before_nominal;
revoke all on function private.complete_import_attempt_before_nominal(uuid,uuid,text,text) from public,masarifi_worker;
create function private.complete_import_attempt(p_session_id uuid,p_fence_token uuid,p_status text,p_error_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; waiting boolean;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if s.schema_version<>3 then return private.complete_import_attempt_before_nominal(p_session_id,p_fence_token,p_status,p_error_code); end if;
  if p_status not in ('succeeded','failed') then raise exception using errcode='22023',message='IMPORT_COMPLETE_INVALID'; end if;
  waiting:=p_status='failed' or exists(select 1 from public.import_items where session_id=s.id and status='parsed');
  update private.import_attempts set status=case when waiting then 'failed' else 'succeeded' end,completed_at=clock_timestamp(),error_code=case when waiting then coalesce(p_error_code,'TRACKING_CAPTURE_DEFERRED') end where session_id=s.id and fence_token=p_fence_token and status='running';
  perform private.reconcile_import_session_counts(s.id);
  update public.import_sessions set status=case when waiting then 'received' else 'complete' end,completed_at=case when not waiting then clock_timestamp() end,
    claim_token=null,claimed_by=null,lease_until=null,last_error_code=case when waiting then coalesce(p_error_code,'TRACKING_CAPTURE_DEFERRED') end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(300,(2^least(s.attempt_count,8))::integer)) where id=s.id returning * into s;
  perform private.enqueue_outbox_event('import.session.changed.v1','import-session',s.id,jsonb_build_object('sessionId',s.id,'status',s.status,'itemCount',s.item_count,'failedCount',0,'version',s.version,'occurredAt',clock_timestamp()));
  return to_jsonb(s)-'user_id'-'request_hash'-'claim_token'-'claimed_by'-'lease_until'-'last_error_code';
end $$;
revoke all on function private.complete_import_attempt(uuid,uuid,text,text) from public;
grant execute on function private.complete_import_attempt(uuid,uuid,text,text) to masarifi_worker;

revoke all on function private.tracking_nominal_source(uuid),private.tracking_nominal_exception(uuid),private.reserve_tracking_capture(uuid,uuid),private.prepare_import_session(uuid,uuid),private.finalize_import_session(uuid,uuid) from public;
grant execute on function private.reserve_tracking_capture(uuid,uuid),private.prepare_import_session(uuid,uuid),private.finalize_import_session(uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
