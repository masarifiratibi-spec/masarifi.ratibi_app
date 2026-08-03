import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import {
  ApiMonitoringView,
  DatabaseMonitoringView,
  HealthOverviewView,
  JobRunsView,
  ProviderHealthView,
  QueueOverviewView,
  ScheduledJobsView,
  StorageMonitoringView,
} from "./OperationsViews";
import { JobRunDetailView } from "./JobRunDetailView";

const roots: Root[] = [];

async function renderView(node = <HealthOverviewView />) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    flushSync(() => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          {node}
        </QueryClientProvider>,
      );
    });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  return host;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => act(async () => root.unmount())));
});

describe("US1 health overview view", () => {
  test("renders range controls, manual refresh, and non-color service status", async () => {
    const host = await renderView();
    for (const range of ["1h", "24h", "7d", "30d"]) {
      expect(host.textContent).toContain(range);
    }
    expect(host.querySelectorAll("[data-service-health-card]")).toHaveLength(12);
    expect(host.textContent).toContain("Manual refresh");
    expect(host.textContent).toContain("Freshness");
    expect(host.textContent).toContain("Degraded");
  });
});

describe("US2 monitoring views", () => {
  test("renders safe API database and storage diagnostics with explicit units", async () => {
    const api = await renderView(<ApiMonitoringView />);
    expect(api.textContent).toContain("API Monitoring");
    expect(api.textContent).toContain("milliseconds");
    expect(api.textContent).not.toMatch(/token|secret|rawPath|select \*/i);

    const database = await renderView(<DatabaseMonitoringView />);
    expect(database.textContent).toContain("Database Monitoring");
    expect(database.textContent).toContain("Backup");
    expect(database.textContent).not.toMatch(/select \*|connection string|password/i);

    const storage = await renderView(<StorageMonitoringView />);
    expect(storage.textContent).toContain("Storage Monitoring");
    expect(storage.textContent).toContain("Cleanup");
    expect(storage.textContent).not.toMatch(/filename|object key|signed url|checksum/i);
  });
});

describe("US3 provider health view", () => {
  test("renders provider filters, safe fallback impact, and no mutation controls", async () => {
    const host = await renderView(<ProviderHealthView />);
    expect(host.textContent).toContain("Provider Health");
    expect(host.textContent).toContain("Stripe");
    expect(host.textContent).toContain("AI");
    expect(host.textContent).toContain("Fallback");
    expect(host.textContent).toContain("All platforms");
    expect(host.textContent).not.toMatch(/api key|token|secret|webhook|account id|edit|rotate/i);
  });
});

describe("US4 queue and job views", () => {
  test("renders queue counters and safe job links", async () => {
    const queues = await renderView(<QueueOverviewView />);
    expect(queues.textContent).toContain("Queue Overview");
    expect(queues.textContent).toContain("Waiting");
    expect(queues.textContent).toContain("Retried");

    const runs = await renderView(<JobRunsView />);
    expect(runs.textContent).toContain("Job Runs");
    expect(runs.textContent).toContain("JOB-DEMO-FAILED-01");
    expect(runs.textContent).not.toMatch(/payload|token|secret|customer|filename|select \*/i);
  });
});

describe("US5 job action controls", () => {
  test("renders retry action with bounded reason input on eligible detail", async () => {
    const host = await renderView(<JobRunDetailView jobRunId="JOB-DEMO-FAILED-01" />);
    expect(host.textContent).toContain("Retry job");
    expect(host.querySelector("textarea")?.getAttribute("aria-label")).toBe("Action reason");
  });
});

describe("US6 scheduled jobs view", () => {
  test("renders read-only schedules without mutation controls", async () => {
    const host = await renderView(<ScheduledJobsView />);
    expect(host.textContent).toContain("Scheduled Jobs");
    expect(host.textContent).toContain("Next run");
    expect(host.textContent).not.toMatch(/run now|enable|disable|delete|edit/i);
  });
});
