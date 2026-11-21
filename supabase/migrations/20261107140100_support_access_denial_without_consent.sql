do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.support_denial_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.support_denial_grant', 'temporary', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- Refusing access does not grant customer consent. Approval still requires it.
alter table private.support_access_requests drop constraint support_access_requests_customer_check;
alter table private.support_access_requests add constraint support_access_requests_customer_check
  check (not customer_approval_required or status in ('pending','denied') or customer_approved_at is not null);

reset role;

do $role$
begin
  if current_setting('masarifi.support_denial_grant') = 'temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
