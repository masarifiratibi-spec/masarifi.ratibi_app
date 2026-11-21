-- Keep the valid claim-order index and every pending event. The older index
-- begins with published_at, which is always NULL under the shared predicate.
-- Isolated claim ordering, concurrent claims and lease recovery were verified.
set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $guard$
begin
  if not exists (
    select 1 from pg_index old_index join pg_index retained
      on retained.indrelid = old_index.indrelid
    where old_index.indexrelid = to_regclass('private.outbox_events_claim_idx')
      and retained.indexrelid = to_regclass('private.outbox_events_claim_order_idx')
      and old_index.indrelid = 'private.outbox_events'::regclass
      and old_index.indisvalid and old_index.indisready
      and retained.indisvalid and retained.indisready
      and not old_index.indisunique and not old_index.indisprimary
      and not old_index.indisreplident
      and pg_get_indexdef(old_index.indexrelid) =
        'CREATE INDEX outbox_events_claim_idx ON private.outbox_events USING btree (published_at, available_at) WHERE (published_at IS NULL)'
      and pg_get_indexdef(retained.indexrelid) =
        'CREATE INDEX outbox_events_claim_order_idx ON private.outbox_events USING btree (available_at, id) WHERE (published_at IS NULL)'
      and not exists (select 1 from pg_constraint where conindid = old_index.indexrelid)
      and not exists (select 1 from pg_depend where refobjid = old_index.indexrelid)
      and (select relowner from pg_class where oid = old_index.indrelid) = 'masarifi_migration'::regrole
      and (select relowner from pg_class where oid = old_index.indexrelid) = 'masarifi_migration'::regrole
      and (select relowner from pg_class where oid = retained.indexrelid) = 'masarifi_migration'::regrole
  ) then
    raise exception 'OUTBOX_REDUNDANT_INDEX_REQUIRES_RECONCILIATION';
  end if;
  if exists (
    select 1 from pg_class cross join lateral unnest(reloptions) option
    where oid = 'private.outbox_events'::regclass
      and (option = 'autovacuum_enabled=false' or
        option like 'autovacuum_vacuum_scale_factor=%' and
        option <> 'autovacuum_vacuum_scale_factor=0.05')
  ) then
    raise exception 'OUTBOX_VACUUM_SETTINGS_REQUIRES_RECONCILIATION';
  end if;
  if current_setting('autovacuum') <> 'on' or current_setting('track_counts') <> 'on' then
    raise exception 'OUTBOX_VACUUM_PREREQUISITES_MISSING';
  end if;
  perform set_config('masarifi.queue.executor_role', current_setting('role'), true);
  perform set_config('masarifi.queue.original_own_membership', coalesce((
    select jsonb_build_object('admin', membership.admin_option,
      'inherit', membership.inherit_option, 'set', membership.set_option)::text
    from pg_auth_members membership
    where membership.roleid = 'masarifi_migration'::regrole
      and membership.member = current_user::regrole
      and membership.grantor = current_user::regrole
  ), 'null'), true);
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.queue.granted_role', 'false', true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.queue.granted_role', 'true', true);
  end if;
end
$guard$;

set local role masarifi_migration;
drop index private.outbox_events_claim_idx restrict;
-- Queue updates create obsolete tuple versions well before the inherited
-- 20% threshold on this large table. Schedule earlier ordinary vacuuming;
-- do not delete live rows or alter the global database maintenance budget.
alter table private.outbox_events set (autovacuum_vacuum_scale_factor = 0.05);

do $restore_executor$
begin
  perform set_config('role', current_setting('masarifi.queue.executor_role'), true);
end
$restore_executor$;

do $restore_membership$
declare prior_grant jsonb := current_setting('masarifi.queue.original_own_membership')::jsonb;
begin
  if current_setting('masarifi.queue.granted_role') = 'true' then
    if prior_grant = 'null'::jsonb then
      execute 'revoke masarifi_migration from current_user granted by current_user';
    else
      execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
        prior_grant->>'admin', prior_grant->>'inherit', prior_grant->>'set');
    end if;
  end if;
end
$restore_membership$;
