"""Render a reviewed, atomic forward or rollback transaction for the release operator."""
import argparse
import hashlib
import json
from pathlib import Path


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def bindings(packet, phase):
    assertions = []
    for function in packet["functions"]:
        assertions.append(f"""
    if not exists (select from pg_proc where oid={quote(function['signature'])}::regprocedure
        and md5(replace(prosrc, chr(13), ''))={quote(function[phase])}
        and pg_get_userbyid(proowner)={quote(function['owner'])} and proacl::text={quote(function['acl'])}) then
      raise exception 'Function binding changed: {function['signature']}';
    end if;""")
    for policy in packet["policies"]:
        assertions.append(f"""
    if not exists (select from pg_policies where schemaname='public' and tablename={quote(policy['table'])}
        and policyname={quote(policy['name'])} and md5(replace(qual,chr(13),''))={quote(policy[phase])}
        and cmd='SELECT' and permissive='PERMISSIVE' and roles=array['masarifi_api']::name[] and with_check is null) then
      raise exception 'Policy binding changed: {policy['name']}';
    end if;""")
    return "do $bindings$ begin\n" + "".join(assertions) + "\nend $bindings$;"


def render(direction):
    package = Path(__file__).resolve().parent
    packet = json.loads((package / "manifest.json").read_text(encoding="utf-8"))
    migration = package.parents[2] / packet["migration"]
    forward = migration.read_text(encoding="utf-8").encode("utf-8")
    reverse = (package / "rollback.sql").read_text(encoding="utf-8").encode("utf-8")
    if hashlib.sha256(forward).hexdigest() != packet["migrationSha256"] or hashlib.sha256(reverse).hexdigest() != packet["rollbackSha256"]:
        raise ValueError("Release file hashes differ from the review")
    applying = direction == "apply"
    version = quote(packet["version"])
    name = quote(packet["name"])
    source = "$personal_migration$" + forward.decode("utf-8") + "$personal_migration$"
    match = f"version={version} and name={name} and statements=array[{source}]::text[]"
    history = f"insert into supabase_migrations.schema_migrations(version,name,statements) values({version},{name},array[{source}]);" if applying else f"delete from supabase_migrations.schema_migrations where {match};"
    required = f"exists(select from supabase_migrations.schema_migrations where version={version})" if applying else f"not exists(select from supabase_migrations.schema_migrations where {match})"
    edges = """(select coalesce(jsonb_agg(to_jsonb(m) - 'oid' order by grantor), '[]'::jsonb)::text
                       from pg_auth_members m where member=current_user::regrole and roleid='masarifi_migration'::regrole)"""
    return f"""begin;
set local search_path=pg_catalog,public;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(5574319470126038);
select set_config('masarifi.personal_edges', {edges}, true);
do $history$ begin
  if {required} or exists(select from supabase_migrations.schema_migrations where version>{version}) then
    raise exception 'Reconcile migration history before running this transaction';
  end if;
end $history$;
{bindings(packet, 'before' if applying else 'after')}
{(forward if applying else reverse).decode('utf-8')}
{bindings(packet, 'after' if applying else 'before')}
do $edges$ begin
  if {edges} is distinct from current_setting('masarifi.personal_edges') then
    raise exception 'Migration membership changed';
  end if;
end $edges$;
{history}
commit;
"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("direction", choices=["apply", "rollback"])
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    with args.output.open("x", encoding="utf-8", newline="\n") as output:
        output.write(render(args.direction))
