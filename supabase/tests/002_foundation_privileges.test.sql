begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select ok(not exists(
  select 1
  from pg_namespace namespace
  cross join lateral aclexplode(coalesce(
    namespace.nspacl,
    acldefault('n', namespace.nspowner)
  )) privilege
  where namespace.nspname = 'private'
    and privilege.grantee = 0
    and privilege.privilege_type = 'USAGE'
), 'PUBLIC cannot use private');
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon cannot use private');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated cannot use private');
select ok(not has_table_privilege('masarifi_api', 'private.outbox_events', 'SELECT'), 'API cannot select outbox');
select ok(not has_table_privilege('masarifi_api', 'private.outbox_events', 'INSERT'), 'API cannot insert outbox');
select ok(not has_table_privilege('masarifi_api', 'private.outbox_events', 'UPDATE'), 'API cannot update outbox');
select ok(not has_table_privilege('masarifi_api', 'private.outbox_events', 'DELETE'), 'API cannot delete outbox');
select ok(not has_table_privilege('anon', 'private.outbox_events', 'SELECT'), 'anon cannot select outbox');
select ok(not has_table_privilege('authenticated', 'private.outbox_events', 'SELECT'), 'authenticated cannot select outbox');
select ok(has_function_privilege('masarifi_api', 'private.enqueue_outbox_event(text,text,uuid,jsonb)', 'EXECUTE'), 'API can enqueue through function');
select ok(not has_function_privilege('masarifi_api', 'private.claim_outbox_batch(text,integer,integer)', 'EXECUTE'), 'API cannot claim');
select ok(has_function_privilege('masarifi_worker', 'private.claim_outbox_batch(text,integer,integer)', 'EXECUTE'), 'worker can claim');
select ok(has_table_privilege('masarifi_worker', 'private.outbox_events', 'SELECT'), 'worker can select outbox');
select ok(not has_table_privilege('masarifi_worker', 'private.outbox_events', 'INSERT'), 'worker cannot insert directly');
select ok(not has_table_privilege('masarifi_worker', 'private.outbox_events', 'DELETE'), 'worker cannot delete outbox');
select ok(not exists(
  select 1
  from pg_proc function
  cross join lateral aclexplode(coalesce(
    function.proacl,
    acldefault('f', function.proowner)
  )) privilege
  where function.oid = 'private.enqueue_outbox_event(text,text,uuid,jsonb)'::regprocedure
    and privilege.grantee = 0
    and privilege.privilege_type = 'EXECUTE'
), 'PUBLIC cannot enqueue');
select ok(not has_function_privilege('anon', 'private.claim_outbox_batch(text,integer,integer)', 'EXECUTE'), 'anon cannot claim');
select ok(not has_schema_privilege('authenticated', 'pgmq', 'USAGE'), 'clients cannot use queue schema');

select * from finish();
rollback;
