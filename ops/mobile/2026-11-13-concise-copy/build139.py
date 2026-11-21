"""Build the reviewed text/navigation overlay over the exact installed-138 sources."""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import re
import subprocess as sp

SOURCE=Path('D:/Masarifi-integration-2026-10-10')
ROOT=Path('C:/mpr12')
PREVIOUS=Path('E:/Masarifi-play-acceptance-20261112')
OUT=Path('E:/Masarifi-concise-139-20261113')
FILES=[
 'src/features/assistant/components/AssistantConsentCard.tsx',
 'src/features/legal/privacy.ar.json','src/features/legal/privacy.en.json',
 'src/features/onboarding/PermissionEducation.tsx','src/features/onboarding/PermissionEducation.test.tsx',
 'src/features/tracking/TrackingStatusScreen.tsx',
 'src/features/voice/useVoiceProcessingConsent.tsx','src/features/voice/voice-processing-consent.test.tsx',
 'src/localization/messages/ar.ts','src/localization/messages/en.ts',
]

def main():
 OUT.mkdir(exist_ok=True)
 assert sp.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()=='ae290abac9b3d55c1f482ec8198e91200a8ea0b4'
 assert not sp.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=ROOT,text=True).strip(),'BUILD_CHECKOUT_CHANGED'
 assert not (OUT/'build139-started.json').exists(),'BUILD_ALREADY_DISPATCHED'
 prior=json.loads((PREVIOUS/'prepared138.json').read_text())
 gradle=ROOT/'apps/mobile/android/app/build.gradle'
 assert hashlib.sha256(gradle.read_bytes()).hexdigest()==prior['generatedGradleSha256']
 pins={}
 for name in FILES:
  path='apps/mobile/'+name;body=(SOURCE/path).read_bytes()
  (ROOT/path).write_bytes(body);pins[path]=hashlib.sha256(body).hexdigest()
 dirty=sp.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines()
 assert set(dirty)==set(pins),'UNEXPECTED_BUILD_OVERLAY'
 content,count=re.subn(r'(?m)^(\s*versionCode\s+)138\s*$',r'\g<1>139',gradle.read_text(),count=1)
 assert count==1;gradle.write_text(content,encoding='utf8')
 spec=importlib.util.spec_from_file_location('prepare',PREVIOUS/'prepare137.py');prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
 proof={**prior,'versionCode':139,'overlayPins':pins,'generatedGradleSha256':hashlib.sha256(gradle.read_bytes()).hexdigest(),'generatedChanges':['versionCode 139'],'nativeRuntimeChanged':False}
 (OUT/'prepared139.json').write_text(json.dumps(proof,indent=2))
 (OUT/'build139-started.json').write_text(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versionCode':139}))
 command=['cmd.exe','/d','/c','gradlew.bat',':app:assembleRelease','--no-daemon','--console=plain','--max-workers=1','-PreactNativeArchitectures=arm64-v8a','-Pkotlin.incremental=false','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m']
 with (OUT/'build139.private.log').open('w',encoding='utf8') as log:code=sp.call(command,cwd=ROOT/'apps/mobile/android',env=prepare.environment(signing=True),stdout=log,stderr=sp.STDOUT)
 (OUT/'build139-exit.json').write_text(json.dumps({'exitCode':code,'endedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 print(json.dumps({'versionCode':139,'exitCode':code,'overlayFiles':len(pins)}));raise SystemExit(code)

if __name__=='__main__':main()
