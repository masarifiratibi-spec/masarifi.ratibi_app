import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { t } from "@/core/localization/messages";
import { LocaleProvider } from "@/core/localization/provider";
import { mockServer } from "@/mocks/server";
import { SecurityOverviewRoute } from "./SecurityViews";

let root: Root;
let client: QueryClient;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  client?.clear();
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

test.each(["ar", "en"] as const)("identifies the unavailable live security section alongside available data in %s", async (locale) => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  mockServer.use(
    http.get("/api/v1/admin/security/overview", () => HttpResponse.json({
      freshness: "2026-10-30T00:00:00Z", partial: false,
      metrics: [{ key: "security_events", label: "Security events", value: 7 }],
    })),
    http.get("/api/v1/admin/security/events", () => HttpResponse.json({ items: [], nextCursor: null })),
  );
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(
    <LocaleProvider locale={locale} setLocale={() => undefined}>
      <QueryClientProvider client={client}><SecurityOverviewRoute /></QueryClientProvider>
    </LocaleProvider>,
  ));
  await vi.waitFor(async () => {
    await act(async () => undefined);
    expect(client.isFetching()).toBe(0);
    expect(host.querySelector(".metric-value")?.textContent).toBe("7");
  });
  expect(host.textContent).toContain(locale === "ar" ? "النشاط المشبوه" : "Suspicious Activity");
  expect(host.textContent).toContain(t(locale, "states.unavailableTitle"));
  expect(host.textContent).not.toContain(t(locale, "states.errorTitle"));
  expect(host.textContent).not.toContain("mock");
});
