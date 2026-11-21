-- Preserve grantor-specific memberships and options of the invoking executor.
do $$
begin
  perform set_config('masarifi.tracking_migration_executor_role',current_setting('role'),true);
  perform set_config('masarifi.tracking_migration_membership','unchanged',true);
  if not pg_has_role(current_user,'masarifi_migration','SET') then
    if exists(select 1 from pg_auth_members where roleid='masarifi_migration'::regrole
      and member=current_user::regrole and grantor=current_user::regrole) then
      grant masarifi_migration to current_user with set true granted by current_user;
      perform set_config('masarifi.tracking_migration_membership','restore_set_false',true);
    else
      grant masarifi_migration to current_user with set true,inherit false granted by current_user;
      perform set_config('masarifi.tracking_migration_membership','temporary',true);
    end if;
  end if;
end $$;
set local role masarifi_migration;

-- Explicit production authority has its own storage. No DEV row is enrolled or changed.
create table private.tracking_installations (
  user_id text not null references public.profiles(id) on delete cascade,
  tracking_device_id uuid not null,
  notification_device_id uuid not null references public.user_devices(id) on delete cascade,
  clerk_session_id text not null check(char_length(clerk_session_id) between 1 and 256),
  version integer not null check(version>0),
  generation uuid not null,
  sources jsonb not null check(jsonb_typeof(sources)='object'),
  authority_revoked boolean not null default false,
  last_expected_version integer,
  last_command_hash text check(last_command_hash ~ '^[a-f0-9]{64}$'),
  last_response jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(user_id,tracking_device_id)
);
create index tracking_installations_registered_device on private.tracking_installations(notification_device_id);
alter table private.tracking_installations enable row level security;
alter table private.tracking_installations force row level security;
create policy tracking_installations_migration on private.tracking_installations
  to masarifi_migration using(true) with check(true);
revoke all on private.tracking_installations from public,anon,authenticated,masarifi_api,masarifi_worker;
-- Only the asserted command writes approvals. Revocation triggers must also work
-- after a profile becomes inactive, so the ordinary payload-write fence is not used here.

create function private.tracking_installation_active(p_owner text,p_device uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.tracking_installations i
    join public.profiles owner on owner.id=i.user_id and owner.status='active'
    join public.tracking_preferences p on p.user_id=i.user_id and p.enabled
    join public.user_devices d on d.id=i.notification_device_id and d.user_id=i.user_id
      and d.platform='android' and d.revoked_at is null and d.clerk_session_id=i.clerk_session_id
    where i.user_id=p_owner and i.tracking_device_id=p_device and not i.authority_revoked
      and (i.sources->>'smsEnabled'='true' or i.sources->>'notificationEnabled'='true'));
$$;

