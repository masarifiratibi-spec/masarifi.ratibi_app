"""Package only changed compiled modules. Refuse uncommitted build inputs."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

repo = Path(__file__).resolve().parents[3]
base = 'c60a8704'
release = Path(sys.argv[1]).resolve()
before = Path(sys.argv[2]).resolve()
after = repo/'apps/api/dist/src'
def git(*args):
    return subprocess.check_output(['git',*args],cwd=repo).decode().strip()
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if git('status','--porcelain','--','apps/api/src','supabase/migrations'):
    raise RuntimeError('Commit reviewed inputs first')
release.mkdir(exist_ok=False)
changes = git('diff','--name-only',base,'HEAD','--','apps/api/src').splitlines()
files = {}
for change in changes:
    name = Path(change).relative_to('apps/api/src').with_suffix('.js')
    if not (after/name).is_file(): raise ValueError(str(name))
    target = release/'modules'/name
    target.parent.mkdir(exist_ok=True,parents=True)
    shutil.copyfile(after/name,target)
    files[name.as_posix()] = {'before':sha(before/name) if (before/name).exists() else 'absent','after':sha(target)}
sql = repo/'supabase/migrations/20261107140000_owner_financial_reset.sql'
shutil.copyfile(sql,release/sql.name)
for name in ['build-overlay.py','Review.md']:
    shutil.copyfile(Path(__file__).with_name(name),release/name)
(release/'modules.json').write_text(json.dumps({'source':git('rev-parse','HEAD'),'migrationSha256':sha(sql),'modules':files},indent=2))
artifact = release.with_suffix('.tar.gz')
with tarfile.open(artifact,'w:gz') as tar:
    for file in sorted(release.rglob('*')):
        if file.is_file(): tar.add(file,arcname=file.relative_to(release))
print(json.dumps({'files':len(files),'archive':str(artifact),'sha256':sha(artifact)}))
