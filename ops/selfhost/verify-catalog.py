"""Compare schema/privilege fingerprints; no row contents or credentials enter the receipt."""
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess as sp
import sys

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
spec=importlib.util.spec_from_file_location('transfer',ROOT/'stream-rehearsal.py')
transfer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)
assert sys.argv[1:] in ([],['qualified']), 'Unknown verification mode'
qualified=sys.argv[1:]==['qualified']
if qualified:transfer.TARGET='masarifi-postgres17'
query=(ROOT/'catalog-summary.sql').read_text()
source=sp.run(['docker','run','--rm','--label','masarifi.selfhost.transfer=20261113','--log-driver=none','-i','--network=host','--read-only',
               '--mount','type=bind,src=/etc/masarifi/supabase-ca.crt,dst=/certs/ca.crt,readonly',
               '--entrypoint=/bin/sh',transfer.IMAGE],input=transfer.source_script(['psql','-XAtq','-v','ON_ERROR_STOP=1','-c',query]),capture_output=True,timeout=60)
assert source.returncode==0,'SOURCE_CATALOG_QUERY_FAILED'
target=sp.run(['docker','exec','-i',transfer.TARGET,'psql','-h','/tmp','-U','supabase_admin','-d','postgres','-XAtq','-v','ON_ERROR_STOP=1'],input=query.encode(),capture_output=True,timeout=60)
assert target.returncode==0,'TARGET_CATALOG_QUERY_FAILED'
a=json.loads(source.stdout);b=json.loads(target.stdout)
fence=ROOT/'source-fence-original.json'
if fence.exists():
    original=json.loads(fence.read_text())
    # Source CONNECT is intentionally fenced; target keeps the reviewed original ACL.
    a['database']['acl']=original['database']['acl']
tree_spec=importlib.util.spec_from_file_location('constraint_tree',ROOT/'constraint-tree.py')
tree=importlib.util.module_from_spec(tree_spec);tree_spec.loader.exec_module(tree)

def constraint_id(row):return (row['nspname'],row['relation'],row['domain'],row['conname'])
left={constraint_id(row):row for row in a['constraints']}
right={constraint_id(row):row for row in b['constraints']}
assert len(left)==len(a['constraints']) and len(right)==len(b['constraints']),'CONSTRAINT_IDENTITY_COLLISION'
constraint_differences=[];equivalent_trees=0
for key in sorted(left.keys()|right.keys()):
    first=left.get(key);second=right.get(key)
    if first is None or second is None:
        constraint_differences.append(key);continue
    metadata=lambda row:{k:v for k,v in row.items() if k not in ('definition','expression_tree')}
    if metadata(first)!=metadata(second):constraint_differences.append(key);continue
    if first['definition']==second['definition']:continue
    if first['expression_tree'] is not None and tree.canonical_tree(first['expression_tree'])==tree.canonical_tree(second['expression_tree']):
        equivalent_trees+=1
    else:constraint_differences.append(key)
digest=lambda value:hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
a['constraints']={'count':len(left),'digest':digest(a['constraints'])}
b['constraints']={'count':len(right),'digest':a['constraints']['digest'] if not constraint_differences else digest(b['constraints'])}
differences={key:{'source':a[key],'target':b.get(key)} for key in a if a[key]!=b.get(key)}
receipt={'state':'passed' if not differences else 'failed','source':a,'target':b,'differences':differences,'constraintProof':{'method':'identical SQL or identical expression tree after locations/byte signedness/associative AND-OR grouping','equivalentTrees':equivalent_trees,'unqualified':constraint_differences}}
with (ROOT/('catalog-comparison-qualified.json' if qualified else 'catalog-comparison.json')).open('w') as file:json.dump(receipt,file,indent=2)
print(json.dumps({'state':receipt['state'],'mismatchedCategories':list(differences),'applicationTables':b['applicationTables'],'migrations':b['migrations'],'extensions':b['extensions'],'database':b['database']}),flush=True)
if differences:raise SystemExit(1)
