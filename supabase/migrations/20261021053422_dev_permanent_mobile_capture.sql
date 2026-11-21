grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create table private.dev_mobile_installations (
  user_id text not null references public.profiles(id) on delete cascade,
  tracking_device_id text not null,
  notification_device_id uuid not null references public.user_devices(id) on delete cascade,
  enabled boolean not null default true,
  reminders_enabled boolean not null default false,
  reminder_locale text check(reminder_locale in ('ar','en')),
  reminder_timezone text,
  last_foreground_at timestamptz,
  enrolled_at timestamptz not null default clock_timestamp(),
  primary key(user_id,tracking_device_id),
  unique(user_id,notification_device_id)
);
alter table private.dev_mobile_installations enable row level security;
alter table private.dev_mobile_installations force row level security;
create policy dev_mobile_installations_migration on private.dev_mobile_installations
  to masarifi_migration using(true) with check(true);
revoke all on private.dev_mobile_installations from public,anon,authenticated,masarifi_api,masarifi_worker;

alter table private.tracking_automatic_cohorts add column installation_managed boolean not null default false;
do $migration$
declare constraint_name text;
begin
  select conname into strict constraint_name from pg_constraint
    where conrelid='private.tracking_automatic_cohorts'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%expires_at%';
  execute format('alter table private.tracking_automatic_cohorts drop constraint %I',constraint_name);
end $migration$;
alter table private.tracking_automatic_cohorts add constraint tracking_cohort_expiry
  check(expires_at<=created_at+interval '7 days' or (installation_managed and expires_at='infinity'::timestamptz));

