"""Render exactly one target-bound PostgreSQL transaction. This tool never connects."""
import hashlib
from pathlib import Path
import sys

VERSION = "20261107140100"
NAME = "support_access_denial_without_consent"
FILE = f"{VERSION}_{NAME}.sql"
SHA = "4a826dda49786f3469f96b6c29dddebc8c652fcae0482e995869193d8fe5051c"
CLUSTER = "a191e84c52c98e63ce1057e2b7e740450864d7a041ef54e86af2e2b7dbeaaa04"
HISTORY = "4f88b17abe51db505b83f6eccf44aa645218205f0681580f3460c191c2f18c35"
OLD = "CHECK (((NOT customer_approval_required) OR (status = 'pending'::text) OR (customer_approved_at IS NOT NULL)))"
NEW = "CHECK (((NOT customer_approval_required) OR (status = ANY (ARRAY['pending'::text, 'denied'::text])) OR (customer_approved_at IS NOT NULL)))"


def render(raw):
    if hashlib.sha256(raw).hexdigest() != SHA:
        raise ValueError("CANONICAL_FILE_PIN_DRIFT")
    sql = raw.decode("utf-8")
    constraint = """(select pg_get_constraintdef(oid) from pg_catalog.pg_constraint
           where conrelid='private.support_access_requests'::regclass
             and conname='support_access_requests_customer_check' and contype='c' and convalidated)"""
    return f"""begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
set local idle_in_transaction_session_timeout='20s';
set local search_path=pg_catalog;
do $admit$
begin
  if current_database() <> 'postgres' or
     (select encode(sha256(convert_to(system_identifier::text,'UTF8')),'hex') from pg_control_system())
       is distinct from '{CLUSTER}' then raise exception 'WRONG_DATABASE'; end if;
  if not pg_try_advisory_xact_lock(5574319470126001::bigint) then raise exception 'MIGRATION_BUSY'; end if;
  perform set_config('masarifi.packet_executor', current_setting('role'), true);
end $admit$;
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $owner$
begin
  if pg_has_role(current_user,'masarifi_migration','SET') then
    perform set_config('masarifi.packet_grant','existing',true);
  else
    if exists(select from pg_auth_members where roleid='masarifi_migration'::regrole
              and member=current_user::regrole and grantor=current_user::regrole)
      then raise exception 'UNREVIEWED_EXISTING_GRANT'; end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I',current_user,current_user);
    perform set_config('masarifi.packet_grant','temporary',true);
  end if;
end $owner$;
set local role masarifi_migration;
lock table private.support_access_requests in access exclusive mode;
select set_config('role',current_setting('masarifi.packet_executor'),true);
do $before$
begin
  if (select count(*)<>177 or max(version)<>'20261107140000' or
       encode(sha256(convert_to(string_agg(version,',' order by version),'UTF8')),'hex')<>'{HISTORY}'
       from supabase_migrations.schema_migrations)
     or {constraint} is distinct from $check${OLD}$check$
     then raise exception 'MIGRATION_PREIMAGE_MISMATCH'; end if;
end $before$;
{sql}
select set_config('role',current_setting('masarifi.packet_executor'),true);
do $after$
begin
  if {constraint} is distinct from $check${NEW}$check$ then raise exception 'MIGRATION_POSTIMAGE_MISMATCH'; end if;
end $after$;
do $release$
begin
  if current_setting('masarifi.packet_grant')='temporary' then
    execute format('revoke masarifi_migration from %I granted by %I',current_user,current_user);
  end if;
end $release$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values ('{VERSION}','{NAME}',array[$source${sql}$source$]);
commit;
"""


if __name__ == "__main__":
    raw = (Path(__file__).resolve().parents[3] / "supabase" / "migrations" / FILE).read_bytes()
    sys.stdout.buffer.write(render(raw.replace(b"\r\n", b"\n")).encode("utf-8"))
