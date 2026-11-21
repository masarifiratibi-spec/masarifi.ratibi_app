grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- The general cleanup worker must respect the same original DEV media deadline.
do $$ declare definition text; needle text:='where s.storage_ref is not null and s.next_attempt_at<=clock_timestamp()';
begin
  definition:=pg_get_functiondef('private.claim_voice_media_purge(text,integer,integer)'::regprocedure);
  if position(needle in definition)=0 then raise exception 'VOICE_PURGE_DEFINITION_UNEXPECTED'; end if;
  execute replace(definition,needle,needle||$guard$
      and not (s.status='failed' and s.expires_at>clock_timestamp() and s.cancelled_at is null
        and exists(select 1 from private.staging_voice_members m join private.staging_voice_epochs e on e.id=m.epoch_id
          where m.session_id=s.id and m.user_id=s.user_id and e.mode='operating'))$guard$);
end $$;
reset role;
revoke masarifi_migration from current_user granted by current_user;
