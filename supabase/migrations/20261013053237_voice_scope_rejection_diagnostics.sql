-- Diagnostic labels only. Do not activate posting, retain commands or modify financial rows.
-- The existing acceptance expression, lease/receipt fencing and closure remain unchanged.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create function private.voice_canary_scope_mismatch_reason(p_decisions jsonb,p_minor integer,p_manifest jsonb,p_capture timestamptz)
returns text language plpgsql security invoker set search_path='' as $$
declare cmd jsonb;
begin
  if jsonb_typeof(p_decisions) is distinct from 'array' then return 'decision_count'; end if;
  if jsonb_array_length(p_decisions)<>1 then return 'decision_count'; end if;
  if p_decisions->0->>'status' is distinct from 'eligible' then return 'decision_status'; end if;
  cmd:=p_decisions->0->'command';
  if private.voice_command_skip_reason(cmd,null) is not null then return 'command_validity'; end if;
  if cmd->>'kind' is distinct from 'expense' then return 'kind'; end if;
  if cmd->>'amountMinor' is distinct from p_minor::text then return 'amount'; end if;
  if cmd->>'currency' is distinct from 'SAR' then return 'currency'; end if;
  if cmd->>'accountId' is distinct from p_manifest->>'accountId' then return 'account'; end if;
  if cmd->>'categoryId' is distinct from p_manifest->>'categoryId' then return 'category'; end if;
  if ((cmd->>'occurredAt')::timestamptz at time zone 'Asia/Riyadh')::date
      is distinct from (p_capture at time zone 'Asia/Riyadh')::date then return 'capture_date'; end if;
  return 'unknown';
exception when others then
  -- Diagnostics must not replace the authoritative fail-closed rejection.
  return 'unknown';
end $$;
revoke all on function private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

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
  select * into s from public.voice_sessions where id=p_session for update;
  if s.user_id is distinct from m.user_id or s.content_hash is distinct from m.content_hash or s.capture_at is distinct from m.capture_at or s.locale is distinct from m.locale then raise exception 'VOICE_SCOPE_INVALID'; end if;
  -- Already accepted extraction is a receipt read, including after closure.
  -- Do not reinterpret duplicate decisions or change the accepted command.
  if exists(select 1 from private.voice_batches where session_id=p_session) then
    return private.accept_voice_batch_unscoped(p_session,p_token,p_decisions,p_policy);
  end if;
  if not private.voice_epoch_open(e.id) then raise exception 'VOICE_AUTOMATIC_PAUSED'; end if;
  -- A stale extraction response must not close a valid canary before the shared
  -- acceptance implementation checks its lease. Existing batch receipts retain
  -- the underlying idempotent path; new acceptance uses the same work fence.
  if s.status<>'processing' or s.claim_token is distinct from p_token
      or s.lease_until is null or s.lease_until<=clock_timestamp()
      or s.cancelled_at is not null or s.deleted_at is not null
      or s.expires_at<=clock_timestamp() then raise exception 'AI_WORK_FENCE_INVALID'; end if;
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
      return jsonb_build_object('accepted',false,'scopeMismatch',true,
        'scopeMismatchReason',private.voice_canary_scope_mismatch_reason(p_decisions,expense_minor,e.manifest,m.capture_at));
    end if;
  end if;
  return private.accept_voice_batch_unscoped(p_session,p_token,p_decisions,p_policy);
end $$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
