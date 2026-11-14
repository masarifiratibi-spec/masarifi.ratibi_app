import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/core/localization/provider";
import { CurrentPermissionsProvider } from "@/core/permissions/current-permissions";
import { mockServer } from "@/mocks/server";
import { IncidentDetailRoute, SecurityIncidentList } from "./SecurityViews";

const id = "13000000-0000-4000-8000-000000000001";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.unstubAllEnvs();
  document.body.replaceChildren();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

test.each([true, false])("incident entry links respect the current permission (%s)", async (allowed) => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
  let calls = 0;
  mockServer.use(http.get("/api/v1/admin/security/incidents", () => {
    calls += 1;
    return HttpResponse.json({ items: [{ id, title: "Security incident", severity: "high", status: "investigating",
      detectedAt: "2026-09-10T08:00:00.000Z", owner: null, summaryRedacted: null, version: 1 }], nextCursor: null });
  }));
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(
    <CurrentPermissionsProvider permissions={new Set(allowed ? ["security.incidents.manage"] : [])}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SecurityIncidentList />
      </QueryClientProvider>
    </CurrentPermissionsProvider>,
  ));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
  expect(host.querySelector("a")?.getAttribute("href") ?? null).toBe(allowed ? `/admin/security/incidents/${id}` : null);
  expect(calls).toBe(allowed ? 1 : 0);
  await act(async () => root.unmount());
});

test.each([
  ["open", "مفتوح"],
  ["investigating", "قيد التحقيق"],
  ["contained", "تم الاحتواء"],
  ["resolved", "محلول"],
] as const)("localizes the %s incident state in Arabic", async (status, label) => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
  mockServer.use(http.get(`/api/v1/admin/security/incidents/${id}`, () => HttpResponse.json({
    id, title: "Incident", severity: "high", status, detectedAt: "2026-09-10T08:00:00.000Z",
    owner: null, summaryRedacted: null, version: 1, timeline: [],
  })));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(
    <LocaleProvider locale="ar" setLocale={() => undefined}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <IncidentDetailRoute incidentId={id} />
      </QueryClientProvider>
    </LocaleProvider>,
  ));
  await expect.poll(() => host.textContent).toContain(label);
  await act(async () => root.unmount());
});

test("explains when reading an incident requires recent authentication", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
  mockServer.use(http.get(`/api/v1/admin/security/incidents/${id}`, () =>
    HttpResponse.json({ code: "RECENT_AUTH_REQUIRED" }, { status: 403 })));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(
    <LocaleProvider locale="en" setLocale={() => undefined}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <IncidentDetailRoute incidentId={id} />
      </QueryClientProvider>
    </LocaleProvider>,
  ));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
  await expect.poll(() => host.querySelector('[role="alert"]')?.textContent).toContain("Sign out and sign in again");
  await act(async () => root.unmount());
});
