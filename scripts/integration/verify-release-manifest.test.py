import unittest
import xml.etree.ElementTree as ET
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
spec = spec_from_file_location("manifest", Path(__file__).with_name("verify-release-manifest.py"))
manifest = module_from_spec(spec)
spec.loader.exec_module(manifest)

def fixture(extra=""):
    return ET.fromstring(f'''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.masarifi.mobile"><uses-permission android:name="android.permission.READ_SMS"/><uses-permission android:name="android.permission.RECORD_AUDIO"/><application><activity><intent-filter><data android:scheme="masarifi"/><data android:scheme="clerk"/></intent-filter></activity></application>{extra}</manifest>''')

class ReleaseManifestTests(unittest.TestCase):
    def test_allows_required_features_and_browser_query(self):
        manifest.verify(fixture('<queries><intent><data android:scheme="https"/></intent></queries>'))
    def test_rejects_transitive_wallet_intent_query(self):
        with self.assertRaisesRegex(ValueError, "UNRELATED_WALLET_QUERY"):
            manifest.verify(fixture('<queries><intent><data android:scheme="solana-wallet"/></intent></queries>'))
    def test_rejects_overlay_permission(self):
        with self.assertRaisesRegex(ValueError, "UNJUSTIFIED_RELEASE_PERMISSION"):
            manifest.verify(fixture('<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>'))
    def test_rejects_development_callback(self):
        root = fixture()
        ET.SubElement(root.find('./application/activity/intent-filter'), 'data', {manifest.ANDROID+'scheme': 'exp+masarifi'})
        with self.assertRaisesRegex(ValueError, "DEVELOPMENT_SCHEME_IN_RELEASE"): manifest.verify(root)

if __name__ == '__main__': unittest.main()
