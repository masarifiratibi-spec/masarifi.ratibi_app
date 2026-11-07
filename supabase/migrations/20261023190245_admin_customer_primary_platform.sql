grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;
create or replace function private.customer_admin_projection(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'id',p.id,'displayName',coalesce(p.display_name,'—'),
 'maskedEmail',case when p.primary_email is null then null else left(p.primary_email,1)||'***'||substring(p.primary_email from '@.*$') end,
 'country',null,'language',p.locale,'primaryPlatform',case when cardinality(d.platforms)=1 then d.platforms[1] else null end,
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
reset role;
revoke masarifi_migration from current_user granted by current_user;
