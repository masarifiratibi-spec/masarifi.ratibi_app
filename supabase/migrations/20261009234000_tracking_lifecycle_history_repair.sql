grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Superseded lifecycle observations retain the existing rejected history
-- outcome; "ignored" is not a valid history value.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.reserve_tracking_capture(uuid,uuid)'::regprocedure);
  updated:=replace(definition,'''ignored'',array[''lifecycle_superseded'']','''rejected'',array[''lifecycle_superseded'']');
  if updated=definition then raise exception 'TRACKING_LIFECYCLE_HISTORY_PRECONDITION'; end if;
  execute updated;
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
