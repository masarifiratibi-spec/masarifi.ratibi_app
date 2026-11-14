"""Accept only the measured starts caused by our verified pre-write source recovery."""
import importlib.util
import json
from pathlib import Path

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('migration_io',ROOT/'migration-io.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io)


def main():
    state=json.loads(Path('/etc/masarifi/selfhost/cutover-state.json').read_text())
    assert state['phase']=='aborted-before-target-writes' and state['targetMayAcceptWrites'] is False
    runtime=io.load('runtime-container')
    originals=json.loads((ROOT/'runtime-originals.json').read_text());candidates=json.loads((ROOT/'runtime-candidates.json').read_text());changes=[]
    for row in originals:
        current=runtime.inspect(row['id']);candidate=next(x for x in candidates if x['id']==row['id'])
        saved=next(x for x in state['sourceConsumers'] if x['id']==row['id'])
        assert current['Image']==row['image']==candidate['image'] and current['Name']==row['name']
        assert current['State']['Running'] and saved['running']
        assert current['HostConfig']['RestartPolicy']==saved['restart']
        runtime.verify_effective(current)
        changes.append({'id':row['id'],'before':row['startedAt'],'after':current['State']['StartedAt']})
        row['startedAt']=candidate['startedAt']=current['State']['StartedAt']
    io.atomic_json(ROOT/'runtime-source-recovered-starts.json',{'state':'verified-recovered-starts','consumers':changes,'imagesAndCodeUnchanged':True})
    io.atomic_json(ROOT/'runtime-originals.json',originals);io.atomic_json(ROOT/'runtime-candidates.json',candidates)
    print(json.dumps({'state':'verified-recovered-starts','consumers':len(changes),'imagesAndCodeUnchanged':True}),flush=True)


if __name__=='__main__':main()