create function private.tracking_installation_configuration(p_owner text,p_device uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i private.tracking_installations; configuration jsonb; receipt jsonb; allowed boolean; review_required boolean;
begin
  select * into i from private.tracking_installations where user_id=p_owner and tracking_device_id=p_device;
  if i.user_id is null then raise exception 'TRACKING_INSTALLATION_NOT_FOUND'; end if;
  allowed:=private.tracking_installation_active(p_owner,p_device)
    and i.clerk_session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
  receipt:=jsonb_build_object('deviceId',i.tracking_device_id,'version',i.version,'generation',i.generation,
    'sessionBinding',encode(extensions.digest('masarifi:tracking:session:v1:'||i.user_id||':'||i.clerk_session_id,'sha256'),'hex'),
    'sources',i.sources,'captureAllowed',coalesce(allowed,false));
  begin
    configuration:=private.get_tracking_rule_snapshot(p_owner);
  exception when sqlstate '22023' then
    if sqlerrm<>'TRACKING_RULES_UNAVAILABLE' then raise; end if;
    return jsonb_build_object('installation',receipt||'{"captureAllowed":false}'::jsonb,'configurationAvailable',false);
  end;
  select p.review_required into review_required from public.tracking_preferences p where p.user_id=p_owner;
  configuration:=configuration||jsonb_build_object('installation',receipt,'configurationAvailable',true,
    'rolloutMode',case when allowed and not review_required then 'automatic' else 'review' end);
  if not allowed then return configuration; end if;
  return configuration||jsonb_strip_nulls(jsonb_build_object('sourceAdmissionPolicy','financial_content_v1','currencyAccountPolicy','source_currency_v1',
    'policyActivatedAt',floor(extract(epoch from least((i.sources->>'smsActivatedAt')::timestamptz,
      (i.sources->>'notificationActivatedAt')::timestamptz))*1000)::bigint,
    'policySmsActivationId',coalesce(i.sources->>'smsActivationId','0'),
    'smsActivatedAt',case when i.sources->>'smsEnabled'='true' then floor(extract(epoch from (i.sources->>'smsActivatedAt')::timestamptz)*1000)::bigint end,
    'notificationActivatedAt',case when i.sources->>'notificationEnabled'='true' then floor(extract(epoch from (i.sources->>'notificationActivatedAt')::timestamptz)*1000)::bigint end));
end $$;

create or replace function private.configure_tracking_installation(
  p_owner text,p_device uuid,p_registered uuid,p_expected_version integer,p_sources jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.tracking_installations; device public.user_devices; prefs public.tracking_preferences;
  sid text; command_hash text; accepted_at timestamptz; effective jsonb; result jsonb; configuration jsonb;
begin
  perform private.assert_active_profile(p_owner);
  sid:=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
  if p_device is null or p_registered is null or p_expected_version is null or p_expected_version not between 0 and 2147483646
    or sid is null or char_length(sid) not between 1 and 256 or jsonb_typeof(p_sources) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_sources) k where k not in ('smsEnabled','notificationEnabled','smsActivatedAt','smsActivationId','notificationActivatedAt'))
    or jsonb_typeof(p_sources->'smsEnabled') is distinct from 'boolean'
    or jsonb_typeof(p_sources->'notificationEnabled') is distinct from 'boolean' then
    raise exception using errcode='22023',message='TRACKING_INSTALLATION_INPUT_INVALID';
  end if;
  if (p_sources->>'smsEnabled'='true' and
      (p_sources->>'smsActivatedAt' is null or coalesce(p_sources->>'smsActivationId','') !~ '^[0-9]{1,19}$'
        or (p_sources->>'smsActivationId')::numeric>9223372036854775807))
    or (p_sources->>'smsEnabled'='false' and
      (p_sources->>'smsActivatedAt' is not null or p_sources->>'smsActivationId' is not null))
    or (p_sources->>'notificationEnabled'='true' and p_sources->>'notificationActivatedAt' is null)
    or (p_sources->>'notificationEnabled'='false' and p_sources->>'notificationActivatedAt' is not null) then
    raise exception using errcode='22023',message='TRACKING_INSTALLATION_INPUT_INVALID';
  end if;
  -- Same lock order as device/preferences revocation: profile, device, preferences, installation.
  select * into device from public.user_devices where id=p_registered and user_id=p_owner
    and platform='android' and revoked_at is null and clerk_session_id=sid for share;
  if device.id is null then raise exception using errcode='22023',message='DEVICE_NOT_FOUND'; end if;
  select * into prefs from public.tracking_preferences where user_id=p_owner for share;
  perform pg_advisory_xact_lock(hashtextextended('tracking-installation:'||p_owner||':'||p_device::text,0));
  select * into i from private.tracking_installations where user_id=p_owner and tracking_device_id=p_device for update;
  command_hash:=encode(extensions.digest(jsonb_build_object('device',p_registered,'session',sid,'sources',p_sources)::text,'sha256'),'hex');
  if i.user_id is not null and i.last_expected_version=p_expected_version and i.last_command_hash=command_hash
    and i.last_response is not null then return i.last_response; end if;
  if coalesce(i.version,0)<>p_expected_version then
    raise exception using errcode='40001',message='TRACKING_INSTALLATION_VERSION_CONFLICT';
  end if;
  if i.user_id is not null and i.notification_device_id<>p_registered then
    raise exception using errcode='40001',message='TRACKING_DEVICE_BINDING_CONFLICT';
  end if;
  if p_sources->>'smsEnabled'='true' or p_sources->>'notificationEnabled'='true' then
    if not coalesce(prefs.enabled,false) then raise exception using errcode='40001',message='TRACKING_CAPTURE_DISABLED_CONFLICT'; end if;
    configuration:=private.get_tracking_rule_snapshot(p_owner);
  end if;
  accepted_at:=date_trunc('milliseconds',clock_timestamp());
  effective:=jsonb_build_object('smsEnabled',(p_sources->>'smsEnabled')::boolean,
    'notificationEnabled',(p_sources->>'notificationEnabled')::boolean,
    'smsActivatedAt',case when p_sources->>'smsEnabled'='true' then greatest(accepted_at,(p_sources->>'smsActivatedAt')::timestamptz) end,
    'smsActivationId',case when p_sources->>'smsEnabled'='true' then (p_sources->>'smsActivationId')::numeric::text end,
    'notificationActivatedAt',case when p_sources->>'notificationEnabled'='true' then greatest(accepted_at,(p_sources->>'notificationActivatedAt')::timestamptz) end);
  insert into private.tracking_installations(user_id,tracking_device_id,notification_device_id,clerk_session_id,version,generation,sources,last_expected_version,last_command_hash)
    values(p_owner,p_device,p_registered,sid,p_expected_version+1,extensions.gen_random_uuid(),effective,p_expected_version,command_hash)
    on conflict(user_id,tracking_device_id) do update set clerk_session_id=excluded.clerk_session_id,
      version=excluded.version,generation=excluded.generation,sources=excluded.sources,authority_revoked=false,
      last_expected_version=excluded.last_expected_version,last_command_hash=excluded.last_command_hash,last_response=null,updated_at=clock_timestamp();
  result:=private.tracking_installation_configuration(p_owner,p_device);
  update private.tracking_installations set last_response=result where user_id=p_owner and tracking_device_id=p_device;
  return result;
