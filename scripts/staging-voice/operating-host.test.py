"""Exercise the deployed monitor's closure function without host mutations."""
import ast
import pathlib
import unittest
import json
import datetime
from types import SimpleNamespace


def closure_fixture(foreign_api=False, closure_error=False):
    source = pathlib.Path(__file__).with_name('operating-host.py').read_text(encoding='utf-8-sig')
    functions = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)]
    calls = []
    image = 'ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:' + 'a' * 64
    sha = 'b' * 40
    api = {
        'Id': 'owned-api',
        'Config': {'Image': 'different' if foreign_api else image,
                   'Labels': {'com.docker.compose.project': 'masarifi-staging',
                              'com.docker.compose.service': 'api'},
                   'Env': ['MASARIFI_RELEASE_VERSION=' + sha]},
        'HostConfig': {'NetworkMode': 'masarifi-staging_backend'}
    }

    def db_close():
        calls.append('closeEpoch')
        if closure_error:
            raise RuntimeError('database unavailable')
        return {'posting': False, 'state': 'closed'}

    namespace = {
        'IMAGE': image, 'SHA': sha, 'SCOPE': 'owned-voice-scope',
        'WORKER': 'voice-worker', 'BASE': ['compose'],
        'target': lambda: calls.append('target'),
        'db_close': db_close,
        'inspect': lambda name: api,
        'stop_checked': lambda name, service=None, scope=None, expected_id=None: calls.append('stop:' + name),
        'pins': lambda: calls.append('pins'),
        'run': lambda args: calls.append('restore'),
        'wait_health': lambda financial: {'analysis': True}
    }
    exec(compile(ast.Module(body=functions, type_ignores=[]), 'operating-host.py', 'exec'), namespace)
    # Keep native/DB boundaries controlled; call the real production close function.
    namespace.update({
        'target': lambda: calls.append('target'), 'db_close': db_close,
        'inspect': lambda name: api,
        'stop_checked': lambda name, service=None, scope=None, expected_id=None: calls.append('stop:' + name),
        'pins': lambda: calls.append('pins'),
        'run': lambda args: calls.append('restore'),
        'wait_health': lambda financial: {'analysis': True}
    })
    return namespace['close'], calls


