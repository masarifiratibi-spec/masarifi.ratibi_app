"""Operating lifecycle uses inert external boundaries; never submits Voice."""
import contextlib,importlib.util,pathlib,unittest
P=pathlib.Path(__file__).with_name('operating-lifecycle.py')
spec=importlib.util.spec_from_file_location('operating_lifecycle',P)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Host:
 def __init__(self,cancel=None):
  self.calls=[];self.cancel=cancel;self.cancelled=False;self.epoch='prepared';self.clock=100
  self.current={'startsAt':100,'activationRequestedAt':100,'epochId':'owned','manifestHash':'exact'}
  self.committed=0;self.pauses=0;self.close_fail=False;self.lost_prepare=False;self.prepare_calls=0
 def record(self,name):
  self.calls.append(name)
  if self.cancel==name:self.cancelled=True
 def validate(self,activation=True):self.record('validate')
 def preflight(self):self.record('preflight')
 @contextlib.contextmanager
 def sequence(self):self.record('lock');yield
 def claim(self):self.record('claim')
 def state(self):return self.current
 def prepare(self):
  self.prepare_calls+=1;self.record('prepare')
  if self.lost_prepare:raise RuntimeError('UNCERTAIN_PREPARE')
  return self.current
 def reconcile(self):self.record('reconcile');return self.current
 def forward(self,state,active=False):
  self.record('forward')
  if self.cancelled:raise RuntimeError('CLOSURE_REQUESTED')
  if self.epoch!=('active' if active else 'prepared'):raise RuntimeError('EPOCH_FENCE_CLOSED')
 def arm(self,state):self.record('arm')
 def start_api(self,state):self.record('start_api')
 def start_worker_off(self,state):self.record('start_worker_off')
 def verify_worker_off(self,state):self.record('verify_worker_off')
 def stop_analysis(self,state):self.record('stop_analysis')
 def promote(self,state):self.record('promote')
 def activate(self,state):self.record('activate');self.epoch='active'
 def ready(self,state):self.record('ready')
 def save_ready(self,state):self.record('save_ready')
 def request_close(self,reason):self.record('request_close');self.cancelled=True
 @contextlib.contextmanager
 def cleanup_budget(self):yield
 def guard(self,state):self.record('guard')
 def stop_worker(self,state):self.record('stop_worker')
 def close_epoch(self,state):
  self.record('close_epoch')
  if self.close_fail:raise RuntimeError('DATABASE_UNAVAILABLE')
  self.epoch='closed';return {'state':'closed','posting':False}
 def restore_route(self,state):self.record('restore_route')
 def stop_api(self,state):self.record('stop_api')
 def restore_analysis(self,state):self.record('restore_analysis')
 def verify_restored(self,state):self.record('verify_restored')
 def stop_helpers(self,state):self.record('stop_helpers')
 def save_closure(self,receipt):self.record('save_closure')
 def now(self):return self.clock
 def pause(self,seconds):self.clock+=seconds;self.pauses+=1
 def snapshot(self,state):
  self.committed+=1
  # A fault after two successful transactions must close; the first cannot.
  return {'scopeValid':True,'mode':'operating','currentEpochMatches':True,'state':self.epoch,
          'posting':self.epoch=='active','committed':self.committed,'apiReady':self.pauses<2,'workerHealthy':True}
 def recovery_fence(self,state):self.forward(state,True)
 def start_worker(self,state):self.record('start_worker')

