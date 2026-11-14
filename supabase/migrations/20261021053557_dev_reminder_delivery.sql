grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- No shared scheduler or ordinary delivery row is created by this lane.
create table private.dev_reminder_deliveries (
  event_id uuid primary key references public.notification_events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  notification_device_id uuid not null,
  tracking_device_id text not null,
  cycle_baseline timestamptz not null,
  event_type text not null,
  test_locale text check(test_locale in ('ar','en')),
  status text not null default 'queued' check(status in ('queued','sending','accepted','confirmed','rejected','unknown','suppressed')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  attempted_at timestamptz,
  next_attempt_at timestamptz not null default clock_timestamp(),
  token_id uuid,
  token_hash text,
  provider text,
  provider_ref text,
  receipt_checked_at timestamptz,
  receipt_attempts integer not null default 0,
  error_code text,
  created_at timestamptz not null default clock_timestamp(),
  unique(user_id,event_type,cycle_baseline),
  foreign key(notification_device_id,user_id) references public.user_devices(id,user_id) on delete cascade
);
alter table private.dev_reminder_deliveries enable row level security;
alter table private.dev_reminder_deliveries force row level security;
create policy dev_reminder_migration on private.dev_reminder_deliveries to masarifi_migration using(true) with check(true);
revoke all on private.dev_reminder_deliveries from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
create trigger a_owner_payload_write_fence before insert or update on private.dev_reminder_deliveries
  for each row execute function private.fence_frozen_owner_payload();

create function private.dev_notification_visible(p_event uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.dev_reminder_deliveries r where r.event_id=p_event
   and r.user_id=public.current_clerk_user_id() and r.status in ('accepted','confirmed'))
$$;
revoke all on function private.dev_notification_visible(uuid) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.dev_notification_visible(uuid) to masarifi_api;
create policy notification_events_dev_scope on public.notification_events as restrictive for select to masarifi_api
 using(coalesce(data->>'scope','')<>'dev_reminder' or
   coalesce(current_setting('masarifi.dev_reminders_access',true),'off')='on' and private.dev_notification_visible(id));

-- Raw tokens are hashed by the API before this narrowly scoped DEV handoff.
create function private.release_dev_push_token(p_owner text,p_device uuid,p_fingerprint text,p_provider text,p_token_hash text) returns void
language plpgsql security definer set search_path='' as $$
declare old_token public.push_tokens%rowtype; old_status text;
begin
 perform private.assert_active_profile(p_owner);
 perform 1 from public.user_devices where id=p_device and user_id=p_owner and device_fingerprint=p_fingerprint and platform='android'
   and revoked_at is null and clerk_session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
 if not found or p_provider<>'expo' then raise exception using errcode='42501',message='DEV_PUSH_DEVICE_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dev-push:'||p_provider||':'||p_token_hash,0));
 select * into old_token from public.push_tokens where provider=p_provider and token_hash=p_token_hash;
 if not found or old_token.user_id=p_owner then return; end if;
 select status into old_status from public.profiles where id=old_token.user_id for share;
 select * into old_token from public.push_tokens where provider=p_provider and token_hash=p_token_hash for update;
 if not exists(select 1 from private.dev_mobile_installations i join public.user_devices d on d.id=i.notification_device_id and d.user_id=i.user_id
   where i.user_id=old_token.user_id and i.notification_device_id=old_token.device_id and d.device_fingerprint=p_fingerprint and d.platform='android') then
  raise exception using errcode='42501',message='DEV_PUSH_HANDOFF_FORBIDDEN';
 end if;
 if old_status='active' then
  update private.dev_mobile_installations set reminders_enabled=false where user_id=old_token.user_id and notification_device_id=old_token.device_id;
  update public.push_tokens set revoked_at=clock_timestamp() where id=old_token.id;
  update public.user_devices set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=old_token.device_id and user_id=old_token.user_id;
 end if;
 -- A new row keeps owner immutability and prevents an old receipt revoking its replacement.
 delete from public.push_tokens where id=old_token.id;
