"""Persistent operating sequencing; the host owns approval, SQL and identity gates.

No executable packet or CLI is supplied here. A host must serialize sequence()
reentrantly, durably publish cancellation before waiting for that lock, and
enforce approval plus current-epoch fences in every forward operation.
"""
def require(value,reason):
 if not value:raise RuntimeError(reason)

def begin(host):
 host.validate(activation=True)
 host.preflight()
 state=None
 with host.sequence():
  host.validate(activation=True)
  host.claim()
  try:
   state=host.prepare()
   # Each possibly blocking boundary receives a fresh cancellation/SQL fence.
   for operation in [host.arm,host.start_api,host.start_worker_off,
                     host.verify_worker_off,host.stop_analysis,host.promote]:
    host.forward(state)
    operation(state)
   host.forward(state)
   host.activate(state)
   host.forward(state,active=True)
   host.ready(state)
   host.forward(state,active=True)
   host.save_ready(state)
   return state
  except BaseException:
   # Never repeat preparation after a missing/uncertain database response.
   if state is None:state=host.reconcile()
   if state is not None:
    receipt=close(state,host,'failed_begin')
    require(receipt['postingOff'] and receipt['workerStopped'] and
            receipt['restored'] and receipt['helpersStopped'] and not receipt['blockers'],
            'FAILED_BEGIN_CLOSURE_UNCONFIRMED')
   raise

def close(state,host,reason='closure_requested'):
 host.request_close(reason)
 with host.sequence():
  with host.cleanup_budget():
   # A process waiting on the lock may hold stale pre-activation identities.
   state=host.state()
   host.guard(state)
   receipt={'postingOff':False,'workerStopped':False,'restored':False,'helpersStopped':False,'blockers':[]}
   operations=[('workerStopped',lambda:host.stop_worker(state),'WRITER_STOP_UNCONFIRMED'),
               ('postingOff',lambda:closed_epoch(host.close_epoch(state)),'OFF_UNCONFIRMED')]
   for field,operation,code in operations:
    try:operation();receipt[field]=True
    except (RuntimeError,OSError,ValueError,KeyError,TypeError):receipt['blockers'].append(code)
   if receipt['postingOff'] and receipt['workerStopped']:
    try:
     host.restore_route(state);host.stop_api(state);host.restore_analysis(state);host.verify_restored(state)
     receipt['restored']=True
    except (RuntimeError,OSError,ValueError,KeyError,TypeError):receipt['blockers'].append('RESTORATION_UNCONFIRMED')
   try:host.stop_helpers(state);receipt['helpersStopped']=True
   except (RuntimeError,OSError,ValueError,KeyError,TypeError):receipt['blockers'].append('HELPER_STOP_UNCONFIRMED')
   host.save_closure(receipt)
   return receipt

def closed_epoch(result):
 require(isinstance(result,dict) and result.get('state')=='closed' and result.get('posting') is False,'OFF_UNCONFIRMED')

def recover(state,host):
 with host.sequence():
  state=host.state()
  host.validate(activation=False)
  try:
   host.recovery_fence(state)
   # The host must check cancellation again immediately before its start call.
   host.start_worker(state)
   host.recovery_fence(state)
   host.ready(state)
   host.recovery_fence(state)
   host.save_ready(state)
  except BaseException:
   receipt=close(state,host,'failed_recovery')
   require(receipt['postingOff'] and receipt['workerStopped'] and receipt['restored'] and
           receipt['helpersStopped'] and not receipt['blockers'],'FAILED_RECOVERY_CLOSURE_UNCONFIRMED')
   raise

def monitor(state,host):
 failures=0
 while True:
  reason=None
  try:
   state=host.state()
   snapshot=host.snapshot(state)
  except (RuntimeError,OSError,ValueError,KeyError,TypeError):snapshot={'scopeValid':False}
  if (snapshot.get('scopeValid') is not True or snapshot.get('mode')!='operating' or
      snapshot.get('currentEpochMatches') is not True):reason='scope_failure'
  elif snapshot.get('state')=='closed':reason='epoch_closed'
  elif snapshot.get('state')=='prepared':
   age=host.now()-state['startsAt']
   if snapshot.get('posting') is not False or age<0:reason='scope_failure'
   elif age>=90:reason='arming_timeout'
  elif snapshot.get('state')!='active' or snapshot.get('posting') is not True:reason='scope_failure'
  else:
   failures=0 if snapshot.get('apiReady') is True and snapshot.get('workerHealthy') is True else failures+1
   if failures>=3 and host.now()>=state.get('activationRequestedAt',state['startsAt'])+15:reason='runtime_unhealthy'
  if reason:
   result=close(state,host,reason)
   require(result['postingOff'] and result['workerStopped'] and result['restored'] and
           result['helpersStopped'] and not result['blockers'],'OPERATING_CLOSURE_UNCONFIRMED')
   return reason
  # Financial commits are intentionally not a termination condition. Eligibility,
  # idempotency and posting guards remain enforced by the qualified SQL/worker.
  host.pause(5)
