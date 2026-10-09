grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Extend the existing audited command rather than introducing a privileged
-- bypass. Preserve its permission, actor, idempotency and version checks.
do $migration$
declare
  definition text := replace(pg_get_functiondef('private.execute_operations_command(text,text,jsonb,text,text,text)'::regprocedure), E'\r\n', E'\n');
  branch text := $needle$  elsif p_operation='updateSetting' then
    select version into current_version from private.system_settings where setting_key=p_resource_key for update;$needle$;
  allowance text := $needle$(setting_key='operations.ai.allowance' and p_body->'value'='5'::jsonb)$needle$;
begin
  if strpos(definition,'ai.user.rolling_limit') > 0
    or (length(definition)-length(replace(definition,branch,'')))/length(branch) <> 1
    or (length(definition)-length(replace(definition,allowance,'')))/length(allowance) <> 1 then
    raise exception 'GOVERNED_AI_LIMIT_BASELINE_MISMATCH';
  end if;
  definition := replace(definition,branch,branch || $guard$
    if p_resource_key='ai.user.rolling_limit' then
      perform private.assert_admin_permission('ai.routes.manage');
      if jsonb_typeof(p_body->'value') is distinct from 'number'
        or coalesce(p_body->>'value','') !~ '^([1-9][0-9]{0,2}|1000)$' then
        raise exception using errcode='22023',message='OPERATIONS_SETTING_VALUE_INVALID';
      end if;
    end if;$guard$);
  definition := replace(definition,allowance,
    $allowed$(setting_key='ai.user.rolling_limit' and jsonb_typeof(p_body->'value')='number'
          and p_body->>'value' ~ '^([1-9][0-9]{0,2}|1000)$') or $allowed$ || allowance);
  execute definition;
end;
$migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
