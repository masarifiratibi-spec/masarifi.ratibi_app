"""Render one VPS-bound transaction offline. Never connects or executes SQL."""
import hashlib
import re

VERSION = "20261107140100"
NAME = "support_access_denial_without_consent"
FILE = f"{VERSION}_{NAME}.sql"
SHA = "4a826dda49786f3469f96b6c29dddebc8c652fcae0482e995869193d8fe5051c"
OLD = "CHECK (((NOT customer_approval_required) OR (status = 'pending'::text) OR (customer_approved_at IS NOT NULL)))"
NEW = "CHECK (((NOT customer_approval_required) OR (status = ANY (ARRAY['pending'::text, 'denied'::text])) OR (customer_approved_at IS NOT NULL)))"

LEDGER_HASH = """(select encode(sha256(convert_to(coalesce(jsonb_agg(
  jsonb_build_array(version,name,statements) order by version),'[]'::jsonb)::text,'UTF8')),'hex')
  from supabase_migrations.schema_migrations)"""
MEMBERSHIP_HASH = """(select encode(sha256(convert_to(coalesce(jsonb_agg(
  jsonb_build_array(roleid,member,grantor,admin_option,inherit_option,set_option)
  order by roleid,member,grantor),'[]'::jsonb)::text,'UTF8')),'hex') from pg_auth_members)"""
CONSTRAINT = """(select pg_get_constraintdef(oid) from pg_catalog.pg_constraint
  where conrelid='private.support_access_requests'::regclass
  and conname='support_access_requests_customer_check' and contype='c' and convalidated)"""


def render(raw, pins):
    if hashlib.sha256(raw).hexdigest() != SHA:
        raise ValueError("CANONICAL_FILE_PIN_DRIFT")
    for field in ("clusterSha256", "ledgerSha256", "membershipsSha256"):
        if not isinstance(pins.get(field), str) or not re.fullmatch(r"[0-9a-f]{64}", pins[field]):
            raise ValueError("TARGET_PIN_REQUIRED")
    executor = pins.get("executor")
    if not isinstance(executor, str) or not re.fullmatch(r"[a-z_][a-z_0-9]{0,62}", executor):
        raise ValueError("EXECUTOR_PIN_REQUIRED")
    if pins.get("database") != "postgres" or pins.get("constraint") != OLD or pins.get("ledgerCount") != 177 or pins.get("latestVersion") != "20261107140000":
        raise ValueError("TARGET_PREIMAGE_NOT_ADMITTED")
    sql = raw.decode("utf-8")
    return f"""begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
set local idle_in_transaction_session_timeout='20s';
set local search_path=pg_catalog;
do $admit$
begin
  if current_database()<>'postgres' or session_user<>'{executor}' or current_user<>'{executor}'
     or (select encode(sha256(convert_to(system_identifier::text,'UTF8')),'hex') from pg_control_system())
       is distinct from '{pins['clusterSha256']}' then raise exception 'WRONG_DATABASE_OR_EXECUTOR'; end if;
  if not pg_try_advisory_xact_lock(5574319470126001::bigint) then raise exception 'MIGRATION_BUSY'; end if;
  perform set_config('masarifi.packet_executor',current_setting('role'),true);
end $admit$;
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $before$
begin
  if (select count(*)<>177 or max(version)<>'20261107140000' from supabase_migrations.schema_migrations)
     or {LEDGER_HASH} is distinct from '{pins['ledgerSha256']}'
     or {MEMBERSHIP_HASH} is distinct from '{pins['membershipsSha256']}'
     or {CONSTRAINT} is distinct from $check${OLD}$check$
     then raise exception 'MIGRATION_PREIMAGE_MISMATCH'; end if;
  if pg_has_role(current_user,'masarifi_migration','SET') then
    perform set_config('masarifi.packet_grant','existing',true);
  else
    if exists(select from pg_auth_members where roleid='masarifi_migration'::regrole
      and member=current_user::regrole and grantor=current_user::regrole)
      then raise exception 'UNREVIEWED_EXISTING_GRANT'; end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I',current_user,current_user);
    perform set_config('masarifi.packet_grant','temporary',true);
  end if;
end $before$;
set local role masarifi_migration;
lock table private.support_access_requests in access exclusive mode;
select set_config('role',current_setting('masarifi.packet_executor'),true);
do $locked$
begin
  if {CONSTRAINT} is distinct from $check${OLD}$check$ then raise exception 'CONSTRAINT_DRIFT'; end if;
end $locked$;
{sql}
select set_config('role',current_setting('masarifi.packet_executor'),true);
do $cleanup$
begin
  if current_setting('masarifi.packet_grant')='temporary' then
    execute format('revoke masarifi_migration from %I granted by %I',current_user,current_user);
  end if;
  if {CONSTRAINT} is distinct from $check${NEW}$check$
     or {MEMBERSHIP_HASH} is distinct from '{pins['membershipsSha256']}'
     or {LEDGER_HASH} is distinct from '{pins['ledgerSha256']}'
     then raise exception 'MIGRATION_POSTIMAGE_OR_GRANT_MISMATCH'; end if;
end $cleanup$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values ('{VERSION}','{NAME}',array[$source${sql}$source$]);
do $ledger$
begin
  if (select count(*)<>178 or max(version)<>'{VERSION}' from supabase_migrations.schema_migrations)
     or not exists(select from supabase_migrations.schema_migrations where version='{VERSION}'
       and name='{NAME}' and statements=array[$source${sql}$source$])
     then raise exception 'LEDGER_POSTIMAGE_MISMATCH'; end if;
end $ledger$;
commit;
"""