class LifecycleTests(unittest.TestCase):
 def test_operating_does_not_close_after_first_or_second_commit(self):
  h=Host();h.epoch='active';reason=m.monitor(h.current,h)
  self.assertEqual(reason,'runtime_unhealthy');self.assertGreater(h.committed,2)
  self.assertEqual(h.calls.count('request_close'),1);self.assertEqual(h.epoch,'closed')
 def test_prepared_epoch_never_runs_indefinitely(self):
  h=Host();self.assertEqual(m.monitor(h.current,h),'arming_timeout')
  self.assertLessEqual(h.clock,195)
 def test_cancellation_after_each_forward_step_stops_later_operations(self):
  steps=['prepare','arm','start_api','start_worker_off','verify_worker_off','stop_analysis','promote','activate','ready']
  for index,step in enumerate(steps):
   with self.subTest(step=step):
    h=Host(cancel=step)
    with self.assertRaisesRegex(RuntimeError,'CLOSURE_REQUESTED'):m.begin(h)
    self.assertFalse(any(nextstep in h.calls for nextstep in steps[index+1:]))
    self.assertEqual(h.epoch,'closed');self.assertIn('stop_worker',h.calls)
 def test_uncertain_prepare_reconciles_once_without_another_prepare(self):
  h=Host();h.lost_prepare=True
  with self.assertRaisesRegex(RuntimeError,'UNCERTAIN_PREPARE'):m.begin(h)
  self.assertEqual(h.prepare_calls,1);self.assertEqual(h.calls.count('reconcile'),1)
  self.assertEqual(h.epoch,'closed');self.assertNotIn('start_api',h.calls)
 def test_shutdown_published_before_waiting_for_sequence_lock(self):
  h=Host();m.close(h.current,h,'runtime_unhealthy')
  self.assertLess(h.calls.index('request_close'),h.calls.index('lock'))
  self.assertLess(h.calls.index('stop_worker'),h.calls.index('close_epoch'))
 def test_database_failure_still_stops_writer_and_helpers_without_route_change(self):
  h=Host();h.close_fail=True;r=m.close(h.current,h,'runtime_unhealthy')
  self.assertTrue(r['workerStopped']);self.assertFalse(r['postingOff']);self.assertFalse(r['restored'])
  self.assertIn('stop_helpers',h.calls);self.assertNotIn('restore_route',h.calls)
 def test_recovery_rechecks_active_epoch_after_lock(self):
  h=Host();h.epoch='closed'
  with self.assertRaisesRegex(RuntimeError,'EPOCH_FENCE_CLOSED'):m.recover(h.current,h)
  self.assertNotIn('start_worker',h.calls)
 def test_recovery_cancelled_during_blocking_read_cannot_start_writer(self):
  h=Host(cancel='forward');h.epoch='active'
  with self.assertRaisesRegex(RuntimeError,'CLOSURE_REQUESTED'):m.recover(h.current,h)
  self.assertNotIn('start_worker',h.calls)
 def test_wrong_mode_closes_without_accepting_healthy_runtime(self):
  h=Host();h.epoch='active';original=h.snapshot
  h.snapshot=lambda state:{**original(state),'mode':'canary'}
  self.assertEqual(m.monitor(h.current,h),'scope_failure')
 def test_ready_requires_post_activation_forward_fence(self):
  h=Host();self.assertIs(m.begin(h),h.current)
  self.assertLess(h.calls.index('activate'),h.calls.index('ready'))
  self.assertEqual(h.calls[-2:],['forward','save_ready'])
 def test_monitor_refreshes_activation_clock_from_durable_state(self):
  h=Host();h.epoch='active';h.clock=185
  stale=dict(h.current);h.current={**h.current,'activationRequestedAt':185}
  h.snapshot=lambda state:{'scopeValid':True,'mode':'operating','currentEpochMatches':True,
                          'state':'active','posting':True,'apiReady':False,'workerHealthy':False}
  self.assertEqual(m.monitor(stale,h),'runtime_unhealthy')
  self.assertGreaterEqual(h.clock,200)
 def test_cleanup_budget_covers_state_and_provenance_reads(self):
  h=Host();h.budget_open=False
  @contextlib.contextmanager
  def budget():
   h.budget_open=True
   try:yield
   finally:h.budget_open=False
  def state():
   self.assertTrue(h.budget_open,'cleanup provenance read must be budgeted')
   return h.current
  h.cleanup_budget=budget;h.state=state
  self.assertTrue(m.close(h.current,h)['postingOff'])
 def test_recovery_cancelled_after_start_immediately_stops_owned_writer(self):
  h=Host(cancel='start_worker');h.epoch='active'
  with self.assertRaisesRegex(RuntimeError,'CLOSURE_REQUESTED'):m.recover(h.current,h)
  self.assertIn('stop_worker',h.calls);self.assertEqual(h.epoch,'closed')
 def test_recovery_ready_failure_closes_without_a_second_start(self):
  h=Host();h.epoch='active'
  def bad_ready(state):raise RuntimeError('WORKER_UNHEALTHY')
  h.ready=bad_ready
  with self.assertRaisesRegex(RuntimeError,'WORKER_UNHEALTHY'):m.recover(h.current,h)
  self.assertEqual(h.calls.count('start_worker'),1);self.assertEqual(h.epoch,'closed')
 def test_failed_helper_stop_is_an_incident_not_false_success(self):
  h=Host()
  def bad_stop(state):raise RuntimeError('DOCKER_UNAVAILABLE')
  h.stop_helpers=bad_stop;r=m.close(h.current,h)
  self.assertFalse(r['helpersStopped']);self.assertIn('HELPER_STOP_UNCONFIRMED',r['blockers'])
 def test_false_closed_receipt_cannot_authorize_route_restoration(self):
  h=Host();h.close_epoch=lambda state:{'state':'closed','posting':True}
  r=m.close(h.current,h)
  self.assertFalse(r['postingOff']);self.assertNotIn('restore_route',h.calls)
 def test_failed_writer_stop_still_closes_epoch_but_preserves_ingress(self):
  h=Host()
  def bad_stop(state):raise RuntimeError('FOREIGN_WRITER')
  h.stop_worker=bad_stop;r=m.close(h.current,h)
  self.assertTrue(r['postingOff']);self.assertFalse(r['workerStopped']);self.assertFalse(r['restored'])
  self.assertIn('stop_helpers',h.calls);self.assertNotIn('restore_route',h.calls)

if __name__=='__main__':unittest.main()
