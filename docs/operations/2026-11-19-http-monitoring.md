# API monitoring for the dashboard

The Admin API reads a small aggregate snapshot at `/run/masarifi/metrics/http.json`. `GET /api/v1/admin/system-health/api` uses the existing `operations.health.read` permission. The response lists the requested window and last observation. The dashboard shows completed requests, responses with a 5xx status divided by all completed requests, and the nearest-rank 95th percentile of their durations. Before the first snapshot, values are unavailable. The Android and iOS filters remain unavailable because HTTP completion events have no trustworthy platform dimension.

## Preparing the VPS candidate

Use the current VPS inventory to identify each API container actually serving the selected environment. Include each instance once, including replaced instances that served traffic within the period. Keep staging and production rosters separate. A container with two completion emitters must be corrected before its logs can be included. Verify a known request produces one completion at each actual serving process. Worker, storage and ingress records are outside this measurement.

The host-side collector reads journald and writes the aggregate file atomically. Run it as an operator identity that can read the selected journals and write the output directory. Mount that directory read-only into the candidate API. Only the aggregate directory needs to enter the application container. Before enabling a schedule, check the read cost on the actual retained journal and run one controlled snapshot. The reader marks observations at least 15 minutes old stale. Snapshot replacement must remain within the mounted directory.

```sh
python3 ops/selfhost/collect-http-metrics.py \
  --container-id "$SERVING_API_CONTAINER_ID" \
  --output /run/masarifi/metrics/http.json
```

Repeat `--container-id` for additional serving instances. The default is partial coverage. Supply `--complete-since` with a timezone-qualified timestamp only after establishing continuous log capture and retention across the entire admitted roster. Rotation, missing instances, collector read failures, sampling, rate-limited/dropped messages and gaps invalidate the operator's completeness assertion. The collector additionally requires retained evidence for each source back to the beginning of a window before it marks the window complete. The host currently has a seven-day retention policy, subject to its size limit. A 30-day selection should ordinarily be partial.

## Local verification and hosted acceptance

Run `python ops/selfhost/test_http_metrics.py` plus the API `http-monitoring` and Admin system-health suites. The synthetic distribution covers two instances, 2xx, 4xx and 5xx, an out-of-scope instance, boundary times and a missing journal. Twenty qualifying requests with durations ending in 19 and 200 ms produce p95 of 19 ms; one 5xx gives 5 percent. Only counts and durations leave the collector.

Candidate acceptance must compare an observed, bounded journal population against the dashboard under an authorized health-reader session and confirm rejection for a role without that permission. Confirm the same window, cutoff, service roster, zero versus unavailable and stale-state behavior. The previously qualified support-access packet routes only its original narrow set of paths. A new package needs the new API route, collector and aggregate mount explicitly admitted together with the new Admin runtime. Its signed-off manifest and the three verified test roles are still required before a hosted switch.

