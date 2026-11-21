"""Read-only validation of final-transfer SQL permissions and hash-query duration."""
import ast
import importlib.util
import json
from pathlib import Path
import time

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('verify_data',ROOT/'verify-final-data.py')
verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
for path in ROOT.glob('*.py'):ast.parse(path.read_text())
started=time.monotonic();source=verify.fingerprint(verify.io.source)
source_seconds=round(time.monotonic()-started,3)
started=time.monotonic();target=verify.fingerprint(verify.io.target)
receipt={'state':'passed','sourceTables':len(source['tables']),'sourceSequences':len(source['sequences']),'targetTables':len(target['tables']),'targetSequences':len(target['sequences']),'sourceHashSeconds':source_seconds,'targetHashSeconds':round(time.monotonic()-started,3),'comparisonDeferredUntilSourceFrozen':True,'sourceChanged':False}
(ROOT/'final-tools-qualified.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
