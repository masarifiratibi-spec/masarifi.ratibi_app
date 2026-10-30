import gzip
import importlib.util
import pathlib
import sys
import tarfile
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('transport', pathlib.Path(__file__).with_name('host_transport.py'))
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)


class PublicArchiveContract(unittest.TestCase):
    def test_regular_members_only_no_traversal_duplicates_or_oversized_members(self):
        good = tarfile.TarInfo('compiled/public.js'); good.size = 10
        self.assertEqual(transport.validate_members([good]), {'compiled/public.js'})
        for name in ('../escape', '/absolute', 'safe/../escape'):
            bad = tarfile.TarInfo(name)
            with self.assertRaises(ValueError): transport.validate_members([bad])
        link = tarfile.TarInfo('link'); link.type = tarfile.SYMTYPE
        with self.assertRaises(ValueError): transport.validate_members([link])
        with self.assertRaises(ValueError): transport.validate_members([good, good])
        oversized = tarfile.TarInfo('large'); oversized.size = transport.MAX_FILE+1
        with self.assertRaises(ValueError): transport.validate_members([oversized])

    def test_wrong_archive_hash_and_expansion_limit_abort_before_creating_a_target(self):
        raw = gzip.compress(b'x'*1100000)
        with patch.object(transport, 'read', return_value=raw), patch.object(transport, 'mkdir') as mkdir:
            with self.assertRaisesRegex(ValueError, 'QA_ARCHIVE_PIN'):
                transport.install('/public', '0'*64, '1'*64, len(raw))
            with patch.object(transport, 'MAX_EXPANDED', 1024):
                with self.assertRaisesRegex(ValueError, 'QA_ARCHIVE_EXPANSION_LIMIT'):
                    transport.install('/public', transport.sha(raw), '1'*64, len(raw))
            mkdir.assert_not_called()


if __name__ == '__main__': unittest.main()
