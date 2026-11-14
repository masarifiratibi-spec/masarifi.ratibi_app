"""Read-only host consumer/capacity/journal audit with strict output selection."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess as sp
from urllib.parse import urlsplit

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')


def main():
    os.umask(0o077)
    native=[];native_storage=[]
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():continue
        try:
            group=(proc/'cgroup').read_text()
            if 'docker' in group or 'containerd' in group:continue
            env=dict(part.split('=',1) for part in (proc/'environ').read_bytes().decode(errors='replace').split('\0') if '=' in part)
            connections=[]
            for key,value in env.items():
                if ('DATABASE' in key or 'POSTGRES' in key) and value.startswith(('postgres://','postgresql://')):
                    parsed=urlsplit(value);connections.append({'key':key,'host':parsed.hostname,'role':parsed.username})
            if env.get('PGHOST') and 'supabase' in env['PGHOST']:connections.append({'key':'PGHOST','host':env['PGHOST'],'role':env.get('PGUSER')})
            if connections:native.append({'pid':int(proc.name),'executable':os.readlink(proc/'exe'),'cgroup':group.strip(),'connections':connections})
            storage_keys=[key for key,value in env.items() if key in ('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY') or ('STORAGE' in key and 'supabase' in value.lower())]
            if storage_keys:native_storage.append({'pid':int(proc.name),'executable':os.readlink(proc/'exe'),'keys':storage_keys})
        except (OSError,ValueError):continue
    units=[]
    result=sp.run(['systemctl','list-units','--all','--plain','--no-legend','--no-pager'],capture_output=True,text=True,check=True)
    for line in result.stdout.splitlines():
        tokens=line.split()
        if tokens and tokens[0].startswith('masarifi') and 'selfhost' not in tokens[0]:
            name=tokens[0]
            properties=sp.run(['systemctl','show',name,'-p','ActiveState','-p','SubState','-p','EnvironmentFiles','-p','ExecStart','-p','FragmentPath'],capture_output=True,text=True,check=True).stdout
            data=dict(row.split('=',1) for row in properties.splitlines() if '=' in row)
            units.append({'name':name,'active':data.get('ActiveState'),'sub':data.get('SubState'),'unitFile':data.get('FragmentPath'),'environmentFiles':data.get('EnvironmentFiles'),'inlineSourceMention':'supabase' in data.get('ExecStart','').lower(),'inlineDatabaseMention':bool(re.search(r'postgres(?:ql)?://|DATABASE_URL|PGHOST',data.get('ExecStart',''))),'scripts':sorted(set(re.findall(r'/[A-Za-z0-9_./-]+\.(?:cjs|mjs|js|py|sh)',data.get('ExecStart',''))))})
    cron=[]
    paths=[Path('/etc/crontab'),Path('/var/spool/cron/crontabs/root')]
    paths.extend(Path('/etc/cron.d').glob('*'))
    for path in paths:
        if path.is_file():
            data=path.read_bytes();text=data.decode(errors='replace')
            cron.append({'path':str(path),'sha256':hashlib.sha256(data).hexdigest(),'projectMention':bool(re.search('masarifi|masarifiratibi',text,re.I)),'sourceMention':'supabase' in text.lower()})
    configured=sp.run(['systemd-analyze','cat-config','systemd/journald.conf'],capture_output=True,text=True,check=True).stdout
    settings={}
    for line in configured.splitlines():
        if line.strip() and not line.lstrip().startswith(('#',';')) and '=' in line:
            key,value=line.strip().split('=',1)
            if key in ('Storage','SystemMaxUse','SystemKeepFree','RuntimeMaxUse','MaxRetentionSec','MaxFileSec'):settings[key]=value
    disk=shutil.disk_usage('/srv/masarifi')
    mem=dict((line.split(':',1)[0],line.split(':',1)[1].strip()) for line in Path('/proc/meminfo').read_text().splitlines())
    container_storage=[]
    ids=sp.check_output(['docker','ps','-q'],text=True).split()
    for container in json.loads(sp.check_output(['docker','inspect',*ids])):
        env=dict(value.split('=',1) for value in container['Config']['Env'] or [] if '=' in value)
        keys=[key for key,value in env.items() if key in ('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY') or ('STORAGE' in key and 'supabase' in value.lower())]
        if keys:container_storage.append({'name':container['Name'],'id':container['Id'],'keys':keys,'databaseConsumer':any(key.endswith('DATABASE_URL') for key in env)})
    script_sources=[]
    for unit in units:
        for name in unit['scripts']:
            path=Path(name)
            if path.is_file():
                data=path.read_bytes()
                script_sources.append({'path':name,'sha256':hashlib.sha256(data).hexdigest(),'sourceProviderMention':b'supabase' in data.lower(),'directDatabaseMention':bool(re.search(rb'postgres(?:ql)?://|DATABASE_URL|PGHOST',data))})
    report={'nativeDatabaseConsumers':native,'nativeStorageConsumers':native_storage,'containerStorageConsumers':container_storage,'projectUnits':units,'unitScripts':script_sources,'cronFiles':cron,'journal':{'configured':settings,'persistentDirectory':Path('/var/log/journal').is_dir()},'capacity':{'diskFree':disk.free,'memoryAvailable':mem['MemAvailable']}}
    (ROOT/'host-audit.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report),flush=True)


if __name__=='__main__':main()
