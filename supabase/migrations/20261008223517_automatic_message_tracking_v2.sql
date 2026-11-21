grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create table public.tracking_rule_releases (
  id uuid primary key default extensions.gen_random_uuid(), release_no bigint generated always as identity unique,
  schema_version integer not null check(schema_version=2), engine_version text not null check(engine_version='2.0.0'),
  status text not null default 'draft' check(status in ('draft','validated','published')),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=262144),
  content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'), validated_hash text,
  corpus_result jsonb, created_by text not null, published_by text, published_at timestamptz,
  reason text not null check(char_length(reason) between 10 and 500), version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp()
);
create unique index tracking_release_snapshot_identity on public.tracking_rule_releases ((snapshot->>'releaseId'));
create table public.tracking_rule_entries (
  release_id uuid not null references public.tracking_rule_releases(id) on delete cascade,
  rule_key text not null check(rule_key ~ '^[a-z0-9._-]{1,100}$'), family text not null check(family in ('action','status','exclusion')),
  enabled boolean not null, priority integer not null check(priority between 0 and 10000), definition jsonb not null,
  primary key(release_id,rule_key)
);
create table public.tracking_rule_channels (
  environment text not null default 'default', market text not null default 'global', channel text not null default 'all',
  release_id uuid not null references public.tracking_rule_releases(id), version bigint not null default 1,
  mode text not null default 'review' check(mode in ('shadow','review','automatic')),
  updated_at timestamptz not null default clock_timestamp(), primary key(environment,market,channel)
);
create table public.tracking_account_bindings (
  id uuid primary key default extensions.gen_random_uuid(), user_id text not null references public.profiles(id) on delete cascade,
  provider text not null, role text not null check(role in ('card','account')), suffix text not null check(suffix ~ '^[0-9]{4,12}$'),
  account_id uuid not null references public.accounts(id), enabled boolean not null default true, version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(), unique(user_id,provider,role,suffix)
);
create table private.tracking_capture_reservations (
  user_id text not null references public.profiles(id) on delete cascade, identity_hash text not null check(identity_hash ~ '^[a-f0-9]{64}$'),
  primary_item_id uuid not null references public.import_items(id) on delete cascade, transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default clock_timestamp(), primary key(user_id,identity_hash)
);
alter table public.user_keyword_rules add column rule_key text;
alter table public.import_sessions drop constraint import_sessions_schema_version_check;
alter table public.import_sessions add constraint import_sessions_schema_version_check check(schema_version in (1,2));
alter table public.import_items add column canonical_identity_hash text;
create index import_items_canonical_identity on public.import_items(user_id,canonical_identity_hash) where canonical_identity_hash is not null;
alter table public.tracking_rule_releases enable row level security;
alter table public.tracking_rule_releases force row level security;
alter table public.tracking_rule_entries enable row level security;
alter table public.tracking_rule_entries force row level security;
alter table public.tracking_rule_channels enable row level security;
alter table public.tracking_rule_channels force row level security;
alter table public.tracking_account_bindings enable row level security;
alter table public.tracking_account_bindings force row level security;
create policy tracking_releases_service on public.tracking_rule_releases to masarifi_migration using(true) with check(true);
create policy tracking_entries_service on public.tracking_rule_entries to masarifi_migration using(true) with check(true);
create policy tracking_channels_service on public.tracking_rule_channels to masarifi_migration using(true) with check(true);
create policy tracking_bindings_service on public.tracking_account_bindings to masarifi_migration using(true) with check(true);

create function private.freeze_tracking_release() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='published' then raise exception using errcode='22023',message='TRACKING_RELEASE_IMMUTABLE'; end if;
  return new;
end $$;
create trigger tracking_release_immutable before update or delete on public.tracking_rule_releases
  for each row execute function private.freeze_tracking_release();

