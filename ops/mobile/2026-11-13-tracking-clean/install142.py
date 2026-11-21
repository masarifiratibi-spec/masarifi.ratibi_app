from pathlib import Path
import datetime, hashlib, json, re, subprocess
OUT=Path('E:/Masarifi-tracking-clean-142-20261113')
ADB='C:/platform-tools/platform-tools/adb.exe'
BASE=[ADB,'-s','f66a40694eca']
def run(args): return subprocess.check_output(BASE+args,stderr=subprocess.STDOUT).decode('utf-8')
assert not (OUT/'install142-started.json').exists(), 'Inspect previous dispatch first'
proof=json.loads((OUT/'qualified142.json').read_text(encoding='utf-8'))
assert json.loads((OUT/'mobile-tests.json').read_text(encoding='utf-8'))['success'] is True
assert json.loads((OUT/'local-validation.json').read_text(encoding='utf-8'))['state']=='passed'
apk=Path(proof['apk'])
assert hashlib.sha256(apk.read_bytes()).hexdigest()==proof['sha256']
assert run(['get-state']).strip()=='device'
before=run(['shell','dumpsys','package','com.masarifi.mobile'])
uids=run(['shell','pm','list','packages','-U','com.masarifi.mobile']).strip()
assert 'versionCode=141 ' in before and uids=='package:com.masarifi.mobile uid:10321,1010321'
(OUT/'package142-before.private.txt').write_text(before,encoding='utf-8')
with (OUT/'install142-started.json').open('x',encoding='utf-8') as f:
    json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':proof['sha256'],'mode':'ordinary data-preserving replace, user0; no clear/uninstall'},f)
installed=run(['install','-r','--user','0',str(apk)])
(OUT/'install142-output.txt').write_text(installed,encoding='utf-8')
assert 'Success' in installed
after=run(['shell','dumpsys','package','com.masarifi.mobile'])
(OUT/'package142-after.private.txt').write_text(after,encoding='utf-8')
assert 'versionCode=142 ' in after and 'versionName=1.0.1' in after
assert run(['shell','pm','list','packages','-U','com.masarifi.mobile']).strip()==uids
assert re.findall(r'firstInstallTime=(.+)',before)==re.findall(r'firstInstallTime=(.+)',after)
for user in ['0','10']:
    prior=re.search(r'User '+user+r': ceDataInode=(\d+) deDataInode=(\d+)',before)
    current=re.search(r'User '+user+r': ceDataInode=(\d+) deDataInode=(\d+)',after)
    assert prior and current and prior.groups()==current.groups()
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versionCode':142,'versionName':'1.0.1','sha256':proof['sha256'],'uidPreserved':True,'bothProfilesDataInodesPreserved':True,'firstInstallTimesPreserved':True,'sessionAndFinancialUiAcceptance':False}
(OUT/'installed142.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
