-- REVIEW REQUIRED. Run only after approval of this exact release manifest.
-- Connect with the existing postgres executor and verify-full CA configuration.
-- psql -X --set=ON_ERROR_STOP=1 --file=apply-forward.sql
-- No migration runner, db push, reset, history repair, or pending-work replay.
\set ON_ERROR_STOP on
BEGIN READ WRITE;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
DO $preflight$
DECLARE history_count bigint; history_hash text;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'ACTUAL_POSTGRES_NONSUPERUSER_EXECUTOR_REQUIRED';
  END IF;
  IF current_setting('server_version_num') <> '170006' THEN
    RAISE EXCEPTION 'QUALIFIED_POSTGRES_VERSION_CHANGED';
  END IF;
  IF NOT pg_try_advisory_xact_lock(5574319470126001) THEN
    RAISE EXCEPTION 'MIGRATION_LOCK_UNAVAILABLE';
  END IF;
  SELECT count(*),md5(coalesce(string_agg(to_jsonb(r)::text,'' ORDER BY to_jsonb(r)::text),''))
    INTO history_count,history_hash FROM supabase_migrations.schema_migrations r;
  IF history_count <> 174 OR history_hash <> 'b7a4afa8eba8cdc75d905ca1505152a9' THEN
    RAISE EXCEPTION 'FROZEN_HOSTED_HISTORY_CHANGED';
  END IF;
  PERFORM set_config('masarifi.release.history_before',history_hash,true);
  PERFORM set_config('masarifi.release.members_before',
    (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY m.oid),'')) FROM pg_auth_members m),true);
END $preflight$;
\ir 01_guarded_missing_helpers.sql
\ir 02_guarded_existing_domain_corrections.sql
\ir 03_guarded_tracking_owner_context_chain.sql
\ir 04_guarded_remaining_semantic_compatibility.sql
\ir 05_guarded_production_installation_consent.sql
DO $postflight$
BEGIN
  IF (SELECT md5(coalesce(string_agg(to_jsonb(r)::text,'' ORDER BY to_jsonb(r)::text),''))
      FROM supabase_migrations.schema_migrations r)
    IS DISTINCT FROM current_setting('masarifi.release.history_before') THEN
    RAISE EXCEPTION 'HISTORICAL_MIGRATIONS_CHANGED';
  END IF;
  IF (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY m.oid),'')) FROM pg_auth_members m)
    IS DISTINCT FROM current_setting('masarifi.release.members_before') THEN
    RAISE EXCEPTION 'ROLE_GRAPH_CHANGED';
  END IF;
END $postflight$;
COMMIT;
