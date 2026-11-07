do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.deletion_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.deletion_grant', 'temporary', true);
  end if;
end
$role$;
set local role masarifi_migration;

do $bindings$
declare target record;
begin
  for target in select * from (values
      ('private.assert_account_erasure_request(uuid,text,boolean)','321ef6481195d90f5452e0c81679948c'),
      ('private.freeze_account_deletion_owner(uuid,text)','851f304c5b10e9b8b45949f44746a711'),
      ('private.protect_last_super_admin()','5a1c7a9175e44aa67242802596caed23')
  ) as expected(signature,body_hash) loop
    if not exists (select 1 from pg_proc where oid=target.signature::regprocedure
      and md5(replace(prosrc,chr(13),''))=target.body_hash and prosecdef
      and proowner='masarifi_migration'::regrole) then
      raise exception 'Unexpected definition for %',target.signature;
    end if;
  end loop;
end $bindings$;

CREATE OR REPLACE FUNCTION private.assert_account_erasure_request(p_request uuid, p_owner text, p_frozen boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform 1 from private.account_deletion_requests where id=p_request and user_id=p_owner and status='processing' for update;
  if not found then raise exception using errcode='42501',message='ERASURE_REQUEST_FORBIDDEN'; end if;
  if p_owner is null or p_request is null or not exists(
    select 1 from private.account_deletion_requests d join public.profiles p on p.id=d.user_id
    where d.id=p_request and d.user_id=p_owner and d.status='processing'
      and d.verified_at is not null and d.cooling_off_ends_at<=clock_timestamp()
      and (not p_frozen or p.status in ('deletion_pending','deleted'))
  ) then
    raise exception using errcode='42501',message='ERASURE_REQUEST_FORBIDDEN';
  end if;
  if exists(select 1 from private.retention_holds h where h.starts_at<=clock_timestamp()
    and (h.ends_at is null or h.ends_at>clock_timestamp()) and (
      h.resource_id=p_owner or exists(select 1 from private.account_erasure_resources r
        where r.request_id=p_request and r.resource_id=h.resource_id))) then
    raise exception using errcode='55000',message='ERASURE_ACTIVE_HOLD';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION private.freeze_account_deletion_owner(p_request uuid, p_owner text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.assert_account_erasure_request(p_request,p_owner,false);
  perform 1 from public.profiles where id=p_owner for update;
  perform private.assert_account_erasure_request(p_request,p_owner,false);
  update public.profiles set status='deletion_pending' where id=p_owner and status<>'deleted';
  -- Retain the staff row for audit foreign keys. Revocation removes dashboard access.
  update public.admin_profiles
     set status='revoked', department=null, last_admin_login_at=null, version=version+1
   where user_id=p_owner and (status<>'revoked' or department is not null or last_admin_login_at is not null);
end $function$;

CREATE OR REPLACE FUNCTION private.protect_last_super_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare protected_user text;
begin
  perform pg_advisory_xact_lock(hashtextextended('masarifi:last-super-admin',0));
  if tg_table_name='admin_profiles' then
    -- A confirmed self-erasure has already frozen this exact owner in this transaction.
    if tg_op='UPDATE' and new.user_id=old.user_id and new.status='revoked' and exists (
      select 1 from private.account_deletion_requests d join public.profiles p on p.id=d.user_id
       where d.user_id=old.user_id and d.status='processing' and d.verified_at is not null
         and d.cooling_off_ends_at<=clock_timestamp() and p.status in ('deletion_pending','deleted')
    ) then return new; end if;
    if old.status='active' and exists(
        select 1 from public.admin_role_assignments a join public.roles r on r.id=a.role_id
        where a.user_id=old.user_id and r.key='super-admin' and r.enabled and a.revoked_at is null
          and a.starts_at<=clock_timestamp() and (a.ends_at is null or a.ends_at>clock_timestamp())
      )
    then
      if tg_op='DELETE' then protected_user:=old.user_id;
      elsif new.status<>'active' then protected_user:=old.user_id;
      end if;
    end if;
  elsif tg_table_name='admin_role_assignments' then
    if old.revoked_at is null and old.starts_at<=clock_timestamp() and (old.ends_at is null or old.ends_at>clock_timestamp())
      and exists(select 1 from public.roles where id=old.role_id and key='super-admin' and enabled)
    then
      if tg_op='DELETE' then protected_user:=old.user_id;
      elsif new.user_id<>old.user_id or new.role_id<>old.role_id or new.revoked_at is not null
        or new.starts_at>clock_timestamp() or (new.ends_at is not null and new.ends_at<=clock_timestamp())
      then protected_user:=old.user_id;
      end if;
    end if;
  elsif tg_table_name='roles' and old.key='super-admin' and old.enabled then
    if tg_op='DELETE' then
      raise exception using errcode='23514',message='LAST_SUPER_ADMIN_REQUIRED';
    elsif new.key<>'super-admin' or not new.enabled then
      raise exception using errcode='23514',message='LAST_SUPER_ADMIN_REQUIRED';
    end if;
  end if;
  if protected_user is not null and not exists(
    select 1 from public.admin_profiles p join public.admin_role_assignments a on a.user_id=p.user_id join public.roles r on r.id=a.role_id
    where p.status='active' and p.user_id<>protected_user and r.key='super-admin' and r.enabled and a.revoked_at is null
      and a.starts_at<=clock_timestamp() and (a.ends_at is null or a.ends_at>clock_timestamp())
  ) then raise exception using errcode='23514',message='LAST_SUPER_ADMIN_REQUIRED'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

reset role;
do $role$
begin
  if current_setting('masarifi.deletion_grant') = 'temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
