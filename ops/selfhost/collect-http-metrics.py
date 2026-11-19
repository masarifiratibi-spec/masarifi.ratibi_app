"""Write an atomic, aggregate-only snapshot from the admitted API journals."""
import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile

RANGES = {"1h": 1, "24h": 24, "7d": 168, "30d": 720}


def timestamp(value):
    instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if instant.tzinfo is None:
        raise ValueError("timestamp needs UTC offset")
    return instant.astimezone(timezone.utc)


def aggregate(lines, sources, end, complete_since=None):
    windows = {key: (end - timedelta(hours=hours), [0] * 4, Counter())
               for key, hours in RANGES.items()}
    invalid_sources = set()
    earliest = {}
    for line in lines:
        entry = json.loads(line)
        source = entry.get("CONTAINER_ID_FULL")
        if source not in sources:
            continue
        try:
            event = json.loads(entry["MESSAGE"])
        except (TypeError, ValueError, KeyError):
            continue  # Container output includes non-application startup messages.
        if not isinstance(event, dict):
            continue
        # The VPS projection retains the HTTP operation and code, and omits message.
        projected = ("message" not in event and
                     re.fullmatch(r"http\.(get|head|post|put|patch|delete|options)", str(event.get("operation"))) and
                     re.fullmatch(r"OK|HTTP_[45][0-9]{2}", str(event.get("code"))))
        if event.get("message") != "http.completed" and not projected:
            continue
        status, duration = event.get("httpStatus"), event.get("durationMs")
        if (type(status) is not int or not 200 <= status < 600 or
                type(duration) is not int or duration < 0):
            invalid_sources.add(source)
            continue
        at = datetime.fromtimestamp(int(entry["__REALTIME_TIMESTAMP"]) / 1_000_000, timezone.utc)
        earliest[source] = min(earliest.get(source, at), at)
        for start, counts, durations in windows.values():
            if start <= at < end:
                counts[status // 100 - 2] += 1
                durations[duration] += 1

    result = {}
    for key, (start, counts, durations) in windows.items():
        target = math.ceil(sum(counts) * .95)
        running = 0
        p95 = None
        for ms in sorted(durations):
            running += durations[ms]
            if running >= target:
                p95 = ms
                break
        # Never turn an absent, rotated or unreadable container journal into a zero.
        complete = bool(complete_since and complete_since <= start and not invalid_sources
                        and all(src in earliest and earliest[src] <= start for src in sources))
        result[key] = {"counts": counts, "p95Ms": p95, "complete": complete}
    return {"version": 1, "asOf": end.isoformat(), "windows": result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container-id", action="append", required=True,
                        help="full ID of a serving API instance included in this read")
    parser.add_argument("--complete-since", type=timestamp,
                        help="optional operator-attested start of continuous retained capture across ALL serving instances")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    ids = set(args.container_id)
    if not all(re.fullmatch("[a-f0-9]{64}", item) for item in ids):
        parser.error("full container IDs required")
    now = datetime.now(timezone.utc)
    cmd = ["journalctl", "--no-pager", "--quiet", "--output=json",
           "--output-fields=MESSAGE,CONTAINER_ID_FULL", "--since",
           "@" + str(int((now - timedelta(days=31)).timestamp())),
           "--until", "@" + str(math.ceil(now.timestamp()))]
    cmd.extend("CONTAINER_ID_FULL=" + item for item in sorted(ids))
    with subprocess.Popen(cmd, stdout=subprocess.PIPE) as journal:
        result = aggregate(journal.stdout, ids, now, args.complete_since)
        if journal.wait() != 0:
            raise RuntimeError("journal read failed")
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=args.output.parent,
                                     delete=False) as tmp:
        name = tmp.name
        try:
            json.dump(result, tmp, allow_nan=False)
            tmp.flush()
            os.fsync(tmp.fileno())
            os.chmod(name, 0o644)
        except BaseException:
            os.unlink(name)
            raise
    try:
        os.replace(name, args.output)
    finally:
        Path(name).unlink(missing_ok=True)


if __name__ == "__main__":
    main()

