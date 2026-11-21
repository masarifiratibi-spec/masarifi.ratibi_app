-- Synthetic fixture only. All changes, including fixture membership edits, roll back.
begin;
do $$
begin
  if current_database() <> 'qa41_dashboard_deletion' or inet_server_addr() <> '127.0.0.1'::inet
     or inet_server_port() <> 55442 then raise exception 'Wrong local fixture'; end if;
end $$;
set local role masarifi_migration;
do $$
declare
  owner_id text := 'self_erase_super_' || gen_random_uuid()::text;
  request_id uuid := gen_random_uuid();
begin
  insert into public.profiles(id,status) values(owner_id,'active');
  insert into public.admin_profiles(user_id,status) values(owner_id,'active');
  insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
    select owner_id,id,owner_id,'Local erasure fixture' from public.roles where key='super-admin';
  update public.admin_profiles set status='suspended'
   where user_id<>owner_id and status='active';
  if not private.admin_has_permission(owner_id,'admin.overview.read',clock_timestamp()) then
    raise exception 'Missing initial admin access'; end if;
  begin
    update public.admin_profiles set status='revoked' where user_id=owner_id;
    raise exception 'Unrelated last-admin revocation succeeded';
  exception when check_violation then
    if sqlerrm <> 'LAST_SUPER_ADMIN_REQUIRED' then raise; end if;
  end;
  insert into private.account_deletion_requests(id,user_id,status,verified_at,cooling_off_ends_at)
    values(request_id,owner_id,'processing',clock_timestamp(),clock_timestamp());
  begin
    perform private.freeze_account_deletion_owner(request_id,owner_id || '_foreign');
    raise exception 'Wrong owner was accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'ERASURE_REQUEST_FORBIDDEN' then raise; end if;
  end;
  perform private.freeze_account_deletion_owner(request_id,owner_id);
  perform private.freeze_account_deletion_owner(request_id,owner_id);
  if not exists(select from public.admin_profiles where user_id=owner_id and status='revoked')
    or private.admin_has_permission(owner_id,'admin.overview.read',clock_timestamp()) then
    raise exception 'Dashboard access survived freeze';
  end if;
  perform private.prepare_account_owner_erasure(request_id,owner_id);
  perform * from private.lock_account_erasure_objects(request_id,owner_id);
  perform private.erase_account_owner_payload(request_id,owner_id);
end $$;
rollback;
