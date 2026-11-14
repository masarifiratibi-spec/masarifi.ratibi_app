"""Remove only the migration's disposable non-serving clone and stopped probes."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)

def main():
 os.umask(0o077)
 state=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text())
 assert state['targetMayAcceptWrites'] and state['phase']=='operational-target-awaiting-final-acceptance'
 assert json.loads((ROOT/'operational-server-acceptance.json').read_text())['state']=='passed'
 runtime=io.load('runtime-container');keep={r['id'] for r in state['newConsumers']+state['sourceConsumers']}
 keep.update(runtime.inspect(name)['Id'] for name in ['masarifi-postgres17','masarifi-private-storage'])
 names=['masarifi-selfhost-shadow-core','masarifi-postgres17-rehearsal']
 tracking=next(r for r in state['newConsumers'] if 'tracking-maintenance' in r['name'])
 names.append(tracking['name']+'-before-entrypoint-fix-r10')
 all_containers=runtime.docker_request('GET','/containers/json?all=1')
 present={n.lstrip('/'):r['Id'] for r in all_containers for n in r['Names']}
 removed=[];trial_data=Path('/srv/masarifi/postgresql17-rehearsal')
 for name in names:
  if name not in present:continue
  c=runtime.inspect(present[name]);assert c['Id'] not in keep and c['Config']['Labels']['masarifi.scope']=='selfhost'
  if name=='masarifi-postgres17-rehearsal':
   assert any(m['Source']==str(trial_data) and m['Destination']=='/var/lib/postgresql/data' for m in c['Mounts'])
  else:assert not c['State']['Running']
  if c['State']['Running']:runtime.docker_request('POST','/containers/'+c['Id']+'/stop?t=10')
  runtime.docker_request('DELETE','/containers/'+c['Id']);removed.append(name)
 assert trial_data.resolve()==trial_data and not trial_data.is_symlink()
 remaining=runtime.docker_request('GET','/containers/json?all=1')
 for row in remaining:
  c=runtime.inspect(row['Id']);assert all(not (m['Source']==str(trial_data) or m['Source'].startswith(str(trial_data)+'/')) for m in c['Mounts'])
 if trial_data.exists():shutil.rmtree(trial_data)
 receipt={'state':'passed','removedTrialContainers':removed,'removedDisposableDatabaseDirectory':str(trial_data),'operationalDataPreserved':True,'frozenSourceConsumersPreserved':len(state['sourceConsumers']),'retainedDump':False}
 io.atomic_json(ROOT/'owned-trials-cleaned.json',receipt);print(json.dumps(receipt),flush=True)

if __name__=='__main__':main()
