import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('tree',Path(__file__).with_name('constraint-tree.py'))
tree=importlib.util.module_from_spec(spec);spec.loader.exec_module(tree)


class TreeTests(unittest.TestCase):
    def test_locations_and_byte_signedness_only(self):
        self.assertEqual(tree.canonical_tree('{CONST :location 42 :constvalue 2 [ -12 -1 ]}'),tree.canonical_tree('{CONST :location -1 :constvalue 2 [ 244 255 ]}'))
        self.assertNotEqual(tree.canonical_tree('{CONST :constvalue 1 [ 0 ]}'),tree.canonical_tree('{CONST :constvalue 1 [ 1 ]}'))

    def test_associative_boolean_grouping_preserves_other_operators(self):
        a='{BOOLEXPR :boolop and :args ({A} {BOOLEXPR :boolop and :args ({B} {C})})}'
        b='{BOOLEXPR :boolop and :args ({A} {B} {C})}'
        self.assertEqual(tree.canonical_tree(a),tree.canonical_tree(b))
        self.assertNotEqual(tree.canonical_tree(a.replace(':boolop and',':boolop or',1)),tree.canonical_tree(b))
        self.assertNotEqual(tree.canonical_tree('{OP :opno 1 :type 23}'),tree.canonical_tree('{OP :opno 2 :type 23}'))

    def test_malformed_tree_is_rejected(self):
        for value in ('{X','{X}}','{X :location x}','{X [ 256 ]}'):
            with self.subTest(value=value),self.assertRaises((AssertionError,ValueError)):
                tree.canonical_tree(value)


if __name__=='__main__':unittest.main()
