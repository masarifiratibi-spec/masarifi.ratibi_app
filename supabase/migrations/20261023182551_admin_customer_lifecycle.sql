grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create table private.customer_session_commands (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id text not null references public.profiles(id),
  user_id text not null references public.profiles(id),
  operation text not null check(operation in ('suspend','reactivate','revoke-device','revoke-sessions')),
  key_hash text not null,
  command jsonb not null,
  response jsonb not null,
  requested_at timestamptz not null default statement_timestamp(),
  status text not null default 'pending' check(status in ('pending','completed','failed')),
  attempts integer not null default 0,
  retry_at timestamptz not null default clock_timestamp(),
  session_ids jsonb,
  device_id uuid,
  unique(actor_id,operation,key_hash)
);
alter table private.customer_session_commands enable row level security;
revoke all on private.customer_session_commands from public,anon,authenticated,service_role,masarifi_api;
grant select,update,delete on private.customer_session_commands to masarifi_worker;
create policy customer_session_worker on private.customer_session_commands to masarifi_worker using(true) with check(true);

create function private.customer_admin_projection(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'id',p.id,'displayName',coalesce(p.display_name,'—'),
 'maskedEmail',case when p.primary_email is null then null else left(p.primary_email,1)||'***'||substring(p.primary_email from '@.*$') end,
 'country',null,'language',p.locale,'primaryPlatform',d.platforms[1],
 'registeredPlatforms',coalesce(to_jsonb(d.platforms),'[]'::jsonb),
 'iosDeviceCount',d.ios,'androidDeviceCount',d.android,'webDeviceCount',d.web,'totalDeviceCount',d.ios+d.android+d.web,
 'plan','unknown','status',p.status,'verification','unknown','registeredAt',p.created_at,
 'lastActiveAt',a.last_active,'risk','unknown')
from public.profiles p
cross join lateral (select count(*) filter(where platform='ios')::int ios,count(*) filter(where platform='android')::int android,count(*) filter(where platform='web')::int web,
 array_agg(distinct platform order by platform) platforms
 from public.user_devices where user_id=p.id and revoked_at is null ) d
cross join lateral(select max(observed_at) last_active from private.mobile_activity_buckets where user_id=p.id) a
where p.id=p_id;
$$;
revoke all on function private.customer_admin_projection(text) from public;

