import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { OperationalListView } from "./ImportsViews";
import { operationalCopy } from "./operationalCopy";

test("searching from a later import page resets to the first filtered cursor", async () => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const queries: URLSearchParams[] = [];
  mockServer.use(
    http.get("/api/v1/admin/imports/failures", ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      return HttpResponse.json({
        items: [
          {
            id: query.has("cursor") ? "IFL-page-two" : "IFL-page-one",
            status: "failed",
            version: 1,
            createdAt: "2026-10-23T00:00:00Z",
          },
        ],
        nextCursor:
          query.has("cursor") || query.has("search") ? null : "next-page",
      });
    }),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <OperationalListView resource="failures" />
        </QueryClientProvider>,
      );
    });
    await vi.waitFor(() => expect(host.textContent).toContain("IFL-page-one"));
    const next = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === operationalCopy.ar.next,
    );
    if (!next) throw new Error("NEXT_BUTTON_MISSING");
    await act(async () => {
      next.click();
    });
    await vi.waitFor(() => expect(host.textContent).toContain("IFL-page-two"));
    const search = host.querySelector("input");
    if (!search) throw new Error("SEARCH_INPUT_MISSING");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(search, "bank");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await vi.waitFor(() => expect(queries.at(-1)?.get("search")).toBe("bank"));
    expect(queries.at(-1)?.has("cursor")).toBe(false);
    await vi.waitFor(() => expect(host.textContent).toContain("IFL-page-one"));
  } finally {
    await act(async () => root.unmount());
    client.clear();
    delete process.env.NEXT_PUBLIC_ENABLE_MOCKS;
  }
});
