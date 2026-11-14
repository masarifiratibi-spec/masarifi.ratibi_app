grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Keep legacy numeric validators from casting unrelated quota JSON values.
-- AND/OR order is not an evaluation boundary; a custom plan can fold the
-- body parameter's cast before checking the setting key. The CASE input
-- depends on the target row, so the cast only receives that key's value.
do $migration$
declare
  definition text := replace(pg_get_functiondef('private.execute_operations_command(text,text,jsonb,text,text,text)'::regprocedure), E'\r\n', E'\n');
  setting_name text;
  needle text;
  replacement text;
begin
  foreach setting_name in array array['operations.history.retention_days', 'operations.provider.timeout_ms', 'operations.performance.series_limit'] loop
    needle := format('(setting_key=%L and (p_body->>''value'')::integer between', setting_name);
    replacement := format('(setting_key=%L and (case when setting_key=%L then p_body->>''value'' end)::integer between', setting_name, setting_name);
    if strpos(definition, needle) = 0 or strpos(definition, replacement) > 0 then
      raise exception 'AI_USAGE_SETTING_VALIDATION_BASELINE_MISMATCH';
    end if;
    definition := replace(definition, needle, replacement);
  end loop;
  execute definition;
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
