"""Inspect effective serving JS (including mounted patches); never print Docker Env."""
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp
from urllib.parse import urlsplit

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
NODE=r"""
const fs=require('node:fs'),path=require('node:path');
const names=new Set(['environment.schema.js','platform-config.service.js','platform-logger.js','request-id.middleware.js','safe-exception.filter.js','ai.repository.js','ai.worker.js','assistant-agent.worker.js','operations.worker.js','operations.repository.js','tracking.worker.js','tracking.repository.js','reports.repository.js','ai.storage.js','reports.storage.js','reports.smtp.js','support.storage.js','tracking.storage.js','export-storage.js','pool.service.js','worker-error.js']);
const roots=['/app/dist/src','/app/dist'];const root=roots.find(p=>fs.existsSync(path.join(p,'platform/config/environment.schema.js')));
if(!root)throw Error('RUNTIME_ROOT_MISSING');
const files={};
function walk(p){for(const ent of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,ent.name);if(ent.isDirectory())walk(f);else if(ent.name.endsWith('.js')){const text=fs.readFileSync(f,'utf8');if(names.has(ent.name)||/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|\.supabase\.co/.test(text))files[path.relative(root,f)]=Buffer.from(text).toString('base64');}}}
walk(root);process.stdout.write(JSON.stringify({root,files}));
"""


def main():
    os.umask(0o077)
    ids=sp.check_output(['docker','ps','-q'],text=True).split()
    containers=json.loads(sp.check_output(['docker','inspect',*ids]))
    report=[]
    for c in containers:
        env=dict(v.split('=',1) for v in c['Config']['Env'] or [] if '=' in v)
        if not any('supabase.com' in (urlsplit(v).hostname or '') or 'supabase.co' in (urlsplit(v).hostname or '') for k,v in env.items() if k.endswith('DATABASE_URL')):
            continue
        result=sp.run(['docker','exec',c['Id'],'/nodejs/bin/node','-e',NODE],capture_output=True,timeout=30)
        assert result.returncode==0,'RUNTIME_INSPECTION_FAILED: '+c['Name']
        runtime=json.loads(result.stdout)
        directory=ROOT/'runtime-originals'/c['Id'][:12];directory.mkdir(parents=True,exist_ok=True,mode=0o700)
        files={}
        for name,value in runtime['files'].items():
            assert not name.startswith('/') and '..' not in Path(name).parts
            body=base64.b64decode(value)
            target=directory/name;target.parent.mkdir(parents=True,exist_ok=True,mode=0o700);target.write_bytes(body)
            files[name]={'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body)}
        report.append({'id':c['Id'],'name':c['Name'],'image':c['Image'],'startedAt':c['State']['StartedAt'],'root':runtime['root'],'files':files})
    assert len(report)==28,'RUNNING_CONSUMER_SET_CHANGED'
    previous_path=ROOT/'runtime-originals.json'
    if previous_path.exists():
        previous=json.loads(previous_path.read_text())
        assert {row['id'] for row in previous}=={row['id'] for row in report},'SERVING_RUNTIME_SET_CHANGED'
        for row in previous:
            current=next(item for item in report if item['id']==row['id'])
            assert all(current[key]==row[key] for key in ('image','startedAt')),'SERVING_RUNTIME_CHANGED'
            assert all(current['files'].get(name)==metadata for name,metadata in row['files'].items()),'EXISTING_EFFECTIVE_MODULE_CHANGED'
    (ROOT/'runtime-originals.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({'state':'inspected','consumers':len(report),'effectiveModules':sum(len(c['files']) for c in report),'distinctSchemaVersions':len({c['files']['platform/config/environment.schema.js']['sha256'] for c in report}),'sourceChanged':False}),flush=True)


if __name__=='__main__':main()
