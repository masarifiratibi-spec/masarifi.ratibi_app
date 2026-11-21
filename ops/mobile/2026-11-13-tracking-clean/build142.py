"""Remove the tracking warning and privacy help card over installed 141 inputs."""
from pathlib import Path
import datetime, hashlib, importlib.util, json, re, subprocess as sp

ROOT=Path('C:/mpr12')
SOURCE=Path('D:/Masarifi-integration-2026-10-10')
PREVIOUS=Path('E:/Masarifi-assistant-ui-141-20261113')
OUT=Path('E:/Masarifi-tracking-clean-142-20261113')
OUT.mkdir(exist_ok=True)
assert not (OUT/'build142-started.json').exists(), 'BUILD_ALREADY_DISPATCHED'
prior=json.loads((PREVIOUS/'prepared141.json').read_text())
assert prior['versionCode']==141
assert sp.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==prior['sourceCommit']
assert sp.check_output(['git','rev-parse','HEAD:apps/mobile'],cwd=SOURCE,text=True).strip()==prior['sourceMobileTree']
assert set(sp.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines())==set(prior['overlayPins'])-set(prior['newSourceFiles'])
for name,digest in prior['overlayPins'].items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
gradle=ROOT/'apps/mobile/android/app/build.gradle'
assert hashlib.sha256(gradle.read_bytes()).hexdigest()==prior['generatedGradleSha256']
files=sp.check_output(['git','diff','--name-only','--','apps/mobile'],cwd=SOURCE,text=True).splitlines()
new_files=sp.check_output(['git','ls-files','--others','--exclude-standard','--','apps/mobile'],cwd=SOURCE,text=True).splitlines()
expected_new={'apps/mobile/src/features/assistant/components/AssistantLandingHeader.tsx','apps/mobile/src/features/voice/VoiceProcessingConsentDialog.tsx'}
assert set(new_files)==expected_new, new_files
assert set(prior['overlayPins']).issubset(set(files+new_files))
pins={}
for name in files+new_files:
    assert name.startswith('apps/mobile/') and (SOURCE/name).is_file()
    body=(SOURCE/name).read_bytes()
    target=ROOT/name
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(body)
    pins[name]=hashlib.sha256(body).hexdigest()
assert set(sp.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines())==set(pins)-expected_new
assert set(sp.check_output(['git','ls-files','--others','--exclude-standard','--','apps/mobile/src'],cwd=ROOT,text=True).splitlines())==expected_new
content,count=re.subn(r'(?m)^(\s*versionCode\s+)141\s*$',r'\g<1>142',gradle.read_text(),count=1)
assert count==1
gradle.write_text(content,encoding='utf8')
proof={**prior,'versionCode':142,'overlayPins':pins,'newSourceFiles':new_files,
       'generatedGradleSha256':hashlib.sha256(gradle.read_bytes()).hexdigest(),
       'generatedChanges':['versionCode 142'],'assistantDefaultAvailable':True,
       'selectedAssistantDesign':True,'trackingWarningRemoved':True,'trackingPrivacyHelpRemoved':True,'centeredVoicePopup':True,'finalInput':True}
(OUT/'prepared142.json').write_text(json.dumps(proof,indent=2))
with (OUT/'build142-started.json').open('x') as f:
    json.dump({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versionCode':142,'overlayFiles':len(pins)},f)
spec=importlib.util.spec_from_file_location('prepare',Path('E:/Masarifi-play-acceptance-20261112/prepare137.py'))
prepare=importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
command=['cmd.exe','/d','/c','gradlew.bat',':app:assembleRelease','--no-daemon','--console=plain','--max-workers=1','-PreactNativeArchitectures=arm64-v8a','-Pkotlin.incremental=false','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m']
with (OUT/'build142.private.log').open('w',encoding='utf8') as log:
    result=sp.call(command,cwd=ROOT/'apps/mobile/android',env=prepare.environment(signing=True),stdout=log,stderr=sp.STDOUT)
receipt={'exitCode':result,'finalInput':True,'endedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'build142-exit.json').write_text(json.dumps(receipt))
print(json.dumps(receipt))
raise SystemExit(result)
