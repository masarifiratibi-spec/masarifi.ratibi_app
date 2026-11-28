#!/usr/bin/env bash
set -euo pipefail
umask 077
export EAS_BUILD_PROFILE="${EAS_BUILD_PROFILE:-ios-ad-hoc}"

# Run in apps/mobile on a temporary GitHub-hosted Mac after Expo prebuild.
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_OS:-}" == macOS ]]
: "${IOS_CERT_P12_B64:?Missing distribution certificate}"
: "${IOS_CERT_PASSWORD:?Missing certificate password}"
: "${IOS_PROFILE_B64:?Missing selected distribution profile}"
: "${RECIPIENT_CERT_B64:?Missing artifact recipient certificate}"
: "${IOS_BUILD_NUMBER:?Missing build number}"
: "${RUNNER_TEMP:?Missing runner temporary directory}"
: "${GITHUB_SHA:?Missing source commit}"
[[ "$IOS_BUILD_NUMBER" =~ ^[1-9][0-9]{0,7}$ ]]

signing="$(mktemp -d "$RUNNER_TEMP/masarifi-ios-signing.XXXXXXXX")"
keychain="$signing/build.keychain-db"
installed_profile=''
cleanup() {
  if [[ -n "$installed_profile" ]]; then rm -f -- "$installed_profile"; fi
  security delete-keychain "$keychain" >/dev/null 2>&1 || true
  rm -rf -- "$signing"
}
trap cleanup EXIT

openssl_bin="$(brew --prefix openssl@3)/bin/openssl"
printf '%s' "$IOS_CERT_P12_B64" | "$openssl_bin" base64 -d -A -out "$signing/cert.p12"
printf '%s' "$IOS_PROFILE_B64" | "$openssl_bin" base64 -d -A -out "$signing/profile.mobileprovision"
printf '%s' "$RECIPIENT_CERT_B64" | "$openssl_bin" base64 -d -A -out "$signing/recipient.pem"
unset IOS_CERT_P12_B64 IOS_PROFILE_B64 RECIPIENT_CERT_B64
"$openssl_bin" x509 -in "$signing/recipient.pem" -checkend 0 -noout >/dev/null
security cms -D -i "$signing/profile.mobileprovision" > "$signing/profile.plist"

# Verify the profile and write only the settings used by the existing app target.
python3 scripts/prepare-ios-distribution-profile.py "$signing" "$EAS_BUILD_PROFILE"

keychain_password="$("$openssl_bin" rand -hex 32)"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 7200 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$signing/cert.p12" -k "$keychain" -P "$IOS_CERT_PASSWORD" -T /usr/bin/codesign >/dev/null
unset IOS_CERT_PASSWORD
security set-key-partition-list -S apple-tool:,apple: -s -k "$keychain_password" "$keychain" >/dev/null
unset keychain_password
security list-keychains -d user -s "$keychain"
security find-identity -v -p codesigning "$keychain" | grep -Fq "$(cat "$signing/certificate-sha1")"

profiles_dir="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "$profiles_dir"
profile_file="$profiles_dir/$(cat "$signing/profile-uuid").mobileprovision"
[[ ! -e "$profile_file" ]]
cp "$signing/profile.mobileprovision" "$profile_file"
installed_profile="$profile_file"

