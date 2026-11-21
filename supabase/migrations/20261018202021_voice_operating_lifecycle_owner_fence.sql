grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Lock active profiles before their payloads. Frozen payloads belong to the
-- privacy eraser and must not stop processing for other operating owners.
do $$ declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.expire_staging_voice_commands(uuid,integer)'::regprocedure);
  needle:='where s.expires_at<=clock_timestamp()';
  if position(needle in definition)=0 then raise exception 'VOICE_EXPIRY_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,'join public.profiles p on p.id=s.user_id and p.status=''active'' '||needle);
  needle:='    perform id from public.voice_sessions where id=target.id for update;';
  if position(needle in definition)=0 then raise exception 'VOICE_EXPIRY_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,$guard$    perform 1 from public.profiles where id=target.user_id and status='active' for share;
    if not found then continue; end if;
$guard$||needle);
  execute definition;

  definition:=pg_get_functiondef('private.claim_staging_voice_purge(uuid,text,integer,integer)'::regprocedure);
  needle:='where s.storage_ref is not null';
  if position(needle in definition)=0 then raise exception 'VOICE_PURGE_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,'join public.profiles p on p.id=s.user_id and p.status=''active'' '||needle);
  definition:=replace(definition,'for update of s skip locked','for share of p skip locked for update of s skip locked');
  needle:='where t.next_attempt_at<=clock_timestamp()';
  if position(needle in definition)=0 then raise exception 'VOICE_PURGE_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,'join public.profiles p on p.id=m.user_id and p.status=''active'' '||needle);
  definition:=replace(definition,'for update of t skip locked','for share of p skip locked for update of t skip locked');
  execute definition;

  definition:=pg_get_functiondef('private.claim_staging_voice_work(uuid,text,integer,integer)'::regprocedure);
  needle:='where s.contract_version=3';
  if position(needle in definition)=0 then raise exception 'VOICE_WORK_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,'join public.profiles p on p.id=s.user_id and p.status=''active'' '||needle);
  definition:=replace(definition,'for update of s skip locked','for share of p skip locked for update of s skip locked');
  execute definition;

  definition:=pg_get_functiondef('private.claim_staging_voice_finalization(uuid,integer)'::regprocedure);
  needle:='where b.status=''finalizing''';
  if position(needle in definition)=0 then raise exception 'VOICE_CLAIM_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,'join public.profiles p on p.id=b.user_id and p.status=''active'' '||needle);
  definition:=replace(definition,'for update of b skip locked','for share of p skip locked for update of b skip locked');
  execute definition;
end $$;

-- Storage deletion is asynchronous: a profile can freeze after the purge lease.
-- Fence only operating DEV members; ordinary purge behavior stays unchanged.
do $$ declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.complete_voice_media_purge(uuid,uuid,boolean,text)'::regprocedure);
  needle:='begin';
  if position(needle in definition)=0 then raise exception 'VOICE_PURGE_COMPLETE_DEFINITION_UNEXPECTED'; end if;
  definition:=overlay(definition placing $guard$begin
  if exists(select 1 from private.staging_voice_members m join private.staging_voice_epochs e on e.id=m.epoch_id
    where m.session_id=p_id and e.mode='operating') then
    perform 1 from public.profiles p join private.staging_voice_members m on m.user_id=p.id
      where m.session_id=p_id and p.status='active' for share of p;
    if not found then return false; end if;
  end if;
$guard$ from position(needle in definition) for char_length(needle));
  execute definition;
end $$;
reset role;
revoke masarifi_migration from current_user granted by current_user;
