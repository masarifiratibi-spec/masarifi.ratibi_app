import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("http_metrics", Path(__file__).with_name("collect-http-metrics.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class HttpMetricsTest(unittest.TestCase):
    end = datetime(2026, 11, 19, tzinfo=timezone.utc)

    def event(self, src, minutes, status=200, ms=15, projected=False):
        at = self.end - timedelta(minutes=minutes)
        event = {"operation": "http.get", "code": "OK" if status < 400 else f"HTTP_{status}",
                 "httpStatus": status, "durationMs": ms, "requestId": "excluded-private-id"}
        if not projected:
            event["message"] = "http.completed"
        return json.dumps({"CONTAINER_ID_FULL": src, "__REALTIME_TIMESTAMP": str(int(at.timestamp()*1e6)),
                           "MESSAGE": json.dumps(event)})

    def test_aggregate_across_sources(self):
        events = [self.event(src, 65) for src in ("a", "b")]
        events += [self.event("a", 1, ms=i) for i in range(1, 19)]
        events += [self.event("b", 2, 404, 19, True), self.event("b", 3, 503, 200, True),
                   self.event("unexpected", 2, 500), self.event("a", 0, 502)]
        data = collector.aggregate(events, {"a", "b"}, self.end, self.end - timedelta(days=2))
        self.assertEqual(data["windows"]["1h"], {"counts": [18, 0, 1, 1], "p95Ms": 19, "complete": True})
        self.assertFalse(data["windows"]["24h"]["complete"])
        self.assertNotIn("excluded-private-id", json.dumps(data))

    def test_missing_source_or_unverified_coverage_never_confirms_zero(self):
        events = [self.event("a", 65)]
        for sources, since in [({"a","b"}, self.end-timedelta(days=1)), ({"a"}, None)]:
            data = collector.aggregate(events, sources, self.end, since)
            self.assertEqual(data["windows"]["1h"], {"counts":[0,0,0,0], "p95Ms":None, "complete":False})

if __name__ == "__main__":
    unittest.main()

