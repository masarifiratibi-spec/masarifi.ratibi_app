grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create function private.support_admin_attachment(p_ticket uuid,p_attachment uuid,p_request text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.assert_admin_permission('support.tickets.detail.read');
  select jsonb_build_object('storageRef',a.storage_ref) into result
    from private.support_attachments a join public.support_messages m on m.id=a.message_id and m.ticket_id=a.ticket_id
    where a.id=p_attachment and a.ticket_id=p_ticket and a.scan_status='clean'
      and a.storage_ref='support/'||p_ticket::text||'/'||p_attachment::text;
  if result is null then raise exception using errcode='P0002',message='SUPPORT_ATTACHMENT_UNAVAILABLE'; end if;
  perform audit.append_event(public.current_clerk_user_id(),'admin','support.attachment.download','support_attachment',
    p_attachment::text,null,null,null,p_request,jsonb_build_object('ticketId',p_ticket));
  return result;
end $$;
alter function private.support_admin_attachment(uuid,uuid,text) owner to masarifi_migration;
revoke all on function private.support_admin_attachment(uuid,uuid,text) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.support_admin_attachment(uuid,uuid,text) to masarifi_api;

create function private.support_admin_workload(p_query jsonb) returns jsonb
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
      and (p_query->>'from' is null or t.created_at>=(p_query->>'from')::date::timestamptz)
      and (p_query->>'to' is null or t.created_at<((p_query->>'to')::date+1)::timestamptz)
  ) select jsonb_build_object('total',count(*),'unassigned',count(*) filter(where assigned_admin_id is null),
    'byStatus',jsonb_build_object('open',count(*) filter(where status='open'),
      'waiting_support',count(*) filter(where status='waiting_support'),
      'waiting_customer',count(*) filter(where status='waiting_customer'),
      'resolved',count(*) filter(where status='resolved'),'closed',count(*) filter(where status='closed')))
    into result from filtered;
  return result;
end $$;
alter function private.support_admin_workload(jsonb) owner to masarifi_migration;
revoke all on function private.support_admin_workload(jsonb) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.support_admin_workload(jsonb) to masarifi_api;

-- Preserve the published implementation, adding locking/explicit conflict and assignment validation.
alter function private.execute_engagement_command(text,text,uuid,jsonb,integer,text,integer,integer) rename to execute_engagement_command_phase11;
revoke all on function private.execute_engagement_command_phase11(text,text,uuid,jsonb,integer,text,integer,integer) from masarifi_api;
create function private.execute_engagement_command(
  p_actor text,p_operation text,p_resource_id uuid,p_body jsonb,p_factor_age_seconds integer,p_request_id text,p_approval_threshold integer,p_reopen_hours integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare permission_name text; current_version bigint;
begin
  if p_operation in ('adminActOnSupportTicket','adminAddSupportInternalNote') then
    if p_actor is distinct from public.current_clerk_user_id() then raise exception using errcode='42501',message='ENGAGEMENT_COMMAND_FORBIDDEN'; end if;
    permission_name:=case when p_operation='adminAddSupportInternalNote' then 'support.tickets.notes'
      when p_body->>'action'='assign' then 'support.tickets.assign'
      when p_body->>'action'='priority' then 'support.tickets.priority'
      when p_body->>'action'='reply' then 'support.tickets.reply' else 'support.tickets.resolve' end;
    perform private.assert_engagement_admin(permission_name,p_factor_age_seconds);
    select version into current_version from public.support_tickets where id=p_resource_id for update;
    if current_version is null then raise exception using errcode='P0002',message='SUPPORT_TICKET_UNAVAILABLE'; end if;
    if current_version<>(p_body->>'expectedVersion')::bigint then raise exception using errcode='40001',message='SUPPORT_VERSION_CONFLICT'; end if;
    if p_body->>'action'='assign' and nullif(p_body->>'assigneeId','') is not null and not exists(
      select 1 from public.admin_profiles a join public.profiles p on p.id=a.user_id
      where a.user_id=p_body->>'assigneeId' and a.status='active' and p.status='active'
    ) then raise exception using errcode='22023',message='SUPPORT_ASSIGNEE_INVALID'; end if;
  end if;
  return private.execute_engagement_command_phase11(p_actor,p_operation,p_resource_id,p_body,p_factor_age_seconds,p_request_id,p_approval_threshold,p_reopen_hours);
end $$;
alter function private.execute_engagement_command(text,text,uuid,jsonb,integer,text,integer,integer) owner to masarifi_migration;
revoke all on function private.execute_engagement_command(text,text,uuid,jsonb,integer,text,integer,integer) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.execute_engagement_command(text,text,uuid,jsonb,integer,text,integer,integer) to masarifi_api;

alter function private.add_support_message(text,uuid,text,bigint,uuid[]) rename to add_support_message_phase11;
revoke all on function private.add_support_message_phase11(text,uuid,text,bigint,uuid[]) from masarifi_api;
create function private.add_support_message(p_user_id text,p_ticket_id uuid,p_body text,p_expected_version bigint,p_attachment_ids uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_version bigint;
begin
  perform private.assert_active_profile(p_user_id);
  select version into current_version from public.support_tickets where id=p_ticket_id and user_id=p_user_id for update;
  if current_version is null then raise exception using errcode='P0002',message='SUPPORT_TICKET_UNAVAILABLE'; end if;
  if current_version<>p_expected_version then raise exception using errcode='40001',message='SUPPORT_VERSION_CONFLICT'; end if;
  return private.add_support_message_phase11(p_user_id,p_ticket_id,p_body,p_expected_version,p_attachment_ids);
end $$;
alter function private.add_support_message(text,uuid,text,bigint,uuid[]) owner to masarifi_migration;
revoke all on function private.add_support_message(text,uuid,text,bigint,uuid[]) from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.add_support_message(text,uuid,text,bigint,uuid[]) to masarifi_api;
