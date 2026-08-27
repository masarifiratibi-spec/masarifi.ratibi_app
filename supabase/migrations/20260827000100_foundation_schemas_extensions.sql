create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgmq;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'masarifi_migration') then
    create role masarifi_migration nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'masarifi_api') then
    create role masarifi_api nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'masarifi_worker') then
    create role masarifi_worker nologin noinherit;
  end if;
  if exists (
    select 1
    from pg_roles
    where rolname in ('masarifi_migration', 'masarifi_api', 'masarifi_worker')
      and (
        rolcanlogin
        or rolinherit
        or rolsuper
        or rolcreatedb
        or rolcreaterole
        or rolreplication
        or rolbypassrls
        or rolconnlimit <> -1
      )
  ) then
    raise exception using errcode = '42501', message = 'FOUNDATION_ROLE_ATTRIBUTES_INVALID';
  end if;
end
$roles$;

grant masarifi_migration to current_user with set true, inherit false;

create schema if not exists private authorization masarifi_migration;
create schema if not exists audit authorization masarifi_migration;

revoke create on schema public from public;
revoke all on schema private, audit from public, anon, authenticated;
grant usage on schema extensions to masarifi_migration;
grant execute on function extensions.gen_random_uuid() to masarifi_migration;

set local role masarifi_migration;

alter default privileges for role masarifi_migration in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role masarifi_migration in schema private
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role masarifi_migration in schema private
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role masarifi_migration in schema audit
  revoke all on tables from public, anon, authenticated;
alter default privileges for role masarifi_migration in schema audit
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role masarifi_migration in schema audit
  revoke execute on functions from public, anon, authenticated;

reset role;
