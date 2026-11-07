-- Disabled preparation only. Activation is a separately approved Staging operation.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create table private.staging_voice_epochs (
  id uuid primary key default extensions.gen_random_uuid(),
  manifest jsonb not null check(jsonb_typeof(manifest)='object' and pg_column_size(manifest)<=8192),
  manifest_hash text not null check(manifest_hash ~ '^[a-f0-9]{64}$'),
  mode text not null check(mode in ('canary','operating')),
  state text not null default 'prepared' check(state in ('prepared','active','closed')),
  started_at timestamptz, expires_at timestamptz, closed_at timestamptz, closed_reason text,
  heartbeat_at timestamptz, worker_id text,
  check(state<>'active' or started_at is not null),
  check(mode<>'canary' or state<>'active' or
    (expires_at>started_at and expires_at<=started_at+interval '600 seconds'))
);
create table private.staging_voice_runtime_control (
  singleton boolean primary key default true check(singleton),
  enforced boolean not null default false,
  current_epoch uuid references private.staging_voice_epochs(id)
);
insert into private.staging_voice_runtime_control(singleton) values(true);
-- Membership survives session deletion so only this epoch's tombstones can be cleaned.
create table private.staging_voice_members (
  session_id uuid primary key, epoch_id uuid not null references private.staging_voice_epochs(id),
  user_id text not null, locale text not null check(locale in ('en','ar')),
  capture_at timestamptz not null, content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  slot smallint check(slot in (1,2)), unique(epoch_id,slot),
  command_evidence jsonb check(command_evidence is null or
    (jsonb_typeof(command_evidence)='object' and pg_column_size(command_evidence)<=4096))
);
create index staging_voice_members_epoch_idx on private.staging_voice_members(epoch_id,session_id);
do $$ declare t text; begin
  foreach t in array array['staging_voice_epochs','staging_voice_runtime_control','staging_voice_members'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated,masarifi_api,masarifi_worker',t);
  end loop;
end $$;

create function private.prepare_staging_voice_epoch(p_project text,p_manifest jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eid uuid; mh text;
begin
  if p_project is distinct from 'qcffvfbpzvpwcwxwjyro' or not coalesce(
    p_manifest->>'version'='1' and p_manifest->>'mode' in ('canary','operating')
    and p_manifest->>'sourceSha' ~ '^[a-f0-9]{40}$'
    and p_manifest->>'imageDigest' ~ '^[a-f0-9]{64}$'
    and p_manifest->>'apkHash' ~ '^[a-f0-9]{64}$'
    and p_manifest->>'controlHash' ~ '^[a-f0-9]{64}$',false) then raise exception 'VOICE_SCOPE_INVALID'; end if;
  if p_manifest->>'mode'='canary' and not coalesce(
    char_length(p_manifest->>'ownerId') between 1 and 128
    and p_manifest->>'clerkSessionHash' ~ '^[a-f0-9]{64}$'
    and p_manifest->>'accountId' ~* '^[0-9a-f-]{36}$'
    and p_manifest->>'categoryId' ~* '^[0-9a-f-]{36}$',false) then raise exception 'VOICE_SCOPE_INVALID'; end if;
  perform singleton from private.staging_voice_runtime_control for update;
  if exists(select 1 from private.staging_voice_epochs e join private.staging_voice_runtime_control c on c.current_epoch=e.id where e.state='active') then raise exception 'VOICE_SCOPE_CONFLICT'; end if;
  mh:=encode(extensions.digest(p_manifest::text,'sha256'),'hex');
  insert into private.staging_voice_epochs(manifest,manifest_hash,mode) values(p_manifest,mh,p_manifest->>'mode') returning id into eid;
  update private.staging_voice_runtime_control set enforced=true,current_epoch=eid;
  return jsonb_build_object('epochId',eid,'manifestHash',mh,'state','prepared');
end $$;

create function private.activate_staging_voice_epoch(p_epoch uuid,p_hash text,p_deadline timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; started timestamptz:=clock_timestamp();
begin
  perform singleton from private.staging_voice_runtime_control where enforced and current_epoch=p_epoch for update;
  if not found then raise exception 'VOICE_SCOPE_INVALID'; end if;
  select * into e from private.staging_voice_epochs where id=p_epoch for update;
  if e.state is distinct from 'prepared' or p_hash is distinct from e.manifest_hash
    or (p_deadline is not null and p_deadline<=started)
    or (e.mode='canary' and (p_deadline is null or p_deadline>started+interval '600 seconds')) then raise exception 'VOICE_SCOPE_INVALID'; end if;
  update private.staging_voice_epochs set state='active',started_at=started,expires_at=p_deadline where id=e.id;
  update private.voice_automatic_policy set enabled=true;
  return jsonb_build_object('epochId',e.id,'startedAt',started,'expiresAt',p_deadline);
end $$;

create function private.voice_epoch_open(p_epoch uuid) returns boolean
language sql security definer set search_path='' as $$
  select exists(select 1 from private.staging_voice_epochs e
    join private.staging_voice_runtime_control c on c.enforced and c.current_epoch=e.id
    join private.voice_automatic_policy p on p.enabled
    where e.id=p_epoch and e.state='active' and e.started_at<=clock_timestamp()
      and (e.expires_at is null or e.expires_at>clock_timestamp()))
$$;
create function private.close_staging_voice_epoch(p_epoch uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_reason is null or p_reason !~ '^[a-z_]{1,64}$' then raise exception 'VOICE_SCOPE_INVALID'; end if;
  update private.staging_voice_epochs set state='closed',closed_at=coalesce(closed_at,clock_timestamp()),closed_reason=coalesce(closed_reason,p_reason) where id=p_epoch;
  if exists(select 1 from private.staging_voice_runtime_control where current_epoch=p_epoch) then
    update private.voice_automatic_policy set enabled=false;
  end if;
  return true;
end $$;

alter function private.create_voice_session_v3(text,jsonb,uuid,integer,integer,integer,jsonb) rename to create_voice_session_v3_unscoped;
revoke all on function private.create_voice_session_v3_unscoped(text,jsonb,uuid,integer,integer,integer,jsonb) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.create_voice_session_v3(p_user text,p_input jsonb,p_operation uuid,p_seconds integer,p_auth_age integer,p_max_age integer,p_thresholds jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; result jsonb; sid uuid; next_slot smallint;
begin
  perform private.ai_assert_owner(p_user);
  if not (select enforced from private.staging_voice_runtime_control) then
    return private.create_voice_session_v3_unscoped(p_user,p_input,p_operation,p_seconds,p_auth_age,p_max_age,p_thresholds);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user,0));
  select e0.* into e from private.staging_voice_epochs e0 join private.staging_voice_runtime_control c on c.current_epoch=e0.id for update of e0;
  if not private.voice_epoch_open(e.id) then raise exception 'VOICE_AUTOMATIC_UNAVAILABLE'; end if;
  if (p_input->>'recordedAt')::timestamptz<e.started_at or (p_input->>'recordedAt')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception 'VOICE_SCOPE_INVALID'; end if;
  if e.mode='canary' then
    select coalesce(max(slot),0)+1 into next_slot from private.staging_voice_members where epoch_id=e.id;
    if p_user is distinct from e.manifest->>'ownerId' or next_slot>2
      or encode(extensions.digest(coalesce(current_setting('request.jwt.claims',true)::jsonb->>'sid',''),'sha256'),'hex') is distinct from e.manifest->>'clerkSessionHash'
      or p_input->>'locale' is distinct from (case when next_slot=1 then 'en' else 'ar' end)
      or (p_input->>'timezoneOffsetMinutes')::integer is distinct from -180
      or (next_slot=2 and not exists(select 1 from private.voice_events v join private.voice_batches b on b.id=v.batch_id join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=e.id and m.slot=1 and v.status='committed')) then raise exception 'VOICE_AUTOMATIC_UNAVAILABLE'; end if;
  end if;
  result:=private.create_voice_session_v3_unscoped(p_user,p_input,p_operation,p_seconds,p_auth_age,p_max_age,p_thresholds);
  sid:=(result->>'id')::uuid;
  insert into private.staging_voice_members(session_id,epoch_id,user_id,locale,capture_at,content_hash,slot)
    values(sid,e.id,p_user,p_input->>'locale',(p_input->>'recordedAt')::timestamptz,p_input->>'contentHash',next_slot);
  return result;
end $$;

alter function private.accept_voice_batch(uuid,uuid,jsonb,text) rename to accept_voice_batch_unscoped;
revoke all on function private.accept_voice_batch_unscoped(uuid,uuid,jsonb,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.accept_voice_batch(p_session uuid,p_token uuid,p_decisions jsonb,p_policy text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; m private.staging_voice_members; s public.voice_sessions; cmd jsonb;
begin
  if not (select enforced from private.staging_voice_runtime_control)
    or exists(select 1 from private.voice_batch_context where session_id=p_session and analysis_only) then
    return private.accept_voice_batch_unscoped(p_session,p_token,p_decisions,p_policy);
  end if;
  select * into m from private.staging_voice_members where session_id=p_session;
  if not found then raise exception 'VOICE_SCOPE_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(m.user_id,0));
  select * into e from private.staging_voice_epochs where id=m.epoch_id for update;
  if not private.voice_epoch_open(e.id) then raise exception 'VOICE_AUTOMATIC_PAUSED'; end if;
  select * into s from public.voice_sessions where id=p_session;
  if s.user_id is distinct from m.user_id or s.content_hash is distinct from m.content_hash or s.capture_at is distinct from m.capture_at or s.locale is distinct from m.locale then raise exception 'VOICE_SCOPE_INVALID'; end if;
  if e.mode='canary' then
    cmd:=p_decisions->0->'command';
    if not coalesce(jsonb_typeof(p_decisions)='array' and jsonb_array_length(p_decisions)=1
      and p_decisions->0->>'status'='eligible' and private.voice_command_skip_reason(cmd,null) is null
      and cmd->>'kind'='expense' and cmd->>'amountMinor'='2500' and cmd->>'currency'='SAR'
      and cmd->>'accountId'=e.manifest->>'accountId' and cmd->>'categoryId'=e.manifest->>'categoryId'
      and ((cmd->>'occurredAt')::timestamptz at time zone 'Asia/Riyadh')::date=(m.capture_at at time zone 'Asia/Riyadh')::date,false) then
      perform private.close_staging_voice_epoch(e.id,'scope_mismatch');
      update public.voice_sessions set status='failed',failure_code='VOICE_SCOPE_INVALID',claim_token=null,claimed_by=null,lease_until=null where id=p_session;
      return jsonb_build_object('accepted',false,'scopeMismatch',true);
    end if;
  end if;
  return private.accept_voice_batch_unscoped(p_session,p_token,p_decisions,p_policy);
end $$;

-- Only the database's immutable canary membership can retain acceptance audio.
alter function private.get_ai_work_input(text,uuid,uuid) rename to get_ai_work_input_unscoped;
revoke all on function private.get_ai_work_input_unscoped(text,uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.get_ai_work_input(p_kind text,p_id uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=private.get_ai_work_input_unscoped(p_kind,p_id,p_token);
  if p_kind='voice.transcribe_extract' then
    result:=result||jsonb_build_object('retainAcceptanceEvidence',exists(
      select 1 from private.staging_voice_members m join private.staging_voice_epochs e on e.id=m.epoch_id
      where m.session_id=p_id and e.mode='canary'));
  end if;
  return result;
end $$;

alter function private.execute_voice_event(uuid,uuid,uuid) rename to execute_voice_event_unscoped;
revoke all on function private.execute_voice_event_unscoped(uuid,uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.execute_voice_event(p_batch uuid,p_token uuid,p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; m private.staging_voice_members; v private.voice_events; cmd jsonb; result jsonb; n integer; amount numeric;
begin
  select * into v from private.voice_events where id=p_event and batch_id=p_batch;
  if not found then raise exception 'VOICE_EVENT_NOT_FOUND'; end if;
  -- A committed receipt is read-only and remains replayable after revocation.
  if v.status='committed' or not (select enforced from private.staging_voice_runtime_control) then
    return private.execute_voice_event_unscoped(p_batch,p_token,p_event);
  end if;
  select m0.* into m from private.staging_voice_members m0 join private.voice_batches b on b.session_id=m0.session_id where b.id=p_batch and m0.user_id=b.user_id;
  if not found then raise exception 'VOICE_SCOPE_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(m.user_id,0));
  select * into e from private.staging_voice_epochs where id=m.epoch_id for update;
  if not private.voice_epoch_open(e.id) then raise exception 'VOICE_AUTOMATIC_PAUSED'; end if;
  if e.mode='canary' then
    select command into cmd from private.voice_event_commands where event_id=p_event;
    select count(*),coalesce(sum(t.amount_minor),0) into n,amount from private.voice_events x join private.voice_batches b on b.id=x.batch_id join private.staging_voice_members sm on sm.session_id=b.session_id join public.transactions t on t.id=x.transaction_id where sm.epoch_id=e.id and x.status='committed';
    if not coalesce(cmd->>'kind'='expense' and cmd->>'amountMinor'='2500' and cmd->>'currency'='SAR'
      and cmd->>'accountId'=e.manifest->>'accountId' and cmd->>'categoryId'=e.manifest->>'categoryId'
      and ((cmd->>'occurredAt')::timestamptz at time zone 'Asia/Riyadh')::date=(m.capture_at at time zone 'Asia/Riyadh')::date
      and n<2 and amount+2500<=5000,false) then
      perform private.close_staging_voice_epoch(e.id,'scope_mismatch'); return jsonb_build_object('status','scope_mismatch');
    end if;
  end if;
  result:=private.execute_voice_event_unscoped(p_batch,p_token,p_event);
  -- Downstream ledger/account locks may have waited beyond the checked window.
  -- Raising here rolls back every effect of the shared financial implementation.
  if e.expires_at is not null and e.expires_at<=clock_timestamp() then raise exception 'VOICE_SCOPE_EXPIRED'; end if;
  if e.mode='canary' and exists(select 1 from private.voice_events where id=p_event and status='committed') then
    update private.staging_voice_members set command_evidence=cmd where session_id=m.session_id;
  end if;
  if e.mode='canary' and not exists(select 1 from private.voice_events where id=p_event and status='committed') then
    perform private.close_staging_voice_epoch(e.id,'execution_failed');
  elsif e.mode='canary' and n=1 then
    perform private.close_staging_voice_epoch(e.id,'completed');
  end if;
  return result;
end $$;

-- A caller can also delay COMMIT after execution returned. Fence that boundary
-- without rejecting the valid second commit merely because it closes admission.
create function private.staging_voice_commit_deadline() returns trigger
language plpgsql security definer set search_path='' as $$
declare deadline timestamptz;
begin
  if new.status='committed' and old.status is distinct from 'committed' then
    select e.expires_at into deadline from private.voice_batches b
      join private.staging_voice_members m on m.session_id=b.session_id and m.user_id=new.user_id
      join private.staging_voice_epochs e on e.id=m.epoch_id where b.id=new.batch_id;
    if deadline is not null and deadline<=clock_timestamp() then raise exception 'VOICE_SCOPE_EXPIRED'; end if;
  end if;
  return null;
end $$;
revoke all on function private.staging_voice_commit_deadline() from public,anon,authenticated,masarifi_api,masarifi_worker;
create constraint trigger staging_voice_commit_deadline after update on private.voice_events
  deferrable initially deferred for each row execute function private.staging_voice_commit_deadline();

create function private.claim_staging_voice_work(p_epoch uuid,p_worker text,p_limit integer,p_lease integer)
returns table(kind text,id uuid,user_id text,claim_token uuid,attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_lease is null or p_worker is null or p_limit not between 1 and 25 or p_lease not between 10 and 300 or char_length(p_worker) not between 1 and 128 then raise exception 'AI_CLAIM_INVALID'; end if;
  if not private.voice_epoch_open(p_epoch) then return; end if;
  return query with due as (
    select s.id from public.voice_sessions s join private.staging_voice_members m on m.session_id=s.id and m.epoch_id=p_epoch and m.user_id=s.user_id
    join private.voice_batch_context c on c.session_id=s.id and not c.analysis_only
    where s.contract_version=3 and s.content_hash=m.content_hash and s.capture_at=m.capture_at and s.locale=m.locale
      and s.status in ('uploaded','processing') and s.finalized_at is not null and s.expires_at>clock_timestamp()
      and s.deleted_at is null and s.cancelled_at is null and s.next_attempt_at<=clock_timestamp()
      and (s.lease_until is null or s.lease_until<=clock_timestamp()) and not exists(select 1 from private.voice_batches b where b.session_id=s.id)
    order by s.next_attempt_at,s.id for update of s skip locked limit p_limit
  ), updated as (
    update public.voice_sessions s set status='processing',claim_token=extensions.gen_random_uuid(),claimed_by=p_worker,lease_until=clock_timestamp()+make_interval(secs=>p_lease),attempt_count=s.attempt_count+1 from due where s.id=due.id returning s.id,s.user_id,s.claim_token,s.attempt_count
  ) select 'voice.transcribe_extract'::text,u.id,u.user_id,u.claim_token,u.attempt_count from updated u;
end $$;

create function private.claim_staging_voice_finalization(p_epoch uuid,p_limit integer) returns table(batch_id uuid,token uuid)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_limit not between 1 and 25 then raise exception 'VOICE_LIMIT_INVALID'; end if;
  if not private.voice_epoch_open(p_epoch) then return; end if;
  return query with due as (
    select b.id from private.voice_batches b join private.staging_voice_members m on m.session_id=b.session_id and m.epoch_id=p_epoch and m.user_id=b.user_id
    join public.voice_sessions s on s.id=b.session_id join private.voice_batch_context c on c.session_id=s.id and not c.analysis_only
    where b.status='finalizing' and s.expires_at>clock_timestamp() and s.cancelled_at is null and s.deleted_at is null
      and b.next_attempt_at<=clock_timestamp() and (b.lease_until is null or b.lease_until<=clock_timestamp())
    order by b.next_attempt_at,b.id for update of b skip locked limit p_limit
  ) update private.voice_batches b set lease_token=extensions.gen_random_uuid(),lease_until=clock_timestamp()+interval '120 seconds' from due where b.id=due.id returning b.id,b.lease_token;
end $$;

create function private.expire_staging_voice_commands(p_epoch uuid,p_limit integer) returns integer
language plpgsql security definer set search_path='' as $$
declare target record; changed integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 25 then raise exception 'VOICE_LIMIT_INVALID'; end if;
  if not exists(select 1 from private.staging_voice_epochs where id=p_epoch and mode='operating') then return 0; end if;
  for target in select s.id,s.user_id from public.voice_sessions s join private.staging_voice_members m on m.session_id=s.id and m.epoch_id=p_epoch where s.expires_at<=clock_timestamp() and exists(select 1 from private.voice_batches b where b.session_id=s.id and b.status='finalizing') order by s.id limit p_limit loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target.user_id,0));
    perform id from public.voice_sessions where id=target.id for update;
    perform id from private.voice_batches where session_id=target.id for update;
    update private.voice_events set status='execution_failed',completed_at=clock_timestamp() where batch_id in (select id from private.voice_batches where session_id=target.id) and status='eligible';
    delete from private.voice_event_commands where event_id in (select id from private.voice_events where batch_id in (select id from private.voice_batches where session_id=target.id));
    update private.voice_batches set status='failed',completed_at=clock_timestamp(),lease_token=null,lease_until=null where session_id=target.id and status='finalizing';
    update public.voice_sessions set status='failed',failure_code='VOICE_SESSION_EXPIRED' where id=target.id;
    changed:=changed+1;
  end loop;
  return changed;
end $$;

create function private.claim_staging_voice_purge(p_epoch uuid,p_worker text,p_limit integer,p_lease integer)
returns table(id uuid,storage_ref text,purge_token uuid)
language plpgsql security definer set search_path='' as $$
declare claimed integer;
begin
  if p_limit is null or p_lease is null or p_worker is null or p_limit not between 1 and 25 or p_lease not between 10 and 300 or char_length(p_worker) not between 1 and 128 then raise exception 'AI_CLAIM_INVALID'; end if;
  if not exists(select 1 from private.staging_voice_epochs e where e.id=p_epoch and e.mode='operating') then return; end if;
  return query with due as (
    select s.id from public.voice_sessions s join private.staging_voice_members m on m.session_id=s.id and m.epoch_id=p_epoch
    where s.storage_ref is not null and s.next_attempt_at<=clock_timestamp()
      and (s.expires_at<=clock_timestamp() or s.status in ('confirmed','failed','expired') or s.cancelled_at is not null or (s.uploaded_at is null and s.upload_deadline<=clock_timestamp()))
      and coalesce(s.media_capability_expires_at,clock_timestamp())<=clock_timestamp() and coalesce(s.upload_lease_until,clock_timestamp())<=clock_timestamp()
      and (s.lease_until is null or s.lease_until<=clock_timestamp()) order by s.id for update of s skip locked limit p_limit
  ), updated as (
    update public.voice_sessions s set claim_token=extensions.gen_random_uuid(),claimed_by=p_worker,lease_until=clock_timestamp()+make_interval(secs=>p_lease) from due where s.id=due.id returning s.id,s.storage_ref,s.claim_token
  ) select u.id,u.storage_ref,u.claim_token from updated u;
  get diagnostics claimed=row_count;
  if claimed<p_limit then
    return query with due as (
      select t.id from private.voice_media_tombstones t join private.staging_voice_members m on m.session_id=t.id and m.epoch_id=p_epoch
      where t.next_attempt_at<=clock_timestamp() and t.capability_expires_at<=clock_timestamp() and (t.lease_until is null or t.lease_until<=clock_timestamp()) order by t.id for update of t skip locked limit p_limit-claimed
    ), updated as (
      update private.voice_media_tombstones t set claim_token=extensions.gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>p_lease) from due where t.id=due.id returning t.id,t.storage_ref,t.claim_token
    ) select u.id,u.storage_ref,u.claim_token from updated u;
  end if;
end $$;

create function private.staging_voice_heartbeat(p_epoch uuid,p_worker text,p_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; pending integer; failed integer; oldest timestamptz;
begin
  if p_worker is null or char_length(p_worker) not between 1 and 128 then raise exception 'AI_CLAIM_INVALID'; end if;
  select * into e from private.staging_voice_epochs where id=p_epoch;
  if e.id is null or p_source is distinct from e.manifest->>'sourceSha' then raise exception 'VOICE_SCOPE_INVALID'; end if;
  if e.state='active' and e.expires_at<=clock_timestamp() then perform private.close_staging_voice_epoch(e.id,'deadline'); end if;
  update private.staging_voice_epochs set heartbeat_at=clock_timestamp(),worker_id=p_worker where id=e.id;
  select count(*) filter(where s.status in ('uploaded','processing') or b.status='finalizing'),count(*) filter(where s.status='failed' or b.status='failed'),min(s.created_at) filter(where s.status in ('uploaded','processing') or b.status='finalizing') into pending,failed,oldest
    from private.staging_voice_members m join public.voice_sessions s on s.id=m.session_id left join private.voice_batches b on b.session_id=s.id where m.epoch_id=e.id;
  return jsonb_build_object('enabled',private.voice_epoch_open(e.id),'mode',e.mode,'pending',pending,'failed',failed,'oldestPendingAt',oldest,'heartbeatAt',clock_timestamp());
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature,p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in
    ('prepare_staging_voice_epoch','activate_staging_voice_epoch','voice_epoch_open','close_staging_voice_epoch','create_voice_session_v3','accept_voice_batch','get_ai_work_input','execute_voice_event','claim_staging_voice_work','claim_staging_voice_finalization','expire_staging_voice_commands','claim_staging_voice_purge','staging_voice_heartbeat') loop
    execute format('revoke all on function %s from public,anon,authenticated,masarifi_api,masarifi_worker',f.signature);
    if f.name='create_voice_session_v3' then execute format('grant execute on function %s to masarifi_api',f.signature);
    elsif f.name not in ('prepare_staging_voice_epoch','activate_staging_voice_epoch','voice_epoch_open') then execute format('grant execute on function %s to masarifi_worker',f.signature); end if;
  end loop;
end $$;
reset role;
revoke masarifi_migration from current_user granted by current_user;
