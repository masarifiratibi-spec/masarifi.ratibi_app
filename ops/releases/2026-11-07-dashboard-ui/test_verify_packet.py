"""Synthetic tar safety regressions; no extraction or host access."""
import importlib.util
import io
from pathlib import Path
import tarfile
import unittest

spec = importlib.util.spec_from_file_location("verifier", Path(__file__).with_name("verify_packet.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def members(entries):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w") as archive:
        for name, link in entries:
            member = tarfile.TarInfo(name)
            if link is not None:
                member.type = tarfile.SYMTYPE
                member.linkname = link
            archive.addfile(member)
    stream.seek(0)
    with tarfile.open(fileobj=stream, mode="r") as archive:
        return archive.getmembers()


class ArchiveFences(unittest.TestCase):
    def test_normal_file_and_leaf_symlink_are_allowed(self):
        values = members([("apps/admin-web/file", None), ("apps/admin-web/node_modules/.bin/next", "../next/dist/bin/next")])
        self.assertEqual(len(verifier.validate_runtime_members(values)), 2)

    def test_symlink_parent_chain_is_rejected_in_either_order(self):
        attack = [("apps/admin-web/a/x/b", ".."), ("apps/admin-web/a/x/b/q", "../../../outside"), ("apps/admin-web/a/x/b/q/file", None)]
        for entries in [attack, list(reversed(attack))]:
            with self.assertRaisesRegex(RuntimeError, "RUNTIME_SYMLINK_ANCESTOR"):
                verifier.validate_runtime_members(members(entries))

    def test_alias_and_traversal_names_are_rejected(self):
        for name in ["./apps/admin-web/file", "apps/admin-web/a/./file", "apps/admin-web//file", "apps/admin-web/../file", "/apps/admin-web/file"]:
            with self.subTest(name=name):
                with self.assertRaisesRegex(RuntimeError, "RUNTIME_ARCHIVE_SCOPE_MISMATCH"):
                    verifier.validate_runtime_members(members([(name, None)]))

    def test_target_chain_is_rejected_before_collapsing_parent_components(self):
        attack = [("apps/admin-web/a/b/back", "../../safe"), ("apps/admin-web/a/b/second", "back/../../outside")]
        for entries in [attack, list(reversed(attack))]:
            with self.assertRaisesRegex(RuntimeError, "RUNTIME_SYMLINK_TARGET_CHAIN"):
                verifier.validate_runtime_members(members(entries))

    def test_duplicate_and_private_env_members_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "RUNTIME_MEMBER_INVALID"):
            verifier.validate_runtime_members(members([("apps/admin-web/file", None)] * 2))
        with self.assertRaisesRegex(RuntimeError, "PRIVATE_ENVIRONMENT_IN_RUNTIME"):
            verifier.validate_runtime_members(members([("apps/admin-web/.env.local", None)]))


if __name__ == "__main__":
    unittest.main()
