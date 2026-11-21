do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.nplusone_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.nplusone_grant', 'temporary', true);
  end if;
end
$role$;

set local role masarifi_migration;

-- Fetch only the requested answer and its question, even on a cold mobile client.
create function private.get_assistant_response_context(
  p_user_id text, p_response_id uuid, p_preview_id uuid
) returns table(value jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_user_id is distinct from public.current_clerk_user_id() then
    raise exception using errcode='42501',message='AI_OWNER_REQUIRED';
  end if;
  perform private.ai_assert_owner(p_user_id);
  if (p_response_id is null) = (p_preview_id is null) then
    raise exception using errcode='22023',message='AI_LOOKUP_INVALID';
  end if;
  return query
    with target as (
      select a.id,a.reply_to_message_id,a.conversation_id
      from public.assistant_messages a
      join public.assistant_conversations c on c.id=a.conversation_id and c.user_id=p_user_id
      where a.user_id=p_user_id and a.role='assistant' and c.status<>'deleted' and c.deleted_at is null
        and a.id=coalesce(p_response_id,(
          select p.message_id from public.assistant_action_previews p
          where p.id=p_preview_id and p.user_id=p_user_id and p.deleted_at is null
        ))
    )
    select jsonb_build_object(
        'id',m.id,'conversation_id',m.conversation_id,'reply_to_message_id',m.reply_to_message_id,
        'role',m.role,'work_status',m.work_status,'failure_code',m.failure_code,
        'content_redacted',m.content_redacted,'created_at',m.created_at,
        'context_payload',jsonb_build_object('assistantMetadata',m.context_payload->'assistantMetadata',
          'timezone',m.context_payload->'timezone'),
        'snapshot',(select to_jsonb(s)-array['user_id','message_id']
          from public.assistant_response_snapshots s where s.message_id=m.id and s.user_id=p_user_id),
        'preview',(select to_jsonb(p)-array['user_id','decision_token','decision_action','decision_lease_until','deleted_at']
          from public.assistant_action_previews p where p.message_id=m.id and p.user_id=p_user_id
            and p.deleted_at is null and (p_preview_id is null or p.id=p_preview_id)
          order by p.created_at,p.id limit 1))
    from target t
    join public.assistant_messages m on m.id in (t.id,t.reply_to_message_id)
      and m.user_id=p_user_id and m.conversation_id=t.conversation_id and (m.id=t.id or m.role='user')
    order by m.created_at desc,m.id desc;
end $$;
alter function private.get_assistant_response_context(text,uuid,uuid) owner to masarifi_migration;
revoke all on function private.get_assistant_response_context(text,uuid,uuid)
  from public,anon,authenticated,service_role,masarifi_worker;
grant execute on function private.get_assistant_response_context(text,uuid,uuid) to masarifi_api;

-- Lock owners in a consistent order. Read the cutoff in a fresh snapshot after any reset finishes.
create function private.eligible_notification_sources(p_sources jsonb)
returns table(source_index integer) language plpgsql volatile security definer set search_path='' as $$
declare owners text[];
begin
  select array_agg(distinct s.user_id) into owners from jsonb_to_recordset(p_sources) s(user_id text,event_type text)
    where not starts_with(s.event_type,'reminder.app_inactive.');
  perform p.id from public.profiles p where p.id=any(owners) order by p.id for share;
  perform e.owner_id from private.financial_reset_epochs e where e.owner_id=any(owners) order by e.owner_id for share;
  return query
    with cutoffs as (
      select r.owner_id,max(r.reset_at) cutoff from private.financial_reset_receipts r
      where r.owner_id=any(owners) group by r.owner_id
    )
    select s.source_index from jsonb_to_recordset(p_sources)
      s(source_index integer,user_id text,event_type text,occurred_at timestamptz,source_id text)
    left join public.profiles p on p.id=s.user_id
    left join cutoffs c on c.owner_id=s.user_id
    where (starts_with(s.event_type,'reminder.app_inactive.') or
      (p.status='active' and s.occurred_at is not null and (c.cutoff is null or s.occurred_at>c.cutoff)))
      and not exists (
        select 1 from public.transactions t
        where s.event_type in ('transaction.created','transfer.created','transaction.refunded','transaction.reversed','balance.changed')
          and t.id=case when s.source_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then s.source_id::uuid end
          and t.user_id=s.user_id and t.source='tracking-import' and t.status='confirmed' and t.deleted_at is null
      );
end $$;
revoke all on function private.eligible_notification_sources(jsonb) from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.eligible_notification_sources(jsonb) to masarifi_worker;

-- Aggregate each session once and update the selected, unlocked batch in one statement.
create or replace function private.reconcile_import_sessions(p_limit_count integer)
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer; locked_ids uuid[];
begin
  if p_limit_count is null or p_limit_count not between 1 and 1000 then
    raise exception using errcode='22023',message='IMPORT_RECONCILE_LIMIT_INVALID';
  end if;
  with counts as materialized (
    select i.session_id,count(*)::integer total,
      count(*) filter(where i.status='accepted')::integer accepted,
      count(*) filter(where i.status in ('rejected','duplicate','failed'))::integer rejected,
      bool_or(i.status in ('parsed','review')) pending
    from public.import_items i group by i.session_id
  ), candidates as (
    select s.id
    from public.import_sessions s left join counts c on c.session_id=s.id
    where (s.item_count,s.accepted_count,s.rejected_count)
      is distinct from (coalesce(c.total,0),coalesce(c.accepted,0),coalesce(c.rejected,0))
      or (s.status='review' and not coalesce(c.pending,false))
    order by s.updated_at,s.id for update of s skip locked limit p_limit_count
  ) select array_agg(id) into locked_ids from candidates;
  if locked_ids is null then return 0; end if;

  -- A writer may have finished after candidate selection took its snapshot. Recount only
  -- the locked sessions before deciding whether a review is terminal.
  with counts as (
    select s.id,count(i.id)::integer total,
      count(*) filter(where i.status='accepted')::integer accepted,
      count(*) filter(where i.status in ('rejected','duplicate','failed'))::integer rejected,
      (s.status='review' and count(*) filter(where i.status in ('parsed','review'))=0) close_review
    from public.import_sessions s left join public.import_items i on i.session_id=s.id
    where s.id=any(locked_ids) group by s.id
  ), updated as (
    update public.import_sessions s
    set item_count=c.total,accepted_count=c.accepted,rejected_count=c.rejected,
        status=case when c.close_review then 'complete' else s.status end,
        completed_at=case when c.close_review then clock_timestamp() else s.completed_at end
    from counts c where s.id=c.id and (c.close_review or
      (s.item_count,s.accepted_count,s.rejected_count) is distinct from (c.total,c.accepted,c.rejected))
    returning s.id,s.item_count,s.version,c.close_review
  ), notified as materialized (
    select private.enqueue_outbox_event('import.session.changed.v1','import-session',u.id,
    jsonb_build_object('sessionId',u.id,'status','complete','itemCount',u.item_count,'failedCount',0,
      'version',u.version,'occurredAt',clock_timestamp())) event_id
    from updated u where u.close_review
  )
  select (select count(*) from updated where not close_review) + (select count(*) from notified) into changed;
  return changed;
end $$;

reset role;

do $role$
begin
  if current_setting('masarifi.nplusone_grant') = 'temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
