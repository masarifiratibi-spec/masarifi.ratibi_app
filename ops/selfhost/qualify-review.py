"""Record review closure only after its concrete evidence and current tests pass."""
import hashlib
import json
import os
from pathlib import Path
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')


def main():
    os.umask(0o077)
    tests=sp.run(['python3','-I',str(ROOT/'test_cutover.py')],capture_output=True,timeout=30)
    assert tests.returncode==0 and b'skipped' not in tests.stderr,'CUTOVER_TESTS_NOT_PASSED'
    final_tests=sp.run(['python3','-I',str(ROOT/'test_final_database.py')],capture_output=True,timeout=30)
    assert final_tests.returncode==0,'FINAL_TRANSFER_TESTS_NOT_PASSED'
    data_tests=sp.run(['python3','-I',str(ROOT/'test_final_data.py')],capture_output=True,timeout=30)
    assert data_tests.returncode==0,'FINAL_DATA_COMPARATOR_TESTS_NOT_PASSED'
    frozen=json.loads((ROOT/'final-data-verification.json').read_text())
    for kind in ('tables','sequences'):
        left=frozen['source'][kind];right=frozen['target'][kind]
        assert len({row['id'] for row in left})==len(left) and len({row['id'] for row in right})==len(right)
        assert sorted(left,key=lambda row:row['id'])==sorted(right,key=lambda row:row['id']),'FROZEN_ROW_FINGERPRINTS_DIFFER'
    extension=json.loads((ROOT/'extension-data-qualified.json').read_text())
    assert extension['state']=='passed' and extension['codeSha256']==hashlib.sha256((ROOT/'final-database.py').read_bytes()).hexdigest()
    gates={name:json.loads((ROOT/name).read_text()) for name in ('storage-static-address.json','api-startup-verification.json','functional-runtime-verification.json')}
    assert all(value['state']=='passed' for value in gates.values())
    assert gates['storage-static-address.json']['staticAddress'] is True
    assert len(gates['api-startup-verification.json']['apis'])==15
    assert gates['functional-runtime-verification.json']['actualWorkerPhases']==['reports','assistant','voice']
    candidates=json.loads((ROOT/'runtime-candidates.json').read_text())
    for candidate in candidates:
        for name in ('platform/observability/platform-logger.js','platform/observability/log-context.js'):
            assert hashlib.sha256((ROOT/'compiled'/name).read_bytes()).hexdigest()==candidate['files'][name]['sha256'],'COMPILED_CANDIDATE_DRIFT'
    validation=json.loads((ROOT/'local-validation.json').read_text())
    assert validation['suitesPassed']==255 and validation['testsPassed']==2473
    assert validation['typecheck'] and validation['lint'] and validation['runtimeAndStorageTests']==15
    files=('cutover.py','runtime-container.py','migration-io.py','stream-rehearsal.py','final-database.py','verify-final-data.py','stage-runtime-patches.py','runtime-adapter.cjs','runtime-job-logging.cjs','test_cutover.py','test_final_database.py','test_final_data.py')
    receipt={'state':'passed','priorIndependentReview':'2026-11-13 handoff','findingsClosed':['worker claim id and SSE correlation','existing mounts inspected','storage static address and image recovery','absolute deadline and source-return boundary'],'currentCutoverTests':True,'localValidation':validation,'codeSha256':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files},'sourceChanged':False}
    temporary=ROOT/'review-qualified.json.new';temporary.write_text(json.dumps(receipt,indent=2));temporary.chmod(0o600);temporary.replace(ROOT/'review-qualified.json')
    print(json.dumps({'state':'passed','reviewFindingsClosed':4,'cutoverTestsPassed':True,'allApis':15}),flush=True)


if __name__=='__main__':main()
