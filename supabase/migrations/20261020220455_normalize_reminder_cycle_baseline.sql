grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Accept the already queued PostgreSQL representation as well as ISO, but
-- never let malformed event data abort a batch or depend on session timezone.
create function private.reminder_baseline(p_value text)
returns timestamptz language plpgsql stable strict set search_path='' as $$
begin
  if p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' then
    return null;
  end if;
  return p_value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value then
  return null;
end $$;
revoke all on function private.reminder_baseline(text) from public;
grant execute on function private.reminder_baseline(text) to masarifi_worker;

create or replace function private.list_reminder_candidates(p_limit integer)
returns table(kind text,user_id text,locale text,time_zone text,baseline_at text,evaluated_at text,inactive_days integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit not between 1 and 1000 then raise exception using errcode='22023',message='REMINDER_LIMIT_INVALID'; end if;
  return query
    with evaluated as (select clock_timestamp() now_at), candidates as (
      select 'app'::text kind,p.id user_id,p.locale,p.timezone time_zone,p.last_seen_at baseline_at,e.now_at evaluated_at,
        floor(extract(epoch from (e.now_at-p.last_seen_at))/86400)::integer inactive_days,
        case when p.last_seen_at<=e.now_at-interval '7 days' then 'reminder.app_inactive.7d' else 'reminder.app_inactive.3d' end event_type
      from public.profiles p cross join evaluated e
      where p.status='active' and p.last_seen_at<=e.now_at-interval '3 days'
      union all
      select 'financial'::text,p.id,p.locale,p.timezone,financial.baseline_at,e.now_at,
        floor(extract(epoch from (e.now_at-financial.baseline_at))/86400)::integer,
        'reminder.financial_inactive.7d' event_type
      from public.profiles p cross join evaluated e
      join public.tracking_preferences tracking on tracking.user_id=p.id and tracking.enabled
      cross join lateral (select coalesce(max(t.created_at),p.created_at) baseline_at
        from public.transactions t where t.user_id=p.id and t.deleted_at is null) financial
      where p.status='active' and p.last_seen_at>=e.now_at-interval '3 days'
        and financial.baseline_at<=e.now_at-interval '7 days'
    )
    select c.kind,c.user_id,c.locale,c.time_zone,
      to_char(c.baseline_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      to_char(c.evaluated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),c.inactive_days
    from candidates c
    where exists(select 1 from public.push_tokens token where token.user_id=c.user_id and token.revoked_at is null)
      and exists(select 1 from public.notification_preferences pref
        where pref.user_id=c.user_id and pref.channel='push' and pref.event_type=c.event_type and pref.enabled)
      and not exists(select 1 from public.notification_events event
        where event.user_id=c.user_id and event.type=c.event_type
          and private.reminder_baseline(event.data->>'cycleBaseline')=c.baseline_at)
    order by c.baseline_at,c.user_id limit p_limit;
end $$;

create or replace function private.reminder_delivery_eligible(p_event_id uuid,p_user_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(bool_and(
    p.status='active' and baseline.value is not null
    and exists(select 1 from public.notification_preferences pref
      where pref.user_id=e.user_id and pref.channel='push' and pref.event_type=e.type and pref.enabled)
    and case when e.type like 'reminder.app_inactive.%' then p.last_seen_at<=baseline.value
      when e.type='reminder.financial_inactive.7d' then exists(select 1 from public.tracking_preferences tracking
        where tracking.user_id=e.user_id and tracking.enabled)
        and not exists(select 1 from public.transactions t
          where t.user_id=e.user_id and t.deleted_at is null and t.created_at>baseline.value)
      else false end
  ),false)
  from public.notification_events e join public.profiles p on p.id=e.user_id
  cross join lateral (select private.reminder_baseline(e.data->>'cycleBaseline') value) baseline
  where e.id=p_event_id and e.user_id=p_user_id and e.type like 'reminder.%'
$$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
