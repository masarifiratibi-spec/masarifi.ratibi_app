grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create table private.owner_bootstrap_state (
  singleton boolean primary key default true check(singleton),
  user_id text not null,
  assignment_id uuid not null,
  consumed_at timestamptz not null default clock_timestamp()
);
alter table private.owner_bootstrap_state owner to masarifi_migration;
alter table private.owner_bootstrap_state enable row level security;
alter table private.owner_bootstrap_state force row level security;
grant select,insert on private.owner_bootstrap_state to masarifi_migration;
create policy owner_bootstrap_state_migration_select on private.owner_bootstrap_state
  for select to masarifi_migration using(true);
create policy owner_bootstrap_state_migration_insert on private.owner_bootstrap_state
  for insert to masarifi_migration with check(singleton);

create function private.reject_owner_bootstrap_state_change()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  raise exception using errcode='23514',message='OWNER_BOOTSTRAP_STATE_IMMUTABLE';
end;
$$;
alter function private.reject_owner_bootstrap_state_change() owner to masarifi_migration;
revoke all on function private.reject_owner_bootstrap_state_change() from public;
create trigger owner_bootstrap_state_immutable before update or delete on private.owner_bootstrap_state
for each row execute function private.reject_owner_bootstrap_state_change();

create function private.is_active_super_admin(p_user_id text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.admin_profiles p
    join public.admin_role_assignments a on a.user_id=p.user_id
    join public.roles r on r.id=a.role_id
    where p.user_id=p_user_id and p.status='active' and r.key='super-admin' and r.enabled
      and a.revoked_at is null and a.starts_at<=statement_timestamp()
      and (a.ends_at is null or a.ends_at>statement_timestamp())
  )
$$;
alter function private.is_active_super_admin(text) owner to masarifi_migration;
revoke all on function private.is_active_super_admin(text) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.is_active_super_admin(text) to masarifi_api;

create function private.is_super_admin_role(p_role_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.roles where id=p_role_id and key='super-admin')
$$;
alter function private.is_super_admin_role(uuid) owner to masarifi_migration;
revoke all on function private.is_super_admin_role(uuid) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.is_super_admin_role(uuid) to masarifi_api;

create function private.protect_super_admin_target()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare
  actor text;
  targets_super boolean;
begin
  if current_user <> 'masarifi_api' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  actor := public.current_clerk_user_id();
  if tg_table_name='admin_role_assignments' then
    if tg_op='INSERT' then
      if new.assigned_by<>actor or new.user_id=actor then
        raise exception using errcode='42501',message='ADMIN_ROLE_ASSIGNMENT_DENIED';
      end if;
    elsif tg_op='UPDATE' then
      if new.assigned_by<>old.assigned_by or new.user_id<>old.user_id then
        raise exception using errcode='42501',message='ADMIN_ROLE_ASSIGNMENT_DENIED';
      end if;
    end if;
    if tg_op='DELETE' then
      targets_super := private.is_super_admin_role(old.role_id);
    else
      targets_super := private.is_super_admin_role(new.role_id);
    end if;
    if tg_op='UPDATE' then
      targets_super := targets_super or private.is_super_admin_role(old.role_id);
    end if;
  else
    if tg_op='INSERT' then
      if new.invited_by<>actor then
        raise exception using errcode='42501',message='ADMIN_INVITATION_DENIED';
      end if;
    elsif tg_op='UPDATE' then
      if new.invited_by<>old.invited_by then
        raise exception using errcode='42501',message='ADMIN_INVITATION_DENIED';
      end if;
    end if;
    if tg_op='DELETE' then
      targets_super := private.is_super_admin_role(old.role_id);
    else
      targets_super := private.is_super_admin_role(new.role_id);
    end if;
    if tg_op='UPDATE' then
      targets_super := targets_super or private.is_super_admin_role(old.role_id);
    end if;
  end if;
  if targets_super and not private.is_active_super_admin(actor) then
    raise exception using errcode='42501',message='SUPER_ADMIN_TARGET_REQUIRES_SUPER_ADMIN';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
