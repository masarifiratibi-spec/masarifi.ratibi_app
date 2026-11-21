grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Only the isolated operating worker uses this capability. Shared API/ledger
-- authentication and the ordinary Voice execution capability stay unchanged.
create function private.execute_operating_voice_event(p_batch uuid,p_token uuid,p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id text; epoch_id uuid; previous_claims text; result jsonb; command jsonb;
begin
  select b.user_id,m.epoch_id into owner_id,epoch_id
  from private.voice_batches b
  join public.voice_sessions s on s.id=b.session_id and s.user_id=b.user_id
  join private.voice_events v on v.batch_id=b.id and v.id=p_event and v.user_id=b.user_id
  join private.staging_voice_members m on m.session_id=s.id and m.user_id=b.user_id
  join private.staging_voice_epochs e on e.id=m.epoch_id and e.mode='operating'
  where b.id=p_batch;
  if owner_id is null then raise exception 'VOICE_SCOPE_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id,0));
  perform 1 from private.staging_voice_epochs where id=epoch_id for update;
  -- A committed receipt does not execute a financial command or need identity.
  if exists(select 1 from private.voice_events where id=p_event and status='committed') then
    return private.execute_voice_event(p_batch,p_token,p_event);
  end if;
  if not private.voice_epoch_open(epoch_id) then raise exception 'VOICE_AUTOMATIC_PAUSED'; end if;
  perform 1 from public.voice_sessions s join private.voice_batches b on b.session_id=s.id
    where b.id=p_batch and s.user_id=owner_id and b.user_id=owner_id
      and s.cancelled_at is null and s.deleted_at is null and s.expires_at>clock_timestamp()
      and b.status='finalizing' and b.lease_token=p_token and b.lease_until>clock_timestamp()
    for update of s,b;
  if not found then raise exception 'VOICE_EXECUTION_FENCE_INVALID'; end if;
  select c.command into command from private.voice_event_commands c
    join private.voice_events v on v.id=c.event_id
    where v.id=p_event and v.batch_id=p_batch and v.user_id=owner_id and c.user_id=owner_id
      and v.status='eligible'
      and c.command_hash=encode(extensions.digest(c.command::text,'sha256'),'hex')
      and c.command->>'externalRef'='voice-event:'||v.id;
  if command is null then raise exception 'VOICE_COMMAND_INTEGRITY_INVALID'; end if;
  previous_claims:=current_setting('request.jwt.claims',true);
  begin
    perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',owner_id)::text,true);
    result:=private.execute_voice_event(p_batch,p_token,p_event);
    perform pg_catalog.set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  exception when others then
    perform pg_catalog.set_config('request.jwt.claims',coalesce(previous_claims,''),true);
    raise;
  end;
  return result;
end $$;
revoke all on function private.execute_operating_voice_event(uuid,uuid,uuid)
  from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.execute_operating_voice_event(uuid,uuid,uuid) to masarifi_worker;

-- Failed media remains under its original expiry; cancellation and expiry still purge.
do $$ declare definition text;
begin
  definition:=pg_get_functiondef('private.claim_staging_voice_purge(uuid,text,integer,integer)'::regprocedure);
  if position('s.status in (''confirmed'',''failed'',''expired'')' in definition)=0 then
    raise exception 'VOICE_PURGE_DEFINITION_UNEXPECTED';
  end if;
  execute replace(definition,'s.status in (''confirmed'',''failed'',''expired'')','s.status in (''confirmed'',''expired'')');
end $$;
reset role;
revoke masarifi_migration from current_user granted by current_user;
