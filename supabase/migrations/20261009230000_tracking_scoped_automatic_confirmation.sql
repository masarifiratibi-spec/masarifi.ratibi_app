grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- No cohort is seeded. Staging activation must name the approved owner,
-- actual device and exact published release, with a bounded expiration.
create table private.tracking_automatic_cohorts (
  user_id text not null references public.profiles(id) on delete cascade,
  device_id text not null check(char_length(device_id) between 8 and 200),
  release_id uuid not null references public.tracking_rule_releases(id),
  engine_version text not null check(engine_version='2.0.0'),
  enabled boolean not null default true,
  expires_at timestamptz not null,
  reason text not null check(char_length(reason) between 10 and 500),
  created_at timestamptz not null default clock_timestamp(),
  check(expires_at<=created_at+interval '7 days'), primary key(user_id,device_id)
);
alter table private.tracking_automatic_cohorts enable row level security;
alter table private.tracking_automatic_cohorts force row level security;
create policy tracking_cohorts_migration on private.tracking_automatic_cohorts to masarifi_migration using(true) with check(true);
revoke all on private.tracking_automatic_cohorts from public,masarifi_api,masarifi_worker;

create or replace function private.tracking_capture_auto_enabled(p_item_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.import_items i
    join public.tracking_preferences p on p.user_id=i.user_id
    join public.tracking_rule_channels c on c.environment='default' and c.market='global' and c.channel='all'
    join public.tracking_rule_releases r on r.id=c.release_id
    where i.id=p_item_id and p.enabled and not p.review_required and r.status='published'
      and r.snapshot->>'releaseId'=i.normalized_payload#>>'{classification,releaseId}'
      and r.engine_version=i.normalized_payload#>>'{classification,engineVersion}'
      and (c.mode='automatic' or exists(select 1 from private.tracking_automatic_cohorts cohort
        where cohort.user_id=i.user_id and cohort.device_id=i.normalized_payload#>>'{transport,deviceId}'
          and cohort.release_id=r.id and cohort.engine_version=r.engine_version and cohort.enabled and cohort.expires_at>clock_timestamp())));
$$;
create or replace function private.tracking_configuration_revision(p_user_id text) returns text
language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'configuration',private.get_tracking_rule_snapshot_base(p_user_id),
    'preferences',(select jsonb_build_object('version',p.version,'enabled',p.enabled,'reviewRequired',p.review_required)
      from public.tracking_preferences p where p.user_id=p_user_id),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'currency',a.currency_code,
      'tracking',a.automatic_tracking_enabled,'suffix',a.last_four) order by a.id)
      from public.accounts a where a.user_id=p_user_id),'[]'::jsonb),
    'cohorts',coalesce((select jsonb_agg(jsonb_build_object('device',c.device_id,'release',c.release_id,'engine',c.engine_version,
      'enabled',c.enabled,'expiresAt',c.expires_at) order by c.device_id) from private.tracking_automatic_cohorts c where c.user_id=p_user_id),'[]'::jsonb)
  )::text,'UTF8'),'sha256'),'hex');
