"""Build always-available Assistant over the verified, installed 139 package inputs."""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import re
import subprocess as sp

ROOT=Path('C:/mpr12');SOURCE=Path('D:/Masarifi-integration-2026-10-10')
PREVIOUS=Path('E:/Masarifi-concise-139-20261113');OUT=Path('E:/Masarifi-assistant-default-140-20261113')
OUT.mkdir(exist_ok=True)
assert not (OUT/'build140-started.json').exists(),'BUILD_ALREADY_DISPATCHED'
prior=json.loads((PREVIOUS/'prepared139.json').read_text())
assert sp.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==prior['sourceCommit']
assert set(sp.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines())==set(prior['overlayPins'])
for name,digest in prior['overlayPins'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
gradle=ROOT/'apps/mobile/android/app/build.gradle'
assert hashlib.sha256(gradle.read_bytes()).hexdigest()==prior['generatedGradleSha256']
files=sp.check_output(['git','diff','--name-only','--','apps/mobile'],cwd=SOURCE,text=True).splitlines()
assert set(prior['overlayPins']).issubset(set(files))
pins={}
for name in files:
 assert name.startswith('apps/mobile/') and (SOURCE/name).is_file()
 body=(SOURCE/name).read_bytes();(ROOT/name).write_bytes(body);pins[name]=hashlib.sha256(body).hexdigest()
assert set(sp.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines())==set(pins)
content,count=re.subn(r'(?m)^(\s*versionCode\s+)139\s*$',r'\g<1>140',gradle.read_text(),count=1)
assert count==1;gradle.write_text(content,encoding='utf8')
proof={**prior,'versionCode':140,'overlayPins':pins,'generatedGradleSha256':hashlib.sha256(gradle.read_bytes()).hexdigest(),'generatedChanges':['versionCode 140'],'assistantDefaultAvailable':True,'finalInput':True}
(OUT/'prepared140.json').write_text(json.dumps(proof,indent=2))
with (OUT/'build140-started.json').open('x') as f:json.dump({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versionCode':140,'overlayFiles':len(pins)},f)
spec=importlib.util.spec_from_file_location('prepare',Path('E:/Masarifi-play-acceptance-20261112/prepare137.py'));prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
command=['cmd.exe','/d','/c','gradlew.bat',':app:assembleRelease','--no-daemon','--console=plain','--max-workers=1','-PreactNativeArchitectures=arm64-v8a','-Pkotlin.incremental=false','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m']
with (OUT/'build140.private.log').open('w',encoding='utf8') as log:code=sp.call(command,cwd=ROOT/'apps/mobile/android',env=prepare.environment(signing=True),stdout=log,stderr=sp.STDOUT)
result={'exitCode':code,'finalInput':True,'endedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'build140-exit.json').write_text(json.dumps(result));print(json.dumps(result));raise SystemExit(code)
