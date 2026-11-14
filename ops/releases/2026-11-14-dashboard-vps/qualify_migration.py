"""Run only on a new, isolated local PostgreSQL cluster owned by this process.

Usage: python -B qualify_migration.py PATH_TO_POSTGRES_BIN PRIVATE_EVIDENCE_DIRECTORY
"""
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
from unittest.mock import patch
import json

import migration_packet as packet


def qualify(bin_dir, evidence):
    root = Path(tempfile.mkdtemp(prefix="migration-fixture-", dir=evidence))
    data = root / "pgdata"
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    def run(name, args, **kw):
        if name == "pg_ctl":
            # The Windows server inherits redirected handles. A PIPE would keep
            # communicate() waiting after pg_ctl has already returned.
            with (root / "control.log").open("ab") as log:
                return subprocess.run([str(bin_dir / name), *args], stdout=log, stderr=log, timeout=30, **kw)
        return subprocess.run([str(bin_dir / name), *args], capture_output=True, **kw)
    run("initdb", ["-D", str(data), "-U", "packet_fixture", "-A", "trust", "-E", "UTF8",
                   "--locale=C"], check=True)
    server = ["-D", str(data), "-w", "-t", "20"]
    run("pg_ctl", [*server, "-l", str(root / "server.log"), "-o",
        f"-h 127.0.0.1 -p {port} -c shared_buffers=16MB -c max_connections=10", "start"], check=True)
    try:
        def sql(stmt, error=None, user="packet_fixture"):
            p = run("psql", ["-X", "-h", "127.0.0.1", "-p", str(port), "-U", user,
                "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], input=stmt.encode("utf8"))
            message = p.stderr.decode(errors="replace")
            if (error is None and p.returncode) or (error and (not p.returncode or error not in message)):
                raise RuntimeError("LOCAL_FIXTURE_SQL_FAILED: " + message)
            return p.stdout.decode().strip()
        # Confirm we reached the data directory just created; never modify an existing service.
        if Path(sql("show data_directory;")).resolve() != data.resolve():
            raise RuntimeError("NOT_THE_DISPOSABLE_FIXTURE")
        sql("""create role masarifi_migration; create schema private;
          create schema supabase_migrations;
          grant usage on schema private to masarifi_migration;
          create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
          insert into supabase_migrations.schema_migrations(version)
            select lpad(i::text,14,'0') from generate_series(1,176)i union all select '20261107140000';
          create table private.support_access_requests(customer_approval_required boolean not null,
            status text not null,customer_approved_at timestamptz, constraint support_access_requests_customer_check
            check(not customer_approval_required or status='pending' or customer_approved_at is not null));
          alter table private.support_access_requests owner to masarifi_migration;
          create role packet_executor login noinherit;
          grant masarifi_migration to packet_executor with admin true, set false, inherit false;
          grant usage on schema supabase_migrations,private to packet_executor;
          grant select,insert,update on supabase_migrations.schema_migrations to packet_executor;
          grant execute on function pg_catalog.pg_control_system() to packet_executor;""")
        raw = (Path(__file__).resolve().parents[3] / "supabase/migrations" / packet.FILE).read_bytes().replace(b"\r\n", b"\n")
        pins = dict(database="postgres", executor="packet_executor", constraint=packet.OLD,
                    ledgerCount=177, latestVersion="20261107140000",
                    clusterSha256=sql("select encode(sha256(convert_to(system_identifier::text,'UTF8')),'hex') from pg_control_system();"),
                    ledgerSha256=sql("select "+packet.LEDGER_HASH),
                    membershipsSha256=sql("select "+packet.MEMBERSHIP_HASH))
        def attempt(error=None, **drift):
            return sql(packet.render(raw, dict(pins, **drift)), error, user="packet_executor")
        def unchanged():
            if sql("select "+packet.LEDGER_HASH)!=pins["ledgerSha256"] or sql("select "+packet.MEMBERSHIP_HASH)!=pins["membershipsSha256"] or sql("select "+packet.CONSTRAINT)!=packet.OLD:
                raise RuntimeError("FAILED_TRANSACTION_CHANGED_PREIMAGE")
        attempt("WRONG_DATABASE_OR_EXECUTOR",clusterSha256="0"*64)
        unchanged()
        attempt("MIGRATION_PREIMAGE_MISMATCH",ledgerSha256="0"*64)
        unchanged()
        attempt("MIGRATION_PREIMAGE_MISMATCH",membershipsSha256="0"*64)
        unchanged()
        with patch.object(packet,"NEW","wrong target"):
            attempt("MIGRATION_POSTIMAGE_OR_GRANT_MISMATCH")
        unchanged()
        attempt()
        attempt("MIGRATION_PREIMAGE_MISMATCH")
        if sql("select pg_has_role(current_user,'masarifi_migration','SET');",user="packet_executor") != "f":
            raise RuntimeError("TEMPORARY_MEMBERSHIP_NOT_REMOVED")
        record = sql("select name||':'||cardinality(statements)||':'||encode(sha256(convert_to(statements[1],'UTF8')),'hex') "
                     "from supabase_migrations.schema_migrations where version='20261107140100';")
        if record != f"{packet.NAME}:1:{packet.SHA}":
            raise RuntimeError("LOCAL_LEDGER_BYTES_DRIFT")
        sql("insert into private.support_access_requests values(true,'denied',null);")
        sql("insert into private.support_access_requests values(true,'approved',null);", "support_access_requests_customer_check")
        (root/"qualification.json").write_text(json.dumps({"postgresVersion":sql("show server_version;"),"isolated":True,"passed":True,"checks":["cluster","ledger","memberships","atomic-failure","canonical-ledger-bytes","replay","grant-cleanup","denied-without-consent","approval-requires-consent"]},indent=2)+"\n")
        print("Local disposable SQL: cluster and ledger drift blocked; postimage failure rolled back; canonical DDL + ledger committed once; replay and approval without consent blocked.")
    finally:
        run("pg_ctl", [*server, "-m", "fast", "stop"], check=True)


if __name__ == "__main__":
    qualify(Path(sys.argv[1]).resolve(strict=True), Path(sys.argv[2]).resolve(strict=True))