$$;
create or replace function private.get_tracking_rule_snapshot(p_user_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select private.get_tracking_rule_snapshot_base(p_user_id)||jsonb_build_object('configurationRevision',private.tracking_configuration_revision(p_user_id))
    ||case when exists(select 1 from private.tracking_automatic_cohorts cohort
      join public.tracking_rule_channels c on c.release_id=cohort.release_id
      join public.tracking_rule_releases r on r.id=c.release_id
      join public.tracking_preferences p on p.user_id=cohort.user_id
      where cohort.user_id=p_user_id and cohort.enabled and cohort.expires_at>clock_timestamp()
      and p.enabled and not p.review_required and r.status='published' and cohort.engine_version=r.engine_version
      and c.environment='default' and c.market='global' and c.channel='all')
    then jsonb_build_object('rolloutMode','automatic') else '{}'::jsonb end;
$$;

-- Set original ledger identity at insertion time, preserving immutable identity.
-- The private context is bounded to one validated compensation command.
create function private.tracking_compensation_origin(p_user_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare origin jsonb; i public.import_items;
begin
  if nullif(current_setting('masarifi.tracking_compensation_origin',true),'') is null then return jsonb_build_object('source','manual'); end if;
  origin:=current_setting('masarifi.tracking_compensation_origin',true)::jsonb;
  select * into i from public.import_items where id=(origin->>'itemId')::uuid and user_id=p_user_id and status='parsed';
  if i.id is null or origin->>'key' is distinct from 'tracking:'||i.canonical_identity_hash
    or not private.tracking_capture_auto_enabled(i.id) or private.tracking_capture_exception(i.id) is not null then
    raise exception using errcode='22023',message='TRACKING_COMPENSATION_PROOF_REQUIRED'; end if;
  return jsonb_build_object('source','tracking-import','externalRef',origin->>'key');
end $$;

do $migration$
declare signature text; definition text; updated text;
begin
  foreach signature in array array['private.refund_transaction(text,uuid,bigint,bigint,uuid,timestamptz,text)','private.reverse_transaction(text,uuid,bigint,timestamptz,text)'] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    updated:=replace(definition,'declare original public.transactions;', 'declare origin jsonb:=private.tracking_compensation_origin(p_user_id); original public.transactions;');
    if signature like 'private.refund_transaction%' then
      updated:=replace(updated,'title,occurred_at,reverses_transaction_id)', 'title,occurred_at,reverses_transaction_id,source,external_ref)');
      updated:=replace(updated,'p_occurred_at,p_original_id)', 'p_occurred_at,p_original_id,origin->>''source'',origin->>''externalRef'')');
    else
      updated:=replace(updated,'title,occurred_at,reverses_transaction_id)', 'title,occurred_at,reverses_transaction_id,source,external_ref)');
      updated:=replace(updated,'p_occurred_at,p_original_id)', 'p_occurred_at,p_original_id,origin->>''source'',origin->>''externalRef'')');
    end if;
    if updated=definition or position('origin jsonb:=' in updated)=0 or position('reverses_transaction_id,source,external_ref)' in updated)=0 then
      raise exception 'TRACKING_COMPENSATION_MIGRATION_PRECONDITION'; end if;
    execute updated;
  end loop;
end $migration$;

create function private.create_tracking_compensation(p_user_id text,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; original jsonb; result jsonb; prior_origin text;
begin
  select * into i from public.import_items where id=(p_command->>'trackingCaptureId')::uuid and user_id=p_user_id and status='parsed' for update;
  if i.id is null or i.canonical_identity_hash is null or p_command->>'trackingCaptureKey' is distinct from 'tracking:'||i.canonical_identity_hash
    or not private.tracking_capture_auto_enabled(i.id) or private.tracking_capture_exception(i.id) is not null then
    raise exception using errcode='22023',message='TRACKING_COMPENSATION_PROOF_REQUIRED'; end if;
  original:=private.tracking_original_compensation(i.id);
  if original is null or p_command->>'transactionId' is distinct from original->>'originalTransactionId'
    or (p_command->>'expectedVersion')::bigint is distinct from (original->>'originalTransactionVersion')::bigint then
    raise exception using errcode='22023',message='TRACKING_COMPENSATION_PROOF_REQUIRED'; end if;
  prior_origin:=coalesce(current_setting('masarifi.tracking_compensation_origin',true),'');
  perform set_config('masarifi.tracking_compensation_origin',jsonb_build_object('itemId',i.id,'key',p_command->>'trackingCaptureKey')::text,true);
  if i.normalized_payload#>>'{classification,subtype}'='refund' and p_command->>'trackingOperation'='refundTransaction'
    and (p_command->>'amountMinor')::bigint=abs(i.amount_minor) and p_command->>'accountId'=i.normalized_payload->>'accountId' then
    result:=private.refund_transaction(p_user_id,(original->>'originalTransactionId')::uuid,(original->>'originalTransactionVersion')::bigint,
      abs(i.amount_minor),(i.normalized_payload->>'accountId')::uuid,(p_command->>'occurredAt')::timestamptz,p_command->>'reason');
  elsif i.normalized_payload#>>'{classification,subtype}'='reversal' and p_command->>'trackingOperation'='reverseTransaction' then
    result:=private.reverse_transaction(p_user_id,(original->>'originalTransactionId')::uuid,(original->>'originalTransactionVersion')::bigint,
      (p_command->>'occurredAt')::timestamptz,p_command->>'reason');
  else raise exception using errcode='22023',message='TRACKING_COMPENSATION_PROOF_REQUIRED'; end if;
  perform set_config('masarifi.tracking_compensation_origin',prior_origin,true);
  return result;
end $$;
revoke all on function private.create_tracking_compensation(text,jsonb),private.tracking_compensation_origin(text) from public;
grant execute on function private.create_tracking_compensation(text,jsonb) to masarifi_api;

-- Binding each transfer instrument to the first account corrupted future
-- account resolution. Use the actual saved posting roles for each side.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.decide_review_item(text,uuid,text,jsonb,uuid,uuid,uuid)'::regprocedure);
  updated:=replace(definition,
    'hint->>''suffix'',(coalesce(p_patch->>''accountId'',r.proposed_values->>''accountId''))::uuid',
    'hint->>''suffix'',case when coalesce(p_patch->>''kind'',r.proposed_values->>''kind'')=''transfer'' then (select p.account_id from public.transaction_postings p where p.transaction_id=p_transaction_id and p.posting_role=hint->>''side'' order by p.id limit 1) else (coalesce(p_patch->>''accountId'',r.proposed_values->>''accountId''))::uuid end');
  updated:=replace(updated,'from jsonb_array_elements(i.normalized_payload#>''{classification,instruments}'') hint',
    'from jsonb_array_elements(i.normalized_payload#>''{classification,instruments}'') hint where coalesce(p_patch->>''kind'',r.proposed_values->>''kind'')<>''transfer'' or hint->>''side'' in (''source'',''destination'')');
  if updated=definition or position('p.posting_role=hint' in updated)=0 then raise exception 'TRACKING_BINDING_MIGRATION_PRECONDITION'; end if;
  execute updated;
end $migration$;

create or replace function private.get_tracking_confirmation(p_user_id text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.notification_events; ready boolean; allowed boolean; financial jsonb;
begin
  perform private.assert_active_profile(p_user_id);
  select * into n from public.notification_events where id=p_id and user_id=p_user_id
    and data->>'automaticCapture'='true' and type in ('transaction.created','transfer.created','transaction.refunded','transaction.reversed');
  if n.id is null then return jsonb_build_object('notificationId',null,'ready',false,'allowed',false); end if;
  select exists(select 1 from private.notification_deliveries d where d.event_id=n.id and d.channel='push') into ready;
  select exists(select 1 from private.notification_deliveries d where d.event_id=n.id and d.channel='push'
    and d.status in ('queued','processing','delivered','failed') and (d.next_attempt_at is null or d.next_attempt_at<=clock_timestamp())) into allowed;
  if not ready and not exists(select 1 from public.notification_templates t where t.key=n.type and t.channel='push' and t.status='published') then ready:=true; end if;
  if exists(select 1 from private.notification_deliveries d where d.event_id=n.id and d.channel='push' and d.next_attempt_at>clock_timestamp()) then ready:=false; end if;
  select jsonb_build_object('id',t.id,'amountMinor',t.amount_minor,'currency',btrim(t.currency_code::text),
    'direction',case when t.kind='transfer' then 'transfer' when (select sum(p.amount_minor) from public.transaction_postings p where p.transaction_id=t.id)>0 then 'incoming' else 'outgoing' end)
    into financial from public.transactions t where t.id::text=n.data->>'targetId' and t.user_id=p_user_id and t.status='confirmed' and t.deleted_at is null and t.source='tracking-import';
  if financial is null then return jsonb_build_object('notificationId',n.id,'ready',true,'allowed',false); end if;
  return jsonb_build_object('notificationId',n.id,'ready',ready,'allowed',allowed,'transaction',financial);
end $$;

-- Read only new, committed financial events from the explicitly approved
-- owner/device/release cohort. Do not publish/drain the historical outbox.
create function private.tracking_confirmation_sources(p_limit integer)
returns table(source_event_id uuid,source_id text,event_type text,user_id text,locale text,time_zone text,occurred_at text,expires_at text)
language sql stable security definer set search_path='' as $$
  select o.id,t.id::text,o.event_type,t.user_id,
    case when p.locale='en' then 'en' else 'ar' end,p.timezone,o.created_at::text,null::text
  from private.outbox_events o
  join public.transactions t on t.id=o.aggregate_id and t.source='tracking-import'
    and t.status='confirmed' and t.deleted_at is null
  join public.profiles p on p.id=t.user_id and p.status='active'
  where o.event_type in ('transaction.created','transfer.created','transaction.refunded','transaction.reversed')
    and not exists(select 1 from public.notification_events n where n.source_event_id=o.id)
    and exists(select 1 from public.import_items i
      join private.tracking_automatic_cohorts c on c.user_id=i.user_id
        and c.device_id=i.normalized_payload#>>'{transport,deviceId}'
      join public.tracking_rule_releases r on r.id=c.release_id and r.status='published'
      where i.transaction_id=t.id and i.user_id=t.user_id and i.status='accepted'
        and c.enabled and c.expires_at>clock_timestamp() and o.created_at>=c.created_at
        and r.snapshot->>'releaseId'=i.normalized_payload#>>'{classification,releaseId}'
        and c.engine_version=i.normalized_payload#>>'{classification,engineVersion}')
  order by o.created_at,o.id limit greatest(0,least(p_limit,100));
$$;
revoke all on function private.tracking_confirmation_sources(integer) from public;
grant execute on function private.tracking_confirmation_sources(integer) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
