do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.report_wake_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.report_wake_grant', 'temporary', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- A wake hint contains no identifiers. PostgreSQL delivers it only on commit.
-- The existing worker-only selector remains authoritative for scope and eligibility.
create function private.wake_requested_pdf_email() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_notify('masarifi_requested_pdf_email', '');
  return null;
end $$;
revoke all on function private.wake_requested_pdf_email() from public;

create trigger requested_pdf_email_wake
after insert or update of delivery_status, error_code, attempt_count on private.report_output_attempts
for each row when (
  new.schedule_id is null and new.snapshot->>'format'='pdf' and new.snapshot->>'delivery'='email'
  and (new.delivery_status in ('queued','generating','ready','sending')
       or (new.delivery_status='failed' and new.error_code='REPORT_STORAGE_UNAVAILABLE' and new.attempt_count<20))
) execute function private.wake_requested_pdf_email();

create trigger requested_pdf_email_owner_wake
after update of status, deleted_at on public.profiles
for each row when (
  new.status='active' and new.deleted_at is null
  and (old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at)
) execute function private.wake_requested_pdf_email();

reset role;

do $role$
begin
  if current_setting('masarifi.report_wake_grant')='temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