end $$;

-- A returned SDK binding or unpause cannot resurrect a revoked capability.
create function private.revoke_tracking_installation_authority() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='user_devices' then
    if old.user_id is not distinct from new.user_id and old.clerk_session_id is not distinct from new.clerk_session_id
      and old.platform is not distinct from new.platform and old.revoked_at is not distinct from new.revoked_at then return new; end if;
    update private.tracking_installations set authority_revoked=true,version=version+1,generation=extensions.gen_random_uuid(),
      last_command_hash=null,last_response=null,updated_at=clock_timestamp() where notification_device_id=old.id;
  elsif tg_table_name='tracking_preferences' then
    if old.enabled is not true or new.enabled is not false then return new; end if;
    update private.tracking_installations set authority_revoked=true,version=version+1,generation=extensions.gen_random_uuid(),
      last_command_hash=null,last_response=null,updated_at=clock_timestamp() where user_id=old.user_id;
  elsif tg_table_name='profiles' then
    if old.status is distinct from 'active' or new.status='active' then return new; end if;
    update private.tracking_installations set authority_revoked=true,version=version+1,generation=extensions.gen_random_uuid(),
      last_command_hash=null,last_response=null,updated_at=clock_timestamp() where user_id=old.id;
  end if;
  return new;
end $$;
create trigger revoke_production_tracking_device after update of user_id,clerk_session_id,platform,revoked_at on public.user_devices
  for each row execute function private.revoke_tracking_installation_authority();
create trigger revoke_production_tracking_preferences after update of enabled on public.tracking_preferences
  for each row execute function private.revoke_tracking_installation_authority();
create trigger revoke_production_tracking_profile after update of status on public.profiles
  for each row execute function private.revoke_tracking_installation_authority();

