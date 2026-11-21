-- Retired: this installer merged report keys from two schemas into cleanup work
-- tagged only as 'report'. A missing object in the wrong store can acknowledge
-- the work while the actual PDF survives. Use the native lifecycle in a
-- dedicated QA database whose workers have only that database's storage key.
-- To inspect a database for previously installed hooks, run
-- test-staging-report-lifecycle.sql before starting its cleanup workers.
\set ON_ERROR_STOP on
do $$
begin
  raise exception using message='LEGACY_CROSS_STORE_REPORT_LIFECYCLE_UNSUPPORTED',
    hint='Use a dedicated QA database and object store. Existing hooks require a separate migration.';
end $$;
