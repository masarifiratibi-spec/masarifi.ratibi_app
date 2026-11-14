"""Tiny pinned artifacts; no real deployment paths or user ownership changes."""
import hashlib
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import stage_admin


def sha(value):
    return hashlib.sha256(value).hexdigest()


class StageTests(unittest.TestCase):
    def fixture(self, parent, extra=None):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w:gz") as tar:
            for name, raw in [("apps/admin-web/.next/BUILD_ID", b"fixture-build\n"), *(extra or [])]:
                member = tarfile.TarInfo(name)
                member.size = len(raw)
                member.mode = 0o644
                tar.addfile(member, io.BytesIO(raw))
        archive = stream.getvalue()
        manifest = b'{"fixture":true}'
        path = parent / "artifact.zip"
        with zipfile.ZipFile(path, "w") as out:
            out.writestr("masarifi-admin-" + "a" * 40 + ".tar.gz", archive)
            out.writestr("manifest.json", manifest)
            out.writestr("SHA256SUMS", b"fixture")
        return path, dict(zipBytes=path.stat().st_size, zipSha256=sha(path.read_bytes()),
                          source="a" * 40, manifestSha256=sha(manifest), archiveBytes=len(archive),
                          archiveSha256=sha(archive), members=1 + len(extra or []), buildId="fixture-build")

    def test_external_cache_has_an_existing_mountpoint_inside_readonly_runtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent = Path(tmp).resolve()
            archive, pins = self.fixture(parent)
            root = parent / "release"
            root.mkdir()
            with patch.object(stage_admin.os, "chown", create=True) as chown:
                runtime = stage_admin.admin(archive, root, pins)
                chown.assert_called_once_with(root / "cache", 1000, 1000)
            self.assertTrue((runtime / "apps/admin-web/.next/cache").is_dir())
            self.assertTrue((root / "cache").is_dir())
            self.assertFalse((runtime / "apps/admin-web/.next/cache").is_symlink())

    def test_archive_escape_is_rejected_before_runtime_files_are_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent = Path(tmp).resolve()
            archive, pins = self.fixture(parent, [("../escape", b"bad")])
            root = parent / "release"
            root.mkdir()
            with self.assertRaisesRegex(RuntimeError, "UNSAFE_MEMBER_PATH"):
                stage_admin.admin(archive, root, pins)
            self.assertFalse((parent / "escape").exists())
            self.assertFalse((root / "runtime/apps").exists())


if __name__ == "__main__":
    unittest.main()