shopt -s nullglob
workspaces=(ios/*.xcworkspace)
[[ "${#workspaces[@]}" -eq 1 ]]
scheme="$(basename "${workspaces[0]}" .xcworkspace)"
node - "$signing" "$scheme" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig } = require('expo/config-plugins');
const plist = require('@expo/plist').default;
const [directory, scheme] = process.argv.slice(2);
const { XcodeUtils } = IOSConfig;
const project = XcodeUtils.getPbxproj(process.cwd());
const { target } = XcodeUtils.getApplicationNativeTarget({ project, projectName: scheme });
const [, release] = XcodeUtils.getBuildConfigurationForListIdAndName(project, {
  configurationListId: target.buildConfigurationList,
  buildConfiguration: 'Release'
});
const settings = release.buildSettings;
const unquote = (value) => value.replace(/^"|"$/g, '');
assert.equal(unquote(settings.PRODUCT_BUNDLE_IDENTIFIER), 'com.masarifi.mobile');
const buildNumber = process.env.IOS_BUILD_NUMBER;
Object.assign(settings, {
  CODE_SIGN_STYLE: 'Manual',
  CODE_SIGN_IDENTITY: '"Apple Distribution"',
  DEVELOPMENT_TEAM: fs.readFileSync(path.join(directory, 'team-id'), 'utf8'),
  PROVISIONING_PROFILE_SPECIFIER: JSON.stringify(fs.readFileSync(path.join(directory, 'profile-name'), 'utf8')),
  CURRENT_PROJECT_VERSION: buildNumber
});
delete settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'];
const infoPath = path.join('ios', unquote(settings.INFOPLIST_FILE));
const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
info.CFBundleVersion = buildNumber;
fs.writeFileSync(infoPath, plist.build(info));
fs.writeFileSync(project.filepath, project.writeSync());
NODE

if ! xcodebuild -workspace "${workspaces[0]}" -scheme "$scheme" \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$signing/Masarifi.xcarchive" archive > "$signing/archive.log" 2>&1; then
  printf 'Xcode archive failed. The signing log stays in the runner.\n' >&2
  exit 1
fi
if ! xcodebuild -exportArchive -archivePath "$signing/Masarifi.xcarchive" \
  -exportOptionsPlist "$signing/export.plist" -exportPath "$signing/export" > "$signing/export.log" 2>&1; then
  printf 'Xcode distribution export failed. The signing log stays in the runner.\n' >&2
  exit 1
fi

ipas=("$signing"/export/*.ipa)
[[ "${#ipas[@]}" -eq 1 ]]
unzip -q "${ipas[0]}" 'Payload/*' -d "$signing/ipa"
apps=("$signing"/ipa/Payload/*.app)
[[ "${#apps[@]}" -eq 1 ]]
app="${apps[0]}"
codesign --verify --deep --strict "$app"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")" == 'com.masarifi.mobile' ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app/Info.plist")" == "$IOS_BUILD_NUMBER" ]]
test -s "$app/MasarifiBankSmsParser.js"
test -s "$app/main.jsbundle"
test -d "$app/Metadata.appintents"
cmp -s "$app/embedded.mobileprovision" "$signing/profile.mobileprovision"

if [[ "$EAS_BUILD_PROFILE" == ios-app-store ]]; then
  codesign -d --entitlements :- "$app" > "$signing/signed-entitlements.plist" 2> "$signing/entitlements.log"
  python3 - "$app" "$signing/signed-entitlements.plist" "$(xcrun --sdk iphoneos --show-sdk-version)" <<'PY'
import os
import pathlib
import plistlib
import sys

if not __debug__:
    raise RuntimeError("Signed archive validation requires Python assertions")
app = pathlib.Path(sys.argv[1])
signed = plistlib.loads(pathlib.Path(sys.argv[2]).read_bytes())
assert signed['application-identifier'] == '38MAL5945T.com.masarifi.mobile'
assert signed.get('get-task-allow', False) is False
assert signed['aps-environment'] == 'production'
assert signed['com.apple.developer.applesignin'] == ['Default']
info = plistlib.loads((app / 'Info.plist').read_bytes())
assert info['DTPlatformName'] == 'iphoneos' and info['DTSDKName'] == 'iphoneos' + sys.argv[3]
assert info['CFBundleShortVersionString'] == os.environ['MASARIFI_RELEASE_VERSION_NAME']
bundle = (app / 'main.jsbundle').read_bytes()
for key in ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY']:
    assert os.environ[key].encode() in bundle
manifests = list(app.rglob('PrivacyInfo.xcprivacy'))
assert manifests and all(isinstance(plistlib.loads(path.read_bytes()), dict) for path in manifests)
PY
fi

# Only the authenticated encrypted file may leave this public runner.
"$openssl_bin" cms -encrypt -aes-256-gcm -binary -outform DER \
  -in "${ipas[0]}" -out "$RUNNER_TEMP/Masarifi.ipa.p7m" \
  -recip "$signing/recipient.pem" -keyopt rsa_padding_mode:oaep \
  -keyopt rsa_oaep_md:sha256 -keyopt rsa_mgf1_md:sha256
printf 'Verified and encrypted %s build %s from %s.\n' "$EAS_BUILD_PROFILE" "$IOS_BUILD_NUMBER" "$GITHUB_SHA"