create function private.customer_admin(p_operation text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor text:=public.current_clerk_user_id(); target text:=p_body->>'userId';
 permission text; item jsonb; receipt private.customer_session_commands%rowtype;
 old_status text; new_status text; command_id uuid; command_key_hash text; result jsonb;
 page_no int:=coalesce((p_body->>'page')::int,1); page_size int:=coalesce((p_body->>'pageSize')::int,25);
 total int; ios int; android int; multi int; items jsonb; device uuid;
begin
 permission:=case p_operation when 'list' then 'users.read' when 'detail' then 'users.read'
 when 'devices' then 'devices.read' when 'sessions-target' then 'sessions.read'
 when 'revoke-device' then 'devices.revoke' when 'revoke-sessions' then 'sessions.revoke'
 when 'suspend' then 'users.status.manage' when 'reactivate' then 'users.status.manage' end;
 if permission is null then raise exception 'ADMIN_PERMISSION_DENIED' using errcode='42501'; end if;
 perform private.assert_admin_permission(permission);
 if p_operation='list' then
  if page_no<1 or page_no>100000 or page_size not in (25,50,100) then raise exception 'VALIDATION_FAILED'; end if;
  with customers as (
   select private.customer_admin_projection(p.id) v from public.profiles p
   where not exists(select 1 from public.admin_profiles x where x.user_id=p.id)
   and (nullif(p_body->>'query','') is null or p.id ilike '%'||(p_body->>'query')||'%' or p.display_name ilike '%'||(p_body->>'query')||'%' or p.primary_email ilike '%'||(p_body->>'query')||'%')
   and (p_body->>'status' is null or p.status=p_body->>'status')
   and (p_body->>'language' is null or p.locale=p_body->>'language')
   and (p_body->>'registeredFrom' is null or p.created_at>=(p_body->>'registeredFrom')::date)
   and (p_body->>'registeredTo' is null or p.created_at<(p_body->>'registeredTo')::date+1)
  ), filtered as (select v from customers where
   (coalesce(p_body->>'platform','all')='all' or (p_body->>'platform'='multi' and jsonb_array_length(v->'registeredPlatforms')>1) or v->'registeredPlatforms' ? (p_body->>'platform'))
   and (p_body->>'lastActiveFrom' is null or (v->>'lastActiveAt')::timestamptz>=(p_body->>'lastActiveFrom')::timestamptz)
   and (p_body->>'lastActiveTo' is null or (v->>'lastActiveAt')::timestamptz<=(p_body->>'lastActiveTo')::timestamptz)
  ), ordered as (select v from filtered order by
    case when p_body->>'sort'='name' and p_body->>'order'='asc' then v->>'displayName' end asc,
    case when p_body->>'sort'='name' and p_body->>'order'<>'asc' then v->>'displayName' end desc,
    case when p_body->>'sort'='registeredAt' and p_body->>'order'='asc' then v->>'registeredAt' end asc,
    case when p_body->>'sort'='registeredAt' and p_body->>'order'<>'asc' then v->>'registeredAt' end desc,
    case when coalesce(p_body->>'sort','lastActive')='lastActive' and p_body->>'order'='asc' then v->>'lastActiveAt' end asc nulls last,
    case when coalesce(p_body->>'sort','lastActive')='lastActive' and coalesce(p_body->>'order','desc')='desc' then v->>'lastActiveAt' end desc nulls last,v->>'id'
    limit page_size offset (page_no-1)*page_size)
  select (select count(*) from filtered), (select count(*) from filtered where v->'registeredPlatforms' ? 'ios'),
   (select count(*) from filtered where v->'registeredPlatforms' ? 'android'),(select count(*) from filtered where jsonb_array_length(v->'registeredPlatforms')>1),
   coalesce((select jsonb_agg(v) from ordered),'[]'::jsonb) into total,ios,android,multi,items;
  return jsonb_build_object('items',items,'pagination',jsonb_build_object('page',page_no,'pageSize',page_size,'totalItems',total,'totalPages',ceil(total::numeric/page_size)),
   'uniqueCustomersTotal',total,'iosCustomers',ios,'androidCustomers',android,'multiPlatformCustomers',multi,'region',jsonb_build_object('availability',case when total=0 then 'empty' else 'partial' end));
 end if;
 if not exists(select 1 from public.profiles where id=target) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
 if p_operation in ('detail','sessions-target','devices') then
  if p_operation='sessions-target' then return jsonb_build_object('userId',target); end if;
  if p_operation='detail' then
   select private.customer_admin_projection(target) into item;
   return item||jsonb_build_object('timezone',(select timezone from public.profiles where id=target),
    'currency',(select default_currency from public.user_preferences where user_id=target),'lastActivityByPlatform','{}'::jsonb,
    'onboardingStatus','unknown','currentPlan','unknown','risk',jsonb_build_object('level','unknown','label','غير مقاس / Unmeasured','updatedAt',null,'signalsCount',null),
    'aggregates',jsonb_build_object('accountsCount',null,'transactionsCount',null,'goalsCount',null,'activeDebtsCount',null,'importSourcesCount',null,'lastSyncAt',null),
    'region',jsonb_build_object('availability','partial'))-'plan'-'iosDeviceCount'-'androidDeviceCount'-'totalDeviceCount'-'webDeviceCount';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'userId',d.user_id,'safeLabel',coalesce(d.device_name,'Device'),
   'platform',d.platform,'osVersion',null,'appVersion',d.app_version,'lastSeenAt',d.last_seen_at,
   'pushState',case when exists(select 1 from public.push_tokens t where t.device_id=d.id and t.revoked_at is null) then 'enabled' else 'unknown' end,
   'shortcutState',case when d.platform='ios' then 'unknown' else 'not-applicable' end,
   'shareExtensionState',case when d.platform='ios' then 'unknown' else 'not-applicable' end,
   'smsTrackingState',case when d.platform='android' then 'unknown' else 'not-applicable' end,
   'notificationListenerState',case when d.platform='android' then 'unknown' else 'not-applicable' end,
   'backgroundState',case when d.platform='android' then 'unknown' else 'not-applicable' end,
   'sessionState',case when d.revoked_at is not null then 'revoked' else 'unknown' end,
   'state',case when d.revoked_at is null then 'active' else 'revoked' end,'revokedAt',d.revoked_at) order by d.last_seen_at desc,d.id),'[]'::jsonb)
   into items from (select * from public.user_devices where user_id=target  order by last_seen_at desc,id limit 101) d;
  if jsonb_array_length(items)>100 then raise exception 'CUSTOMER_DEVICES_LIMIT_EXCEEDED'; end if;
  return jsonb_build_object('items',items,'iosDeviceCount',(select count(*) from jsonb_array_elements(items) v where v->>'platform'='ios'),
   'androidDeviceCount',(select count(*) from jsonb_array_elements(items) v where v->>'platform'='android'),'webDeviceCount',(select count(*) from jsonb_array_elements(items) v where v->>'platform'='web'),'totalDeviceCount',jsonb_array_length(items),
   'activeDeviceCount',(select count(*) from jsonb_array_elements(items) v where v->>'state'='active'),
   'revokedDeviceCount',(select count(*) from jsonb_array_elements(items) v where v->>'state'='revoked'),'region',jsonb_build_object('availability',case when items='[]'::jsonb then 'empty' else 'partial' end));
 end if;
 if coalesce(length(p_body->>'reason'),0) not between 5 and 200 or coalesce(length(p_body->>'key'),0) not between 8 and 255 then raise exception 'VALIDATION_FAILED'; end if;
 command_key_hash:=encode(extensions.digest(p_body->>'key','sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(actor||p_operation||command_key_hash,0));
 select * into receipt from private.customer_session_commands where actor_id=actor and operation=p_operation and key_hash=command_key_hash;
 if found then
  if receipt.command<>(p_body-'key') then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return receipt.response||case when receipt.status='completed' then jsonb_build_object('outcome','success','providerStatus','completed')
   when receipt.status='failed' then jsonb_build_object('providerStatus','failed','message','Provider revocation failed; durable retry queued / تعذر الإلغاء لدى المزوّد وستتم إعادة المحاولة')
   else jsonb_build_object('providerStatus',receipt.status) end;
 end if;
 select status into old_status from public.profiles where id=target for update;
 if exists(select 1 from public.admin_profiles where user_id=target) then raise exception 'ADMIN_CUSTOMER_LIFECYCLE_DENIED' using errcode='42501'; end if;
 new_status:=old_status;
 if p_operation='suspend' then
  if old_status<>'active' then raise exception 'CUSTOMER_STATE_CONFLICT'; end if;
  new_status:='suspended'; update public.profiles set status=new_status where id=target;
 elsif p_operation='reactivate' then
  if old_status<>'suspended' then raise exception 'CUSTOMER_STATE_CONFLICT'; end if;
  new_status:='active'; update public.profiles set status=new_status where id=target;
 elsif old_status in ('deleted','deletion_pending') then raise exception 'CUSTOMER_STATE_CONFLICT';
 end if;
 if p_operation='revoke-device' then
  device:=(p_body->>'deviceId')::uuid;
  if not exists(select 1 from public.user_devices where id=device and user_id=target) then raise exception 'CUSTOMER_DEVICE_NOT_FOUND'; end if;
  update public.user_devices set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=device and user_id=target;
  update public.push_tokens set revoked_at=coalesce(revoked_at,clock_timestamp()) where device_id=device and user_id=target;
 end if;
 command_id:=extensions.gen_random_uuid();
 result:=jsonb_build_object('userId',target,'action',p_operation,'previousState',old_status,'currentState',new_status,
  'outcome',case when p_operation='reactivate' then 'success' else 'partial' end,'affectedCount',1,'occurredAt',clock_timestamp(),
  'message',case when p_operation='reactivate' then 'Reactivated / تمت إعادة التفعيل' else 'Local action saved; provider revocation pending / الإلغاء قيد التنفيذ' end,
  'auditReference',command_id,'providerStatus',case when p_operation='reactivate' then 'completed' else 'pending' end);
 insert into private.customer_session_commands(id,actor_id,user_id,operation,key_hash,command,response,status,device_id,session_ids)
 values(command_id,actor,target,p_operation,command_key_hash,p_body-'key',result,case when p_operation='reactivate' then 'completed' else 'pending' end,device,
  case when device is not null then coalesce((select jsonb_build_array(clerk_session_id) from public.user_devices where id=device and clerk_session_id is not null),'[]'::jsonb) end);
 perform audit.append_event(actor,'admin','customer.'||replace(p_operation,'-','_'),'profile',target,null,null,p_body->>'reason',command_id::text,jsonb_build_object('commandId',command_id));
 return result;
end;
$$;
revoke all on function private.customer_admin(text,jsonb) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.customer_admin(text,jsonb) to masarifi_api;
reset role;
revoke masarifi_migration from current_user granted by current_user;
