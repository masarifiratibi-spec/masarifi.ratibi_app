"""Bounded trial coordinator. Host effects belong to an independently admitted adapter.

Importing or running this module changes no service, file, network or database.
The adapter must durably write receipts and prove the actual served generation.
Only the watchdog may install routing; a console request is never a direct switch.
"""
import math
import re
import time
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class WatchRuntime:
    pid: int
    boot_id: str
    now: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def watch(ticket, adapter, runtime):
    pid, boot_id, now, sleep = runtime.pid, runtime.boot_id, runtime.now, runtime.sleep
    deadline = ticket["deadline"]
    require(ticket["bootId"] == boot_id, "BOOT_CHANGED")
    require(isinstance(deadline, (int, float)) and math.isfinite(deadline)
            and 0 < deadline <= now() + 1200, "DEADLINE_INVALID")
    require(isinstance(pid, int) and pid > 0, "PID_INVALID")
    identity = dict(ticket, watchdogPid=pid)
    restarted = adapter.read("armed") is not None
    switched = False
    try:
        if not restarted and now() < deadline:
            adapter.protected()
            adapter.healthy()
            adapter.prove_original()
            adapter.emit("armed", identity)
        while not restarted and now() < deadline:
            if hasattr(adapter, "notify"):
                adapter.notify()
            adapter.protected()
            adapter.healthy()
            if adapter.read("abort") is not None:
                break
            accept = adapter.read("accept")
            if not switched:
                # An acceptance pre-dating the switch cannot attest this trial.
                require(accept is None, "PREMATURE_ACCEPTANCE")
                request = adapter.read("switch")
                if request is not None:
                    require(request == identity and now() < deadline - 15,
                            "SWITCH_REQUEST_INVALID")
                    adapter.install()
                    adapter.prove_candidate()
                    adapter.emit("switched", identity)
                    switched = True
            else:
                adapter.prove_candidate()
                if accept is not None:
                    evidence = accept.get("evidenceSha256")
                    require(isinstance(evidence, str)
                            and re.fullmatch(r"[0-9a-f]{64}", evidence)
                            and accept == dict(identity, evidenceSha256=evidence)
                            and now() < deadline - 30, "ACCEPTANCE_INVALID")
                    # finalize must verify actor-bound evidence and record the
                    # durable decision before making candidate routing persistent.
                    adapter.finalize(evidence)
                    adapter.prove_candidate()
                    adapter.emit("accepted", accept)
                    return "accepted"
            sleep(2)
    except Exception:
        # Never copy request data, configuration or exception bodies to receipts.
        pass
    for attempt in range(4):
        try:
            if hasattr(adapter, "notify"):
                adapter.notify()
            adapter.restore()
            adapter.prove_original()
            adapter.quiesce()
            adapter.emit("restored", identity)
            return "restored"
        except Exception:
            if attempt == 3:
                raise RuntimeError("RESTORATION_UNPROVEN") from None
            sleep(2)
