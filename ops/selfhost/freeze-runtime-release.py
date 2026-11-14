"""Freeze the exact qualified code and current code mounts into a permanent release."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
RELEASE=Path('/opt/masarifi/selfhost/releases/2026-11-13')


def digest(path):
    if path.is_file():return hashlib.sha256(path.read_bytes()).hexdigest()
    values=[]
    for file in sorted(path.rglob('*')):
        assert not file.is_symlink(),'RELEASE_SYMLINK_REQUIRES_REVIEW'
        if file.is_file():values.append((str(file.relative_to(path)),hashlib.sha256(file.read_bytes()).hexdigest()))
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


def main():
    os.umask(0o077)
    assert not (ROOT/'permanent-release.json').exists(),'RELEASE_ALREADY_FROZEN'
    spec=importlib.util.spec_from_file_location('runtime',ROOT/'runtime-container.py')
    runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text())
    RELEASE.mkdir(parents=True,mode=0o700,exist_ok=False)
    entries=[]
    for candidate in candidates:
        source=runtime.inspect(candidate['id']);runtime.verify_effective(source)
        directory=RELEASE/candidate['id'][:12];directory.mkdir(mode=0o700)
        code=directory/'modules';shutil.copytree(ROOT/'runtime-candidates'/candidate['id'][:12],code)
        for file in code.rglob('*'):
            if file.is_file():file.chmod(0o644)
        replacements={}
        for index,mount in enumerate(source['Mounts']):
            destination=mount['Destination']
            if not (destination.startswith('/app/dist/') or destination=='/app/dist' or destination.startswith('/app/node_modules/')):continue
            assert mount['Type']=='bind' and not mount['RW'],'CODE_MOUNT_MUST_BE_READ_ONLY'
            original=Path(mount['Source']);target=directory/('original-mount-'+str(index))
            before=digest(original)
            if original.is_dir():shutil.copytree(original,target)
            else:shutil.copy2(original,target)
            assert digest(target)==before and digest(original)==before,'CODE_MOUNT_CHANGED_DURING_FREEZE'
            replacements[destination]={'source':str(target),'sha256':before}
        entries.append({'id':candidate['id'],'modules':str(code),'originalMounts':replacements,'image':source['Image']})
    support=runtime.support_files();shutil.copytree(support,RELEASE/'support')
    for file in (RELEASE/'support').rglob('*'):
        if file.is_file():file.chmod(0o644)
    receipt={'state':'frozen','release':str(RELEASE),'support':str(RELEASE/'support'),'consumers':entries,'databaseDataCopied':False}
    (RELEASE/'manifest.json').write_text(json.dumps(receipt,indent=2));(ROOT/'permanent-release.json').write_text(json.dumps(receipt,indent=2))
    print(json.dumps({'state':'frozen','release':str(RELEASE),'consumers':len(entries),'originalCodeMounts':sum(len(row['originalMounts']) for row in entries)}),flush=True)


if __name__=='__main__':main()