end $$;

create function private.bind_dev_push_installation(p_owner text,p_tracking text,p_device uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_active_profile(p_owner);
 if p_tracking is null or p_tracking !~ '^[0-9a-fA-F-]{36}$' then raise exception 'DEV_TRACKING_INPUT_INVALID'; end if;
 perform 1 from public.user_devices where user_id=p_owner and id=p_device and revoked_at is null and platform='android'
   and clerk_session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
 if not found then raise exception 'DEV_PUSH_DEVICE_INVALID'; end if;
 insert into private.dev_mobile_installations(user_id,tracking_device_id,notification_device_id,reminders_enabled)
 values(p_owner,p_tracking,p_device,false) on conflict(user_id,tracking_device_id) do nothing;
 if not exists(select 1 from private.dev_mobile_installations where user_id=p_owner and tracking_device_id=p_tracking and notification_device_id=p_device) then raise exception 'DEV_DEVICE_BINDING_CONFLICT'; end if;
end $$;

create function private.sign_out_dev_installation(p_owner text,p_fingerprint text) returns void
language plpgsql security definer set search_path='' as $$
declare owner_status text; target_device uuid;
begin
 if p_owner is distinct from public.current_clerk_user_id() then raise exception using errcode='42501',message='DEV_PUSH_OWNER_INVALID'; end if;
 select status into owner_status from public.profiles where id=p_owner for share;
 -- Frozen/deleted profiles already fail every reminder claim and submission fence.
 if not found or owner_status<>'active' then return; end if;
 select d.id into target_device from public.user_devices d where d.user_id=p_owner and d.device_fingerprint=p_fingerprint
  and (d.clerk_session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid' or d.clerk_session_id is null and d.revoked_at is not null)
  and exists(select 1 from private.dev_mobile_installations i where i.user_id=p_owner and i.notification_device_id=d.id) for update;
 if not found then return; end if;
 update private.dev_mobile_installations set reminders_enabled=false where user_id=p_owner and notification_device_id=target_device;
 update public.push_tokens set revoked_at=coalesce(revoked_at,clock_timestamp()) where user_id=p_owner and device_id=target_device;
 update public.user_devices set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=target_device and user_id=p_owner;
end $$;
revoke all on function private.release_dev_push_token(text,uuid,text,text,text),private.bind_dev_push_installation(text,text,uuid),private.sign_out_dev_installation(text,text) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.release_dev_push_token(text,uuid,text,text,text),private.bind_dev_push_installation(text,text,uuid),private.sign_out_dev_installation(text,text) to masarifi_api;

-- Immutable DEV-only template keys avoid changing any published ordinary copy.
insert into public.notification_templates(key,locale,channel,template_version,subject,body,status,published_at,system_seed)
select 'dev.'||v.kind,l.locale,'push',1,
  case when l.locale='ar' then v.ar_title else v.en_title end,
  case when l.locale='ar' then v.ar_body else v.en_body end,
  'published',clock_timestamp(),true
from (values
 ('reminder.onboarding_incomplete.1d','أكمل الإعداد','خطوة بسيطة وتبدأ متابعة مصاريفك.','Finish getting started','You’re one step away from tracking your spending.'),
 ('reminder.first_transaction.1d','ابدأ بأول معاملة','أضف مصروفك الأول، كتابةً أو بصوتك.','Add your first transaction','Log your first expense by typing or speaking.'),
 ('reminder.app_inactive.3d','راجع مصاريفك','افتح مصاريفي وتابع مصاريفك بسهولة.','Check in on your spending','Open Masarifi to keep track of your spending.'),
 ('reminder.app_inactive.7d','راجع مصاريفك','افتح مصاريفي وتابع مصاريفك بسهولة.','Check in on your spending','Open Masarifi to keep track of your spending.'),
 ('reminder.financial_inactive.7d','تابع التتبع','افتح مصاريفي وتأكد أن التتبع يعمل كما تريد.','Check your tracking','Open Masarifi to check that expense tracking is set up the way you want.')
) v(kind,ar_title,ar_body,en_title,en_body) cross join (values('ar'),('en')) l(locale);

-- DEV templates are not ordinary notification preference defaults.
create or replace function private.seed_notification_preferences()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_preferences(user_id,channel,event_type)
 select new.id,t.channel,t.key
 from (select distinct key,channel from public.notification_templates where system_seed and key not like 'dev.%') t
 on conflict(user_id,channel,event_type) do nothing;
 return new;
end $$;

create function private.dev_reminder_zone_valid(p_zone text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if p_zone is null then return false; end if;
 perform now() at time zone p_zone;
 return true;
exception when invalid_parameter_value then return false;
end $$;

create function private.dev_reminder_candidate(p_owner text,p_ignore uuid default null,p_quiet boolean default true)
returns table(user_id text,tracking_device_id text,notification_device_id uuid,baseline_at timestamptz,event_type text,locale text,time_zone text,route text)
language sql stable security definer set search_path='' as $$
 with installation as (
  select i.*,coalesce(i.last_foreground_at,i.enrolled_at) baseline,i.reminder_locale locale,i.reminder_timezone timezone,p.created_at,
    case when 'welcome'=any(o.completed_steps) and preferences.currency_selected then greatest(o.updated_at,preferences.updated_at) end completed_at,
    exists(select 1 from public.transactions t where t.user_id=p.id and t.deleted_at is null) has_transaction,
    (select max(t.created_at) from public.transactions t where t.user_id=p.id and t.deleted_at is null) last_transaction,
    exists(select 1 from public.tracking_preferences t where t.user_id=p.id and t.enabled) tracking
  from private.dev_mobile_installations i join public.profiles p on p.id=i.user_id
  join public.user_devices d on d.id=i.notification_device_id and d.user_id=i.user_id and d.revoked_at is null
  left join public.onboarding_progress o on o.user_id=p.id
  left join public.user_preferences preferences on preferences.user_id=p.id
  where p.id=p_owner and p.status='active' and i.enabled and i.reminders_enabled and i.reminder_locale in ('ar','en')
    and private.dev_reminder_zone_valid(i.reminder_timezone)
    and exists(select 1 from public.push_tokens t where t.user_id=i.user_id and t.device_id=i.notification_device_id and t.revoked_at is null and t.provider='expo')
  order by coalesce(i.last_foreground_at,i.enrolled_at) desc,i.tracking_device_id limit 1
 ), chosen as (
 select i.*,case
   when completed_at is null and greatest(baseline,created_at)<=now()-interval '1 day' then 'reminder.onboarding_incomplete.1d'
   when completed_at is not null and not has_transaction and greatest(baseline,completed_at)<=now()-interval '1 day' then 'reminder.first_transaction.1d'
   when completed_at is not null and has_transaction and baseline<=now()-interval '7 days' then 'reminder.app_inactive.7d'
   when completed_at is not null and has_transaction and baseline<=now()-interval '3 days' then 'reminder.app_inactive.3d'
   when completed_at is not null and has_transaction and tracking and last_transaction<=now()-interval '7 days' and baseline<=now()-interval '1 day' then 'reminder.financial_inactive.7d'
 end kind from installation i
 ) select c.user_id,c.tracking_device_id,c.notification_device_id,c.baseline,c.kind,c.locale,c.timezone,
    case c.kind when 'reminder.onboarding_incomplete.1d' then 'onboarding' when 'reminder.first_transaction.1d' then 'add_transaction' when 'reminder.financial_inactive.7d' then 'tracking' else 'home' end
 from chosen c where c.kind is not null
 and (not p_quiet or extract(hour from now() at time zone c.timezone)>=8 and extract(hour from now() at time zone c.timezone)<22)
 and not exists(select 1 from private.dev_reminder_deliveries r where r.user_id=c.user_id and r.event_id is distinct from p_ignore and r.event_type=c.kind and r.cycle_baseline=c.baseline and r.test_locale is null)
 and (select count(*) from private.dev_reminder_deliveries r where r.user_id=c.user_id and r.event_id is distinct from p_ignore and r.attempted_at>=c.baseline and r.status<>'suppressed' and r.test_locale is null)<2
 and (select count(*) from private.dev_reminder_deliveries r where r.user_id=c.user_id and r.event_id is distinct from p_ignore and r.attempted_at>=now()-interval '7 days' and r.status<>'suppressed' and r.test_locale is null)<2
 and not exists(select 1 from private.dev_reminder_deliveries r where r.user_id=c.user_id and r.event_id is distinct from p_ignore and r.attempted_at is not null and (r.attempted_at at time zone c.timezone)::date=(now() at time zone c.timezone)::date and r.status<>'suppressed' and r.test_locale is null)
$$;

create function private.dev_reminder_delivery_candidate(p_event uuid,p_quiet boolean)
returns table(user_id text,tracking_device_id text,notification_device_id uuid,baseline_at timestamptz,event_type text,locale text,time_zone text,route text)
language sql stable security definer set search_path='' as $$
 select c.* from private.dev_reminder_deliveries r cross join lateral private.dev_reminder_candidate(r.user_id,r.event_id,p_quiet) c where r.event_id=p_event and r.test_locale is null
 union all
 select r.user_id,i.tracking_device_id,i.notification_device_id,coalesce(i.last_foreground_at,i.enrolled_at),r.event_type,r.test_locale,i.reminder_timezone,'home'::text
 from private.dev_reminder_deliveries r join private.dev_mobile_installations i on i.user_id=r.user_id and i.tracking_device_id=r.tracking_device_id and i.notification_device_id=r.notification_device_id
 join public.profiles p on p.id=r.user_id and p.status='active'
 join public.user_devices d on d.id=i.notification_device_id and d.user_id=i.user_id and d.revoked_at is null
 where r.event_id=p_event and r.test_locale is not null and i.enabled and i.reminders_enabled and i.reminder_locale in ('ar','en')
 and private.dev_reminder_zone_valid(i.reminder_timezone)
 and exists(select 1 from public.push_tokens t where t.user_id=i.user_id and t.device_id=i.notification_device_id and t.revoked_at is null and t.provider='expo')
 and (not p_quiet or extract(hour from now() at time zone i.reminder_timezone)>=8 and extract(hour from now() at time zone i.reminder_timezone)<22)
$$;

create function private.enqueue_dev_reminders(p_limit integer) returns integer
language plpgsql security definer set search_path='' as $$
declare owner record; c record; e uuid; total integer:=0;
begin
 if p_limit not between 1 and 100 then raise exception 'DEV_REMINDER_LIMIT_INVALID'; end if;
 for owner in select p.id from public.profiles p where p.status='active' and exists(select 1 from private.dev_mobile_installations i where i.user_id=p.id and i.enabled and i.reminders_enabled) order by p.id for update skip locked loop
  for c in select * from private.dev_reminder_candidate(owner.id) loop
   if exists(select 1 from private.dev_reminder_deliveries r where r.user_id=c.user_id and r.event_type=c.event_type and r.cycle_baseline=c.baseline_at) then continue; end if;
   e:=extensions.gen_random_uuid();
   insert into public.notification_events(id,user_id,type,title,body_safe,data)
    values(e,c.user_id,c.event_type,'Masarifi','Open Masarifi.',jsonb_build_object('scope','dev_reminder','targetKind',c.route,'route',c.route,'actions',jsonb_build_array(jsonb_build_object('key','view','expiresAt',null)),'cycleBaseline',to_char(c.baseline_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'notificationDeviceId',c.notification_device_id));
   insert into private.dev_reminder_deliveries(event_id,user_id,notification_device_id,tracking_device_id,cycle_baseline,event_type)
    values(e,c.user_id,c.notification_device_id,c.tracking_device_id,c.baseline_at,c.event_type);
   total:=total+1;
  end loop;
  exit when total>=p_limit;
 end loop;
 return total;
end $$;

create function private.claim_dev_reminder() returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner record; r private.dev_reminder_deliveries%rowtype; c record; token public.push_tokens%rowtype;
begin
 for owner in select p.id from public.profiles p where p.status='active' and exists(select 1 from private.dev_reminder_deliveries pending where pending.user_id=p.id and pending.status='queued' and pending.next_attempt_at<=clock_timestamp()) order by p.id for update skip locked loop
  for r in select * from private.dev_reminder_deliveries d where d.user_id=owner.id and d.status='queued' and d.next_attempt_at<=clock_timestamp() order by d.created_at for update skip locked loop
   select * into c from private.dev_reminder_delivery_candidate(r.event_id,false);
   if c.user_id is null or (c.notification_device_id,c.tracking_device_id,c.baseline_at,c.event_type) is distinct from (r.notification_device_id,r.tracking_device_id,r.cycle_baseline,r.event_type) then
    update private.dev_reminder_deliveries set status='suppressed',error_code='REMINDER_STALE' where event_id=r.event_id; continue;
   end if;
   if not exists(select 1 from private.dev_reminder_delivery_candidate(r.event_id,true)) then continue; end if;
   select * into token from public.push_tokens t where t.user_id=r.user_id and t.device_id=r.notification_device_id and t.revoked_at is null and t.provider='expo' order by t.updated_at desc,t.id desc limit 1;
   update private.dev_reminder_deliveries set status='sending',attempt_count=attempt_count+1,attempted_at=clock_timestamp(),token_id=token.id,token_hash=token.token_hash,provider=token.provider where event_id=r.event_id;
   return jsonb_build_object('eventId',r.event_id,'userId',r.user_id,'deviceId',r.notification_device_id,'tokenCiphertext',token.token_ciphertext,'provider',token.provider);
  end loop;
 end loop;
 return null;
end $$;

-- Called in an owner-locked transaction immediately around provider submission.
create function private.prepare_dev_reminder(p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.dev_reminder_deliveries%rowtype; c record; t record; owner text;
begin
 select user_id into owner from private.dev_reminder_deliveries where event_id=p_event;
 perform 1 from public.profiles where id=owner and status='active' for update;
 if not found then return null; end if;
 select * into r from private.dev_reminder_deliveries where event_id=p_event and status='sending' for update;
 if not found then return null; end if;
 select * into c from private.dev_reminder_delivery_candidate(p_event,false);
 if c.user_id is null or (c.notification_device_id,c.tracking_device_id,c.baseline_at,c.event_type) is distinct from (r.notification_device_id,r.tracking_device_id,r.cycle_baseline,r.event_type)
  or not exists(select 1 from public.push_tokens p where p.id=r.token_id and p.user_id=owner and p.device_id=r.notification_device_id and p.token_hash=r.token_hash and p.revoked_at is null) then
  update private.dev_reminder_deliveries set status='suppressed',error_code='REMINDER_STALE' where event_id=p_event; return null;
 end if;
 if not exists(select 1 from private.dev_reminder_delivery_candidate(p_event,true)) then
  update private.dev_reminder_deliveries set status='queued',next_attempt_at=clock_timestamp()+interval '15 minutes',attempted_at=null,attempt_count=greatest(0,attempt_count-1) where event_id=p_event; return null;
 end if;
 select subject,body into t from public.notification_templates where key='dev.'||case when r.test_locale is not null then 'reminder.app_inactive.3d' else r.event_type end and locale=c.locale and channel='push' and status='published';
 if not found then update private.dev_reminder_deliveries set status='suppressed',error_code='TEMPLATE_UNAVAILABLE' where event_id=p_event; return null; end if;
 update public.notification_events set title=t.subject,body_safe=t.body,data=data||jsonb_build_object('locale',c.locale,'targetKind',c.route,'route',c.route) where id=p_event;
 return jsonb_build_object('title',t.subject,'body',t.body,'locale',c.locale,'route',c.route,'eventType',r.event_type);
end $$;

create function private.finish_dev_reminder(p_event uuid,p_status text,p_ref text default null,p_code text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r private.dev_reminder_deliveries%rowtype; owner text;
begin
 select user_id into owner from private.dev_reminder_deliveries where event_id=p_event;
 perform 1 from public.profiles where id=owner and status='active' for update;
 if not found then return; end if;
 select * into r from private.dev_reminder_deliveries where event_id=p_event for update;
 if r.status not in ('sending','accepted') then return; end if;
 if p_status not in ('accepted','confirmed','rejected','unknown','queued') then raise exception 'DEV_REMINDER_STATUS_INVALID'; end if;
 if p_status='queued' and r.attempt_count>=5 then p_status:='rejected'; end if;
 update private.dev_reminder_deliveries set status=p_status,provider_ref=coalesce(p_ref,provider_ref),error_code=p_code,
   next_attempt_at=clock_timestamp()+interval '15 minutes',receipt_checked_at=case when r.status='accepted' then clock_timestamp() else receipt_checked_at end,
   receipt_attempts=receipt_attempts+case when r.status='accepted' then 1 else 0 end where event_id=p_event;
 if p_code='TOKEN_INVALID' then
  update public.push_tokens set revoked_at=clock_timestamp() where id=r.token_id and user_id=r.user_id and device_id=r.notification_device_id and token_hash=r.token_hash and revoked_at is null;
 end if;
end $$;

create function private.pending_dev_receipts() returns table(event_id uuid,provider_ref text)
language sql security definer set search_path='' as $$
 select r.event_id,r.provider_ref from private.dev_reminder_deliveries r join public.profiles p on p.id=r.user_id and p.status='active'
 where r.status='accepted' and r.provider='expo' and r.next_attempt_at<=clock_timestamp() and r.receipt_attempts<96 order by r.next_attempt_at limit 100
$$;

create function private.expire_dev_reminder_submissions() returns integer
language plpgsql security definer set search_path='' as $$
declare owner record; affected integer; total integer:=0;
begin
 for owner in select p.id from public.profiles p where p.status='active' and exists(
  select 1 from private.dev_reminder_deliveries d where d.user_id=p.id and
    (d.status='sending' and d.attempted_at<clock_timestamp()-interval '10 minutes'
     or d.status='accepted' and (d.attempted_at<clock_timestamp()-interval '24 hours' or d.receipt_attempts>=96))) order by p.id for update skip locked loop
  update private.dev_reminder_deliveries set status='unknown',error_code='PROVIDER_CONFIRMATION_EXPIRED'
    where user_id=owner.id and (status='sending' and attempted_at<clock_timestamp()-interval '10 minutes'
     or status='accepted' and (attempted_at<clock_timestamp()-interval '24 hours' or receipt_attempts>=96));
  get diagnostics affected=row_count; total:=total+affected;
 end loop;
 return total;
end $$;

-- Explicit delivery proof only: no content, token, device or ordinary profile override.
create function private.enqueue_dev_reminder_test(p_owner text,p_locale text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i private.dev_mobile_installations%rowtype; e uuid; baseline timestamptz;
begin
 if p_locale is null or p_locale not in ('ar','en') then raise exception 'DEV_REMINDER_LOCALE_INVALID'; end if;
 perform 1 from public.profiles where id=p_owner and status='active' for update;
 if not found then raise exception 'DEV_REMINDER_OWNER_INVALID'; end if;
 select installation.* into i from private.dev_mobile_installations installation
 join public.user_devices d on d.id=installation.notification_device_id and d.user_id=installation.user_id and d.revoked_at is null
 where installation.user_id=p_owner and installation.enabled and installation.reminders_enabled and installation.reminder_locale in ('ar','en')
 and private.dev_reminder_zone_valid(installation.reminder_timezone)
 and exists(select 1 from public.push_tokens t where t.user_id=p_owner and t.device_id=installation.notification_device_id and t.provider='expo' and t.revoked_at is null)
 order by coalesce(installation.last_foreground_at,installation.enrolled_at) desc limit 1;
 if not found then raise exception 'DEV_REMINDER_CONSENT_DEVICE_REQUIRED'; end if;
 baseline:=coalesce(i.last_foreground_at,i.enrolled_at);
 select event_id into e from private.dev_reminder_deliveries where user_id=p_owner and event_type='reminder.dev_test.'||p_locale and cycle_baseline=baseline;
 if found then return e; end if;
 e:=extensions.gen_random_uuid();
 insert into public.notification_events(id,user_id,type,title,body_safe,data) values(e,p_owner,'reminder.app_inactive.3d','Masarifi','Open Masarifi.',jsonb_build_object('scope','dev_reminder','deliveryTest',true,'actions',jsonb_build_array(jsonb_build_object('key','view','expiresAt',null)),'targetKind','home','route','home','locale',p_locale,'notificationDeviceId',i.notification_device_id));
 insert into private.dev_reminder_deliveries(event_id,user_id,notification_device_id,tracking_device_id,cycle_baseline,event_type,test_locale)
 values(e,p_owner,i.notification_device_id,i.tracking_device_id,baseline,'reminder.dev_test.'||p_locale,p_locale);
 return e;
end $$;

do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('dev_reminder_zone_valid','dev_reminder_candidate','dev_reminder_delivery_candidate','enqueue_dev_reminders','claim_dev_reminder','prepare_dev_reminder','finish_dev_reminder','pending_dev_receipts','expire_dev_reminder_submissions','enqueue_dev_reminder_test') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,masarifi_api',f);
  execute format('grant execute on function %s to masarifi_worker',f);
 end loop;
end $$;

-- Defense in depth: even a mistakenly queued shared delivery cannot escape DEV.
do $$ declare body text; begin
 select pg_catalog.pg_get_functiondef('private.claim_notification_deliveries(text,integer,integer)'::regprocedure) into body;
 if position('dev_reminder' in body)>0 then return; end if;
 if position('where d.status in (''queued'',''failed'')' in body)=0 then raise exception 'DEV_SHARED_CLAIM_DEFINITION_CHANGED'; end if;
 body:=replace(body,'where d.status in (''queued'',''failed'')','where not exists(select 1 from public.notification_events de where de.id=d.event_id and de.data->>''scope''=''dev_reminder'') and d.status in (''queued'',''failed'')');
 execute body;
end $$;

-- Erasure retains a tombstoned profile; explicitly purge both DEV owner tables.
do $$ declare body text; begin
 select pg_catalog.pg_get_functiondef('private.erase_account_owner_payload(uuid,text)'::regprocedure) into body;
 if position('dev_reminder_deliveries' in body)>0 then return; end if;
 if position('(''public'',''salary_profiles'')' in body)=0 then raise exception 'DEV_ERASURE_REGISTRY_DEFINITION_CHANGED'; end if;
 body:=replace(body,'(''public'',''salary_profiles'')','(''private'',''dev_reminder_deliveries''),(''private'',''dev_mobile_installations''),(''public'',''salary_profiles'')');
 execute body;
end $$;
reset role;
revoke masarifi_migration from current_user granted by current_user;
