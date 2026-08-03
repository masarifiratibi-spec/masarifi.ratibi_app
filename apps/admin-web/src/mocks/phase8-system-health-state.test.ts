import { describe, expect, test } from "vitest";
import {
  getPhase8JobRun,
  listPhase8JobRuns,
  listPhase8QueueHealth,
  listPhase8ScheduledJobs,
  resetPhase8SystemHealthState,
  retryPhase8JobRun,
  cancelPhase8JobRun,
} from "./phase8-system-health-state";

describe("Phase 8 queue/job deterministic read state", () => {
  test("resets to fixed queues and job records", () => {
    resetPhase8SystemHealthState();
    const queues = listPhase8QueueHealth({ range: "24h", platform: "all" });
    expect(queues.items).toHaveLength(7);
    expect(queues.items[0].queue).toBe("imports");
    expect(queues.freshness.observedAt).toBe("2026-08-01T11:58:00+03:00");
  });

  test("filters job runs and returns safe details", () => {
    resetPhase8SystemHealthState();
    const runs = listPhase8JobRuns({ queue: "imports", state: "failed", page: 1, pageSize: 25 });
    expect(runs.items).toContainEqual(expect.objectContaining({ id: "JOB-DEMO-FAILED-01", queue: "imports", state: "failed" }));
    const detail = getPhase8JobRun("JOB-DEMO-FAILED-01");
    expect(detail?.metadata).toContainEqual(expect.objectContaining({ key: "batch_type" }));
    expect(JSON.stringify(detail)).not.toMatch(/token|secret|payload|customer|filename|select \*/i);
  });

  test("retries failed runs and cancels waiting runs deterministically", () => {
    resetPhase8SystemHealthState();
    const retry = retryPhase8JobRun("JOB-DEMO-FAILED-01", {
      jobRunId: "JOB-DEMO-FAILED-01",
      expectedVersion: 1,
      reason: "Retry after safe operator review.",
      submissionKey: "SUB-DEMO-RETRY",
    });
    expect(retry.retry.run.retryOfJobRunId).toBe("JOB-DEMO-FAILED-01");
    expect(retry.retry.run.state).toBe("waiting");
    expect(retry.outcome.audit.label).toBe("job.retry_requested");

    const cancel = cancelPhase8JobRun("JOB-DEMO-WAITING-01", {
      jobRunId: "JOB-DEMO-WAITING-01",
      expectedVersion: 1,
      reason: "Cancel after safe operator review.",
      submissionKey: "SUB-DEMO-CANCEL",
    });
    expect(cancel.cancelled.state).toBe("cancelled");
    expect(cancel.outcome.audit.label).toBe("job.cancel_requested");
  });

  test("lists all seven read-only scheduled jobs", () => {
    const schedules = listPhase8ScheduledJobs({ queue: "all", page: 1, pageSize: 25 });
    expect(schedules.items).toHaveLength(7);
    expect(schedules.items[0].id).toMatch(/^SCH-/);
    expect(JSON.stringify(schedules)).not.toMatch(/run now|token|secret|payload/i);
  });
});
