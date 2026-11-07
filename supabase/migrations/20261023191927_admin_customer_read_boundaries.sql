grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;
alter function private.customer_admin(text,jsonb) rename to customer_admin_internal;
revoke all on function private.customer_admin_internal(text,jsonb) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
create function private.customer_admin(p_operation text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_operation in ('detail','devices','sessions-target') then
  perform private.assert_admin_permission(case p_operation when 'devices' then 'devices.read' when 'sessions-target' then 'sessions.read' else 'users.read' end);
  if exists(select 1 from public.admin_profiles where user_id=p_body->>'userId') then raise exception 'CUSTOMER_NOT_FOUND'; end if;
 end if;
 result:=private.customer_admin_internal(p_operation,p_body);
 if p_operation='detail' then
  return result-'plan'-'iosDeviceCount'-'androidDeviceCount'-'webDeviceCount'-'totalDeviceCount';
 end if;
 return result;
end;
$$;
revoke all on function private.customer_admin(text,jsonb) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.customer_admin(text,jsonb) to masarifi_api;
reset role;
revoke masarifi_migration from current_user granted by current_user;
