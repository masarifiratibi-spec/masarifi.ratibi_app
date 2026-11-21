"""Build 145 from installed 144 with update checks moved into Security Settings."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import datetime, hashlib, importlib.util, json, re, subprocess as sp

ROOT = Path('C:/mpr12')
SOURCE = Path('D:/Masarifi-integration-2026-10-10')
PREVIOUS = Path('E:/Masarifi-security-settings-144-20261114')
OUT = Path('E:/Masarifi-security-updates-145-20261114')
CHANGES = ['apps/mobile/app/security/settings.tsx',
           'apps/mobile/src/features/security/SecurityJourney.test.tsx',
           'apps/mobile/src/features/settings/ApplicationSettingsScreen.tsx',
           'apps/mobile/src/features/settings/SettingsJourney.test.tsx']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def git(*args):
    return sp.check_output(['git','-c','core.safecrlf=false',*args],cwd=ROOT,text=True).strip()

OUT.mkdir(exist_ok=True)
assert not (OUT/'prepared145.json').exists(), 'Inspect existing dispatch before retrying'
prior = json.loads((PREVIOUS/'prepared144.json').read_text())
assert git('rev-parse','HEAD') == prior['sourceCommit']
assert sp.check_output(['git','rev-parse','HEAD:apps/mobile'],cwd=SOURCE,text=True).strip() == prior['sourceMobileTree']
expected = set(prior['overlayPins'])-set(prior['newSourceFiles'])-set(prior['baselineRestoredFiles'])
assert set(git('diff','--name-only').splitlines()) == expected
for relative, digest in prior['overlayPins'].items():
    assert sha(ROOT/relative) == digest, relative
gradle = ROOT/'apps/mobile/android/app/build.gradle'
assert sha(gradle) == prior['generatedGradleSha256']
pins = dict(prior['overlayPins'])
for relative in CHANGES:
    if relative not in pins:
        assert (ROOT/relative).read_bytes().replace(b'\r\n',b'\n') == sp.check_output(['git','show','HEAD:'+relative],cwd=SOURCE).replace(b'\r\n',b'\n'), relative
    body = (SOURCE/relative).read_bytes()
    (ROOT/relative).write_bytes(body)
    pins[relative] = hashlib.sha256(body).hexdigest()
security = (ROOT/CHANGES[0]).read_text()
assert "router.push('/profile/privacy')" not in security and 'appShell.security.sections.privacy' not in security
assert '<AppUpdateSettingsEntry />' in security
assert 'AppUpdateSettingsEntry' not in (ROOT/CHANGES[2]).read_text()
content, count = re.subn(r'(?m)^(\s*versionCode\s+)144\s*$',r'\g<1>145',gradle.read_text(),count=1)
assert count == 1
gradle.write_text(content,encoding='utf8')
proof = {**prior,'versionCode':145,'overlayPins':pins,'generatedGradleSha256':sha(gradle),
         'generatedChanges':['versionCode 145'],'changedFrom144':CHANGES,
         'updateChecksMovedToSecurity':True,
         'integrationHeadObserved':sp.check_output(['git','rev-parse','HEAD'],cwd=SOURCE,text=True).strip()}
(OUT/'prepared145.json').write_text(json.dumps(proof,indent=2))
spec = importlib.util.spec_from_file_location('prepare',Path('E:/Masarifi-play-acceptance-20261112/prepare137.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
env = prepare.environment(signing=True)

def run_logged(name,command,cwd,environment):
    with (OUT/(name+'.private.log')).open('w',encoding='utf8') as log:
        code = sp.call(command,cwd=cwd,env=environment,stdout=log,stderr=sp.STDOUT)
    print(name+': exit '+str(code),flush=True)
    return code

def validate():
    checks = [
        ('settings-tests',['node','node_modules/jest/bin/jest.js','src/features/security/SecurityJourney.test.tsx','src/features/settings/SettingsJourney.test.tsx','src/features/app-update/AppUpdateNotice.test.tsx','--runInBand','--forceExit','--json','--outputFile='+str(OUT/'settings-tests.json')],ROOT),
        ('typecheck',['node','node_modules/typescript/bin/tsc','--noEmit'],SOURCE),
        ('eslint',['node','node_modules/eslint/bin/eslint.js',*[str(Path(p).relative_to('apps/mobile')) for p in CHANGES]],ROOT)]
    results = {}
    for name, command, workspace in checks:
        for relative, digest in pins.items():
            assert sha(ROOT/relative) == digest and sha(SOURCE/relative) == digest, relative
        results[name] = run_logged(name,command,workspace/'apps/mobile',dict(env,NODE_ENV='test'))
        (OUT/'local-validation.json').write_text(json.dumps(results,indent=2))
        assert results[name] == 0, name+' failed; inspect private log'
    (OUT/'typecheck-workspace.json').write_text(json.dumps({'cwd':str(SOURCE/'apps/mobile'),'reason':'API type dependencies exist in integration; mobile tree and overlay inputs match build copy.'},indent=2))

def build():
    with (OUT/'build145-started.json').open('x') as f:
        json.dump({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'versionCode':145},f)
    command = ['cmd.exe','/d','/c','gradlew.bat',':app:assembleRelease','--no-daemon','--console=plain','--max-workers=1','-PreactNativeArchitectures=arm64-v8a','-Pkotlin.incremental=false','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m']
    code = run_logged('build145',command,ROOT/'apps/mobile/android',env)
    (OUT/'build145-exit.json').write_text(json.dumps({'exitCode':code,'finalInput':True,'endedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
    assert code == 0, 'Build failed; inspect private log'

with ThreadPoolExecutor(max_workers=2) as executor:
    futures = [executor.submit(validate),executor.submit(build)]
    for future in futures:
        future.result()
print('145 build and validation passed',flush=True)
