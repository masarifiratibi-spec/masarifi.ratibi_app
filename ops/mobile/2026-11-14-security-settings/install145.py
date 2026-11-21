"""Replace installed 144 with the qualified 145, preserving both Android profiles."""
from pathlib import Path
import datetime, hashlib, json, re, subprocess as sp

OUT = Path('E:/Masarifi-security-updates-145-20261114')
PREVIOUS = Path('E:/Masarifi-security-settings-144-20261114')
BASE = ['C:/platform-tools/platform-tools/adb.exe','-s','f66a40694eca']

def run(args):
    return sp.check_output(BASE+args,stderr=sp.STDOUT).decode('utf8')

assert not (OUT/'install145-started.json').exists(), 'Inspect previous dispatch; never clear or uninstall'
proof = json.loads((OUT/'qualified145.json').read_text(encoding='utf8'))
old = json.loads((PREVIOUS/'qualified144.json').read_text(encoding='utf8'))
assert proof['versionCode'] == 145 and proof['signerSha256'] == old['signerSha256']
assert json.loads((OUT/'settings-tests.json').read_text(encoding='utf8'))['success'] is True
assert all(code == 0 for code in json.loads((OUT/'local-validation.json').read_text()).values())
apk = Path(proof['apk'])
assert hashlib.sha256(apk.read_bytes()).hexdigest() == proof['sha256']
assert run(['get-state']).strip() == 'device'
before = run(['shell','dumpsys','package','com.masarifi.mobile'])
uids = run(['shell','pm','list','packages','-U','com.masarifi.mobile']).strip()
assert 'versionCode=144 ' in before and uids == 'package:com.masarifi.mobile uid:10321,1010321'
paths = run(['shell','pm','path','--user','0','com.masarifi.mobile']).splitlines()
assert len(paths) == 1 and paths[0].startswith('package:/data/app/')
assert run(['shell','sha256sum',paths[0].removeprefix('package:')]).split()[0] == old['sha256']
(OUT/'package145-before.private.txt').write_text(before,encoding='utf8')
with (OUT/'install145-started.json').open('x',encoding='utf8') as f:
    json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':proof['sha256'],
               'mode':'ordinary data-preserving replace, user0; no clear/uninstall'},f)
installed = run(['install','-r','--user','0',str(apk)])
(OUT/'install145-output.txt').write_text(installed,encoding='utf8')
assert 'Success' in installed
after = run(['shell','dumpsys','package','com.masarifi.mobile'])
(OUT/'package145-after.private.txt').write_text(after,encoding='utf8')
assert 'versionCode=145 ' in after and 'versionName=1.0.1' in after
assert run(['shell','pm','list','packages','-U','com.masarifi.mobile']).strip() == uids
assert re.findall(r'firstInstallTime=(.+)',before) == re.findall(r'firstInstallTime=(.+)',after)
for user in ['0','10']:
    prior = re.search(r'User '+user+r': ceDataInode=(\d+) deDataInode=(\d+)',before)
    current = re.search(r'User '+user+r': ceDataInode=(\d+) deDataInode=(\d+)',after)
    assert prior and current and prior.groups() == current.groups()
result = {'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versionCode':145,
          'versionName':'1.0.1','sha256':proof['sha256'],'uidPreserved':True,
          'bothProfilesDataInodesPreserved':True,'firstInstallTimesPreserved':True,
          'physicalUiAcceptance':'pending separate visual verification'}
(OUT/'installed145.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result))
