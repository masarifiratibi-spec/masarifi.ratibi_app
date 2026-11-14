"""Start each exact API candidate privately, one at a time; never start a worker."""
import importlib.util
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError,URLError
import urllib.request

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('runtime',ROOT/'runtime-container.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)


def main():
    os.umask(0o077);results=[]
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text())
    for candidate in candidates:
        source=runtime.inspect(candidate['id'])
        if dict(value.split('=',1) for value in source['Config']['Env'])['MASARIFI_PROCESS_KIND']!='api':continue
        runtime.verify_effective(source);body,_=runtime.render(source,candidate,shadow=True)
        body['Labels']['masarifi.role']='startup-probe'
        name='masarifi-selfhost-api-probe-'+candidate['id'][:12]
        created=runtime.docker_request('POST','/containers/create?name='+name,body);identifier=created['Id']
        started=time.monotonic()
        try:
            runtime.docker_request('POST','/containers/'+identifier+'/start')
            deadline=time.monotonic()+60;status=None
            while time.monotonic()<deadline:
                container=runtime.inspect(identifier)
                assert container['State']['Running'],'API_PROBE_EXITED:'+candidate['name']
                address=container['NetworkSettings']['Networks']['masarifi-selfhost-data']['IPAddress']
                url='http://'+address+':'+str(runtime.environment_port(body['Env']))+'/health/ready'
                try:
                    with urllib.request.urlopen(urllib.request.Request(url,headers={'x-request-id':'selfhost-startup-probe'}),timeout=4) as response:status=response.status
                    if status==200:break
                except (HTTPError,URLError,OSError):pass
                time.sleep(1)
            assert status==200,'API_PROBE_NOT_READY:'+candidate['name']
            row={'name':candidate['name'],'sourceId':candidate['id'],'state':'passed','seconds':round(time.monotonic()-started,3),'modules':candidate['files']}
            results.append(row);print(json.dumps({key:value for key,value in row.items() if key!='modules'}),flush=True)
        finally:
            current=runtime.inspect(identifier);assert current['Config']['Labels']['masarifi.role']=='startup-probe'
            runtime.docker_request('POST','/containers/'+identifier+'/stop?t=10');runtime.docker_request('DELETE','/containers/'+identifier)
    receipt={'state':'passed','apis':results,'workersStarted':False,'publicPorts':False,'originalConsumersPreserved':len(candidates)}
    (ROOT/'api-startup-verification.json').write_text(json.dumps(receipt,indent=2))
    print(json.dumps({'state':'passed','apis':len(results),'slowestSeconds':max(row['seconds'] for row in results)}),flush=True)


if __name__=='__main__':main()
