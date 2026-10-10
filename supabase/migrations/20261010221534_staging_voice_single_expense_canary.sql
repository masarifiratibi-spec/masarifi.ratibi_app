-- Preparation only: this migration never activates Voice or changes financial rows.
-- Preserve v1 Samsung two-capture controls. Version 2 permits exactly one fresh
-- Arabic 10-SAR expense under the same owner/session/account/category/epoch fences.
-- Core transaction/ledger execution, claims, deadlines and permissions are unchanged.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create or replace function private.prepare_staging_voice_epoch(p_project text,p_manifest jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eid uuid; mh text;
begin
  if p_project is distinct from 'qcffvfbpzvpwcwxwjyro' or not coalesce(
    (p_manifest->>'version'='1' and p_manifest->>'mode' in ('canary','operating')
      or p_manifest->>'version'='2' and p_manifest->'version'='2'::jsonb
        and p_manifest->>'mode'='canary'
        and p_manifest->'maxTransactions'='1'::jsonb
        and p_manifest->'maxExpenseMinor'='1000'::jsonb
        and p_manifest->'expenseMinor'='1000'::jsonb
        and p_manifest->>'currency'='SAR' and p_manifest->>'locale'='ar')
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

create or replace function private.create_voice_session_v3(p_user text,p_input jsonb,p_operation uuid,p_seconds integer,p_auth_age integer,p_max_age integer,p_thresholds jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; result jsonb; sid uuid; next_slot smallint; max_captures smallint;
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
    max_captures:=case when e.manifest->>'version'='2' then 1 else 2 end;
    select coalesce(max(slot),0)+1 into next_slot from private.staging_voice_members where epoch_id=e.id;
    if p_user is distinct from e.manifest->>'ownerId' or next_slot>max_captures
      or encode(extensions.digest(coalesce(current_setting('request.jwt.claims',true)::jsonb->>'sid',''),'sha256'),'hex') is distinct from e.manifest->>'clerkSessionHash'
      or p_input->>'locale' is distinct from (case when e.manifest->>'version'='2' then 'ar' when next_slot=1 then 'en' else 'ar' end)
      or (p_input->>'timezoneOffsetMinutes')::integer is distinct from -180
      or (next_slot=2 and not exists(select 1 from private.voice_events v join private.voice_batches b on b.id=v.batch_id join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=e.id and m.slot=1 and v.status='committed')) then raise exception 'VOICE_AUTOMATIC_UNAVAILABLE'; end if;
  end if;
  result:=private.create_voice_session_v3_unscoped(p_user,p_input,p_operation,p_seconds,p_auth_age,p_max_age,p_thresholds);
  sid:=(result->>'id')::uuid;
  insert into private.staging_voice_members(session_id,epoch_id,user_id,locale,capture_at,content_hash,slot)
    values(sid,e.id,p_user,p_input->>'locale',(p_input->>'recordedAt')::timestamptz,p_input->>'contentHash',next_slot);
  return result;
end $$;

create or replace function private.accept_voice_batch(p_session uuid,p_token uuid,p_decisions jsonb,p_policy text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; m private.staging_voice_members; s public.voice_sessions; cmd jsonb; expense_minor integer;
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
  select * into s from public.voice_sessions where id=p_session for update;
  -- A stale extraction response must not close a valid canary before the shared
  -- acceptance implementation checks its lease. Existing batch receipts retain
  -- the underlying idempotent path; new acceptance uses the same work fence.
  if not exists(select 1 from private.voice_batches where session_id=p_session)
    and (s.status<>'processing' or s.claim_token is distinct from p_token
      or s.lease_until is null or s.lease_until<=clock_timestamp()
      or s.cancelled_at is not null or s.deleted_at is not null
      or s.expires_at<=clock_timestamp()) then raise exception 'AI_WORK_FENCE_INVALID'; end if;
  if s.user_id is distinct from m.user_id or s.content_hash is distinct from m.content_hash or s.capture_at is distinct from m.capture_at or s.locale is distinct from m.locale then raise exception 'VOICE_SCOPE_INVALID'; end if;
  if e.mode='canary' then
    expense_minor:=case when e.manifest->>'version'='2' then 1000 else 2500 end;
    cmd:=p_decisions->0->'command';
    if not coalesce(jsonb_typeof(p_decisions)='array' and jsonb_array_length(p_decisions)=1
      and p_decisions->0->>'status'='eligible' and private.voice_command_skip_reason(cmd,null) is null
      and cmd->>'kind'='expense' and cmd->>'amountMinor'=expense_minor::text and cmd->>'currency'='SAR'
      and cmd->>'accountId'=e.manifest->>'accountId' and cmd->>'categoryId'=e.manifest->>'categoryId'
      and ((cmd->>'occurredAt')::timestamptz at time zone 'Asia/Riyadh')::date=(m.capture_at at time zone 'Asia/Riyadh')::date,false) then
      perform private.close_staging_voice_epoch(e.id,'scope_mismatch');
      update public.voice_sessions set status='failed',failure_code='VOICE_SCOPE_INVALID',claim_token=null,claimed_by=null,lease_until=null where id=p_session;
      return jsonb_build_object('accepted',false,'scopeMismatch',true);
    end if;
  end if;
  return private.accept_voice_batch_unscoped(p_session,p_token,p_decisions,p_policy);
end $$;

create or replace function private.execute_voice_event(p_batch uuid,p_token uuid,p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.staging_voice_epochs; m private.staging_voice_members; v private.voice_events; cmd jsonb; result jsonb; n integer; amount numeric; expense_minor integer; max_captures integer;
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
    expense_minor:=case when e.manifest->>'version'='2' then 1000 else 2500 end;
    max_captures:=case when e.manifest->>'version'='2' then 1 else 2 end;
    select command into cmd from private.voice_event_commands where event_id=p_event;
    select count(*),coalesce(sum(t.amount_minor),0) into n,amount from private.voice_events x join private.voice_batches b on b.id=x.batch_id join private.staging_voice_members sm on sm.session_id=b.session_id join public.transactions t on t.id=x.transaction_id where sm.epoch_id=e.id and x.status='committed';
    if not coalesce(cmd->>'kind'='expense' and cmd->>'amountMinor'=expense_minor::text and cmd->>'currency'='SAR'
      and cmd->>'accountId'=e.manifest->>'accountId' and cmd->>'categoryId'=e.manifest->>'categoryId'
      and ((cmd->>'occurredAt')::timestamptz at time zone 'Asia/Riyadh')::date=(m.capture_at at time zone 'Asia/Riyadh')::date
      and n<max_captures and amount+expense_minor<=max_captures*expense_minor,false) then
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
  elsif e.mode='canary' and n=max_captures-1 then
    perform private.close_staging_voice_epoch(e.id,'completed');
  end if;
  return result;
end $$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
