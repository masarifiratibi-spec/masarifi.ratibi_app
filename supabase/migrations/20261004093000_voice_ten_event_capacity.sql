-- Extend only the unreleased v3 capacity. No automatic-policy enablement or legacy execution.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;
alter table private.voice_events drop constraint voice_events_ordinal_check;
alter table private.voice_events add constraint voice_events_ordinal_check check(ordinal between 0 and 9);

create or replace function private.accept_voice_batch(p_session uuid,p_token uuid,p_decisions jsonb,p_policy text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions; b private.voice_batches; ctx private.voice_batch_context; decision jsonb; cmd jsonb; eid uuid; ord integer:=0; totals jsonb; currency text; normalized jsonb:='[]'; reason text;
begin
  select * into s from public.voice_sessions where id=p_session and contract_version=3 for update;
  if s.id is null then raise exception 'VOICE_SESSION_NOT_FOUND'; end if;
  if exists(select 1 from private.voice_batches where session_id=s.id) then return jsonb_build_object('accepted',true); end if;
  if s.status<>'processing' or s.claim_token is distinct from p_token or s.lease_until<=clock_timestamp() or s.cancelled_at is not null or s.deleted_at is not null or s.expires_at<=clock_timestamp() then raise exception 'AI_WORK_FENCE_INVALID'; end if;
  if p_policy<>'automatic-or-skip-v3.1' or jsonb_typeof(p_decisions)<>'array' or jsonb_array_length(p_decisions)>10 or pg_column_size(p_decisions)>24000 then raise exception 'AI_SCHEMA_INVALID'; end if;
  for decision in select value from jsonb_array_elements(p_decisions) loop
    if jsonb_typeof(decision)='object' and decision->>'status'='eligible' and (decision-array['status','command'])='{}'::jsonb then
      reason:=private.voice_command_skip_reason(decision->'command',null);
      if reason is not null then decision:=jsonb_build_object('status','skipped','reason',reason); end if;
    elsif not coalesce(jsonb_typeof(decision)='object' and decision->>'status'='skipped' and (decision-array['status','reason'])='{}'::jsonb and decision->>'reason'=any(array['missing_amount','ambiguous_account','invalid_category','invalid_date','currency_mismatch','unsupported_event','authorization_required','invalid_event']),false) then
      decision:=jsonb_build_object('status','skipped','reason','invalid_event');
    end if;
    normalized:=normalized||jsonb_build_array(decision);
  end loop;
  p_decisions:=normalized;
  select * into ctx from private.voice_batch_context where session_id=s.id;
  select coalesce(jsonb_object_agg(x.currency,x.total),'{}') into totals from (
    select d->'command'->>'currency' currency,sum((d->'command'->>'amountMinor')::numeric) total from jsonb_array_elements(p_decisions) d where d->>'status'='eligible' group by 1
  ) x;
  insert into private.voice_batches(session_id,user_id,policy_version) values(s.id,s.user_id,p_policy) returning * into b;
  for decision in select value from jsonb_array_elements(p_decisions) loop
    if decision->>'status'='eligible' then
      cmd:=decision->'command'; currency:=cmd->>'currency';
      if (ctx.thresholds->>currency)::numeric <= (totals->>currency)::numeric and (ctx.auth_expires_at is null or ctx.auth_expires_at<clock_timestamp()) then
        decision:=jsonb_build_object('status','skipped','reason','authorization_required');
      end if;
    end if;
    if decision->>'status'='skipped' then
      if (decision-array['status','reason'])<>'{}'::jsonb then raise exception 'AI_SCHEMA_INVALID'; end if;
      insert into private.voice_events(batch_id,user_id,ordinal,status,reason_code,completed_at) values(b.id,s.user_id,ord,'skipped',decision->>'reason',clock_timestamp());
    elsif decision->>'status'='eligible' then
      if (decision-array['status','command'])<>'{}'::jsonb or jsonb_typeof(cmd)<>'object' or cmd->>'kind' not in ('expense','income') or cmd->>'source'<>'voice' or (cmd->>'amountMinor')::numeric not between 1 and 9007199254740991 then raise exception 'AI_SCHEMA_INVALID'; end if;
      insert into private.voice_events(batch_id,user_id,ordinal,status) values(b.id,s.user_id,ord,'eligible') returning id into eid;
      cmd:=cmd||jsonb_build_object('externalRef','voice-event:'||eid);
      insert into private.voice_event_commands(event_id,user_id,command,command_hash,requires_recent_auth) values(eid,s.user_id,cmd,encode(extensions.digest(cmd::text,'sha256'),'hex'),coalesce((ctx.thresholds->>currency)::numeric <= (totals->>currency)::numeric,false));
    else raise exception 'AI_SCHEMA_INVALID'; end if;
    ord:=ord+1;
  end loop;
  update public.voice_sessions set status='proposed',claim_token=null,claimed_by=null,lease_until=null where id=s.id;
  if not exists(select 1 from private.voice_events where batch_id=b.id and status='eligible') then
    update private.voice_batches set status='completed',completed_at=clock_timestamp() where id=b.id;
    update public.voice_sessions set status='confirmed',confirmed_at=clock_timestamp() where id=s.id;
  end if;
  return jsonb_build_object('accepted',true,'batchId',b.id);
end $$;

create or replace function private.get_ai_work_input(p_kind text,p_id uuid,p_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; ctx private.voice_batch_context; version_value integer;
begin
  result:=private.get_ai_work_input_v2(p_kind,p_id,p_token);
  if p_kind='voice.transcribe_extract' then
    select contract_version into version_value from public.voice_sessions where id=p_id;
    if version_value=3 then
      select * into ctx from private.voice_batch_context where session_id=p_id;
      result:=result||jsonb_build_object('contractVersion',3,'defaultAccountId',ctx.default_account_id);
      result:=jsonb_set(result,'{aliases}',coalesce((
        select jsonb_agg(case when ref->>'kind'='account' then
          jsonb_set(ref,'{data}',ref->'data'||coalesce((
            select jsonb_build_object('name',a.name,'minorUnit',c.minor_unit)
            from public.accounts a join public.currencies c on c.code=a.currency_code
            where a.id=(ref->>'id')::uuid and a.user_id=ctx.user_id and a.status='active' and a.deleted_at is null and c.enabled
          ),'{}'::jsonb)) else ref end order by ref->>'alias')
        from jsonb_array_elements(result->'aliases') ref
      ),'[]'::jsonb));
    end if;
  end if;
  return result;
end $$;
alter function private.get_ai_work_input(text,uuid,uuid) owner to masarifi_migration;
revoke all on function private.get_ai_work_input(text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_ai_work_input(text,uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