-- An installation-managed policy never promotes the owner's other installations.
create or replace function private.get_tracking_rule_snapshot_before_nominal(p_user_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select private.get_tracking_rule_snapshot_base(p_user_id)||jsonb_build_object('configurationRevision',private.tracking_configuration_revision(p_user_id))
    ||case when exists(select 1 from private.tracking_automatic_cohorts cohort
      join public.tracking_rule_channels c on c.release_id=cohort.release_id
      join public.tracking_rule_releases r on r.id=c.release_id
      join public.tracking_preferences p on p.user_id=cohort.user_id
      where cohort.user_id=p_user_id and not cohort.installation_managed and cohort.enabled and cohort.expires_at>clock_timestamp()
      and p.enabled and not p.review_required and r.status='published' and cohort.engine_version=r.engine_version
      and c.environment='default' and c.market='global' and c.channel='all')
    then jsonb_build_object('rolloutMode','automatic') else '{}'::jsonb end;
$$;

create or replace function private.tracking_content_cohort(p_user_id text,p_device_id text)
returns setof private.tracking_automatic_cohorts
language sql stable security definer set search_path='' as $$
  select cohort.* from private.tracking_automatic_cohorts cohort
    join public.tracking_rule_channels c on c.release_id=cohort.release_id
    join public.tracking_rule_releases r on r.id=c.release_id
    join public.tracking_preferences p on p.user_id=cohort.user_id
    join public.profiles owner on owner.id=cohort.user_id and owner.status='active'
    where cohort.user_id=p_user_id and cohort.device_id=p_device_id
      and cohort.source_admission_policy='financial_content_v1'
      and cohort.enabled and cohort.expires_at>clock_timestamp()
      and p.enabled and not p.review_required and r.status='published'
      and cohort.engine_version=r.engine_version
      and c.environment='default' and c.market='global' and c.channel='all'
      and (not cohort.installation_managed or exists(select 1 from private.dev_mobile_installations installation
        join public.user_devices d on d.id=installation.notification_device_id and d.user_id=installation.user_id and d.revoked_at is null
        where installation.user_id=cohort.user_id and installation.tracking_device_id=cohort.device_id and installation.enabled));
$$;

create or replace function private.get_tracking_device_rule_snapshot(p_user_id text,p_device_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare configuration jsonb; cohort private.tracking_automatic_cohorts;
begin
  configuration:=private.get_tracking_device_rule_snapshot_before_currency_accounts(p_user_id,p_device_id);
  select * into cohort from private.tracking_content_cohort(p_user_id,p_device_id);
  if cohort.user_id is null then return configuration; end if;
  return configuration
    ||case when cohort.currency_account_policy='source_currency_v1' then '{"currencyAccountPolicy":"source_currency_v1"}'::jsonb else '{}'::jsonb end
    ||case when cohort.installation_managed then '{"rolloutMode":"automatic"}'::jsonb else '{}'::jsonb end;
end $$;

create function private.enroll_dev_mobile_installation(
  p_user_id text,p_tracking_device_id text,p_notification_device_id uuid,p_sms_activation_id text,
  p_reminders_enabled boolean,p_foreground boolean,p_reminder_locale text,p_reminder_timezone text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare release public.tracking_rule_releases; installation private.dev_mobile_installations;
begin
  perform private.assert_active_profile(p_user_id);
  if p_tracking_device_id is null or p_tracking_device_id !~ '^[0-9a-fA-F-]{36}$'
    or p_sms_activation_id is null or p_sms_activation_id !~ '^[0-9]{1,19}$'
    or p_sms_activation_id::numeric>9223372036854775807
    or p_reminders_enabled is null or p_foreground is null
    or p_reminder_locale is null or p_reminder_locale not in ('ar','en')
    or p_reminder_timezone is null or not exists(select 1 from pg_timezone_names where name=p_reminder_timezone) then
    raise exception using errcode='22023',message='TRACKING_INSTALLATION_INPUT_INVALID';
  end if;
  perform 1 from public.user_devices where id=p_notification_device_id and user_id=p_user_id
    and revoked_at is null and platform='android'
    and clerk_session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid' for update;
  if not found then raise exception using errcode='22023',message='DEVICE_NOT_FOUND'; end if;
  select r.* into release from public.tracking_rule_channels c join public.tracking_rule_releases r on r.id=c.release_id
    where c.environment='default' and c.market='global' and c.channel='all' and r.status='published' and r.engine_version='2.0.0';
  if release.id is null then raise exception using errcode='22023',message='TRACKING_RELEASE_REQUIRED'; end if;
  insert into private.dev_mobile_installations(user_id,tracking_device_id,notification_device_id,reminders_enabled,last_foreground_at,reminder_locale,reminder_timezone)
    values(p_user_id,p_tracking_device_id,p_notification_device_id,p_reminders_enabled,case when p_foreground then clock_timestamp() end,p_reminder_locale,p_reminder_timezone)
    on conflict(user_id,tracking_device_id) do update set reminders_enabled=excluded.reminders_enabled,
      last_foreground_at=case when p_foreground then excluded.last_foreground_at else dev_mobile_installations.last_foreground_at end,
      reminder_locale=excluded.reminder_locale,reminder_timezone=excluded.reminder_timezone
    where dev_mobile_installations.notification_device_id=excluded.notification_device_id
    returning * into installation;
  if installation.user_id is null then raise exception using errcode='22023',message='TRACKING_DEVICE_BINDING_CONFLICT'; end if;
  insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,enabled,expires_at,reason,
    source_admission_policy,capture_started_at,sms_activation_id,currency_account_policy,installation_managed)
    values(p_user_id,p_tracking_device_id,release.id,release.engine_version,true,'infinity','Authenticated mobile installation enrollment',
      'financial_content_v1',clock_timestamp(),p_sms_activation_id,'source_currency_v1',true)
    on conflict(user_id,device_id) do update set release_id=excluded.release_id,engine_version=excluded.engine_version,
      expires_at=excluded.expires_at,installation_managed=true,source_admission_policy=excluded.source_admission_policy,
      currency_account_policy=excluded.currency_account_policy,
      capture_started_at=coalesce(tracking_automatic_cohorts.capture_started_at,excluded.capture_started_at),
      sms_activation_id=greatest(tracking_automatic_cohorts.sms_activation_id::numeric,excluded.sms_activation_id::numeric)::text;
  return private.get_tracking_device_rule_snapshot(p_user_id,p_tracking_device_id);
end $$;
revoke all on function private.enroll_dev_mobile_installation(text,text,uuid,text,boolean,boolean,text,text) from public,anon,authenticated,masarifi_worker;
grant execute on function private.enroll_dev_mobile_installation(text,text,uuid,text,boolean,boolean,text,text) to masarifi_api;
revoke all on function private.get_tracking_device_rule_snapshot(text,text),private.get_tracking_rule_snapshot(text) from public,anon,authenticated,masarifi_worker;
grant execute on function private.get_tracking_device_rule_snapshot(text,text),private.get_tracking_rule_snapshot(text) to masarifi_api;

reset role;
revoke masarifi_migration from current_user granted by current_user;
