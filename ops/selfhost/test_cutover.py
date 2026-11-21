"""Exercise the maintenance boundary without Docker or any source connection."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import tempfile
import time
import types
import unittest
from unittest.mock import Mock, patch


def load_cutover(filename='cutover.py'):
    runtime=types.SimpleNamespace(docker_request=Mock(),inspect=Mock(),render=Mock())
    io=types.ModuleType('migration_io');io.load=lambda name:runtime
    io.bounded=lambda seconds:seconds
    loader=types.SimpleNamespace(create_module=lambda spec:io,exec_module=lambda module:None)
    fake=importlib.util.spec_from_loader('migration_io',loader)
    original=importlib.util.spec_from_file_location
    spec=original('cutover_tested',Path(__file__).with_name(filename))
    module=importlib.util.module_from_spec(spec)
    with patch.object(importlib.util,'spec_from_file_location',side_effect=lambda name,path:fake if Path(path).name=='migration-io.py' else original(name,path)):
        spec.loader.exec_module(module)
    module.event=Mock()
    return module,runtime


class CutoverTests(unittest.TestCase):
    def test_source_recovery_uses_the_authorized_cron_function(self):
        module,_=load_cutover();module.io.source=Mock()
        module.source_access_restore({'targetMayAcceptWrites':False,'originalCatalog':{'database':{'acl':[]}},'originalCron':[{'id':1,'active':True}]})
        sql=module.io.source.call_args.args[0]
        self.assertIn('cron.alter_job(1,active=>true)',sql)
        self.assertNotIn('update cron.job',sql.lower())

    def test_preflight_recognizes_the_actual_https_route_receipt(self):
        module,_=load_cutover()
        with tempfile.TemporaryDirectory() as directory:
            module.ROOT=Path(directory);module.STATE=module.ROOT/'state.json'
            (module.ROOT/'file-route-ready.json').write_text('{"state":"https-private-storage-ready"}')
            with self.assertRaises(FileNotFoundError):module.preflight()

    def test_abort_cannot_restore_source_after_target_may_write(self):
        module,runtime=load_cutover()
        module.state=lambda:{'targetMayAcceptWrites':True}
        module.source_access_restore=Mock()
        with self.assertRaisesRegex(AssertionError,'SOURCE_RETURN_FORBIDDEN'):
            module.abort()
        module.source_access_restore.assert_not_called()
        runtime.docker_request.assert_not_called()

    def test_failure_after_boundary_requires_forward_repair(self):
        module,_=load_cutover();current={'phase':'prepared','targetMayAcceptWrites':False}
        module.state=lambda:current;module.abort=Mock()
        def activate_then_fail():
            current.update(targetMayAcceptWrites=True,phase='activating-apis')
            raise RuntimeError('fixture failure')
        module.freeze=activate_then_fail
        with patch.object(module.sys,'argv',['cutover.py','run']):
            with self.assertRaisesRegex(RuntimeError,'fixture failure'):module.main()
        module.abort.assert_not_called()

    def test_persists_boundary_before_any_operational_container_creation(self):
        module,runtime=load_cutover()
        current={'phase':'data-verified','targetMayAcceptWrites':False,'startedAt':time.time(),'newConsumers':[],'sourceConsumers':[{'id':'original','restart':{'Name':'always','MaximumRetryCount':0}}]}
        with tempfile.TemporaryDirectory() as directory:
            module.ROOT=Path(directory)
            (module.ROOT/'final-data-verification.json').write_text('{"state":"passed"}')
            (module.ROOT/'runtime-candidates.json').write_text('[{"id":"original","name":"/fixture-api"}]')
            module.state=lambda:json.loads(json.dumps(current));persisted=[]
            def save(value):current.update(value);persisted.append(json.loads(json.dumps(value)))
            module.save=save;module.enable_idle_target_scheduler=Mock();module.ready=Mock()
            runtime.inspect.return_value={'State':{'Running':False}}
            runtime.render.return_value=({'Env':['MASARIFI_PROCESS_KIND=api'],'HostConfig':{'RestartPolicy':{'Name':'no','MaximumRetryCount':0}}},{})
            def docker(method,path,body=None):
                if '/create?' in path or path.endswith('/start'):
                    self.assertTrue(persisted[-1]['targetMayAcceptWrites'])
                if '/create?' in path:
                    self.assertEqual(body['HostConfig']['RestartPolicy'],{'Name':'always','MaximumRetryCount':0})
                return {'Id':'target'}
            runtime.docker_request.side_effect=docker
            module.activate_apis()
            self.assertTrue(current['targetMayAcceptWrites'])
            self.assertEqual(current['phase'],'apis-active')

    def test_sigterm_before_writes_runs_source_recovery(self):
        module,_=load_cutover();current={'phase':'prepared','targetMayAcceptWrites':False}
        module.state=lambda:current;module.abort=Mock();handlers={}
        def stop_during_freeze():
            self.assertIn(signal.SIGTERM,handlers)
            handlers[signal.SIGTERM](signal.SIGTERM,None)
        module.freeze=stop_during_freeze
        with patch.object(signal,'signal',side_effect=lambda key,handler:handlers.setdefault(key,handler)),patch.object(module.sys,'argv',['cutover.py','run']):
            with self.assertRaises(InterruptedError):module.main()
        module.abort.assert_called_once()

    def test_abandoned_transfer_clients_are_removed_only_by_the_task_label(self):
        module,runtime=load_cutover()
        runtime.docker_request.return_value=[{'Id':'temporary-reader','Labels':{'masarifi.selfhost.transfer':'20261113'}}]
        module.cleanup_transfer_clients()
        self.assertIn('filters=',runtime.docker_request.call_args_list[0].args[1])
        self.assertEqual(runtime.docker_request.call_args_list[1].args,('DELETE','/containers/temporary-reader?force=1'))
        runtime.docker_request.reset_mock()
        runtime.docker_request.return_value=[{'Id':'unrelated','Labels':{}}]
        with self.assertRaises(AssertionError):module.cleanup_transfer_clients()
        self.assertEqual(runtime.docker_request.call_count,1)

    @unittest.skipUnless(hasattr(signal,'setitimer'),'POSIX absolute timer is qualified on the VPS')
    def test_absolute_deadline_interrupts_a_blocked_operation(self):
        module,_=load_cutover();started=time.monotonic()
        try:
            with self.assertRaises(TimeoutError):
                module.arm_deadline(time.time()+0.03)
                time.sleep(0.5)
            self.assertLess(time.monotonic()-started,0.25)
        finally:signal.setitimer(signal.ITIMER_REAL,0)


if __name__=='__main__':unittest.main()
