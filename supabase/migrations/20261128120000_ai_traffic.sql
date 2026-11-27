set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $role$
begin
  perform set_config('masarifi.ai_traffic.executor_role', current_setting('role'), true);
  perform set_config('masarifi.ai_traffic.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.ai_traffic.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.ai_traffic.granted_role', 'true', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- Short-lived admission state. Keys contain digests, never conversation contents or audio.
create unlogged table private.ai_http_admissions (
  token uuid primary key, owner_key text not null, ip_key text not null,
  bucket text not null, lane text not null, arrived timestamptz not null,
  active_until timestamptz, discard_at timestamptz not null
);
create index on private.ai_http_admissions(owner_key,discard_at);
create index on private.ai_http_admissions(ip_key,discard_at);
create index on private.ai_http_admissions(discard_at);

create function private.ai_http_admit(p_token uuid,p_owner text,p_ip text,p_bucket text,p_lane text)
returns integer language plpgsql security definer set search_path='' as $$
declare
  t timestamptz; minute_cap int; limits record;
  scope record; retry int := 0;
begin
  select * into strict limits from (values
    ('chat',12,3,10),('create',6,2,10),('upload',12,3,10),
    ('process',12,3,10),('poll',180,8,1),('other',60,10,1)
  ) as policy(bucket,per_min,burst,span) where bucket=p_bucket;
  perform pg_advisory_xact_lock(712801,hashtext(p_ip));
  perform pg_advisory_xact_lock(712802,hashtext(p_owner));
  t := clock_timestamp();
  -- SKIP LOCKED lets independent clients reclaim expired records without waiting on each other.
  delete from private.ai_http_admissions where token in
    (select token from private.ai_http_admissions where discard_at<=t order by discard_at
     limit 16 for update skip locked);
  for scope in
    with scoped as (
      select true as own,e.* from private.ai_http_admissions e where owner_key=p_owner and discard_at>t
      union all
      select false,e.* from private.ai_http_admissions e where ip_key=p_ip and discard_at>t
    )
    select own, count(*) filter(where active_until>t) as active,
      count(*) filter(where active_until>t and lane=p_lane) as in_lane,
      count(*) filter(where bucket=p_bucket and arrived>t-interval '1 minute') as minute_count,
      min(arrived) filter(where bucket=p_bucket and arrived>t-interval '1 minute') as oldest_min,
      count(*) filter(where bucket=p_bucket and arrived>t-make_interval(secs=>limits.span)) as burst_count,
      min(arrived) filter(where bucket=p_bucket and arrived>t-make_interval(secs=>limits.span)) as oldest_burst
    from scoped group by own
  loop
    minute_cap := limits.per_min * case when scope.own then 1 else 10 end;
    if scope.minute_count>=minute_cap then
      retry := greatest(retry,ceil(extract(epoch from scope.oldest_min+interval '1 minute'-t))::int);
    end if;
    if scope.own and scope.burst_count>=limits.burst then
      retry := greatest(retry,ceil(extract(epoch from scope.oldest_burst+make_interval(secs=>limits.span)-t))::int);
    end if;
    if scope.active >= (case when scope.own then 6 else 60 end) or
       (p_lane='upload' and scope.in_lane >= (case when scope.own then 1 else 10 end)) or
       (p_lane='wait' and scope.in_lane >= (case when scope.own then 2 else 40 end)) then
      retry := greatest(retry,1);
    end if;
  end loop;
  if retry=0 then
    insert into private.ai_http_admissions values
      (p_token,p_owner,p_ip,p_bucket,p_lane,t,t+interval '4 minutes',t+interval '4 minutes');
  end if;
  return retry;
end $$;
create function private.ai_http_release(p_token uuid) returns void
language sql security definer set search_path='' as $$
  update private.ai_http_admissions set active_until=null,discard_at=arrived+interval '1 minute' where token=p_token;
$$;

create table private.ai_processing_slots (
  token uuid primary key, owner_key text not null, expires_at timestamptz not null
);
-- Admission runs in the same idempotent transaction as the durable queue write.
create index ai_traffic_voice_pending on public.voice_sessions(user_id) where
  finalized_at is not null and status in ('uploaded','processing') and deleted_at is null;
create index ai_traffic_chat_pending on public.assistant_messages(user_id) where
  role='user' and work_status in ('queued','processing');
create function private.ai_queue_full(p_owner text) returns boolean
language plpgsql security definer set search_path='' as $$
declare full_queue boolean; busy int; owner_busy int;
begin
  perform pg_advisory_xact_lock(712803,0);
  select count(*), count(*) filter(where owner_key=encode(sha256(convert_to(p_owner,'UTF8')),'hex'))
    into busy, owner_busy from private.ai_processing_slots where expires_at>clock_timestamp();
  with pending as (
    select user_id from (select user_id from public.voice_sessions where finalized_at is not null
      and status in ('uploaded','processing') and deleted_at is null and expires_at>clock_timestamp() limit 20) v
    union all
    select user_id from (select user_id from public.assistant_messages where role='user'
      and work_status in ('queued','processing') limit 20) m
  )
  select count(*)>=20 or count(*)-busy>=16 or count(*) filter(where user_id=p_owner)>=4
    or count(*) filter(where user_id=p_owner)-owner_busy>=2 into full_queue from pending;
  return full_queue;
end $$;

create function private.ai_start_processing(p_token uuid,p_owner text,p_seconds int)
returns boolean language plpgsql security definer set search_path='' as $$
declare t timestamptz;
begin
  perform pg_advisory_xact_lock(712804,0);
  t := clock_timestamp();
  delete from private.ai_processing_slots where expires_at<=t;
  if (select count(*)>=4 or count(*) filter(where owner_key=p_owner)>=2 from private.ai_processing_slots)
  then return false; end if;
  insert into private.ai_processing_slots values(p_token,p_owner,t+make_interval(secs=>p_seconds));
  return true;
end $$;
create function private.ai_end_processing(p_token uuid) returns void
language sql security definer set search_path='' as $$
  delete from private.ai_processing_slots where token=p_token;
$$;
revoke all on private.ai_http_admissions,private.ai_processing_slots from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
revoke all on function private.ai_http_admit(uuid,text,text,text,text),private.ai_http_release(uuid),
  private.ai_queue_full(text),private.ai_start_processing(uuid,text,int),private.ai_end_processing(uuid) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.ai_http_admit(uuid,text,text,text,text),private.ai_http_release(uuid),
  private.ai_queue_full(text) to masarifi_api;
grant execute on function private.ai_start_processing(uuid,text,int),private.ai_end_processing(uuid) to masarifi_worker;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.ai_traffic.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.ai_traffic.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.ai_traffic.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
