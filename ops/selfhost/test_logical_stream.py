import unittest
from logical_stream import skip_precreated_schemas


class LogicalStreamTests(unittest.TestCase):
    def test_removes_only_the_known_schema_creation_after_its_dump_header(self):
        function_body = b"CREATE FUNCTION demo() RETURNS void AS $$\nCREATE SCHEMA extensions;\n$$ LANGUAGE sql;\n"
        schema = b"-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres\n--\n\nCREATE SCHEMA extensions;\n\nALTER SCHEMA extensions OWNER TO postgres;\n"
        data = b"COPY fixture(value) FROM stdin;\nCREATE SCHEMA extensions;\n-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres\nCREATE SCHEMA extensions;\n\\.\n"
        result = b''.join(skip_precreated_schemas((function_body+schema+data).splitlines(keepends=True), {'extensions'}))
        self.assertEqual(result, function_body + schema.replace(b'CREATE SCHEMA extensions;\n', b'') + data)

    def test_rejects_a_missing_schema_header_instead_of_silently_accepting_drift(self):
        with self.assertRaisesRegex(ValueError, 'SCHEMA_HEADER_DRIFT'):
            list(skip_precreated_schemas([b'CREATE SCHEMA extensions;\n'], {'extensions'}))

    def test_does_not_touch_another_schema(self):
        data = b'-- Name: private; Type: SCHEMA; Schema: -; Owner: postgres\n--\n\nCREATE SCHEMA private;\n'
        self.assertEqual(b''.join(skip_precreated_schemas(data.splitlines(keepends=True), set())), data)


if __name__ == '__main__':
    unittest.main()
