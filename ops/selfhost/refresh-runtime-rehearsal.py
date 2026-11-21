"""Refresh only our private shadow after qualification; serving source containers remain intact."""
import json
from pathlib import Path
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
NAME='masarifi-selfhost-shadow-core'


def main():
    result=sp.run(['docker','inspect',NAME],capture_output=True,check=True)
    shadow=json.loads(result.stdout)[0]
    assert shadow['Config']['Labels'].get('masarifi.role')=='shadow-api'
    assert shadow['Config']['Labels'].get('masarifi.scope')=='selfhost'
    sp.run(['docker','stop',NAME],capture_output=True,check=True,timeout=45)
    sp.run(['python3','-I',str(ROOT/'inspect-runtimes.py')],check=True,timeout=120)
    sp.run(['python3','-I',str(ROOT/'stage-runtime-patches.py')],check=True,timeout=1200)
    sp.run(['python3','-I',str(ROOT/'runtime-container.py'),'preflight'],check=True,timeout=300)
    sp.run(['docker','rm',NAME],capture_output=True,check=True,timeout=30)
    sp.run(['python3','-I',str(ROOT/'runtime-container.py'),'create-shadow'],check=True,timeout=300)


if __name__=='__main__':main()