alter function private.get_tracking_device_rule_snapshot(text,text) rename to get_tracking_device_rule_snapshot_before_production;
revoke all on function private.get_tracking_device_rule_snapshot_before_production(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.get_tracking_device_rule_snapshot(p_owner text,p_device text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_active_profile(p_owner);
  if exists(select 1 from private.tracking_installations where user_id=p_owner and tracking_device_id::text=lower(p_device)) then
    return private.tracking_installation_configuration(p_owner,p_device::uuid);
  end if;
  return private.get_tracking_device_rule_snapshot_before_production(p_owner,p_device);
end $$;
revoke all on function private.tracking_installation_active(text,uuid),private.tracking_installation_configuration(text,uuid),
  private.revoke_tracking_installation_authority(),private.configure_tracking_installation(text,uuid,uuid,integer,jsonb),
  private.get_tracking_device_rule_snapshot(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
grant execute on function private.configure_tracking_installation(text,uuid,uuid,integer,jsonb),private.get_tracking_device_rule_snapshot(text,text) to masarifi_api;

-- Production capture consumers. Legacy rows/functions remain available only for unmanaged installations.
create function private.tracking_installation_event_admitted(p_owner text,p_payload jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare i private.tracking_installations; boundary timestamptz; channel text;
begin
  select * into i from private.tracking_installations where user_id=p_owner
    and tracking_device_id::text=lower(p_payload#>>'{transport,deviceId}');
  if i.user_id is null then return not (coalesce(p_payload->'transport','{}'::jsonb) ?| array['installationGeneration','installationVersion']); end if;
  if not private.tracking_installation_active(p_owner,i.tracking_device_id)
    or p_payload#>>'{transport,installationGeneration}' is distinct from i.generation::text
    or p_payload#>>'{transport,installationVersion}' is distinct from i.version::text
    or p_payload->>'accountingPolicy' is distinct from 'default_account_nominal_v1'
    or p_payload#>>'{metadata,sourceAdmissionPolicy}' is distinct from 'financial_content_v1' then return false; end if;
  channel:=p_payload#>>'{transport,channel}';
  if channel='android_sms' and i.sources->>'smsEnabled'='true' then
    boundary:=(i.sources->>'smsActivatedAt')::timestamptz;
  elsif channel='android_notification' and i.sources->>'notificationEnabled'='true' then
    boundary:=(i.sources->>'notificationActivatedAt')::timestamptz;
  else return false; end if;
  return coalesce((p_payload->>'receivedAt')::timestamptz>=boundary
    and (p_payload->>'activatedAt')::timestamptz>=boundary
    and (p_payload->>'activatedAt')::timestamptz<=(p_payload->>'receivedAt')::timestamptz,false);
end $$;

create function private.lock_tracking_installation(p_owner text,p_device text) returns boolean
language plpgsql security definer set search_path='' as $$
declare i private.tracking_installations;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('tracking-installation:'||p_owner||':'||lower(p_device),0));
  select * into i from private.tracking_installations where user_id=p_owner and tracking_device_id::text=lower(p_device);
  if i.user_id is null then return false; end if;
  perform 1 from public.user_devices where id=i.notification_device_id for share;
  perform 1 from public.tracking_preferences where user_id=p_owner for share;
  perform 1 from private.tracking_installations where user_id=p_owner and tracking_device_id=i.tracking_device_id for share;
  return true;
end $$;

alter function private.create_import_session(text,text,text,integer,text,jsonb) rename to create_import_session_before_production;
revoke all on function private.create_import_session_before_production(text,text,text,integer,text,jsonb) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.create_import_session(p_user_id text,p_source_type text,p_source_name text,p_schema_version integer,p_request_hash text,p_events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb; managed boolean; sid text;
begin
  perform private.assert_active_profile(p_user_id);
  -- An already accepted immutable request is a receipt lookup, not a new capture.
  if exists(select 1 from public.import_sessions where user_id=p_user_id and request_hash=p_request_hash) then
    return private.create_import_session_before_production(p_user_id,p_source_type,p_source_name,p_schema_version,p_request_hash,p_events);
  end if;
  sid:=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
  for e in select value from jsonb_array_elements(p_events) order by value#>>'{transport,deviceId}' loop
    if e#>>'{transport,deviceId}' is null then continue; end if;
    managed:=private.lock_tracking_installation(p_user_id,e#>>'{transport,deviceId}');
    if not private.tracking_installation_event_admitted(p_user_id,e)
      or (managed and not exists(select 1 from private.tracking_installations where user_id=p_user_id
        and tracking_device_id::text=lower(e#>>'{transport,deviceId}') and clerk_session_id=sid)) then
      raise exception using errcode='40001',message='TRACKING_INSTALLATION_STALE';
    end if;
  end loop;
  return private.create_import_session_before_production(p_user_id,p_source_type,p_source_name,p_schema_version,p_request_hash,p_events);
end $$;

alter function private.tracking_content_cohort(text,text) rename to tracking_content_cohort_before_production;
revoke all on function private.tracking_content_cohort_before_production(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.tracking_content_cohort(p_user_id text,p_device_id text) returns setof private.tracking_automatic_cohorts
language plpgsql stable security definer set search_path='' as $$
declare i private.tracking_installations; release public.tracking_rule_releases;
begin
  select * into i from private.tracking_installations where user_id=p_user_id and tracking_device_id::text=lower(p_device_id);
  if i.user_id is null then return query select * from private.tracking_content_cohort_before_production(p_user_id,p_device_id); return; end if;
  if not private.tracking_installation_active(p_user_id,i.tracking_device_id) then return; end if;
  select r.* into release from public.tracking_rule_channels c join public.tracking_rule_releases r on r.id=c.release_id
    where c.environment='default' and c.market='global' and c.channel='all' and r.status='published' and r.engine_version='2.0.0';
  if release.id is null then return; end if;
  -- This is a typed adapter result, never an INSERT into the retained DEV cohort table.
  return next jsonb_populate_record(null::private.tracking_automatic_cohorts,jsonb_build_object(
    'user_id',i.user_id,'device_id',i.tracking_device_id,'release_id',release.id,'engine_version',release.engine_version,
    'enabled',true,'expires_at','infinity','reason','Explicit production installation consent','created_at',i.created_at,
    'source_admission_policy','financial_content_v1','capture_started_at',least((i.sources->>'smsActivatedAt')::timestamptz,
      (i.sources->>'notificationActivatedAt')::timestamptz),'sms_activation_id',coalesce(i.sources->>'smsActivationId','0'),
    'currency_account_policy','source_currency_v1','installation_managed',true));
end $$;

alter function private.tracking_capture_auto_enabled(uuid) rename to tracking_capture_auto_enabled_before_production;
revoke all on function private.tracking_capture_auto_enabled_before_production(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.tracking_capture_auto_enabled(p_item_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items;
begin
  select * into i from public.import_items where id=p_item_id;
  if not exists(select 1 from private.tracking_installations where user_id=i.user_id and tracking_device_id::text=lower(i.normalized_payload#>>'{transport,deviceId}')) then
    return private.tracking_capture_auto_enabled_before_production(p_item_id);
  end if;
  return private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) and exists(
    select 1 from public.tracking_preferences p join public.tracking_rule_channels c
      on c.environment='default' and c.market='global' and c.channel='all'
      join public.tracking_rule_releases r on r.id=c.release_id and r.status='published'
    where p.user_id=i.user_id and p.enabled and not p.review_required
      and r.snapshot->>'releaseId'=i.normalized_payload#>>'{classification,releaseId}'
      and r.engine_version=i.normalized_payload#>>'{classification,engineVersion}');
end $$;

alter function private.tracking_nominal_source(uuid) rename to tracking_nominal_source_before_production;
revoke all on function private.tracking_nominal_source_before_production(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.tracking_nominal_source(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; result jsonb;
begin
  select * into i from public.import_items where id=p_item_id;
  result:=private.tracking_nominal_source_before_production(p_item_id);
  if not private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) then
    return result||'{"eligible":false}'::jsonb;
  end if;
  return result;
end $$;

alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_production;
revoke all on function private.finalize_import_session_before_production(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; i public.import_items;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token
    and lease_until>clock_timestamp() and status='processing' for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  for i in select * from public.import_items where session_id=s.id and status='parsed'
    order by normalized_payload#>>'{transport,deviceId}',id loop
    if i.normalized_payload#>>'{transport,deviceId}' is null then continue; end if;
    if private.lock_tracking_installation(i.user_id,i.normalized_payload#>>'{transport,deviceId}') then
      if not private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) then
        raise exception using errcode='40001',message='TRACKING_INSTALLATION_STALE';
      end if;
      if exists(select 1 from public.tracking_preferences where user_id=i.user_id and review_required) then
        perform private.create_review_item(i.id,'review_required',i.normalized_payload);
      end if;
    end if;
  end loop;
  return private.finalize_import_session_before_production(p_session_id,p_fence_token);
end $$;

alter function private.commit_tracking_nominal_capture(uuid,uuid) rename to commit_tracking_nominal_capture_before_production;
revoke all on function private.commit_tracking_nominal_capture_before_production(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.commit_tracking_nominal_capture(p_item uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items;
begin
  select x.* into i from public.import_items x join public.import_sessions s on s.id=x.session_id
    where x.id=p_item and s.claim_token=p_fence and s.lease_until>clock_timestamp() and x.status in ('parsed','accepted');
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if i.status<>'accepted' and private.lock_tracking_installation(i.user_id,i.normalized_payload#>>'{transport,deviceId}')
    and not private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) then
    raise exception using errcode='40001',message='TRACKING_INSTALLATION_STALE';
  end if;
  return private.commit_tracking_nominal_capture_before_production(p_item,p_fence);
end $$;

revoke all on function private.tracking_installation_event_admitted(text,jsonb),private.lock_tracking_installation(text,text),
  private.create_import_session(text,text,text,integer,text,jsonb),private.tracking_content_cohort(text,text),
  private.tracking_capture_auto_enabled(uuid),private.tracking_nominal_source(uuid),private.finalize_import_session(uuid,uuid),
  private.commit_tracking_nominal_capture(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
grant execute on function private.create_import_session(text,text,text,integer,text,jsonb) to masarifi_api;
grant execute on function private.finalize_import_session(uuid,uuid),private.commit_tracking_nominal_capture(uuid,uuid) to masarifi_worker;

reset role;
select set_config('role',current_setting('masarifi.tracking_migration_executor_role'),true);
do $$
begin
  if current_setting('masarifi.tracking_migration_membership')='temporary' then
    revoke masarifi_migration from current_user granted by current_user;
  elsif current_setting('masarifi.tracking_migration_membership')='restore_set_false' then
    grant masarifi_migration to current_user with set false granted by current_user;
  end if;
end $$;
