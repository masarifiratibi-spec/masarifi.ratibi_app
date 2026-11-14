"""Compare every table/sequence exactly while ignoring SQL aggregate delivery order."""
import importlib.util
import json
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('cutover_tests',Path(__file__).with_name('test_cutover.py'))
helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)


class FinalDataTests(unittest.TestCase):
    def fingerprint(self,reverse=False,duplicate=False):
        module,_=helpers.load_cutover('verify-final-data.py')
        module.io.qi=lambda value:'"'+value+'"';module.io.ql=lambda value:"'"+value+"'"
        catalog=[{'schema':'public','name':name,'kind':kind} for name,kind in [('a','r'),('b','r'),('s1','S'),('s2','S')]]
        tables=[{'id':'public.a','rows':1,'digest':'a'},{'id':'public.b','rows':2,'digest':'b'}]
        sequences=[{'id':'public.s1','lastValue':'1','called':True},{'id':'public.s2','lastValue':'2','called':False}]
        def reader(sql,**kwargs):
            if 'from pg_class' in sql:return json.dumps(catalog)
            rows=sequences if 'lastValue' in sql else tables
            if duplicate:rows=[rows[0],rows[0]]
            return json.dumps(list(reversed(rows)) if reverse else rows)
        return module.fingerprint(reader)

    def test_parallel_union_delivery_order_does_not_report_data_loss(self):
        self.assertEqual(self.fingerprint(),self.fingerprint(reverse=True))

    def test_duplicate_relation_fingerprints_are_rejected(self):
        with self.assertRaisesRegex(AssertionError,'FINGERPRINT_RELATION_IDENTITY'):
            self.fingerprint(duplicate=True)


if __name__=='__main__':unittest.main()
