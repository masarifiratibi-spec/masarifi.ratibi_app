"""Current-source fixture provenance; never opens an application store."""
import importlib.util
from pathlib import Path
import sqlite3
import subprocess
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("schemas", Path(__file__).with_name("schema-fixtures.py"))
schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schemas)


class SchemaFixtureProvenanceTest(unittest.TestCase):
    def test_current_source_preserves_legacy_schema_and_adds_only_the_read_cache(self):
        source = schemas.pinned_source()
        migrations = schemas.migration_sql(source)
        self.assertEqual(set(migrations), set(range(1, 17)))
        history, _ = schemas.schema_parts(source)
        with sqlite3.connect(":memory:") as database:
            database.executescript(history)
            for version in range(1, 16):
                database.executescript(migrations[version])
                database.execute("INSERT INTO schema_migrations VALUES(?,0)", (version,))
            before = database.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall()
            database.executescript(migrations[16])
            after = database.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall()
            self.assertEqual([row for row in after if row[2] != "query_read_cache"], before)
            self.assertEqual([row[1] for row in database.execute("PRAGMA table_info(query_read_cache)")],
                             ["query_key", "locale", "schema_version", "payload", "updated_at"])

    def test_unreviewed_source_changes_still_fail_the_complete_source_pin(self):
        source = subprocess.check_output(["git", "show", "HEAD:" + schemas.SOURCE_PATH])
        with patch.object(schemas.subprocess, "check_output", return_value=source + b"\n// unreviewed change\n"):
            with self.assertRaisesRegex(AssertionError, "APPLICATION_SCHEMA_SOURCE_PIN_CHANGED"):
                schemas.pinned_source()

    def test_a_future_migration_is_not_silently_admitted(self):
        source = schemas.pinned_source()
        changed = source.replace("-- migration:16", "-- migration:17")
        with self.assertRaisesRegex(AssertionError, "MIGRATION_PREFIX_CHANGED"):
            schemas.migration_sql(changed)


if __name__ == "__main__":
    unittest.main()
