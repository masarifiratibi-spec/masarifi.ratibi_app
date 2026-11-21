-- LOCAL owned PG17 cluster only, after the lifecycle's system/data/port identity check.
select jsonb_build_object('stage','before','roles',jsonb_agg(jsonb_build_object('role',rolname,'inherit',rolinherit,'super',rolsuper,'bypass',rolbypassrls) order by rolname)) from pg_roles where rolname in ('masarifi_migration','masarifi_worker','masarifi_api');
alter role masarifi_migration noinherit;
alter role masarifi_worker noinherit;
do $fixture$
begin
  if not exists(select 1 from pg_roles where rolname='masarifi_api') then create role masarifi_api nologin noinherit nosuperuser nobypassrls; end if;
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit; end if;
  if not exists(select 1 from pg_roles where rolname='t03_api_login') then create role t03_api_login login noinherit nosuperuser nobypassrls; end if;
  if exists(select 1 from pg_roles where rolname in ('masarifi_api','masarifi_migration','masarifi_worker') and (rolinherit or rolsuper or rolbypassrls or rolcanlogin)) then raise exception 'PRODUCT_FIXTURE_ROLE_CONTRACT'; end if;
end $fixture$;
-- Only the newly named synthetic API login obtains its representative API role.
grant masarifi_api to t03_api_login with inherit false,set true;
do $fixture$
begin
  if pg_has_role('t03_normal','masarifi_api','SET') or pg_has_role('t03_bootstrap','masarifi_worker','SET') or pg_has_role('t03_api_login','masarifi_worker','SET') then raise exception 'PRODUCT_FIXTURE_ROLE_SEPARATION'; end if;
end $fixture$;
select jsonb_build_object('stage','after','roles',jsonb_agg(jsonb_build_object('role',rolname,'inherit',rolinherit,'super',rolsuper,'bypass',rolbypassrls) order by rolname)) from pg_roles where rolname in ('masarifi_migration','masarifi_worker','masarifi_api');
