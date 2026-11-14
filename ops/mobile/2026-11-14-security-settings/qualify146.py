from pathlib import Path
import datetime, hashlib, importlib.util, json, re, shutil, struct, subprocess, zipfile

OUT = Path('E:/Masarifi-security-events-hidden-146-20261114')
ROOT = Path('C:/mpr12')
BT = Path('E:/masarifi-android-sdk/build-tools/36.0.0')
JAVA = 'C:/Program Files/Eclipse Adoptium/jdk-17.0.20.8-hotspot/bin/java.exe'
SIGNER = '886a58e9f93168683e858355ff3bba4ad89ee19cbdfc3babe6e490eb7f421e57'
apk = ROOT/'apps/mobile/android/app/build/outputs/apk/release/app-release.apk'
assert json.loads((OUT/'build146-exit.json').read_text())['exitCode'] == 0
assert json.loads((OUT/'build146-exit.json').read_text()).get('finalInput') is True
proof = json.loads((OUT/'prepared146.json').read_text())
assert proof['securityPrivacyEntryRemoved'] is True
assert proof['updateChecksMovedToSecurity'] is True
assert proof['securityEventsHidden'] is True
assert json.loads((OUT/'retired-events-tests.json').read_text(encoding='utf8'))['success'] is True
assert all(code == 0 for code in json.loads((OUT/'local-validation.json').read_text()).values())
assert hashlib.sha256((ROOT/'apps/mobile/android/app/build.gradle').read_bytes()).hexdigest() == proof['generatedGradleSha256']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip() == proof['sourceCommit']
assert not (OUT/'qualified146.json').exists(), 'Inspect existing qualification first'
input_scopes = ['apps/mobile','packages/transaction-parser','package.json','package-lock.json']
pins=proof['overlayPins']
assert set(subprocess.check_output(['git','diff','--name-only','--',*input_scopes],cwd=ROOT,text=True).splitlines()) == set(pins)-set(proof['newSourceFiles'])-set(proof['baselineRestoredFiles'])
for name,digest in pins.items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
    assert hashlib.sha256((Path('D:/Masarifi-integration-2026-10-10')/name).read_bytes()).hexdigest()==digest

apk_hash_before = hashlib.sha256(apk.read_bytes()).hexdigest()
source_pins = {}
for relative in ['app/build.gradle','app/proguard-rules.pro','app/release-safety.gradle']:
    path = ROOT/'apps/mobile/android'/relative
    if path.exists(): source_pins[relative] = hashlib.sha256(path.read_bytes()).hexdigest()

def run(args):
    return subprocess.check_output([str(x) for x in args],stderr=subprocess.STDOUT).decode('utf-8').replace('\r\r\n','\n').replace('\r\n','\n')

badge = run([BT/'aapt2.exe','dump','badging',apk])
(OUT/'badging146.txt').write_text(badge,encoding='utf-8')
run(['node',ROOT/'scripts/integration/verify-android-badging.cjs',OUT/'badging146.txt'])
for value in ["package: name='com.masarifi.mobile' versionCode='146' versionName='1.0.1'", "minSdkVersion:'24'", "targetSdkVersion:'36'", "native-code: 'arm64-v8a'", "application-label:'مصاريفي وراتبي'"]:
    assert value in badge, value
assert 'application-debuggable' not in badge
xml = run([BT/'aapt2.exe','dump','xmltree',apk,'--file','AndroidManifest.xml'])
(OUT/'manifest146.txt').write_text(xml,encoding='utf-8')
backup = next(line for line in xml.splitlines() if 'android:allowBackup' in line)
assert '(type 0x12)0x0' in backup or '=false' in backup
assert 'MasarifiNotificationListenerService' in xml
for permission in ['INTERNET','READ_SMS','RECORD_AUDIO']:
    assert 'android.permission.'+permission in badge
for api in [24,28,32,33,35,36]:
    verified = run([JAVA,'-jar',BT/'lib/apksigner.jar','verify','--verbose','--print-certs','--min-sdk-version',api,'--max-sdk-version',api,apk])
    assert re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)',verified) == [SIGNER]
    (OUT/f'signature146-api{api}.txt').write_text(verified,encoding='utf-8')