class VoiceClosureOwnership(unittest.TestCase):
    def test_invalid_compose_is_rejected_before_stopping_analysis(self):
        source = pathlib.Path(__file__).with_name('operating-host.py').read_text(encoding='utf-8-sig')
        tree = ast.parse(source)
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
        calls = []
        namespace = {'BASE': ['docker', 'compose'], 'ROOT': pathlib.Path('/owned-voice'), 'json': json}
        exec(compile(ast.Module(body=functions, type_ignores=[]), 'operating-host.py', 'exec'), namespace)
        def run(args):
            calls.append(args[-2:])
            raise RuntimeError('invalid compose project')
        namespace.update({'mode': 'switch-api', 'pins': lambda: None, 'health': lambda financial: None, 'run': run,
                          'stop_checked': lambda *args: calls.append('stop'),
                          'wait_health': lambda financial: None})
        with self.assertRaisesRegex(RuntimeError, 'invalid compose project'):
            exec(compile(ast.Module(body=[tree.body[-1]], type_ignores=[]), 'operating-host.py', 'exec'), namespace)
        self.assertEqual(calls, [['config', '--quiet']])

    def test_voice_failure_preserves_even_the_original_healthy_shared_api(self):
        close, calls = closure_fixture()
        result = close()
        self.assertEqual(result['state'], 'closed')
        self.assertIn('stop:voice-worker', calls)
        self.assertNotIn('stop:masarifi-staging-api-1', calls)
        self.assertNotIn('stop:masarifi-staging-worker-1', calls)
        self.assertNotIn('restore', calls)

    def test_unconfirmed_closure_stops_only_owned_voice_path_and_keeps_shared_ingress(self):
        close, calls = closure_fixture(closure_error=True)
        with self.assertRaisesRegex(RuntimeError, 'CLOSURE_UNCONFIRMED'):
            close()
        self.assertIn('stop:voice-worker', calls)
        self.assertNotIn('stop:masarifi-staging-api-1', calls)
        self.assertNotIn('stop:masarifi-staging-worker-1', calls)
        self.assertNotIn('restore', calls)

    def test_compatible_new_api_image_does_not_trip_voice_health(self):
        source = pathlib.Path(__file__).with_name('operating-host.py').read_text(encoding='utf-8-sig')
        functions = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)]
        contracts = {'voiceSession': 2, 'voiceExtraction': 3, 'voiceWorker': 1,
                     'voiceConfirmation': 2, 'assistantDirect': 2,
                     'assistantProvider': 1, 'manualReceipt': 1}
        new_sha = 'c' * 40
        new_image = 'ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:' + 'd' * 64
        responses = {'live': {'version': new_sha, 'status': 'ok'},
                     'ready': {'status': 'ready'},
                     'compatibility': {'schemaVersion': 1, 'contracts': contracts}}

        class Response:
            def __init__(self, value): self.value = value
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps(self.value).encode()

        def inspect(name):
            if name == 'masarifi-staging-api-1':
                return {'Config': {'Image': new_image, 'Env': [
                    'MASARIFI_RELEASE_VERSION=' + new_sha,
                    'MASARIFI_VOICE_ANALYSIS_ONLY=false',
                    'SUPABASE_URL=https://qcffvfbpzvpwcwxwjyro.supabase.co']},
                    'State': {'Running': True, 'Health': {'Status': 'healthy'}}}
            return {'State': {'Running': False}}

        namespace = {'IMAGE': 'old-image', 'SHA': 'b' * 40, 'DIGEST': 'a' * 64,
                     'PACKET': {'apiContracts': contracts}, 'json': json,
                     'datetime': datetime,
                     'urllib': SimpleNamespace(request=SimpleNamespace(urlopen=lambda url, timeout:
                         Response(responses[url.rsplit('/', 1)[-1]])))}
        exec(compile(ast.Module(body=functions, type_ignores=[]), 'operating-host.py', 'exec'), namespace)
        namespace.update({'pins': lambda: None, 'inspect': inspect})
        self.assertEqual(namespace['health'](True)['api'], 'healthy')
        responses['compatibility']['contracts'] = {**contracts, 'voiceWorker': 0}
        with self.assertRaisesRegex((AssertionError, RuntimeError), 'COMPATIBILITY'):
            namespace['health'](True)

    def test_api_replacement_between_ownership_check_and_stop_is_preserved_after_verified_off(self):
        source = pathlib.Path(__file__).with_name('operating-host.py').read_text(encoding='utf-8-sig')
        functions = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)]
        image = 'owned-image'
        sha = 'b' * 40
        api_reads = 0
        stops = []

        def inspect(name):
            nonlocal api_reads
            labels = {'com.docker.compose.project': 'masarifi-staging'}
            if name == 'masarifi-staging-api-1':
                api_reads += 1
                labels['com.docker.compose.service'] = 'api'
                return {'Id': 'owned-api' if api_reads == 1 else 'replacement-api',
                        'Config': {'Image': image if api_reads == 1 else 'new-image',
                                   'Env': ['MASARIFI_RELEASE_VERSION=' + sha], 'Labels': labels},
                        'HostConfig': {'NetworkMode': 'masarifi-staging_backend'},
                        'State': {'Running': True}}
            labels.update({'org.masarifi.scope': 'owned-voice-scope',
                           'com.docker.compose.service': 'worker'})
            return {'Id': name + '-id', 'Config': {'Labels': labels},
                    'HostConfig': {'NetworkMode': 'masarifi-staging_backend'},
                    'State': {'Running': True}}

        def run(args, timeout=60):
            if args[:2] == ['docker', 'ps']:
                return 'voice-worker'
            if args[:2] == ['docker', 'stop']:
                stops.append(args[-1])
                return args[-1]
            raise AssertionError('Unexpected host mutation')

        namespace = {'IMAGE': image, 'SHA': sha, 'SCOPE': 'owned-voice-scope',
                     'WORKER': 'voice-worker'}
        exec(compile(ast.Module(body=functions, type_ignores=[]), 'operating-host.py', 'exec'), namespace)
        namespace.update({'target': lambda: None, 'inspect': inspect, 'run': run,
                          'db_close': lambda: {'posting': False, 'state': 'closed'}})
        self.assertEqual(namespace['close']()['state'], 'closed')
        self.assertNotIn('replacement-api', stops)
        self.assertIn('voice-worker-id', stops)

    def test_verified_off_does_not_stop_or_restore_an_unrelated_api_release(self):
        close, calls = closure_fixture(foreign_api=True)
        result = close()
        self.assertNotIn('stop:masarifi-staging-api-1', calls)
        self.assertNotIn('restore', calls)
        self.assertIn('closeEpoch', calls)
        self.assertIn('stop:voice-worker', calls)
        self.assertNotIn('stop:masarifi-staging-worker-1', calls)
        self.assertEqual(result['sharedApi'], 'preserved')

    def test_unconfirmed_database_closure_reports_failure_without_shared_rollback(self):
        close, calls = closure_fixture(foreign_api=True, closure_error=True)
        with self.assertRaisesRegex(RuntimeError, 'CLOSURE_UNCONFIRMED'):
            close()
        self.assertNotIn('stop:masarifi-staging-api-1', calls)
        self.assertIn('stop:voice-worker', calls)
        self.assertNotIn('stop:masarifi-staging-worker-1', calls)
        self.assertNotIn('restore', calls)

    def test_owned_release_requires_explicit_guarded_analysis_restoration(self):
        close, calls = closure_fixture()
        self.assertEqual(close().get('analysisRestoration'), 'explicit_guarded_cohort_required')
        self.assertLess(calls.index('closeEpoch'), calls.index('stop:voice-worker'))
        self.assertIn('stop:voice-worker',calls)
        self.assertNotIn('restore',calls)


if __name__ == '__main__':
    unittest.main()
