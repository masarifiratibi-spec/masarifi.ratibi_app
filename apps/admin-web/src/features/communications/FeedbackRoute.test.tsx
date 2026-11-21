import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { LocaleProvider } from "@/core/localization/provider";
import { CurrentPermissionsProvider } from "@/core/permissions/current-permissions";
import { mockServer } from "@/mocks/server";
import { FeedbackRoute } from "./CommunicationRoutes";

let root: Root;
let client: QueryClient;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  client?.clear();
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

test.each(["ar", "en"] as const)("filters live feedback responses with localized feedback states in %s", async (locale) => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const queries: URL[] = [];
  const records = [
    { id: "11000000-0000-4000-8000-000000000001", subject: "New note", status: "new" },
    { id: "11000000-0000-4000-8000-000000000002", subject: "Review idea", status: "reviewing" },
  ].map(item => ({ ...item, type: "idea", body: "Synthetic feedback", version: 1, createdAt: "2026-10-30T00:00:00Z" }));
  mockServer.use(http.get("/api/v1/admin/feedback", ({ request }) => {
    const url = new URL(request.url);
    queries.push(url);
    return HttpResponse.json({ items: records.filter(item =>
      (!url.searchParams.get("status") || item.status === url.searchParams.get("status")) &&
      item.subject.toLowerCase().includes((url.searchParams.get("query") ?? "").toLowerCase())),
      nextCursor: null, hasMore: false });
  }));
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(
    <LocaleProvider locale={locale} setLocale={() => undefined}>
      <CurrentPermissionsProvider permissions={new Set(["feedback.read"])}>
        <QueryClientProvider client={client}><FeedbackRoute /></QueryClientProvider>
      </CurrentPermissionsProvider>
    </LocaleProvider>,
  ));
  const settled = async (check: () => void) => vi.waitFor(async () => {
    await act(async () => undefined);
    expect(client.isFetching()).toBe(0);
    check();
  });
  await settled(() => expect(host.textContent).toContain("New note"));
  const status = host.querySelector("select")!;
  expect([...status.options].map(option => option.value)).toEqual(["", "new", "reviewing", "planned", "resolved", "closed"]);
  expect([...status.options].map(option => option.text)).toContain(locale === "ar" ? "مخطط لها" : "Planned");
  expect(host.querySelectorAll("select")).toHaveLength(1);
  await act(async () => { status.value = "reviewing"; status.dispatchEvent(new Event("change", { bubbles: true })); });
  await settled(() => { expect(host.textContent).toContain("Review idea"); expect(host.textContent).not.toContain("New note"); });
  const search = host.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "idea");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settled(() => {
    expect(queries.at(-1)?.searchParams.get("query")).toBe("idea");
    expect(host.textContent).toContain("Review idea");
  });
  expect(queries.at(-1)?.searchParams.get("status")).toBe("reviewing");
  await act(async () => { status.value = ""; status.dispatchEvent(new Event("change", { bubbles: true })); });
  await settled(() => {
    expect(queries.at(-1)?.searchParams.has("status")).toBe(false);
    expect(host.textContent).toContain("Review idea");
  });
  expect(queries.at(-1)?.searchParams.get("query")).toBe("idea");
  expect(host.textContent).toContain("Review idea");
  expect(host.textContent).not.toContain("New note");
});
