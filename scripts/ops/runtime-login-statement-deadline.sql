-- Bound abandoned runtime work on new PostgreSQL sessions as well as in the
-- application client. Existing sessions retain their current settings.
-- Operator configuration for separately provisioned runtime logins, not a schema
-- migration. Execute in an explicit transaction after capturing existing config;
-- do not insert a later schema-history entry ahead of pending migrations.
set local lock_timeout = '1s';
set local statement_timeout = '5s';

do $deadline$
declare
  login_name text;
  login_config text[];
  database_timeout text;
  database_timeout_ms integer;
begin
  -- Database+role settings win over global role defaults. Do not claim that
  -- ALTER ROLE fixes a connection whose per-database default differs.
  if exists (
    select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig) setting
    where s.setdatabase = (select oid from pg_database where datname = current_database())
      and s.setrole in (select oid from pg_roles where rolname in ('masarifi_api_login', 'masarifi_worker_login'))
      and setting like 'statement_timeout=%'
  ) then
    raise exception 'RUNTIME_DATABASE_ROLE_DEADLINE_REQUIRES_RECONCILIATION';
  end if;
  select substr(setting, length('statement_timeout=') + 1) into database_timeout
  from pg_db_role_setting s cross join lateral unnest(s.setconfig) setting
  where s.setdatabase = (select oid from pg_database where datname = current_database())
    and s.setrole = 0 and setting like 'statement_timeout=%';
  if database_timeout is not null then
    perform set_config('statement_timeout', database_timeout, true);
    select setting::integer into database_timeout_ms from pg_settings where name = 'statement_timeout';
    perform set_config('statement_timeout', '5s', true);
    if database_timeout_ms > 0 and database_timeout_ms < 2000 then
      raise exception 'RUNTIME_DATABASE_DEADLINE_REQUIRES_RECONCILIATION';
    end if;
  end if;
  foreach login_name in array array['masarifi_api_login', 'masarifi_worker_login']
  loop
    select rolconfig into login_config from pg_roles
    where rolname = login_name and rolcanlogin;
    if not found then
      continue;
    end if;
    -- Preserve stricter or differently managed deadlines for operator review.
    if exists (
      select 1 from unnest(login_config) setting
      where setting like 'statement_timeout=%' and setting <> 'statement_timeout=2s'
    ) then
      raise exception 'RUNTIME_LOGIN_DEADLINE_REQUIRES_RECONCILIATION';
    end if;
    execute format('alter role %I set statement_timeout = %L', login_name, '2s');
  end loop;
end
$deadline$;
