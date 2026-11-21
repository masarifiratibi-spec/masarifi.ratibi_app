"""The dump omits extension-owned pgmq.meta; row acceptance must still match it."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('cutover_tests',Path(__file__).with_name('test_cutover.py'))
helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)


class FinalDatabaseTests(unittest.TestCase):
    def test_final_transfer_preserves_extension_metadata_before_row_acceptance(self):
        module,_=helpers.load_cutover('final-database.py')
        source=[{'queue_name':'fixture_queue','is_partitioned':False,'is_unlogged':False,'created_at':'2026-01-01T00:00:00+00:00'}]
        transferred=[]
        def target(sql,**kwargs):
            if 'cron.launch_active_jobs' in sql:return 'off'
            if 'count(*) from pgmq.meta' in sql:return '0'
            if sql.startswith('insert into pgmq.meta'):
                self.assertIn(json.dumps(source),sql);transferred.extend(source)
            return ''
        module.io.target=target;module.io.source=lambda sql:json.dumps(source)
        module.io.ql=lambda value:"'"+value.replace("'","''")+"'"
        module.io.atomic_json=lambda path,value:Path(path).write_text(json.dumps(value))
        def command(args,**kwargs):
            if str(args[-1]).endswith('verify-final-data.py'):self.assertEqual(transferred,source)
        with tempfile.TemporaryDirectory() as directory:
            module.ROOT=Path(directory);module.STATE=module.ROOT/'state.json'
            module.STATE.write_text(json.dumps({'phase':'source-fenced','targetMayAcceptWrites':False,'originalCatalog':{},'startedAt':1}))
            # A previous attempt retains code and receipts only, never a dump.
            (module.ROOT/'final-transfer').mkdir()
            for name in ('stream-rehearsal.py','logical_stream.py','precreate-qualified-extensions.py','reconcile-qualified-catalog.py','verify-catalog.py','catalog-summary.sql','constraint-tree.py'):(module.ROOT/name).write_text('')
            for name in ('database-prepared-qualified.json','roles-transfer-qualified.json','catalog-object-differences.json'):(module.ROOT/name).write_text('{}')
            with patch.object(module.sp,'run',side_effect=command):module.main()
            self.assertEqual(json.loads(module.STATE.read_text())['phase'],'data-verified')


if __name__=='__main__':unittest.main()
