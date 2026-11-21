"""Rebuild once for the final extra English sentence, after the first build exits."""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import subprocess as sp
import time

ROOT=Path('C:/mpr12');SOURCE=Path('D:/Masarifi-integration-2026-10-10')
OUT=Path('E:/Masarifi-concise-139-20261113');PREVIOUS=Path('E:/Masarifi-play-acceptance-20261112')
deadline=time.monotonic()+1800
while not (OUT/'build139-exit.json').exists():
 assert time.monotonic()<deadline,'FIRST_BUILD_DEADLINE'
 time.sleep(3)
first=json.loads((OUT/'build139-exit.json').read_text());assert first['exitCode']==0
proof=json.loads((OUT/'prepared139.json').read_text());path='apps/mobile/src/localization/messages/en.ts'
for name,digest in proof['overlayPins'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
assert hashlib.sha256((ROOT/'apps/mobile/android/app/build.gradle').read_bytes()).hexdigest()==proof['generatedGradleSha256']
extra='apps/mobile/src/features/shell/NetworkConnectionNotice.tsx'
assert (ROOT/extra).read_bytes().replace(b'\r\n',b'\n')==sp.check_output(['git','show','HEAD:'+extra],cwd=ROOT).replace(b'\r\n',b'\n')
with (OUT/'build139-final-started.json').open('x') as f:json.dump({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reason':'Final concise single-paragraph consent and offline notice; extra English sentence','firstBuild':first},f)
for name in [*proof['overlayPins'],extra]:
 body=(SOURCE/name).read_bytes();(ROOT/name).write_bytes(body);proof['overlayPins'][name]=hashlib.sha256(body).hexdigest()
proof['finalInput']=True
(OUT/'prepared139.json').write_text(json.dumps(proof,indent=2))
spec=importlib.util.spec_from_file_location('prepare',PREVIOUS/'prepare137.py');prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
command=['cmd.exe','/d','/c','gradlew.bat',':app:assembleRelease','--no-daemon','--console=plain','--max-workers=1','-PreactNativeArchitectures=arm64-v8a','-Pkotlin.incremental=false','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m']
with (OUT/'build139-final.private.log').open('w',encoding='utf8') as log:code=sp.call(command,cwd=ROOT/'apps/mobile/android',env=prepare.environment(signing=True),stdout=log,stderr=sp.STDOUT)
result={'exitCode':code,'finalInput':True,'endedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'build139-exit.json').write_text(json.dumps(result));print(json.dumps(result));raise SystemExit(code)
