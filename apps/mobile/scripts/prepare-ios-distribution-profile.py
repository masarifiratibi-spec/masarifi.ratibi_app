"""Validate the decoded, signed provisioning profile and prepare Xcode export settings."""
import datetime
import hashlib
import pathlib
import plistlib
import sys

if not __debug__:
    raise RuntimeError("Profile validation requires Python assertions")

directory = pathlib.Path(sys.argv[1])
with (directory / 'profile.plist').open('rb') as handle:
    profile = plistlib.load(handle)
entitlements = profile['Entitlements']
bundle_id = 'com.masarifi.mobile'
team_id, = profile['TeamIdentifier']
assert entitlements['application-identifier'] == f'{team_id}.{bundle_id}'
assert entitlements['aps-environment'] == 'production'
assert entitlements['com.apple.developer.applesignin'] == ['Default']
assert not entitlements.get('get-task-allow', False)
assert not profile.get('ProvisionsAllDevices')
mode = sys.argv[2]
if mode == 'ios-app-store':
    assert team_id == '38MAL5945T'
    assert 'ProvisionedDevices' not in profile and entitlements.get('beta-reports-active') is True
elif mode == 'ios-ad-hoc':
    assert profile.get('ProvisionedDevices')
else:
    raise ValueError('Unexpected iOS distribution profile')
assert profile['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
certificate, = profile['DeveloperCertificates']
certificate_hash = hashlib.sha1(certificate).hexdigest().upper()
(directory / 'certificate-sha1').write_text(certificate_hash)
(directory / 'profile-uuid').write_text(profile['UUID'])
(directory / 'profile-name').write_text(profile['Name'], encoding='utf-8')
(directory / 'team-id').write_text(team_id)
with (directory / 'export.plist').open('wb') as handle:
    plistlib.dump({
        'method': 'app-store-connect' if mode == 'ios-app-store' else 'release-testing',
        'destination': 'export',
        'signingStyle': 'manual',
        'teamID': team_id,
        'signingCertificate': certificate_hash,
        'provisioningProfiles': {bundle_id: profile['UUID']},
        'manageAppVersionAndBuildNumber': False,
    }, handle)
