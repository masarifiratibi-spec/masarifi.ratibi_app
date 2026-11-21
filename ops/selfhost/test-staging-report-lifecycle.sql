-- Read-only deployment check. A previously patched database needs operator
-- reconciliation of pending work and objects before the hooks can be removed.
\set ON_ERROR_STOP on
begin read only;
do $$
declare target regprocedure;
begin
  foreach target in array array[
    'private.begin_account_erasure(uuid,text)'::regprocedure,
    'private.lock_account_erasure_objects(uuid,text)'::regprocedure,
    'private.erase_account_owner_payload(uuid,text)'::regprocedure,
    'private.reset_financial_data(text,uuid)'::regprocedure
  ] loop
    if strpos(pg_get_functiondef(target),'staging_reports.') > 0 then
      raise exception 'LEGACY_CROSS_STORE_REPORT_HOOK_PRESENT: %', target;
    end if;
  end loop;
end $$;
commit;
