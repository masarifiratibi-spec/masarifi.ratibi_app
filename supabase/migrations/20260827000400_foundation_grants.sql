set local role masarifi_migration;

revoke all on schema private, audit from public, anon, authenticated;
revoke all on private.outbox_events from public, anon, authenticated, masarifi_api;

grant usage on schema private to masarifi_api, masarifi_worker;
grant execute on function private.enqueue_outbox_event(text, text, uuid, jsonb)
  to masarifi_api, masarifi_worker;
grant execute on function private.claim_outbox_batch(text, integer, integer)
  to masarifi_worker;

grant select on private.outbox_events to masarifi_worker;
grant update (
  available_at,
  published_at,
  attempt_count,
  last_error_code,
  locked_by,
  locked_until
) on private.outbox_events to masarifi_worker;

create policy outbox_worker_select
on private.outbox_events
for select
to masarifi_worker
using (true);

create policy outbox_migration_owner_all
on private.outbox_events
for all
to masarifi_migration
using (true)
with check (true);

create policy outbox_worker_update
on private.outbox_events
for update
to masarifi_worker
using (true)
with check (true);

reset role;

grant usage on schema pgmq to masarifi_api, masarifi_worker;
grant execute on function pgmq.send(text, jsonb, integer) to masarifi_worker;

revoke all on schema pgmq from anon, authenticated;
revoke all on all tables in schema pgmq from anon, authenticated;
revoke all on all functions in schema pgmq from anon, authenticated;

revoke masarifi_migration from current_user granted by current_user;
