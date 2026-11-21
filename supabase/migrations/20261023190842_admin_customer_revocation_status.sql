grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;
create function private.customer_admin_revocation_status(p_user_id text) returns text
language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
 perform private.assert_admin_permission('users.read');
 select case when bool_or(status='failed') then 'failed'
   when bool_or(status='pending') then 'pending'
   when count(*)>0 then 'completed' end into result
 from private.customer_session_commands where user_id=p_user_id and operation<>'reactivate';
 return result;
end;
$$;
revoke all on function private.customer_admin_revocation_status(text) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.customer_admin_revocation_status(text) to masarifi_api;
reset role;
revoke masarifi_migration from current_user granted by current_user;
