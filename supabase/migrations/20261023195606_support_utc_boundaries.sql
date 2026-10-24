grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Match the Admin filter's explicit UTC calendar contract on any database timezone.
create or replace function private.support_admin_workload(p_query jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.assert_admin_permission('support.overview.read');
  with filtered as (
    select t.* from public.support_tickets t where
      (p_query->>'query' is null or position(lower(p_query->>'query') in lower(t.subject))>0 or t.id::text=p_query->>'query')
      and (p_query->>'status' is null or t.status=p_query->>'status')
      and (p_query->>'priority' is null or t.priority=p_query->>'priority')
      and (p_query->>'assignee' is null or (p_query->>'assignee'='unassigned' and t.assigned_admin_id is null) or t.assigned_admin_id=p_query->>'assignee')
      and (p_query->>'categoryId' is null or t.category_id=(p_query->>'categoryId')::uuid)
      and (p_query->>'from' is null or t.created_at>=((p_query->>'from')::date::timestamp at time zone 'UTC'))
      and (p_query->>'to' is null or t.created_at<(((p_query->>'to')::date+1)::timestamp at time zone 'UTC'))
  ) select jsonb_build_object('total',count(*),'unassigned',count(*) filter(where assigned_admin_id is null),
    'byStatus',jsonb_build_object('open',count(*) filter(where status='open'),
      'waiting_support',count(*) filter(where status='waiting_support'),
      'waiting_customer',count(*) filter(where status='waiting_customer'),
      'resolved',count(*) filter(where status='resolved'),'closed',count(*) filter(where status='closed')))
    into result from filtered;
  return result;
end $$;
