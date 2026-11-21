grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

do $$ declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.claim_staging_voice_finalization(uuid,integer)'::regprocedure);
  needle:='where b.status=''finalizing''';
  if position(needle in definition)=0 then raise exception 'VOICE_CLAIM_DEFINITION_UNEXPECTED'; end if;
  execute replace(definition,needle,needle||' and exists(select 1 from public.profiles p where p.id=b.user_id and p.status=''active'')');
  definition:=pg_get_functiondef('private.fail_operating_voice_event(uuid,uuid,uuid)'::regprocedure);
  needle:='  perform 1 from public.voice_sessions where id=b.session_id for update;';
  if position(needle in definition)=0 then raise exception 'VOICE_FAILURE_DEFINITION_UNEXPECTED'; end if;
  execute replace(definition,needle,$guard$  if not exists(select 1 from public.profiles where id=b.user_id and status='active') then
    return jsonb_build_object('settled',false);
  end if;
$guard$||needle);
end $$;

create function private.release_operating_voice_finalization(p_batch uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare b private.voice_batches;
begin
  select x.* into b from private.voice_batches x join private.staging_voice_members m
    on m.session_id=x.session_id and m.user_id=x.user_id
    join private.staging_voice_epochs e on e.id=m.epoch_id and e.mode='operating'
    where x.id=p_batch;
  if b.id is null then raise exception 'VOICE_SCOPE_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(b.user_id,0));
  -- Frozen-owner payloads belong to the privacy eraser. Do not mutate them or
  -- close all other owners' operating admission; let the existing lease expire.
  perform 1 from public.profiles where id=b.user_id and status='active' for share;
  if not found then return false; end if;
  return private.retry_voice_finalization(p_batch,p_token);
end $$;
revoke all on function private.release_operating_voice_finalization(uuid,uuid)
  from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.release_operating_voice_finalization(uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
