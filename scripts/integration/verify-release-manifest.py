"""Inspect the merged release manifest, including transitive intent queries."""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ANDROID = "{http://schemas.android.com/apk/res/android}"
FORBIDDEN = {
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.SYSTEM_ALERT_WINDOW",
}


def verify(root):
    permissions = {
        node.get(ANDROID + "name") for node in root.findall("uses-permission")
    }
    schemes = {
        node.get(ANDROID + "scheme")
        for node in root.findall("./application/activity/intent-filter/data")
        if node.get(ANDROID + "scheme")
    }
    queried_schemes = {
        node.get(ANDROID + "scheme")
        for node in root.findall("./queries/intent/data")
        if node.get(ANDROID + "scheme")
    }
    queried_packages = {
        node.get(ANDROID + "name") for node in root.findall("./queries/package")
    }
    if root.get("package") != "com.masarifi.mobile":
        raise ValueError("RELEASE_PACKAGE_CHANGED")
    if permissions & FORBIDDEN:
        raise ValueError("UNJUSTIFIED_RELEASE_PERMISSION")
    required = {"android.permission.READ_SMS", "android.permission.RECORD_AUDIO"}
    if not required <= permissions:
        raise ValueError("REQUIRED_FEATURE_PERMISSION_MISSING")
    if not {"masarifi", "clerk"} <= schemes:
        raise ValueError("AUTH_CALLBACK_MISSING")
    if any(scheme == "exp" or scheme.startswith("exp+") for scheme in schemes):
        raise ValueError("DEVELOPMENT_SCHEME_IN_RELEASE")
    if "solana-wallet" in queried_schemes or any(
        "solana" in name.lower() for name in queried_packages
    ):
        raise ValueError("UNRELATED_WALLET_QUERY")
    return {
        "diagnosticOnly": True,
        "package": root.get("package"),
        "permissions": sorted(permissions),
        "intentSchemes": sorted(schemes),
        "queriedSchemes": sorted(queried_schemes),
        "queryPackages": sorted(queried_packages),
    }


if __name__ == "__main__":
    result = verify(ET.parse(sys.argv[1]).getroot())
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(
            json.dumps(result, indent=2) + "\n", encoding="utf-8"
        )
    print(json.dumps(result))
