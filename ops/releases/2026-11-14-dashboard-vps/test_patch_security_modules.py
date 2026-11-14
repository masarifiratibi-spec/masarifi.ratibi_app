import unittest
from patch_security_modules import apply_exact_patch, sha


class ExactPatchTests(unittest.TestCase):
    original = b'first\r\nold\r\nlast\n'
    patch = b'--- a/module.js\n+++ b/module.js\n@@ -1,3 +1,3 @@\n first\n-old\n+new\n last\n'

    def apply(self, original=None, patch=None, **changes):
        pins = dict(beforeSha256=sha(self.original), normalizedBeforeSha256=sha(b'first\nold\nlast\n'),
                    patchSha256=sha(self.patch), normalizedAfterSha256=sha(b'first\nnew\nlast\n'), )
        pins.update(changes)
        return apply_exact_patch(self.original if original is None else original,
                                 self.patch if patch is None else patch, pins, "module.js")

    def test_changes_only_the_hunk_and_preserves_unrelated_crlf(self):
        self.assertEqual(self.apply(), b'first\r\nnew\nlast\n')

    def test_rejects_changed_raw_preimage(self):
        with self.assertRaisesRegex(ValueError, 'PREIMAGE_DRIFT'):
            self.apply(original=b'first\nold\nlast\n')

    def test_rejects_patch_drift(self):
        with self.assertRaisesRegex(ValueError, 'PATCH_DRIFT'):
            self.apply(patch=self.patch.replace(b'+new', b'+bad'))

    def test_rejects_wrong_postimage(self):
        with self.assertRaisesRegex(ValueError, 'POSTIMAGE_DRIFT'):
            self.apply(normalizedAfterSha256=sha(b'wrong'))

    def test_rejects_context_mismatch_even_with_matching_patch_digest(self):
        patch = self.patch.replace(b' first\n', b' wrong\n')
        with self.assertRaisesRegex(ValueError, 'HUNK_CONTEXT'):
            self.apply(patch=patch, patchSha256=sha(patch))

    def test_rejects_wrong_hunk_counts(self):
        patch = self.patch.replace(b'-1,3', b'-1,4')
        with self.assertRaisesRegex(ValueError, 'HUNK_COUNTS'):
            self.apply(patch=patch, patchSha256=sha(patch))

    def test_rejects_replay(self):
        with self.assertRaisesRegex(ValueError, 'PREIMAGE_DRIFT'):
            self.apply(original=self.apply())


if __name__ == '__main__':
    unittest.main()
