-- Optional owner of the migration's dirty queue when tracking.reconcile has no active worker.
-- Install as the same authorized pg_cron login used for all repair jobs.
-- Keep only one configured scheduling path. The SQL function also supports overlapping recovery calls.
begin;
do $$ begin
  if not pg_has_role(current_user,'masarifi_worker','SET') or
     not has_function_privilege('masarifi_worker','private.reconcile_import_sessions(integer)','EXECUTE') then
    raise exception 'IMPORT_RECONCILIATION_WORKER_REQUIRED';
  end if;
end $$;
select cron.schedule('masarifi-import-reconciliation','*/5 * * * *',
  $job$set local role masarifi_worker; set local lock_timeout='250ms'; set local statement_timeout='2s';
  select private.reconcile_import_sessions(8);$job$);
commit;
