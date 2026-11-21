import datetime
import pathlib
import plistlib
import subprocess
import sys
import tempfile
import unittest


class DistributionProfileTest(unittest.TestCase):
    def test_store_and_ad_hoc_profiles_are_not_interchangeable(self):
        template = {
            "Entitlements": {
                "application-identifier": "38MAL5945T.com.masarifi.mobile",
                "aps-environment": "production",
                "com.apple.developer.applesignin": ["Default"],
                "beta-reports-active": True,
                "get-task-allow": False,
            },
            "TeamIdentifier": ["38MAL5945T"],
            "ExpirationDate": datetime.datetime.now() + datetime.timedelta(days=1),
            "DeveloperCertificates": [b"synthetic public certificate"],
            "Name": "Synthetic profile",
            "UUID": "fixture",
        }
        tool = pathlib.Path(__file__).with_name("prepare-ios-distribution-profile.py")
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            for mode, devices, expected in [
                ("ios-app-store", False, "app-store-connect"),
                ("ios-ad-hoc", True, "release-testing"),
                ("ios-app-store", True, None),
                ("ios-ad-hoc", False, None),
            ]:
                with self.subTest(mode=mode, devices=devices):
                    profile = dict(template)
                    if devices:
                        profile["ProvisionedDevices"] = ["fixture device"]
                    (directory / "profile.plist").write_bytes(plistlib.dumps(profile))
                    check = subprocess.run([sys.executable, str(tool), str(directory), mode], capture_output=True)
                    if expected is None:
                        self.assertNotEqual(check.returncode, 0)
                    else:
                        self.assertEqual(check.returncode, 0, check.stderr)
                        options = plistlib.loads((directory / "export.plist").read_bytes())
                        self.assertEqual(options["method"], expected)
                        self.assertEqual(options["destination"], "export")
                        self.assertFalse(options["manageAppVersionAndBuildNumber"])


if __name__ == "__main__":
    unittest.main()
