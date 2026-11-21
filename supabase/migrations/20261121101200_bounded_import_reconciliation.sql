set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $guard$
begin
  perform set_config('masarifi.import_reconcile.executor_role', current_setting('role'), true);
  perform set_config('masarifi.import_reconcile.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.import_reconcile.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.import_reconcile.granted_role', 'true', true);
  end if;
end
$guard$;

set local role masarifi_migration;

-- A writer can already hold either an item or its parent when it changes a session.
-- Separate transactions must never contend on a shared "dirty" row while holding these locks.
create table private.import_reconcile_changes (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  writer xid8 not null default pg_current_xact_id(),
  unique (writer, session_id)
);

-- A deleted parent leaves only its opaque ID in this transient queue until the next claim.
-- An FK here would require a parent lock even for item-only writers and cascade triggers.
create table private.import_reconcile_scan (
  singleton boolean primary key default true check (singleton),
  last_id uuid,
  next_page_at timestamptz not null default now()
);
insert into private.import_reconcile_scan default values;

revoke all on private.import_reconcile_changes, private.import_reconcile_scan,
  private.import_reconcile_changes_id_seq from public, anon, authenticated, service_role, masarifi_api, masarifi_worker;

create function private.mark_import_session_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='import_sessions' then
    insert into private.import_reconcile_changes(session_id) values(new.id)
      on conflict (writer, session_id) do nothing;
  else
    if tg_op='DELETE' or (tg_op='UPDATE' and old.session_id<>new.session_id) then
      insert into private.import_reconcile_changes(session_id) values(old.session_id)
        on conflict (writer, session_id) do nothing;
    end if;
    if tg_op<>'DELETE' then
      insert into private.import_reconcile_changes(session_id) values(new.session_id)
        on conflict (writer, session_id) do nothing;
    end if;
  end if;
  return null;
end $$;
revoke all on function private.mark_import_session_change()
  from public, anon, authenticated, service_role, masarifi_api, masarifi_worker;

create trigger import_reconcile_session_insert after insert on public.import_sessions
for each row when (new.status='review' or new.item_count<>0)
execute function private.mark_import_session_change();

create trigger import_reconcile_session_update after update of status,item_count,accepted_count,rejected_count
on public.import_sessions for each row
when ((new.status='review' and old.status<>new.status) or
      (old.item_count,old.accepted_count,old.rejected_count) is distinct from
      (new.item_count,new.accepted_count,new.rejected_count))
execute function private.mark_import_session_change();

create trigger import_reconcile_item_insert_delete after insert or delete on public.import_items
for each row execute function private.mark_import_session_change();
create trigger import_reconcile_item_update after update of session_id,status on public.import_items
for each row when ((old.session_id,old.status) is distinct from (new.session_id,new.status))
execute function private.mark_import_session_change();

-- A page includes old rows whose counters drifted before dirty tracking was installed.
-- Persist the cursor and its next due time atomically with the repair requests.
create function private.queue_import_recovery_page(p_limit integer) returns void
language plpgsql set search_path='' as $$
declare
  after_id uuid;
  page uuid[];
  page_size integer := least(64,p_limit);
begin
  select last_id into after_id from private.import_reconcile_scan
  where singleton and next_page_at<=clock_timestamp() for update skip locked;
  if not found then return; end if;

  select array_agg(id order by id) into page from (
    select id from public.import_sessions
    where id>=coalesce(after_id,'00000000-0000-0000-0000-000000000000'::uuid)
      and id is distinct from after_id
    order by id limit page_size
  ) bounded;
  insert into private.import_reconcile_changes(session_id)
    select unnest(page) on conflict (writer, session_id) do nothing;
  if cardinality(page)=page_size then
    update private.import_reconcile_scan
    set last_id=page[page_size],next_page_at=clock_timestamp()+interval '5 minutes' where singleton;
  else
    update private.import_reconcile_scan
    set last_id=null,next_page_at=clock_timestamp()+interval '1 day' where singleton;
  end if;
end $$;
revoke all on function private.queue_import_recovery_page(integer)
  from public, anon, authenticated, service_role, masarifi_api, masarifi_worker;

create or replace function private.reconcile_import_sessions(p_limit_count integer)
returns integer language plpgsql security definer set search_path='' as $$
declare
  probed bigint[];
  locked_ids uuid[];
  changed integer := 0;
begin
  if p_limit_count is null or p_limit_count not between 1 and 1000 then
    raise exception using errcode='22023',message='IMPORT_RECONCILE_LIMIT_INVALID';
  end if;
  perform private.queue_import_recovery_page(p_limit_count);

  -- Read a bounded FIFO window without reserving spare sessions from other workers.
  with probe as materialized (
    select id,session_id from private.import_reconcile_changes order by id limit 2*p_limit_count
  ), candidates as (
    select session_id from probe group by session_id order by min(id)
  ), claimed as materialized (
    select s.id from candidates c cross join lateral (
      select id from public.import_sessions where id=c.session_id for update skip locked
    ) s limit p_limit_count
  )
  select array(select id from probe),array(select id from claimed) into probed,locked_ids;

  if cardinality(locked_ids)>0 then
    -- Fresh snapshot after acquiring parent locks. The parameterized index probe reads
    -- only each claimed session's items, even with a large completed-session history.
    with counts as (
      select s.id,c.total,c.accepted,c.rejected,s.status='review' and c.pending=0 close_review
      from unnest(locked_ids) k(id) join public.import_sessions s using(id)
      cross join lateral (
        select count(*)::integer total,
          count(*) filter(where i.status='accepted')::integer accepted,
          count(*) filter(where i.status in ('rejected','duplicate','failed'))::integer rejected,
          count(*) filter(where i.status in ('parsed','review')) pending
        from public.import_items i where i.session_id=k.id
      ) c
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
    select (select count(*) from updated where not close_review)+(select count(*) from notified) into changed;
  end if;

  -- Acknowledge only observed marks and our own update trigger. A transaction still
  -- accepting an item has a distinct mark and will be visited after its commit.
  with taken as materialized (
    select q.id from private.import_reconcile_changes q
    where (q.id=any(probed) and (q.session_id=any(locked_ids) or not exists (
      select 1 from public.import_sessions s where s.id=q.session_id
    ))) or (q.writer=pg_current_xact_id_if_assigned() and q.session_id=any(locked_ids))
    order by q.id for update skip locked
  )
  delete from private.import_reconcile_changes q using taken where q.id=taken.id;

  -- If every available candidate was examined, rotate the locked leftovers to
  -- prevent a locked prefix from starving unrelated work beyond the probe window.
  if cardinality(locked_ids)<p_limit_count then
    with deferred as materialized (
      select id from private.import_reconcile_changes where id=any(probed)
      order by id for update skip locked
    )
    update private.import_reconcile_changes q set id=default from deferred where q.id=deferred.id;
  end if;
  return changed;
end $$;

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.import_reconcile.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.import_reconcile.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.import_reconcile.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
