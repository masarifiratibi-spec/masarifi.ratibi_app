"""Current-source fixture provenance; never opens an application store."""
import importlib.util
import hashlib
from pathlib import Path
import re
import sqlite3
import subprocess
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("schemas", Path(__file__).with_name("schema-fixtures.py"))
schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schemas)


class SchemaFixtureProvenanceTest(unittest.TestCase):
    def test_reviewed_migration_history_and_marker_templates_remain_exact(self):
        source = schemas.pinned_source()
        templates = [
            (r"const migrations = parseMigrations\(`(.*?)`\);", 1, "9c4937ba6c3c2524f977739415b3f659bfdd44d5c38340139ae6d122679d1583"),
            (r"CREATE TABLE IF NOT EXISTS schema_migrations \(.*?\);", 0, "fee924110e4ed5f82e984b893a246fd83c5605048568174a5932973ac2fb1602"),
            (r"CREATE TABLE IF NOT EXISTS \$\{LEGACY_MIGRATION_TABLE\} \(.*?\);", 0, "f6c4b1d94505fc815182e3bd2d9e40f30d1182f92f791cd976c94d92e5436144"),
        ]
        for pattern, group, expected in templates:
            self.assertEqual(hashlib.sha256(re.search(pattern, source, re.S).group(group).encode()).hexdigest(), expected)

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
            self.assertEqual([(row[1], row[5]) for row in database.execute("PRAGMA table_info(query_read_cache)") if row[5]],
                             [("query_key", 1), ("locale", 2)])
            self.assertEqual(schemas.signature(after), "55f9106206256b251f42f3dbe1e0a02cc8c4433dd29c98d3a0e59292e76487a3")

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
