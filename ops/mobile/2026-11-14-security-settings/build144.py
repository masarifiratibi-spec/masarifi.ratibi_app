"""Build 144 from the pinned installed 143 inputs plus the Security Settings edit."""
from pathlib import Path
import datetime, hashlib, importlib.util, json, re, subprocess as sp, sys

ROOT = Path('C:/mpr12')
SOURCE = Path('D:/Masarifi-integration-2026-10-10')
PREVIOUS = Path('E:/Masarifi-tracking-direct-143-20261113')
OUT = Path('E:/Masarifi-security-settings-144-20261114')
CHANGES = ['apps/mobile/app/security/settings.tsx', 'apps/mobile/src/features/security/SecurityJourney.test.tsx']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def git(*args):
    return sp.check_output(['git', '-c', 'core.safecrlf=false', *args], cwd=ROOT, text=True).strip()

OUT.mkdir(exist_ok=True)
prior = json.loads((PREVIOUS/'prepared143.json').read_text())
assert git('rev-parse', 'HEAD') == prior['sourceCommit']
assert sp.check_output(['git','rev-parse','HEAD:apps/mobile'],cwd=SOURCE,text=True).strip() == prior['sourceMobileTree']
gradle = ROOT/'apps/mobile/android/app/build.gradle'
if (OUT/'prepared144.json').exists():
    assert '--resume' in sys.argv and not (OUT/'build144-started.json').exists()
    proof = json.loads((OUT/'prepared144.json').read_text())
    assert sha(gradle) == proof['generatedGradleSha256']
    for name, digest in proof['overlayPins'].items():
        assert sha(ROOT/name) == digest, name
else:
    expected = set(prior['overlayPins'])-set(prior['newSourceFiles'])-set(prior['baselineRestoredFiles'])
    assert set(git('diff','--name-only').splitlines()) == expected
    for name, digest in prior['overlayPins'].items():
        assert sha(ROOT/name) == digest, name
    assert sha(gradle) == prior['generatedGradleSha256']
    pins = dict(prior['overlayPins'])
    for name in CHANGES:
        assert (ROOT/name).read_bytes().replace(b'\r\n',b'\n') == sp.check_output(['git','show','HEAD:'+name],cwd=SOURCE).replace(b'\r\n',b'\n'), name
        body = (SOURCE/name).read_bytes()
        (ROOT/name).write_bytes(body)
        pins[name] = hashlib.sha256(body).hexdigest()
    assert "router.push('/profile/privacy')" not in (ROOT/CHANGES[0]).read_text()
    assert "appShell.security.sections.privacy" not in (ROOT/CHANGES[0]).read_text()
    content, count = re.subn(r'(?m)^(\s*versionCode\s+)143\s*$',r'\g<1>144',gradle.read_text(),count=1)
    assert count == 1
    gradle.write_text(content,encoding='utf8')
    proof = {**prior,'versionCode':144,'overlayPins':pins,'generatedGradleSha256':sha(gradle),
             'generatedChanges':['versionCode 144'],'changedFrom143':CHANGES,'securityPrivacyEntryRemoved':True,
             'integrationHeadObserved':sp.check_output(['git','rev-parse','HEAD'],cwd=SOURCE,text=True).strip()}
    (OUT/'prepared144.json').write_text(json.dumps(proof,indent=2))
spec = importlib.util.spec_from_file_location('prepare',Path('E:/Masarifi-play-acceptance-20261112/prepare137.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
env = prepare.environment(signing=True)
check_env = dict(env, NODE_ENV='test')
checks = [
    ('security-tests',['node','node_modules/jest/bin/jest.js','src/features/security/SecurityJourney.test.tsx','--runInBand','--forceExit','--json','--outputFile='+str(OUT/'security-tests.json')]),
    ('typecheck',['node','node_modules/typescript/bin/tsc','--noEmit']),
    ('eslint',['node','node_modules/eslint/bin/eslint.js','app/security/settings.tsx','src/features/security/SecurityJourney.test.tsx'])]
validation = json.loads((OUT/'local-validation.json').read_text()) if '--resume' in sys.argv else {}
for name, command in checks:
    if validation.get(name) == 0:
        continue
    check_cwd = (SOURCE if name == 'typecheck' else ROOT)/'apps/mobile'
    if name == 'typecheck':
        for relative, digest in proof['overlayPins'].items():
            assert sha(SOURCE/relative) == digest, relative
        (OUT/'typecheck-workspace.json').write_text(json.dumps({'cwd':str(check_cwd),'reason':'Integration workspace has the API type dependencies; mobile tree and every overlay input match the build copy.'},indent=2))
    with (OUT/(name+'.private.log')).open('w',encoding='utf8') as log:
        result = sp.call(command,cwd=check_cwd,env=check_env,stdout=log,stderr=sp.STDOUT)
    validation[name] = result
    (OUT/'local-validation.json').write_text(json.dumps(validation,indent=2))
    assert result == 0, name+' failed; inspect private log'
    print(name+': passed',flush=True)
with (OUT/'build144-started.json').open('x') as f:
    json.dump({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versionCode':144},f)
command = ['cmd.exe','/d','/c','gradlew.bat',':app:assembleRelease','--no-daemon','--console=plain','--max-workers=1','-PreactNativeArchitectures=arm64-v8a','-Pkotlin.incremental=false','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m']
with (OUT/'build144.private.log').open('w',encoding='utf8') as log:
    result = sp.call(command,cwd=ROOT/'apps/mobile/android',env=env,stdout=log,stderr=sp.STDOUT)
receipt = {'exitCode':result,'finalInput':True,'endedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(OUT/'build144-exit.json').write_text(json.dumps(receipt))
print(json.dumps(receipt))
raise SystemExit(result)
