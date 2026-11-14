-- Run on the selected project through the existing authorized SQL connector after separate approval.
begin read only;
set local statement_timeout='5s';
select current_database()='postgres' as database_matches,
  (select encode(sha256(convert_to(system_identifier::text,'UTF8')),'hex') from pg_control_system()) as cluster_sha256,
  (select count(*) from supabase_migrations.schema_migrations) as ledger_count,
  (select encode(sha256(convert_to(string_agg(version,',' order by version),'UTF8')),'hex')
     from supabase_migrations.schema_migrations where version<>'20261107140100') as prior_versions_sha256,
  (select max(version) from supabase_migrations.schema_migrations) as latest_version,
  (select name from supabase_migrations.schema_migrations where version='20261107140100') as migration_name,
  (select cardinality(statements) from supabase_migrations.schema_migrations where version='20261107140100') as statement_count,
  (select encode(sha256(convert_to(statements[1],'UTF8')),'hex') from supabase_migrations.schema_migrations
     where version='20261107140100') as sql_sha256,
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid='private.support_access_requests'::regclass
     and conname='support_access_requests_customer_check' and convalidated) as consent_constraint;
rollback;