alter function private.protect_super_admin_target() owner to masarifi_migration;
revoke all on function private.protect_super_admin_target() from public;
create trigger admin_assignments_super_target before insert or update or delete on public.admin_role_assignments
for each row execute function private.protect_super_admin_target();
create trigger admin_invitations_super_target before insert or update or delete on public.admin_invitations
for each row execute function private.protect_super_admin_target();

drop trigger admin_profiles_last_super on public.admin_profiles;
drop trigger admin_assignments_last_super on public.admin_role_assignments;
drop trigger roles_last_super on public.roles;
create or replace function private.protect_last_super_admin()
returns trigger language plpgsql security definer set search_path=''
as $$
declare protected_user text;
begin
  perform pg_advisory_xact_lock(hashtextextended('masarifi:last-super-admin',0));
  if tg_table_name='admin_profiles' then
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
$$;
create trigger admin_profiles_last_super before update or delete on public.admin_profiles
for each row execute function private.protect_last_super_admin();
create trigger admin_assignments_last_super before update or delete on public.admin_role_assignments
for each row execute function private.protect_last_super_admin();
create trigger roles_last_super before update or delete on public.roles
for each row execute function private.protect_last_super_admin();

create or replace function private.accept_admin_invitation(
  p_token_hash text,
  p_verified_email text,
  p_request_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject_id text := public.current_clerk_user_id();
  invitation public.admin_invitations%rowtype;
  assignment_id uuid;
  accepted_now boolean := false;
begin
  if subject_id is null or p_token_hash !~ '^h1:[0-9a-f]{64}$'
    or p_verified_email <> lower(btrim(p_verified_email))
    or p_request_id !~ '^[A-Za-z0-9._:-]{1,128}$'
    or not exists(select 1 from public.profiles where id=subject_id and status='active' and primary_email=p_verified_email)
  then raise exception using errcode='42501',message='INVITATION_ACCEPTANCE_DENIED'; end if;
  select * into invitation from public.admin_invitations
  where token_hash=p_token_hash and email=p_verified_email and revoked_at is null for update;
  if invitation.id is null or (invitation.accepted_at is null and invitation.expires_at<=clock_timestamp()) then
    raise exception using errcode='42501',message='INVITATION_ACCEPTANCE_DENIED';
  end if;
  if invitation.accepted_at is null then
    update public.admin_invitations set accepted_at=clock_timestamp() where id=invitation.id;
    accepted_now := true;
  end if;
  insert into public.admin_profiles(user_id,status) values(subject_id,'active')
  on conflict(user_id) do update set status='active';
  insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
  values(subject_id,invitation.role_id,invitation.invited_by,'Accepted administrator invitation')
  on conflict(user_id,role_id) where revoked_at is null do nothing returning id into assignment_id;
  if assignment_id is null then
    select id into assignment_id from public.admin_role_assignments
    where user_id=subject_id and role_id=invitation.role_id and revoked_at is null;
  end if;
  if assignment_id is null then raise exception using errcode='P0001',message='INVITATION_ACCEPTANCE_FAILED'; end if;
  if accepted_now then
    perform audit.append_event(subject_id,'admin','admin.invitation_accepted','admin_invitation',invitation.id::text,
      null,null,'Accepted administrator invitation',p_request_id,jsonb_build_object('assignmentId',assignment_id::text));
    perform private.enqueue_outbox_event('admin.role_assigned','admin_assignment',assignment_id,
      jsonb_build_object('schemaVersion',1,'adminId',subject_id,'roleId',invitation.role_id,'assignmentId',assignment_id,
        'occurredAt',clock_timestamp(),'requestId',p_request_id));
  end if;
  return assignment_id;
end;
$$;
alter function private.accept_admin_invitation(text,text,text) owner to masarifi_migration;
revoke all on function private.accept_admin_invitation(text,text,text) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.accept_admin_invitation(text,text,text) to masarifi_api;

reset role;
revoke masarifi_migration from current_user granted by current_user;