run([BT/'zipalign.exe','-c','-P','16','4',apk])
spec = importlib.util.spec_from_file_location('prepare146',Path('E:/Masarifi-play-acceptance-20261112/prepare137.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
env = prepare.environment()
libraries = {}
with zipfile.ZipFile(apk) as z:
    assert z.testzip() is None
    config = json.loads(z.read('assets/app.config'))
    assert config['android']['package'] == 'com.masarifi.mobile'
    assert config['version'] == '1.0.1' and config['scheme'] == 'masarifi'
    assert config['extra']['eas']['projectId'] == 'c8cc3dd3-a7e9-4737-ac4d-32f076107600'
    bundle = z.read('assets/index.android.bundle')
    assert bundle[:8] == bytes.fromhex('c61fbc03c103191f')
    assert b'assistant-consent-enable-button' not in bundle and b'assistant-consent-card' not in bundle
    assert b'assistant-default-' in bundle
    assert b'voice-processing-consent-modal' in bundle and b'assistant-open-history' in bundle
    assert b'assistant-privacy-footer' not in bundle
    assert b'SecurityEventScreen' not in bundle
    assert b'tracking-permission-warning-banner' not in bundle
    assert b'tracking-explanation-row' in bundle and b'tracking-explanation-card' in bundle
    for key in ['EXPO_PUBLIC_API_URL','EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY']:
        assert env[key].encode() in bundle
    for marker in [b'/meta/mobile-update',b'app_update',b'financial-reset/state',b'settings.profile.saved']:
        assert marker in bundle, marker
    for name in z.namelist():
        assert not name.lower().endswith(('.jks','.keystore','.env','.private'))
        if re.fullmatch(r'classes\d*\.dex',name):
            assert b'signingQualificationSnapshot' not in z.read(name)
        if not name.startswith('lib/') or not name.endswith('.so'):
            continue
        assert name.startswith('lib/arm64-v8a/')
        raw = z.read(name)
        assert raw[:6] == b'\x7fELF\x02\x01' and struct.unpack_from('<H',raw,18)[0] == 183
        phoff = struct.unpack_from('<Q',raw,32)[0]
        size,count = struct.unpack_from('<HH',raw,54)
        loads = []
        for i in range(count):
            hdr = struct.unpack_from('<IIQQQQQQ',raw,phoff+i*size)
            if hdr[0] == 1:
                assert hdr[7] >= 16384 and (hdr[3]-hdr[2]) % 16384 == 0, name
                loads.append(hdr[7])
        assert loads
        libraries[name] = {'sha256':hashlib.sha256(raw).hexdigest(),'loadAlignments':loads}
assert libraries
with zipfile.ZipFile(Path('E:/Masarifi-security-updates-145-20261114/Masarifi-1.0.1-145-arm64.apk')) as old:
    assert set(libraries) == {name for name in old.namelist() if name.startswith('lib/') and name.endswith('.so')}, 'Native library inventory changed; review before admission'
    assert all(hashlib.sha256(old.read(name)).hexdigest()==meta['sha256'] for name,meta in libraries.items()), 'Native library bytes changed'
mapping = ROOT/'apps/mobile/android/app/build/outputs/mapping/release/mapping.txt'
assert json.loads(run(['node',ROOT/'apps/mobile/scripts/check-record-reflection.mjs',mapping]))['ok'] is True
consumer = 'expo.modules.notifications.notifications.background.BackgroundRemoteNotificationTaskConsumer'
utils = 'expo.modules.interfaces.taskManager.TaskManagerUtilsInterface'
names = {consumer:consumer,utils:utils}
with mapping.open(encoding='utf-8') as f:
    for line in f:
        if line.startswith((consumer+' -> ',utils+' -> ')):
            original,residual = line.rstrip().removesuffix(':').split(' -> ')
            names[original] = residual
assert names[consumer] == consumer
analyzer = Path('E:/masarifi-android-sdk/cmdline-tools/latest/bin/apkanalyzer.bat')
manifest_xml = subprocess.check_output([str(analyzer),'manifest','print',str(apk)],env=env,text=True,encoding='utf-8',timeout=90)
(OUT/'manifest146.xml').write_text(manifest_xml,encoding='utf-8')
run(['python',ROOT/'scripts/integration/verify-release-manifest.py',OUT/'manifest146.xml',OUT/'verified-manifest146.json'])
smali = subprocess.check_output([str(analyzer),'dex','code','--class',consumer,str(apk)],env=env,text=True,encoding='utf-8',timeout=90)
assert not re.search(r'\babstract\b',next(line for line in smali.splitlines() if line.startswith('.class ')))
descriptor = '(Landroid/content/Context;L'+names[utils].replace('.','/')+';)V'
assert any(line.startswith('.method public ') and '<init>'+descriptor in line for line in smali.splitlines())
(OUT/'notification-consumer146.smali').write_text(smali,encoding='utf-8')
target = OUT/'Masarifi-1.0.1-146-arm64.apk'
assert not target.exists()
shutil.copyfile(apk,target)
assert hashlib.sha256(target.read_bytes()).hexdigest() == apk_hash_before == hashlib.sha256(apk.read_bytes()).hexdigest()
shutil.copyfile(mapping,OUT/'mapping146.txt')
result = dict(atUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),source=proof['sourceCommit'],apk=str(target),sha256=hashlib.sha256(target.read_bytes()).hexdigest(),bytes=target.stat().st_size,versionCode=146,versionName='1.0.1',signerSha256=SIGNER,minSdk=24,targetSdk=36,nonDebuggable=True,allowBackup=False,signatureApi=[24,28,32,33,35,36],alignment16KiB=True,libraries=libraries,hermesSha256=hashlib.sha256(bundle).hexdigest(),recordFieldRetained=True,notificationConsumerConcreteAndConstructor=True,physicalDeviceAcceptance=False,playReady=False)
result['overlayPins']=pins
result['nativeLibrariesIdenticalTo145']=True
result['mappingSha256'] = hashlib.sha256((OUT/'mapping146.txt').read_bytes()).hexdigest()
result['generatedInputPins'] = source_pins
(OUT/'qualified146.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:result[k] for k in ['apk','sha256','bytes','versionCode','alignment16KiB','physicalDeviceAcceptance']}))
