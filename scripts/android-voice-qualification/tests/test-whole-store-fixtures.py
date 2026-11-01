"""Portable corpus/oracle checks using plain SQLite at the cipher-writer boundary.

This verifies fixture construction, not encryption, RAM VFS, JNI or Android.
"""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("whole", Path(__file__).with_name("whole-store-fixtures.py"))
whole = importlib.util.module_from_spec(spec)
spec.loader.exec_module(whole)


class PlainWriter:
    def __init__(self, library, path):
        self.connection = sqlite3.connect(path, isolation_level=None)
        self.connection.execute("PRAGMA synchronous=OFF")

    def execute(self, sql):
        try:
            self.connection.execute(sql)
        except sqlite3.ProgrammingError as multiple:
            if "one statement" not in str(multiple):
                raise
            self.connection.executescript(sql)

    def close(self):
        self.connection.close()


class WholeStoreCorpusTest(unittest.TestCase):
    def test_current_old_cache_and_future_cases_have_exact_independent_oracles(self):
        real_helper = whole.helper
        def helper(name, filename):
            if filename == "real-wal-fixtures.py":
                return SimpleNamespace(library_api=lambda path: None, CipherConnection=PlainWriter)
            return real_helper(name, filename)

        with tempfile.TemporaryDirectory(prefix="vqs-corpus-test-") as directory:
            root = Path(directory) / "fixtures"
            with patch.object(whole, "helper", side_effect=helper), patch.object(sys, "argv", ["whole", "--output", str(root), "--sqlcipher-library", "unused"]), contextlib.redirect_stdout(io.StringIO()):
                whole.main()
            cases = {path.name: json.loads((path / "fixture.json").read_text()) for path in root.iterdir()}
            self.assertTrue("empty-current-schema16" in cases, "current16 fixture missing")
            self.assertEqual(len(cases), 69)
            self.assertEqual(sum(case["verdict"] == "INDETERMINATE" for case in cases.values()), 27)
            for name in ("empty-current-schema16", "cache-populated-schema16"):
                self.assertEqual(cases[name]["verdict"], "CLEAR")
                self.assertEqual(cases[name]["launchAdmission"]["admissionLocalStatus"], "OBSERVED_NO_LOCAL_BLOCKER")
                database = root / name / "input/files/SQLite" / ("masarifi-" + whole.A[:24] + ".db")
                with contextlib.closing(sqlite3.connect(database)) as connection:
                    self.assertEqual(connection.execute("SELECT max(version) FROM schema_migrations").fetchone()[0], 16)
                    columns = connection.execute("PRAGMA table_info(query_read_cache)").fetchall()
                    self.assertEqual([(column[1], column[5]) for column in columns if column[5]], [("query_key", 1), ("locale", 2)])
                    self.assertEqual(connection.execute("SELECT count(*) FROM query_read_cache").fetchone()[0], int(name.startswith("cache-populated")))
            for name in ("older-schema15-queues", "mixed-schema15-schema16"):
                self.assertEqual(cases[name]["admission"]["admissionSchemaCurrent"], "false")
                self.assertEqual(cases[name]["launchAdmission"]["admissionLocalStatus"], "BLOCKED")
            self.assertEqual(cases["older-schema15-queues"]["admission"]["admissionFinancePending"], "1")
            self.assertEqual(cases["older-schema15-queues"]["admission"]["admissionTrackingRows"], "1")
            for name in ("future-schema17", "cache-missing-table", "cache-altered-pk", "cache-extra-index", "cache-spoofed-history15", "cache-extra-trigger", "invalid-sync-state15", "invalid-sync-state16"):
                self.assertEqual(cases[name]["verdict"], "INDETERMINATE")
                self.assertEqual(cases[name]["qualificationStage"], "MOBILE_SCHEMA")
                self.assertNotIn("admission", cases[name])


if __name__ == "__main__":
    unittest.main()