create function private.get_tracking_rule_snapshot(p_user_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.assert_active_profile(p_user_id);
  select jsonb_build_object('snapshot',r.snapshot,'contentHash',r.content_hash,'channelVersion',c.version,'rolloutMode',c.mode,
    'keywords',coalesce((select jsonb_agg(to_jsonb(k)-'user_id') from public.user_keyword_rules k where k.user_id=p_user_id),'[]'::jsonb),
    'senders',coalesce((select jsonb_agg(to_jsonb(d)-'user_id') from public.user_sender_rules d where d.user_id=p_user_id),'[]'::jsonb),
    'bindings',coalesce((select jsonb_agg(jsonb_build_object('provider',b.provider,'role',b.role,'suffix',b.suffix,'accountId',b.account_id))
       from public.tracking_account_bindings b join public.accounts a on a.id=b.account_id and a.user_id=b.user_id
       where b.user_id=p_user_id and b.enabled and a.status='active'),'[]'::jsonb)) into result
  from public.tracking_rule_channels c join public.tracking_rule_releases r on r.id=c.release_id and r.status='published'
  where c.environment='default' and c.market='global' and c.channel='all';
  if result is null then raise exception using errcode='22023',message='TRACKING_RULES_UNAVAILABLE'; end if;
  return result;
end $$;

create function private.mutate_tracking_release(p_id uuid,p_action text,p_patch jsonb,p_version bigint,p_reason text,p_admin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.tracking_rule_releases; c public.tracking_rule_channels; payload jsonb; digest text;
begin
  perform private.assert_admin_permission('parsers.versions.manage');
  if char_length(p_reason) not between 10 and 500 then raise exception using errcode='22023',message='ADMIN_REASON_INVALID'; end if;
  if p_action='create' then
    payload:=p_patch->'snapshot';
    if payload->>'engineVersion'<>'2.0.0' or payload->>'schemaVersion'<>'2' or payload->>'aiEnabled'<>'false'
      or jsonb_typeof(payload->'rules')<>'array' or jsonb_array_length(payload->'rules')>256 then
      raise exception using errcode='22023',message='TRACKING_RULES_INVALID'; end if;
    insert into public.tracking_rule_releases(schema_version,engine_version,snapshot,content_hash,created_by,reason)
    values(2,'2.0.0',payload,encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex'),p_admin,p_reason) returning * into r;
    payload:=jsonb_set(jsonb_set(payload,'{releaseId}',to_jsonb(r.id::text)),'{releaseNo}',to_jsonb(r.release_no));
    update public.tracking_rule_releases set snapshot=payload,content_hash=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex') where id=r.id returning * into r;
    insert into public.tracking_rule_entries(release_id,rule_key,family,enabled,priority,definition)
      select r.id,e->>'ruleKey',e->>'family',(e->>'enabled')::boolean,(e->>'priority')::integer,e from jsonb_array_elements(payload->'rules') e;
  else
    select * into r from public.tracking_rule_releases where id=p_id for update;
    if r.id is null then raise exception using errcode='P0002',message='TRACKING_RELEASE_NOT_FOUND'; end if;
    if p_action in ('validate','publish') and r.version<>p_version then raise exception using errcode='40001',message='TRACKING_RELEASE_STALE'; end if;
    if p_action='validate' then
      if r.status='published' or coalesce(p_patch->>'validatedHash','')<>r.content_hash or coalesce(p_patch#>>'{corpusResult,passed}','')<>'true' then
        raise exception using errcode='22023',message='TRACKING_CORPUS_INVALID'; end if;
      update public.tracking_rule_releases set status='validated',validated_hash=content_hash,corpus_result=p_patch->'corpusResult',version=version+1 where id=r.id returning * into r;
    elsif p_action='publish' then
      if r.status<>'validated' or r.validated_hash<>r.content_hash then raise exception using errcode='22023',message='TRACKING_CORPUS_REQUIRED'; end if;
      update public.tracking_rule_releases set status='published',published_by=p_admin,published_at=clock_timestamp(),version=version+1 where id=r.id returning * into r;
    elsif p_action in ('activate','rollback') then
      if r.status<>'published' then raise exception using errcode='22023',message='TRACKING_RELEASE_NOT_PUBLISHED'; end if;
      select * into c from public.tracking_rule_channels where environment='default' and market='global' and channel='all' for update;
      if c.version<>p_version or coalesce(p_patch->>'mode','') not in ('shadow','review','automatic') then raise exception using errcode='40001',message='TRACKING_CHANNEL_STALE'; end if;
      update public.tracking_rule_channels set release_id=r.id,version=version+1,mode=p_patch->>'mode',updated_at=clock_timestamp()
        where environment=c.environment and market=c.market and channel=c.channel;
    else raise exception using errcode='22023',message='TRACKING_ACTION_INVALID'; end if;
  end if;
  perform audit.append_event(p_admin,'admin','tracking.release-'||p_action,'tracking_release',r.id::text,null,null,null,private.tracking_request_id(),
    jsonb_build_object('reason',p_reason,'contentHash',r.content_hash,'version',r.version));
  return to_jsonb(r);
end $$;

create function private.read_tracking_releases(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_admin_permission('parsers.coverage.read');
  return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('active',exists(select 1 from public.tracking_rule_channels c where c.release_id=r.id),'channelVersion',(select c.version from public.tracking_rule_channels c limit 1),'rolloutMode',(select c.mode from public.tracking_rule_channels c limit 1)) order by r.release_no desc) from
    (select * from public.tracking_rule_releases where p_id is null or id=p_id order by release_no desc limit 100) r),'[]'::jsonb);
end $$;

create or replace function private.create_import_session(p_user_id text,p_source_type text,p_source_name text,p_schema_version integer,p_request_hash text,p_events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; e jsonb; item public.import_items; currency char(3);
begin
  perform private.assert_active_profile(p_user_id);
  if p_source_type not in ('sms','file','manual','provider') or p_schema_version not in (1,2) or p_request_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events) not between 1 and 10000 then raise exception using errcode='22023',message='IMPORT_INVALID'; end if;
  insert into public.import_sessions(user_id,source_type,source_name,schema_version,request_hash,item_count)
  values(p_user_id,p_source_type,p_source_name,p_schema_version,p_request_hash,jsonb_array_length(p_events))
  on conflict(user_id,request_hash) do nothing returning * into s;
  if s.id is null then select * into s from public.import_sessions where user_id=p_user_id and request_hash=p_request_hash;
    return to_jsonb(s)-'user_id'-'request_hash'-'claim_token'-'claimed_by'-'lease_until'-'last_error_code'; end if;
  for e in select value from jsonb_array_elements(p_events) loop
    if not(e ? 'sourceItemKey' and e ? 'receivedAt') or octet_length(e::text)>8192 then raise exception using errcode='22023',message='IMPORT_ITEM_INVALID'; end if;
    currency:=null;
    select code into currency from public.currencies where code=e->>'currency';
    insert into public.import_items(user_id,session_id,source_item_key,normalized_hash,source_hash,occurred_at,amount_minor,currency_code,merchant,normalized_payload,status)
    values(p_user_id,s.id,e->>'sourceItemKey',encode(extensions.digest(convert_to(e::text,'UTF8'),'sha256'),'hex'),
      encode(extensions.digest(convert_to(coalesce(e->>'body',e->>'sourceItemKey'),'UTF8'),'sha256'),'hex'),
      (e->>'occurredAt')::timestamptz,(e->>'amountMinor')::bigint,currency,e->>'merchant',e,'parsed') returning * into item;
    insert into public.tracking_history(user_id,source_type,source_ref,outcome,occurred_at) values(p_user_id,p_source_type,item.id::text,'received',clock_timestamp());
    perform private.enqueue_outbox_event('import.item.changed.v1','import-item',item.id,
      jsonb_build_object('sessionId',s.id,'itemId',item.id,'status','parsed','version',item.version,'occurredAt',clock_timestamp()));
  end loop;
  perform private.enqueue_outbox_event('import.session.changed.v1','import-session',s.id,
    jsonb_build_object('sessionId',s.id,'status',s.status,'itemCount',s.item_count,'failedCount',0,'version',s.version,'occurredAt',clock_timestamp()));
  perform audit.append_event(p_user_id,'user','import.session-created','import_session',s.id::text,null,null,null,private.tracking_request_id(),jsonb_build_object('schemaVersion',p_schema_version,'itemCount',s.item_count));
  return to_jsonb(s)-'user_id'-'request_hash'-'claim_token'-'claimed_by'-'lease_until'-'last_error_code';
end $$;

create or replace function private.create_review_item(p_import_item_id uuid,p_reason text,p_proposed_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; r public.review_items; inserted boolean:=false; source_type text; safe_values jsonb;
begin
  select * into i from public.import_items where id=p_import_item_id for update;
  if i.id is null or i.status not in ('parsed','review') then raise exception using errcode='22023',message='REVIEW_ITEM_INVALID'; end if;
  if p_proposed_values is null or jsonb_typeof(p_proposed_values)<>'object' then raise exception using errcode='22023',message='REVIEW_ITEM_INVALID'; end if;
  safe_values:=p_proposed_values-'body'-'sender'-'metadata'-'sourceText';
  if exists(select 1 from public.tracking_rule_channels c join public.tracking_rule_releases release on release.id=c.release_id cross join lateral jsonb_array_elements(release.snapshot->'providers') provider where provider->>'providerKey'=p_proposed_values#>>'{metadata,sourceProvider}') then
    safe_values:=safe_values||jsonb_build_object('sourceProvider',p_proposed_values#>>'{metadata,sourceProvider}');
  end if;
  insert into public.review_items(user_id,import_item_id,reason,proposed_values,original_values)
  values(i.user_id,i.id,p_reason,safe_values,safe_values)
  on conflict(import_item_id) where status='pending' do nothing returning * into r;
  if r.id is null then select * into r from public.review_items where import_item_id=i.id and status='pending'; else inserted:=true; end if;
  update public.import_items set status='review' where id=i.id and status='parsed';
  if inserted then
    select s.source_type into source_type from public.import_sessions s where s.id=i.session_id;
    insert into public.tracking_history(user_id,source_type,source_ref,outcome,reason_codes,parser_version_id,applied_rule_ids,review_item_id)
    values(i.user_id,source_type,i.id::text,'reviewed',array[p_reason],i.parser_version_id,i.applied_rule_ids,r.id);
    perform private.enqueue_outbox_event('tracking.review.requested.v1','review-item',r.id,
      jsonb_build_object('reviewId',r.id,'itemId',i.id,'reasonCode',p_reason,'version',r.version,'occurredAt',clock_timestamp()));
  end if;
  return to_jsonb(r)-'user_id'-'decision_token'-'decision_lease_until';
end $$;

-- V2 eligibility is a lifecycle/accounting contract. Completeness confidence cannot authorize money.
alter function private.prepare_import_session(uuid,uuid) rename to prepare_import_session_legacy;
create function private.prepare_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  for i in select * from public.import_items where session_id=s.id and status='parsed' order by id for update loop
    if s.schema_version=2 then
      if (private.reserve_tracking_capture(i.id,p_fence_token)->>'conflict')::boolean then perform private.create_review_item(i.id,'duplicate_candidate',i.normalized_payload); continue; end if;
    end if;
    if s.schema_version=2 and exists(select 1 from public.import_items prior
      where prior.user_id=i.user_id and prior.id<>i.id and prior.status='review'
      and abs(prior.amount_minor)=abs(i.amount_minor) and prior.currency_code=i.currency_code
      and prior.normalized_payload->>'accountId'=i.normalized_payload->>'accountId'
      and prior.normalized_payload#>>'{classification,direction}'=i.normalized_payload#>>'{classification,direction}'
      and prior.normalized_payload#>>'{classification,subtype}'=i.normalized_payload#>>'{classification,subtype}'
      and coalesce(prior.merchant,'')=coalesce(i.merchant,'')
      and abs(extract(epoch from (coalesce(prior.occurred_at,(prior.normalized_payload->>'receivedAt')::timestamptz)-coalesce(i.occurred_at,(i.normalized_payload->>'receivedAt')::timestamptz))))<=120) then
      perform private.create_review_item(i.id,'duplicate_candidate',i.normalized_payload); continue;
    end if;
    if s.schema_version=2 and (coalesce(i.normalized_payload#>>'{classification,disposition}','')<>'capture_candidate' or
      coalesce(i.normalized_payload#>>'{classification,status}','')<>'completed' or i.normalized_payload#>>'{classification,subtype}' in ('generic_credit','deposit','refund','reversal','withdrawal','transfer_sent','transfer_received') or
      not(i.normalized_payload ? 'accountId') or i.currency_code is null or i.amount_minor is null or
      coalesce(i.normalized_payload#>'{classification,reasonCodes}','null'::jsonb)<>'[]'::jsonb or
      abs(i.amount_minor)<>coalesce((i.normalized_payload#>>'{classification,amountMinor}')::bigint,0) or
      i.currency_code::text<>coalesce(i.normalized_payload#>>'{classification,currency}','') or
      not ((i.normalized_payload->>'kind' in ('expense','fee') and i.normalized_payload#>>'{classification,direction}'='outgoing') or
        (i.normalized_payload->>'kind'='income' and i.normalized_payload#>>'{classification,direction}'='incoming' and i.normalized_payload#>>'{classification,subtype}'='salary')) or
      not exists(select 1 from public.user_sender_rules d where d.user_id=i.user_id and d.enabled and d.trusted and lower(d.sender_pattern)=lower(i.normalized_payload->>'sender'))) then
      perform private.create_review_item(i.id,'review_required',i.normalized_payload); continue;
    end if;
    if s.schema_version=1 and ((i.normalized_payload ? 'kind' and i.normalized_payload->>'kind' not in ('expense','income')) or coalesce(i.normalized_payload->>'body','') ~* '(pending|will be credited|payee|beneficiary|reversed|failed|declined)') then
      perform private.create_review_item(i.id,'review_required',i.normalized_payload); continue;
    end if;
  end loop;
  if s.schema_version=2 then return jsonb_build_object('sessionId',s.id,'parserItems','[]'::jsonb); end if;
  return private.prepare_import_session_legacy(p_session_id,p_fence_token);
end $$;
alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_legacy;
create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions; eligible boolean;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp() for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  for i in select * from public.import_items where session_id=s.id and status='parsed' order by id for update loop
    if s.schema_version=2 then
      select exists(select 1 from public.tracking_rule_releases r join public.tracking_rule_channels c on c.release_id=r.id
        where r.status='published' and c.mode='automatic' and r.snapshot->>'releaseId'=i.normalized_payload#>>'{classification,releaseId}'
        and i.normalized_payload#>>'{classification,engineVersion}'=r.engine_version) into eligible;
      if not eligible or coalesce(i.normalized_payload#>>'{classification,status}','')<>'completed' or i.normalized_payload#>>'{classification,disposition}'<>'capture_candidate' then
        perform private.create_review_item(i.id,'review_required',i.normalized_payload); continue;
      end if;
      if i.normalized_payload->>'kind'='fee' then update public.import_items set normalized_payload=jsonb_set(normalized_payload,'{kind}','"expense"') where id=i.id; end if;
    end if;
  end loop;
  return private.finalize_import_session_legacy(p_session_id,p_fence_token);
end $$;

create function private.reserve_tracking_capture(p_item_id uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items; s public.import_sessions; r private.tracking_capture_reservations; proof text; hash text;
begin
  select x.* into i from public.import_items x join public.import_sessions y on y.id=x.session_id
  where x.id=p_item_id and x.status='parsed' and y.claim_token=p_fence and y.lease_until>clock_timestamp() for update of x;
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  select * into s from public.import_sessions where id=i.session_id;
  -- Reference proof uses semantic effect families, so equivalent channel wording shares one identity.
  -- Fees, refund/reversal and transfers retain distinct identities; lifecycle/account edits do not mint new proof.
  proof:=case when i.normalized_payload ? 'providerReferenceDigest' then
    concat_ws('|','reference',lower(coalesce(i.normalized_payload#>>'{metadata,sourceProvider}',i.normalized_payload->>'sender')),i.normalized_payload->>'providerReferenceDigest',
      i.normalized_payload#>>'{classification,direction}',case
        when i.normalized_payload#>>'{classification,subtype}' in ('pos_purchase','online_purchase','card_purchase','bill_payment','purchase','payment','generic_debit') then 'expense'
        when i.normalized_payload#>>'{classification,subtype}' in ('salary','deposit','generic_credit') then 'credit'
        when i.normalized_payload#>>'{classification,subtype}' in ('transfer_sent','transfer_received') then 'transfer'
        else i.normalized_payload#>>'{classification,subtype}' end)
    when i.normalized_payload ? 'transport' then concat_ws('|','transport',i.normalized_payload#>>'{transport,deviceId}',i.normalized_payload#>>'{transport,channel}',
      i.normalized_payload#>>'{transport,nativeIdDigest}')
    else s.source_type||chr(10)||i.source_item_key end;
  hash:=encode(extensions.digest(convert_to(proof,'UTF8'),'sha256'),'hex');
  insert into private.tracking_capture_reservations(user_id,identity_hash,primary_item_id) values(i.user_id,hash,i.id) on conflict do nothing;
  select * into r from private.tracking_capture_reservations where user_id=i.user_id and identity_hash=hash for update;
  update public.import_items set canonical_identity_hash=hash where id=i.id;
  return jsonb_build_object('identityHash',hash,'primaryItemId',r.primary_item_id,'operationId',(select operation_id from public.import_items where id=r.primary_item_id),'conflict',exists(select 1 from public.import_items x where x.id=r.primary_item_id and (x.amount_minor is distinct from i.amount_minor or x.currency_code is distinct from i.currency_code or (x.normalized_payload->>'accountId' is not null and i.normalized_payload->>'accountId' is not null and x.normalized_payload->>'accountId' is distinct from i.normalized_payload->>'accountId'))), 'transactionId',coalesce(r.transaction_id,(select transaction_id from public.import_items where id=r.primary_item_id)));
end $$;

grant execute on function private.get_tracking_rule_snapshot(text),private.read_tracking_releases(uuid),private.mutate_tracking_release(uuid,text,jsonb,bigint,text,text) to masarifi_api;
grant execute on function private.reserve_tracking_capture(uuid,uuid),private.prepare_import_session(uuid,uuid),private.finalize_import_session(uuid,uuid) to masarifi_worker;
revoke all on function private.prepare_import_session_legacy(uuid,uuid),private.finalize_import_session_legacy(uuid,uuid) from public,masarifi_api,masarifi_worker;
revoke all on function private.get_tracking_rule_snapshot(text),private.read_tracking_releases(uuid),private.mutate_tracking_release(uuid,text,jsonb,bigint,text,text),private.reserve_tracking_capture(uuid,uuid),private.prepare_import_session(uuid,uuid),private.finalize_import_session(uuid,uuid),private.freeze_tracking_release() from public;
create or replace function private.decide_review_item(p_user_id text,p_review_id uuid,p_decision text,p_patch jsonb,
  p_decision_token uuid,p_operation_id uuid,p_transaction_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.review_items; i public.import_items; request_id text:=private.tracking_request_id(); accepted jsonb;
begin
  perform private.assert_active_profile(p_user_id);
  if p_decision not in ('accept','reject','edit_accept') or p_patch is null or jsonb_typeof(p_patch)<>'object'
    or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('amountMinor','currency','accountId','categoryId','title','merchant','paymentMethod','note','occurredAt','destinationAccountId','kind','originalTransactionId','originalTransactionVersion','settlementConfirmed','rememberAccountBinding')) then
    raise exception using errcode='22023',message='REVIEW_DECISION_INVALID'; end if;
  select * into r from public.review_items where id=p_review_id and user_id=p_user_id for update;
  if r.id is null or r.decision_token<>p_decision_token or r.decision_action<>p_decision then raise exception using errcode='40001',message='REVIEW_VERSION_CONFLICT'; end if;
  if r.status<>'pending' then return to_jsonb(r)-'user_id'-'decision_token'-'decision_lease_until'; end if;
  if r.decision_lease_until<=clock_timestamp() then raise exception using errcode='40001',message='REVIEW_VERSION_CONFLICT'; end if;
  select * into i from public.import_items where id=r.import_item_id and user_id=p_user_id for update;
  if p_decision<>'reject' and (p_transaction_id is null or not exists(select 1 from public.transactions t where t.id=p_transaction_id and t.user_id=p_user_id and t.status='confirmed')) then
    raise exception using errcode='23503',message='REVIEW_LEDGER_RESULT_INVALID'; end if;
  if p_decision<>'reject' then
    select jsonb_strip_nulls(jsonb_build_object('kind',t.kind,'amountMinor',t.amount_minor,'currency',btrim(t.currency_code::text),
      'accountId',(select p.account_id from public.transaction_postings p where p.transaction_id=t.id and p.clearing_state='confirmed' order by p.id limit 1),
      'categoryId',t.category_id,'title',t.title,'merchant',t.merchant,'paymentMethod',t.payment_method,'note',t.note,'occurredAt',t.occurred_at))
    into accepted from public.transactions t where t.id=p_transaction_id and t.user_id=p_user_id;
  end if;
  if p_decision<>'reject' and p_patch->'rememberAccountBinding'='true'::jsonb and exists(select 1 from public.accounts a where a.id=(coalesce(p_patch->>'accountId',r.proposed_values->>'accountId'))::uuid and a.user_id=p_user_id and a.status='active')
      and exists(select 1 from public.tracking_rule_channels c join public.tracking_rule_releases release on release.id=c.release_id cross join lateral jsonb_array_elements(release.snapshot->'providers') provider where provider->>'providerKey'=i.normalized_payload#>>'{metadata,sourceProvider}') then
    insert into public.tracking_account_bindings(user_id,provider,role,suffix,account_id)
    select distinct p_user_id,i.normalized_payload#>>'{metadata,sourceProvider}',hint->>'role',hint->>'suffix',(coalesce(p_patch->>'accountId',r.proposed_values->>'accountId'))::uuid
    from jsonb_array_elements(i.normalized_payload#>'{classification,instruments}') hint
    on conflict(user_id,provider,role,suffix) do update set account_id=excluded.account_id,enabled=true,version=public.tracking_account_bindings.version+1;
  end if;
  update public.review_items set status=case when p_decision='reject' then 'rejected' when p_decision='edit_accept' then 'edited' else 'accepted' end,
    accepted_values=case when p_decision='reject' then null else accepted end,reviewed_at=clock_timestamp(),reviewed_by=p_user_id,
    decision_lease_until=null where id=r.id returning * into r;
  update public.import_items set status=case when p_decision='reject' then 'rejected' else 'accepted' end,
    transaction_id=case when p_decision='reject' then null else p_transaction_id end,
    operation_id=case when p_decision='reject' then null else p_operation_id end where id=i.id;
  insert into public.tracking_history(user_id,source_type,source_ref,outcome,reason_codes,parser_version_id,applied_rule_ids,review_item_id,operation_id,transaction_id)
  select p_user_id,s.source_type,i.id::text,case when p_decision='reject' then 'rejected' else 'accepted' end,array[r.reason],i.parser_version_id,i.applied_rule_ids,r.id,
    case when p_decision='reject' then null else p_operation_id end,case when p_decision='reject' then null else p_transaction_id end from public.import_sessions s where s.id=i.session_id;
  perform private.enqueue_outbox_event('tracking.review.resolved.v1','review-item',r.id,
    jsonb_build_object('reviewId',r.id,'itemId',i.id,'resolution',p_decision,'version',r.version,'occurredAt',clock_timestamp()));
  perform audit.append_event(p_user_id,'user','tracking.review-resolved','review_item',r.id::text,null,null,null,request_id,
    jsonb_build_object('decision',p_decision,'version',r.version));
  return to_jsonb(r)-'user_id'-'decision_token'-'decision_lease_until';
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
  on conflict(left_item_id,right_transaction_id) do nothing returning *
  loop
    perform private.enqueue_outbox_event('tracking.duplicate.detected.v1','duplicate-candidate',candidate.id,
      jsonb_build_object('candidateId',candidate.id,'itemId',candidate.left_item_id,'existingTransactionId',candidate.right_transaction_id,
        'scoreBand',case when candidate.score>=0.85 then 'high' when candidate.score>=0.70 then 'medium' else 'low' end,
        'version',candidate.version,'occurredAt',candidate.created_at));
    return next candidate;
  end loop;
end $$;

create function private.get_tracking_confirmation(p_user_id text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.notification_events; ready boolean; allowed boolean;
begin
  perform private.assert_active_profile(p_user_id);
  select * into n from public.notification_events where id=p_id and user_id=p_user_id
    and data->>'automaticCapture'='true' and type in ('transaction.created','transfer.created');
  if n.id is null then return jsonb_build_object('notificationId',null,'ready',false,'allowed',false); end if;
  select exists(select 1 from private.notification_deliveries d where d.event_id=n.id and d.channel='push') into ready;
  select exists(select 1 from private.notification_deliveries d where d.event_id=n.id and d.channel='push'
    and d.status in ('queued','processing','delivered','failed') and (d.next_attempt_at is null or d.next_attempt_at<=clock_timestamp())) into allowed;
  if not ready and not exists(select 1 from public.notification_templates t where t.key=n.type and t.channel='push' and t.status='published') then ready:=true; end if;
  if exists(select 1 from private.notification_deliveries d where d.event_id=n.id and d.channel='push' and d.next_attempt_at>clock_timestamp()) then ready:=false; end if;
  return jsonb_build_object('notificationId',n.id,'ready',ready,'allowed',allowed);
end $$;
revoke all on function private.get_tracking_confirmation(text,uuid) from public;
grant execute on function private.get_tracking_confirmation(text,uuid) to masarifi_api;

create function private.read_tracking_capture_transaction(p_user_id text,p_item_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare capture jsonb;
begin
  perform private.assert_active_profile(p_user_id);
  select jsonb_build_object('transactionId',coalesce(r.transaction_id,x.transaction_id),'operationId',x.operation_id) into capture from public.import_items i
    join private.tracking_capture_reservations r on r.user_id=i.user_id and r.identity_hash=i.canonical_identity_hash
    join public.import_items x on x.id=r.primary_item_id and x.user_id=i.user_id
    where i.id=p_item_id and i.user_id=p_user_id;
  return capture;
end $$;
revoke all on function private.read_tracking_capture_transaction(text,uuid) from public;
grant execute on function private.read_tracking_capture_transaction(text,uuid) to masarifi_api;

create function private.complete_tracking_capture() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.transaction_id is not null and new.canonical_identity_hash is not null then
    update private.tracking_capture_reservations set transaction_id=coalesce(transaction_id,new.transaction_id)
    where user_id=new.user_id and identity_hash=new.canonical_identity_hash;
  end if;
  return new;
end $$;
create trigger tracking_capture_committed after update of transaction_id on public.import_items
for each row execute function private.complete_tracking_capture();
revoke all on function private.complete_tracking_capture() from public;

-- BEGIN BUNDLED RULE SEED (generated from packages/transaction-parser/default-rules.json)
insert into public.tracking_rule_releases(id,schema_version,engine_version,status,snapshot,content_hash,validated_hash,corpus_result,created_by,published_by,published_at,reason)
select '20000000-0000-4000-8000-000000000002',2,'2.0.0','published',v,encode(extensions.digest(convert_to(v::text,'UTF8'),'sha256'),'hex'),encode(extensions.digest(convert_to(v::text,'UTF8'),'sha256'),'hex'),'{"passed":true,"caseCount":15}'::jsonb,'migration','migration',clock_timestamp(),'Screenshot-derived bilingual baseline; review rollout until acceptance'
from (select '{"schemaVersion":2,"engineVersion":"2.0.0","releaseId":"bundled-sa-ae-2026-10-09","releaseNo":1,"aiEnabled":false,"currencies":[{"code":"SAR","scale":2,"supported":true,"aliases":["SAR","ريال سعودي","ريال","ر.س"]},{"code":"AED","scale":2,"supported":true,"aliases":["AED","درهم إماراتي","درهم","د.إ"]},{"code":"USD","scale":2,"supported":true,"aliases":["USD","US$","دولار"]},{"code":"EUR","scale":2,"supported":true,"aliases":["EUR","يورو"]},{"code":"GBP","scale":2,"supported":true,"aliases":["GBP"]},{"code":"EGP","scale":2,"supported":true,"aliases":["EGP","جنيه مصري"]},{"code":"KWD","scale":3,"supported":true,"aliases":["KWD","دينار كويتي","د.ك"]},{"code":"QAR","scale":2,"supported":true,"aliases":["QAR","ريال قطري","ر.ق"]},{"code":"OMR","scale":3,"supported":true,"aliases":["OMR"]},{"code":"BHD","scale":3,"supported":true,"aliases":["BHD"]},{"code":"JOD","scale":3,"supported":true,"aliases":["JOD"]},{"code":"JPY","scale":0,"supported":true,"aliases":["JPY"]},{"code":"SEK","scale":2,"supported":false,"aliases":["SEK"]}],"rules":[{"ruleKey":"exclude.otp","family":"exclusion","enabled":true,"priority":1000,"any":["otp","verification code","one-time password","رمز التحقق","رمز الأمان","كود التحقق"],"effects":{"status":"administrative","subtype":"administrative","direction":"unknown","disposition":"ignore"}},{"ruleKey":"exclude.payee","family":"exclusion","enabled":true,"priority":990,"any":["payee addition request","beneficiary added","إضافة مستفيد","اضافة مستفيد","transfers will be enabled"],"effects":{"status":"administrative","subtype":"administrative","direction":"unknown","disposition":"ignore"}},{"ruleKey":"exclude.promo","family":"exclusion","enabled":true,"priority":980,"any":["special offer","promo code","عرض خاص","عرض حصري","واحصل"],"effects":{"status":"administrative","subtype":"administrative","direction":"unknown","disposition":"ignore"}},{"ruleKey":"lifecycle.declined","family":"status","enabled":true,"priority":950,"any":["declined","rejected","insufficient funds","مرفوض","مرفوضة","رفضت","تم رفض","رفض العملية"],"effects":{"status":"declined","disposition":"ignore"}},{"ruleKey":"lifecycle.failed","family":"status","enabled":true,"priority":940,"any":["failed","unsuccessful","فشل","فشلت","لم تتم","غير ناجحة","غير ناجح","غير ناجحة"],"effects":{"status":"failed","disposition":"ignore"}},{"ruleKey":"lifecycle.cancelled","family":"status","enabled":true,"priority":930,"any":["cancelled","canceled","ملغاة","ملغى"],"effects":{"status":"cancelled","disposition":"ignore"}},{"ruleKey":"lifecycle.pending","family":"status","enabled":true,"priority":920,"any":["pending","will be credited","working days","قيد المعالجة","معلق","سيتم إيداع","سيتم ايداع"],"effects":{"status":"pending","disposition":"review"}},{"ruleKey":"action.reversal","family":"action","enabled":true,"priority":850,"any":["reversed","reversal","عكس القيد","عكس العملية"],"effects":{"direction":"incoming","subtype":"reversal","status":"completed"}},{"ruleKey":"action.refund","family":"action","enabled":true,"priority":840,"any":["refund","refunded","استرداد","مسترد"],"effects":{"direction":"incoming","subtype":"refund","status":"completed"}},{"ruleKey":"action.salary","family":"action","enabled":true,"priority":830,"any":["salary","راتب"],"effects":{"direction":"incoming","subtype":"salary","status":"completed"}},{"ruleKey":"action.pos","family":"action","enabled":true,"priority":820,"any":["شراء عبر نقاط بيع","pos purchase"],"effects":{"direction":"outgoing","subtype":"pos_purchase","status":"completed"}},{"ruleKey":"action.online","family":"action","enabled":true,"priority":810,"any":["شراء إنترنت","شراء انترنت","online purchase","internet purchase"],"effects":{"direction":"outgoing","subtype":"online_purchase","status":"completed"}},{"ruleKey":"action.card","family":"action","enabled":true,"priority":800,"any":["used for"],"effects":{"direction":"outgoing","subtype":"card_purchase","status":"completed"}},{"ruleKey":"action.bill","family":"action","enabled":true,"priority":790,"any":["سدادك","bill payment","فاتورة"],"effects":{"direction":"outgoing","subtype":"bill_payment","status":"completed"}},{"ruleKey":"action.withdrawal","family":"action","enabled":true,"priority":780,"any":["cash withdrawal","withdrawal","withdrawn","سحب نقدي","سحب"],"effects":{"direction":"outgoing","subtype":"withdrawal","status":"completed"}},{"ruleKey":"action.transfer.sent","family":"action","enabled":true,"priority":770,"any":["transfer to","transferred to","outgoing transfer","تحويل صادر"],"effects":{"direction":"outgoing","subtype":"transfer_sent","status":"completed"}},{"ruleKey":"action.transfer.received","family":"action","enabled":true,"priority":760,"any":["transfer from","incoming transfer","تحويل وارد"],"effects":{"direction":"incoming","subtype":"transfer_received","status":"completed"}},{"ruleKey":"action.debit","family":"action","enabled":true,"priority":750,"any":["dr. transaction","dr transaction","debit transaction","debited","خصم"],"effects":{"direction":"outgoing","subtype":"generic_debit","status":"completed"}},{"ruleKey":"action.purchase","family":"action","enabled":true,"priority":740,"any":["purchase","شراء","spent"],"effects":{"direction":"outgoing","subtype":"purchase","status":"completed"}},{"ruleKey":"action.payment","family":"action","enabled":true,"priority":730,"any":["paid","payment","charged","دفع","سداد"],"effects":{"direction":"outgoing","subtype":"payment","status":"completed"}},{"ruleKey":"action.fee","family":"action","enabled":true,"priority":755,"any":["fee","fees","service charge","commission","رسوم","عمولة"],"effects":{"direction":"outgoing","subtype":"fee","status":"completed"},"not":["purchase","used for","شراء","paid","dr. transaction","debited"]},{"ruleKey":"action.deposit","family":"action","enabled":true,"priority":710,"any":["deposit","deposited","إيداع","ايداع"],"effects":{"direction":"incoming","subtype":"deposit","status":"completed"}},{"ruleKey":"action.credit","family":"action","enabled":true,"priority":700,"any":["credited","cr. transaction","cr transaction","إضافة","اضافة"],"effects":{"direction":"incoming","subtype":"generic_credit","status":"completed"}}],"providers":[{"providerKey":"alinma","country":"SA","senders":["alinma"],"packages":[]},{"providerKey":"adcb","country":"AE","senders":["ADCBAlert"],"packages":[]},{"providerKey":"du","country":"AE","senders":["du"],"packages":[]}]}'::jsonb v) snapshot;
insert into public.tracking_rule_entries(release_id,rule_key,family,enabled,priority,definition)
select r.id,e->>'ruleKey',e->>'family',(e->>'enabled')::boolean,(e->>'priority')::integer,e from public.tracking_rule_releases r cross join lateral jsonb_array_elements(r.snapshot->'rules') e;
insert into public.tracking_rule_channels(release_id,mode) values('20000000-0000-4000-8000-000000000002','review');
-- END BUNDLED RULE SEED

reset role;
revoke masarifi_migration from current_user granted by current_user;
